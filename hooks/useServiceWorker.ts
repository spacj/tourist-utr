'use client'
import { useEffect, useState, useCallback } from 'react'

export function useServiceWorker() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const [isSupported, setIsSupported] = useState(false)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      setIsSupported(true)
      navigator.serviceWorker.ready.then((reg) => {
        setRegistration(reg)
        setIsReady(true)
      }).catch(() => {})
    }
  }, [])

  const cacheHunt = useCallback((huntId: string, huntData: Record<string, unknown>, clues: unknown[]) => {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CACHE_HUNT',
        huntId,
        huntData,
        clues,
      })
    }
  }, [])

  return { registration, isSupported, isReady, cacheHunt }
}
