import { notFound, redirect } from 'next/navigation'
import { db } from '@/lib/firebase'
import { HuntClient } from './HuntClient'
import { Clue } from '@/types'
import { doc, getDoc, getDocs, collection, query, where, limit } from 'firebase/firestore'

export const dynamic = 'force-dynamic'

export default async function HuntPage({
  searchParams,
}: {
  searchParams: { session?: string; credits?: string }
}) {
  const sessionId = searchParams.session
  if (!sessionId) redirect('/')

  const sessionSnap = await getDoc(doc(db, 'sessions', sessionId))
  if (!sessionSnap.exists()) notFound()
  const session = sessionSnap.data()

  const scSnap = await getDocs(
    query(
      collection(db, 'sessions', sessionId, 'sessionClues'),
      where('arrivedAt', '==', null),
      limit(1)
    )
  )

  if (scSnap.empty) redirect(`/hunt/complete?session=${sessionId}`)

  const scDoc = scSnap.docs[0]
  const clueId = scDoc.id

  const clueSnap = await getDoc(doc(db, 'hunts', session.huntId, 'clues', clueId))
  if (!clueSnap.exists()) notFound()
  const clue = clueSnap.data()

  const totalCluesSnap = await getDocs(collection(db, 'hunts', session.huntId, 'clues'))

  return (
    <HuntClient
      initialClue={{ ...clue, id: clueId, totalClues: totalCluesSnap.size } as Clue}
      sessionId={sessionId}
      initialCredits={session.credits}
      initialScore={session.score}
      creditsJustAdded={searchParams.credits === 'added'}
    />
  )
}
