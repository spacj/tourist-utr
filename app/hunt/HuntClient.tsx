'use client'
import { useEffect, useState } from 'react'
import { Clue, MysterySpec } from '@/types'
import { ClueScreen } from '@/components/ClueScreen'
import { RoomScoreboard } from '@/components/RoomScoreboard'
import { useServiceWorker } from '@/hooks/useServiceWorker'
import { saveHuntToIndexedDB } from '@/lib/indexedDB'

interface Props {
  initialClue: Clue
  huntCity: string
  sessionId: string
  roomId: string | null
  huntId: string | null
  initialCredits: number
  initialScore: number
  creditsJustAdded: boolean
  allClues: Array<Record<string, unknown>>
  mystery?: MysterySpec | null
}

export function HuntClient({ initialClue, huntCity, sessionId, roomId, huntId, initialCredits, initialScore, creditsJustAdded, allClues, mystery }: Props) {
  const [clue, setClue] = useState(initialClue)
  const [score, setScore] = useState(initialScore)
  const [credits, setCredits] = useState(initialCredits)
  const [transitioning, setTransitioning] = useState(false)
  const { cacheHunt } = useServiceWorker()

  useEffect(() => {
    if (creditsJustAdded) {
      fetch(`/api/session-credits?session=${sessionId}`)
        .then((r) => r.json())
        .then((d) => { if (d.credits) setCredits(d.credits) })
    }
  }, [creditsJustAdded, sessionId])

  useEffect(() => {
    if (!huntId || !allClues.length) return
    let cancelled = false
    saveHuntToIndexedDB(huntId, { huntId }, allClues).catch(() => {})
    try {
      cacheHunt(huntId, { huntId }, allClues)
    } catch {}
    return () => { cancelled = true }
  }, [huntId, allClues, cacheHunt])

  const handleComplete = ({
    nextClue,
    huntComplete,
  }: {
    nextClue: Clue | null
    huntComplete: boolean
  }) => {
    if (huntComplete || !nextClue) {
      window.location.href = `/hunt/complete?session=${sessionId}`
      return
    }
    setTransitioning(true)
    setTimeout(() => {
      setScore((s) => s + 100)
      setClue(nextClue)
      setTransitioning(false)
    }, 600)
  }

  // Clues with order < current are already completed — derived from allClues
  // so the history viewer survives page reloads without needing a server round-trip.
  const completedClues = (allClues as unknown as Clue[]).filter((c) => c.order < clue.order)

  return (
    <>
      <div className={`game-transition ${transitioning ? 'fade-out' : 'fade-in'}`}>
        <ClueScreen
          clue={clue}
          huntCity={huntCity}
          sessionId={sessionId}
          initialCredits={credits}
          totalScore={score}
          onComplete={handleComplete}
          allClues={allClues as unknown as Clue[]}
          completedClues={completedClues}
          mystery={mystery ?? null}
        />
      </div>
      {roomId && huntId && <RoomScoreboard roomId={roomId} totalClues={clue.totalClues} huntId={huntId} />}
      {transitioning && (
        <div className="transition-overlay">
          <div className="spinner" />
          <p style={{ marginTop: 12, fontSize: 14, color: '#8b8aaa' }}>Next clue...</p>
        </div>
      )}
    </>
  )
}
