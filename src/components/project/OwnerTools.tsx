import { Check, X } from 'lucide-react'
import { useState } from 'react'
import { useAccount } from 'wagmi'
import { ExternalWork } from '@/components/cards'
import { TxButton, TxPanel } from '@/components/TxUi'
import { Badge, Field, ProfileLink } from '@/components/ui'
import { useOrvexTx } from '@/hooks/useOrvexTx'
import { timeAgo } from '@/lib/format'
import { PROJECT_STAGES, REVIEW_STATUS, type Project, type ProjectContribution } from '@/lib/types'
import { LIMITS, checkText } from '@/lib/validation'

export function StageAndUpdate({ project }: { project: Project }) {
  const [stage, setStage] = useState(project.stage)
  const [text, setText] = useState('')
  const [touched, setTouched] = useState(false)
  const stageTx = useOrvexTx()
  const updateTx = useOrvexTx(() => setText(''))
  const err = checkText('Update', text, LIMITS.project.update)
  const archived = project.stage === 5

  return (
    <div className="space-y-6">
      <div>
        <Field label="Stage" hint={archived ? 'Archived projects are final.' : 'Archiving is permanent.'}>
          <select className="input" value={stage} disabled={archived} onChange={(e) => setStage(Number(e.target.value))}>
            {PROJECT_STAGES.map((s, i) => (
              <option key={s} value={i}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <TxButton
          variant="ghost"
          className="mt-3 w-full"
          disabled={archived || stage === project.stage}
          busy={stageTx.active}
          onClick={() =>
            void stageTx.run({ label: `Set project #${project.id} to ${PROJECT_STAGES[stage]}`, contract: 'launchpad', functionName: 'setStage', args: [project.id, stage] })
          }
        >
          Update stage
        </TxButton>
        <TxPanel state={stageTx.state} />
      </div>
      <div>
        <Field label="Post a progress update" error={touched ? (err ?? undefined) : undefined} hint="Visible to everyone. 3 to 280 characters.">
          <textarea className="input min-h-24" value={text} maxLength={LIMITS.project.update[1]} disabled={archived} onChange={(e) => setText(e.target.value)} />
        </Field>
        <TxButton
          className="mt-3 w-full"
          disabled={archived}
          busy={updateTx.active}
          onClick={() => {
            setTouched(true)
            if (err) return
            void updateTx.run({ label: `Update on project #${project.id}`, contract: 'launchpad', functionName: 'postUpdate', args: [project.id, text.trim()] })
          }}
        >
          Post update
        </TxButton>
        <TxPanel state={updateTx.state} />
      </div>
    </div>
  )
}

const TONE = ['ember', 'arc', 'flare', 'neutral'] as const

export function ContributionQueue({ items, isOwner }: { items: ProjectContribution[]; isOwner: boolean }) {
  const { state, run, active } = useOrvexTx()
  const { address } = useAccount()
  const [target, setTarget] = useState<string | null>(null)
  const withdraw = (id: bigint) => {
    setTarget(id.toString())
    void run({ label: `Withdraw contribution #${id}`, contract: 'launchpad', functionName: 'withdrawContribution', args: [id] })
  }
  const review = (id: bigint, accept: boolean) => {
    setTarget(id.toString())
    void run({ label: `${accept ? 'Accept' : 'Decline'} contribution #${id}`, contract: 'launchpad', functionName: 'reviewContribution', args: [id, accept] })
  }
  return (
    <div className="space-y-3">
      {items.map((c) => (
        <div key={c.id.toString()} className="surface-inner space-y-2 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium text-mist-100">{c.title}</p>
            <Badge tone={TONE[c.status]}>{REVIEW_STATUS[c.status]}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 text-xs text-mist-500">
            <ProfileLink address={c.contributor} />
            <span>{timeAgo(c.submittedAt)}</span>
          </div>
          <ExternalWork uri={c.uri} />
          {!isOwner && c.status === 0 && !!address && address.toLowerCase() === c.contributor.toLowerCase() && (
            <div className="pt-1">
              <TxButton variant="ghost" className="!min-h-[40px] text-xs" disabled={active} busy={active && target === c.id.toString()} onClick={() => withdraw(c.id)}>
                Withdraw this contribution
              </TxButton>
              <p className="mt-1 text-[11px] text-mist-500">Frees your pending slot if the owner has not reviewed it.</p>
            </div>
          )}
          {isOwner && c.status === 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              <TxButton busy={active && target === c.id.toString()} disabled={active} onClick={() => review(c.id, true)}>
                <Check className="h-4 w-4" /> Accept
              </TxButton>
              <TxButton variant="danger" disabled={active} onClick={() => review(c.id, false)}>
                <X className="h-4 w-4" /> Decline
              </TxButton>
            </div>
          )}
        </div>
      ))}
      <TxPanel state={state} />
    </div>
  )
}
