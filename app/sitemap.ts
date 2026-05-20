import type { MetadataRoute } from 'next'
import { db } from '@/lib/firebase'
import { collection, getDocs } from 'firebase/firestore'
import { getAllPostsMeta } from '@/lib/blog'
import { getAllBenches } from '@/lib/benches'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://tourhunts.com'

export const revalidate = 3600 // refresh hourly

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const entries: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/blog`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.85,
    },
    {
      url: `${SITE_URL}/multiplayer`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/benches`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.8,
    },
  ]

  // Benches — every bench is its own indexable page with a geo + description.
  // This is where the "as many results as possible" volume comes from.
  try {
    for (const bench of await getAllBenches()) {
      entries.push({
        url: `${SITE_URL}/benches/${bench.slug}`,
        lastModified: new Date(bench.createdAt),
        changeFrequency: 'monthly',
        priority: 0.6,
      })
    }
  } catch {}

  // Blog posts — each gets its own URL with dateModified for crawl freshness.
  for (const post of getAllPostsMeta()) {
    entries.push({
      url: `${SITE_URL}/blog/${post.slug}`,
      lastModified: new Date(post.updatedAt ?? post.publishedAt),
      changeFrequency: 'monthly',
      priority: 0.7,
    })
  }

  // Countries: only active and not coming-soon get sitemap entries.
  try {
    const countriesSnap = await getDocs(collection(db, 'countries'))
    countriesSnap.docs
      .filter(d => d.data().active !== false && !d.data().comingSoon)
      .forEach(d => {
        entries.push({
          url: `${SITE_URL}/country/${d.id}`,
          lastModified: now,
          changeFrequency: 'weekly',
          priority: 0.95,
        })
      })
  } catch {}

  // Cities — surfaced because the city page lists hunts with title + description.
  try {
    const citiesSnap = await getDocs(collection(db, 'cities'))
    citiesSnap.docs
      .filter(d => d.data().active !== false)
      .forEach(d => {
        entries.push({
          url: `${SITE_URL}/city/${d.id}`,
          lastModified: now,
          changeFrequency: 'weekly',
          priority: 0.9,
        })
      })
  } catch {}

  // Note: /hunt and /tour are NOT included — they require a session and would
  // expose clue/tour content. They're disallowed in robots.txt.

  return entries
}
