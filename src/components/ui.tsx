import { AlertTriangle, ChevronLeft, ChevronRight, ExternalLink, Inbox, Loader2, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { addressUrl, txUrl } from '@/lib/active'
import { shortAddress, shortHash } from '@/lib/format'

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="label mb-2 text-volt-400">{eyebrow}</p>}
        <h1 className="font-display text-3xl font-bold tracking-[-0.03em] text-mist-100 sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-mist-400 sm:text-base">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

type Tone = 'neutral' | 'volt' | 'arc' | 'ion' | 'ember' | 'flare'
const TONES: Record<Tone, string> = {
  neutral: 'border-white/10 bg-white/[0.04] text-mist-300',
  volt: 'border-volt-400/30 bg-volt-400/10 text-volt-300',
  arc: 'border-arc-400/30 bg-arc-400/10 text-arc-300',
  ion: 'border-ion-400/30 bg-ion-400/10 text-ion-400',
  ember: 'border-ember-400/30 bg-ember-400/10 text-ember-400',
  flare: 'border-flare-400/30 bg-flare-400/10 text-flare-400',
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide', TONES[tone])}>
      {children}
    </span>
  )
}

export function StatCard({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: string; icon?: ReactNode }) {
  return (
    <div className="surface p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <p className="label">{label}</p>
        {icon && <span className="text-mist-500">{icon}</span>}
      </div>
      <p className="mt-3 font-display text-3xl font-bold tabular-nums tracking-tight text-mist-100">{value}</p>
      {hint && <p className="mt-1 text-xs text-mist-500">{hint}</p>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cx('relative overflow-hidden rounded-xl bg-white/[0.05]', className)}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
    </div>
  )
}

export function CardSkeletons({ count = 3, className = 'h-40' }: { count?: number; className?: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className={className} />
      ))}
    </div>
  )
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx('h-4 w-4 animate-spin', className)} aria-hidden="true" />
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="surface flex flex-col items-center px-6 py-14 text-center">
      <span className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-mist-400">
        <Inbox className="h-6 w-6" />
      </span>
      <h3 className="font-display text-lg font-semibold text-mist-100">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-mist-400">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="surface flex flex-col items-center px-6 py-12 text-center">
      <span className="mb-4 rounded-2xl border border-flare-400/30 bg-flare-400/10 p-3 text-flare-400">
        <AlertTriangle className="h-6 w-6" />
      </span>
      <h3 className="font-display text-lg font-semibold text-mist-100">Could not load this data</h3>
      <p className="mt-1 max-w-sm text-sm text-mist-400">{message ?? 'The Arc RPC did not answer. Check your connection and try again.'}</p>
      {onRetry && (
        <button type="button" className="btn-ghost mt-5" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" /> Try again
        </button>
      )}
    </div>
  )
}

export function Pagination({ page, pageCount, onChange }: { page: number; pageCount: number; onChange: (page: number) => void }) {
  if (pageCount <= 1) return null
  return (
    <nav className="mt-6 flex items-center justify-center gap-3" aria-label="Pagination">
      <button type="button" className="btn-ghost !min-h-[40px] !px-3" disabled={page === 0} onClick={() => onChange(page - 1)} aria-label="Newer page">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-sm tabular-nums text-mist-400">
        Page {page + 1} of {pageCount}
      </span>
      <button
        type="button"
        className="btn-ghost !min-h-[40px] !px-3"
        disabled={page >= pageCount - 1}
        onClick={() => onChange(page + 1)}
        aria-label="Older page"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  )
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-mist-300">{label}</span>
      {children}
      {error ? (
        <span role="alert" className="mt-1.5 block text-xs text-flare-400">
          {error}
        </span>
      ) : (
        hint && <span className="mt-1.5 block text-xs text-mist-500">{hint}</span>
      )}
    </label>
  )
}

export function AddressLink({ address, className }: { address: string; className?: string }) {
  return (
    <a
      href={addressUrl(address)}
      target="_blank"
      rel="noopener noreferrer"
      className={cx('inline-flex items-center gap-1 font-mono text-xs text-mist-300 hover:text-volt-300', className)}
      title={address}
    >
      {shortAddress(address)}
    </a>
  )
}

export function ProfileLink({ address, className }: { address: string; className?: string }) {
  return (
    <Link to={`/app/profile/${address}`} className={cx('font-mono text-xs text-mist-300 hover:text-volt-300', className)} title={address}>
      {shortAddress(address)}
    </Link>
  )
}

export function TxLink({ hash, className }: { hash: string; className?: string }) {
  return (
    <a
      href={txUrl(hash)}
      target="_blank"
      rel="noopener noreferrer"
      className={cx('inline-flex items-center gap-1 font-mono text-xs text-ion-400 hover:text-volt-300', className)}
    >
      {shortHash(hash)} <ExternalLink className="h-3 w-3" />
    </a>
  )
}

export function Tabs<T extends string>({ value, options, onChange }: { value: T; options: readonly { id: T; label: string }[]; onChange: (id: T) => void }) {
  return (
    <div role="tablist" className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-white/[0.07] bg-ink-900 p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          className={cx(
            'min-h-[40px] whitespace-nowrap rounded-lg px-4 text-sm font-medium transition',
            value === o.id ? 'bg-white/[0.09] text-mist-100' : 'text-mist-400 hover:text-mist-100',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
