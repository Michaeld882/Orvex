import { useEffect } from 'react'
import { ACTIVE_CHAIN_ID, readClient } from '@/lib/active'
import { getTxs, updateTx, useTxs } from '@/lib/txStore'

/** Re-checks locally stored pending transactions against the RPC (e.g. after a page reload). */
export function useTxWatcher(): void {
  const txs = useTxs()
  // Only transactions on the network this app is reading can be checked; others stay as recorded.
  const pendingKey = txs
    .filter((t) => t.status === 'pending' && t.chainId === ACTIVE_CHAIN_ID)
    .map((t) => t.hash)
    .join(',')

  useEffect(() => {
    if (!pendingKey) return
    let cancelled = false
    const check = async () => {
      for (const tx of getTxs().filter((t) => t.status === 'pending' && t.chainId === ACTIVE_CHAIN_ID)) {
        try {
          const receipt = await readClient.getTransactionReceipt({ hash: tx.hash })
          if (cancelled) return
          updateTx(tx.hash, {
            status: receipt.status === 'success' ? 'confirmed' : 'failed',
            blockNumber: receipt.blockNumber.toString(),
            error: receipt.status === 'success' ? undefined : 'Reverted onchain',
          })
        } catch {
          // not mined yet, or RPC unavailable: keep pending and try again
        }
      }
    }
    void check()
    const timer = window.setInterval(() => void check(), 8_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [pendingKey])
}
