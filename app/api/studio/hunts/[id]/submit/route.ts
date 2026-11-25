import { NextRequest, NextResponse } from 'next/server'
import { handle, rateLimit, HttpError } from '@/lib/apiAuth'
import { requireCreator } from '@/lib/creators'
import { draftProblems, draftRef, loadOwnedDraft } from '@/lib/drafts'
import { FieldValue } from '@/lib/firebaseAdmin'
import { adminEmail, link, sendEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'
type Ctx = { params: { id: string } }

/**
 * POST /api/studio/hunts/[id]/submit → { ok } or 422 { problems }.
 * Sends the draft for review once it passes validation.
 */
export const POST = handle<Ctx>(async (req: NextRequest, { params }) => {
  const { user, creator } = await requireCreator(req)
  rateLimit(`studio-submit:${user.uid}`, 20, 60 * 60_000)
  const draft = await loadOwnedDraft(user.uid, params.id)
  if (draft.status === 'pending_review') throw new HttpError(409, 'already_submitted')
  const problems = await draftProblems(draft.content)
  if (problems.length) return NextResponse.json({ error: 'draft_incomplete', problems }, { status: 422 })

  await draftRef(params.id).update({
    status: 'pending_review',
    rejectionReason: null,
    submittedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
  await sendEmail({
    to: adminEmail(),
    subject: `Hunt to review: ${draft.content.title}`,
    text: `${creator.displayName} sent "${draft.content.title}" (${draft.content.stops.length} stops) for review.\n\n${link(`/admin/review/${params.id}`)}`,
  })
  return NextResponse.json({ ok: true })
})
