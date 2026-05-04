'use client'
import { useEffect, useState } from 'react'
import { Clue } from '@/types'
import { ClueScreen } from '@/components/ClueScreen'
import { RoomScoreboard } from '@/components/RoomScoreboard'

interface Props {
  initialClue: Clue
  huntCity: string
  sessionId: string
  roomId: string | null
  huntId: string | null
  initialCredits: number
  initialScore: number
  creditsJustAdded: boolean
}

export function HuntClient({ initialClue, huntCity, sessionId, roomId, huntId, initialCredits, initialScore, creditsJustAdded }: Props) {
  const [clue, setClue] = useState(initialClue)
  const [score, setScore] = useState(initialScore)
  const [credits, setCredits] = useState(initialCredits)
  const [transitioning, setTransitioning] = useState(false)

  useEffect(() => {
    if (creditsJustAdded) {
      fetch(`/api/session-credits?session=${sessionId}`)
        .then((r) => r.json())
        .then((d) => { if (d.credits) setCredits(d.credits) })
    }
  }, [creditsJustAdded, sessionId])

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
