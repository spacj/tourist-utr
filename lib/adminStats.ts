/**
 * Owner dashboard figures — pure aggregation over payment and sale records
 * (tested in tests/adminStats.test.ts). The Firestore loader lives in
 * lib/adminData.ts. All amounts in euro cents.
 *
 * Sources:
 *  - payments/{id}  PayPal: house hunts, hint credits, legacy city passes
 *                   (status 'granted'; amount in expectedCents)
 *  - sales/{id}     Stripe: creator hunts, split per sale (status paid/refunded)
 */

export interface PaymentRow {
  provider?: string
  kind: string
  status: string
  expectedCents: number | null
  huntId: string | null
  createdAt: number
}

export interface SaleRow {
  huntId: string
  huntTitle: string
  creatorUid: string
  status: 'paid' | 'refunded'
  grossCents: number
  vatCents: number
  paymentFeeCents: number
  commissionCents: number
  creatorCents: number
  createdAt: number
}

export interface Overview {
  days: number
  /** Everything players paid (incl. VAT), net of refunds. */
  grossCents: number
  /** Estimated VAT inside the gross (house sales at the configured rate). */
  vatCents: number
  /** Paid out to creators. */
  creatorPayoutCents: number
  /** What the platform keeps before Stripe/PayPal fees and VAT: gross − VAT − creator payouts. */
  platformNetCents: number
  house: { huntSales: number; huntCents: number; creditSales: number; creditCents: number; otherCents: number }
  creators: { sales: number; refunds: number; grossCents: number; commissionCents: number; paymentFeeCents: number; payoutCents: number }
  daily: Array<{ day: string; houseCents: number; creatorCents: number }>
  topHunts: Array<{ huntId: string; title: string; sales: number; grossCents: number; creator: boolean }>
}

const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/** VAT contained in a VAT-inclusive amount. */
export const vatInside = (grossCents: number, vatBps: number) =>
  grossCents - Math.round((grossCents * 10_000) / (10_000 + vatBps))

export function buildOverview(opts: {
  payments: PaymentRow[]
  sales: SaleRow[]
  since: number
  now: number
  vatBps: number
  houseTitles?: Record<string, string>
}): Overview {
  const { since, now, vatBps } = opts
  const days = Math.max(1, Math.round((now - since) / 86_400_000))
  const daily = new Map<string, { houseCents: number; creatorCents: number }>()
  for (let t = since; t <= now; t += 86_400_000) daily.set(dayKey(t), { houseCents: 0, creatorCents: 0 })
  daily.set(dayKey(now), daily.get(dayKey(now)) ?? { houseCents: 0, creatorCents: 0 })

  const house = { huntSales: 0, huntCents: 0, creditSales: 0, creditCents: 0, otherCents: 0 }
  const top = new Map<string, { title: string; sales: number; grossCents: number; creator: boolean }>()

  for (const p of opts.payments) {
    if (p.provider === 'stripe' || p.status !== 'granted' || p.createdAt < since) continue
    const cents = p.expectedCents ?? 0
    if (p.kind === 'hunt_unlock') {
      house.huntSales++
      house.huntCents += cents
      if (p.huntId) {
        const t = top.get(p.huntId) ?? { title: opts.houseTitles?.[p.huntId] ?? p.huntId, sales: 0, grossCents: 0, creator: false }
        t.sales++
        t.grossCents += cents
        top.set(p.huntId, t)
      }
    } else if (p.kind === 'credit_pack') {
      house.creditSales++
      house.creditCents += cents
    } else {
      house.otherCents += cents
    }
    const d = daily.get(dayKey(p.createdAt))
    if (d) d.houseCents += cents
  }

  const creators = { sales: 0, refunds: 0, grossCents: 0, commissionCents: 0, paymentFeeCents: 0, payoutCents: 0 }
  let creatorVat = 0
  for (const s of opts.sales) {
    if (s.createdAt < since) continue
    if (s.status === 'refunded') { creators.refunds++; continue }
    creators.sales++
    creators.grossCents += s.grossCents
    creators.commissionCents += s.commissionCents
    creators.paymentFeeCents += s.paymentFeeCents
    creators.payoutCents += s.creatorCents
    creatorVat += s.vatCents
    const t = top.get(s.huntId) ?? { title: s.huntTitle, sales: 0, grossCents: 0, creator: true }
    t.sales++
    t.grossCents += s.grossCents
    top.set(s.huntId, t)
    const d = daily.get(dayKey(s.createdAt))
    if (d) d.creatorCents += s.grossCents
  }

  const houseGross = house.huntCents + house.creditCents + house.otherCents
  const grossCents = houseGross + creators.grossCents
  const vatCents = vatInside(houseGross, vatBps) + creatorVat
  return {
    days,
    grossCents,
    vatCents,
    creatorPayoutCents: creators.payoutCents,
    platformNetCents: grossCents - vatCents - creators.payoutCents,
    house,
    creators,
    daily: [...daily.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, v]) => ({ day, ...v })),
    topHunts: [...top.entries()]
      .map(([huntId, v]) => ({ huntId, ...v }))
      .sort((a, b) => b.grossCents - a.grossCents)
      .slice(0, 10),
  }
}

/** DAC7-style yearly totals per creator (what we paid each seller). */
export function creatorYearTotals(sales: SaleRow[], year: number): Array<{
  creatorUid: string; sales: number; refunds: number; grossCents: number; commissionCents: number; paymentFeeCents: number; payoutCents: number
}> {
  const from = Date.UTC(year, 0, 1)
  const to = Date.UTC(year + 1, 0, 1)
  const by = new Map<string, { sales: number; refunds: number; grossCents: number; commissionCents: number; paymentFeeCents: number; payoutCents: number }>()
  for (const s of sales) {
    if (s.createdAt < from || s.createdAt >= to) continue
    const t = by.get(s.creatorUid) ?? { sales: 0, refunds: 0, grossCents: 0, commissionCents: 0, paymentFeeCents: 0, payoutCents: 0 }
    if (s.status === 'refunded') t.refunds++
    else {
      t.sales++
      t.grossCents += s.grossCents
      t.commissionCents += s.commissionCents
      t.paymentFeeCents += s.paymentFeeCents
      t.payoutCents += s.creatorCents
    }
    by.set(s.creatorUid, t)
  }
  return [...by.entries()].map(([creatorUid, v]) => ({ creatorUid, ...v })).sort((a, b) => b.payoutCents - a.payoutCents)
}
