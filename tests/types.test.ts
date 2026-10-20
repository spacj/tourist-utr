import { describe, it, expect } from 'vitest'
import { normalizePuzzleAnswer, huntPriceEuros, HUNT_PRICE_EUROS, arrivalRadiusM, MIN_ARRIVAL_RADIUS_M, MAX_ACCURACY_SLACK_M } from '@/types'

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

describe('huntPriceEuros', () => {
  it('defaults to €5 per hunt', () => {
    expect(HUNT_PRICE_EUROS).toBe(5)
    expect(huntPriceEuros(undefined)).toBe(5)
    expect(huntPriceEuros(null)).toBe(5)
    expect(huntPriceEuros({})).toBe(5)
  })
  it('trusts a sane per-hunt price (1–50 €)', () => {
    expect(huntPriceEuros({ priceEuros: 7.5 })).toBe(7.5)
    expect(huntPriceEuros({ priceEuros: 1 })).toBe(1)
    expect(huntPriceEuros({ priceEuros: 50 })).toBe(50)
    expect(huntPriceEuros({ priceEuros: 4.999 })).toBe(5)
  })
  it('ignores missing or absurd prices', () => {
    for (const p of [0, 0.5, -5, 51, 1e9, NaN, Infinity, '5', null]) {
      expect(huntPriceEuros({ priceEuros: p })).toBe(HUNT_PRICE_EUROS)
    }
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
