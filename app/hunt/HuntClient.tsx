'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  type ActiveClueView, type ArrivalResponse, type ArrivedStopView, type CompletedClueView,
  type MysterySpec, emptyBreakdown, breakdownTotal,
} from '@/types'
import { ClueScreen } from '@/components/ClueScreen'
import { ArrivalBanner } from '@/components/ArrivalBanner'
import { RoomScoreboard } from '@/components/RoomScoreboard'
import { useToast } from '@/components/Toast'
import { markPwaEngaged } from '@/components/PwaInstallBanner'
import { useServiceWorker } from '@/hooks/useServiceWorker'
import { useI18n } from '@/hooks/useI18n'
import { apiGet } from '@/lib/apiFetch'
import { onDropped, onReplay } from '@/lib/offlineQueue'
import { errorKey } from '@/lib/gameClient'
import type { GpsFix } from '@/hooks/useGPS'

interface Props {
  initialClue: ActiveClueView | null
  upcoming: ActiveClueView[]
  completed: CompletedClueView[]
  pendingStop: ArrivedStopView | null
  huntCity: string
  cityId: string | null
  sessionId: string
  roomId: string | null
  huntId: string
  initialCredits: number
  initialScore: number
  /** ?credits= flag after a PayPal return: added | pending | refunded | error */
  creditsFlag: string | null
  mystery: MysterySpec | null
}

interface ArrivalState {
  stop: ArrivedStopView
  nextClue: ActiveClueView | null
  huntComplete: boolean
}

