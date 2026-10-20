'use client'
import { useCallback, useEffect, useState } from 'react'

interface DeviceOrientationResult {
  /** Compass heading in degrees clockwise from north, or null when unknown. */
  heading: number | null
  /** The browser exposes orientation events at all. */
  supported: boolean
  /** iOS: permission must be requested from a user gesture (show "Enable compass"). */
  needsPermission: boolean
  /** Call from a click handler. Resolves true when granted. */
  requestPermission: () => Promise<boolean>
}

type OrientationEventWithCompass = DeviceOrientationEvent & { webkitCompassHeading?: number }

/**
 * Device compass heading.
 *  - Android/Chrome: `deviceorientationabsolute` (alpha is relative to north).
 *  - iOS Safari: `deviceorientation` with `webkitCompassHeading`, after
 *    DeviceOrientationEvent.requestPermission() from a user gesture.
 *  - Elsewhere: `deviceorientation` only when `absolute === true`.
 */
export function useDeviceOrientation(): DeviceOrientationResult {
  const [heading, setHeading] = useState<number | null>(null)
  const [supported, setSupported] = useState(false)
  const [needsPermission, setNeedsPermission] = useState(false)
  const [listening, setListening] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const hasEvents = 'ondeviceorientationabsolute' in window || 'ondeviceorientation' in window
    setSupported(hasEvents)
    if (!hasEvents) return
    const DOE = (window as any).DeviceOrientationEvent
    if (DOE && typeof DOE.requestPermission === 'function') {
      setNeedsPermission(true) // iOS 13+: wait for the button
    } else {
      setListening(true)
    }
  }, [])

  useEffect(() => {
    if (!listening || typeof window === 'undefined') return
    const useAbsolute = 'ondeviceorientationabsolute' in window
    let last = -1
    const handler = (e: Event) => {
      const ev = e as OrientationEventWithCompass
      let h: number | null = null
      if (typeof ev.webkitCompassHeading === 'number' && !Number.isNaN(ev.webkitCompassHeading)) {
        h = ev.webkitCompassHeading
      } else if (ev.alpha !== null && (useAbsolute || ev.absolute === true)) {
        h = (360 - ev.alpha) % 360
      }
      if (h === null) return
      const rounded = Math.round(h)
      // Skip sub-2° jitter to avoid re-rendering on every sensor tick.
      if (last >= 0 && Math.abs(((rounded - last + 540) % 360) - 180) < 2) return
      last = rounded
      setHeading(rounded)
    }
    const type = useAbsolute ? 'deviceorientationabsolute' : 'deviceorientation'
    window.addEventListener(type, handler, true)
    return () => window.removeEventListener(type, handler, true)
  }, [listening])

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined') return false
    const DOE = (window as any).DeviceOrientationEvent
    if (DOE && typeof DOE.requestPermission === 'function') {
      try {
        const state = await DOE.requestPermission()
        if (state === 'granted') {
          setNeedsPermission(false)
          setListening(true)
          return true
        }
      } catch { /* denied or not from a gesture */ }
      return false
    }
    setListening(true)
    return true
  }, [])

  return { heading, supported, needsPermission, requestPermission }
}
