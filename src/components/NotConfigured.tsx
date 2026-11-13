import { Link } from 'react-router-dom'
import { FileCode2 } from 'lucide-react'
import { ACTIVE_DEPLOYMENT, ACTIVE_NETWORK_NAME } from '@/lib/active'
import { contractsConfigured } from '@/hooks/queries'
import type { ReactNode } from 'react'

/** Shown in place of live data until the ORVEX contract addresses are configured. */
export function NotConfigured() {
  return (
    <div className="surface mx-auto max-w-2xl p-6 sm:p-8">
      <span className="mb-4 inline-flex rounded-2xl border border-ember-400/30 bg-ember-400/10 p-3 text-ember-400">
        <FileCode2 className="h-6 w-6" />
      </span>
      <h2 className="font-display text-2xl font-bold tracking-tight text-mist-100">Contracts are not configured</h2>
      <p className="mt-2 text-sm text-mist-400">
        ORVEX reads everything from its smart contracts on {ACTIVE_NETWORK_NAME}. No contract addresses are set for this build, so the app
        shows no data rather than inventing any. Deploy the contracts from your own wallet, then add the addresses to your environment.
      </p>
      <div className="surface-inner mt-5 p-4">
        <p className="label mb-2">Missing environment variables</p>
        <ul className="space-y-1 font-mono text-xs text-mist-300">
          {ACTIVE_DEPLOYMENT.missing.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-mist-500">Optional: set the matching _START_BLOCK to the block of deployment to speed up activity history.</p>
      </div>
      <p className="mt-5 text-sm text-mist-400">
        Step by step instructions are in <span className="font-mono text-mist-300">docs/DEPLOYMENT.md</span>. You can still read how ORVEX works on the{' '}
        <Link to="/" className="text-volt-300 underline-offset-4 hover:underline">
          landing page
        </Link>
        .
      </p>
    </div>
  )
}

/** Renders children only when the contracts are configured; otherwise the setup card. */
export function RequireContracts({ children }: { children: ReactNode }) {
  return contractsConfigured ? <>{children}</> : <NotConfigured />
}
