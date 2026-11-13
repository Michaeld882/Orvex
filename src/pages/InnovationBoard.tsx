import { Heart, Undo2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAccount } from 'wagmi'
import { RequireContracts } from '@/components/NotConfigured'
import { TxButton, TxPanel } from '@/components/TxUi'
import { Badge, CardSkeletons, EmptyState, ErrorState, Field, PageHeader, Pagination, ProfileLink } from '@/components/ui'
import { useEndorsed, useIdeasPage } from '@/hooks/queries'
import { useOrvexTx } from '@/hooks/useOrvexTx'
import { timeAgo } from '@/lib/format'
import type { Idea } from '@/lib/types'
import { hasErrors, LIMITS, validateIdea, type IdeaForm } from '@/lib/validation'

const PAGE_SIZE = 10

function PostIdea() {
  const [form, setForm] = useState<IdeaForm>({ title: '', body: '', tag: '' })
  const [touched, setTouched] = useState(false)
  const { state, run, active, reset } = useOrvexTx(() => {
    setForm({ title: '', body: '', tag: '' })
    setTouched(false)
  })
  const errors = validateIdea(form)
  const L = LIMITS.idea
  const set = (key: keyof IdeaForm) => (e: { target: { value: string } }) => {
    reset()
    setForm((f) => ({ ...f, [key]: e.target.value }))
  }
  const submit = () => {
    setTouched(true)
    if (hasErrors(errors)) return
    void run({
      label: `Post idea: ${form.title.trim()}`,
      contract: 'ideas',
      functionName: 'postIdea',
      args: [form.title.trim(), form.body.trim(), form.tag.trim()],
    })
  }
  return (
    <form
      className="surface space-y-4 p-5 sm:p-6"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <h2 className="font-display text-lg font-semibold text-mist-100">Share an idea</h2>
      <Field label="Title" error={touched ? errors.title : undefined}>
        <input className="input" value={form.title} onChange={set('title')} maxLength={L.title[1]} />
      </Field>
      <Field label="Your idea" error={touched ? errors.body : undefined} hint="Public and permanent. 10 to 600 characters.">
        <textarea className="input min-h-28" value={form.body} onChange={set('body')} maxLength={L.body[1]} />
      </Field>
      <Field label="Tag" error={touched ? errors.tag : undefined}>
        <input className="input" value={form.tag} onChange={set('tag')} placeholder="Payments" maxLength={L.tag[1]} />
      </Field>
      <TxButton className="w-full" onClick={submit} busy={active} connectLabel="Connect to post">
        Post idea
      </TxButton>
      <p className="text-xs text-mist-500">Ideas earn no points. You can post one every 10 minutes.</p>
      <TxPanel state={state} />
    </form>
  )
}

function IdeaCard({ idea, endorsed, me }: { idea: Idea; endorsed: boolean; me?: string }) {
  const { state, run, active } = useOrvexTx()
  const isAuthor = !!me && me.toLowerCase() === idea.author.toLowerCase()
  const call = (fn: 'endorse' | 'retractIdea', label: string) =>
    void run({ label: `${label} idea #${idea.id}`, contract: 'ideas', functionName: fn, args: [idea.id] })
  return (
    <article className="surface space-y-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge tone="ion">{idea.tag}</Badge>
        <span className="text-xs text-mist-500">{timeAgo(idea.createdAt)}</span>
      </div>
      <h3 className="font-display text-lg font-semibold text-mist-100">{idea.title}</h3>
      <p className="whitespace-pre-wrap break-words text-sm text-mist-300">{idea.body}</p>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-3">
        <ProfileLink address={idea.author} />
        <div className="flex items-center gap-2">
          {isAuthor ? (
            <TxButton variant="ghost" className="!min-h-[40px] !px-3 text-xs" busy={active} onClick={() => call('retractIdea', 'Retract')}>
              <Undo2 className="h-3.5 w-3.5" /> Retract
            </TxButton>
          ) : (
            <TxButton
              variant="ghost"
              className="!min-h-[40px] !px-3 text-xs"
              busy={active}
              disabled={endorsed}
              connectLabel="Connect to endorse"
              onClick={() => call('endorse', 'Endorse')}
            >
              <Heart className={`h-3.5 w-3.5 ${endorsed ? 'fill-volt-400 text-volt-400' : ''}`} /> {endorsed ? 'Endorsed' : 'Endorse'}
            </TxButton>
          )}
          <span className="min-w-6 text-right font-mono text-sm tabular-nums text-mist-300" aria-label="Endorsements">
            {idea.endorsements}
          </span>
        </div>
      </div>
      <TxPanel state={state} />
    </article>
  )
}

function Feed() {
  const { address } = useAccount()
  const [page, setPage] = useState(0)
  const q = useIdeasPage(page, PAGE_SIZE)
  const visible = useMemo(() => (q.data?.items ?? []).filter((i) => !i.retracted), [q.data])
  const endorsed = useEndorsed(
    visible.map((i) => i.id),
    address,
  )
  if (q.isLoading) return <CardSkeletons count={3} className="h-44" />
  if (q.isError) return <ErrorState onRetry={() => void q.refetch()} />
  if (visible.length === 0) return <EmptyState title="No ideas on this page" body="Post the first idea and let the community react." />
  return (
    <>
      <div className="space-y-4">
        {visible.map((i) => (
          <IdeaCard key={i.id.toString()} idea={i} me={address} endorsed={endorsed.data?.has(i.id.toString()) ?? false} />
        ))}
      </div>
      {q.data && <Pagination page={page} pageCount={q.data.pageCount} onChange={setPage} />}
    </>
  )
}

export default function InnovationBoard() {
  return (
    <>
      <PageHeader eyebrow="Innovation Board" title="Ideas worth building" description="A public space for new ideas. Endorse the ones you want to see built." />
      <RequireContracts>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="order-2 lg:order-1">
            <Feed />
          </div>
          <div className="order-1 lg:sticky lg:top-24 lg:order-2 lg:self-start">
            <PostIdea />
          </div>
        </div>
      </RequireContracts>
    </>
  )
}
