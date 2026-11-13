/**
 * The transaction lifecycle, free of React and wallet libraries so every branch can be tested.
 *
 * Invariant: `confirmed` is only ever reported after an RPC receipt with status "success"
 * for the submitted (or an identically repriced) transaction. Everything else is pending, failed or rejected.
 */
import type { Address, Hex } from 'viem'

export type TxPhase = 'idle' | 'switching' | 'simulating' | 'signing' | 'pending' | 'confirmed' | 'failed'

export interface TxState {
  phase: TxPhase
  hash?: Hex
  message?: string
}

export interface ReceiptLike {
  status: 'success' | 'reverted'
  blockNumber: bigint
  transactionHash: Hex
  to?: Address | null
}

export type Replacement = { reason: 'repriced' | 'cancelled' | 'replaced'; transactionHash: Hex }

export interface WalletLike {
  chainId: number
  account: Address | undefined
}

export interface PreparedTx {
  send: () => Promise<Hex>
}

export interface TxDeps {
  chainId: number
  networkName: string
  /** The account the UI believes is signing. */
  address: Address
  /** The contract the call must hit. */
  target: Address
  getWallet: () => Promise<WalletLike | null>
  switchChain: () => Promise<void>
  /** Simulates the call; throws a decodable revert if it would fail. */
  prepare: () => Promise<PreparedTx>
  /** Resolves with a receipt, or throws on timeout / RPC failure. Calls onReplaced for speed-up or cancel. */
  waitForReceipt: (hash: Hex, onReplaced: (r: Replacement) => void) => Promise<ReceiptLike>
  getReceipt: (hash: Hex) => Promise<ReceiptLike | null>
  getBlockNumber: () => Promise<bigint>
  onState: (state: TxState) => void
  store: {
    add: (hash: Hex) => void
    update: (hash: Hex, patch: { status: 'pending' | 'confirmed' | 'failed'; blockNumber?: string; error?: string }) => void
  }
  describe: (error: unknown) => { kind: string; message: string }
  sleep: (ms: number) => Promise<void>
  now: () => number
  /** How long to keep checking for a receipt before telling the user it is still pending. */
  confirmWindowMs: number
}

export type TxOutcome = 'confirmed' | 'failed' | 'pending' | 'rejected'

export interface TxResult {
  outcome: TxOutcome
  hash?: Hex
  blockNumber?: bigint
}

const sameAddress = (a?: string | null, b?: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase()

export async function executeTx(deps: TxDeps): Promise<TxResult> {
  const { onState } = deps
  let hash: Hex | undefined
  const fail = (message: string, blockNumber?: bigint): TxResult => {
    onState({ phase: 'failed', message, hash })
    return { outcome: 'failed', hash, blockNumber }
  }

  try {
    let wallet = await deps.getWallet()
    if (!wallet || wallet.chainId !== deps.chainId) {
      onState({ phase: 'switching', message: `Switch your wallet to ${deps.networkName}.` })
      await deps.switchChain()
      wallet = await deps.getWallet()
    }
    if (!wallet || wallet.chainId !== deps.chainId) return fail(`Your wallet is not on ${deps.networkName}. Switch network and try again.`)
    if (!sameAddress(wallet.account, deps.address)) {
      return fail('The active wallet account changed. Reconnect your wallet and try again.')
    }

    onState({ phase: 'simulating', message: 'Checking the transaction against the chain.' })
    const prepared = await deps.prepare()

    onState({ phase: 'signing', message: 'Confirm in your wallet.' })
    hash = await prepared.send()
    deps.store.add(hash)
    onState({ phase: 'pending', hash, message: 'Waiting for confirmation onchain.' })
  } catch (error) {
    const d = deps.describe(error)
    if (d.kind === 'rejected') {
      onState({ phase: 'idle' })
      return { outcome: 'rejected' }
    }
    return fail(d.message)
  }

  // From here a hash exists. Never report failure for an unconfirmed transaction: it may still land.
  const submitted: Hex = hash
  let replacement: Replacement | undefined
  const deadline = deps.now() + deps.confirmWindowMs
  let receipt: ReceiptLike | null = null
  let backoff = 1_000

  while (!receipt && deps.now() < deadline) {
    try {
      receipt = await deps.waitForReceipt(submitted, (r) => {
        replacement = r
      })
    } catch {
      try {
        receipt = await deps.getReceipt(submitted)
      } catch {
        // RPC unavailable right now
      }
      if (!receipt) {
        await deps.sleep(backoff)
        backoff = Math.min(backoff * 2, 8_000)
      }
    }
  }

  if (!receipt) {
    onState({
      phase: 'pending',
      hash: submitted,
      message: 'Still waiting for confirmation. The transaction was submitted; check the explorer. This page will update if it lands.',
    })
    return { outcome: 'pending', hash: submitted }
  }

  const rep = replacement
  if (rep && rep.reason !== 'repriced') {
    deps.store.update(submitted, { status: 'failed', blockNumber: receipt.blockNumber.toString(), error: `Transaction ${rep.reason}` })
    return fail(rep.reason === 'cancelled' ? 'The transaction was cancelled from your wallet.' : 'The transaction was replaced by a different one.', receipt.blockNumber)
  }
  if (receipt.status !== 'success') {
    deps.store.update(submitted, { status: 'failed', blockNumber: receipt.blockNumber.toString(), error: 'Reverted onchain' })
    return fail('The transaction was mined but reverted onchain.', receipt.blockNumber)
  }
  if (receipt.to && !sameAddress(receipt.to, deps.target)) {
    deps.store.update(submitted, { status: 'failed', blockNumber: receipt.blockNumber.toString(), error: 'Unexpected target' })
    return fail('The confirmed transaction did not target the expected contract.', receipt.blockNumber)
  }

  deps.store.update(submitted, { status: 'confirmed', blockNumber: receipt.blockNumber.toString() })
  onState({ phase: 'confirmed', hash: submitted, message: 'Confirmed onchain.' })
  return { outcome: 'confirmed', hash: submitted, blockNumber: receipt.blockNumber }
}

/** Module-level guard so the same action cannot be submitted twice from different components. */
const inflight = new Set<string>()

export function actionKey(address: string, contract: string, fn: string, args: readonly unknown[]): string {
  const body = JSON.stringify(args, (_k, v: unknown) => (typeof v === 'bigint' ? `${v}n` : v))
  return `${address.toLowerCase()}|${contract}|${fn}|${body}`
}

export function acquireAction(key: string): boolean {
  if (inflight.has(key)) return false
  inflight.add(key)
  return true
}

export function releaseAction(key: string): void {
  inflight.delete(key)
}
