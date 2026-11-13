import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { REVIEW_PAGE_SIZE } from '@/services/reads'
import { ExternalWork } from '@/components/cards'
import { TxButton, TxPanel } from '@/components/TxUi'
import { Badge, EmptyState, ErrorState, Pagination, ProfileLink, Skeleton } from '@/components/ui'
import { useChallengeSubmissions } from '@/hooks/queries'
import { useOrvexTx } from '@/hooks/useOrvexTx'
import { timeAgo } from '@/lib/format'
import { SUBMISSION_STATUS, type Challenge } from '@/lib/types'

const TONE = ['neutral', 'ember', 'arc', 'flare'] as const

/** Creator-only review queue. Approval writes proof and reputation in the same transaction. */
export function ReviewPanel({ challenge }: { challenge: Challenge }) {
  const [page, setPage] = useState(0)
  const submissions = useChallengeSubmissions(challenge.id, challenge.participants, page, true)
  const { state, run, active } = useOrvexTx()
  const [target, setTarget] = useState<string | null>(null)

  const review = (participant: string, approve: boolean) => {
    setTarget(participant)
    void run({
      label: `${approve ? 'Approve' : 'Reject'} work on challenge #${challenge.id}`,
      contract: 'challenges',
      functionName: 'reviewSubmission',
      args: [challenge.id, participant, approve],
    })
  }

  if (submissions.isLoading) return <Skeleton className="h-32" />
  if (submissions.isError) return <ErrorState onRetry={() => void submissions.refetch()} />
  const rows = submissions.data ?? []
  if (rows.length === 0) return <EmptyState title="No participants yet" body="Participants and their submitted work appear here for you to approve or reject." />

  const remove = (participant: string) => {
    setTarget(participant)
    void run({
      label: `Remove participant from challenge #${challenge.id}`,
      contract: 'challenges',
      functionName: 'removeParticipant',
      args: [challenge.id, participant],
    })
  }

  return (
    <div className="space-y-3">
      {rows.map(({ participant, submission }) => (
        <div key={participant} className="surface-inner space-y-2.5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ProfileLink address={participant} />
            <div className="flex items-center gap-2">
              <span className="text-xs text-mist-500">
                attempt {submission.attempts} · {timeAgo(submission.submittedAt)}
              </span>
              <Badge tone={TONE[submission.status]}>{SUBMISSION_STATUS[submission.status]}</Badge>
            </div>
          </div>
          {submission.status === 0 ? (
            <p className="text-xs text-mist-500">Joined, no work submitted yet.</p>
          ) : (
            <ExternalWork uri={submission.uri} />
          )}
          {submission.note && <p className="whitespace-pre-wrap break-words text-sm text-mist-300">{submission.note}</p>}
          {(submission.status === 0 || submission.status === 3) && challenge.status !== 2 && (
            <div className="pt-1">
              <TxButton variant="ghost" className="!min-h-[40px] text-xs" disabled={active} busy={active && target === participant} onClick={() => remove(participant)}>
                Remove and free the slot
              </TxButton>
              <p className="mt-1 text-[11px] text-mist-500">Removed wallets cannot rejoin this challenge.</p>
            </div>
          )}
          {submission.status === 1 && (
            <div className="flex flex-wrap gap-2 pt-1">
              <TxButton onClick={() => review(participant, true)} busy={active && target === participant} disabled={active}>
                <Check className="h-4 w-4" /> Approve
              </TxButton>
              <TxButton variant="danger" onClick={() => review(participant, false)} disabled={active}>
                <X className="h-4 w-4" /> Reject
              </TxButton>
            </div>
          )}
        </div>
      ))}
      <Pagination page={page} pageCount={Math.max(1, Math.ceil(challenge.participants / REVIEW_PAGE_SIZE))} onChange={setPage} />
      <TxPanel state={state} />
    </div>
  )
}
