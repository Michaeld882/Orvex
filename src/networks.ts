/**
 * ORVEX production network: Arc Mainnet.
 *
 * Every value comes from the generated `@/onchain-facts` registry and is asserted
 * against the specification constants below at module load, so a registry drift can
 * never silently point the app at a different chain.
 *
 * Arc Testnet lives in `./networks.testnet.ts` and is never imported from here.
 */
import { defineChain } from 'viem'
import { requireChain } from '@/onchain-facts'

export const ARC_MAINNET_ID = 5042 as const
export const ARC_MAINNET_HEX_ID = '0x13B2' as const
export const ARC_MAINNET_RPC = 'https://rpc.mainnet.arc.io' as const
export const ARC_MAINNET_EXPLORER = 'https://explorer.arc.io' as const

const facts = requireChain(ARC_MAINNET_ID)

if (
  facts.isTestnet ||
  facts.explorerBase !== ARC_MAINNET_EXPLORER ||
  !facts.rpcUrls.includes(ARC_MAINNET_RPC) ||
  !facts.nativeCurrency.isUsdc ||
  `0x${ARC_MAINNET_ID.toString(16).toUpperCase()}` !== ARC_MAINNET_HEX_ID
) {
  throw new Error('Arc Mainnet registry entry does not match the ORVEX configuration')
}

/** Arc Mainnet. Native gas is USDC (18 decimals in the native view). */
export const arcMainnet = defineChain({
  id: ARC_MAINNET_ID,
  name: 'Arc Mainnet',
  nativeCurrency: { name: 'USD Coin', symbol: 'USDC', decimals: facts.nativeCurrency.decimals },
  rpcUrls: { default: { http: [ARC_MAINNET_RPC] } },
  blockExplorers: { default: { name: 'Arc Explorer', url: ARC_MAINNET_EXPLORER } },
})

export function explorerTx(hash: string): string {
  return `${ARC_MAINNET_EXPLORER}/tx/${hash}`
}

export function explorerAddress(address: string): string {
  return `${ARC_MAINNET_EXPLORER}/address/${address}`
}
