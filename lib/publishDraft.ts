import 'server-only'
import { revalidatePath } from 'next/cache'
import { adminDb, FieldValue } from '@/lib/firebaseAdmin'
import { HttpError, type AuthUser } from '@/lib/apiAuth'
import { cityCentre, draftProblems, draftRef, loadDraft, recountCity } from '@/lib/drafts'
import { getCreator, creatorRef } from '@/lib/creators'
import { buildPublishedHunt, validateTranslations, type DraftProblem } from '@/lib/huntDraft'
import { translateDraft } from '@/lib/translateHunt'
import { link, sendEmail } from '@/lib/email'

/**
 * Admin review actions. Approving translates the draft, validates the
 * translations, then writes hunts/{id} + clues in one batch (removing stops
 * that no longer exist) and lists it if the creator can take payments.
 */

export class PublishError extends HttpError {
  constructor(public problems: DraftProblem[]) {
    super(422, 'publish_blocked', { problems })
  }
}

async function creatorEmail(uid: string): Promise<string | null> {
  const e = (await creatorRef(uid).get()).data()?.email
  return typeof e === 'string' ? e : null
}

export async function approveDraft(id: string, admin: AuthUser, opts: { cityId?: string | null } = {}): Promise<{ active: boolean }> {
  const draft = await loadDraft(id)
  const creator = await getCreator(draft.ownerUid)
  if (!creator) throw new HttpError(409, 'creator_missing')

  // A requested city must exist before the hunt can be published.
  const content = { ...draft.content }
  if (opts.cityId) { content.cityId = opts.cityId; content.cityRequest = null }
  if (!content.cityId) throw new HttpError(409, 'city_required')
  const city = await cityCentre(content.cityId)
  if (!city) throw new HttpError(409, 'city_not_found')

  const problems = await draftProblems(content)
  if (problems.length) throw new PublishError(problems)

  const translations = await translateDraft(content)
  const trProblems = validateTranslations(content, translations)
  if (trProblems.length) {
    // Keep what we got so the admin can inspect it; nothing is published.
    await draftRef(id).update({ translations, updatedAt: FieldValue.serverTimestamp() })
    throw new PublishError(trProblems)
  }

  const version = draft.publishedVersion + 1
  const active = creator.chargesEnabled && creator.status === 'active'
  const { hunt, clues } = buildPublishedHunt(content, translations, {
    huntId: id,
    ownerUid: draft.ownerUid,
    creatorName: creator.displayName,
    creatorSlug: creator.slug,
    cityName: city.name ?? content.cityId,
    active,
    version,
    order: 1000,
  })

  const db = adminDb()
  const huntRef = db.collection('hunts').doc(id)
  const [existingHunt, existingClues] = await Promise.all([huntRef.get(), huntRef.collection('clues').get()])
  const previousCity = existingHunt.data()?.cityId
  const keep = new Set(clues.map(c => c.id))

  const batch = db.batch()
  batch.set(huntRef, {
    ...hunt,
    ...(existingHunt.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: false })
  for (const doc of existingClues.docs) if (!keep.has(doc.id)) batch.delete(doc.ref)
  for (const { id: clueId, ...data } of clues) batch.set(huntRef.collection('clues').doc(clueId), data)
  batch.update(draftRef(id), {
    content,
    translations,
    status: 'approved',
    live: true,
    publishedVersion: version,
    rejectionReason: null,
    reviewedAt: FieldValue.serverTimestamp(),
    reviewedBy: admin.uid,
    updatedAt: FieldValue.serverTimestamp(),
  })
  await batch.commit()

  await recountCity(content.cityId)
  if (typeof previousCity === 'string' && previousCity !== content.cityId) await recountCity(previousCity)
  for (const p of ['/', `/city/${content.cityId}`, `/city/${content.cityId}/${id}`, `/creators/${creator.slug}`]) {
    try { revalidatePath(p) } catch { /* outside a request scope (tests) */ }
  }

  await sendEmail({
    to: await creatorEmail(draft.ownerUid),
    subject: `Your hunt "${content.title}" is approved`,
    text: active
      ? `Good news: "${content.title}" is live on TourHunts.\n\n${link(`/city/${content.cityId}/${id}`)}`
      : `Good news: "${content.title}" is approved. Finish your payout setup in your studio so players can buy it:\n\n${link('/studio')}`,
  })
  return { active }
}

export async function rejectDraft(id: string, admin: AuthUser, reason: string): Promise<void> {
  const draft = await loadDraft(id)
  const text = reason.trim().slice(0, 2000)
  if (text.length < 5) throw new HttpError(400, 'reason_required')
  await draftRef(id).update({
    status: 'rejected',
    rejectionReason: text,
    reviewedAt: FieldValue.serverTimestamp(),
    reviewedBy: admin.uid,
    updatedAt: FieldValue.serverTimestamp(),
  })
  await sendEmail({
    to: await creatorEmail(draft.ownerUid),
    subject: `Changes needed for "${draft.content.title}"`,
    text: `Thanks for sending "${draft.content.title}". Before it can go live, please look at this:\n\n${text}\n\nEdit and send it again from your studio: ${link(`/studio/hunts/${id}`)}`,
  })
}
