/**
 * Logic tests for the transaction lifecycle. The wallet and RPC are replaced by scripted fakes so every
 * failure branch can be forced. These tests prove the state machine never reports success without a
 * successful receipt; they say nothing about the chain itself (that is covered by the live testnet runs).
 */
import { describe, expect, it } from 'vitest'
import { UserRejectedRequestError } from 'viem'
import { describeError } from './errors'
import {
  acquireAction,
  actionKey,
  executeTx,
  releaseAction,
  type ReceiptLike,
  type Replacement,
  type TxDeps,
  type TxState,
} from './txRunner'

const ME = '0x1111111111111111111111111111111111111111' as const
const TARGET = '0x2222222222222222222222222222222222222222' as const
const HASH = `0x${'ab'.repeat(32)}` as const

function receipt(over: Partial<ReceiptLike> = {}): ReceiptLike {
  return { status: 'success', blockNumber: 100n, transactionHash: HASH, to: TARGET, ...over }
}

function harness(over: Partial<TxDeps> = {}) {
  const states: TxState[] = []
  const store: { adds: string[]; updates: { hash: string; status: string }[] } = { adds: [], updates: [] }
  let clock = 0
  let sent = 0
  const deps: TxDeps = {
    chainId: 5042002,
    networkName: 'Arc Testnet',
    address: ME,
    target: TARGET,
    getWallet: async () => ({ chainId: 5042002, account: ME }),
    switchChain: async () => undefined,
    prepare: async () => ({
      send: async () => {
        sent++
        return HASH
      },
    }),
    waitForReceipt: async () => receipt(),
    getReceipt: async () => null,
    getBlockNumber: async () => 100n,
    onState: (s) => states.push(s),
    store: {
      add: (h) => store.adds.push(h),
      update: (h, p) => store.updates.push({ hash: h, status: p.status }),
    },
    describe: describeError,
    sleep: async (ms) => {
      clock += ms
    },
    now: () => clock,
    confirmWindowMs: 60_000,
    ...over,
  }
  return { deps, states, store, sentCount: () => sent }
}

const phases = (states: TxState[]) => states.map((s) => s.phase)
const lastPhase = (states: TxState[]) => states[states.length - 1]?.phase

describe('executeTx success', () => {
  it('confirms only after a successful receipt and goes through every phase in order', async () => {
    const h = harness()
    const r = await executeTx(h.deps)
    expect(r.outcome).toBe('confirmed')
    expect(r.blockNumber).toBe(100n)
    expect(phases(h.states)).toEqual(['simulating', 'signing', 'pending', 'confirmed'])
    expect(h.store.adds).toEqual([HASH])
    expect(h.store.updates).toEqual([{ hash: HASH, status: 'confirmed' }])
  })

  it('switches network first when the wallet is on another chain', async () => {
    let chain = 1
    const h = harness({
      getWallet: async () => ({ chainId: chain, account: ME }),
      switchChain: async () => {
        chain = 5042002
      },
    })
    const r = await executeTx(h.deps)
    expect(r.outcome).toBe('confirmed')
    expect(phases(h.states)[0]).toBe('switching')
  })

  it('treats a repriced (sped up) replacement as the same transaction', async () => {
    const h = harness({
      waitForReceipt: async (_hash, onReplaced) => {
        onReplaced({ reason: 'repriced', transactionHash: `0x${'cd'.repeat(32)}` } satisfies Replacement)
        return receipt({ transactionHash: `0x${'cd'.repeat(32)}` })
      },
    })
    expect((await executeTx(h.deps)).outcome).toBe('confirmed')
  })
})

