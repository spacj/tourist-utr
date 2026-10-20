import { describe, it, expect } from 'vitest'
import { resolveAccess, isOwned, huntUnlockId, freeHuntIdOf, type AccessState } from '@/lib/huntAccess'
import { huntAccessFor, type HuntAccessSummary } from '@/types'

const base: AccessState = { huntId: 'h1', freeHuntId: null, purchased: false, cityPass: false }

describe('resolveAccess (one free hunt per account, then per-hunt purchases)', () => {
  it('fresh account: the free hunt is available for any hunt', () => {
    expect(resolveAccess(base)).toBe('free-available')
    expect(resolveAccess({ ...base, huntId: 'other' })).toBe('free-available')
  })

  it('the hunt that used the free slot stays playable forever', () => {
    expect(resolveAccess({ ...base, freeHuntId: 'h1' })).toBe('free-used-here')
  })

  it('free slot spent elsewhere → locked unless bought', () => {
    expect(resolveAccess({ ...base, freeHuntId: 'h2' })).toBe('locked')
    expect(resolveAccess({ ...base, freeHuntId: 'h2', purchased: true })).toBe('purchased')
  })

  it('a purchase wins over an unused free slot (buying never spends it)', () => {
    expect(resolveAccess({ ...base, purchased: true })).toBe('purchased')
  })

  it('legacy city pass opens every hunt in its city, with or without the free slot', () => {
    expect(resolveAccess({ ...base, cityPass: true })).toBe('city-pass')
    expect(resolveAccess({ ...base, freeHuntId: 'h2', cityPass: true })).toBe('city-pass')
  })

  it('free-used-here takes precedence over other ownership', () => {
    expect(resolveAccess({ ...base, freeHuntId: 'h1', purchased: true, cityPass: true })).toBe('free-used-here')
  })

  it('isOwned covers exactly the owned states', () => {
    expect(isOwned('free-used-here')).toBe(true)
    expect(isOwned('purchased')).toBe(true)
    expect(isOwned('city-pass')).toBe(true)
    expect(isOwned('free-available')).toBe(false)
    expect(isOwned('locked')).toBe(false)
  })

  it('doc ids and the users.freeHuntId reader', () => {
    expect(huntUnlockId('u1', 'h1')).toBe('u1__h1')
    expect(freeHuntIdOf(undefined)).toBeNull()
    expect(freeHuntIdOf({})).toBeNull()
    expect(freeHuntIdOf({ freeHuntId: '' })).toBeNull()
    expect(freeHuntIdOf({ freeHuntId: 42 })).toBeNull()
    expect(freeHuntIdOf({ freeHuntId: 'h1' })).toBe('h1')
  })
})

describe('huntAccessFor (client mirror of resolveAccess)', () => {
  const summary = (over: Partial<HuntAccessSummary> = {}): HuntAccessSummary => ({
    freeHuntId: null, freeAvailable: true, owned: [], cityPasses: [], ...over,
  })
  const hunt = { id: 'h1', cityId: 'utrecht' }

  it('matches the server rules', () => {
    expect(huntAccessFor(summary(), hunt)).toBe('free')
    expect(huntAccessFor(summary({ freeHuntId: 'h1', freeAvailable: false }), hunt)).toBe('owned')
    expect(huntAccessFor(summary({ freeHuntId: 'h2', freeAvailable: false }), hunt)).toBe('locked')
    expect(huntAccessFor(summary({ freeHuntId: 'h2', freeAvailable: false, owned: ['h1'] }), hunt)).toBe('owned')
    expect(huntAccessFor(summary({ freeHuntId: 'h2', freeAvailable: false, cityPasses: ['utrecht'] }), hunt)).toBe('owned')
    expect(huntAccessFor(summary({ freeHuntId: 'h2', freeAvailable: false, cityPasses: ['delft'] }), hunt)).toBe('locked')
  })
})
