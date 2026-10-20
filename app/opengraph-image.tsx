import { renderOg, ogSize } from '@/lib/og'

export const runtime = 'edge'
export const alt = 'TourHunts — puzzle walks through Dutch cities'
export const size = ogSize
export const contentType = 'image/png'

export default async function Image() {
  return renderOg({
    eyebrow: 'Utrecht · Amsterdam · Delft · Leiden',
    title: 'Crack the clue. Find the place. Hear its story.',
    note: '“For seven centuries I carried Utrecht’s cargo. Find my steps down to the water.”',
  })
}
