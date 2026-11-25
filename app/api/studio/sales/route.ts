import { NextRequest, NextResponse } from 'next/server'
import { handle } from '@/lib/apiAuth'
import { requireCreator } from '@/lib/creators'
import { adminDb } from '@/lib/firebaseAdmin'
import { toSale } from '@/lib/adminData'

export const dynamic = 'force-dynamic'

/** GET /api/studio/sales → { sales, totals } — the caller's creator sales (newest first). */
export const GET = handle(async (req: NextRequest) => {
  const { user } = await requireCreator(req)
  const snap = await adminDb().collection('sales').where('creatorUid', '==', user.uid).get()
  const sales = snap.docs
    .map(s => toSale(s.id, s.data()))
    .sort((a, b) => b.createdAt - a.createdAt)
    // Buyers stay private: creators see what sold, when and their share.
    .map(({ buyerUid: _buyer, ...s }) => s)
  const paid = sales.filter(s => s.status === 'paid')
  const totals = {
    sales: paid.length,
    refunds: sales.length - paid.length,
    grossCents: paid.reduce((n, s) => n + s.grossCents, 0),
    earnedCents: paid.reduce((n, s) => n + s.creatorCents, 0),
  }
  return NextResponse.json({ sales: sales.slice(0, 200), totals }, { headers: { 'Cache-Control': 'private, no-store' } })
})
