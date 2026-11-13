import { describe, expect, it } from 'vitest'
import {
  byteLength,
  hasErrors,
  isValidLink,
  validateChallenge,
  validateIdea,
  validateProject,
  validateSubmission,
  type ChallengeForm,
} from './validation'

const NOW = 1_800_000_000
const iso = (sec: number) => new Date(sec * 1000).toISOString().slice(0, 16)

const good: ChallengeForm = {
  title: 'Design onboarding',
  description: 'Create a short onboarding flow.',
  skill: 'Design',
  rewardNote: '',
  deadline: iso(NOW + 7 * 86400),
  maxParticipants: '10',
}

describe('links', () => {
  it('accepts https and ipfs only', () => {
    expect(isValidLink('https://example.com/a')).toBe(true)
    expect(isValidLink('ipfs://bafyabc')).toBe(true)
    expect(isValidLink('http://example.com')).toBe(false)
    expect(isValidLink('javascript:alert(1)')).toBe(false)
    expect(isValidLink('https://a b')).toBe(false)
  })
})

describe('byteLength', () => {
  it('counts UTF-8 bytes like the contracts do', () => {
    expect(byteLength('abc')).toBe(3)
    expect(byteLength('é')).toBe(2)
  })
})

describe('validateChallenge', () => {
  it('accepts a valid form', () => {
    expect(hasErrors(validateChallenge(good, NOW))).toBe(false)
  })
  it('rejects short title, past deadline and bad capacity', () => {
    const e = validateChallenge({ ...good, title: 'ab', deadline: iso(NOW + 60), maxParticipants: '0' }, NOW)
    expect(e.title).toBeDefined()
    expect(e.deadline).toBeDefined()
    expect(e.maxParticipants).toBeDefined()
  })
  it('rejects deadlines beyond 365 days and capacity above 1000', () => {
    const e = validateChallenge({ ...good, deadline: iso(NOW + 400 * 86400), maxParticipants: '1001' }, NOW)
    expect(e.deadline).toBeDefined()
    expect(e.maxParticipants).toBeDefined()
  })
  it('measures bytes, not characters', () => {
    const e = validateChallenge({ ...good, title: 'é'.repeat(41) }, NOW)
    expect(e.title).toBeDefined()
  })
})

describe('other forms', () => {
  it('validates submissions', () => {
    expect(hasErrors(validateSubmission({ uri: 'https://x.dev/pr/1', note: '' }))).toBe(false)
    expect(validateSubmission({ uri: 'ftp://x', note: '' }).uri).toBeDefined()
    expect(validateSubmission({ uri: '', note: '' }).uri).toBeDefined()
  })
  it('allows an empty optional project link', () => {
    const f = { name: 'Orbit', tagline: 'A tiny tool', description: 'Does one thing well.', category: 'Tooling', link: '' }
    expect(hasErrors(validateProject(f))).toBe(false)
    expect(validateProject({ ...f, link: 'not a link' }).link).toBeDefined()
  })
  it('validates ideas', () => {
    expect(hasErrors(validateIdea({ title: 'Idea one', body: 'A longer body text', tag: 'Pay' }))).toBe(false)
    expect(validateIdea({ title: 'x', body: 'short', tag: '' }).tag).toBeDefined()
  })
})
