/**
 * Read-only access to the ORVEX contracts over the official Arc RPC.
 * Nothing here needs a wallet. All lists are newest-first and paginated; each page costs
 * one count read plus one batched list read.
 */
import type { Address } from 'viem'
import {
  orvexChallengesAbi,
  orvexIdeasAbi,
  orvexIdentityAbi,
  orvexLaunchpadAbi,
  orvexProofAbi,
} from '@/abi/generated'
import { ACTIVE_ADDRESSES, readClient } from '@/lib/active'
import type { OrvexAddresses } from '@/contracts.config'
import { newestFirstWindow, pageCountFor } from '@/lib/format'
import type { Challenge, Idea, Page, ProofRecord, Project, ProjectContribution, ProjectUpdate, Stats, Submission } from '@/lib/types'

export class NotConfiguredError extends Error {
  constructor() {
    super('ORVEX contracts are not configured for this network.')
    this.name = 'NotConfiguredError'
  }
}

export function addrs(): OrvexAddresses {
  if (!ACTIVE_ADDRESSES) throw new NotConfiguredError()
  return ACTIVE_ADDRESSES
}

function toPage<T>(items: readonly T[], total: number, page: number, pageSize: number): Page<T> {
  return { items: [...items].reverse(), total, page, pageSize, pageCount: pageCountFor(total, pageSize) }
}

// ---------- Challenges ----------

export async function fetchChallengesPage(page: number, pageSize: number): Promise<Page<Challenge>> {
  const a = addrs().challenges
  const total = Number(await readClient.readContract({ address: a, abi: orvexChallengesAbi, functionName: 'challengeCount' }))
  const { offset, limit } = newestFirstWindow(total, page, pageSize)
  if (limit === 0) return toPage([], total, page, pageSize)
  const items = await readClient.readContract({
    address: a,
    abi: orvexChallengesAbi,
    functionName: 'listChallenges',
    args: [BigInt(offset), BigInt(limit)],
  })
  return toPage(items, total, page, pageSize)
}

export function fetchChallenge(id: bigint): Promise<Challenge> {
  return readClient.readContract({ address: addrs().challenges, abi: orvexChallengesAbi, functionName: 'getChallenge', args: [id] })
}

export async function fetchChallengesByIds(ids: readonly bigint[]): Promise<Challenge[]> {
  return Promise.all(ids.map(fetchChallenge))
}

export async function fetchUserChallenges(user: Address, kind: 'created' | 'joined', limit = 50): Promise<Challenge[]> {
  const a = addrs().challenges
  const fn = kind === 'created' ? 'createdCount' : 'joinedCount'
  const total = Number(await readClient.readContract({ address: a, abi: orvexChallengesAbi, functionName: fn, args: [user] }))
  const { offset, limit: n } = newestFirstWindow(total, 0, limit)
  if (n === 0) return []
  const ids = await readClient.readContract({
    address: a,
    abi: orvexChallengesAbi,
    functionName: kind === 'created' ? 'listCreatedIds' : 'listJoinedIds',
    args: [user, BigInt(offset), BigInt(n)],
  })
  return (await fetchChallengesByIds([...ids].reverse()))
}

export function fetchSubmission(id: bigint, user: Address): Promise<Submission> {
  return readClient.readContract({ address: addrs().challenges, abi: orvexChallengesAbi, functionName: 'getSubmission', args: [id, user] })
}

export function fetchIsParticipant(id: bigint, user: Address): Promise<boolean> {
  return readClient.readContract({ address: addrs().challenges, abi: orvexChallengesAbi, functionName: 'isParticipant', args: [id, user] })
}

export interface SubmissionRow {
  participant: Address
  submission: Submission
}

export const REVIEW_PAGE_SIZE = 20

export async function fetchChallengeSubmissions(id: bigint, participants: number, page: number): Promise<SubmissionRow[]> {
  const offset = page * REVIEW_PAGE_SIZE
  if (participants === 0 || offset >= participants) return []
  const users = await readClient.readContract({
    address: addrs().challenges,
    abi: orvexChallengesAbi,
    functionName: 'listParticipants',
    args: [id, BigInt(offset), BigInt(Math.min(REVIEW_PAGE_SIZE, participants - offset))],
  })
  const subs = await Promise.all(users.map((u) => fetchSubmission(id, u)))
  return users.map((participant, i) => ({ participant, submission: subs[i] }))
}

// ---------- Launchpad ----------

