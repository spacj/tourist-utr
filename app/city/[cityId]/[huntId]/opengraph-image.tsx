import { renderOg, ogSize } from '@/lib/og'
import { ogCityData } from '@/lib/ogCatalog'
import { huntPriceEuros, isTour } from '@/types'

export const runtime = 'edge'
export const alt = 'TourHunts scavenger hunt'
export const size = ogSize
export const contentType = 'image/png'

export default async function Image({ params }: { params: { cityId: string; huntId: string } }) {
  const { city, hunts } = await ogCityData(params.cityId)
  const hunt = hunts.find(h => h.id === params.huntId)
  if (!city || !hunt) {
    return renderOg({ eyebrow: 'Puzzle walk', title: 'Crack the clue. Find the place. Hear its story.' })
  }
  const facts = [
    hunt.clueCount ? `${hunt.clueCount} stops` : '',
    hunt.distanceKm ? `${hunt.distanceKm} km` : '',
    hunt.durationMin ? `~${hunt.durationMin} min` : '',
  ].filter(Boolean).join(' · ')
  return renderOg({
    eyebrow: `${isTour(hunt) ? 'Walking tour' : 'Scavenger hunt'} · ${city.name}`,
    title: hunt.title,
    note: facts || undefined,
    footer: `Your first hunt is free · then €${huntPriceEuros(hunt)} per hunt`,
  })
}
