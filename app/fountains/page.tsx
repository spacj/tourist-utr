import type { Metadata } from 'next'
import { buildSpotIndexMetadata, SpotIndex } from '@/components/SpotIndex'

export const revalidate = 3600

export function generateMetadata(): Promise<Metadata> {
  return buildSpotIndexMetadata('fountain')
}

export default function FountainsPage() {
  return <SpotIndex kind="fountain" />
}
