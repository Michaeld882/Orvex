import type { ContractFunctionReturnType } from 'viem'
import type {
  orvexChallengesAbi,
  orvexIdeasAbi,
  orvexIdentityAbi,
  orvexLaunchpadAbi,
  orvexProofAbi,
} from '@/abi/generated'

export type Challenge = ContractFunctionReturnType<typeof orvexChallengesAbi, 'view', 'getChallenge'>
export type Submission = ContractFunctionReturnType<typeof orvexChallengesAbi, 'view', 'getSubmission'>
export type Project = ContractFunctionReturnType<typeof orvexLaunchpadAbi, 'view', 'getProject'>
export type ProjectContribution = ContractFunctionReturnType<typeof orvexLaunchpadAbi, 'view', 'getContribution'>
export type ProjectUpdate = ContractFunctionReturnType<typeof orvexLaunchpadAbi, 'view', 'listUpdates'>[number]
export type Idea = ContractFunctionReturnType<typeof orvexIdeasAbi, 'view', 'getIdea'>
export type ProofRecord = ContractFunctionReturnType<typeof orvexProofAbi, 'view', 'getContribution'>
export type Profile = ContractFunctionReturnType<typeof orvexIdentityAbi, 'view', 'getProfile'>
export type Stats = ContractFunctionReturnType<typeof orvexIdentityAbi, 'view', 'statsOf'>

export interface Page<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export const CHALLENGE_STATUS = ['Open', 'Closed', 'Cancelled'] as const
export const SUBMISSION_STATUS = ['None', 'Pending', 'Approved', 'Rejected'] as const
export const PROJECT_STAGES = ['Idea', 'Building', 'Beta', 'Live', 'Paused', 'Archived'] as const
export const REVIEW_STATUS = ['Pending', 'Accepted', 'Rejected', 'Withdrawn'] as const
export const PROOF_SOURCE = ['Challenge', 'Project'] as const

export type EffectiveChallengeStatus = 'Open' | 'Closed' | 'Cancelled' | 'Expired'

export function effectiveStatus(c: Pick<Challenge, 'status' | 'deadline'>, nowSec = Math.floor(Date.now() / 1000)): EffectiveChallengeStatus {
  if (c.status === 2) return 'Cancelled'
  if (c.status === 1) return 'Closed'
  return nowSec >= Number(c.deadline) ? 'Expired' : 'Open'
}

export interface AchievementDef {
  id: number
  name: string
  description: string
}

/** Mirrors OrvexProof's six fixed achievements. */
export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 0, name: 'First Proof', description: 'Have one contribution recorded onchain.' },
  { id: 1, name: 'Challenger', description: 'Complete one challenge, approved by its creator.' },
  { id: 2, name: 'Builder', description: 'Complete five challenges.' },
  { id: 3, name: 'Organizer', description: 'Create a challenge.' },
  { id: 4, name: 'Visionary', description: 'Propose a project or post an idea.' },
  { id: 5, name: 'Luminary', description: 'Reach 500 reputation points.' },
]

export const LEVEL_THRESHOLDS = [0, 50, 150, 400, 1000] as const

export function levelFor(points: number): number {
  let level = 1
  LEVEL_THRESHOLDS.forEach((min, i) => {
    if (points >= min) level = i + 1
  })
  return level
}

export function nextLevelAt(points: number): number | null {
  const next = LEVEL_THRESHOLDS.find((min) => min > points)
  return next ?? null
}

/** Local mirror of the eligibility rules, used only to render progress. The contract decides. */
export function achievementProgress(id: number, stats: Stats, proofCount: number): { current: number; target: number } {
  switch (id) {
    case 0:
      return { current: proofCount, target: 1 }
    case 1:
      return { current: stats.challengesCompleted, target: 1 }
    case 2:
      return { current: stats.challengesCompleted, target: 5 }
    case 3:
      return { current: stats.challengesCreated, target: 1 }
    case 4:
      return { current: stats.projectsProposed + stats.ideasPosted, target: 1 }
    default:
      return { current: stats.points, target: 500 }
  }
}
