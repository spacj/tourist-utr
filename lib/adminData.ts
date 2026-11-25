import 'server-only'
import { adminDb, Timestamp } from '@/lib/firebaseAdmin'
import { draftsCol, toDraftRecord } from '@/lib/drafts'
import { toCreatorProfile } from '@/lib/creators'
import { buildOverview, creatorYearTotals, type PaymentRow, type SaleRow } from '@/lib/adminStats'
import { vatRateBps } from '@/lib/revenueSplit'
import type { HuntDraftStatus } from '@/types'

/** Firestore loaders for the owner dashboard (/admin). Admin routes only. */

const ms = (v: unknown): number => (v as { toMillis?: () => number } | null)?.toMillis?.() ?? 0
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

function toPayment(d: FirebaseFirestore.DocumentData): PaymentRow {
  return {
    provider: typeof d.provider === 'string' ? d.provider : 'paypal',
    kind: String(d.kind ?? 'unknown'),
    status: String(d.status ?? ''),
    expectedCents: typeof d.expectedCents === 'number' ? d.expectedCents : null,
    huntId: typeof d.huntId === 'string' ? d.huntId : null,
    createdAt: ms(d.createdAt),
  }
}

export function toSale(id: string, d: FirebaseFirestore.DocumentData): SaleRow & { id: string; buyerUid: string; refundedAt: number | null } {
  return {
    id,
    huntId: String(d.huntId ?? ''),
    huntTitle: String(d.huntTitle ?? d.huntId ?? ''),
    creatorUid: String(d.creatorUid ?? ''),
    buyerUid: String(d.buyerUid ?? ''),
    status: d.status === 'refunded' ? 'refunded' : 'paid',
    grossCents: num(d.grossCents),
    vatCents: num(d.vatCents),
    paymentFeeCents: num(d.paymentFeeCents),
    commissionCents: num(d.commissionCents),
    creatorCents: num(d.creatorCents),
    createdAt: ms(d.createdAt),
    refundedAt: ms(d.refundedAt) || null,
  }
}

export async function loadOverview(days: number) {
  const db = adminDb()
  const now = Date.now()
  const since = now - days * 86_400_000
  const sinceTs = Timestamp.fromMillis(since)
  const [payments, sales, hunts, pending, creators, selling, started, completed, freeClaims] = await Promise.all([
    db.collection('payments').where('createdAt', '>=', sinceTs).get(),
    db.collection('sales').where('createdAt', '>=', sinceTs).get(),
    db.collection('hunts').select('title').get(),
    draftsCol().where('status', '==', 'pending_review').count().get(),
    db.collection('creators').count().get(),
    db.collection('creators').where('chargesEnabled', '==', true).count().get(),
    db.collection('sessions').where('startedAt', '>=', sinceTs).count().get(),
    db.collection('sessions').where('completedAt', '>=', sinceTs).count().get(),
    db.collection('users').where('freeHuntClaimedAt', '>=', sinceTs).count().get(),
  ])
  const houseTitles = Object.fromEntries(hunts.docs.map(h => [h.id, String(h.data().title ?? h.id)]))
  const overview = buildOverview({
    payments: payments.docs.map(p => toPayment(p.data())),
    sales: sales.docs.map(s => toSale(s.id, s.data())),
    since, now, vatBps: vatRateBps(), houseTitles,
  })
  return {
    overview,
    counts: {
      pendingReviews: pending.data().count,
      creators: creators.data().count,
      creatorsSelling: selling.data().count,
      sessionsStarted: started.data().count,
      sessionsCompleted: completed.data().count,
      freeHuntsClaimed: freeClaims.data().count,
    },
  }
}

