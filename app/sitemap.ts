import type { MetadataRoute } from 'next'
import { getAllPostsMeta } from '@/lib/blog'
import { getAllSpots } from '@/lib/benches'
import { getActiveCities, getActiveCountries, getActiveHunts } from '@/lib/catalog'
import { LEGAL, SITE_URL } from '@/lib/site'
import { SPOT_KINDS, type SpotKind } from '@/types'

// Hourly ISR is the safety net for content that only changes via the seed
// script (cities, countries, hunts). Bench writes additionally trigger
// on-demand revalidation of this route, so new/edited benches surface quickly.
export const revalidate = 3600

/** Most recent of a list of dates, or undefined if none is known. */
function newest(dates: (Date | undefined)[]): Date | undefined {
  return dates.reduce<Date | undefined>((max, d) => (d && (!max || d > max) ? d : max), undefined)
}

function fromMs(ms: number | undefined): Date | undefined {
  return typeof ms === 'number' && ms > 0 ? new Date(ms) : undefined
}

/**
 * lastModified is only set when we actually know it (content timestamps,
 * post dates, the legal "updated" date). A made-up "now" would change on
 * every regeneration and teach crawlers to ignore the field.
 *
 * Excluded on purpose: /hunt and /tour (session-bound, would expose clues),
 * /profile, /multiplayer/<code>, admin forms. See robots.ts.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entry = (
    path: string,
    lastModified: Date | undefined,
    changeFrequency: NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>,
    priority: number,
  ): MetadataRoute.Sitemap[number] => ({
    url: `${SITE_URL}${path}`,
    ...(lastModified ? { lastModified } : {}),
    changeFrequency,
    priority,
  })

  // ── Spots (benches + fountains) ──────────────────────────────────
  const spotEntries: MetadataRoute.Sitemap = []
  const spotLastMod: Record<SpotKind, Date | undefined> = { bench: undefined, fountain: undefined }
  for (const kind of ['bench', 'fountain'] as SpotKind[]) {
    const base = SPOT_KINDS[kind].urlBase
    try {
      for (const spot of await getAllSpots(kind)) {
        const mod = new Date(spot.updatedAt ?? spot.createdAt)
        const valid = Number.isFinite(mod.getTime()) ? mod : undefined
        spotLastMod[kind] = newest([spotLastMod[kind], valid])
        spotEntries.push(entry(`/${base}/${spot.slug}`, valid, 'monthly', 0.6))
      }
    } catch (e) { console.warn('[sitemap] spots unavailable', (e as Error)?.message ?? e) }
  }

  // ── Blog ─────────────────────────────────────────────────────────
  const blogEntries = getAllPostsMeta().map(post => {
    const d = new Date(post.updatedAt ?? post.publishedAt)
    return entry(`/blog/${post.slug}`, Number.isFinite(d.getTime()) ? d : undefined, 'monthly', 0.7)
  })
  const blogLastMod = newest(blogEntries.map(e => e.lastModified as Date | undefined))

  // ── Catalogue: countries → cities → hunt landing pages ───────────
  const [countries, cities, hunts] = await Promise.all([getActiveCountries(), getActiveCities(), getActiveHunts()])

  const activeCityIds = new Set((cities ?? []).map(c => c.id))
  const huntEntries: MetadataRoute.Sitemap = []
  const cityHuntLastMod = new Map<string, Date | undefined>()
  for (const h of hunts ?? []) {
    if (!activeCityIds.has(h.cityId)) continue
    const mod = fromMs(h.updatedAt)
    cityHuntLastMod.set(h.cityId, newest([cityHuntLastMod.get(h.cityId), mod]))
    huntEntries.push(entry(`/city/${h.cityId}/${h.id}`, mod, 'monthly', 0.8))
  }

  const cityEntries = (cities ?? []).map(c =>
    entry(`/city/${c.id}`, newest([fromMs(c.updatedAt), cityHuntLastMod.get(c.id)]), 'weekly', 0.9),
  )

  const countryEntries = (countries ?? [])
    .filter(c => !c.comingSoon)
    .map(c => {
      const childMods = (cities ?? [])
        .filter(city => (city.countryId ?? 'nl') === c.id)
        .map(city => newest([fromMs(city.updatedAt), cityHuntLastMod.get(city.id)]))
      return entry(`/country/${c.id}`, newest([fromMs(c.updatedAt), ...childMods]), 'weekly', 0.95)
    })

  // ── Static pages ─────────────────────────────────────────────────
  const legalDate = new Date(LEGAL.updated)
  const legalMod = Number.isFinite(legalDate.getTime()) ? legalDate : undefined
  const everything = newest([
    spotLastMod.bench, spotLastMod.fountain, blogLastMod,
    ...countryEntries.map(e => e.lastModified as Date | undefined),
    ...cityEntries.map(e => e.lastModified as Date | undefined),
  ])

  const staticEntries: MetadataRoute.Sitemap = [
    entry('', everything, 'weekly', 1),
    entry('/blog', blogLastMod, 'weekly', 0.85),
    entry('/multiplayer', undefined, 'monthly', 0.6),
    entry('/benches', spotLastMod.bench, 'daily', 0.8),
    entry('/fountains', spotLastMod.fountain, 'daily', 0.8),
    entry('/contact', legalMod, 'yearly', 0.3),
    entry('/privacy', legalMod, 'yearly', 0.2),
    entry('/terms', legalMod, 'yearly', 0.2),
  ]

  return [
    ...staticEntries,
    ...countryEntries,
    ...cityEntries,
    ...huntEntries,
    ...blogEntries,
    ...spotEntries,
  ]
}
