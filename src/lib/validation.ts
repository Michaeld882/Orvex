/**
 * Form validation mirroring the on-chain bounds in contracts/*.sol.
 * Lengths are measured in UTF-8 BYTES, exactly as the contracts measure them.
 */

export type FieldErrors<T> = Partial<Record<keyof T, string>>

export const LIMITS = {
  challenge: {
    title: [3, 80],
    description: [10, 1000],
    skill: [1, 24],
    rewardNote: [0, 120],
    participants: [1, 1000],
    minDurationSec: 3600,
    maxDurationSec: 365 * 86400,
  },
  submission: { uri: [1, 200], note: [0, 280] },
  project: {
    name: [3, 48],
    tagline: [5, 100],
    description: [10, 1000],
    category: [1, 24],
    link: [0, 200],
    update: [3, 280],
  },
  contribution: { title: [3, 80], uri: [1, 200] },
  idea: { title: [3, 80], body: [10, 600], tag: [1, 24] },
  profile: { displayName: [1, 32], bio: [0, 280], skillsNote: [0, 120], link: [0, 200] },
} as const

/** Safety margin so a deadline that is valid when typed is still valid when mined. */
export const DEADLINE_BUFFER_SEC = 600

export function byteLength(value: string): number {
  return new TextEncoder().encode(value).length
}

export function checkText(label: string, value: string, [min, max]: readonly [number, number]): string | null {
  const len = byteLength(value.trim())
  if (len < min) return min === 1 ? `${label} is required.` : `${label} needs at least ${min} characters.`
  if (len > max) return `${label} is too long (max ${max} bytes).`
  return null
}

export function isValidLink(value: string): boolean {
  return /^(https:\/\/|ipfs:\/\/)\S+$/.test(value) && !/\s/.test(value)
}

export function checkLink(label: string, value: string, [min, max]: readonly [number, number]): string | null {
  const trimmed = value.trim()
  if (trimmed.length === 0) return min === 0 ? null : `${label} is required.`
  if (byteLength(trimmed) > max) return `${label} is too long (max ${max} bytes).`
  if (!isValidLink(trimmed)) return `${label} must start with https:// or ipfs://`
  return null
}

function collect<T>(entries: Array<[keyof T, string | null]>): FieldErrors<T> {
  const out: FieldErrors<T> = {}
  for (const [key, err] of entries) if (err) out[key] = err
  return out
}

export interface ChallengeForm {
  title: string
  description: string
  skill: string
  rewardNote: string
  deadline: string
  maxParticipants: string
}

export function parseDeadline(value: string): number | null {
  if (!value) return null
  const ms = new Date(value).getTime()
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null
}

export function validateChallenge(f: ChallengeForm, nowSec = Math.floor(Date.now() / 1000)): FieldErrors<ChallengeForm> {
  const L = LIMITS.challenge
  const deadline = parseDeadline(f.deadline)
  let deadlineErr: string | null = null
  if (deadline === null) deadlineErr = 'Pick a deadline.'
  else if (deadline < nowSec + L.minDurationSec + DEADLINE_BUFFER_SEC) deadlineErr = 'Deadline must be at least 1 hour from now.'
  else if (deadline > nowSec + L.maxDurationSec - DEADLINE_BUFFER_SEC) deadlineErr = 'Deadline must be within 365 days.'
  const n = Number(f.maxParticipants)
  const capErr =
    !/^\d+$/.test(f.maxParticipants.trim()) || n < L.participants[0] || n > L.participants[1]
      ? `Participants must be a whole number from ${L.participants[0]} to ${L.participants[1]}.`
      : null
  return collect<ChallengeForm>([
    ['title', checkText('Title', f.title, L.title)],
    ['description', checkText('Description', f.description, L.description)],
    ['skill', checkText('Skill', f.skill, L.skill)],
    ['rewardNote', checkText('Reward note', f.rewardNote, L.rewardNote)],
    ['deadline', deadlineErr],
    ['maxParticipants', capErr],
  ])
}

export interface SubmissionForm {
  uri: string
  note: string
}
export function validateSubmission(f: SubmissionForm): FieldErrors<SubmissionForm> {
  return collect<SubmissionForm>([
    ['uri', checkLink('Work link', f.uri, LIMITS.submission.uri)],
    ['note', checkText('Note', f.note, LIMITS.submission.note)],
  ])
}

export interface ProjectForm {
  name: string
  tagline: string
  description: string
  category: string
  link: string
}
export function validateProject(f: ProjectForm): FieldErrors<ProjectForm> {
  const L = LIMITS.project
  return collect<ProjectForm>([
    ['name', checkText('Name', f.name, L.name)],
    ['tagline', checkText('Tagline', f.tagline, L.tagline)],
    ['description', checkText('Description', f.description, L.description)],
    ['category', checkText('Category', f.category, L.category)],
    ['link', checkLink('Project link', f.link, L.link)],
  ])
}

export interface ContributionForm {
  title: string
  uri: string
}
export function validateContribution(f: ContributionForm): FieldErrors<ContributionForm> {
  return collect<ContributionForm>([
    ['title', checkText('Title', f.title, LIMITS.contribution.title)],
    ['uri', checkLink('Work link', f.uri, LIMITS.contribution.uri)],
  ])
}

export interface IdeaForm {
  title: string
  body: string
  tag: string
}
export function validateIdea(f: IdeaForm): FieldErrors<IdeaForm> {
  const L = LIMITS.idea
  return collect<IdeaForm>([
    ['title', checkText('Title', f.title, L.title)],
    ['body', checkText('Idea', f.body, L.body)],
    ['tag', checkText('Tag', f.tag, L.tag)],
  ])
}

export interface ProfileForm {
  displayName: string
  bio: string
  skillsNote: string
  link: string
}
export function validateProfile(f: ProfileForm): FieldErrors<ProfileForm> {
  const L = LIMITS.profile
  return collect<ProfileForm>([
    ['displayName', checkText('Display name', f.displayName, L.displayName)],
    ['bio', checkText('Bio', f.bio, L.bio)],
    ['skillsNote', checkText('Skills note', f.skillsNote, L.skillsNote)],
    ['link', checkLink('Link', f.link, L.link)],
  ])
}

export function hasErrors<T>(errors: FieldErrors<T>): boolean {
  return Object.keys(errors).length > 0
}
