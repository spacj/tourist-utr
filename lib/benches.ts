import { db } from '@/lib/firebase'
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore'
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

/** All spots of one kind, newest first. */
export async function getAllSpots(kind: SpotKind): Promise<Bench[]> {
  try {
    const snap = await getDocs(collection(db, 'benches'))
    return snap.docs
      .map(d => coerceBench(d.id, d.data()))
      .filter(s => s.kind === kind)
      .sort((a, b) => b.createdAt - a.createdAt)
  } catch {
    return []
  }
}

/** A single spot by slug (slug is unique across kinds), or null. */
export async function getSpotBySlug(slug: string): Promise<Bench | null> {
  try {
    const snap = await getDocs(
      query(collection(db, 'benches'), where('slug', '==', slug), limit(1))
    )
    if (snap.empty) return null
    const d = snap.docs[0]
    return coerceBench(d.id, d.data())
  } catch {
    return null
  }
}
