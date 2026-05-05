import type { MetadataRoute } from 'next'
import { db } from '@/lib/firebase'
import { collection, getDocs } from 'firebase/firestore'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://tourhunts.com'

export const revalidate = 3600 // refresh hourly

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const baseEntries: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/multiplayer`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
  ]

  const entries: MetadataRoute.Sitemap = [...baseEntries]

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

  return entries
}
