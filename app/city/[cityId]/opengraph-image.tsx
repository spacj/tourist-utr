import { renderOg, ogSize } from '@/lib/og'
import { ogCityData, prettyCityId } from '@/lib/ogCatalog'
import { CITY_UNLOCK_PRICE_EUROS, isTour } from '@/types'

export const runtime = 'edge'
export const alt = 'TourHunts city scavenger hunts'
export const size = ogSize
export const contentType = 'image/png'

export default async function Image({ params }: { params: { cityId: string } }) {
  const { city, hunts } = await ogCityData(params.cityId)
  const name = city?.name ?? prettyCityId(params.cityId)
  const huntCount = hunts.filter(h => !isTour(h)).length
  const tourCount = hunts.length - huntCount
  const counts = [
    huntCount ? `${huntCount} scavenger hunt${huntCount === 1 ? '' : 's'}` : '',
    tourCount ? `${tourCount} walking tour${tourCount === 1 ? '' : 's'}` : '',
  ].filter(Boolean).join(' · ')
  return renderOg({
    eyebrow: city?.country || 'Puzzle walks',
    title: `${name}: crack the clues, find the places`,
    note: counts || 'Self-guided puzzle walks through the old town',
    footer: `First hunt free · €${city?.priceEuros ?? CITY_UNLOCK_PRICE_EUROS} unlocks all of ${name}`,
  })
}
