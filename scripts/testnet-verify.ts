/**
 * Reads the configured ORVEX Arc Testnet deployment through the app's own read services and prints a summary.
 * Usage: bun run scripts/testnet-verify.ts   (needs VITE_ENABLE_TESTNET=true and VITE_ORVEX_TESTNET_* in .env)
 */
import { ACTIVE_CHAIN_ID, ACTIVE_ADDRESSES } from '@/lib/active'
import { computeDigest } from '@/lib/digest'
import { scanActivity } from '@/services/activity'
import {
  fetchChallenge,
  fetchChallengeSubmissions,
  fetchChallengesPage,
  fetchEligibility,
  fetchIdeasPage,
  fetchLeaderboard,
  fetchPlatformStats,
  fetchProfileBundle,
  fetchProjectsPage,
  fetchProofPage,
  fetchProofRecord,
  verifyRecordOnchain,
} from '@/services/reads'

if (!ACTIVE_ADDRESSES) throw new Error('Contracts are not configured for the active network')
console.log('active chain', ACTIVE_CHAIN_ID)

const stats = await fetchPlatformStats()
console.log('platform stats', stats)

const challenges = await fetchChallengesPage(0, 12)
console.log('challenges', challenges.total, challenges.items.map((c) => `#${c.id} ${c.title} [${c.participants}/${c.maxParticipants}, approved ${c.approved}]`))
const one = await fetchChallenge(1n)
console.log('challenge 1 creator', one.creator)
const subs = await fetchChallengeSubmissions(1n, one.participants, 0)
console.log('submissions', subs.map((s) => `${s.participant} status ${s.submission.status}`))

const projects = await fetchProjectsPage(0, 12)
console.log('projects', projects.total, projects.items.map((p) => `#${p.id} ${p.name} accepted ${p.accepted}`))
const ideas = await fetchIdeasPage(0, 10)
console.log('ideas', ideas.total, ideas.items.map((i) => `#${i.id} ${i.title} endorsements ${i.endorsements}`))

const proofs = await fetchProofPage(0, 12)
console.log('proofs', proofs.total, proofs.items.map((p) => `#${p.id} ${p.title}`))
const rec = await fetchProofRecord(1n)
const local = computeDigest(rec, ACTIVE_CHAIN_ID, ACTIVE_ADDRESSES.proof)
console.log('proof 1 digest matches stored:', local === rec.digest, 'verifyRecord:', await verifyRecordOnchain(1n, local))

const board = await fetchLeaderboard()
console.log('leaderboard', board.rows.map((r) => `${r.user} pts ${r.stats.points} completed ${r.stats.challengesCompleted} accepted ${r.stats.contributionsAccepted}`))

const p2 = '0xa76f62C4A542Eced441c4359868799E6d1C077bD'
const profile = await fetchProfileBundle(p2)
console.log('participant profile', { points: profile.stats.points, level: profile.level, skills: profile.skills, mask: profile.achievementMask.toString(), proofs: profile.proofCount })
console.log('eligibility', await fetchEligibility(p2))
const seed = await fetchProfileBundle('0x3A28d8a55f2541e93Ef508506395Dc43C513C354')
console.log('creator profile', seed.profile.displayName, seed.stats)

const activity = await scanActivity({ cursor: null, want: 50, maxChunks: 12 })
console.log('activity', activity.items.length, 'floor', activity.floor.toString(), 'head', activity.head.toString(), 'nextTo', activity.nextTo?.toString() ?? 'done')
console.log(activity.items.slice(0, 6).map((i) => i.text))
