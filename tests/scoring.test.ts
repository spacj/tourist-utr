import { describe, it, expect } from 'vitest'
import { arrivalBreakdown, hintPenaltyFor, resolveAt, MAX_REPLAY_AGE_MS } from '@/lib/arrival'
import { SCORE, HINT_COSTS, emptyBreakdown, breakdownTotal, type StopBreakdown } from '@/types'

const base = (over: Partial<StopBreakdown> = {}): StopBreakdown => ({ ...emptyBreakdown(), ...over })
const arrive = (o: Partial<Parameters<typeof arrivalBreakdown>[1]> = {}, prev = base()) =>
  arrivalBreakdown(prev, { isTour: false, hintTiers: [], raceFirst: false, ...o })

describe('SCORE table (GAME_DESIGN.md "Scoring")', () => {
  it('has the documented values', () => {
    expect(SCORE).toEqual({
      puzzle: 100,
      arrival: 50,
      onSite: 50,
      trivia: 25,
      cleanStop: 25,
      hint2Penalty: 10,
      puzzleHintPenalty: 10,
      pinRevealPenalty: 25,
      raceFirst: 20,
    })
  })
  it('hint costs: tier 1 free, tier 2 = 2, pin = 4, puzzle = 3 credits', () => {
    expect(HINT_COSTS).toEqual({ 1: 0, 2: 2, 3: 4, puzzle: 3 })
  })
})

describe('breakdownTotal', () => {
  it('sums every field, penalties negative', () => {
    expect(breakdownTotal(null)).toBe(0)
    expect(breakdownTotal({})).toBe(0)
    expect(breakdownTotal(base({ puzzle: 100, arrival: 50, onSite: 50, trivia: 25, clean: 25, hintPenalty: -10, raceFirst: 20 }))).toBe(260)
  })
})

describe('arrivalBreakdown', () => {
  it('clean arrival: arrival 50 + clean 25', () => {
    const b = arrive()
    expect(b).toEqual(base({ arrival: 50, clean: 25 }))
    expect(breakdownTotal(b)).toBe(75)
  })

  it('keeps puzzle / trivia points already earned on the stop', () => {
    const b = arrive({}, base({ puzzle: 100, trivia: 25 }))
    expect(breakdownTotal(b)).toBe(100 + 25 + 50 + 25)
  })

  it('does not mutate the previous breakdown', () => {
    const prev = base({ puzzle: 100 })
    arrive({ hintTiers: ['2'] }, prev)
    expect(prev).toEqual(base({ puzzle: 100 }))
  })

  it('tier-1 (free) hint does NOT cancel the clean-stop bonus', () => {
    const b = arrive({ hintTiers: ['1'] })
    expect(b.clean).toBe(25)
    expect(b.hintPenalty).toBe(0)
    expect(arrive({ hintTiers: [1] }).clean).toBe(25)
  })

  it('tier-2 hint: −10 and no clean bonus', () => {
    const b = arrive({ hintTiers: ['1', '2'] })
    expect(b.clean).toBe(0)
    expect(b.hintPenalty).toBe(-10)
    expect(breakdownTotal(b)).toBe(40)
  })

  it('puzzle hint: −10 and no clean bonus', () => {
    const b = arrive({ hintTiers: ['puzzle'] }, base({ puzzle: 100 }))
    expect(b.clean).toBe(0)
    expect(b.hintPenalty).toBe(-10)
    expect(breakdownTotal(b)).toBe(140)
  })

  it('pin reveal: −25', () => {
    expect(arrive({ hintTiers: ['3'] }).hintPenalty).toBe(-25)
  })

  it('penalties stack and each tier counts once', () => {
    expect(arrive({ hintTiers: ['2', 'puzzle', '3', '2', 3] }).hintPenalty).toBe(-45)
    expect(hintPenaltyFor(['2', 2])).toBe(10)
    expect(hintPenaltyFor([])).toBe(0)
    expect(hintPenaltyFor(['1'])).toBe(0)
  })

  it('race first: +20', () => {
    expect(arrive({ raceFirst: true }).raceFirst).toBe(20)
    expect(arrive({ raceFirst: false }).raceFirst).toBe(0)
  })

  it('correct on-site check-in: +50', () => {
    expect(arrive({ onSiteCorrect: true }).onSite).toBe(50)
    expect(arrive({ onSiteCorrect: false }).onSite).toBe(0)
  })

  it('perfect multiplayer stop: 100 + 50 + 50 + 25 + 25 + 20 = 270', () => {
    const b = arrive({ raceFirst: true, onSiteCorrect: true, hintTiers: ['1'] }, base({ puzzle: 100, trivia: 25 }))
    expect(breakdownTotal(b)).toBe(270)
  })

  it('walking tours are never scored', () => {
    const b = arrive({ isTour: true, raceFirst: true, onSiteCorrect: true, hintTiers: ['2'] })
    expect(b).toEqual(base())
  })
})

describe('resolveAt (offline replay timestamps)', () => {
  const now = 1_700_000_000_000
  it('accepts recent past times', () => {
    expect(resolveAt(now - 60_000, now)).toBe(now - 60_000)
  })
  it('rejects too-old, future and garbage values', () => {
    expect(resolveAt(now - MAX_REPLAY_AGE_MS - 1, now)).toBe(now)
    expect(resolveAt(now + 120_000, now)).toBe(now)
    expect(resolveAt('123', now)).toBe(now)
    expect(resolveAt(NaN, now)).toBe(now)
  })
  it('clamps small clock skew into the past', () => {
    expect(resolveAt(now + 30_000, now)).toBe(now)
  })
})
