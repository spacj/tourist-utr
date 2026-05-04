'use client'
import { useState, useEffect, useRef } from 'react'

interface DeviceOrientationResult {
  heading: number | null
  available: boolean
  requestPermission: () => Promise<boolean>
}

export function useDeviceOrientation(): DeviceOrientationResult {
  const [heading, setHeading] = useState<number | null>(null)
  const [available, setAvailable] = useState(false)
  const grantedRef = useRef(false)

  const requestPermission = async (): Promise<boolean> => {
    if (typeof DeviceOrientationEvent === 'undefined') return false
    const DOE = DeviceOrientationEvent as any
    if (typeof DOE.requestPermission === 'function') {
      try {
        const state = await DOE.requestPermission()
        if (state === 'granted') {
          grantedRef.current = true
          return true
        }
      } catch { /* iOS user denied */ }
      return false
    }
    grantedRef.current = true
    return true
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (typeof navigator === 'undefined') return

    const hasOrientation = 'ondeviceorientationabsolute' in window || 'ondeviceorientation' in window
    if (!hasOrientation) return

    const handler = (e: DeviceOrientationEvent) => {
      const ev = e as any
      let h: number | null = null

      if (ev.webkitCompassHeading !== undefined) {
        h = ev.webkitCompassHeading
      } else if (e.alpha !== null) {
        const abs = 'ondeviceorientationabsolute' in window && ev.absolute === true
        h = abs ? (360 - e.alpha) % 360 : null
      }

      if (h !== null) {
        setAvailable(true)
        setHeading(Math.round(h))
      }
    }

    if (grantedRef.current) {
      window.addEventListener('deviceorientation', handler, true)
      return () => window.removeEventListener('deviceorientation', handler, true)
    }

    let cancelled = false
    requestPermission().then(ok => {
      if (!cancelled && ok) {
        window.addEventListener('deviceorientation', handler, true)
      }
    })

    return () => {
      cancelled = true
      window.removeEventListener('deviceorientation', handler, true)
    }
  }, [])

  return { heading, available, requestPermission }
}
