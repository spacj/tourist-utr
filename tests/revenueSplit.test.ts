import { describe, it, expect, vi } from 'vitest'
import { splitSale, commissionBpsFor, defaultCommissionBps, paymentFeeBps, vatRateBps, currentRates } from '@/lib/revenueSplit'

const STD = { commissionBps: 2000, vatBps: 2100, paymentFeeBps: 300 }

describe('splitSale (after VAT, 3% payment fee, 20% commission)', () => {
  it('€5 at 21% VAT: €3.15 to the creator', () => {
    expect(splitSale(500, STD)).toEqual({
      grossCents: 500, vatCents: 87, netCents: 413, paymentFeeCents: 15,
      commissionCents: 83, creatorCents: 315, platformFeeCents: 185,
    })
  })

  it('€10 and €1', () => {
    const ten = splitSale(1000, STD)
    expect(ten.netCents).toBe(826)
    expect(ten.creatorCents).toBe(630) // floor(826 × 0.8 − 30) = floor(630.8)
    const one = splitSale(100, STD)
    expect(one.netCents).toBe(83)
    expect(one.creatorCents).toBe(63) // floor(83 × 0.8 − 3) = floor(63.4)
  })

  it('always adds up exactly, for every price 1–50 € and several rates', () => {
    const rateSets = [
      STD,
      { ...STD, vatBps: 0 },
      { ...STD, vatBps: 900 },
      { ...STD, commissionBps: 0, paymentFeeBps: 0 },
      { ...STD, commissionBps: 3000 },
    ]
    for (let gross = 100; gross <= 5000; gross += 7) {
      for (const r of rateSets) {
        const s = splitSale(gross, r)
        expect(s.vatCents + s.netCents).toBe(gross)
        expect(s.vatCents + s.paymentFeeCents + s.commissionCents + s.creatorCents).toBe(gross)
        expect(s.creatorCents + s.platformFeeCents).toBe(gross)
        const exact = (s.netCents * (10_000 - r.commissionBps) - gross * r.paymentFeeBps) / 10_000
        expect(s.creatorCents).toBeLessThanOrEqual(exact)
        expect(exact - s.creatorCents).toBeLessThan(1)
      }
    }
  })

  it('without VAT, fee or commission the creator gets everything', () => {
    expect(splitSale(1000, { commissionBps: 0, vatBps: 0, paymentFeeBps: 0 }).creatorCents).toBe(1000)
  })

  it('never pays a negative share', () => {
    expect(splitSale(100, { commissionBps: 10_000, vatBps: 2100, paymentFeeBps: 300 }).creatorCents).toBe(0)
  })

  it('rejects bad input', () => {
    expect(() => splitSale(4.5, STD)).toThrow()
    expect(() => splitSale(-1, STD)).toThrow()
    expect(() => splitSale(500, { ...STD, commissionBps: 10_001 })).toThrow()
    expect(() => splitSale(500, { ...STD, vatBps: -5 })).toThrow()
    expect(() => splitSale(500, { ...STD, paymentFeeBps: 1.5 })).toThrow()
  })
})

describe('rate configuration', () => {
  it('defaults: 20% commission, 3% payment fee, 21% VAT', () => {
    vi.stubEnv('PLATFORM_COMMISSION_BPS', '')
    vi.stubEnv('PAYMENT_FEE_BPS', '')
    vi.stubEnv('VAT_RATE_BPS', '')
    expect(defaultCommissionBps()).toBe(2000)
    expect(paymentFeeBps()).toBe(300)
    expect(vatRateBps()).toBe(2100)
    expect(currentRates(null)).toEqual(STD)
  })

  it('reads sane env values and ignores junk', () => {
    vi.stubEnv('PLATFORM_COMMISSION_BPS', '1500')
    expect(defaultCommissionBps()).toBe(1500)
    vi.stubEnv('PLATFORM_COMMISSION_BPS', '12.5')
    expect(defaultCommissionBps()).toBe(2000)
    vi.stubEnv('PAYMENT_FEE_BPS', '20000')
    expect(paymentFeeBps()).toBe(300)
  })

  it('per-creator commission override wins when sane', () => {
    vi.stubEnv('PLATFORM_COMMISSION_BPS', '')
    expect(commissionBpsFor({ commissionBps: 1000 })).toBe(1000)
    expect(commissionBpsFor({ commissionBps: 'x' })).toBe(2000)
    expect(commissionBpsFor(null)).toBe(2000)
  })
})
