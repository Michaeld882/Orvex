/**
 * wagmi configuration for ORVEX.
 * Production chain: Arc Mainnet only. Arc Testnet is registered solely when
 * VITE_ENABLE_TESTNET=true. Ethereum Mainnet is intentionally not configured.
 * Built with Arc Studio — https://studio.arc.io
 */

import { http, createConfig } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { arcMainnet, ARC_MAINNET_RPC } from './networks'
import { arcTestnetChain, TESTNET_ENABLED } from './networks.testnet'
import { registerChain } from './tracing'

registerChain(arcMainnet.id, ARC_MAINNET_RPC)
if (TESTNET_ENABLED) registerChain(arcTestnetChain.id, arcTestnetChain.rpcUrls.default.http[0] ?? '')

const transportOptions = { batch: true, retryCount: 2, timeout: 15_000 } as const

export const config = TESTNET_ENABLED
  ? createConfig({
      chains: [arcMainnet, arcTestnetChain],
      connectors: [injected()],
      transports: {
        [arcMainnet.id]: http(ARC_MAINNET_RPC, transportOptions),
        [arcTestnetChain.id]: http(arcTestnetChain.rpcUrls.default.http[0], transportOptions),
      },
    })
  : createConfig({
      chains: [arcMainnet],
      connectors: [injected()],
      transports: {
        [arcMainnet.id]: http(ARC_MAINNET_RPC, transportOptions),
      },
    })
