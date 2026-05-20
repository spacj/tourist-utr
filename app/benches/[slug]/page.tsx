import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getAllBenches, getBenchBySlug } from '@/lib/benches'
import { BENCH_CATEGORIES } from '@/types'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://tourhunts.com'

export const revalidate = 3600
export const dynamicParams = true

// Pre-render the benches that exist at build time; new ones render on first
// request then get cached (dynamicParams = true + revalidate).
export async function generateStaticParams() {
  const benches = await getAllBenches()
  return benches.map(b => ({ slug: b.slug }))
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const bench = await getBenchBySlug(params.slug)
  if (!bench) return { title: 'Bench not found' }
  const cats = bench.categories.map(id => BENCH_CATEGORIES.find(c => c.id === id)).filter(Boolean) as typeof BENCH_CATEGORIES
  const primary = cats[0]
  const where = bench.city ? ` in ${bench.city}` : ''
  const labels = cats.map(c => c.label).join(', ')
  const title = `${bench.title}${where} — ${labels || 'a good bench'}`
  const located = [bench.address, bench.city].filter(Boolean).join(', ')
  const description = bench.description
    ? `${bench.description}${located ? ` Located at ${located}.` : ''}`
    : `${primary?.seoPhrase ?? 'A good bench to sit on'}${where}. See it on the map and get directions.`
  const url = `${SITE_URL}/benches/${bench.slug}`
  return {
    title,
    description,
    alternates: { canonical: url },
    keywords: [
      bench.title, ...cats.map(c => c.label), `bench${where}`,
      ...cats.map(c => c.seoPhrase), bench.city ? `${bench.city} bench` : 'bench',
    ].filter(Boolean) as string[],
    openGraph: { type: 'website', title, description, url },
    twitter: { card: 'summary', title, description },
  }
}

export default async function BenchPage({ params }: { params: { slug: string } }) {
  const bench = await getBenchBySlug(params.slug)
  if (!bench) notFound()
  const cats = bench.categories.map(id => BENCH_CATEGORIES.find(c => c.id === id)).filter(Boolean) as typeof BENCH_CATEGORIES
  const primary = cats[0]
  const url = `${SITE_URL}/benches/${bench.slug}`

  const postalAddress = (bench.address || bench.postalCode || bench.city)
    ? {
        '@type': 'PostalAddress',
        ...(bench.address ? { streetAddress: bench.address } : {}),
        ...(bench.postalCode ? { postalCode: bench.postalCode } : {}),
        ...(bench.city ? { addressLocality: bench.city } : {}),
      }
    : undefined

  const placeJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Place',
    '@id': url,
    name: bench.title,
    description: bench.description || (primary?.seoPhrase ?? 'A good bench to sit on.'),
    url,
    geo: { '@type': 'GeoCoordinates', latitude: bench.lat, longitude: bench.lng },
    ...(postalAddress ? { address: postalAddress } : {}),
    hasMap: `https://www.google.com/maps/search/?api=1&query=${bench.lat},${bench.lng}`,
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
      { '@type': 'ListItem', position: 2, name: 'Benches', item: `${SITE_URL}/benches` },
      { '@type': 'ListItem', position: 3, name: bench.title, item: url },
    ],
  }

  const directions = `https://www.google.com/maps/dir/?api=1&destination=${bench.lat},${bench.lng}`
  const mapImg = `https://staticmap.openstreetmap.de/staticmap.php?center=${bench.lat},${bench.lng}&zoom=16&size=640x320&markers=${bench.lat},${bench.lng},lightblue1`

  return (
    <main className="page-center">
      <article className="container bench-article">
        <a href="/benches" className="back-link" style={{ display: 'inline-block', marginTop: 16 }}>← All benches</a>

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
          <h1 className="bench-article-title">{bench.title}</h1>
          {(bench.address || bench.city) && (
            <div className="bench-article-city">📍 {[bench.address, bench.postalCode, bench.city].filter(Boolean).join(', ')}</div>
          )}
        </header>

        <div className="bench-article-map">
          <img src={mapImg} alt={`Map showing the location of ${bench.title}`} loading="lazy" />
        </div>

        {bench.description && <p className="bench-article-desc">{bench.description}</p>}

        <div className="bench-article-coords">
          <span>Coordinates</span>
          <code>{bench.lat.toFixed(5)}, {bench.lng.toFixed(5)}</code>
        </div>

        <a href={directions} target="_blank" rel="noopener noreferrer" className="bench-article-directions">
          Get directions →
        </a>
      </article>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(placeJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
    </main>
  )
}
