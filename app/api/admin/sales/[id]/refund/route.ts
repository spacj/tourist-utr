import { NextRequest, NextResponse } from 'next/server'
import { handle, requireAdmin, id } from '@/lib/apiAuth'
import { refundSale } from '@/lib/creatorPayments'

export const dynamic = 'force-dynamic'
type Ctx = { params: { id: string } }

/**
 * POST /api/admin/sales/[id]/refund → { ok }
 * Full refund of a creator-hunt sale: the player gets the money back, the
 * creator's share is reversed, the player loses access.
 */
export const POST = handle<Ctx>(async (req: NextRequest, { params }) => {
  await requireAdmin(req)
  await refundSale(id(params.id, 'saleId'))
  return NextResponse.json({ ok: true })
})
