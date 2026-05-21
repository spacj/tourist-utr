import type { MetadataRoute } from 'next'
import { db } from '@/lib/firebase'
import { collection, getDocs } from 'firebase/firestore'
import { getAllPostsMeta } from '@/lib/blog'
import { getAllBenches } from '@/lib/benches'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://tourhunts.com'

// Hourly ISR is the safety net for content that only changes via the seed
// script (cities, countries). Bench writes additionally trigger on-demand
// revalidation of this route, so new/edited benches surface immediately.
export const revalidate = 3600

/** Coerce a Firestore value (Timestamp | ms-number | undefined) to a Date. */
function toDate(v: unknown, fallback: Date): Date {
  if (typeof v === 'number') return new Date(v)
  const ms = (v as { toMillis?: () => number } | null | undefined)?.toMillis?.()
  return ms ? new Date(ms) : fallback
}

/** Most recent of a list of dates (or `fallback` if the list is empty). */
function newest(dates: Date[], fallback: Date): Date {
  return dates.reduce((max, d) => (d > max ? d : max), fallback)
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const epoch = new Date(0)

  // ── Benches ──────────────────────────────────────────────────────
  // Each bench is its own indexable page; lastmod tracks the edit time so a
  // repositioned/retitled bench tells crawlers it actually changed.
  const benchEntries: MetadataRoute.Sitemap = []
  let benchesLastMod = epoch
  try {
    for (const bench of await getAllBenches()) {
      const mod = new Date(bench.updatedAt ?? bench.createdAt)
      if (mod > benchesLastMod) benchesLastMod = mod
      benchEntries.push({
        url: `${SITE_URL}/benches/${bench.slug}`,
        lastModified: mod,
        changeFrequency: 'monthly',
        priority: 0.6,
      })
    }
  } catch {}

  // ── Blog posts ───────────────────────────────────────────────────
  const posts = getAllPostsMeta()
  const blogEntries: MetadataRoute.Sitemap = posts.map(post => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.updatedAt ?? post.publishedAt),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))
  const blogLastMod = newest(blogEntries.map(e => e.lastModified as Date), epoch)

  // ── Countries ────────────────────────────────────────────────────
  const countryEntries: MetadataRoute.Sitemap = []
  try {
    const countriesSnap = await getDocs(collection(db, 'countries'))
    countriesSnap.docs
      .filter(d => d.data().active !== false && !d.data().comingSoon)
      .forEach(d => {
        const data = d.data()
        countryEntries.push({
          url: `${SITE_URL}/country/${d.id}`,
          lastModified: toDate(data.updatedAt ?? data.createdAt, now),
          changeFrequency: 'weekly',
          priority: 0.95,
        })
      })
  } catch {}

  // ── Cities ───────────────────────────────────────────────────────
  const cityEntries: MetadataRoute.Sitemap = []
  try {
    const citiesSnap = await getDocs(collection(db, 'cities'))
    citiesSnap.docs
      .filter(d => d.data().active !== false)
      .forEach(d => {
        const data = d.data()
        cityEntries.push({
          url: `${SITE_URL}/city/${d.id}`,
          lastModified: toDate(data.updatedAt ?? data.createdAt, now),
          changeFrequency: 'weekly',
          priority: 0.9,
        })
      })
  } catch {}

  // ── Static / index pages ─────────────────────────────────────────
  // Their lastmod reflects the freshest item they list, so the value moves
  // only when real content changes — not on every revalidation tick.
  const allContentLastMod = newest(
    [
      benchesLastMod,
      blogLastMod,
      ...countryEntries.map(e => e.lastModified as Date),
      ...cityEntries.map(e => e.lastModified as Date),
    ],
    now
  )

  const staticEntries: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: allContentLastMod, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/blog`, lastModified: newest([blogLastMod], now), changeFrequency: 'weekly', priority: 0.85 },
    { url: `${SITE_URL}/multiplayer`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/benches`, lastModified: newest([benchesLastMod], now), changeFrequency: 'daily', priority: 0.8 },
  ]

  // Note: /hunt and /tour are NOT included — they require a session and would
  // expose clue/tour content. They're disallowed in robots.txt.

  return [...staticEntries, ...benchEntries, ...blogEntries, ...countryEntries, ...cityEntries]
}
