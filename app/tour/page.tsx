import { notFound, redirect } from 'next/navigation'
import { adminDb } from '@/lib/firebaseAdmin'
import { Clue, Hunt } from '@/types'
import { TourClient } from './TourClient'

export const dynamic = 'force-dynamic'

export default async function TourPage({
  searchParams,
}: {
  searchParams: { session?: string }
}) {
  const sessionId = searchParams.session
  if (!sessionId) redirect('/')

  if (!/^[A-Za-z0-9_-]{1,128}$/.test(sessionId)) notFound()
  const db = adminDb()
  const sessionRef = db.collection('sessions').doc(sessionId)
  const sessionSnap = await sessionRef.get()
  if (!sessionSnap.exists) notFound()
  const session = sessionSnap.data()!

  // If a hunt-type session lands here, redirect to /hunt.
  if (session.tourType !== 'tour') {
    redirect(`/hunt?session=${sessionId}`)
  }

  const huntRef = db.collection('hunts').doc(session.huntId)
  const huntSnap = await huntRef.get()
  if (!huntSnap.exists) notFound()
  // Legacy docs may still carry invented rating/badge fields — never ship them.
  const { rating: _r, badge: _b, mystery: _m, ...huntData } = huntSnap.data() as Hunt & { rating?: unknown; badge?: unknown }
  const hunt = { ...huntData, id: huntSnap.id } as Hunt

  // Walking tours have no puzzles/quiz/hints to protect, but only ship what
  // the tour UI renders (never answers or hint texts).
  const cluesSnap = await huntRef.collection('clues').orderBy('order').get()
  const clues: Clue[] = cluesSnap.docs.map((d) => {
    const c = d.data() as Clue
    const i18n: Clue['i18n'] = {}
    for (const [lang, tr] of Object.entries(c.i18n ?? {})) {
      if (!tr) continue
      ;(i18n as Record<string, unknown>)[lang] = {
        theme: tr.theme, riddle: tr.riddle, locationName: tr.locationName, funFact: tr.funFact,
      }
    }
    return {
      id: d.id, order: c.order, totalClues: cluesSnap.size, icon: c.icon, theme: c.theme,
      riddle: c.riddle ?? '', locationName: c.locationName ?? '', lat: c.lat, lng: c.lng,
      radiusM: c.radiusM, hint1: '', hint2: '', funFact: c.funFact ?? '', i18n,
    }
  })

  // Load per-clue arrival state from sessionClues
  const scSnap = await sessionRef.collection('sessionClues').get()
  const arrived = new Set<string>()
  scSnap.docs.forEach(d => {
    if (d.data().arrivedAt) arrived.add(d.id)
  })

  return (
    <TourClient
      hunt={hunt}
      clues={clues}
      sessionId={sessionId}
      cityId={(session.cityId as string | null) ?? hunt.cityId ?? null}
      initiallyArrivedIds={Array.from(arrived)}
    />
  )
}
