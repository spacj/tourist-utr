// hooks/useCredits.ts
'use client'
import { useCallback, useState } from 'react'
import { HINT_COSTS, HintTier } from '@/types'

export function useCredits(initial: number, sessionId: string) {
  const [credits,   setCredits]   = useState(initial)
  const [unlocking, setUnlocking] = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  const canAfford = useCallback((tier: HintTier) => credits >= HINT_COSTS[tier], [credits])

  const unlockHint = useCallback(async (clueId: string, tier: HintTier): Promise<boolean> => {
    setUnlocking(true)
    setError(null)
    try {
      const res  = await fetch('/api/hints/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, clueId, tier }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); return false }
      if (typeof data.creditsRemaining === 'number') setCredits(data.creditsRemaining)
      return true
    } catch {
      setError('Network error')
      return false
    } finally {
      setUnlocking(false)
    }
  }, [sessionId])

  const startCheckout = useCallback(async (packageId: string) => {
    const res  = await fetch('/api/purchases/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, packageId }),
    })
    const { url } = await res.json()
    if (url) window.location.href = url
  }, [sessionId])

  return { credits, canAfford, unlockHint, unlocking, error, startCheckout }
}
