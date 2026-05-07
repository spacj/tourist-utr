import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { db } from '@/lib/firebase'
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { CountryClient } from './CountryClient'
import { Country } from '@/types'

export const dynamic = 'force-dynamic'
export const revalidate = 60

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://tourhunts.com'

async function loadCountry(countryId: string): Promise<Country | null> {
  const snap = await getDoc(doc(db, 'countries', countryId))
  if (!snap.exists()) return null
  return { id: snap.id, ...(snap.data() as any) } as Country
}

async function loadCitySummaries(countryId: string) {
  try {
    const snap = await getDocs(query(collection(db, 'cities'), where('active', '==', true)))
    return snap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }))
      .filter(c => (c.countryId ?? 'nl') === countryId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  } catch {
    return []
  }
}

async function loadHuntSummaries(cityIds: string[]) {
  if (cityIds.length === 0) return []
  try {
    // Fetch all hunts and filter — small dataset, simpler than chunked `in` queries.
    const snap = await getDocs(query(collection(db, 'hunts'), where('active', '==', true)))
    return snap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }))
      .filter(h => cityIds.includes(h.cityId))
  } catch {
    return []
  }
}

export async function generateMetadata({ params }: { params: { countryId: string } }): Promise<Metadata> {
  const country = await loadCountry(params.countryId)
  if (!country) return { title: 'Not found' }
  const title = `${country.name} hunts — TourHunts`
  const desc = country.description || `GPS-guided scavenger hunts in ${country.name} cities.`
  const url = `${SITE_URL}/country/${country.id}`
  return {
    title,
    description: desc,
    alternates: { canonical: url },
    openGraph: { title, description: desc, url, type: 'website' },
    twitter: { card: 'summary_large_image', title, description: desc },
  }
}

export default async function CountryPage({ params }: { params: { countryId: string } }) {
  const country = await loadCountry(params.countryId)
  if (!country) notFound()

  // SEO: surface hunt titles + descriptions as TouristAttraction structured data.
  // Clue content is intentionally never included — those live behind /hunt sessions
  // and stay out of public crawl indexes.
  const cities = await loadCitySummaries(country.id)
  const hunts = await loadHuntSummaries(cities.map(c => c.id))

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${country.name} hunts`,
    itemListElement: hunts.map((h: any, i: number) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'TouristAttraction',
        name: h.title,
        description: h.description,
        touristType: 'Walking tour',
      },
    })),
  }

  return (
    <>
      <CountryClient country={country} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
    </>
  )
}
