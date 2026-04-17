// hooks/useGPS.ts
'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { VerifyResponse } from '@/types'

export function useGPS(opts: {
  sessionId: string
  clueId: string
  enabled: boolean
  onArrived: (data: VerifyResponse) => void
  intervalMs?: number
}) {
  const { sessionId, clueId, enabled, onArrived, intervalMs = 5000 } = opts
  const [distanceM,   setDistanceM]   = useState<number | null>(null)
  const [bearing,     setBearing]     = useState(0)
  const [dynamicH3,   setDynamicH3]   = useState<string | null>(null)
  const [gpsError,    setGpsError]    = useState<string | null>(null)
  const [accuracy,    setAccuracy]    = useState<number | null>(null)
  const arrivedRef = useRef(false)
  const timerRef   = useRef<ReturnType<typeof setInterval>>()

  const poll = useCallback(async () => {
    if (arrivedRef.current) return
    let pos: GeolocationPosition
    try {
      pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, {
          enableHighAccuracy: true, timeout: 8000, maximumAge: 3000,
        })
      )
    } catch (e: unknown) {
      const code = (e instanceof GeolocationPositionError) ? e.code : 0
      setGpsError(['', 'Location access denied', 'Position unavailable', 'GPS timed out'][code] ?? 'GPS error')
      return
    }
    setAccuracy(Math.round(pos.coords.accuracy))
    setGpsError(null)

    const res  = await fetch('/api/verify-location', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, clueId, lat: pos.coords.latitude, lng: pos.coords.longitude }),
    })
    const data = await res.json() as VerifyResponse & { dynamicHint3?: string }

    if (data.arrived) {
      arrivedRef.current = true
      clearInterval(timerRef.current)
      onArrived(data)
    } else {
      setDistanceM(data.distanceM ?? null)
      setBearing(data.bearing ?? 0)
      if (data.dynamicHint3) setDynamicH3(data.dynamicHint3)
    }
  }, [sessionId, clueId, onArrived])

  useEffect(() => {
    if (!enabled) return
    arrivedRef.current = false
    poll()
    timerRef.current = setInterval(poll, intervalMs)
    return () => clearInterval(timerRef.current)
  }, [enabled, poll, intervalMs])

  return { distanceM, bearing, dynamicH3, gpsError, accuracy }
}
