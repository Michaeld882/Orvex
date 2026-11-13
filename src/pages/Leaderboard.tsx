import { Trophy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { RequireContracts } from '@/components/NotConfigured'
import { Badge, EmptyState, ErrorState, PageHeader, Pagination, Skeleton } from '@/components/ui'
import { useLeaderboard } from '@/hooks/queries'
import { shortAddress } from '@/lib/format'
import { levelFor } from '@/lib/types'

const PAGE_SIZE = 20

function Board() {
  const { address } = useAccount()
  const q = useLeaderboard()
  const [page, setPage] = useState(0)
  const rows = useMemo(() => q.data?.rows ?? [], [q.data])
  const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  if (q.isLoading) return <Skeleton className="h-96" />
  if (q.isError) return <ErrorState onRetry={() => void q.refetch()} />
  if (rows.length === 0) return <EmptyState title="No contributors yet" body="Rankings appear once people join challenges and projects." />

  return (
    <>
      <div className="surface overflow-hidden">
        <div className="hidden grid-cols-[56px_1fr_90px_110px_110px] gap-3 border-b border-white/[0.06] px-5 py-3 text-[11px] font-medium uppercase tracking-[0.09em] text-mist-500 sm:grid">
          <span>Rank</span>
          <span>Contributor</span>
          <span className="text-right">Points</span>
          <span className="text-right">Completed</span>
          <span className="text-right">Accepted</span>
        </div>
        <ol>
          {pageRows.map((r, i) => {
            const rank = page * PAGE_SIZE + i + 1
            const mine = !!address && address.toLowerCase() === r.user.toLowerCase()
            return (
              <li key={r.user} className={mine ? 'bg-volt-400/[0.06]' : undefined}>
                <Link
                  to={`/app/profile/${r.user}`}
                  className="grid grid-cols-[40px_1fr_auto] items-center gap-3 border-b border-white/[0.04] px-4 py-3.5 transition hover:bg-white/[0.03] sm:grid-cols-[56px_1fr_90px_110px_110px] sm:px-5"
                >
                  <span className={`font-display text-lg font-bold tabular-nums ${rank <= 3 ? 'text-volt-300' : 'text-mist-500'}`}>{rank}</span>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-mono text-sm text-mist-100">{shortAddress(r.user, 8, 6)}</span>
                    <Badge tone="neutral">L{levelFor(r.stats.points)}</Badge>
                    {mine && <Badge tone="volt">You</Badge>}
                  </span>
                  <span className="text-right font-display text-lg font-bold tabular-nums text-mist-100">{r.stats.points}</span>
                  <span className="hidden text-right tabular-nums text-mist-300 sm:block">{r.stats.challengesCompleted}</span>
                  <span className="hidden text-right tabular-nums text-mist-300 sm:block">{r.stats.contributionsAccepted}</span>
                </Link>
              </li>
            )
          })}
        </ol>
      </div>
      <Pagination page={page} pageCount={Math.max(1, Math.ceil(rows.length / PAGE_SIZE))} onChange={setPage} />
      {q.data?.truncated && (
        <p className="mt-4 text-center text-xs text-mist-500">
          Ranking the first {rows.length.toLocaleString()} of {q.data.totalParticipants.toLocaleString()} contributors.
        </p>
      )}
    </>
  )
}

export default function Leaderboard() {
  return (
    <>
      <PageHeader
        eyebrow="Community"
        title="Leaderboard"
        description="Ranked by reputation points, which come only from work approved by someone else."
        actions={
          <span className="inline-flex items-center gap-2 text-sm text-mist-400">
            <Trophy className="h-4 w-4 text-volt-400" /> Completed challenge +20, accepted contribution +15
          </span>
        }
      />
      <RequireContracts>
        <Board />
      </RequireContracts>
    </>
  )
}
