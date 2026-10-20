import { describe, it, expect } from 'vitest'
import { haversineM, bearingDeg } from '@/lib/geo'

const DOM_TOWER = { lat: 52.0908, lng: 5.1214 }
const UTRECHT_CENTRAAL = { lat: 52.0894, lng: 5.1101 }

describe('haversineM', () => {
  it('is zero for identical points', () => {
    expect(haversineM(52, 5, 52, 5)).toBe(0)
  })
  it('Dom Tower → Utrecht Centraal is under ~1.3 km straight-line', () => {
    // ≈ 0.8 km as the crow flies (≈ 1.1–1.3 km walking).
    const d = haversineM(DOM_TOWER.lat, DOM_TOWER.lng, UTRECHT_CENTRAAL.lat, UTRECHT_CENTRAAL.lng)
    expect(d).toBeGreaterThan(700)
    expect(d).toBeLessThan(1300)
  })
  it('one degree of latitude ≈ 111.2 km', () => {
    expect(haversineM(0, 0, 1, 0)).toBeCloseTo(111_195, -2)
  })
  it('Amsterdam Centraal → Utrecht Centraal ≈ 35 km', () => {
    const d = haversineM(52.3791, 4.9003, 52.0894, 5.1101)
    expect(d / 1000).toBeGreaterThan(33)
    expect(d / 1000).toBeLessThan(37)
  })
  it('is symmetric', () => {
    const a = haversineM(DOM_TOWER.lat, DOM_TOWER.lng, UTRECHT_CENTRAAL.lat, UTRECHT_CENTRAAL.lng)
    const b = haversineM(UTRECHT_CENTRAAL.lat, UTRECHT_CENTRAAL.lng, DOM_TOWER.lat, DOM_TOWER.lng)
    expect(a).toBeCloseTo(b, 6)
  })
})

describe('bearingDeg', () => {
  it('cardinal directions', () => {
    expect(bearingDeg(0, 0, 1, 0)).toBeCloseTo(0, 5)
    expect(bearingDeg(0, 0, 0, 1)).toBeCloseTo(90, 5)
    expect(bearingDeg(0, 0, -1, 0)).toBeCloseTo(180, 5)
    expect(bearingDeg(0, 0, 0, -1)).toBeCloseTo(270, 5)
  })
  it('is always within [0, 360)', () => {
    for (const [a, b, c, d] of [[52, 5, 51, 4], [52, 5, 53, 6], [-10, 170, 10, -170]]) {
      const v = bearingDeg(a, b, c, d)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(360)
    }
  })
  it('Dom Tower → Utrecht Centraal heads roughly west', () => {
    const b = bearingDeg(DOM_TOWER.lat, DOM_TOWER.lng, UTRECHT_CENTRAAL.lat, UTRECHT_CENTRAAL.lng)
    expect(b).toBeGreaterThan(225)
    expect(b).toBeLessThan(290)
  })
})
