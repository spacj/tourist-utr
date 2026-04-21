'use client'
import { useEffect, useState } from 'react'
import { Clue } from '@/types'
import { ClueScreen } from '@/components/ClueScreen'

interface Props {
  initialClue: Clue
  sessionId: string
  initialCredits: number
  initialScore: number
  creditsJustAdded: boolean
}

export function HuntClient({ initialClue, sessionId, initialCredits, initialScore, creditsJustAdded }: Props) {
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
          sessionId={sessionId}
          initialCredits={credits}
          totalScore={score}
          onComplete={handleComplete}
        />
      </div>
      {transitioning && (
        <div className="transition-overlay">
          <div className="spinner" />
          <p style={{ marginTop: 12, fontSize: 14, color: '#8b8aaa' }}>Next clue...</p>
        </div>
      )}
    </>
  )
}
