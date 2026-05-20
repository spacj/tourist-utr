import { db } from '@/lib/firebase'
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore'
import { type Bench, benchCategoryIds } from '@/types'

/**
 * Server-side bench reads. Used by the /benches index, the per-bench SEO
 * pages, and the sitemap. The client gets benches via /api/benches instead.
 */

export function coerceBench(id: string, raw: Record<string, any>): Bench {
  return {
    id,
    slug: String(raw.slug ?? id),
    title: String(raw.title ?? 'Bench'),
    description: String(raw.description ?? ''),
    categories: benchCategoryIds(raw),
    lat: Number(raw.lat ?? 0),
    lng: Number(raw.lng ?? 0),
    address: raw.address ? String(raw.address) : undefined,
    postalCode: raw.postalCode ? String(raw.postalCode) : undefined,
    city: raw.city ? String(raw.city) : undefined,
    createdAt: typeof raw.createdAt === 'number'
      ? raw.createdAt
      : (raw.createdAt?.toMillis?.() ?? Date.now()),
    createdBy: raw.createdBy ? String(raw.createdBy) : undefined,
  }
}

/** All benches, newest first. */
export async function getAllBenches(): Promise<Bench[]> {
  try {
    const snap = await getDocs(collection(db, 'benches'))
    return snap.docs
      .map(d => coerceBench(d.id, d.data()))
      .sort((a, b) => b.createdAt - a.createdAt)
  } catch {
    return []
  }
}

/** A single bench by its slug, or null. */
export async function getBenchBySlug(slug: string): Promise<Bench | null> {
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