export function HuntClient({
  initialClue, upcoming: initialUpcoming, completed: initialCompleted, pendingStop,
  huntCity, cityId, sessionId, roomId, huntId, initialCredits, initialScore, creditsFlag, mystery,
}: Props) {
  const { t } = useI18n()
  const toast = useToast()
  const router = useRouter()
  const { cacheHunt } = useServiceWorker()

  const [clue, setClue] = useState<ActiveClueView | null>(initialClue)
  const [upcoming, setUpcoming] = useState(initialUpcoming)
  const [completed, setCompleted] = useState(initialCompleted)
  const [score, setScore] = useState(initialScore)
  const [credits, setCredits] = useState(initialCredits)
  const [arrival, setArrival] = useState<ArrivalState | null>(
    pendingStop ? { stop: pendingStop, nextClue: initialClue, huntComplete: !initialClue } : null,
  )
  const [transitioning, setTransitioning] = useState(false)
  const clueRef = useRef(clue)
  clueRef.current = clue

  const finish = useCallback(() => {
    router.push(`/hunt/complete?session=${sessionId}`)
  }, [router, sessionId])

  // ── PayPal return (?credits=…) → toast + refresh the balance ──
  useEffect(() => {
    if (!creditsFlag) return
    const key = creditsFlag === 'added' ? 'creditsAdded'
      : creditsFlag === 'pending' ? 'creditsPending'
      : creditsFlag === 'refunded' ? 'creditsRefunded' : 'creditsError'
    if (creditsFlag === 'added') toast.success(t(key))
    else if (creditsFlag === 'pending') toast.info(t(key))
    else toast.error(t(key))
    apiGet<{ credits: number }>(`/api/session-credits?session=${encodeURIComponent(sessionId)}`)
      .then(d => { if (typeof d.credits === 'number') setCredits(d.credits) })
      .catch(() => {})
    // Drop the flag so a reload doesn't toast again.
    try {
      const url = new URL(window.location.href)
      url.searchParams.delete('credits')
      window.history.replaceState(null, '', url.toString())
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creditsFlag, sessionId])

  // ── Offline queue: surface replays that the server rejected ──
  useEffect(() => {
    const offDrop = onDropped(({ item, code }) => {
      if ((item.body as { sessionId?: string } | null)?.sessionId !== sessionId) return
      toast.error(`${t('syncDropped')} ${t(errorKey(code))}`)
    })
    const offReplay = onReplay((item, response) => {
      if ((item.body as { sessionId?: string } | null)?.sessionId !== sessionId) return
      const r = response as { totalScore?: number } | null
      if (r && typeof r.totalScore === 'number') setScore(r.totalScore)
    })
    return () => { offDrop(); offReplay() }
  }, [sessionId, toast, t])

  // ── Cache what the player has already earned for the offline page (no secrets) ──
  useEffect(() => {
    try {
      cacheHunt(huntId, { huntId, city: huntCity }, completed.map(c => ({
        id: c.id, order: c.order, locationName: c.locationName.en, riddle: c.riddle?.en ?? '',
      })))
    } catch {}
  }, [huntId, huntCity, completed, cacheHunt])

  // ── Arrival ──
  const onArrived = useCallback((r: ArrivalResponse) => {
    setScore(r.totalScore)
    setArrival({ stop: r.stop, nextClue: r.nextClue, huntComplete: r.huntComplete })
  }, [])

  const onOfflineArrival = useCallback((_fix: GpsFix) => {
    const c = clueRef.current
    if (!c) return
    const next = upcoming.find(u => u.order > c.order) ?? null
    setArrival({
      stop: {
        id: c.id, order: c.order, totalClues: c.totalClues, icon: c.icon,
        locationName: { en: '' }, lat: c.target?.lat ?? 0, lng: c.target?.lng ?? 0,
        funFact: null, evidence: null, onSite: null, trivia: null, triviaResult: null,
        breakdown: emptyBreakdown(), offline: true,
      },
      nextClue: next,
      huntComplete: !next,
    })
  }, [upcoming])

  const onNext = (finalStop: ArrivedStopView) => {
    const a = arrival
    if (!a) return
    try { markPwaEngaged() } catch {}
    const prev = clueRef.current
    const done: CompletedClueView = {
      id: finalStop.id,
      order: finalStop.order,
      icon: finalStop.icon,
      theme: prev?.id === finalStop.id ? prev.theme : null,
      riddle: prev?.id === finalStop.id ? prev.riddle : null,
      locationName: finalStop.locationName,
      lat: finalStop.lat,
      lng: finalStop.lng,
      funFact: finalStop.funFact,
      trivia: finalStop.trivia && finalStop.triviaResult ? {
        ...finalStop.trivia,
        correctIndex: finalStop.triviaResult.correctIndex,
        explain: finalStop.triviaResult.explain,
      } : null,
      evidence: finalStop.evidence,
      breakdown: finalStop.breakdown,
      points: breakdownTotal(finalStop.breakdown),
    }
    setCompleted(list => [...list.filter(c => c.id !== done.id), done])

    if (a.huntComplete || !a.nextClue) {
      if (finalStop.offline) toast.info(t('finishWhenOnline'))
      finish()
      return
    }
    const next = a.nextClue
    setTransitioning(true)
    setTimeout(() => {
      setClue(next)
      setUpcoming(list => list.filter(u => u.order > next.order))
      setArrival(null)
      setTransitioning(false)
    }, 450)
  }

  const evidenceExtra = arrival && !arrival.stop.offline
    ? [{ id: arrival.stop.id, evidence: arrival.stop.evidence }]
    : []

  return (
    <>
      {clue ? (
        <div className={`game-transition ${transitioning ? 'fade-out' : 'fade-in'}`}>
          <ClueScreen
            clue={clue}
            huntId={huntId}
            sessionId={sessionId}
            cityId={cityId}
            credits={credits}
            score={score}
            completed={completed}
            mystery={mystery}
            extraEvidence={evidenceExtra}
            active={!arrival && !transitioning}
            onArrived={onArrived}
            onOfflineArrival={onOfflineArrival}
            onClueUpdate={(v) => setClue(cur => (cur && cur.id === v.id ? v : cur))}
            onScore={setScore}
          />
        </div>
      ) : (
        <div className="game-layout game-layout-empty" />
      )}

      {arrival && !transitioning && (
        <ArrivalBanner
          key={arrival.stop.id}
          stop={arrival.stop}
          sessionId={sessionId}
          huntCity={huntCity}
          huntComplete={arrival.huntComplete}
          onNext={onNext}
          onScore={setScore}
        />
      )}

      {roomId && clue && <RoomScoreboard roomId={roomId} totalClues={clue.totalClues} huntId={huntId} />}
      {transitioning && (
        <div className="transition-overlay" role="status">
          <div className="spinner" aria-hidden />
          <p className="game-transition-text">{t('nextClueLoading')}</p>
        </div>
      )}
    </>
  )
}
