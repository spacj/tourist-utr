import 'server-only'
import type { DocumentData } from 'firebase-admin/firestore'
import { adminDb, FieldValue } from '@/lib/firebaseAdmin'
import { HttpError, requireUser, type AuthUser } from '@/lib/apiAuth'
import { slugCandidates, slugify, type CreatorProfileInput } from '@/lib/creatorProfile'
import { commissionBpsFor } from '@/lib/revenueSplit'
import type { CreatorProfile } from '@/types'

/**
 * Creator accounts (marketplace). Server-only collections, written only via
 * the Admin SDK (firestore.rules denies clients by default):
 *   creators/{uid}        the profile, Stripe Connect state, commission
 *   creatorSlugs/{slug}   { uid } — makes /creators/[slug] unique
 */

export function creatorRef(uid: string) {
  return adminDb().collection('creators').doc(uid)
}

function slugRef(slug: string) {
  return adminDb().collection('creatorSlugs').doc(slug)
}

function toMs(v: unknown): number | undefined {
  const ms = (v as { toMillis?: () => number } | null | undefined)?.toMillis?.()
  return typeof ms === 'number' ? ms : undefined
}

export function toCreatorProfile(uid: string, d: DocumentData): CreatorProfile {
  return {
    uid,
    displayName: typeof d.displayName === 'string' ? d.displayName : '',
    slug: typeof d.slug === 'string' ? d.slug : '',
    bio: typeof d.bio === 'string' ? d.bio : '',
    avatarUrl: typeof d.avatarUrl === 'string' ? d.avatarUrl : undefined,
    country: typeof d.country === 'string' ? d.country : '',
    status: d.status === 'suspended' ? 'suspended' : 'active',
    commissionBps: commissionBpsFor(d),
    termsAcceptedAt: toMs(d.termsAcceptedAt) ?? null,
    stripeAccountId: typeof d.stripeAccountId === 'string' ? d.stripeAccountId : null,
    chargesEnabled: d.chargesEnabled === true,
    payoutsEnabled: d.payoutsEnabled === true,
    createdAt: toMs(d.createdAt),
  }
}

export async function getCreator(uid: string): Promise<CreatorProfile | null> {
  const snap = await creatorRef(uid).get()
  return snap.exists ? toCreatorProfile(uid, snap.data() ?? {}) : null
}

/**
 * Require a registered user with an active creator profile whose creator
 * terms are accepted. Admins pass too (they may act on any creator's hunt
 * through the admin routes, but those check ownership separately).
 */
export async function requireCreator(req: Request): Promise<{ user: AuthUser; creator: CreatorProfile }> {
  const user = await requireUser(req, { registered: true })
  const creator = await getCreator(user.uid)
  if (!creator) throw new HttpError(403, 'not_a_creator')
  if (creator.status !== 'active') throw new HttpError(403, 'creator_suspended')
  if (!creator.termsAcceptedAt) throw new HttpError(403, 'creator_terms_required')
  return { user, creator }
}

/**
 * Create or update the caller's creator profile. The slug is reserved once
 * (on creation) and stays stable when the display name changes, so links
 * to /creators/[slug] never break. Terms must be accepted to create.
 */
export async function upsertCreatorProfile(user: AuthUser, input: CreatorProfileInput): Promise<CreatorProfile> {
  const db = adminDb()
  const ref = creatorRef(user.uid)
  const base = slugify(input.displayName)

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (snap.exists) {
      const d = snap.data() ?? {}
      const update: Record<string, unknown> = {
        displayName: input.displayName,
        bio: input.bio,
        updatedAt: FieldValue.serverTimestamp(),
      }
      // Country decides the Stripe account; frozen once one exists.
      if (!d.stripeAccountId) update.country = input.country
      if (input.acceptTerms && !d.termsAcceptedAt) update.termsAcceptedAt = FieldValue.serverTimestamp()
      tx.update(ref, update)
      return
    }

    if (!input.acceptTerms) throw new HttpError(400, 'creator_terms_required')
    // Reserve the first free slug candidate (reads before writes).
    const candidates = slugCandidates(base)
    const slugSnaps = await tx.getAll(...candidates.map(slugRef))
    const free = slugSnaps.find(s => !s.exists || s.data()?.uid === user.uid)
    if (!free) throw new HttpError(409, 'slug_unavailable')
    const slug = free.id

    tx.set(slugRef(slug), { uid: user.uid, createdAt: FieldValue.serverTimestamp() })
    tx.set(ref, {
      displayName: input.displayName,
      slug,
      bio: input.bio,
      avatarUrl: user.photoURL ?? null,
      country: input.country,
      email: user.email ?? null,
      status: 'active',
      termsAcceptedAt: FieldValue.serverTimestamp(),
      stripeAccountId: null,
      chargesEnabled: false,
      payoutsEnabled: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
  })

  const created = await getCreator(user.uid)
  if (!created) throw new HttpError(500, 'creator_write_failed')
  return created
}
