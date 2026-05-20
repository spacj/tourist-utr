import type { Metadata } from 'next'
import { getAllBenches } from '@/lib/benches'
import { BENCH_CATEGORIES } from '@/types'
import { BenchesClient } from './BenchesClient'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://tourhunts.com'

// ISR — refresh hourly so newly added benches surface to crawlers without a
// full redeploy, while still serving static HTML for SEO.
export const revalidate = 3600

export async function generateMetadata(): Promise<Metadata> {
  const benches = await getAllBenches()
  const cities = Array.from(new Set(benches.map(b => b.city).filter(Boolean))) as string[]
  const where = cities.length ? ` in ${cities.slice(0, 3).join(', ')}` : ''
  const title = `Best benches to sit${where} — panorama, dog-friendly, quiet spots`
  const description = `A community map of ${benches.length || 'the'} great places to sit${where}: benches with a view, dog-friendly and kid-friendly spots, quiet corners and sunset seats. Find the perfect bench near you.`
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/benches` },
    keywords: [
      'best benches', 'benches with a view', 'panorama bench', 'dog friendly bench',
      'quiet bench', 'where to sit', 'park benches', ...cities.map(c => `benches in ${c}`),
    ],
    openGraph: {
      type: 'website',
      title,
      description,
      url: `${SITE_URL}/benches`,
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function BenchesPage() {
  const benches = await getAllBenches()

  // ItemList JSON-LD — every bench as a Place so the whole map can rank as a
  // single rich result and each item links to its own page.
  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Best benches to sit',
    numberOfItems: benches.length,
    itemListElement: benches.map((b, i) => {
      const primary = BENCH_CATEGORIES.find(c => c.id === b.categories[0])
      const postalAddress = (b.address || b.postalCode || b.city)
        ? {
            '@type': 'PostalAddress',
            ...(b.address ? { streetAddress: b.address } : {}),
            ...(b.postalCode ? { postalCode: b.postalCode } : {}),
            ...(b.city ? { addressLocality: b.city } : {}),
          }
        : undefined
      return {
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'Place',
          '@id': `${SITE_URL}/benches/${b.slug}`,
          name: b.title,
          description: b.description || (primary?.seoPhrase ?? 'A good bench to sit on.'),
          url: `${SITE_URL}/benches/${b.slug}`,
          geo: { '@type': 'GeoCoordinates', latitude: b.lat, longitude: b.lng },
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
      { '@type': 'ListItem', position: 2, name: 'Benches', item: `${SITE_URL}/benches` },
    ],
  }

  return (
    <>
      <BenchesClient initialBenches={benches} />

      {/* SEO: a crawlable, hidden text directory of every bench. The map is
          canvas (invisible to crawlers), so this gives Google real content
          and internal links to each bench page. */}
      <div className="sr-only">
        <h1>Best benches to sit</h1>
        <p>A community-curated map of good places to sit — benches with a panoramic view, dog-friendly and kid-friendly spots, quiet corners, sunset seats and shaded benches.</p>
        <ul>
          {benches.map(b => {
            const labels = b.categories
              .map(id => BENCH_CATEGORIES.find(c => c.id === id)?.label)
              .filter(Boolean).join(', ')
            const where = [b.address, b.city].filter(Boolean).join(', ')
            return (
              <li key={b.id}>
                <a href={`/benches/${b.slug}`}>
                  {b.title}{where ? ` — ${where}` : ''} ({labels || 'bench'})
                </a>
                {b.description ? `: ${b.description}` : ''}
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
