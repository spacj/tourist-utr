import { NextRequest, NextResponse } from 'next/server'
import { handle, requireAdmin, readJson, str, HttpError } from '@/lib/apiAuth'
import { creatorRef } from '@/lib/creators'
import { syncCreatorListings } from '@/lib/drafts'
import { FieldValue } from '@/lib/firebaseAdmin'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/admin/creators { uid, status?: 'active'|'suspended', commissionBps?: number|null }
 * Suspending unlists all of the creator's hunts (buyers keep access).
 * commissionBps null → back to the default rate.
 */
export const PATCH = handle(async (req: NextRequest) => {
  await requireAdmin(req)
  const body = await readJson(req)
  const uid = str(body.uid, 'uid')
  const ref = creatorRef(uid)
  if (!(await ref.get()).exists) throw new HttpError(404, 'creator_not_found')
  const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() }
  if (body.status !== undefined) {
    if (body.status !== 'active' && body.status !== 'suspended') throw new HttpError(400, 'invalid_status')
    update.status = body.status
  }
  if (body.commissionBps !== undefined) {
    const c = body.commissionBps
    if (c === null) update.commissionBps = FieldValue.delete()
    else if (typeof c === 'number' && Number.isInteger(c) && c >= 0 && c <= 10_000) update.commissionBps = c
    else throw new HttpError(400, 'invalid_commissionBps')
  }
  await ref.update(update)
  if (body.status !== undefined) await syncCreatorListings(uid)
  return NextResponse.json({ ok: true })
})
