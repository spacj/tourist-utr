import { notFound } from 'next/navigation'
import { db } from '@/lib/firebase'
import { doc, getDoc, getDocs, collection } from 'firebase/firestore'
import { FREE_HUNT_STOP_LIMIT } from '@/types'
import { CompleteClient } from './CompleteClient'

export const dynamic = 'force-dynamic'

export default async function CompletePage({
  searchParams,
}: {
  searchParams: { session?: string }
}) {
  const sessionId = searchParams.session
  if (!sessionId) notFound()

  const sessionSnap = await getDoc(doc(db, 'sessions', sessionId))
  if (!sessionSnap.exists()) notFound()
  const session = sessionSnap.data()

  const huntSnap = await getDoc(doc(db, 'hunts', session.huntId))
  const hunt = huntSnap.data()!

  const scSnap = await getDocs(collection(db, 'sessions', sessionId, 'sessionClues'))
  const hintsSnap = await getDocs(collection(db, 'sessions', sessionId, 'hintUnlocks'))

  const clues = await Promise.all(
    scSnap.docs.map(async (scDoc) => {
      const sc = scDoc.data()
      const clueSnap = await getDoc(doc(db, 'hunts', session.huntId, 'clues', scDoc.id))
      const clue = clueSnap.data()!
      return {
        id: scDoc.id,
        locationName: clue.locationName as string,
        i18n: (clue.i18n ?? null) as Record<string, { locationName?: string }> | null,
        icon: (clue.icon ?? '📍') as string,
        order: clue.order as number,
        arrivedAt: sc.arrivedAt ? sc.arrivedAt.toMillis() : null,
        pointsEarned: sc.pointsEarned,
      }
    })
  )
  clues.sort((a, b) => a.order - b.order)

  const totalClues = clues.length
  const cluesArrived = clues.filter(c => c.arrivedAt).length
  const hintsUsed = hintsSnap.size
  const creditsSpent = hintsSnap.docs.reduce((s, d) => s + (d.data().creditCost || 0), 0)

  // The hunt ended on the free teaser cap if it's a free session, the player
  // reached the free limit, and the full hunt actually has more stops.
  const fullHuntStops = (hunt.clueCount as number) ?? totalClues
  const freeCapReached =
    session.isFree === true &&
    cluesArrived >= FREE_HUNT_STOP_LIMIT &&
    fullHuntStops > FREE_HUNT_STOP_LIMIT

  return (
    <CompleteClient
      huntTitle={hunt.title}
      huntI18n={(hunt.i18n ?? null) as Record<string, { title?: string }> | null}
      huntCity={hunt.city}
      score={session.score}
      clues={clues}
      totalClues={totalClues}
      cluesArrived={cluesArrived}
      hintsUsed={hintsUsed}
      creditsSpent={creditsSpent}
      freeCapReached={freeCapReached}
      cityId={(hunt.cityId as string) ?? null}
      fullHuntStops={fullHuntStops}
    />
  )
}
