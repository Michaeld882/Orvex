import { BadgeCheck, ExternalLink, Pencil } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { isAddress, type Address } from 'viem'
import { useAccount } from 'wagmi'
import { ProofCard } from '@/components/cards'
import { RequireContracts } from '@/components/NotConfigured'
import { TxButton, TxPanel } from '@/components/TxUi'
import { Badge, EmptyState, ErrorState, Field, PageHeader, Skeleton, StatCard } from '@/components/ui'
import { useProfile, useUserProofs } from '@/hooks/queries'
import { useOrvexTx } from '@/hooks/useOrvexTx'
import { addressUrl } from '@/lib/active'
import { formatDate, safeHref, shortAddress } from '@/lib/format'
import { ACHIEVEMENTS, LEVEL_THRESHOLDS, nextLevelAt } from '@/lib/types'
import { hasErrors, LIMITS, validateProfile, type ProfileForm } from '@/lib/validation'

function ProfileEditor({ initial, onDone }: { initial: ProfileForm; onDone: () => void }) {
  const [form, setForm] = useState<ProfileForm>(initial)
  const [touched, setTouched] = useState(false)
  const { state, run, active, reset } = useOrvexTx(onDone)
  const errors = validateProfile(form)
  const L = LIMITS.profile
  const set = (key: keyof ProfileForm) => (e: { target: { value: string } }) => {
    reset()
    setForm((f) => ({ ...f, [key]: e.target.value }))
  }
  const submit = () => {
    setTouched(true)
    if (hasErrors(errors)) return
    void run({
      label: 'Update profile',
      contract: 'identity',
      functionName: 'setProfile',
      args: [form.displayName.trim(), form.bio.trim(), form.skillsNote.trim(), form.link.trim()],
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
      <h2 className="font-display text-lg font-semibold text-mist-100">Edit your profile</h2>
      <Field label="Display name" error={touched ? errors.displayName : undefined}>
        <input className="input" value={form.displayName} onChange={set('displayName')} maxLength={L.displayName[1]} />
      </Field>
      <Field label="Bio" error={touched ? errors.bio : undefined}>
        <textarea className="input min-h-24" value={form.bio} onChange={set('bio')} maxLength={L.bio[1]} />
      </Field>
      <Field label="Skills you want to be known for" error={touched ? errors.skillsNote : undefined} hint="Self-described. Verified skills come only from approved work.">
        <input className="input" value={form.skillsNote} onChange={set('skillsNote')} maxLength={L.skillsNote[1]} />
      </Field>
      <Field label="Link (optional)" error={touched ? errors.link : undefined} hint="https:// or ipfs://">
        <input className="input" value={form.link} onChange={set('link')} maxLength={L.link[1]} />
      </Field>
      <div className="flex gap-2">
        <TxButton className="flex-1" onClick={submit} busy={active}>
          Save profile
        </TxButton>
        <button type="button" className="btn-ghost" onClick={onDone} disabled={active}>
          Cancel
        </button>
      </div>
      <TxPanel state={state} />
    </form>
  )
}

function View({ user, isMine }: { user: Address; isMine: boolean }) {
  const q = useProfile(user)
  const proofs = useUserProofs(user)
  const [editing, setEditing] = useState(false)

  if (q.isLoading) return <Skeleton className="h-96" />
  if (q.isError || !q.data) return <ErrorState onRetry={() => void q.refetch()} />
  const { profile, stats, skills, achievementMask, level } = q.data
  const link = safeHref(profile.link)
  const next = nextLevelAt(stats.points)
  const base = LEVEL_THRESHOLDS[level - 1] ?? 0
  const pct = next ? Math.round(((stats.points - base) / (next - base)) * 100) : 100
  const claimed = ACHIEVEMENTS.filter((a) => ((achievementMask >> BigInt(a.id)) & 1n) === 1n)

  return (
    <div className="space-y-6">
      <section className="surface flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:p-7">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-volt-400/20 to-arc-400/20 font-display text-3xl font-bold text-volt-300" aria-hidden="true">
          {(profile.exists ? profile.displayName : user.slice(2))[0]?.toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate font-display text-2xl font-bold tracking-tight text-mist-100">{profile.exists ? profile.displayName : 'Unnamed contributor'}</h2>
            <Badge tone="volt">Level {level}</Badge>
          </div>
          <a href={addressUrl(user)} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 font-mono text-xs text-mist-400 hover:text-volt-300">
            {shortAddress(user, 10, 8)} <ExternalLink className="h-3 w-3" />
          </a>
          {profile.bio && <p className="mt-3 whitespace-pre-wrap break-words text-sm text-mist-300">{profile.bio}</p>}
          {profile.skillsNote && <p className="mt-2 break-words text-sm text-mist-500">Focus: {profile.skillsNote}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-mist-500">
            {profile.exists && <span>Updated {formatDate(profile.updatedAt)}</span>}
            {link && (
              <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-ion-400 hover:text-volt-300">
                Website <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
        {isMine && !editing && (
          <button type="button" className="btn-ghost shrink-0" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" /> {profile.exists ? 'Edit' : 'Create profile'}
          </button>
        )}
      </section>

      {isMine && editing && (
        <ProfileEditor
          initial={{ displayName: profile.displayName, bio: profile.bio, skillsNote: profile.skillsNote, link: profile.link }}
          onDone={() => setEditing(false)}
        />
      )}

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Reputation" value={stats.points} hint={next ? `${next - stats.points} to level ${level + 1}` : 'Top level reached'} />
        <StatCard label="Challenges completed" value={stats.challengesCompleted} />
        <StatCard label="Contributions accepted" value={stats.contributionsAccepted} />
        <StatCard label="Proof records" value={q.data.proofCount} />
      </section>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Level progress">
        <div className="h-full rounded-full bg-gradient-to-r from-volt-400 to-arc-400" style={{ width: `${pct}%` }} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="surface p-5 sm:p-6">
          <h3 className="font-display text-lg font-semibold text-mist-100">Skill Passport</h3>
          <p className="mt-1 text-xs text-mist-500">Skills verified by approved work. They cannot be self-declared.</p>
          {skills.length === 0 ? (
            <p className="mt-4 text-sm text-mist-500">No verified skills yet.</p>
          ) : (
            <ul className="mt-4 flex flex-wrap gap-2">
              {skills.map((s) => (
                <li key={s.name}>
                  <Badge tone="arc">
                    <BadgeCheck className="h-3 w-3" /> {s.name} x{s.count}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="surface p-5 sm:p-6">
          <h3 className="font-display text-lg font-semibold text-mist-100">Achievements</h3>
          {claimed.length === 0 ? (
            <p className="mt-4 text-sm text-mist-500">
              None claimed yet.{isMine && (
                <>
                  {' '}
                  <Link to="/app/proof" className="text-volt-300 hover:underline">
                    See what you can claim
                  </Link>
                  .
                </>
              )}
            </p>
          ) : (
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {claimed.map((a) => (
                <li key={a.id} className="surface-inner flex items-center gap-2 p-3 text-sm text-mist-100">
                  <BadgeCheck className="h-4 w-4 text-volt-400" /> {a.name}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section>
        <h3 className="mb-4 font-display text-lg font-semibold text-mist-100">Contribution history</h3>
        {proofs.isLoading ? (
          <Skeleton className="h-40" />
        ) : (proofs.data ?? []).length === 0 ? (
          <EmptyState title="No contributions recorded" body="Approved work will be listed here with its onchain proof." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {(proofs.data ?? []).map((r) => (
              <ProofCard key={r.id.toString()} record={r} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function Content() {
  const { address: routeAddress } = useParams()
  const { address: me } = useAccount()
  const navigate = useNavigate()

  useEffect(() => {
    if (!routeAddress && me) void navigate(`/app/profile/${me}`, { replace: true })
  }, [routeAddress, me, navigate])

  if (!routeAddress) {
    return <EmptyState title="Connect your wallet" body="Connect to view and customize your ORVEX identity, or open any profile from the leaderboard." />
  }
  if (!isAddress(routeAddress, { strict: false })) return <ErrorState message="That is not a valid wallet address." />
  const user = routeAddress
  return <View user={user} isMine={!!me && me.toLowerCase() === user.toLowerCase()} />
}

export default function Profile() {
  return (
    <>
      <PageHeader eyebrow="ORVEX Identity" title="Profile" description="A public identity built from verified work, with reputation anyone can check." />
      <RequireContracts>
        <Content />
      </RequireContracts>
    </>
  )
}
