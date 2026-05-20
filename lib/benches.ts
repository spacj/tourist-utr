import { db } from '@/lib/firebase'
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore'
import type { Bench } from '@/types'

/**
 * Server-side bench reads. Used by the /benches index, the per-bench SEO
 * pages, and the sitemap. The client gets benches via /api/benches instead.
 */

function coerce(id: string, raw: Record<string, any>): Bench {
  return {
    id,
    slug: String(raw.slug ?? id),
    title: String(raw.title ?? 'Bench'),
    description: String(raw.description ?? ''),
    category: String(raw.category ?? 'quiet'),
    lat: Number(raw.lat ?? 0),
    lng: Number(raw.lng ?? 0),
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
      .map(d => coerce(d.id, d.data()))
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
    return coerce(d.id, d.data())
  } catch {
    return null
  }
}
