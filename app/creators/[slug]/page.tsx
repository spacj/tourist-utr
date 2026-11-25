import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getActiveCities, getCreatorWithHunts } from '@/lib/catalog'
import { CreatorClient } from './CreatorClient'

export const revalidate = 300

type Props = { params: { slug: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getCreatorWithHunts(params.slug)
  const name = data?.creator?.displayName
  if (!name) return { title: 'Creator' }
  return {
    title: `Hunts by ${name}`,
    description: data?.creator?.bio?.slice(0, 160) || `Self-guided city hunts and walking tours by ${name} on TourHunts.`,
    alternates: { canonical: `/creators/${params.slug}` },
  }
}

/** /creators/[slug] — a creator's public profile and their listed hunts. */
export default async function CreatorPage({ params }: Props) {
  const [data, cities] = await Promise.all([getCreatorWithHunts(params.slug), getActiveCities()])
  if (data && !data.creator) notFound()
  if (!data?.creator) {
    // Firestore unavailable (build machine): render a minimal page.
    return <main className="page-center"><div className="container"><h1>Creator</h1></div></main>
  }
  const cityNames = Object.fromEntries((cities ?? []).map(c => [c.id, c.name]))
  return <CreatorClient creator={data.creator} hunts={data.hunts} cityNames={cityNames} />
}
