import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { adminDb } from '@/lib/firebaseAdmin'
import { getActiveCities, getActiveCountries, getActiveHunts, isValidId } from '@/lib/catalog'
import { SITE_URL } from '@/lib/site'
import { CountryClient } from './CountryClient'
import type { Country } from '@/types'

// ISR. Firestore failures degrade to client-side fetching instead of erroring.
export const revalidate = 300

export async function generateStaticParams() {
  const countries = await getActiveCountries()
  return (countries ?? []).filter(c => !c.comingSoon).map(c => ({ countryId: c.id }))
}

/** `undefined` = Firestore unavailable; `null` = no such country. */
async function loadCountry(countryId: string): Promise<Country | null | undefined> {
  if (!isValidId(countryId)) return null
  try {
    const snap = await adminDb().collection('countries').doc(countryId).get()
    if (!snap.exists) return null
    const { createdAt: _c, updatedAt: _u, ...data } = snap.data() as Record<string, unknown>
    return { ...(data as unknown as Country), id: snap.id }
  } catch (e) {
    console.warn('[country page] Firestore unavailable:', (e as Error)?.message ?? e)
    return undefined
  }
}

export async function generateMetadata({ params }: { params: { countryId: string } }): Promise<Metadata> {
  const canonical = `/country/${params.countryId}`
  const country = await loadCountry(params.countryId)
  if (country === null) return { title: 'Not found', robots: { index: false } }
  const name = country?.name ?? params.countryId.toUpperCase()
  const title = `${name}: scavenger hunts & puzzle walks`
  const desc = country?.description || `GPS-guided scavenger hunts and puzzle walks in ${name}'s cities.`
  return {
    title,
    description: desc,
    alternates: { canonical },
    openGraph: { title, description: desc, url: canonical, type: 'website' },
    twitter: { card: 'summary_large_image', title, description: desc },
  }
}

export default async function CountryPage({ params }: { params: { countryId: string } }) {
  const country = await loadCountry(params.countryId)
  if (country === null) notFound()

  const [allCities, allHunts] = await Promise.all([getActiveCities(), getActiveHunts()])
  const cities = allCities ? allCities.filter(c => (c.countryId ?? 'nl') === params.countryId) : null
  const cityIds = new Set((cities ?? []).map(c => c.id))
  const hunts = (allHunts ?? []).filter(h => cityIds.has(h.cityId))

  // SEO: cities and hunt titles as structured data. Clue content is never
  // included; it lives behind /hunt sessions.
  const jsonLd = country && cities ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Scavenger hunts in ${country.name}`,
    itemListElement: cities.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE_URL}/city/${c.id}`,
      item: {
        '@type': 'TouristDestination',
        name: c.name,
        description: c.description,
        url: `${SITE_URL}/city/${c.id}`,
        includesAttraction: hunts.filter(h => h.cityId === c.id).map(h => ({
          '@type': 'TouristTrip',
          name: h.title,
          url: `${SITE_URL}/city/${c.id}/${h.id}`,
        })),
      },
    })),
  } : null

  return (
    <>
      <CountryClient
        countryId={params.countryId}
        initialCountry={country ?? null}
        initialCities={country ? cities : null}
      />
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
        />
      )}
    </>
  )
}