export async function fetchProjectsPage(page: number, pageSize: number): Promise<Page<Project>> {
  const a = addrs().launchpad
  const total = Number(await readClient.readContract({ address: a, abi: orvexLaunchpadAbi, functionName: 'projectCount' }))
  const { offset, limit } = newestFirstWindow(total, page, pageSize)
  if (limit === 0) return toPage([], total, page, pageSize)
  const items = await readClient.readContract({
    address: a,
    abi: orvexLaunchpadAbi,
    functionName: 'listProjects',
    args: [BigInt(offset), BigInt(limit)],
  })
  return toPage(items, total, page, pageSize)
}

export function fetchProject(id: bigint): Promise<Project> {
  return readClient.readContract({ address: addrs().launchpad, abi: orvexLaunchpadAbi, functionName: 'getProject', args: [id] })
}

export async function fetchProjectContributions(projectId: bigint, total: number, page: number): Promise<ProjectContribution[]> {
  const { offset, limit } = newestFirstWindow(total, page, REVIEW_PAGE_SIZE)
  if (limit === 0) return []
  const ids = await readClient.readContract({
    address: addrs().launchpad,
    abi: orvexLaunchpadAbi,
    functionName: 'listProjectContributionIds',
    args: [projectId, BigInt(offset), BigInt(limit)],
  })
  const items = await Promise.all(
    ids.map((id) => readClient.readContract({ address: addrs().launchpad, abi: orvexLaunchpadAbi, functionName: 'getContribution', args: [id] })),
  )
  return items.reverse()
}

export async function fetchProjectUpdates(projectId: bigint, total: number, page: number): Promise<ProjectUpdate[]> {
  const { offset, limit } = newestFirstWindow(total, page, REVIEW_PAGE_SIZE)
  if (limit === 0) return []
  const items = await readClient.readContract({
    address: addrs().launchpad,
    abi: orvexLaunchpadAbi,
    functionName: 'listUpdates',
    args: [projectId, BigInt(offset), BigInt(limit)],
  })
  return [...items].reverse()
}

export async function fetchOwnedProjects(user: Address): Promise<Project[]> {
  const a = addrs().launchpad
  const total = Number(await readClient.readContract({ address: a, abi: orvexLaunchpadAbi, functionName: 'ownedCount', args: [user] }))
  const { offset, limit } = newestFirstWindow(total, 0, 50)
  if (limit === 0) return []
  const ids = await readClient.readContract({
    address: a,
    abi: orvexLaunchpadAbi,
    functionName: 'listOwnedIds',
    args: [user, BigInt(offset), BigInt(limit)],
  })
  return (await Promise.all([...ids].reverse().map(fetchProject)))
}

// ---------- Ideas ----------

export async function fetchIdeasPage(page: number, pageSize: number): Promise<Page<Idea>> {
  const a = addrs().ideas
  const total = Number(await readClient.readContract({ address: a, abi: orvexIdeasAbi, functionName: 'ideaCount' }))
  const { offset, limit } = newestFirstWindow(total, page, pageSize)
  if (limit === 0) return toPage([], total, page, pageSize)
  const items = await readClient.readContract({
    address: a,
    abi: orvexIdeasAbi,
    functionName: 'listIdeas',
    args: [BigInt(offset), BigInt(limit)],
  })
  return toPage(items, total, page, pageSize)
}

export async function fetchEndorsed(ids: readonly bigint[], user: Address): Promise<Set<string>> {
  const flags = await Promise.all(
    ids.map((id) => readClient.readContract({ address: addrs().ideas, abi: orvexIdeasAbi, functionName: 'hasEndorsed', args: [id, user] })),
  )
  return new Set(ids.filter((_, i) => flags[i]).map((id) => id.toString()))
}

// ---------- Proof ----------

export async function fetchProofPage(page: number, pageSize: number): Promise<Page<ProofRecord>> {
  const a = addrs().proof
  const total = Number(await readClient.readContract({ address: a, abi: orvexProofAbi, functionName: 'contributionCount' }))
  const { offset, limit } = newestFirstWindow(total, page, pageSize)
  if (limit === 0) return toPage([], total, page, pageSize)
  const items = await readClient.readContract({
    address: a,
    abi: orvexProofAbi,
    functionName: 'listContributions',
    args: [BigInt(offset), BigInt(limit)],
  })
  return toPage(items, total, page, pageSize)
}

export function fetchProofRecord(id: bigint): Promise<ProofRecord> {
  return readClient.readContract({ address: addrs().proof, abi: orvexProofAbi, functionName: 'getContribution', args: [id] })
}

export async function fetchUserProofs(user: Address, limit = 50): Promise<ProofRecord[]> {
  const a = addrs().proof
  const total = Number(await readClient.readContract({ address: a, abi: orvexProofAbi, functionName: 'userContributionCount', args: [user] }))
  const { offset, limit: n } = newestFirstWindow(total, 0, limit)
  if (n === 0) return []
  const ids = await readClient.readContract({
    address: a,
    abi: orvexProofAbi,
    functionName: 'listUserContributionIds',
    args: [user, BigInt(offset), BigInt(n)],
  })
  return (await Promise.all([...ids].reverse().map(fetchProofRecord)))
}

