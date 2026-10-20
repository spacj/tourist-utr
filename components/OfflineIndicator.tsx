'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useI18n } from '@/hooks/useI18n'

/**
 * Site-wide offline notice, pinned to the top (below the safe area) so it
 * never covers bottom sheets or buttons. Hidden on the game screens, which
 * show their own banner.
 */
export function OfflineIndicator() {
  const { t } = useI18n()
  const pathname = usePathname()
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    setIsOnline(navigator.onLine)
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  if (isOnline) return null
  if (pathname === '/hunt' || pathname === '/tour') return null

  return (
    <div className="offline-indicator game-offline-top" role="status" aria-live="polite">
      <span className="offline-indicator-icon" aria-hidden>📡</span>
      <span className="offline-indicator-text">{t('offlineSiteBanner')}</span>
    </div>
  )
}
