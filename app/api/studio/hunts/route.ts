import { NextRequest, NextResponse } from 'next/server'
import { handle, readJson, rateLimit } from '@/lib/apiAuth'
import { requireCreator } from '@/lib/creators'
import { draftRef, draftsCol, newDraftId, toDraftRecord } from '@/lib/drafts'
import { ALL_LANGS, emptyContent } from '@/lib/huntDraft'
import { FieldValue } from '@/lib/firebaseAdmin'
import type { Lang } from '@/types'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store' }

/** GET /api/studio/hunts → { drafts: summary[] } — the caller's hunts. */
export const GET = handle(async (req: NextRequest) => {
  const { user } = await requireCreator(req)
  const snap = await draftsCol().where('ownerUid', '==', user.uid).get()
  const drafts = snap.docs
    .map(d => toDraftRecord(d.id, d.data()))
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    .map(d => ({
      id: d.id,
      title: d.content.title,
      cityId: d.content.cityId,
      tourType: d.content.tourType,
      stopCount: d.content.stops.length,
      status: d.status,
      live: d.live,
      publishedVersion: d.publishedVersion,
      rejectionReason: d.rejectionReason,
      updatedAt: d.updatedAt,
    }))
  return NextResponse.json({ drafts }, { headers })
})

/** POST /api/studio/hunts { sourceLang } → { id } — start a new draft. */
export const POST = handle(async (req: NextRequest) => {
  const { user } = await requireCreator(req)
  rateLimit(`studio-new:${user.uid}`, 10, 60 * 60_000)
  const body = await readJson(req)
  const lang = (ALL_LANGS as string[]).includes(String(body.sourceLang)) ? (body.sourceLang as Lang) : 'en'
  const existing = await draftsCol().where('ownerUid', '==', user.uid).count().get()
  if (existing.data().count >= 50) return NextResponse.json({ error: 'too_many_drafts' }, { status: 429 })
  const id = newDraftId()
  await draftRef(id).set({
    ownerUid: user.uid,
    status: 'draft',
    live: false,
    publishedVersion: 0,
    rejectionReason: null,
    content: emptyContent(lang),
    translations: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
  return NextResponse.json({ id }, { headers })
})
