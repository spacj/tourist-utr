import { notFound, redirect } from 'next/navigation'
import { db } from '@/lib/firebase'
import { HuntClient } from './HuntClient'
import { Clue, playableStopCount } from '@/types'
import { doc, getDoc, getDocs, collection, query, where, limit, orderBy } from 'firebase/firestore'

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

  const totalCluesSnap = await getDocs(
    query(collection(db, 'hunts', session.huntId, 'clues'), orderBy('order'))
  )

  // Free hunts only expose the first few stops. Cap both the progress
  // denominator and the clue set we cache offline so the teaser can't be
  // walked past locally.
  const isFree = session.isFree === true
  const playableTotal = playableStopCount(totalCluesSnap.size, isFree)

  const allClues = totalCluesSnap.docs
    .filter((d) => (d.data().order as number) <= playableTotal)
    .map((d) => ({
      ...d.data(),
      id: d.id,
    })) as Array<Record<string, unknown>>

  return (
    <HuntClient
      initialClue={{ ...clue, id: clueId, totalClues: playableTotal } as Clue}
      huntCity={session.huntCity}
      sessionId={sessionId}
      roomId={session.roomId ?? null}
      huntId={session.huntId ?? null}
      initialCredits={session.credits}
      initialScore={session.score}
      creditsJustAdded={searchParams.credits === 'added'}
      allClues={allClues}
    />
  )
}
