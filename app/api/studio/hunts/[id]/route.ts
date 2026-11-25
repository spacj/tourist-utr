import { NextRequest, NextResponse } from 'next/server'
import { handle, readJson, rateLimit, HttpError } from '@/lib/apiAuth'
import { requireCreator } from '@/lib/creators'
import { draftProblems, draftRef, loadOwnedDraft } from '@/lib/drafts'
import { sanitizeDraftContent } from '@/lib/huntDraft'
import { FieldValue } from '@/lib/firebaseAdmin'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store' }
type Ctx = { params: { id: string } }

/** GET /api/studio/hunts/[id] → { draft, problems } */
export const GET = handle<Ctx>(async (req: NextRequest, { params }) => {
  const { user } = await requireCreator(req)
  const draft = await loadOwnedDraft(user.uid, params.id)
  return NextResponse.json({ draft, problems: await draftProblems(draft.content) }, { headers })
})

/**
 * PATCH /api/studio/hunts/[id] DraftContent → { draft, problems }
 * Saving returns the draft to 'draft' (a changed hunt needs a new review);
 * the published version stays live meanwhile.
 */
export const PATCH = handle<Ctx>(async (req: NextRequest, { params }) => {
  const { user } = await requireCreator(req)
  rateLimit(`studio-save:${user.uid}`, 120, 60_000)
  const existing = await loadOwnedDraft(user.uid, params.id)
  const content = sanitizeDraftContent(await readJson(req))
  // The language a hunt is written in is fixed once it has been published.
  if (existing.publishedVersion && content.sourceLang !== existing.content.sourceLang) {
    throw new HttpError(400, 'source_lang_locked')
  }
  await draftRef(params.id).update({
    content,
    status: existing.status === 'unpublished' ? 'unpublished' : 'draft',
    updatedAt: FieldValue.serverTimestamp(),
  })
  const draft = await loadOwnedDraft(user.uid, params.id)
  return NextResponse.json({ draft, problems: await draftProblems(draft.content) }, { headers })
})

/** DELETE /api/studio/hunts/[id] — only drafts that were never published. */
export const DELETE = handle<Ctx>(async (req: NextRequest, { params }) => {
  const { user } = await requireCreator(req)
  const draft = await loadOwnedDraft(user.uid, params.id)
  if (draft.publishedVersion) throw new HttpError(409, 'published_use_unpublish')
  await draftRef(params.id).delete()
  return NextResponse.json({ ok: true }, { headers })
})
