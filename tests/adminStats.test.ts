import { describe, it, expect } from 'vitest'
import { buildOverview, creatorYearTotals, vatInside, type PaymentRow, type SaleRow } from '@/lib/adminStats'
import { splitSale } from '@/lib/revenueSplit'
import { CREATOR_HUNT_PRICE_EUROS, HUNT_PRICE_EUROS } from '@/types'

const DAY = 86_400_000
const now = Date.UTC(2026, 10, 25, 12)
const since = now - 30 * DAY

const pay = (over: Partial<PaymentRow>): PaymentRow => ({
  provider: 'paypal', kind: 'hunt_unlock', status: 'granted', expectedCents: 500, huntId: 'hunt_a', createdAt: now - DAY, ...over,
})
function sale(over: Partial<SaleRow> = {}): SaleRow {
  const s = splitSale(700, { commissionBps: 2000, vatBps: 2100, paymentFeeBps: 300 })
  return {
    huntId: 'c_1', huntTitle: 'Canal ghosts', creatorUid: 'u1', status: 'paid',
    grossCents: s.grossCents, vatCents: s.vatCents, paymentFeeCents: s.paymentFeeCents,
    commissionCents: s.commissionCents, creatorCents: s.creatorCents, createdAt: now - 2 * DAY, ...over,
  }
}

describe('prices', () => {
  it('house hunts €5, creator hunts €7', () => {
    expect(HUNT_PRICE_EUROS).toBe(5)
    expect(CREATOR_HUNT_PRICE_EUROS).toBe(7)
  })
  it('a €7 creator sale pays the creator €4.42', () => {
    expect(splitSale(700, { commissionBps: 2000, vatBps: 2100, paymentFeeBps: 300 })).toMatchObject({
      vatCents: 121, paymentFeeCents: 21, commissionCents: 116, creatorCents: 442,
    })
  })
})

describe('buildOverview', () => {
  it('adds up house and creator revenue, VAT and payouts', () => {
    const o = buildOverview({
      payments: [
        pay({}),
        pay({ kind: 'credit_pack', expectedCents: 249, huntId: null }),
        pay({ status: 'rejected' }),                       // refunded at once: not revenue
        pay({ createdAt: since - DAY }),                   // outside the period
        pay({ provider: 'stripe', expectedCents: 700 }),   // creator sale: counted from sales
      ],
      sales: [sale(), sale({ status: 'refunded' }), sale({ createdAt: since - DAY })],
      since, now, vatBps: 2100, houseTitles: { hunt_a: 'Utrecht Classic' },
    })
    expect(o.house).toEqual({ huntSales: 1, huntCents: 500, creditSales: 1, creditCents: 249, otherCents: 0 })
    expect(o.creators).toMatchObject({ sales: 1, refunds: 1, grossCents: 700, commissionCents: 116, paymentFeeCents: 21, payoutCents: 442 })
    expect(o.grossCents).toBe(500 + 249 + 700)
    expect(o.vatCents).toBe(vatInside(749, 2100) + 121)
    expect(o.creatorPayoutCents).toBe(442)
    expect(o.platformNetCents).toBe(o.grossCents - o.vatCents - 442)
    expect(o.topHunts[0]).toMatchObject({ huntId: 'c_1', creator: true, grossCents: 700 })
    expect(o.topHunts[1]).toMatchObject({ huntId: 'hunt_a', title: 'Utrecht Classic', creator: false })
  })

  it('has one bar per day, sums per day', () => {
    const o = buildOverview({ payments: [pay({})], sales: [sale()], since, now, vatBps: 2100 })
    expect(o.daily.length).toBeGreaterThanOrEqual(30)
    expect(o.daily.reduce((n, d) => n + d.houseCents, 0)).toBe(500)
    expect(o.daily.reduce((n, d) => n + d.creatorCents, 0)).toBe(700)
    expect(o.daily.at(-1)!.day).toBe('2026-11-25')
  })
})

describe('creatorYearTotals', () => {
  it('sums one calendar year per creator, refunds counted apart', () => {
    const rows = creatorYearTotals([
      sale(), sale(), sale({ status: 'refunded' }), sale({ creatorUid: 'u2' }),
      sale({ createdAt: Date.UTC(2025, 11, 31) }),
    ], 2026)
    const u1 = rows.find(r => r.creatorUid === 'u1')!
    expect(u1).toMatchObject({ sales: 2, refunds: 1, grossCents: 1400, payoutCents: 884 })
    expect(rows.find(r => r.creatorUid === 'u2')!.sales).toBe(1)
  })
})
