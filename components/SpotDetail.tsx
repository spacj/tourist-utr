import type { Metadata } from 'next'
import { type Bench, SPOT_KINDS } from '@/types'
import { BenchEditButton } from '@/components/BenchEditButton'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://tourhunts.com'

/** Per-spot SEO metadata, derived from the spot's own kind. */
export function buildSpotDetailMetadata(spot: Bench): Metadata {
  const cfg = SPOT_KINDS[spot.kind]
  const cats = spot.categories.map(id => cfg.categories.find(c => c.id === id)).filter(Boolean) as typeof cfg.categories
  const primary = cats[0]
  const where = spot.city ? ` in ${spot.city}` : ''
  const labels = cats.map(c => c.label).join(', ')
  const title = `${spot.title}${where} — ${labels || cfg.copy.nounSingular}`
  const located = [spot.address, spot.city].filter(Boolean).join(', ')
  const description = spot.description
    ? `${spot.description}${located ? ` Located at ${located}.` : ''}`
    : `${primary?.seoPhrase ?? cfg.copy.sectionTitle}${where}. See it on the map and get directions.`
  const url = `${SITE_URL}/${cfg.urlBase}/${spot.slug}`
  return {
    title,
    description,
    alternates: { canonical: url },
    keywords: [
      spot.title, ...cats.map(c => c.label), `${cfg.copy.nounSingular}${where}`,
      ...cats.map(c => c.seoPhrase), spot.city ? `${cfg.copy.nounSingular} ${spot.city}` : cfg.copy.nounSingular,
    ].filter(Boolean) as string[],
    openGraph: { type: 'website', title, description, url },
    twitter: { card: 'summary', title, description },
  }
}

/** Server-rendered per-spot article + JSON-LD. */
export function SpotDetail({ spot }: { spot: Bench }) {
  const cfg = SPOT_KINDS[spot.kind]
  const base = cfg.urlBase
  const cats = spot.categories.map(id => cfg.categories.find(c => c.id === id)).filter(Boolean) as typeof cfg.categories
  const primary = cats[0]
  const url = `${SITE_URL}/${base}/${spot.slug}`

  const postalAddress = (spot.address || spot.postalCode || spot.city)
    ? {
        '@type': 'PostalAddress',
        ...(spot.address ? { streetAddress: spot.address } : {}),
        ...(spot.postalCode ? { postalCode: spot.postalCode } : {}),
        ...(spot.city ? { addressLocality: spot.city } : {}),
      }
    : undefined

  const placeJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Place',
    '@id': url,
    name: spot.title,
    description: spot.description || (primary?.seoPhrase ?? cfg.copy.sectionTitle),
    url,
    geo: { '@type': 'GeoCoordinates', latitude: spot.lat, longitude: spot.lng },
    ...(postalAddress ? { address: postalAddress } : {}),
    hasMap: `https://www.google.com/maps/search/?api=1&query=${spot.lat},${spot.lng}`,
    additionalType: 'https://schema.org/TouristAttraction',
    amenityFeature: cats.length
      ? cats.map(c => ({ '@type': 'LocationFeatureSpecification', name: c.label, value: true }))
      : undefined,
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: cfg.copy.eyebrow, item: `${SITE_URL}/${base}` },
      { '@type': 'ListItem', position: 3, name: spot.title, item: url },
    ],
  }

  const directions = `https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}`
  const mapImg = `https://staticmap.openstreetmap.de/staticmap.php?center=${spot.lat},${spot.lng}&zoom=16&size=640x320&markers=${spot.lat},${spot.lng},lightblue1`

  return (
    <main className="page-center">
      <article className="container bench-article">
        <a href={`/${base}`} className="back-link" style={{ display: 'inline-block', marginTop: 16 }}>← All {cfg.copy.nounPlural}</a>

        <header className="bench-article-head">
          {cats.length > 0 && (
            <div className="bench-article-cats">
              {cats.map(c => (
                <span key={c.id} className="bench-article-cat" style={{ color: c.color }}>
                  <span className="bench-article-cat-icon" style={{ background: c.color }} aria-hidden>{c.icon}</span>
                  {c.label}
                </span>
              ))}
            </div>
          )}
          <h1 className="bench-article-title">{spot.title}</h1>
          {(spot.address || spot.city) && (
            <div className="bench-article-city">📍 {[spot.address, spot.postalCode, spot.city].filter(Boolean).join(', ')}</div>
          )}
        </header>

        <div className="bench-article-map">
          <img src={mapImg} alt={`Map showing the location of ${spot.title}`} loading="lazy" />
        </div>

        {spot.description && <p className="bench-article-desc">{spot.description}</p>}

        <div className="bench-article-coords">
          <span>Coordinates</span>
          <code>{spot.lat.toFixed(5)}, {spot.lng.toFixed(5)}</code>
        </div>

        <a href={directions} target="_blank" rel="noopener noreferrer" className="bench-article-directions">
          Get directions →
        </a>

        <BenchEditButton spotId={spot.id} urlBase={base} />
      </article>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(placeJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
    </main>
  )
}
