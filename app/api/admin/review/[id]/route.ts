import { NextRequest, NextResponse } from 'next/server'
import { handle, requireAdmin, readJson, optionalId, HttpError } from '@/lib/apiAuth'
import { draftProblems, loadDraft } from '@/lib/drafts'
import { getCreator } from '@/lib/creators'
import { approveDraft, rejectDraft } from '@/lib/publishDraft'

export const dynamic = 'force-dynamic'
// Approving translates the hunt into five languages (a minute or two).
export const maxDuration = 300
const headers = { 'Cache-Control': 'private, no-store' }
type Ctx = { params: { id: string } }

/** GET /api/admin/review/[id] → { draft, creator, problems } — everything incl. answers. */
export const GET = handle<Ctx>(async (req: NextRequest, { params }) => {
  await requireAdmin(req)
  const draft = await loadDraft(params.id)
  const [creator, problems] = await Promise.all([getCreator(draft.ownerUid), draftProblems(draft.content)])
  return NextResponse.json({ draft, creator, problems }, { headers })
})

/**
 * POST /api/admin/review/[id]
 *   { action: 'approve', cityId? } → { ok, active }  (422 { problems } when blocked)
 *   { action: 'reject', reason }   → { ok }
 */
export const POST = handle<Ctx>(async (req: NextRequest, { params }) => {
  const admin = await requireAdmin(req)
  const body = await readJson(req)
  if (body.action === 'approve') {
    const { active } = await approveDraft(params.id, admin, { cityId: optionalId(body.cityId, 'cityId') })
    return NextResponse.json({ ok: true, active }, { headers })
  }
  if (body.action === 'reject') {
    await rejectDraft(params.id, admin, typeof body.reason === 'string' ? body.reason : '')
    return NextResponse.json({ ok: true }, { headers })
  }
  throw new HttpError(400, 'invalid_action')
})
