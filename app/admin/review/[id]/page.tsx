import type { Metadata } from 'next'
import { ReviewClient } from './ReviewClient'

export const metadata: Metadata = {
  title: 'Review hunt',
  robots: { index: false, follow: false },
}

export default function ReviewPage({ params }: { params: { id: string } }) {
  return <ReviewClient id={params.id} />
}
