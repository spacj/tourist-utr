'use client'
import { useEffect, useRef, useState } from 'react'
import { apiPost, ApiError } from '@/lib/apiFetch'
import { enqueue } from '@/lib/offlineQueue'
import { haversineM } from '@/lib/geo'
import { isNetworkFailure } from '@/lib/gameClient'
import type { GpsFix } from '@/hooks/useGPS'
import {
  arrivalRadiusM, type ActiveClueView, type ArrivalResponse, type VerifyResponse, type Warmth,
} from '@/types'

const MIN_INTERVAL_MS = 8_000
const MIN_MOVE_M = 10
const MAX_INTERVAL_MS = 20_000

/**
 * Posts the player's position to /api/verify-location, throttled: at least
 * 8 s apart AND moved ≥ 10 m, or every 20 s regardless. A fix that is already
 * inside the arrival radius of a known target is sent right away.
 *
 * Offline (or the request fails on the network) and the target is known →
 * arrival is detected locally, the verify POST is queued with the fix time
 * (`at`), and `onOfflineArrival` advances the game.
 */
export function useLocationCheck(o: {
  sessionId: string
  clue: ActiveClueView
  fix: GpsFix | null
  enabled: boolean
  onArrived: (r: ArrivalResponse) => void
  onOfflineArrival: (fix: GpsFix) => void
  onError: (code: string) => void
  onScore?: (total: number) => void
}) {
  const [warmth, setWarmth] = useState<Warmth | null>(null)
  const [distanceM, setDistanceM] = useState<number | null>(null)
  const [bearing, setBearing] = useState<number | null>(null)

  const last = useRef<{ at: number; lat: number; lng: number } | null>(null)
  const inFlight = useRef(false)
  const done = useRef(false)
  const latest = useRef(o)
  latest.current = o

  // Reset per stop.
  useEffect(() => {
    last.current = null
    done.current = false
    setWarmth(null); setDistanceM(null); setBearing(null)
  }, [o.clue.id])

  const insideTarget = (fix: GpsFix): boolean => {
    const t = latest.current.clue.target
    if (!t) return false
    return haversineM(fix.lat, fix.lng, t.lat, t.lng) <= arrivalRadiusM(t.radiusM, fix.accuracy)
  }

  const arriveOffline = async (fix: GpsFix) => {
    const { sessionId, clue } = latest.current
    if (done.current) return
    done.current = true
    await enqueue({
      url: '/api/verify-location',
      body: { sessionId, clueId: clue.id, lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy, at: fix.at },
      reconcileKey: `verify:${sessionId}:${clue.id}`,
    })
    latest.current.onOfflineArrival(fix)
  }

  const check = async (force = false) => {
    const { enabled, fix, sessionId, clue } = latest.current
    if (!enabled || !fix || done.current || inFlight.current) return
    const now = Date.now()
    const inside = insideTarget(fix)

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      if (inside) await arriveOffline(fix)
      return
    }

    const prev = last.current
    if (prev && !force && !inside) {
      const elapsed = now - prev.at
      const moved = haversineM(prev.lat, prev.lng, fix.lat, fix.lng)
      const due = (elapsed >= MIN_INTERVAL_MS && moved >= MIN_MOVE_M) || elapsed >= MAX_INTERVAL_MS
      if (!due) return
    }
    if (prev && inside && now - prev.at < 2_000) return

    inFlight.current = true
    last.current = { at: now, lat: fix.lat, lng: fix.lng }
    try {
      const r = await apiPost<VerifyResponse>('/api/verify-location', {
        sessionId, clueId: clue.id, lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy,
      })
      if (latest.current.clue.id !== clue.id) return
      if (r.arrived) {
        done.current = true
        latest.current.onArrived(r)
      } else {
        setWarmth(r.warmth)
        setDistanceM(typeof r.distanceM === 'number' ? r.distanceM : null)
        setBearing(typeof r.bearing === 'number' ? r.bearing : null)
        if (typeof r.totalScore === 'number') latest.current.onScore?.(r.totalScore)
      }
    } catch (e) {
      if (e instanceof ApiError) {
        // A stale stop (already advanced elsewhere) isn't worth a toast.
        if (e.code !== 'clue_not_active' && e.code !== 'rate_limited') latest.current.onError(e.code)
      } else if (isNetworkFailure(e) && inside) {
        await arriveOffline(fix)
      }
    } finally {
      inFlight.current = false
    }
  }

  // Every new fix…
  useEffect(() => {
    void check()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.fix, o.enabled, o.clue.id, o.clue.target])

  // …and a heartbeat, since a stationary phone may not emit new fixes.
  useEffect(() => {
    if (!o.enabled) return
    const id = setInterval(() => { void check() }, 5_000)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.enabled, o.clue.id])

  /** Admin-only debug arrival (server checks the admin claim). */
  const debugArrive = async () => {
    const { sessionId, clue, fix } = latest.current
    if (inFlight.current) return
    inFlight.current = true
    try {
      const r = await apiPost<VerifyResponse>('/api/verify-location', {
        sessionId, clueId: clue.id,
        lat: fix?.lat ?? clue.zone.lat, lng: fix?.lng ?? clue.zone.lng,
        accuracy: fix?.accuracy ?? 0, debugArrive: true,
      })
      if (r.arrived) { done.current = true; latest.current.onArrived(r) }
    } catch (e) {
      latest.current.onError(e instanceof ApiError ? e.code : 'network')
    } finally {
      inFlight.current = false
    }
  }

  return { warmth, distanceM, bearing, debugArrive, markDone: () => { done.current = true } }
}
