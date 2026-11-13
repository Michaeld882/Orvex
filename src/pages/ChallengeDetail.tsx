import { ArrowLeft, CalendarClock, Gift, Users } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { ChallengeStatusBadge } from '@/components/cards'
import { ParticipantPanel } from '@/components/challenge/ParticipantPanel'
import { ReviewPanel } from '@/components/challenge/ReviewPanel'
import { RequireContracts } from '@/components/NotConfigured'
import { TxButton, TxPanel } from '@/components/TxUi'
import { Badge, EmptyState, ErrorState, ProfileLink, Skeleton } from '@/components/ui'
import { useChallenge, useIsParticipant } from '@/hooks/queries'
import { useOrvexTx } from '@/hooks/useOrvexTx'
import { isNotFound } from '@/lib/errors'
import { formatDateTime, plural, timeLeft } from '@/lib/format'
import { effectiveStatus, type Challenge } from '@/lib/types'

function parseId(raw: string | undefined): bigint | null {
  return raw && /^\d{1,18}$/.test(raw) && raw !== '0' ? BigInt(raw) : null
}

function CreatorTools({ challenge }: { challenge: Challenge }) {
  const { state, run, active } = useOrvexTx()
  const status = effectiveStatus(challenge)
  const call = (fn: 'closeChallenge' | 'cancelChallenge', label: string) =>
    void run({ label: `${label} challenge #${challenge.id}`, contract: 'challenges', functionName: fn, args: [challenge.id] })
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {status === 'Open' && (
          <TxButton variant="ghost" onClick={() => call('closeChallenge', 'Close')} disabled={active}>
            Close to new entries
          </TxButton>
        )}
        {status !== 'Cancelled' && (
          <TxButton variant="danger" onClick={() => call('cancelChallenge', 'Cancel')} disabled={active || challenge.approved > 0}>
            Cancel challenge
          </TxButton>
        )}
      </div>
      {challenge.approved > 0 && status !== 'Cancelled' && (
        <p className="mt-2 text-xs text-mist-500">Challenges with approved work cannot be cancelled.</p>
      )}
      <TxPanel state={state} />
    </div>
  )
}

function Detail({ id }: { id: bigint }) {
  const { address } = useAccount()
  const q = useChallenge(id)
  const participant = useIsParticipant(id, address)
  const join = useOrvexTx()

  if (q.isLoading) return <Skeleton className="h-96" />
  if (q.isError && !isNotFound(q.error, 'UnknownChallenge')) return <ErrorState onRetry={() => void q.refetch()} />
  if (q.isError || !q.data) {
    return <EmptyState title="Challenge not found" body="This challenge does not exist on the active network." action={<Link to="/app/arena" className="btn-ghost">Back to the arena</Link>} />
  }
  const c = q.data
  const status = effectiveStatus(c)
  const isCreator = !!address && address.toLowerCase() === c.creator.toLowerCase()
  const joined = participant.data === true
  const canJoin = status === 'Open' && !isCreator && !joined && c.participants < c.maxParticipants
  const canSubmit = status === 'Open'

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <section className="surface space-y-5 p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="ion">{c.skill}</Badge>
          <ChallengeStatusBadge challenge={c} />
          <span className="text-xs text-mist-500">Challenge #{c.id.toString()}</span>
        </div>
        <h2 className="font-display text-2xl font-bold tracking-tight text-mist-100 sm:text-3xl">{c.title}</h2>
        <p className="whitespace-pre-wrap break-words text-mist-300">{c.description}</p>
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div className="surface-inner p-3.5">
            <dt className="label flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" /> Deadline</dt>
            <dd className="mt-1.5 text-mist-100">{formatDateTime(c.deadline)}</dd>
            <dd className="text-xs text-mist-500">{timeLeft(c.deadline)}</dd>
          </div>
          <div className="surface-inner p-3.5">
            <dt className="label flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Participants</dt>
            <dd className="mt-1.5 text-mist-100">{c.participants} / {c.maxParticipants}</dd>
            <dd className="text-xs text-mist-500">{plural(c.submissions, 'submission')}, {c.approved} approved</dd>
          </div>
          <div className="surface-inner p-3.5">
            <dt className="label">Creator</dt>
            <dd className="mt-1.5"><ProfileLink address={c.creator} /></dd>
            <dd className="text-xs text-mist-500">Reviews all work</dd>
          </div>
        </dl>
        {c.rewardNote && (
          <div className="flex gap-3 rounded-xl border border-ember-400/25 bg-ember-400/[0.07] p-4 text-sm">
            <Gift className="mt-0.5 h-4 w-4 shrink-0 text-ember-400" />
            <div>
              <p className="font-medium text-mist-100">Reward note from the creator</p>
              <p className="mt-1 break-words text-mist-300">{c.rewardNote}</p>
              <p className="mt-2 text-xs text-mist-500">ORVEX does not hold or pay rewards. Agree on them with the creator directly.</p>
            </div>
          </div>
        )}
      </section>

      <aside className="space-y-6">
        <section className="surface space-y-4 p-5 sm:p-6">
          <h3 className="font-display text-lg font-semibold text-mist-100">{isCreator ? 'Manage' : joined ? 'Your participation' : 'Take part'}</h3>
          {isCreator ? (
            <CreatorTools challenge={c} />
          ) : joined && address ? (
            <ParticipantPanel challenge={c} user={address} canSubmit={canSubmit} />
          ) : (
            <>
              <p className="text-sm text-mist-400">
                {canJoin ? 'Join to submit work. The creator reviews it, and approval records proof and reputation for you.' : `This challenge is ${status.toLowerCase()}${c.participants >= c.maxParticipants && status === 'Open' ? ' and full' : ''}.`}
              </p>
              {(canJoin || !address) && (
                <TxButton
                  className="w-full"
                  connectLabel="Connect to join"
                  busy={join.active}
                  disabled={!canJoin}
                  onClick={() => void join.run({ label: `Join challenge #${c.id}`, contract: 'challenges', functionName: 'joinChallenge', args: [c.id] })}
                >
                  Join challenge
                </TxButton>
              )}
              <TxPanel state={join.state} />
            </>
          )}
        </section>
        {isCreator && (
          <section className="surface space-y-4 p-5 sm:p-6">
            <h3 className="font-display text-lg font-semibold text-mist-100">Submissions</h3>
            <ReviewPanel challenge={c} />
          </section>
        )}
      </aside>
    </div>
  )
}

export default function ChallengeDetail() {
  const { id } = useParams()
  const parsed = parseId(id)
  return (
    <>
      <Link to="/app/arena" className="mb-5 inline-flex items-center gap-1.5 text-sm text-mist-400 hover:text-mist-100">
        <ArrowLeft className="h-4 w-4" /> Challenge Arena
      </Link>
      <RequireContracts>
        {parsed === null ? <ErrorState message="That is not a valid challenge id." /> : <Detail id={parsed} />}
      </RequireContracts>
    </>
  )
}
