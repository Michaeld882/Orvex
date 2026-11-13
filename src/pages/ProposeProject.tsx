import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { RequireContracts } from '@/components/NotConfigured'
import { TxButton, TxPanel } from '@/components/TxUi'
import { Field, PageHeader } from '@/components/ui'
import { useOrvexTx } from '@/hooks/useOrvexTx'
import { hasErrors, LIMITS, validateProject, type ProjectForm } from '@/lib/validation'

function Form() {
  const navigate = useNavigate()
  const [form, setForm] = useState<ProjectForm>({ name: '', tagline: '', description: '', category: '', link: '' })
  const [touched, setTouched] = useState(false)
  const { state, run, active, reset } = useOrvexTx(() => {
    window.setTimeout(() => void navigate('/app/launchpad'), 1200)
  })
  const errors = validateProject(form)
  const L = LIMITS.project
  const set = (key: keyof ProjectForm) => (e: { target: { value: string } }) => {
    reset()
    setForm((f) => ({ ...f, [key]: e.target.value }))
  }
  const show = (key: keyof ProjectForm) => (touched ? errors[key] : undefined)

  const submit = () => {
    setTouched(true)
    if (hasErrors(errors)) return
    void run({
      label: `Propose project: ${form.name.trim()}`,
      contract: 'launchpad',
      functionName: 'proposeProject',
      args: [form.name.trim(), form.tagline.trim(), form.description.trim(), form.category.trim(), form.link.trim()],
    })
  }

  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault()
        submit()
      }}
      className="surface mx-auto max-w-2xl space-y-5 p-5 sm:p-8"
      noValidate
    >
      <Field label="Project name" error={show('name')}>
        <input className="input" value={form.name} onChange={set('name')} maxLength={L.name[1]} />
      </Field>
      <Field label="Tagline" error={show('tagline')} hint="One line that explains it.">
        <input className="input" value={form.tagline} onChange={set('tagline')} maxLength={L.tagline[1]} />
      </Field>
      <Field label="Description" error={show('description')}>
        <textarea className="input min-h-32" value={form.description} onChange={set('description')} maxLength={L.description[1]} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Category" error={show('category')} hint="Used as the verified skill for accepted contributions.">
          <input className="input" value={form.category} onChange={set('category')} placeholder="Tooling" maxLength={L.category[1]} />
        </Field>
        <Field label="Project link (optional)" error={show('link')} hint="https:// or ipfs://">
          <input className="input" value={form.link} onChange={set('link')} placeholder="https://" maxLength={L.link[1]} />
        </Field>
      </div>
      <TxButton onClick={submit} busy={active} className="w-full" connectLabel="Connect to propose">
        Propose project
      </TxButton>
      <TxPanel state={state} />
    </form>
  )
}

export default function ProposeProject() {
  return (
    <>
      <PageHeader eyebrow="ORVEX Launchpad" title="Propose a project" description="Start in the Idea stage and move forward as you build. You review every contribution to your project." />
      <RequireContracts>
        <Form />
      </RequireContracts>
    </>
  )
}
