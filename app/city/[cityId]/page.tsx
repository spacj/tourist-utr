import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getActiveCities, getCityWithHunts, isValidId, type PublicCity, type PublicHunt } from '@/lib/catalog'
import { SITE_URL } from '@/lib/site'
import { huntPriceEuros, isTour } from '@/types'
import { CityClient } from './CityClient'

// ISR: the catalogue only changes through the seed script.
export const revalidate = 300

/** Prerender known cities when the build can read Firestore; otherwise on demand. */
export async function generateStaticParams() {
  const cities = await getActiveCities()
  return (cities ?? []).map(c => ({ cityId: c.id }))
}

function prettyId(cityId: string) {
  return cityId.replace(/^city_/, '').replace(/[_-]+/g, ' ').replace(/\b\w/g, m => m.toUpperCase())
}

export async function generateMetadata({ params }: { params: { cityId: string } }): Promise<Metadata> {
  const canonical = `/city/${params.cityId}`
  const data = await getCityWithHunts(params.cityId)
  if (data && !data.city) return { title: 'City not found', robots: { index: false } }
  const name = data?.city?.name ?? prettyId(params.cityId)
  const title = `${name} scavenger hunts & puzzle walks`
  const count = data?.hunts.length ?? 0
  const base = data?.city?.description?.trim()
  const description = [
    base,
    count
      ? `${count} self-guided puzzle walks in ${name}. Your first hunt is free (any hunt, any city); after that it's €${huntPriceEuros(null)} per hunt.`
      : `Self-guided puzzle walks in ${name}. Your first hunt is free.`,
  ].filter(Boolean).join(' ')
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: 'website', title, description, url: canonical },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function CityPage({ params }: { params: { cityId: string } }) {
  if (!isValidId(params.cityId)) notFound()
  const data = await getCityWithHunts(params.cityId)
  // Firestore read fine but no such (active) city → real 404.
  if (data && !data.city) notFound()

  const city = data?.city ?? null
  const hunts = data?.hunts ?? null

  const jsonLd = city && hunts ? buildJsonLd(city, hunts) : null

  return (
    <>
      <CityClient cityId={params.cityId} initialCity={city} initialHunts={hunts} />
      {jsonLd && jsonLd.map((obj, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJson(obj) }} />
      ))}
    </>
  )
}

/** JSON for a <script> tag: no `</script>` breakouts. */
function safeJson(obj: unknown) {
  return JSON.stringify(obj).replace(/</g, '\\u003c')
}

function buildJsonLd(city: PublicCity, hunts: PublicHunt[]) {
  const url = `${SITE_URL}/city/${city.id}`
  const prices = hunts.map(h => huntPriceEuros(h))
  const list = {
    '@type': 'ItemList',
    name: `Scavenger hunts and walking tours in ${city.name}`,
    numberOfItems: hunts.length,
    itemListElement: hunts.map((h, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE_URL}/city/${city.id}/${h.id}`,
      name: h.title,
    })),
  }
  const destination = {
    '@context': 'https://schema.org',
    '@type': 'TouristDestination',
    '@id': `${url}#destination`,
    name: city.name,
    description: city.description,
    url,
    ...(city.imageUrl ? { image: city.imageUrl } : {}),
    ...(city.country ? { containedInPlace: { '@type': 'Country', name: city.country } } : {}),
    touristType: ['Families', 'Puzzle lovers', 'Walkers'],
    includesAttraction: hunts.map(h => ({
      '@type': 'TouristTrip',
      name: h.title,
      description: h.description,
      url: `${SITE_URL}/city/${city.id}/${h.id}`,
      ...(isTour(h) ? {} : { additionalType: 'https://schema.org/Game' }),
    })),
    subjectOf: list,
  }
  // Each hunt is sold on its own (the first hunt per account is free).
  const offers = prices.length ? {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `Scavenger hunts and walking tours in ${city.name}`,
    description: `Each TourHunts hunt or walking tour in ${city.name} is bought on its own and stays playable with no time limit. Every account gets its first hunt free, any hunt in any city.`,
    brand: { '@type': 'Brand', name: 'TourHunts' },
    category: 'Self-guided city game',
    url,
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'EUR',
      lowPrice: Math.min(...prices).toFixed(2),
      highPrice: Math.max(...prices).toFixed(2),
      offerCount: hunts.length,
      availability: 'https://schema.org/InStock',
      offers: hunts.map((h, i) => ({
        '@type': 'Offer',
        name: h.title,
        price: prices[i].toFixed(2),
        priceCurrency: 'EUR',
        availability: 'https://schema.org/InStock',
        url: `${SITE_URL}/city/${city.id}/${h.id}`,
      })),
    },
  } : null
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      ...(city.countryId && city.country
        ? [{ '@type': 'ListItem', position: 2, name: city.country, item: `${SITE_URL}/country/${city.countryId}` }]
        : []),
      { '@type': 'ListItem', position: city.countryId && city.country ? 3 : 2, name: city.name, item: url },
    ],
  }
  return offers ? [destination, offers, breadcrumb] : [destination, breadcrumb]
}
