import 'server-only'
import { adminDb } from '@/lib/firebaseAdmin'
import { type Bench, type SpotKind, deriveSpotKind, spotCategoryIds } from '@/types'

/**
 * Server-side spot reads (benches + fountains share the `benches` collection,
 * discriminated by a `kind` field). Used by the /benches and /fountains
 * indexes, the per-spot SEO pages, and the sitemap. The client fetches via
 * /api/benches instead.
 */

export function coerceBench(id: string, raw: Record<string, any>): Bench {
  const kind = deriveSpotKind(raw)
  return {
    id,
    slug: String(raw.slug ?? id),
    kind,
    title: String(raw.title ?? (kind === 'fountain' ? 'Fountain' : 'Bench')),
    description: String(raw.description ?? ''),
    categories: spotCategoryIds(raw, kind),
    lat: Number(raw.lat ?? 0),
    lng: Number(raw.lng ?? 0),
    address: raw.address ? String(raw.address) : undefined,
    postalCode: raw.postalCode ? String(raw.postalCode) : undefined,
    city: raw.city ? String(raw.city) : undefined,
    createdAt: typeof raw.createdAt === 'number'
      ? raw.createdAt
      : (raw.createdAt?.toMillis?.() ?? Date.now()),
    updatedAt: typeof raw.updatedAt === 'number'
      ? raw.updatedAt
      : (raw.updatedAt?.toMillis?.() ?? undefined),
    createdBy: raw.createdBy ? String(raw.createdBy) : undefined,
  }
}
export const coerceSpot = coerceBench

/** Every spot (both kinds), newest first. */
export async function getEverySpot(): Promise<Bench[]> {
  const snap = await adminDb().collection('benches').get()
  return snap.docs
    .map(d => coerceBench(d.id, d.data()))
    .sort((a, b) => b.createdAt - a.createdAt)
}

/** All spots of one kind, newest first. */
export async function getAllSpots(kind: SpotKind): Promise<Bench[]> {
  try {
    return (await getEverySpot()).filter(s => s.kind === kind)
  } catch (e) {
    console.error('[benches] getAllSpots failed', e)
    return []
  }
}

/** A single spot by slug (slug is unique across kinds), or null. */
export async function getSpotBySlug(slug: string): Promise<Bench | null> {
  try {
    const snap = await adminDb().collection('benches').where('slug', '==', slug).limit(1).get()
    if (snap.empty) return null
    const d = snap.docs[0]
    return coerceBench(d.id, d.data())
  } catch (e) {
    console.error('[benches] getSpotBySlug failed', e)
    return null
  }
}
