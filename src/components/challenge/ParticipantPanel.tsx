import { useState } from 'react'
import { ExternalWork } from '@/components/cards'
import { TxButton, TxPanel } from '@/components/TxUi'
import { Badge, Field, Skeleton } from '@/components/ui'
import { useMySubmission } from '@/hooks/queries'
import { useOrvexTx } from '@/hooks/useOrvexTx'
import { SUBMISSION_STATUS, type Challenge } from '@/lib/types'
import { hasErrors, LIMITS, validateSubmission } from '@/lib/validation'
import type { Address } from 'viem'

const TONE = ['neutral', 'ember', 'arc', 'flare'] as const

/** What a joined participant sees: their submission state and, when allowed, the submit form. */
export function ParticipantPanel({ challenge, user, canSubmit }: { challenge: Challenge; user: Address; canSubmit: boolean }) {
  const mine = useMySubmission(challenge.id, user)
  const [form, setForm] = useState({ uri: '', note: '' })
  const [touched, setTouched] = useState(false)
  const { state, run, active, reset } = useOrvexTx(() => setForm({ uri: '', note: '' }))
  const errors = validateSubmission(form)

  if (mine.isLoading) return <Skeleton className="h-28" />
  const sub = mine.data
  const status = sub?.status ?? 0
  const canResubmit = canSubmit && (status === 0 || status === 3) && (sub?.attempts ?? 0) < 3

  const submit = () => {
    setTouched(true)
    if (hasErrors(errors)) return
    void run({
      label: `Submit work to challenge #${challenge.id}`,
      contract: 'challenges',
      functionName: 'submitWork',
      args: [challenge.id, form.uri.trim(), form.note.trim()],
    })
  }

  return (
    <div className="space-y-4">
      {sub && status !== 0 && (
        <div className="surface-inner space-y-2 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="label">Your submission</p>
            <Badge tone={TONE[status]}>{SUBMISSION_STATUS[status]}</Badge>
          </div>
          <ExternalWork uri={sub.uri} />
          {status === 1 && <p className="text-xs text-mist-500">Waiting for the creator to review your work.</p>}
          {status === 2 && <p className="text-xs text-arc-300">Approved. A proof record and reputation were written onchain.</p>}
          {status === 3 && <p className="text-xs text-flare-400">Rejected. You have {3 - sub.attempts} attempt(s) left while the challenge is open.</p>}
        </div>
      )}
      {canResubmit && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
          noValidate
        >
          <Field label="Link to your work" error={touched ? errors.uri : undefined} hint="https:// or ipfs:// link (repository, document, deployment)">
            <input
              className="input"
              value={form.uri}
              placeholder="https://"
              maxLength={LIMITS.submission.uri[1]}
              onChange={(e) => {
                reset()
                setForm((f) => ({ ...f, uri: e.target.value }))
              }}
            />
          </Field>
          <Field label="Note (optional)" error={touched ? errors.note : undefined}>
            <textarea
              className="input min-h-24"
              value={form.note}
              maxLength={LIMITS.submission.note[1]}
              onChange={(e) => {
                reset()
                setForm((f) => ({ ...f, note: e.target.value }))
              }}
            />
          </Field>
          <TxButton onClick={submit} busy={active} className="w-full">
            {status === 3 ? 'Resubmit work' : 'Submit work'}
          </TxButton>
          <TxPanel state={state} />
        </form>
      )}
    </div>
  )
}
