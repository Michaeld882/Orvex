/**
 * Event history for the ORVEX contracts.
 * Scans backwards from the chain head in bounded chunks, never from block 0, and stops at
 * the configured deployment block (or a bounded lookback when none is configured).
 */
import { isAddress, parseEventLogs, type Address, type Hex } from 'viem'
import { ALL_ORVEX_ABI } from '@/abi'
import { ACTIVE_DEPLOYMENT, readClient } from '@/lib/active'
import { addrs } from './reads'

export const DEFAULT_LOOKBACK = 100_000n
const START_CHUNK = 10_000n

export interface ActivityItem {
  key: string
  name: string
  text: string
  actors: Address[]
  blockNumber: bigint
  logIndex: number
  txHash: Hex
  /** In-app route related to the event, when there is one. */
  route?: string
}

export interface ActivityPage {
  items: ActivityItem[]
  /** Highest block still to scan, or null when the scan has reached its floor. */
  nextTo: bigint | null
  head: bigint
  floor: bigint
}

type Args = Record<string, unknown>

const STAGES = ['Idea', 'Building', 'Beta', 'Live', 'Paused', 'Archived']
const num = (v: unknown) => (typeof v === 'bigint' || typeof v === 'number' ? String(v) : '?')

/** Returns null for events that are bookkeeping, not user-facing activity. */
export function describeEvent(name: string, a: Args): { text: string; route?: string } | null {
  switch (name) {
    case 'ChallengeCreated':
      return { text: `Created challenge "${String(a.title)}"`, route: `/app/arena/${num(a.id)}` }
    case 'ChallengeJoined':
      return { text: `Joined challenge #${num(a.id)}`, route: `/app/arena/${num(a.id)}` }
    case 'WorkSubmitted':
      return { text: `Submitted work to challenge #${num(a.id)} (attempt ${num(a.attempt)})`, route: `/app/arena/${num(a.id)}` }
    case 'SubmissionReviewed':
      return {
        text: `${a.approved ? 'Approved' : 'Rejected'} work on challenge #${num(a.id)}`,
        route: `/app/arena/${num(a.id)}`,
      }
    case 'ChallengeClosed':
      return { text: `Closed challenge #${num(a.id)}`, route: `/app/arena/${num(a.id)}` }
    case 'ChallengeCancelled':
      return { text: `Cancelled challenge #${num(a.id)}`, route: `/app/arena/${num(a.id)}` }
    case 'ProjectProposed':
      return { text: `Proposed project "${String(a.name)}"`, route: `/app/launchpad/${num(a.id)}` }
    case 'StageChanged':
      return { text: `Moved project #${num(a.id)} to ${STAGES[Number(a.stage)] ?? 'a new stage'}`, route: `/app/launchpad/${num(a.id)}` }
    case 'ProjectUpdated':
      return { text: `Posted an update on project #${num(a.id)}`, route: `/app/launchpad/${num(a.id)}` }
    case 'ContributionSubmitted':
      return { text: `Submitted a contribution to project #${num(a.projectId)}`, route: `/app/launchpad/${num(a.projectId)}` }
    case 'ContributionReviewed':
      return {
        text: `${a.accepted ? 'Accepted' : 'Declined'} a contribution on project #${num(a.projectId)}`,
        route: `/app/launchpad/${num(a.projectId)}`,
      }
    case 'IdeaPosted':
      return { text: `Shared idea "${String(a.title)}"`, route: '/app/board' }
    case 'IdeaEndorsed':
      return { text: `Endorsed idea #${num(a.id)}`, route: '/app/board' }
    case 'IdeaRetracted':
      return { text: `Retracted idea #${num(a.id)}`, route: '/app/board' }
    case 'ProfileUpdated':
      return { text: 'Updated their Skill Passport profile', route: '/app/profile' }
    case 'ContributionRecorded':
      return { text: `Proof #${num(a.id)} recorded onchain`, route: '/app/proof' }
    case 'AchievementClaimed':
      return { text: `Claimed achievement #${num(a.id)}`, route: '/app/proof' }
    default:
      return null
  }
}

function collectActors(args: Args): Address[] {
  const out: Address[] = []
  for (const v of Object.values(args)) {
    if (typeof v === 'string' && isAddress(v, { strict: false })) out.push(v)
  }
  return out
}

async function scanChunk(from: bigint, to: bigint): Promise<ActivityItem[]> {
  const a = addrs()
  const logs = await readClient.getLogs({
    address: [a.identity, a.proof, a.challenges, a.launchpad, a.ideas],
    fromBlock: from,
    toBlock: to,
  })
  const parsed = parseEventLogs({ abi: ALL_ORVEX_ABI, logs, strict: false })
  const items: ActivityItem[] = []
  for (const log of parsed) {
    if (log.blockNumber === null || log.transactionHash === null || log.logIndex === null) continue
    const args = (log.args ?? {}) as Args
    const described = describeEvent(log.eventName, args)
    if (!described) continue
    items.push({
      key: `${log.transactionHash}-${log.logIndex}`,
      name: log.eventName,
      text: described.text,
      route: described.route,
      actors: collectActors(args),
      blockNumber: log.blockNumber,
      logIndex: log.logIndex,
      txHash: log.transactionHash,
    })
  }
  return items
}

export function activityFloor(head: bigint): bigint {
  const start = ACTIVE_DEPLOYMENT.startBlock
  if (start !== null) return start
  return head > DEFAULT_LOOKBACK ? head - DEFAULT_LOOKBACK : 0n
}

export async function scanActivity(opts: {
  cursor: bigint | null
  want: number
  maxChunks: number
}): Promise<ActivityPage> {
  const head = await readClient.getBlockNumber()
  const floor = activityFloor(head)
  let to = opts.cursor ?? head
  let chunk = START_CHUNK
  const items: ActivityItem[] = []
  let chunks = 0
  while (to >= floor && chunks < opts.maxChunks && items.length < opts.want) {
    const from = to - chunk + 1n > floor ? to - chunk + 1n : floor
    try {
      items.push(...(await scanChunk(from, to)))
    } catch (error) {
      if (chunk <= 500n) throw error
      chunk /= 2n
      continue
    }
    chunks += 1
    to = from - 1n
  }
  items.sort((x, y) => (x.blockNumber === y.blockNumber ? y.logIndex - x.logIndex : Number(y.blockNumber - x.blockNumber)))
  return { items, nextTo: to >= floor ? to : null, head, floor }
}
