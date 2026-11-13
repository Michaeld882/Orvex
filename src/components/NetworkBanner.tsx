import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, FlaskConical, WifiOff } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNetwork, useOnline } from '@/hooks/useNetwork'
import { ACTIVE_CHAIN_ID, IS_MAINNET, readClient } from '@/lib/active'
import { checkRpcHealth } from '@/lib/rpc'
import { Spinner, cx } from './ui'

export interface RpcHealth {
  status: 'loading' | 'ok' | 'error' | 'mismatch'
  block?: bigint
  refetch: () => void
}

/** Checks the RPC answers and reports the expected chain id before any contract interaction. */
export function useRpcHealth(): RpcHealth {
  const q = useQuery({
    queryKey: ['rpc-health', ACTIVE_CHAIN_ID],
    queryFn: () => checkRpcHealth(readClient, ACTIVE_CHAIN_ID),
    refetchInterval: 20_000,
    refetchOnWindowFocus: false,
    retry: 0,
  })
  const refetch = () => void q.refetch()
  if (q.data?.status === 'ok') return { status: 'ok', block: q.data.block, refetch }
  if (q.data?.status === 'mismatch') return { status: 'mismatch', refetch }
  if (q.data?.status === 'error' || q.isError) return { status: 'error', refetch }
  return { status: 'loading', refetch }
}

function Banner({ tone, icon, children, action }: { tone: 'ember' | 'flare' | 'ion'; icon: ReactNode; children: ReactNode; action?: ReactNode }) {
  const styles = {
    ember: 'border-ember-400/30 bg-ember-400/10 text-ember-400',
    flare: 'border-flare-400/30 bg-flare-400/10 text-flare-400',
    ion: 'border-ion-400/30 bg-ion-400/10 text-ion-400',
  }
  return (
    <div role="status" className={cx('flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm', styles[tone])}>
      <span className="shrink-0">{icon}</span>
      <p className="min-w-0 flex-1 text-mist-100">{children}</p>
      {action}
    </div>
  )
}

export function NetworkBanners({ rpc }: { rpc: RpcHealth }) {
  const online = useOnline()
  const net = useNetwork()
  return (
    <div className="space-y-3">
      {!online && (
        <Banner tone="flare" icon={<WifiOff className="h-4 w-4" />}>
          You are offline. Data will refresh when your connection returns.
        </Banner>
      )}
      {online && rpc.status === 'error' && (
        <Banner
          tone="flare"
          icon={<AlertTriangle className="h-4 w-4" />}
          action={
            <button type="button" className="btn-ghost !min-h-[36px] !px-3 text-xs" onClick={rpc.refetch}>
              Retry
            </button>
          }
        >
          The Arc RPC is not responding. Showing the last data we had.
        </Banner>
      )}
      {rpc.status === 'mismatch' && (
        <Banner tone="flare" icon={<AlertTriangle className="h-4 w-4" />}>
          The RPC answered with an unexpected chain id. Interactions are paused for your safety.
        </Banner>
      )}
      {net.state === 'wrong' && (
        <Banner
          tone="ember"
          icon={<AlertTriangle className="h-4 w-4" />}
          action={
            <button type="button" className="btn-primary !min-h-[36px] !px-3 text-xs" onClick={() => void net.switchToArc()} disabled={net.isSwitching}>
              {net.isSwitching && <Spinner />} Switch to {net.targetName}
            </button>
          }
        >
          Your wallet is on chain {net.walletChainId}. ORVEX runs on {net.targetName} (chain {net.targetChainId}).
        </Banner>
      )}
      {net.error && (
        <Banner tone="flare" icon={<AlertTriangle className="h-4 w-4" />}>
          {net.error}
        </Banner>
      )}
      {!IS_MAINNET && (
        <Banner tone="ion" icon={<FlaskConical className="h-4 w-4" />}>
          Testnet mode is on. Nothing you see here is on Arc Mainnet.
        </Banner>
      )}
    </div>
  )
}

export function RpcChip({ rpc }: { rpc: RpcHealth }) {
  const dot = rpc.status === 'ok' ? 'bg-arc-400' : rpc.status === 'loading' ? 'bg-mist-500' : 'bg-flare-400'
  return (
    <div className="hidden items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-xs text-mist-300 sm:flex">
      <span className={cx('h-2 w-2 rounded-full', dot)} aria-hidden="true" />
      <span>{IS_MAINNET ? 'Arc Mainnet' : 'Arc Testnet'}</span>
      {rpc.block !== undefined && <span className="font-mono tabular-nums text-mist-500">#{rpc.block.toString()}</span>}
    </div>
  )
}
