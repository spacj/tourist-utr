import { SITE_URL } from '@/lib/site'
import type { City, Hunt } from '@/types'

/**
 * Edge-safe catalogue lookups for OG images (firebase-admin can't run on
 * the edge, and @vercel/og's Node build breaks on Windows). Reads the public
 * /api/cities + /api/hunts of the production site; null on any failure so
 * the image falls back to a generic card.
 */
async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${SITE_URL}${path}`, { next: { revalidate: 300 } })
    return res.ok ? ((await res.json()) as T) : null
  } catch {
    return null
  }
}

export async function ogCityData(cityId: string): Promise<{ city: City | null; hunts: Hunt[] }> {
  const [cities, hunts] = await Promise.all([getJson<City[]>('/api/cities'), getJson<Hunt[]>('/api/hunts')])
  return {
    city: cities?.find(c => c.id === cityId) ?? null,
    hunts: (hunts ?? []).filter(h => h.cityId === cityId),
  }
}

export function prettyCityId(cityId: string): string {
  return cityId.replace(/^city_/, '').replace(/[_-]+/g, ' ').replace(/\b\w/g, m => m.toUpperCase())
}
