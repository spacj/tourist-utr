import { notFound } from 'next/navigation'
import { db } from '@/lib/firebase'
import { doc, getDoc, getDocs, collection, query, where } from 'firebase/firestore'
import { FREE_HUNT_STOP_LIMIT, isTour, type MysterySpec } from '@/types'
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

  // Mystery accusation: only once the whole case has been gathered. Strip the
  // solution — the accusation is graded server-side in /api/accuse.
  const rawMystery = (hunt.mystery as MysterySpec | undefined) ?? null
  const mystery = rawMystery ? { ...rawMystery, solution: undefined } : null
  const mysteryReady = !!mystery && cluesArrived >= fullHuntStops

  // ── "What's next" — city progress + the next unplayed hunt in this city ──
  // This turns the complete screen into a launchpad for the next hunt.
  let cityTotal = 0
  let cityDone = 0
  let nextHuntTitle: string | null = null
  let nextHuntI18n: Record<string, { title?: string }> | null = null
  const cityId = (hunt.cityId as string) ?? null
  if (cityId) {
    try {
      const cityHuntsSnap = await getDocs(query(collection(db, 'hunts'), where('cityId', '==', cityId), where('active', '==', true)))
      const cityHunts = cityHuntsSnap.docs
        .map(d => ({ id: d.id, ...(d.data() as any) }))
        .filter(h => !isTour(h))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

      const completed = new Set<string>([session.huntId])
      if (session.userId) {
        const mineSnap = await getDocs(query(collection(db, 'sessions'), where('userId', '==', session.userId)))
        mineSnap.docs.forEach(d => { const s = d.data(); if (s.completedAt) completed.add(s.huntId) })
      }
      cityTotal = cityHunts.length
      cityDone = cityHunts.filter(h => completed.has(h.id)).length
      const next = cityHunts.find(h => !completed.has(h.id))
      if (next) {
        nextHuntTitle = next.title ?? null
        nextHuntI18n = (next.i18n ?? null) as Record<string, { title?: string }> | null
      }
    } catch {}
  }

  return (
    <CompleteClient
      sessionId={sessionId}
      huntId={session.huntId}
      mystery={mysteryReady ? mystery : null}
      cityName={(hunt.city as string) ?? ''}
      cityTotal={cityTotal}
      cityDone={cityDone}
      nextHuntTitle={nextHuntTitle}
      nextHuntI18n={nextHuntI18n}
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
