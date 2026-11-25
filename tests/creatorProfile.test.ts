import { describe, it, expect } from 'vitest'
import { HttpError } from '@/lib/apiAuth'
import { slugify, slugCandidates, parseCreatorProfileInput } from '@/lib/creatorProfile'

describe('slugify', () => {
  it('makes url-safe ascii slugs', () => {
    expect(slugify("Anna's Ghost Walks!")).toBe('annas-ghost-walks')
    expect(slugify('  Ünïcödé   Tours ')).toBe('unicode-tours')
    expect(slugify('Délft — Vermeer & co')).toBe('delft-vermeer-co')
  })
  it('pads too-short names and caps length', () => {
    expect(slugify('Jo')).toBe('creator-jo')
    expect(slugify('東京')).toBe('creator-x')
    expect(slugify('a'.repeat(80)).length).toBe(40)
  })
  it('candidates start with the base and stay ≤ 40 chars', () => {
    const c = slugCandidates('a'.repeat(40), 12)
    expect(c[0]).toBe('a'.repeat(40))
    expect(c[1]).toBe(`${'a'.repeat(36)}-2`)
    expect(c.every(s => s.length <= 40)).toBe(true)
    expect(new Set(c).size).toBe(12)
  })
})

describe('parseCreatorProfileInput', () => {
  const ok = { displayName: '  Anna   Smit ', bio: 'Hi', country: 'NL', acceptTerms: true }
  it('normalises valid input', () => {
    expect(parseCreatorProfileInput(ok)).toEqual({ displayName: 'Anna Smit', bio: 'Hi', country: 'nl', acceptTerms: true })
  })
  it('rejects bad fields', () => {
    const bad = (over: Record<string, unknown>, code: string) => {
      try { parseCreatorProfileInput({ ...ok, ...over }) } catch (e) {
        expect(e).toBeInstanceOf(HttpError); expect((e as HttpError).code).toBe(code); return
      }
      throw new Error('expected throw')
    }
    bad({ displayName: 'A' }, 'invalid_displayName')
    bad({ bio: 'x'.repeat(601) }, 'invalid_bio')
    bad({ country: 'xx' }, 'invalid_country')
  })
  it('acceptTerms must be literally true', () => {
    expect(parseCreatorProfileInput({ ...ok, acceptTerms: 'yes' }).acceptTerms).toBe(false)
  })
})
