import { Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { ChallengeCard } from '@/components/cards'
import { RequireContracts } from '@/components/NotConfigured'
import { CardSkeletons, EmptyState, ErrorState, PageHeader, Pagination, Tabs } from '@/components/ui'
import { useChallengesPage, useMyChallenges } from '@/hooks/queries'
import { effectiveStatus, type Challenge } from '@/lib/types'

const PAGE_SIZE = 12
type Scope = 'all' | 'created' | 'joined'
type StatusFilter = 'All' | 'Open' | 'Closed' | 'Expired' | 'Cancelled'

function applyFilters(items: readonly Challenge[], status: StatusFilter, query: string): Challenge[] {
  const q = query.trim().toLowerCase()
  return items.filter((c) => {
    if (status !== 'All' && effectiveStatus(c) !== status) return false
    if (!q) return true
    return `${c.title} ${c.skill} ${c.description}`.toLowerCase().includes(q)
  })
}

function Content() {
  const { address } = useAccount()
  const [scope, setScope] = useState<Scope>('all')
  const [status, setStatus] = useState<StatusFilter>('All')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)

  const all = useChallengesPage(page, PAGE_SIZE)
  const mine = useMyChallenges(address, scope === 'joined' ? 'joined' : 'created')

  const active = scope === 'all' ? all : mine
  const items = useMemo(() => {
    const source = scope === 'all' ? (all.data?.items ?? []) : (mine.data ?? [])
    return applyFilters(source, status, query)
  }, [scope, all.data, mine.data, status, query])

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          value={scope}
          onChange={(s) => {
            setScope(s)
            setPage(0)
          }}
          options={[
            { id: 'all', label: 'All challenges' },
            { id: 'created', label: 'Created by me' },
            { id: 'joined', label: 'Joined by me' },
          ]}
        />
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-500" />
            <input className="input !pl-9 sm:w-60" placeholder="Search this page" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search challenges" />
          </div>
          <select className="input sm:w-40" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} aria-label="Filter by status">
            {(['All', 'Open', 'Closed', 'Expired', 'Cancelled'] as const).map((s) => (
              <option key={s} value={s}>
                {s === 'All' ? 'All statuses' : s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {scope !== 'all' && !address ? (
        <EmptyState title="Connect your wallet" body="Connect to see the challenges you created or joined." />
      ) : active.isLoading ? (
        <CardSkeletons count={6} />
      ) : active.isError ? (
        <ErrorState onRetry={() => void active.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          title={scope === 'all' && !query && status === 'All' ? 'No challenges yet' : 'Nothing matches'}
          body={scope === 'all' && !query && status === 'All' ? 'Be the first to open a challenge for the community.' : 'Try a different filter or search term.'}
          action={
            <Link to="/app/arena/new" className="btn-primary">
              <Plus className="h-4 w-4" /> Create challenge
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((c) => (
            <ChallengeCard key={c.id.toString()} challenge={c} />
          ))}
        </div>
      )}
      {scope === 'all' && all.data && <Pagination page={page} pageCount={all.data.pageCount} onChange={setPage} />}
    </>
  )
}

export default function ChallengeArena() {
  return (
    <>
      <PageHeader
        eyebrow="Challenge Arena"
        title="Take on a challenge"
        description="Join a challenge, submit your work, and earn verifiable proof when the creator approves it."
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
