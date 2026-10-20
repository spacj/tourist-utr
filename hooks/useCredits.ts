'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { apiPost, ApiError } from '@/lib/apiFetch'
import type { ActiveClueView, HintContent, HintTier, LatLngRadius } from '@/types'

export interface UnlockResult {
  ok: true
  alreadyUnlocked: boolean
  credits: number
  tier: HintTier
  content: HintContent | null
  target?: LatLngRadius
  clue: ActiveClueView | null
}

export type UnlockOutcome =
  | { ok: true; data: UnlockResult }
  | { ok: false; code: string }

/**
 * Hint credits for one session. `credits` follows the prop (HuntClient
 * refreshes it after a PayPal return), and every server reply that carries a
 * balance updates it. Errors come back as codes for the caller to show.
 */
export function useCredits(initial: number, sessionId: string) {
  const [credits, setCredits] = useState(initial)
  const [unlocking, setUnlocking] = useState<HintTier | null>(null)
  const inFlight = useRef(false)

  // Fix stale initial state: follow the prop when the parent refreshes it.
  useEffect(() => { setCredits(initial) }, [initial])

  const unlock = useCallback(async (clueId: string, tier: HintTier): Promise<UnlockOutcome> => {
    if (inFlight.current) return { ok: false, code: 'busy' }
    if (typeof navigator !== 'undefined' && !navigator.onLine) return { ok: false, code: 'offline' }
    inFlight.current = true
    setUnlocking(tier)
    try {
      const data = await apiPost<UnlockResult>('/api/hints/unlock', { sessionId, clueId, tier })
      if (typeof data.credits === 'number') setCredits(data.credits)
      return { ok: true, data }
    } catch (e) {
      if (e instanceof ApiError) return { ok: false, code: e.code }
      return { ok: false, code: 'network' }
    } finally {
      inFlight.current = false
      setUnlocking(null)
    }
  }, [sessionId])

  /** Start a PayPal checkout. Resolves true when the browser is redirecting. */
  const startCheckout = useCallback(async (packageId: string): Promise<{ ok: boolean; code?: string }> => {
    try {
      const { url } = await apiPost<{ url?: string }>('/api/purchases/checkout', { sessionId, packageId })
      if (url) {
        window.location.href = url
        return { ok: true }
      }
      return { ok: false, code: 'checkout_failed' }
    } catch (e) {
      return { ok: false, code: e instanceof ApiError ? e.code : 'network' }
    }
  }, [sessionId])

  const canAfford = useCallback((cost: number) => credits >= cost, [credits])

  return { credits, setCredits, canAfford, unlock, unlocking, startCheckout }
}
