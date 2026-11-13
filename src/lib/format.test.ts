import { describe, expect, it } from 'vitest'
import { newestFirstWindow, pageCountFor, safeHref, shortAddress, timeLeft } from './format'
import { effectiveStatus, levelFor, nextLevelAt } from './types'
import { computeDigest } from './digest'

describe('newestFirstWindow', () => {
  it('pages newest first over an ascending list', () => {
    expect(newestFirstWindow(25, 0, 10)).toEqual({ offset: 15, limit: 10 })
    expect(newestFirstWindow(25, 1, 10)).toEqual({ offset: 5, limit: 10 })
    expect(newestFirstWindow(25, 2, 10)).toEqual({ offset: 0, limit: 5 })
    expect(newestFirstWindow(25, 3, 10)).toEqual({ offset: 0, limit: 0 })
    expect(newestFirstWindow(0, 0, 10)).toEqual({ offset: 0, limit: 0 })
  })
  it('counts pages', () => {
    expect(pageCountFor(0, 10)).toBe(1)
    expect(pageCountFor(21, 10)).toBe(3)
  })
})

describe('safeHref', () => {
  it('only links https and ipfs', () => {
    expect(safeHref('https://a.dev')).toBe('https://a.dev')
    expect(safeHref('ipfs://cid')).toBe('https://ipfs.io/ipfs/cid')
    expect(safeHref('javascript:alert(1)')).toBeNull()
    expect(safeHref('data:text/html,x')).toBeNull()
  })
})

describe('display helpers', () => {
  it('shortens addresses', () => {
    expect(shortAddress('0x1234567890123456789012345678901234567890')).toBe('0x1234…7890')
  })
  it('formats time left', () => {
    expect(timeLeft(100, 100)).toBe('Ended')
    expect(timeLeft(100 + 3 * 3600 + 120, 100)).toBe('3h 2m left')
  })
})

describe('reputation helpers (mirror contract thresholds)', () => {
  it('maps points to levels', () => {
    expect([0, 49, 50, 149, 150, 399, 400, 999, 1000].map(levelFor)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5])
    expect(nextLevelAt(1000)).toBeNull()
    expect(nextLevelAt(20)).toBe(50)
  })
  it('derives effective challenge status', () => {
    expect(effectiveStatus({ status: 0, deadline: 200 }, 100)).toBe('Open')
    expect(effectiveStatus({ status: 0, deadline: 100 }, 100)).toBe('Expired')
    expect(effectiveStatus({ status: 1, deadline: 999 }, 100)).toBe('Closed')
    expect(effectiveStatus({ status: 2, deadline: 999 }, 100)).toBe('Cancelled')
  })
})

describe('computeDigest', () => {
  const rec = {
    id: 1n,
    contributor: '0x1111111111111111111111111111111111111111',
    attestor: '0x2222222222222222222222222222222222222222',
    source: 0,
    sourceId: 7n,
    recordedAt: 1,
    title: 'Work',
    uri: 'https://x.dev',
    digest: '0x00',
  } as const
  const proof = '0x3333333333333333333333333333333333333333'
  it('is deterministic and binds chain and contract', () => {
    const a = computeDigest(rec, 5042, proof)
    expect(a).toBe(computeDigest(rec as never, 5042, proof))
    expect(a).not.toBe(computeDigest(rec as never, 5042002, proof))
    expect(a).not.toBe(computeDigest({ ...rec, title: 'Other' }, 5042, proof))
  })
})
