import type { Metadata } from 'next'
import { StudioClient } from './StudioClient'

export const metadata: Metadata = {
  title: 'Creator studio',
  robots: { index: false, follow: false },
}

export default function StudioPage() {
  return <StudioClient />
}
