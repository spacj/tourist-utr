'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

export type GpsError = 'denied' | 'unavailable' | 'timeout' | 'unsupported'

export interface GpsFix {
  lat: number
  lng: number
  /** Metres (rounded). */
  accuracy: number
  /** ms epoch of the fix. */
  at: number
}

/**
 * The ONE geolocation watcher for the game (watchPosition, high accuracy,
 * maximumAge 5 s). Errors are codes — render them with i18n keys
 * (gpsDenied / gpsUnavailable / gpsTimeout / gpsUnsupported).
 */
export function useGPS(enabled = true): {
  fix: GpsFix | null
  error: GpsError | null
  retry: () => void
} {
  const [fix, setFix] = useState<GpsFix | null>(null)
  const [error, setError] = useState<GpsError | null>(null)
  const [attempt, setAttempt] = useState(0)
  const hasFixRef = useRef(false)

  useEffect(() => {
    if (!enabled) return
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('unsupported')
      return
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        hasFixRef.current = true
        setError(null)
        setFix({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: Math.round(p.coords.accuracy),
          at: p.timestamp || Date.now(),
        })
      },
      (e) => {
        if (e.code === 1) setError('denied')
        else if (e.code === 2) setError(hasFixRef.current ? null : 'unavailable')
        // Timeouts while we already have a fix are routine — keep watching.
        else if (e.code === 3) setError(hasFixRef.current ? null : 'timeout')
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [enabled, attempt])

  const retry = useCallback(() => {
    setError(null)
    setAttempt(a => a + 1)
  }, [])

  return { fix, error, retry }
}
