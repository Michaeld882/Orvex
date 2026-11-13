import { useCallback, useEffect, useRef, useState } from 'react'
import { useAccount, useSwitchChain } from 'wagmi'
import { getWalletClient } from 'wagmi/actions'
import { useQueryClient } from '@tanstack/react-query'
import { ABI_BY_KEY, type ContractKey } from '@/abi'
import { config } from '@/config'
import { ACTIVE_ADDRESSES, ACTIVE_CHAIN_ID, ACTIVE_NETWORK_NAME, readClient } from '@/lib/active'
import { describeError } from '@/lib/errors'
import { checkRpcHealth, waitForHead } from '@/lib/rpc'
import { acquireAction, actionKey, executeTx, releaseAction, type TxState } from '@/lib/txRunner'
import { addTx, updateTx, useTxs } from '@/lib/txStore'
import { ORVEX_KEY } from './queries'

export type { TxPhase, TxState } from '@/lib/txRunner'

export interface TxRequest {
  /** Human label stored in the transaction history. */
  label: string
  contract: ContractKey
  functionName: string
  args: readonly unknown[]
}

const CONFIRM_WINDOW_MS = 10 * 60_000
const RECEIPT_POLL_TIMEOUT_MS = 60_000
const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))

/**
 * One transaction at a time per component, and never the same action twice across the app.
 * Verifies the wallet is on the active Arc network and account, simulates the call so reverts
 * surface as readable errors, then reports success only after an onchain receipt.
 */
export function useOrvexTx(onConfirmed?: () => void) {
  const { address, isConnected } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const queryClient = useQueryClient()
  const [state, setState] = useState<TxState>({ phase: 'idle' })
  const busy = useRef(false)
  const onConfirmedRef = useRef(onConfirmed)
  const mounted = useRef(true)
  const txs = useTxs()

  useEffect(() => {
    onConfirmedRef.current = onConfirmed
  }, [onConfirmed])
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const safeSet = useCallback((next: TxState) => {
    if (mounted.current) setState(next)
  }, [])

  const refreshData = useCallback(
    async (blockNumber?: string) => {
      if (blockNumber) await waitForHead(() => readClient.getBlockNumber(), BigInt(blockNumber), sleep)
      await queryClient.invalidateQueries({ queryKey: ORVEX_KEY })
    },
    [queryClient],
  )

  // A transaction that stayed pending past the confirm window can still land; the history watcher then
  // records the receipt and this reflects it. Success is still only ever derived from a stored receipt result.
  useEffect(() => {
    if (state.phase !== 'pending' || !state.hash) return
    const record = txs.find((t) => t.hash === state.hash)
    if (record?.status === 'confirmed') {
      safeSet({ phase: 'confirmed', hash: state.hash, message: 'Confirmed onchain.' })
      void refreshData(record.blockNumber).then(() => onConfirmedRef.current?.())
    } else if (record?.status === 'failed') {
      safeSet({ phase: 'failed', hash: state.hash, message: 'The transaction was mined but reverted onchain.' })
    }
  }, [txs, state, safeSet, refreshData])

  const reset = useCallback(() => {
    if (!busy.current) setState({ phase: 'idle' })
  }, [])

  const run = useCallback(
    async (req: TxRequest): Promise<boolean> => {
      if (busy.current) return false
      if (!ACTIVE_ADDRESSES) {
        safeSet({ phase: 'failed', message: 'ORVEX contracts are not configured for this network.' })
        return false
      }
      if (!isConnected || !address) {
        safeSet({ phase: 'failed', message: 'Connect your wallet first.' })
        return false
      }
      const key = actionKey(address, req.contract, req.functionName, req.args)
      if (!acquireAction(key)) return false
      busy.current = true

      const target = ACTIVE_ADDRESSES[req.contract]
      try {
        const result = await executeTx({
          chainId: ACTIVE_CHAIN_ID,
          networkName: ACTIVE_NETWORK_NAME,
          address,
          target,
          getWallet: async () => {
            const client = await getWalletClient(config, { chainId: ACTIVE_CHAIN_ID }).catch(() => null)
            if (!client) return null
            return { chainId: await client.getChainId(), account: client.account?.address }
          },
          switchChain: async () => {
            await switchChainAsync({ chainId: ACTIVE_CHAIN_ID })
          },
          prepare: async () => {
            const health = await checkRpcHealth(readClient, ACTIVE_CHAIN_ID)
            if (health.status === 'mismatch') {
              throw new Error(`The Arc RPC reported chain ${health.actualChainId}, not ${ACTIVE_CHAIN_ID}. Transactions are blocked.`)
            }
            if (health.status === 'error') throw new Error('The Arc RPC is not responding, so the transaction cannot be checked. Try again shortly.')
            const client = await getWalletClient(config, { chainId: ACTIVE_CHAIN_ID })
            const { request } = await readClient.simulateContract({
              account: address,
              address: target,
              abi: ABI_BY_KEY[req.contract],
              functionName: req.functionName,
              args: req.args,
            })
            return { send: () => client.writeContract(request) }
          },
          waitForReceipt: async (hash, onReplaced) => {
            const r = await readClient.waitForTransactionReceipt({
              hash,
              timeout: RECEIPT_POLL_TIMEOUT_MS,
              onReplaced: (info) => onReplaced({ reason: info.reason, transactionHash: info.transaction.hash }),
            })
            return { status: r.status, blockNumber: r.blockNumber, transactionHash: r.transactionHash, to: r.to }
          },
          getReceipt: async (hash) => {
            try {
              const r = await readClient.getTransactionReceipt({ hash })
              return { status: r.status, blockNumber: r.blockNumber, transactionHash: r.transactionHash, to: r.to }
            } catch {
              return null
            }
          },
          getBlockNumber: () => readClient.getBlockNumber(),
          onState: safeSet,
          store: {
            add: (hash) => addTx({ hash, label: req.label, chainId: ACTIVE_CHAIN_ID, from: address, status: 'pending', createdAt: Date.now() }),
            update: (hash, patch) => updateTx(hash, patch),
          },
          describe: describeError,
          sleep,
          now: () => Date.now(),
          confirmWindowMs: CONFIRM_WINDOW_MS,
        })
        if (result.outcome === 'confirmed') {
          await refreshData(result.blockNumber?.toString())
          onConfirmedRef.current?.()
          return true
        }
        return false
      } finally {
        busy.current = false
        releaseAction(key)
      }
    },
    [address, isConnected, refreshData, safeSet, switchChainAsync],
  )

  const active =
    state.phase === 'switching' || state.phase === 'simulating' || state.phase === 'signing' || state.phase === 'pending'
  return { state, run, reset, active }
}
