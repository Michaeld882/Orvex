import { Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { ProjectCard } from '@/components/cards'
import { RequireContracts } from '@/components/NotConfigured'
import { CardSkeletons, EmptyState, ErrorState, PageHeader, Pagination, Tabs } from '@/components/ui'
import { useOwnedProjects, useProjectsPage } from '@/hooks/queries'
import { PROJECT_STAGES } from '@/lib/types'

const PAGE_SIZE = 12
type Scope = 'all' | 'mine'

function Content() {
  const { address } = useAccount()
  const [scope, setScope] = useState<Scope>('all')
  const [stage, setStage] = useState('all')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const all = useProjectsPage(page, PAGE_SIZE)
  const mine = useOwnedProjects(address)
  const active = scope === 'all' ? all : mine

  const items = useMemo(() => {
    const source = scope === 'all' ? (all.data?.items ?? []) : (mine.data ?? [])
    const q = query.trim().toLowerCase()
    return source.filter((p) => {
      if (stage !== 'all' && PROJECT_STAGES[p.stage] !== stage) return false
      return !q || `${p.name} ${p.tagline} ${p.category}`.toLowerCase().includes(q)
    })
  }, [scope, all.data, mine.data, stage, query])

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
            { id: 'all', label: 'All projects' },
            { id: 'mine', label: 'My projects' },
          ]}
        />
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-500" />
            <input className="input !pl-9 sm:w-60" placeholder="Search this page" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search projects" />
          </div>
          <select className="input sm:w-40" value={stage} onChange={(e) => setStage(e.target.value)} aria-label="Filter by stage">
            <option value="all">All stages</option>
            {PROJECT_STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {scope === 'mine' && !address ? (
        <EmptyState title="Connect your wallet" body="Connect to see projects you proposed." />
      ) : active.isLoading ? (
        <CardSkeletons count={6} />
      ) : active.isError ? (
        <ErrorState onRetry={() => void active.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No projects here yet"
          body="Propose an idea you want to build. Others can contribute, and you decide which contributions to accept."
          action={
            <Link to="/app/launchpad/new" className="btn-primary">
              <Plus className="h-4 w-4" /> Propose a project
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((p) => (
            <ProjectCard key={p.id.toString()} project={p} />
          ))}
        </div>
      )}
      {scope === 'all' && all.data && <Pagination page={page} pageCount={all.data.pageCount} onChange={setPage} />}
    </>
  )
}

export default function Launchpad() {
  return (
    <>
      <PageHeader
        eyebrow="ORVEX Launchpad"
        title="Community projects"
        description="Discover what the community is building, follow progress updates, and contribute your work."
        actions={
          <Link to="/app/launchpad/new" className="btn-primary">
            <Plus className="h-4 w-4" /> Propose project
          </Link>
        }
      />
      <RequireContracts>
        <Content />
      </RequireContracts>
    </>
  )
}
