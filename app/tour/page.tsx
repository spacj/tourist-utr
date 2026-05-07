import { notFound, redirect } from 'next/navigation'
import { db } from '@/lib/firebase'
import { Clue, Hunt } from '@/types'
import { TourClient } from './TourClient'
import { doc, getDoc, getDocs, collection, query, orderBy } from 'firebase/firestore'

export const dynamic = 'force-dynamic'

export default async function TourPage({
  searchParams,
}: {
  searchParams: { session?: string }
}) {
  const sessionId = searchParams.session
  if (!sessionId) redirect('/')

  const sessionSnap = await getDoc(doc(db, 'sessions', sessionId))
  if (!sessionSnap.exists()) notFound()
  const session = sessionSnap.data()

  // If a hunt-type session lands here, redirect to /hunt.
  if (session.tourType !== 'tour') {
    redirect(`/hunt?session=${sessionId}`)
  }

  const huntSnap = await getDoc(doc(db, 'hunts', session.huntId))
  if (!huntSnap.exists()) notFound()
  const hunt = { id: huntSnap.id, ...huntSnap.data() } as Hunt

  const cluesSnap = await getDocs(
    query(collection(db, 'hunts', session.huntId, 'clues'), orderBy('order'))
  )
  const clues = cluesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Clue[]

  // Load per-clue arrival state from sessionClues
  const scSnap = await getDocs(collection(db, 'sessions', sessionId, 'sessionClues'))
  const arrived = new Set<string>()
  scSnap.docs.forEach(d => {
    if (d.data().arrivedAt) arrived.add(d.id)
  })

  return (
    <TourClient
      hunt={hunt}
      clues={clues}
      sessionId={sessionId}
      initiallyArrivedIds={Array.from(arrived)}
    />
  )
}
