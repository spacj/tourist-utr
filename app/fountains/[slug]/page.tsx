import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getAllSpots, getSpotBySlug } from '@/lib/benches'
import { buildSpotDetailMetadata, SpotDetail } from '@/components/SpotDetail'

export const revalidate = 3600
export const dynamicParams = true

export async function generateStaticParams() {
  const spots = await getAllSpots('fountain')
  return spots.map(s => ({ slug: s.slug }))
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const spot = await getSpotBySlug(params.slug)
  if (!spot || spot.kind !== 'fountain') return { title: 'Fountain not found' }
  return buildSpotDetailMetadata(spot)
}

export default async function FountainPage({ params }: { params: { slug: string } }) {
  const spot = await getSpotBySlug(params.slug)
  if (!spot || spot.kind !== 'fountain') notFound()
  return <SpotDetail spot={spot} />
}
