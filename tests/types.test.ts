import { describe, it, expect } from 'vitest'
import { normalizePuzzleAnswer, isHuntFree, arrivalRadiusM, MIN_ARRIVAL_RADIUS_M, MAX_ACCURACY_SLACK_M } from '@/types'

describe('normalizePuzzleAnswer', () => {
  it('lower-cases', () => {
    expect(normalizePuzzleAnswer('DOMTOREN')).toBe('domtoren')
  })
  it('strips accents', () => {
    expect(normalizePuzzleAnswer('Café Crème')).toBe('cafecreme')
    expect(normalizePuzzleAnswer('Señor Müller')).toBe('senormuller')
    expect(normalizePuzzleAnswer('Città')).toBe('citta')
  })
  it('strips whitespace and punctuation', () => {
    expect(normalizePuzzleAnswer('  Dom  Tower!  ')).toBe('domtower')
    expect(normalizePuzzleAnswer("St. Martin's")).toBe('stmartins')
    expect(normalizePuzzleAnswer('1-2-3')).toBe('123')
  })
  it('handles empty / pure-punctuation input', () => {
    expect(normalizePuzzleAnswer('')).toBe('')
    expect(normalizePuzzleAnswer(' ?! ')).toBe('')
  })
  it('is idempotent', () => {
    const once = normalizePuzzleAnswer('Évora, Portugal')
    expect(normalizePuzzleAnswer(once)).toBe(once)
  })
})

describe('isHuntFree', () => {
  it('only the first hunt (order 0) of a city is free', () => {
    expect(isHuntFree({ order: 0 })).toBe(true)
    expect(isHuntFree({ order: 0, tourType: 'hunt' })).toBe(true)
    expect(isHuntFree({ order: 1 })).toBe(false)
    expect(isHuntFree({ order: 5, tourType: 'hunt' })).toBe(false)
  })
  it('walking tours are never free, even at order 0', () => {
    expect(isHuntFree({ order: 0, tourType: 'tour' })).toBe(false)
  })
})

describe('arrivalRadiusM', () => {
  it('uses at least the minimum radius', () => {
    expect(arrivalRadiusM(10, 0)).toBe(MIN_ARRIVAL_RADIUS_M)
    expect(arrivalRadiusM(0, null)).toBe(MIN_ARRIVAL_RADIUS_M)
    expect(arrivalRadiusM(80, undefined)).toBe(80)
  })
  it('adds GPS accuracy slack, capped', () => {
    expect(arrivalRadiusM(40, 10)).toBe(50)
    expect(arrivalRadiusM(40, 500)).toBe(40 + MAX_ACCURACY_SLACK_M)
    expect(arrivalRadiusM(40, -5)).toBe(40)
  })
})
