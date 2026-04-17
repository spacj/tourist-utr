import { notFound, redirect } from 'next/navigation'
import { db } from '@/lib/firebase'
import { HuntClient } from './HuntClient'
import { Clue } from '@/types'

export const dynamic = 'force-dynamic'

export default async function HuntPage({
  searchParams,
}: {
  searchParams: { session?: string; credits?: string }
}) {
  const sessionId = searchParams.session
  if (!sessionId) redirect('/')

  const sessionSnap = await db.collection('sessions').doc(sessionId).get()
  if (!sessionSnap.exists) notFound()
  const session = sessionSnap.data()!

  const scSnap = await db.collection('sessions').doc(sessionId)
    .collection('sessionClues')
    .where('arrivedAt', '==', null)
    .limit(1)
    .get()

  if (scSnap.empty) redirect(`/hunt/complete?session=${sessionId}`)

  const scDoc = scSnap.docs[0]
  const clueId = scDoc.id

  const clueSnap = await db.collection('hunts').doc(session.huntId)
    .collection('clues').doc(clueId).get()
  if (!clueSnap.exists) notFound()
  const clue = clueSnap.data()!

  const totalCluesSnap = await db.collection('hunts').doc(session.huntId)
    .collection('clues').get()

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
