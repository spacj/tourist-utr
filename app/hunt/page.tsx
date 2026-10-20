import { notFound, redirect } from 'next/navigation'
import { adminDb } from '@/lib/firebaseAdmin'
import { HuntClient } from './HuntClient'
import {
  type ClueDoc, type SessionClueDoc, toActiveClueView, toCompletedClueView, toArrivedStopView,
  normalizeDifficulty,
} from '@/lib/clueView'
import { toMillis } from '@/lib/sessionServer'
import type { MysterySpec, ActiveClueView, ArrivedStopView } from '@/types'

export const dynamic = 'force-dynamic'

/**
 * The game page. Everything the client receives goes through lib/clueView —
 * no answers, quiz keys, hint texts, on-site answers or unearned coordinates.
 */
export default async function HuntPage({
  searchParams,
}: {
  searchParams: { session?: string; credits?: string }
}) {
  const sessionId = searchParams.session
  if (!sessionId) redirect('/')

  // Server components can't see the player's ID token; ownership is enforced
  // by the API routes (every mutation checks session.userId === token uid).
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(sessionId)) notFound()
  const db = adminDb()
  const sessionRef = db.collection('sessions').doc(sessionId)
  const sessionSnap = await sessionRef.get()
  if (!sessionSnap.exists) notFound()
  const session = sessionSnap.data()!
  if (session.tourType === 'tour') redirect(`/tour?session=${sessionId}`)

  const huntRef = db.collection('hunts').doc(session.huntId)
  const [huntSnap, cluesSnap, scSnap, unlocksSnap] = await Promise.all([
    huntRef.get(),
    huntRef.collection('clues').orderBy('order').get(),
    sessionRef.collection('sessionClues').get(),
    sessionRef.collection('hintUnlocks').get(),
  ])
  if (!huntSnap.exists || cluesSnap.empty) notFound()
  const hunt = huntSnap.data() as { difficulty?: string; mystery?: MysterySpec; cityId?: string; title?: string }
  const difficulty = normalizeDifficulty(session.difficulty ?? hunt.difficulty)
  const huntId = session.huntId as string
  const totalClues = cluesSnap.size

  const scById = new Map(scSnap.docs.map(d => [d.id, d.data() as SessionClueDoc]))
  const tiersByClue = new Map<string, string[]>()
  for (const d of unlocksSnap.docs) {
    const u = d.data()
    const list = tiersByClue.get(u.clueId) ?? []
    list.push(String(u.tier))
    tiersByClue.set(u.clueId, list)
  }

  const clues = cluesSnap.docs.map(d => ({ id: d.id, clue: d.data() as ClueDoc }))
  const activeIdx = clues.findIndex(c => {
    const sc = scById.get(c.id)
    return sc && !sc.arrivedAt
  })
  const arrived = clues.filter(c => scById.get(c.id)?.arrivedAt)

  // A stop reached but whose on-site question / quiz is still open (e.g. the
  // page was reloaded mid-flow) — resume it before the next stop.
  const last = [...arrived].sort(
    (a, b) => toMillis(scById.get(b.id)!.arrivedAt) - toMillis(scById.get(a.id)!.arrivedAt),
  )[0]
  let pendingStop: ArrivedStopView | null = null
  if (last) {
    const view = toArrivedStopView({ clueId: last.id, clue: last.clue, sc: scById.get(last.id), totalClues })
    const onSiteOpen = !!view.onSite && !view.onSite.done
    const triviaOpen = !!view.trivia && !view.triviaResult
    if (onSiteOpen || triviaOpen) pendingStop = view
  }

  if (activeIdx < 0 && !pendingStop) redirect(`/hunt/complete?session=${sessionId}`)

  const viewFor = (i: number): ActiveClueView => toActiveClueView({
    huntId, clueId: clues[i].id, clue: clues[i].clue, sc: scById.get(clues[i].id) ?? null,
    difficulty, totalClues, unlockedTiers: tiersByClue.get(clues[i].id) ?? [],
  })
  const active = activeIdx >= 0 ? viewFor(activeIdx) : null
  // Remaining stops, so play can continue offline after an offline arrival.
  const upcoming = activeIdx >= 0 ? clues.slice(activeIdx + 1).map((_, k) => viewFor(activeIdx + 1 + k)) : []

  const completed = arrived
    .filter(c => !pendingStop || c.id !== pendingStop.id)
    .map(c => toCompletedClueView({ clueId: c.id, clue: c.clue, sc: scById.get(c.id) }))

  // Public mystery parts only — the solution lives in huntSecrets.
  let mystery: MysterySpec | null = null
  if (hunt.mystery) {
    const { solution: _solution, ...pub } = hunt.mystery
    mystery = pub as MysterySpec
  }

  return (
    <HuntClient
      initialClue={active}
      upcoming={upcoming}
      completed={completed}
      pendingStop={pendingStop}
      huntCity={session.huntCity ?? ''}
      cityId={(session.cityId as string | null) ?? hunt.cityId ?? null}
      sessionId={sessionId}
      roomId={session.roomId ?? null}
      huntId={huntId}
      initialCredits={typeof session.credits === 'number' ? session.credits : 0}
      initialScore={typeof session.score === 'number' ? session.score : 0}
      creditsFlag={searchParams.credits ?? null}
      mystery={mystery}
    />
  )
}
