/**
 * Optional Arc Testnet configuration for development only.
 *
 * Completely separate from `./networks.ts`. The app only registers this chain when
 * `VITE_ENABLE_TESTNET=true`; production builds leave it unset and never see it.
 */
import { defineChain } from 'viem'
import { requireChain } from '@/onchain-facts'

export const ARC_TESTNET_ID = 5042002 as const

const facts = requireChain(ARC_TESTNET_ID)

export const arcTestnetChain = defineChain({
  id: ARC_TESTNET_ID,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USD Coin', symbol: 'USDC', decimals: facts.nativeCurrency.decimals },
  rpcUrls: { default: { http: [...facts.rpcUrls] } },
  blockExplorers: { default: { name: 'Arc Testnet Explorer', url: facts.explorerBase } },
  testnet: true,
})

export const TESTNET_ENABLED = import.meta.env.VITE_ENABLE_TESTNET === 'true'