export async function listDrafts(status: HuntDraftStatus | 'all') {
  const q = status === 'all' ? draftsCol() : draftsCol().where('status', '==', status)
  const [snap, creators] = await Promise.all([q.get(), adminDb().collection('creators').get()])
  const names = Object.fromEntries(creators.docs.map(c => [c.id, String(c.data().displayName ?? '')]))
  return snap.docs
    .map(d => toDraftRecord(d.id, d.data()))
    .sort((a, b) => (b.submittedAt ?? b.updatedAt ?? 0) - (a.submittedAt ?? a.updatedAt ?? 0))
    .slice(0, 200)
    .map(d => ({
      id: d.id,
      title: d.content.title,
      creatorName: names[d.ownerUid] ?? '',
      cityId: d.content.cityId,
      cityRequest: d.content.cityRequest,
      sourceLang: d.content.sourceLang,
      stopCount: d.content.stops.length,
      status: d.status,
      live: d.live,
      publishedVersion: d.publishedVersion,
      submittedAt: d.submittedAt,
    }))
}

export async function listCreators() {
  const db = adminDb()
  const [creators, sales] = await Promise.all([db.collection('creators').get(), db.collection('sales').where('status', '==', 'paid').get()])
  const totals = new Map<string, { sales: number; grossCents: number; payoutCents: number }>()
  for (const s of sales.docs) {
    const d = s.data()
    const t = totals.get(d.creatorUid) ?? { sales: 0, grossCents: 0, payoutCents: 0 }
    t.sales++
    t.grossCents += num(d.grossCents)
    t.payoutCents += num(d.creatorCents)
    totals.set(d.creatorUid, t)
  }
  return creators.docs
    .map(c => ({
      ...toCreatorProfile(c.id, c.data()),
      email: typeof c.data().email === 'string' ? c.data().email : null,
      totals: totals.get(c.id) ?? { sales: 0, grossCents: 0, payoutCents: 0 },
    }))
    .sort((a, b) => b.totals.grossCents - a.totals.grossCents || (b.createdAt ?? 0) - (a.createdAt ?? 0))
}

export async function listSales(limit = 200) {
  const db = adminDb()
  const [snap, creators] = await Promise.all([
    db.collection('sales').orderBy('createdAt', 'desc').limit(limit).get(),
    db.collection('creators').get(),
  ])
  const names = Object.fromEntries(creators.docs.map(c => [c.id, String(c.data().displayName ?? '')]))
  return snap.docs.map(s => ({ ...toSale(s.id, s.data()), creatorName: names[s.data().creatorUid] ?? '' }))
}

export async function listPaymentIssues(limit = 100) {
  const snap = await adminDb().collection('paymentIssues').orderBy('createdAt', 'desc').limit(limit).get()
  return snap.docs.map(d => {
    const { createdAt, ...rest } = d.data()
    return { id: d.id, createdAt: ms(createdAt), ...rest }
  })
}

/** CSV of what each creator earned in a calendar year (DAC7 reporting base). */
export async function creatorYearCsv(year: number): Promise<string> {
  const db = adminDb()
  const [sales, creators] = await Promise.all([
    db.collection('sales')
      .where('createdAt', '>=', Timestamp.fromMillis(Date.UTC(year, 0, 1)))
      .where('createdAt', '<', Timestamp.fromMillis(Date.UTC(year + 1, 0, 1)))
      .get(),
    db.collection('creators').get(),
  ])
  const info = Object.fromEntries(creators.docs.map(c => [c.id, c.data()]))
  const rows = creatorYearTotals(sales.docs.map(s => toSale(s.id, s.data())), year)
  const eur = (c: number) => (c / 100).toFixed(2)
  const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const header = ['creator_uid', 'name', 'email', 'country', 'stripe_account', 'sales', 'refunds', 'gross_eur', 'commission_eur', 'payment_fee_eur', 'paid_to_creator_eur']
  const lines = rows.map(r => {
    const c = info[r.creatorUid] ?? {}
    return [r.creatorUid, c.displayName, c.email, c.country, c.stripeAccountId, r.sales, r.refunds,
      eur(r.grossCents), eur(r.commissionCents), eur(r.paymentFeeCents), eur(r.payoutCents)].map(cell).join(',')
  })
  return [header.join(','), ...lines].join('\n')
}
