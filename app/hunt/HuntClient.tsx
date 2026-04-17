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
  const [clue,    setClue]    = useState(initialClue)
  const [score,   setScore]   = useState(initialScore)
  const [credits, setCredits] = useState(initialCredits)

  useEffect(() => {
    if (creditsJustAdded) {
      // Re-fetch credits from server after Stripe redirect
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
    setScore((s) => s + 100)   // optimistic; server has real value
    setClue(nextClue)
  }

  return (
    <ClueScreen
      clue={clue}
      sessionId={sessionId}
      initialCredits={credits}
      totalScore={score}
      onComplete={handleComplete}
    />
  )
}
