// hooks/useCredits.ts
'use client'
import { useCallback, useEffect, useState } from 'react'
import { HINT_COSTS, HintTier } from '@/types'
import { enqueue, onReplay } from '@/lib/offlineQueue'

function isNetworkError(err: unknown): boolean {
  // fetch throws TypeError on offline / DNS failure / unreachable host.
  return err instanceof TypeError
}

export function useCredits(initial: number, sessionId: string) {
  const [credits,   setCredits]   = useState(initial)
  const [unlocking, setUnlocking] = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  const canAfford = useCallback((tier: HintTier) => credits >= HINT_COSTS[tier], [credits])

  // When a queued hint-unlock replays successfully, the server returns the
  // authoritative creditsRemaining. Reconcile our optimistic local count.
  useEffect(() => {
    return onReplay((item, response) => {
      if (item.url !== '/api/hints/unlock') return
      if ((item.body as any)?.sessionId !== sessionId) return
      const r = response as { creditsRemaining?: number } | null
      if (r && typeof r.creditsRemaining === 'number') setCredits(r.creditsRemaining)
    })
  }, [sessionId])

  const unlockHint = useCallback(async (clueId: string, tier: HintTier): Promise<boolean> => {
    setUnlocking(true)
    setError(null)
    try {
      const res = await fetch('/api/hints/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, clueId, tier }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? 'Failed'); return false }
      if (typeof data.creditsRemaining === 'number') setCredits(data.creditsRemaining)
      return true
    } catch (e) {
      // Offline: optimistically decrement local credits and queue the spend
      // so it replays once the network is back.
      if (isNetworkError(e)) {
        await enqueue({
          url: '/api/hints/unlock',
          body: { sessionId, clueId, tier },
          reconcileKey: `hint:${sessionId}:${clueId}:${tier}`,
        })
        setCredits(c => Math.max(0, c - HINT_COSTS[tier]))
        return true
      }
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
