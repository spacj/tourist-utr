import type { Metadata } from 'next'
import { getAllSpots } from '@/lib/benches'
import { SpotKind, SPOT_KINDS } from '@/types'
import { SpotsClient } from '@/components/SpotsClient'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://tourhunts.com'

/** Metadata for a /benches or /fountains index page. Call from the route's
 *  generateMetadata so each section gets its own title/keywords. */
export async function buildSpotIndexMetadata(kind: SpotKind): Promise<Metadata> {
  const cfg = SPOT_KINDS[kind]
  const spots = await getAllSpots(kind)
  const cities = Array.from(new Set(spots.map(s => s.city).filter(Boolean))) as string[]
  const where = cities.length ? ` in ${cities.slice(0, 3).join(', ')}` : ''
  const title = `${cfg.copy.listTitle}${where}`
  const catList = cfg.categories.map(c => c.label.toLowerCase()).slice(0, 4).join(', ')
  const description = `A community map of ${spots.length || 'the best'} ${cfg.copy.nounPlural}${where}: ${catList} and more. Find one near you and get directions.`
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/${cfg.urlBase}` },
    keywords: [
      cfg.copy.listTitle.toLowerCase(),
      ...cfg.categories.map(c => c.seoPhrase),
      `${cfg.copy.nounPlural} near me`,
      ...cities.map(c => `${cfg.copy.nounPlural} in ${c}`),
    ],
    openGraph: { type: 'website', title, description, url: `${SITE_URL}/${cfg.urlBase}` },
    twitter: { card: 'summary_large_image', title, description },
  }
}

/** Server-rendered index body: the interactive client + JSON-LD + a crawlable
 *  sr-only directory (the map canvas is invisible to crawlers). */
export async function SpotIndex({ kind }: { kind: SpotKind }) {
  const cfg = SPOT_KINDS[kind]
  const base = cfg.urlBase
  const spots = await getAllSpots(kind)

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: cfg.copy.listTitle,
    numberOfItems: spots.length,
    itemListElement: spots.map((s, i) => {
      const primary = cfg.categories.find(c => c.id === s.categories[0])
      const postalAddress = (s.address || s.postalCode || s.city)
        ? {
            '@type': 'PostalAddress',
            ...(s.address ? { streetAddress: s.address } : {}),
            ...(s.postalCode ? { postalCode: s.postalCode } : {}),
            ...(s.city ? { addressLocality: s.city } : {}),
          }
        : undefined
      return {
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'Place',
          '@id': `${SITE_URL}/${base}/${s.slug}`,
          name: s.title,
          description: s.description || (primary?.seoPhrase ?? cfg.copy.sectionTitle),
          url: `${SITE_URL}/${base}/${s.slug}`,
          geo: { '@type': 'GeoCoordinates', latitude: s.lat, longitude: s.lng },
          ...(postalAddress ? { address: postalAddress } : {}),
        },
      }
    }),
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: cfg.copy.eyebrow, item: `${SITE_URL}/${base}` },
    ],
  }

  return (
    <>
      <SpotsClient kind={kind} initialSpots={spots} />

      {/* SEO: a crawlable, hidden text directory of every spot. */}
      <div className="sr-only">
        <h1>{cfg.copy.listTitle}</h1>
        <p>A community-curated map of {cfg.copy.nounPlural} — {cfg.categories.map(c => c.label.toLowerCase()).join(', ')}.</p>
        <ul>
          {spots.map(s => {
            const labels = s.categories
              .map(id => cfg.categories.find(c => c.id === id)?.label)
              .filter(Boolean).join(', ')
            const where = [s.address, s.city].filter(Boolean).join(', ')
            return (
              <li key={s.id}>
                <a href={`/${base}/${s.slug}`}>
                  {s.title}{where ? ` — ${where}` : ''} ({labels || cfg.copy.nounSingular})
                </a>
                {s.description ? `: ${s.description}` : ''}
              </li>
            )
          })}
        </ul>
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
    </>
  )
}
