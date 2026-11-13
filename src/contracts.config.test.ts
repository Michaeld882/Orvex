import { describe, expect, it } from 'vitest'
import { MAINNET_DEPLOYMENT, parseDeployment } from './contracts.config'

const A = '0x1111111111111111111111111111111111111111'
const full = {
  P_IDENTITY: A,
  P_PROOF: A,
  P_CHALLENGES: A,
  P_LAUNCHPAD: A,
  P_IDEAS: A,
  P_START_BLOCK: '123',
}

describe('parseDeployment', () => {
  it('returns null addresses and lists every missing key when nothing is set', () => {
    const d = parseDeployment(5042, 'P', {})
    expect(d.addresses).toBeNull()
    expect(d.missing).toHaveLength(5)
    expect(d.startBlock).toBeNull()
  })

  it('rejects malformed addresses instead of using them', () => {
    const d = parseDeployment(5042, 'P', { ...full, P_PROOF: '0x123' })
    expect(d.addresses).toBeNull()
    expect(d.missing).toEqual(['P_PROOF'])
  })

  it('accepts a complete configuration', () => {
    const d = parseDeployment(5042, 'P', full)
    expect(d.addresses?.identity).toBe(A)
    expect(d.startBlock).toBe(123n)
    expect(d.missing).toEqual([])
  })

  it('ignores a non-numeric start block', () => {
    expect(parseDeployment(5042, 'P', { ...full, P_START_BLOCK: 'abc' }).startBlock).toBeNull()
  })

  it('ships with no invented mainnet addresses', () => {
    expect(MAINNET_DEPLOYMENT.addresses).toBeNull()
  })
})
