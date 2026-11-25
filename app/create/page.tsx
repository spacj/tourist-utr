import type { Metadata } from 'next'
import { CreateClient } from './CreateClient'

export const metadata: Metadata = {
  title: 'Create your own hunt and earn from it',
  description: 'Turn your favourite city walk into a TourHunts scavenger hunt. We review and translate it into six languages; you earn from every sale.',
  alternates: { canonical: '/create' },
}

export default function CreatePage() {
  return <CreateClient />
}
