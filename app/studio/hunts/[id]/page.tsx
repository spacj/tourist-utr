import type { Metadata } from 'next'
import { EditorClient } from './EditorClient'

export const metadata: Metadata = {
  title: 'Edit hunt — Creator studio',
  robots: { index: false, follow: false },
}

export default function EditHuntPage({ params }: { params: { id: string } }) {
  return <EditorClient id={params.id} />
}
