import { ArrowLeft, ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { StageBadge } from '@/components/cards'
import { RequireContracts } from '@/components/NotConfigured'
import { ContributionQueue, StageAndUpdate } from '@/components/project/OwnerTools'
import { TxButton, TxPanel } from '@/components/TxUi'
import { Badge, EmptyState, ErrorState, Field, Pagination, ProfileLink, Skeleton } from '@/components/ui'
import { isNotFound } from '@/lib/errors'
import { REVIEW_PAGE_SIZE } from '@/services/reads'
import { useProject, useProjectContributions, useProjectUpdates } from '@/hooks/queries'
import { useOrvexTx } from '@/hooks/useOrvexTx'
import { formatDate, plural, safeHref, timeAgo } from '@/lib/format'
import { PROJECT_STAGES } from '@/lib/types'
import { hasErrors, LIMITS, validateContribution } from '@/lib/validation'

function parseId(raw: string | undefined): bigint | null {
  return raw && /^\d{1,18}$/.test(raw) && raw !== '0' ? BigInt(raw) : null
}

function ContributeForm({ projectId, disabled }: { projectId: bigint; disabled: boolean }) {
  const [form, setForm] = useState({ title: '', uri: '' })
  const [touched, setTouched] = useState(false)
  const { state, run, active, reset } = useOrvexTx(() => setForm({ title: '', uri: '' }))
  const errors = validateContribution(form)
  const submit = () => {
    setTouched(true)
    if (hasErrors(errors)) return
    void run({
      label: `Contribute to project #${projectId}`,
      contract: 'launchpad',
      functionName: 'submitContribution',
      args: [projectId, form.title.trim(), form.uri.trim()],
    })
  }
  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <Field label="What did you contribute?" error={touched ? errors.title : undefined}>
        <input className="input" value={form.title} maxLength={LIMITS.contribution.title[1]} onChange={(e) => (reset(), setForm((f) => ({ ...f, title: e.target.value })))} />
      </Field>
      <Field label="Link to the work" error={touched ? errors.uri : undefined} hint="https:// or ipfs://">
        <input className="input" placeholder="https://" value={form.uri} maxLength={LIMITS.contribution.uri[1]} onChange={(e) => (reset(), setForm((f) => ({ ...f, uri: e.target.value })))} />
      </Field>
      <TxButton className="w-full" onClick={submit} busy={active} disabled={disabled} connectLabel="Connect to contribute">
        Submit contribution
      </TxButton>
      {disabled && <p className="text-xs text-mist-500">This project is not accepting contributions.</p>}
      <TxPanel state={state} />
    </form>
  )
}

function Detail({ id }: { id: bigint }) {
  const { address } = useAccount()
  const q = useProject(id)
  const total = q.data ? q.data.contributions : 0
  const updatesTotal = q.data ? q.data.updates : 0
  const [cPage, setCPage] = useState(0)
  const [uPage, setUPage] = useState(0)
  const contribs = useProjectContributions(q.data ? id : null, total, cPage)
  const updates = useProjectUpdates(q.data ? id : null, updatesTotal, uPage)

  if (q.isLoading) return <Skeleton className="h-96" />
  if (q.isError && !isNotFound(q.error, 'UnknownProject')) return <ErrorState onRetry={() => void q.refetch()} />
  if (q.isError || !q.data) {
    return <EmptyState title="Project not found" body="This project does not exist on the active network." action={<Link to="/app/launchpad" className="btn-ghost">Back to Launchpad</Link>} />
  }
  const p = q.data
  const isOwner = !!address && address.toLowerCase() === p.owner.toLowerCase()
  const href = safeHref(p.link)
  const archived = p.stage === 5

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <section className="surface space-y-4 p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="ion">{p.category}</Badge>
            <StageBadge stage={p.stage} />
            <span className="text-xs text-mist-500">Project #{p.id.toString()}</span>
          </div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-mist-100 sm:text-3xl">{p.name}</h2>
          <p className="text-lg text-mist-300">{p.tagline}</p>
          <p className="whitespace-pre-wrap break-words text-sm text-mist-400">{p.description}</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-mist-500">
            <span className="inline-flex items-center gap-1.5">Owner <ProfileLink address={p.owner} /></span>
            <span>Created {formatDate(p.createdAt)}</span>
            <span>{plural(p.accepted, 'accepted contribution')}</span>
            {href && (
              <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-ion-400 hover:text-volt-300">
                Project link <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </section>

        <section className="surface space-y-4 p-5 sm:p-7">
          <h3 className="font-display text-lg font-semibold text-mist-100">Development timeline</h3>
          {updates.isLoading ? (
            <Skeleton className="h-20" />
          ) : updates.isError ? (
            <ErrorState onRetry={() => void updates.refetch()} />
          ) : (updates.data ?? []).length === 0 ? (
            <p className="text-sm text-mist-500">No updates posted yet.</p>
          ) : (
            <ol className="space-y-4 border-l border-white/10 pl-5">
              {(updates.data ?? []).map((u, i) => (
                <li key={`${u.at}-${i}`} className="relative">
                  <span className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-volt-400" aria-hidden="true" />
                  <p className="text-xs text-mist-500">
                    {PROJECT_STAGES[u.stage]} · {timeAgo(u.at)}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-mist-300">{u.text}</p>
                </li>
              ))}
            </ol>
          )}
          <Pagination page={uPage} pageCount={Math.max(1, Math.ceil(updatesTotal / REVIEW_PAGE_SIZE))} onChange={setUPage} />
        </section>

        <section className="surface space-y-4 p-5 sm:p-7">
          <h3 className="font-display text-lg font-semibold text-mist-100">Contributions ({total})</h3>
          {contribs.isLoading ? (
            <Skeleton className="h-24" />
          ) : contribs.isError ? (
            <ErrorState onRetry={() => void contribs.refetch()} />
          ) : (contribs.data ?? []).length === 0 ? (
            <p className="text-sm text-mist-500">No contributions yet.</p>
          ) : (
            <ContributionQueue items={contribs.data ?? []} isOwner={isOwner} />
          )}
          <Pagination page={cPage} pageCount={Math.max(1, Math.ceil(total / REVIEW_PAGE_SIZE))} onChange={setCPage} />
        </section>
      </div>

      <aside className="space-y-6">
        {isOwner ? (
          <section className="surface space-y-4 p-5 sm:p-6">
            <h3 className="font-display text-lg font-semibold text-mist-100">Manage project</h3>
            <StageAndUpdate project={p} />
          </section>
        ) : (
          <section className="surface space-y-4 p-5 sm:p-6">
            <h3 className="font-display text-lg font-semibold text-mist-100">Contribute</h3>
            <p className="text-sm text-mist-400">The owner reviews your work. If accepted, it becomes a proof record and earns reputation.</p>
            <ContributeForm projectId={p.id} disabled={archived} />
          </section>
        )}
      </aside>
    </div>
  )
}

export default function ProjectDetail() {
  const { id } = useParams()
  const parsed = parseId(id)
  return (
    <>
      <Link to="/app/launchpad" className="mb-5 inline-flex items-center gap-1.5 text-sm text-mist-400 hover:text-mist-100">
        <ArrowLeft className="h-4 w-4" /> Launchpad
      </Link>
      <RequireContracts>{parsed === null ? <ErrorState message="That is not a valid project id." /> : <Detail id={parsed} />}</RequireContracts>
    </>
  )
}