// ---------- Identity ----------

export interface ProfileBundle {
  address: Address
  profile: Awaited<ReturnType<typeof readProfile>>
  stats: Stats
  skills: { name: string; count: number }[]
  achievementMask: bigint
  proofCount: number
  level: number
}

function readProfile(user: Address) {
  return readClient.readContract({ address: addrs().identity, abi: orvexIdentityAbi, functionName: 'getProfile', args: [user] })
}

export async function fetchProfileBundle(user: Address): Promise<ProfileBundle> {
  const { identity, proof } = addrs()
  const [profile, stats, skills, mask, proofCount, level] = await Promise.all([
    readProfile(user),
    readClient.readContract({ address: identity, abi: orvexIdentityAbi, functionName: 'statsOf', args: [user] }),
    readClient.readContract({ address: identity, abi: orvexIdentityAbi, functionName: 'getSkills', args: [user] }),
    readClient.readContract({ address: proof, abi: orvexProofAbi, functionName: 'achievementsOf', args: [user] }),
    readClient.readContract({ address: proof, abi: orvexProofAbi, functionName: 'userContributionCount', args: [user] }),
    readClient.readContract({ address: identity, abi: orvexIdentityAbi, functionName: 'levelOfUser', args: [user] }),
  ])
  const [names, counts] = skills
  return {
    address: user,
    profile,
    stats,
    skills: names.map((name, i) => ({ name, count: counts[i] ?? 0 })),
    achievementMask: mask,
    proofCount: Number(proofCount),
    level,
  }
}

export interface LeaderRow {
  user: Address
  stats: Stats
}

export interface Leaderboard {
  rows: LeaderRow[]
  totalParticipants: number
  truncated: boolean
}

const LEADERBOARD_CAP = 500

export async function fetchLeaderboard(): Promise<Leaderboard> {
  const a = addrs().identity
  const total = Number(await readClient.readContract({ address: a, abi: orvexIdentityAbi, functionName: 'participantCount' }))
  const fetchCount = Math.min(total, LEADERBOARD_CAP)
  const calls: Promise<readonly [readonly Address[], readonly Stats[]]>[] = []
  for (let offset = 0; offset < fetchCount; offset += 50) {
    calls.push(
      readClient.readContract({
        address: a,
        abi: orvexIdentityAbi,
        functionName: 'listParticipantStats',
        args: [BigInt(offset), BigInt(Math.min(50, fetchCount - offset))],
      }),
    )
  }
  const pages = await Promise.all(calls)
  const rows: LeaderRow[] = []
  for (const [users, stats] of pages) users.forEach((user, i) => rows.push({ user, stats: stats[i] }))
  rows.sort((x, y) => y.stats.points - x.stats.points || y.stats.challengesCompleted - x.stats.challengesCompleted)
  return { rows, totalParticipants: total, truncated: total > fetchCount }
}

export interface PlatformStats {
  challenges: number
  projects: number
  ideas: number
  proofs: number
  participants: number
}

export async function fetchPlatformStats(): Promise<PlatformStats> {
  const a = addrs()
  const [challenges, projects, ideas, proofs, participants] = await Promise.all([
    readClient.readContract({ address: a.challenges, abi: orvexChallengesAbi, functionName: 'challengeCount' }),
    readClient.readContract({ address: a.launchpad, abi: orvexLaunchpadAbi, functionName: 'projectCount' }),
    readClient.readContract({ address: a.ideas, abi: orvexIdeasAbi, functionName: 'ideaCount' }),
    readClient.readContract({ address: a.proof, abi: orvexProofAbi, functionName: 'contributionCount' }),
    readClient.readContract({ address: a.identity, abi: orvexIdentityAbi, functionName: 'participantCount' }),
  ])
  return {
    challenges: Number(challenges),
    projects: Number(projects),
    ideas: Number(ideas),
    proofs: Number(proofs),
    participants: Number(participants),
  }
}

export function verifyRecordOnchain(id: bigint, digest: `0x${string}`): Promise<boolean> {
  return readClient.readContract({ address: addrs().proof, abi: orvexProofAbi, functionName: 'verifyRecord', args: [id, digest] })
}

export function fetchEligibility(user: Address): Promise<boolean[]> {
  const proof = addrs().proof
  return Promise.all(
    [0, 1, 2, 3, 4, 5].map((id) =>
      readClient.readContract({ address: proof, abi: orvexProofAbi, functionName: 'isEligible', args: [user, id] }),
    ),
  )
}
