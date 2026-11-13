import { useCallback, useEffect, useState } from 'react'
import { useAccount, useSwitchChain } from 'wagmi'
import { ACTIVE_CHAIN_ID, ACTIVE_NETWORK_NAME } from '@/lib/active'
import { describeError } from '@/lib/errors'

export type WalletNetworkState = 'disconnected' | 'correct' | 'wrong'

export function useNetwork() {
  const { isConnected, chainId, address, status } = useAccount()
  const { switchChainAsync, isPending } = useSwitchChain()
  const [error, setError] = useState<string | null>(null)

  const state: WalletNetworkState = !isConnected ? 'disconnected' : chainId === ACTIVE_CHAIN_ID ? 'correct' : 'wrong'

  const switchToArc = useCallback(async () => {
    setError(null)
    try {
      await switchChainAsync({ chainId: ACTIVE_CHAIN_ID })
      return true
    } catch (e) {
      const d = describeError(e)
      if (d.kind !== 'rejected') setError(d.message)
      return false
    }
  }, [switchChainAsync])

  return {
    address,
    isConnected,
    isConnecting: status === 'connecting' || status === 'reconnecting',
    walletChainId: chainId,
    state,
    targetName: ACTIVE_NETWORK_NAME,
    targetChainId: ACTIVE_CHAIN_ID,
    switchToArc,
    isSwitching: isPending,
    error,
  }
}

/** Tracks browser connectivity so the UI can say so instead of showing silent failures. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])
  return online
}
