import { describe, expect, it } from 'vitest'
import { chooseNetwork } from './networkChoice'

describe('chooseNetwork', () => {
  it('is always mainnet when testnet is disabled', () => {
    expect(chooseNetwork(false, null)).toBe('mainnet')
    expect(chooseNetwork(false, 'testnet')).toBe('mainnet')
  })
  it('defaults to testnet when enabled', () => {
    expect(chooseNetwork(true, null)).toBe('testnet')
    expect(chooseNetwork(true, 'testnet')).toBe('testnet')
    expect(chooseNetwork(true, 'garbage')).toBe('testnet')
  })
  it('honours an explicit mainnet choice when testnet is enabled', () => {
    expect(chooseNetwork(true, 'mainnet')).toBe('mainnet')
  })
})
