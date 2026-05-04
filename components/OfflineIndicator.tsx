'use client'
import { useEffect, useState } from 'react'

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    setIsOnline(navigator.onLine)
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (isOnline) return null

  return (
    <div className="offline-indicator" role="status" aria-live="polite">
      <span className="offline-indicator-icon">📡</span>
      <span className="offline-indicator-text">You're offline — cached content is available</span>
    </div>
  )
}
