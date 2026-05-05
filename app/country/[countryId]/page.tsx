import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
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
  return <CountryClient country={country} />
}
