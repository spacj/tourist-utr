import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getActiveHunts, getCityWithHunts, huntLanguages, isValidId } from '@/lib/catalog'
import { cityCenter } from '@/lib/cityGeo'
import { SITE_URL } from '@/lib/site'
import { huntPriceEuros, isTour } from '@/types'
import { HuntLanding } from './HuntLanding'

/**
 * Public, spoiler-free landing page for one hunt or tour: what it is, how
 * long, how hard, what it costs. Never shows stops, clues or answers. The
 * "Start" CTA goes to the city page (?start=), where the game starts.
 */
export const revalidate = 300

export async function generateStaticParams() {
  const hunts = await getActiveHunts()
  return (hunts ?? []).filter(h => h.cityId).map(h => ({ cityId: h.cityId, huntId: h.id }))
}

async function load(cityId: string, huntId: string) {
  if (!isValidId(cityId) || !isValidId(huntId)) return { missing: true as const }
  const data = await getCityWithHunts(cityId)
  if (!data) return { unavailable: true as const }
  const hunt = data.hunts.find(h => h.id === huntId)
  if (!data.city || !hunt) return { missing: true as const }
  return { city: data.city, hunt, hunts: data.hunts }
}

function priceText(euros: number) {
  return Number.isInteger(euros) ? String(euros) : euros.toFixed(2)
}

function minutes(n: number) {
  if (n >= 90) {
    const h = Math.floor(n / 60), m = n % 60
    return m ? `${h} h ${m} min` : `${h} h`
  }
  return `${n} min`
}

export async function generateMetadata({ params }: { params: { cityId: string; huntId: string } }): Promise<Metadata> {
  const canonical = `/city/${params.cityId}/${params.huntId}`
  const res = await load(params.cityId, params.huntId)
  if ('missing' in res) return { title: 'Hunt not found', robots: { index: false } }
  if ('unavailable' in res) return { title: 'Scavenger hunt', alternates: { canonical } }
  const { city, hunt } = res
  const kind = isTour(hunt) ? 'self-guided walking tour' : 'scavenger hunt'
  const title = `${hunt.title}: ${city.name} ${kind}`
  const price = `Your first hunt is free (any hunt you like); after that €${priceText(huntPriceEuros(hunt))} per hunt.`
  const facts = [
    hunt.clueCount ? `${hunt.clueCount} stops` : '',
    hunt.distanceKm ? `${hunt.distanceKm} km` : '',
    hunt.durationMin ? `about ${minutes(hunt.durationMin)}` : '',
  ].filter(Boolean).join(', ')
  const factLine = facts ? `${facts[0].toUpperCase()}${facts.slice(1)}. ` : ''
  const description = `${hunt.description.trim()} ${factLine}${price}`.trim()
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: 'website', title, description, url: canonical },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function HuntLandingPage({ params }: { params: { cityId: string; huntId: string } }) {
  const res = await load(params.cityId, params.huntId)
  if ('missing' in res) notFound()
  if ('unavailable' in res) {
    // Firestore unreachable: fail this render so ISR doesn't cache a broken
    // page (it keeps serving the last good version, or retries on demand).
    throw new Error('catalogue_unavailable')
  }
  const { city, hunt, hunts } = res
  const url = `${SITE_URL}/city/${city.id}/${hunt.id}`
  const price = huntPriceEuros(hunt)
  const langs = huntLanguages(hunt)

  const tripJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    '@id': url,
    name: hunt.title,
    description: hunt.description,
    url,
    inLanguage: langs,
    touristType: isTour(hunt) ? ['Walkers', 'Food lovers'] : ['Families', 'Puzzle lovers', 'Walkers'],
    provider: { '@type': 'Organization', name: 'TourHunts', url: SITE_URL },
    // City level only: the route and stops are the game, so they stay off the page.
    itinerary: {
      '@type': 'City',
      name: city.name,
      ...(city.country ? { containedInPlace: { '@type': 'Country', name: city.country } } : {}),
    },
    offers: {
      '@type': 'Offer',
      price: price.toFixed(2),
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
      url,
      description: 'One-off purchase of this hunt. Every account gets its first hunt free, any hunt it likes.',
    },
  }
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: city.name, item: `${SITE_URL}/city/${city.id}` },
      { '@type': 'ListItem', position: 3, name: hunt.title, item: url },
    ],
  }

  return (
    <>
      <HuntLanding
        city={city}
        hunt={hunt}
        isMystery={!!hunt.isMystery}
        languages={langs}
        center={cityCenter(city)}
        siblings={hunts.filter(h => h.id !== hunt.id)}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(tripJsonLd).replace(/</g, '\\u003c') }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb).replace(/</g, '\\u003c') }} />
    </>
  )
}
