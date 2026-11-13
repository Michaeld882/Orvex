import { Award, FileCheck2, Flag, Plus, Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ConnectKitButton } from 'connectkit'
import { useAccount } from 'wagmi'
import { ChallengeCard } from '@/components/cards'
import { RequireContracts } from '@/components/NotConfigured'
import { Badge, EmptyState, PageHeader, Skeleton, StatCard } from '@/components/ui'
import { useActivity, useMyChallenges, usePlatformStats, useProfile } from '@/hooks/queries'
import { shortAddress } from '@/lib/format'
import { useState } from 'react'
import { ACHIEVEMENTS, LEVEL_THRESHOLDS, effectiveStatus, nextLevelAt } from '@/lib/types'
import { TxLink } from '@/components/ui'

function PlatformStrip() {
  const s = usePlatformStats()
  const items = [
    ['Challenges', s.data?.challenges],
    ['Projects', s.data?.projects],
    ['Ideas', s.data?.ideas],
    ['Proof records', s.data?.proofs],
    ['Contributors', s.data?.participants],
  ] as const
  return (
    <section aria-label="Platform statistics" className="surface grid grid-cols-2 gap-4 p-5 sm:grid-cols-5">
      {items.map(([label, v]) => (
        <div key={label}>
          <p className="label">{label}</p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums text-mist-100">{v === undefined ? (s.isError ? '–' : '…') : v.toLocaleString()}</p>
        </div>
      ))}
    </section>
  )
}

function Personal({ address }: { address: `0x${string}` }) {
  const profile = useProfile(address)
  const created = useMyChallenges(address, 'created')
  const joined = useMyChallenges(address, 'joined')
  const activity = useActivity(address)
  const [nowSec] = useState(() => Math.floor(Date.now() / 1000))

  if (profile.isLoading) return <Skeleton className="h-64" />
  const p = profile.data
  const points = p?.stats.points ?? 0
  const next = nextLevelAt(points)
  const level = p?.level ?? 1
  const base = LEVEL_THRESHOLDS[level - 1] ?? 0
  const pct = next ? Math.round(((points - base) / (next - base)) * 100) : 100
  const claimed = p ? ACHIEVEMENTS.filter((a) => ((p.achievementMask >> BigInt(a.id)) & 1n) === 1n).length : 0
  const active = [...(joined.data ?? []), ...(created.data ?? [])].filter((c) => effectiveStatus(c, nowSec) === 'Open').slice(0, 3)

  return (
    <>
      <section className="surface p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="label">Welcome back</p>
            <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-mist-100">{p?.profile.exists ? p.profile.displayName : shortAddress(address)}</h2>
          </div>
          <Badge tone="volt">Level {level}</Badge>
        </div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.06]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Level progress">
          <div className="h-full rounded-full bg-gradient-to-r from-volt-400 to-arc-400 transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-xs text-mist-500">{next ? `${points} points. ${next - points} more to reach level ${level + 1}.` : `${points} points. Top level reached.`}</p>
        {!p?.profile.exists && (
          <p className="mt-3 text-sm text-mist-400">
            You have no public profile yet.{' '}
            <Link to={`/app/profile/${address}`} className="text-volt-300 hover:underline">
              Create it
            </Link>
            .
          </p>
        )}
      </section>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Reputation" value={points} icon={<Star className="h-4 w-4" />} />
        <StatCard label="Completed" value={p?.stats.challengesCompleted ?? 0} hint="challenges" icon={<Flag className="h-4 w-4" />} />
        <StatCard label="Proof records" value={p?.proofCount ?? 0} icon={<FileCheck2 className="h-4 w-4" />} />
        <StatCard label="Achievements" value={`${claimed}/${ACHIEVEMENTS.length}`} icon={<Award className="h-4 w-4" />} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-mist-100">Your open challenges</h2>
            <Link to="/app/arena" className="text-sm text-volt-300 hover:underline">
              Browse all
            </Link>
          </div>
          {created.isLoading || joined.isLoading ? (
            <Skeleton className="h-40" />
          ) : active.length === 0 ? (
            <EmptyState
              title="Nothing in progress"
              body="Join a challenge or create one to get started."
              action={
                <Link to="/app/arena" className="btn-primary">
                  Find a challenge
                </Link>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {active.map((c) => (
                <ChallengeCard key={c.id.toString()} challenge={c} />
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-mist-100">Recent activity</h2>
            <Link to="/app/activity" className="text-sm text-volt-300 hover:underline">
              View all
            </Link>
          </div>
          <div className="surface divide-y divide-white/[0.06]">
            {activity.isLoading ? (
              <Skeleton className="h-40" />
            ) : activity.items.length === 0 ? (
              <p className="p-5 text-sm text-mist-500">No recent activity found yet.</p>
            ) : (
              activity.items.slice(0, 5).map((i) => (
                <div key={i.key} className="flex items-center justify-between gap-3 px-4 py-3">
                  <p className="min-w-0 truncate text-sm text-mist-300">{i.text}</p>
                  <TxLink hash={i.txHash} />
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </>
  )
}

function Content() {
  const { address } = useAccount()
  return (
    <div className="space-y-6">
      {address ? (
        <Personal address={address} />
      ) : (
        <section className="surface flex flex-col items-start gap-4 p-6 sm:p-8">
          <h2 className="font-display text-2xl font-bold tracking-tight text-mist-100">Connect to see your progress</h2>
          <p className="max-w-xl text-sm text-mist-400">Your reputation, proof records and achievements are read from Arc for your wallet address. Nothing is stored on a server.</p>
          <ConnectKitButton.Custom>
            {({ show }) => (
              <button type="button" className="btn-primary" onClick={show}>
                Connect wallet
              </button>
            )}
          </ConnectKitButton.Custom>
        </section>
      )}
      <PlatformStrip />
    </div>
  )
}

export default function Dashboard() {
  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title="Your command center"
        actions={
          <Link to="/app/arena/new" className="btn-primary">
            <Plus className="h-4 w-4" /> New challenge
          </Link>
        }
      />
      <RequireContracts>
        <Content />
      </RequireContracts>
    </>
  )
}
