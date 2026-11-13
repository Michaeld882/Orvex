import { CalendarClock, Hash, Link2, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatDate, plural, safeHref, timeAgo, timeLeft } from '@/lib/format'
import {
  PROJECT_STAGES,
  PROOF_SOURCE,
  effectiveStatus,
  type Challenge,
  type EffectiveChallengeStatus,
  type ProofRecord,
  type Project,
} from '@/lib/types'
import { Badge, ProfileLink } from './ui'

const STATUS_TONE: Record<EffectiveChallengeStatus, 'arc' | 'neutral' | 'flare' | 'ember'> = {
  Open: 'arc',
  Closed: 'neutral',
  Cancelled: 'flare',
  Expired: 'ember',
}

export function ChallengeStatusBadge({ challenge }: { challenge: Challenge }) {
  const status = effectiveStatus(challenge)
  return <Badge tone={STATUS_TONE[status]}>{status}</Badge>
}

export function ChallengeCard({ challenge }: { challenge: Challenge }) {
  return (
    <Link
      to={`/app/arena/${challenge.id}`}
      className="surface group flex flex-col gap-3 p-5 transition duration-200 hover:-translate-y-0.5 hover:border-volt-400/30"
    >
      <div className="flex items-start justify-between gap-3">
        <Badge tone="ion">{challenge.skill}</Badge>
        <ChallengeStatusBadge challenge={challenge} />
      </div>
      <h3 className="line-clamp-2 font-display text-lg font-semibold leading-snug text-mist-100 group-hover:text-volt-300">{challenge.title}</h3>
      <p className="line-clamp-2 text-sm text-mist-400">{challenge.description}</p>
      {challenge.rewardNote && <p className="line-clamp-1 text-xs text-ember-400">Reward note: {challenge.rewardNote}</p>}
      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-white/[0.06] pt-3 text-xs text-mist-500">
        <span className="inline-flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" /> {challenge.participants}/{challenge.maxParticipants}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CalendarClock className="h-3.5 w-3.5" /> {timeLeft(challenge.deadline)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Hash className="h-3.5 w-3.5" /> {challenge.id.toString()}
        </span>
      </div>
    </Link>
  )
}

/** A link to submitted work. Content is user supplied, so only https and ipfs links are clickable. */
export function ExternalWork({ uri }: { uri: string }) {
  const href = safeHref(uri)
  if (!href) return <span className="truncate text-xs text-mist-500">{uri}</span>
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 items-center gap-1.5 text-xs text-ion-400 hover:text-volt-300">
      <Link2 className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{uri}</span>
    </a>
  )
}

const STAGE_TONE = ['neutral', 'ion', 'ember', 'arc', 'neutral', 'flare'] as const

export function StageBadge({ stage }: { stage: number }) {
  return <Badge tone={STAGE_TONE[stage] ?? 'neutral'}>{PROJECT_STAGES[stage] ?? 'Unknown'}</Badge>
}

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      to={`/app/launchpad/${project.id}`}
      className="surface group flex flex-col gap-3 p-5 transition duration-200 hover:-translate-y-0.5 hover:border-volt-400/30"
    >
      <div className="flex items-start justify-between gap-3">
        <Badge tone="ion">{project.category}</Badge>
        <StageBadge stage={project.stage} />
      </div>
      <h3 className="line-clamp-1 font-display text-lg font-semibold text-mist-100 group-hover:text-volt-300">{project.name}</h3>
      <p className="line-clamp-2 text-sm text-mist-400">{project.tagline}</p>
      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-white/[0.06] pt-3 text-xs text-mist-500">
        <span>{plural(project.accepted, 'accepted contribution')}</span>
        <span>{plural(project.updates, 'update')}</span>
        <span>{timeAgo(project.updatedAt)}</span>
      </div>
    </Link>
  )
}

export function ProofCard({ record, chainLabel }: { record: ProofRecord; chainLabel?: string }) {
  return (
    <article className="surface flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between gap-3">
        <Badge tone="volt">Proof #{record.id.toString()}</Badge>
        <Badge tone="neutral">{PROOF_SOURCE[record.source]} #{record.sourceId.toString()}</Badge>
      </div>
      <h3 className="line-clamp-2 font-display text-lg font-semibold text-mist-100">{record.title}</h3>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
        <dt className="text-mist-500">Contributor</dt>
        <dd>
          <ProfileLink address={record.contributor} />
        </dd>
        <dt className="text-mist-500">Attested by</dt>
        <dd>
          <ProfileLink address={record.attestor} />
        </dd>
        <dt className="text-mist-500">Recorded</dt>
        <dd className="text-mist-300">{formatDate(record.recordedAt)}</dd>
      </dl>
      <ExternalWork uri={record.uri} />
      {chainLabel && <p className="text-[11px] text-mist-500">{chainLabel}</p>}
    </article>
  )
}