describe('executeTx never reports false success', () => {
  it('reports failure for a reverted receipt', async () => {
    const h = harness({ waitForReceipt: async () => receipt({ status: 'reverted' }) })
    const r = await executeTx(h.deps)
    expect(r.outcome).toBe('failed')
    expect(phases(h.states)).not.toContain('confirmed')
    expect(h.store.updates).toEqual([{ hash: HASH, status: 'failed' }])
  })

  it('reports failure when the transaction was cancelled by the wallet', async () => {
    const h = harness({
      waitForReceipt: async (_hash, onReplaced) => {
        onReplaced({ reason: 'cancelled', transactionHash: `0x${'ee'.repeat(32)}` })
        return receipt({ transactionHash: `0x${'ee'.repeat(32)}` })
      },
    })
    expect((await executeTx(h.deps)).outcome).toBe('failed')
  })

  it('reports failure when replaced by a different transaction', async () => {
    const h = harness({
      waitForReceipt: async (_hash, onReplaced) => {
        onReplaced({ reason: 'replaced', transactionHash: `0x${'ee'.repeat(32)}` })
        return receipt()
      },
    })
    expect((await executeTx(h.deps)).outcome).toBe('failed')
  })

  it('reports failure when the receipt targets a different contract', async () => {
    const h = harness({ waitForReceipt: async () => receipt({ to: '0x3333333333333333333333333333333333333333' }) })
    expect((await executeTx(h.deps)).outcome).toBe('failed')
  })

  it('stays pending, never confirmed or failed, when no receipt arrives in the window', async () => {
    const h = harness({
      waitForReceipt: async () => {
        throw new Error('timed out')
      },
    })
    const r = await executeTx(h.deps)
    expect(r.outcome).toBe('pending')
    expect(r.hash).toBe(HASH)
    expect(lastPhase(h.states)).toBe('pending')
    expect(phases(h.states)).not.toContain('confirmed')
    expect(phases(h.states)).not.toContain('failed')
    expect(h.store.updates).toEqual([])
  })

  it('keeps trying through RPC errors and confirms once a receipt appears', async () => {
    let calls = 0
    const h = harness({
      waitForReceipt: async () => {
        calls++
        if (calls < 3) throw new Error('rpc down')
        return receipt()
      },
    })
    expect((await executeTx(h.deps)).outcome).toBe('confirmed')
    expect(calls).toBe(3)
  })

  it('finds the receipt through getReceipt when waiting times out', async () => {
    const h = harness({
      waitForReceipt: async () => {
        throw new Error('timeout')
      },
      getReceipt: async () => receipt(),
    })
    expect((await executeTx(h.deps)).outcome).toBe('confirmed')
  })
})

describe('executeTx before submission', () => {
  it('treats a wallet rejection as cancelled, not failed, and records nothing', async () => {
    const h = harness({
      prepare: async () => ({
        send: async () => {
          throw new UserRejectedRequestError(new Error('no'))
        },
      }),
    })
    const r = await executeTx(h.deps)
    expect(r.outcome).toBe('rejected')
    expect(lastPhase(h.states)).toBe('idle')
    expect(h.store.adds).toEqual([])
  })

  it('treats a plain EIP-1193 4001 object as a rejection', async () => {
    const h = harness({
      prepare: async () => ({
        send: async () => {
          throw Object.assign(new Error('rejected'), { code: 4001 })
        },
      }),
    })
    expect((await executeTx(h.deps)).outcome).toBe('rejected')
  })

  it('fails with the decoded message when simulation reverts, and never asks the wallet to sign', async () => {
    const h = harness({
      prepare: async () => {
        throw new Error('simulation reverted')
      },
    })
    const r = await executeTx(h.deps)
    expect(r.outcome).toBe('failed')
    expect(phases(h.states)).not.toContain('signing')
    expect(h.sentCount()).toBe(0)
    expect(h.store.adds).toEqual([])
  })

  it('fails when the wallet will not move to the right network', async () => {
    const h = harness({ getWallet: async () => ({ chainId: 1, account: ME }) })
    const r = await executeTx(h.deps)
    expect(r.outcome).toBe('failed')
    expect(h.sentCount()).toBe(0)
  })

  it('treats a rejected network switch as cancelled', async () => {
    const h = harness({
      getWallet: async () => ({ chainId: 1, account: ME }),
      switchChain: async () => {
        throw new UserRejectedRequestError(new Error('no'))
      },
    })
    expect((await executeTx(h.deps)).outcome).toBe('rejected')
  })

  it('fails if the signing account differs from the connected one', async () => {
    const h = harness({ getWallet: async () => ({ chainId: 5042002, account: '0x9999999999999999999999999999999999999999' }) })
    const r = await executeTx(h.deps)
    expect(r.outcome).toBe('failed')
    expect(h.sentCount()).toBe(0)
  })
})

describe('duplicate action guard', () => {
  it('blocks the same action while one is in flight and allows it again after release', () => {
    const key = actionKey(ME, 'ideas', 'endorse', [1n])
    expect(acquireAction(key)).toBe(true)
    expect(acquireAction(key)).toBe(false)
    releaseAction(key)
    expect(acquireAction(key)).toBe(true)
    releaseAction(key)
  })

  it('distinguishes different arguments, accounts and bigint values', () => {
    expect(actionKey(ME, 'ideas', 'endorse', [1n])).not.toBe(actionKey(ME, 'ideas', 'endorse', [2n]))
    expect(actionKey(ME, 'ideas', 'endorse', [1n])).not.toBe(actionKey('0x3333333333333333333333333333333333333333', 'ideas', 'endorse', [1n]))
    expect(actionKey(ME.toUpperCase(), 'a', 'b', [])).toBe(actionKey(ME, 'a', 'b', []))
  })
})
