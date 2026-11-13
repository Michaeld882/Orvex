/**
 * ORVEX contract deployment configuration.
 *
 * Addresses are NEVER hardcoded. Deploy the contracts yourself (see docs/DEPLOYMENT.md),
 * then put the addresses in `.env` (or your host's environment) under these keys.
 * Until every address for a network is present and valid, the app shows a clear
 * "contracts not configured" state and reads nothing.
 *
 * Mainnet keys:  VITE_ORVEX_MAINNET_IDENTITY, _PROOF, _CHALLENGES, _LAUNCHPAD, _IDEAS, _START_BLOCK
 * Testnet keys:  VITE_ORVEX_TESTNET_*  (only used when VITE_ENABLE_TESTNET=true)
 */
import { isAddress, getAddress, type Address } from 'viem'
import { ARC_MAINNET_ID } from './networks'
import { ARC_TESTNET_ID } from './networks.testnet'

export interface OrvexAddresses {
  identity: Address
  proof: Address
  challenges: Address
  launchpad: Address
  ideas: Address
}

export interface OrvexDeployment {
  chainId: number
  addresses: OrvexAddresses | null
  /** Block the contracts were deployed in. Bounds all event scans. */
  startBlock: bigint | null
  /** Env keys that are missing or invalid, for the setup screen. */
  missing: string[]
}

type Env = Record<string, string | undefined>

const KEYS = ['IDENTITY', 'PROOF', 'CHALLENGES', 'LAUNCHPAD', 'IDEAS'] as const

export function parseDeployment(chainId: number, prefix: string, env: Env): OrvexDeployment {
  const missing: string[] = []
  const found: Partial<Record<(typeof KEYS)[number], Address>> = {}
  for (const key of KEYS) {
    const name = `${prefix}_${key}`
    const raw = env[name]?.trim()
    if (raw && isAddress(raw, { strict: false })) {
      found[key] = getAddress(raw)
    } else {
      missing.push(name)
    }
  }
  const startRaw = env[`${prefix}_START_BLOCK`]?.trim()
  const startBlock = startRaw && /^\d+$/.test(startRaw) ? BigInt(startRaw) : null
  const complete = missing.length === 0
  return {
    chainId,
    startBlock,
    missing,
    addresses: complete
      ? {
          identity: found.IDENTITY as Address,
          proof: found.PROOF as Address,
          challenges: found.CHALLENGES as Address,
          launchpad: found.LAUNCHPAD as Address,
          ideas: found.IDEAS as Address,
        }
      : null,
  }
}

const env = import.meta.env as unknown as Env

export const MAINNET_DEPLOYMENT = parseDeployment(ARC_MAINNET_ID, 'VITE_ORVEX_MAINNET', env)
export const TESTNET_DEPLOYMENT = parseDeployment(ARC_TESTNET_ID, 'VITE_ORVEX_TESTNET', env)

export function deploymentFor(chainId: number): OrvexDeployment | null {
  if (chainId === ARC_MAINNET_ID) return MAINNET_DEPLOYMENT
  if (chainId === ARC_TESTNET_ID) return TESTNET_DEPLOYMENT
  return null
}
