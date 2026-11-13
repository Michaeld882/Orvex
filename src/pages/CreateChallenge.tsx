import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { RequireContracts } from '@/components/NotConfigured'
import { TxButton, TxPanel } from '@/components/TxUi'
import { Field, PageHeader } from '@/components/ui'
import { useOrvexTx } from '@/hooks/useOrvexTx'
import { hasErrors, LIMITS, parseDeadline, validateChallenge, type ChallengeForm } from '@/lib/validation'

function toLocalInput(sec: number): string {
  const d = new Date(sec * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const EMPTY: ChallengeForm = {
  title: '',
  description: '',
  skill: '',
  rewardNote: '',
  deadline: toLocalInput(Math.floor(Date.now() / 1000) + 7 * 86400),
  maxParticipants: '25',
}

function Form() {
  const navigate = useNavigate()
  const [form, setForm] = useState<ChallengeForm>(EMPTY)
  const [touched, setTouched] = useState(false)
  const { state, run, active, reset } = useOrvexTx(() => {
    window.setTimeout(() => void navigate('/app/arena'), 1200)
  })
  const errors = validateChallenge(form)
  const L = LIMITS.challenge
  const set = (key: keyof ChallengeForm) => (e: { target: { value: string } }) => {
    reset()
    setForm((f) => ({ ...f, [key]: e.target.value }))
  }
  const show = (key: keyof ChallengeForm) => (touched ? errors[key] : undefined)

  const submit = () => {
    setTouched(true)
    if (hasErrors(errors)) return
    const deadline = parseDeadline(form.deadline)
    if (deadline === null) return
    void run({
      label: `Create challenge: ${form.title.trim()}`,
      contract: 'challenges',
      functionName: 'createChallenge',
      args: [form.title.trim(), form.description.trim(), form.skill.trim(), form.rewardNote.trim(), deadline, Number(form.maxParticipants)],
    })
  }

  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault()
        submit()
      }}
      className="surface mx-auto max-w-2xl space-y-5 p-5 sm:p-8" noValidate>
      <Field label="Title" error={show('title')} hint={`${L.title[0]} to ${L.title[1]} characters`}>
        <input className="input" value={form.title} onChange={set('title')} placeholder="Design a gas-free onboarding flow" maxLength={L.title[1]} />
      </Field>
      <Field label="Description" error={show('description')} hint="What should contributors deliver, and how will you judge it?">
        <textarea className="input min-h-32" value={form.description} onChange={set('description')} maxLength={L.description[1]} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Skill tag" error={show('skill')} hint="Verified on contributors' Skill Passport when you approve their work.">
          <input className="input" value={form.skill} onChange={set('skill')} placeholder="Solidity" maxLength={L.skill[1]} />
        </Field>
        <Field label="Maximum participants" error={show('maxParticipants')}>
          <input className="input" inputMode="numeric" value={form.maxParticipants} onChange={set('maxParticipants')} />
        </Field>
      </div>
      <Field label="Deadline" error={show('deadline')} hint="Between 1 hour and 365 days from now. Shown in your local time.">
        <input className="input" type="datetime-local" value={form.deadline} onChange={set('deadline')} />
      </Field>
      <Field label="Reward note (optional)" error={show('rewardNote')} hint="A description only. ORVEX never holds or sends funds, so any reward is agreed and paid by you outside the contract.">
        <input className="input" value={form.rewardNote} onChange={set('rewardNote')} placeholder="Shout-out in our newsletter" maxLength={L.rewardNote[1]} />
      </Field>
      <TxButton onClick={submit} busy={active} className="w-full" connectLabel="Connect to create">
        Create challenge
      </TxButton>
      <TxPanel state={state} />
    </form>
  )
}

export default function CreateChallenge() {
  return (
    <>
      <PageHeader eyebrow="Challenge Arena" title="Create a challenge" description="Define the work, set a deadline, and review submissions. Approved work becomes onchain proof for the contributor." />
      <RequireContracts>
        <Form />
      </RequireContracts>
    </>
  )
}
