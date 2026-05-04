import type { MetadataRoute } from 'next'
import { db } from '@/lib/firebase'
import { collection, getDocs } from 'firebase/firestore'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://nl-tour.app'

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

  try {
    const citiesSnap = await getDocs(collection(db, 'cities'))
    const cityEntries: MetadataRoute.Sitemap = citiesSnap.docs
      .filter(d => d.data().active !== false)
      .map(d => ({
        url: `${SITE_URL}/city/${d.id}`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.9,
      }))
    return [...baseEntries, ...cityEntries]
  } catch {
    return baseEntries
  }
}
