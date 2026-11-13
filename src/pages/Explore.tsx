import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChallengeCard, ProjectCard } from '@/components/cards'
import { RequireContracts } from '@/components/NotConfigured'
import { Badge, CardSkeletons, EmptyState, ErrorState, PageHeader, ProfileLink, Tabs } from '@/components/ui'
import { useChallengesPage, useIdeasPage, useProjectsPage } from '@/hooks/queries'
import { timeAgo } from '@/lib/format'

type Kind = 'all' | 'challenges' | 'projects' | 'ideas'

function Section({ title, to, children }: { title: string; to: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold text-mist-100">{title}</h2>
        <Link to={to} className="text-sm text-volt-300 hover:underline">
          See all
        </Link>
      </div>
      {children}
    </section>
  )
}

function Content() {
  const [kind, setKind] = useState<Kind>('all')
  const [query, setQuery] = useState('')
  const challenges = useChallengesPage(0, 9)
  const projects = useProjectsPage(0, 9)
  const ideas = useIdeasPage(0, 9)
  const q = query.trim().toLowerCase()

  const c = useMemo(() => (challenges.data?.items ?? []).filter((x) => !q || `${x.title} ${x.skill} ${x.description}`.toLowerCase().includes(q)), [challenges.data, q])
  const p = useMemo(() => (projects.data?.items ?? []).filter((x) => !q || `${x.name} ${x.tagline} ${x.category}`.toLowerCase().includes(q)), [projects.data, q])
  const i = useMemo(() => (ideas.data?.items ?? []).filter((x) => !x.retracted && (!q || `${x.title} ${x.body} ${x.tag}`.toLowerCase().includes(q))), [ideas.data, q])

  const show = (k: Exclude<Kind, 'all'>) => kind === 'all' || kind === k
  const nothing = !challenges.isLoading && !projects.isLoading && !ideas.isLoading && c.length + p.length + i.length === 0

  return (
    <>
      <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          value={kind}
          onChange={setKind}
          options={[
            { id: 'all', label: 'Everything' },
            { id: 'challenges', label: 'Challenges' },
            { id: 'projects', label: 'Projects' },
            { id: 'ideas', label: 'Ideas' },
          ]}
        />
        <div className="relative lg:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-500" />
          <input className="input !pl-9" placeholder="Search the latest items" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search" />
        </div>
      </div>

      {nothing && <EmptyState title="Nothing found" body={q ? 'Try a different search term.' : 'No challenges, projects or ideas have been created yet.'} />}

      {show('challenges') && (c.length > 0 || challenges.isLoading || challenges.isError) && (
        <Section title="Latest challenges" to="/app/arena">
          {challenges.isLoading ? <CardSkeletons count={3} /> : challenges.isError ? <ErrorState onRetry={() => void challenges.refetch()} /> : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {c.map((x) => (
                <ChallengeCard key={x.id.toString()} challenge={x} />
              ))}
            </div>
          )}
        </Section>
      )}

      {show('projects') && (p.length > 0 || projects.isLoading || projects.isError) && (
        <Section title="Community projects" to="/app/launchpad">
          {projects.isLoading ? <CardSkeletons count={3} /> : projects.isError ? <ErrorState onRetry={() => void projects.refetch()} /> : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {p.map((x) => (
                <ProjectCard key={x.id.toString()} project={x} />
              ))}
            </div>
          )}
        </Section>
      )}

      {show('ideas') && (i.length > 0 || ideas.isLoading || ideas.isError) && (
        <Section title="Fresh ideas" to="/app/board">
          {ideas.isLoading ? <CardSkeletons count={3} className="h-32" /> : ideas.isError ? <ErrorState onRetry={() => void ideas.refetch()} /> : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {i.map((x) => (
                <article key={x.id.toString()} className="surface flex flex-col gap-2 p-5 transition hover:-translate-y-0.5 hover:border-volt-400/30">
                  <div className="flex items-center justify-between">
                    <Badge tone="ion">{x.tag}</Badge>
                    <span className="text-xs text-mist-500">{x.endorsements} endorsements</span>
                  </div>
                  <h3 className="line-clamp-1 font-display font-semibold text-mist-100">
                    <Link to="/app/board" className="hover:text-volt-300">
                      {x.title}
                    </Link>
                  </h3>
                  <p className="line-clamp-2 text-sm text-mist-400">{x.body}</p>
                  <div className="mt-1 flex items-center justify-between text-xs text-mist-500">
                    <ProfileLink address={x.author} />
                    <span>{timeAgo(x.createdAt)}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Section>
      )}
    </>
  )
}

export default function Explore() {
  return (
    <>
      <PageHeader eyebrow="Explore" title="Discover what is happening" description="The newest challenges, projects and ideas from across the community." />
      <RequireContracts>
        <Content />
      </RequireContracts>
    </>
  )
}
