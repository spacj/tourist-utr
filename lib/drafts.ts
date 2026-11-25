import 'server-only'
import { randomBytes } from 'node:crypto'
import type { DocumentData } from 'firebase-admin/firestore'
import { adminDb, FieldValue } from '@/lib/firebaseAdmin'
import { HttpError } from '@/lib/apiAuth'
import { cityCenter } from '@/lib/cityGeo'
import {
  emptyContent, validateDraft, type DraftContent, type DraftProblem, type DraftTranslations,
} from '@/lib/huntDraft'
import type { HuntDraftStatus } from '@/types'

/**
 * Creator drafts in Firestore (server-only collection huntDrafts/{id}; the
 * draft id is also the published hunt id). Pure rules live in lib/huntDraft.
 *
 *   status    draft → pending_review → approved | rejected; unpublished
 *   live      the creator wants the published version listed
 *   publishedVersion  > 0 once a version is in hunts/{id}
 *
 * A published hunt is listed (hunts.active) only when the draft is live AND
 * the creator's Stripe account can take payments AND the creator is active.
 * Players who bought a hunt keep playing it when it is no longer listed.
 */

export interface DraftRecord {
  id: string
  ownerUid: string
  status: HuntDraftStatus
  live: boolean
  publishedVersion: number
  rejectionReason: string | null
  content: DraftContent
  translations: DraftTranslations | null
  submittedAt: number | null
  reviewedAt: number | null
  updatedAt: number | null
  createdAt: number | null
}

export const draftsCol = () => adminDb().collection('huntDrafts')
export const draftRef = (id: string) => draftsCol().doc(id)

const ms = (v: unknown): number | null => {
  const n = (v as { toMillis?: () => number } | null | undefined)?.toMillis?.()
  return typeof n === 'number' ? n : null
}

const STATUSES: HuntDraftStatus[] = ['draft', 'pending_review', 'approved', 'rejected', 'unpublished']

export function toDraftRecord(id: string, d: DocumentData): DraftRecord {
  const base = emptyContent()
  const c = (d.content ?? {}) as Partial<DraftContent>
  return {
    id,
    ownerUid: String(d.ownerUid ?? ''),
    status: STATUSES.includes(d.status) ? d.status : 'draft',
    live: d.live === true,
    publishedVersion: Number(d.publishedVersion) || 0,
    rejectionReason: typeof d.rejectionReason === 'string' ? d.rejectionReason : null,
    content: { ...base, ...c, stops: Array.isArray(c.stops) ? c.stops : [] },
    translations: d.translations && typeof d.translations === 'object' ? d.translations : null,
    submittedAt: ms(d.submittedAt),
    reviewedAt: ms(d.reviewedAt),
    updatedAt: ms(d.updatedAt),
    createdAt: ms(d.createdAt),
  }
}

export function newDraftId(): string {
  return `c_${randomBytes(9).toString('hex')}`
}

export async function loadDraft(id: string): Promise<DraftRecord> {
  if (!/^c_[a-f0-9]{18}$/.test(id)) throw new HttpError(404, 'draft_not_found')
  const snap = await draftRef(id).get()
  if (!snap.exists) throw new HttpError(404, 'draft_not_found')
  return toDraftRecord(snap.id, snap.data() ?? {})
}

/** The draft, if the caller owns it (else 404 — never reveal other drafts). */
export async function loadOwnedDraft(uid: string, id: string): Promise<DraftRecord> {
  const d = await loadDraft(id)
  if (d.ownerUid !== uid) throw new HttpError(404, 'draft_not_found')
  return d
}

/** City centre for validation (null when unknown → no distance check). */
export async function cityCentre(cityId: string | null): Promise<{ lat?: number; lng?: number; name?: string } | null> {
  if (!cityId) return null
  const snap = await adminDb().collection('cities').doc(cityId).get()
  if (!snap.exists) return null
  const d = snap.data() ?? {}
  const centre = cityCenter({ id: cityId, lat: d.lat, lng: d.lng })
  return {
    name: typeof d.name === 'string' ? d.name : undefined,
    ...(centre ?? {}),
  }
}

export async function draftProblems(d: DraftContent): Promise<DraftProblem[]> {
  return validateDraft(d, await cityCentre(d.cityId))
}

/** Recount hunts.active per city (and its country) after listing changes. */
export async function recountCity(cityId: string | null | undefined): Promise<void> {
  if (!cityId) return
  const db = adminDb()
  const count = await db.collection('hunts').where('cityId', '==', cityId).where('active', '==', true).count().get()
  const cityRef = db.collection('cities').doc(cityId)
  const city = await cityRef.get()
  if (!city.exists) return
  await cityRef.update({ huntCount: count.data().count })
  const countryId = city.data()?.countryId
  if (typeof countryId === 'string' && countryId) {
    const cities = await db.collection('cities').where('countryId', '==', countryId).get()
    const total = cities.docs.reduce((n, c) => n + (c.id === cityId ? count.data().count : Number(c.data().huntCount) || 0), 0)
    await db.collection('countries').doc(countryId).set({ huntCount: total }, { merge: true })
  }
}

/**
 * Bring hunts.active for every published hunt of a creator in line with
 * the listing rule. Called when Stripe status or creator status changes.
 */
export async function syncCreatorListings(uid: string): Promise<void> {
  const db = adminDb()
  const [creatorSnap, drafts] = await Promise.all([
    db.collection('creators').doc(uid).get(),
    draftsCol().where('ownerUid', '==', uid).get(),
  ])
  const c = creatorSnap.data() ?? {}
  const canSell = c.chargesEnabled === true && c.status !== 'suspended'
  const cities = new Set<string>()
  for (const doc of drafts.docs) {
    const d = toDraftRecord(doc.id, doc.data())
    if (!d.publishedVersion) continue
    const huntRef = db.collection('hunts').doc(d.id)
    const hunt = await huntRef.get()
    if (!hunt.exists) continue
    const active = d.live && canSell
    if (hunt.data()?.active !== active) {
      await huntRef.update({ active, updatedAt: FieldValue.serverTimestamp() })
      const cityId = hunt.data()?.cityId
      if (typeof cityId === 'string') cities.add(cityId)
    }
  }
  for (const cityId of cities) await recountCity(cityId)
}
