'use client'
import { SpotEditForm } from '@/components/SpotEditForm'

export default function EditBenchPage({ params }: { params: { id: string } }) {
  return <SpotEditForm kind="bench" id={params.id} />
}
