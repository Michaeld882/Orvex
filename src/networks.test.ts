import { describe, expect, it } from 'vitest'
import { ARC_MAINNET_EXPLORER, ARC_MAINNET_HEX_ID, ARC_MAINNET_ID, ARC_MAINNET_RPC, arcMainnet } from './networks'
import { ARC_TESTNET_ID, TESTNET_ENABLED, arcTestnetChain } from './networks.testnet'
import { ACTIVE_CHAIN_ID, IS_MAINNET } from './lib/active'

describe('Arc Mainnet configuration', () => {
  it('matches the official network parameters', () => {
    expect(arcMainnet.id).toBe(5042)
    expect(ARC_MAINNET_ID).toBe(5042)
    expect(ARC_MAINNET_HEX_ID).toBe('0x13B2')
    expect(`0x${arcMainnet.id.toString(16).toUpperCase()}`).toBe(ARC_MAINNET_HEX_ID)
    expect(ARC_MAINNET_RPC).toBe('https://rpc.mainnet.arc.io')
    expect(arcMainnet.rpcUrls.default.http).toEqual(['https://rpc.mainnet.arc.io'])
    expect(ARC_MAINNET_EXPLORER).toBe('https://explorer.arc.io')
    expect(arcMainnet.blockExplorers.default.url).toBe('https://explorer.arc.io')
    expect(arcMainnet.nativeCurrency.symbol).toBe('USDC')
  })

  it('keeps testnet separate and off by default', () => {
    expect(ARC_TESTNET_ID).toBe(5042002)
    expect(arcTestnetChain.id).not.toBe(arcMainnet.id)
    expect(TESTNET_ENABLED).toBe(false)
  })

  it('uses Arc Mainnet as the production network', () => {
    expect(ACTIVE_CHAIN_ID).toBe(5042)
    expect(IS_MAINNET).toBe(true)
  })
})
