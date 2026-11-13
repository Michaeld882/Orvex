import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import type { Address } from 'viem'
import { ACTIVE_ADDRESSES, ACTIVE_CHAIN_ID } from '@/lib/active'
import { scanActivity, type ActivityItem } from '@/services/activity'
import {
  fetchChallenge,
  fetchChallengesPage,
  fetchChallengeSubmissions,
  fetchEligibility,
  fetchEndorsed,
  fetchIdeasPage,
  fetchIsParticipant,
  fetchLeaderboard,
  fetchOwnedProjects,
  fetchPlatformStats,
  fetchProfileBundle,
  fetchProject,
  fetchProjectContributions,
  fetchProjectUpdates,
  fetchProjectsPage,
  fetchProofPage,
  fetchProofRecord,
  fetchSubmission,
  fetchUserChallenges,
  fetchUserProofs,
} from '@/services/reads'

export const ORVEX_KEY = ['orvex', ACTIVE_CHAIN_ID] as const
const key = (...parts: unknown[]) => [...ORVEX_KEY, ...parts]
const on = ACTIVE_ADDRESSES !== null

/** True when all five contract addresses for the active network are configured. */
export const contractsConfigured = on

const common = { enabled: on, staleTime: 20_000, refetchOnWindowFocus: false, retry: 1 } as const

export const useChallengesPage = (page: number, size: number) =>
  useQuery({ ...common, queryKey: key('challenges', page, size), queryFn: () => fetchChallengesPage(page, size) })

export const useChallenge = (id: bigint | null) =>
  useQuery({ ...common, enabled: on && id !== null, queryKey: key('challenge', String(id)), queryFn: () => fetchChallenge(id as bigint) })

export const useMyChallenges = (user: Address | undefined, kind: 'created' | 'joined') =>
  useQuery({ ...common, enabled: on && !!user, queryKey: key('my-challenges', kind, user), queryFn: () => fetchUserChallenges(user as Address, kind) })

export const useIsParticipant = (id: bigint | null, user: Address | undefined) =>
  useQuery({
    ...common,
    enabled: on && id !== null && !!user,
    queryKey: key('participant', String(id), user),
    queryFn: () => fetchIsParticipant(id as bigint, user as Address),
  })

export const useMySubmission = (id: bigint | null, user: Address | undefined) =>
  useQuery({
    ...common,
    enabled: on && id !== null && !!user,
    queryKey: key('submission', String(id), user),
    queryFn: () => fetchSubmission(id as bigint, user as Address),
  })

export const useChallengeSubmissions = (id: bigint | null, participants: number, page: number, enabled: boolean) =>
  useQuery({
    ...common,
    enabled: on && enabled && id !== null,
    queryKey: key('submissions', String(id), participants, page),
    queryFn: () => fetchChallengeSubmissions(id as bigint, participants, page),
  })

export const useProjectsPage = (page: number, size: number) =>
  useQuery({ ...common, queryKey: key('projects', page, size), queryFn: () => fetchProjectsPage(page, size) })

export const useProject = (id: bigint | null) =>
  useQuery({ ...common, enabled: on && id !== null, queryKey: key('project', String(id)), queryFn: () => fetchProject(id as bigint) })

export const useProjectContributions = (id: bigint | null, total: number, page: number) =>
  useQuery({
    ...common,
    enabled: on && id !== null,
    queryKey: key('project-contribs', String(id), total, page),
    queryFn: () => fetchProjectContributions(id as bigint, total, page),
  })

export const useProjectUpdates = (id: bigint | null, total: number, page: number) =>
  useQuery({
    ...common,
    enabled: on && id !== null,
    queryKey: key('project-updates', String(id), total, page),
    queryFn: () => fetchProjectUpdates(id as bigint, total, page),
  })

export const useOwnedProjects = (user: Address | undefined) =>
  useQuery({ ...common, enabled: on && !!user, queryKey: key('owned-projects', user), queryFn: () => fetchOwnedProjects(user as Address) })

export const useIdeasPage = (page: number, size: number) =>
  useQuery({ ...common, queryKey: key('ideas', page, size), queryFn: () => fetchIdeasPage(page, size) })

export const useEndorsed = (ids: readonly bigint[], user: Address | undefined) =>
  useQuery({
    ...common,
    enabled: on && !!user && ids.length > 0,
    queryKey: key('endorsed', user, ids.map(String).join(',')),
    queryFn: () => fetchEndorsed(ids, user as Address),
  })

export const useProofPage = (page: number, size: number) =>
  useQuery({ ...common, queryKey: key('proofs', page, size), queryFn: () => fetchProofPage(page, size) })

export const useProofRecord = (id: bigint | null) =>
  useQuery({ ...common, enabled: on && id !== null, queryKey: key('proof', String(id)), queryFn: () => fetchProofRecord(id as bigint), retry: 0 })

export const useUserProofs = (user: Address | undefined) =>
  useQuery({ ...common, enabled: on && !!user, queryKey: key('user-proofs', user), queryFn: () => fetchUserProofs(user as Address) })

export const useProfile = (user: Address | undefined) =>
  useQuery({ ...common, enabled: on && !!user, queryKey: key('profile', user), queryFn: () => fetchProfileBundle(user as Address) })

export const useEligibility = (user: Address | undefined) =>
  useQuery({ ...common, enabled: on && !!user, queryKey: key('eligibility', user), queryFn: () => fetchEligibility(user as Address) })

export const useLeaderboard = () => useQuery({ ...common, queryKey: key('leaderboard'), queryFn: fetchLeaderboard })

export const usePlatformStats = () => useQuery({ ...common, queryKey: key('stats'), queryFn: fetchPlatformStats })

/** Backwards-paged event history. Pass `user` to keep only events involving that address. */
export function useActivity(user?: Address) {
  const query = useInfiniteQuery({
    enabled: on,
    queryKey: key('activity'),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: 1,
    initialPageParam: null as bigint | null,
    queryFn: ({ pageParam }) => scanActivity({ cursor: pageParam, want: 20, maxChunks: 12 }),
    getNextPageParam: (last) => last.nextTo ?? undefined,
  })
  const all: ActivityItem[] = (query.data?.pages ?? []).flatMap((p) => p.items)
  const lower = user?.toLowerCase()
  const items = lower ? all.filter((i) => i.actors.some((a) => a.toLowerCase() === lower)) : all
  const lastPage = query.data?.pages[query.data.pages.length - 1]
  return { ...query, items, floor: lastPage?.floor, head: lastPage?.head, oldestScanned: lastPage?.nextTo ?? lastPage?.floor }
}
