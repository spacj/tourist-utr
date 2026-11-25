import { NextRequest, NextResponse } from 'next/server'
import { handle, HttpError } from '@/lib/apiAuth'
import { requireCreator } from '@/lib/creators'
import { draftRef, loadOwnedDraft, syncCreatorListings } from '@/lib/drafts'
import { FieldValue } from '@/lib/firebaseAdmin'

export const dynamic = 'force-dynamic'
type Ctx = { params: { id: string } }

/**
 * POST /api/studio/hunts/[id]/unpublish { live?: boolean } → { ok }
 * live=false (default) takes a published hunt out of the catalogue;
 * live=true puts the already-approved version back. Players who bought it
 * keep access either way.
 */
export const POST = handle<Ctx>(async (req: NextRequest, { params }) => {
  const { user } = await requireCreator(req)
  const draft = await loadOwnedDraft(user.uid, params.id)
  if (!draft.publishedVersion) throw new HttpError(409, 'not_published')
  let live = false
  try { live = (await req.json())?.live === true } catch {}
  const status = live
    ? (draft.status === 'unpublished' ? 'approved' : draft.status)
    : (draft.status === 'approved' ? 'unpublished' : draft.status)
  await draftRef(params.id).update({ live, status, updatedAt: FieldValue.serverTimestamp() })
  await syncCreatorListings(user.uid)
  return NextResponse.json({ ok: true })
})
