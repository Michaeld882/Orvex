import type { Abi } from 'viem'
import type { OrvexAddresses } from '@/contracts.config'
import {
  orvexChallengesAbi,
  orvexIdeasAbi,
  orvexIdentityAbi,
  orvexLaunchpadAbi,
  orvexProofAbi,
} from './generated'

export * from './generated'

export type ContractKey = keyof OrvexAddresses

export const ABI_BY_KEY: Record<ContractKey, Abi> = {
  identity: orvexIdentityAbi,
  proof: orvexProofAbi,
  challenges: orvexChallengesAbi,
  launchpad: orvexLaunchpadAbi,
  ideas: orvexIdeasAbi,
}

/** All ORVEX events, for decoding logs from any of the five contracts. */
export const ALL_ORVEX_ABI = [
  ...orvexIdentityAbi,
  ...orvexProofAbi,
  ...orvexChallengesAbi,
  ...orvexLaunchpadAbi,
  ...orvexIdeasAbi,
] as const
