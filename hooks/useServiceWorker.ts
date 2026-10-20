'use client'
import { useCallback, useEffect, useState } from 'react'

/**
 * Registers /sw.js?v=<build id> (production only) and reports when a new
 * version has installed and is waiting. The worker never activates itself;
 * `applyUpdate()` tells it to (SKIP_WAITING) and reloads once it controls
 * the page. Mount this once (OfflineIndicator does, from the root layout).
 */
const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID || 'dev'
const ENABLED = process.env.NODE_ENV === 'production'

let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null

function register(): Promise<ServiceWorkerRegistration | null> {
  if (!registrationPromise) {
    registrationPromise = navigator.serviceWorker
      .register(`/sw.js?v=${encodeURIComponent(BUILD_ID)}`, { scope: '/', updateViaCache: 'none' })
      .catch(() => null)
  }
  return registrationPromise
}

export function useServiceWorker() {
  const [isSupported, setIsSupported] = useState(false)
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const [updateReady, setUpdateReady] = useState(false)

  useEffect(() => {
    if (!ENABLED || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    setIsSupported(true)
    let cancelled = false
    let reg: ServiceWorkerRegistration | null = null

    // A waiting worker only means "update" when an older one controls the page.
    const markIfWaiting = (r: ServiceWorkerRegistration) => {
      if (r.waiting && navigator.serviceWorker.controller && !cancelled) setUpdateReady(true)
    }
    const onUpdateFound = () => {
      const installing = reg?.installing
      installing?.addEventListener('statechange', () => {
        if (installing.state === 'installed' && reg) markIfWaiting(reg)
      })
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') reg?.update().catch(() => {})
    }

    const start = () => {
      register().then(r => {
        if (!r || cancelled) return
        reg = r
        setRegistration(r)
        markIfWaiting(r)
        r.addEventListener('updatefound', onUpdateFound)
        document.addEventListener('visibilitychange', onVisible)
      })
    }
    // Don't compete with first paint / hydration for bandwidth.
    if (document.readyState === 'complete') start()
    else window.addEventListener('load', start, { once: true })

    return () => {
      cancelled = true
      window.removeEventListener('load', start)
      reg?.removeEventListener('updatefound', onUpdateFound)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  const applyUpdate = useCallback(() => {
    const waiting = registration?.waiting
    if (!waiting) { window.location.reload(); return }
    let reloaded = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return
      reloaded = true
      window.location.reload()
    })
    waiting.postMessage({ type: 'SKIP_WAITING' })
  }, [registration])

  return { isSupported, registration, updateReady, applyUpdate }
}
