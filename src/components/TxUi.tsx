import { CheckCircle2, CircleAlert, Wallet } from 'lucide-react'
import { ConnectKitButton } from 'connectkit'
import type { ReactNode } from 'react'
import { useNetwork } from '@/hooks/useNetwork'
import type { TxState } from '@/hooks/useOrvexTx'
import { contractsConfigured } from '@/hooks/queries'
import { cx, Spinner, TxLink } from './ui'

/** Honest inline transaction status: every state maps to something the wallet or RPC reported. */
export function TxPanel({ state }: { state: TxState }) {
  if (state.phase === 'idle') return null
  const tone =
    state.phase === 'confirmed'
      ? 'border-arc-400/30 bg-arc-400/10 text-arc-300'
      : state.phase === 'failed'
        ? 'border-flare-400/30 bg-flare-400/10 text-flare-400'
        : 'border-white/10 bg-white/[0.04] text-mist-300'
  const title =
    state.phase === 'switching'
      ? 'Switching network'
      : state.phase === 'simulating'
        ? 'Checking transaction'
        : state.phase === 'signing'
          ? 'Waiting for your wallet'
          : state.phase === 'pending'
            ? 'Pending'
            : state.phase === 'confirmed'
              ? 'Confirmed'
              : 'Failed'
  return (
    <div role="status" aria-live="polite" className={cx('mt-4 flex items-start gap-3 rounded-xl border p-3.5 text-sm', tone)}>
      <span className="mt-0.5">
        {state.phase === 'confirmed' ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : state.phase === 'failed' ? (
          <CircleAlert className="h-4 w-4" />
        ) : (
          <Spinner />
        )}
      </span>
      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        {state.message && <p className="mt-0.5 text-xs opacity-90">{state.message}</p>}
        {state.hash && <TxLink hash={state.hash} className="mt-1.5" />}
      </div>
    </div>
  )
}

interface TxButtonProps {
  children: ReactNode
  onClick: () => void
  busy?: boolean
  disabled?: boolean
  variant?: 'primary' | 'ghost' | 'danger'
  className?: string
  /** What to ask the user to connect for, e.g. "Connect to join". */
  connectLabel?: string
}

/** Submit button that guards wallet, network and configuration before any transaction. */
export function TxButton({ children, onClick, busy, disabled, variant = 'primary', className, connectLabel = 'Connect wallet' }: TxButtonProps) {
  const net = useNetwork()
  const base = variant === 'primary' ? 'btn-primary' : variant === 'danger' ? 'btn-danger' : 'btn-ghost'
  if (!contractsConfigured) {
    return (
      <button type="button" className={cx(base, className)} disabled>
        Contracts not configured
      </button>
    )
  }
  if (!net.isConnected) {
    return (
      <ConnectKitButton.Custom>
        {({ show }) => (
          <button type="button" className={cx(base, className)} onClick={show}>
            <Wallet className="h-4 w-4" /> {connectLabel}
          </button>
        )}
      </ConnectKitButton.Custom>
    )
  }
  if (net.state === 'wrong') {
    return (
      <button type="button" className={cx(base, className)} onClick={() => void net.switchToArc()} disabled={net.isSwitching}>
        {net.isSwitching ? <Spinner /> : null} Switch to {net.targetName}
      </button>
    )
  }
  return (
    <button type="button" className={cx(base, className)} onClick={onClick} disabled={disabled || busy} aria-busy={busy}>
      {busy && <Spinner />}
      {children}
    </button>
  )
}
