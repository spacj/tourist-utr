'use client'
import { SpotEditForm } from '@/components/SpotEditForm'

export default function EditFountainPage({ params }: { params: { id: string } }) {
  return <SpotEditForm kind="fountain" id={params.id} />
}
