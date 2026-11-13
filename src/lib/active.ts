/**
 * The network ORVEX reads from and writes to.
 * Mainnet unless the optional testnet is enabled by env AND chosen in Settings.
 */
import type { Chain, PublicClient } from 'viem'
import { createReadClient } from './rpc'
import { buildAddressExplorerUrl, buildTxExplorerUrl } from '@/onchain-facts'
import { ARC_MAINNET_ID, ARC_MAINNET_RPC, arcMainnet } from '@/networks'
import { ARC_TESTNET_ID, TESTNET_ENABLED, arcTestnetChain } from '@/networks.testnet'
import { deploymentFor } from '@/contracts.config'
import { chooseNetwork } from './networkChoice'

const STORAGE_KEY = 'orvex.network'

function readStored(): string | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function readPreferred(): number {
  return chooseNetwork(TESTNET_ENABLED, readStored()) === 'testnet' ? ARC_TESTNET_ID : ARC_MAINNET_ID
}

export const ACTIVE_CHAIN_ID = readPreferred()
export const IS_MAINNET = ACTIVE_CHAIN_ID === ARC_MAINNET_ID
export const ACTIVE_CHAIN: Chain = IS_MAINNET ? arcMainnet : arcTestnetChain
export const ACTIVE_NETWORK_NAME = ACTIVE_CHAIN.name

const deployment = deploymentFor(ACTIVE_CHAIN_ID)
if (!deployment) throw new Error('No deployment record for the active chain')
export const ACTIVE_DEPLOYMENT = deployment
export const ACTIVE_ADDRESSES = deployment.addresses

export function setPreferredNetwork(kind: 'mainnet' | 'testnet'): void {
  if (!TESTNET_ENABLED) return
  window.localStorage.setItem(STORAGE_KEY, kind)
  window.location.reload()
}

const rpc = IS_MAINNET ? ARC_MAINNET_RPC : (arcTestnetChain.rpcUrls.default.http[0] ?? ARC_MAINNET_RPC)

/** Wallet-independent read client against the official RPC of the active chain. */
export const readClient: PublicClient = createReadClient(ACTIVE_CHAIN, rpc)

export const txUrl = (hash: string) => buildTxExplorerUrl(ACTIVE_CHAIN_ID, hash)
export const addressUrl = (address: string) => buildAddressExplorerUrl(ACTIVE_CHAIN_ID, address)
