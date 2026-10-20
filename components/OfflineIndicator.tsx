'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useI18n } from '@/hooks/useI18n'
import { useServiceWorker } from '@/hooks/useServiceWorker'
import { WifiOff } from 'lucide-react'

/**
 * Site-wide offline notice, pinned to the top (below the safe area) so it
 * never covers bottom sheets or buttons. Hidden on the game screens, which
 * show their own banner.
 *
 * Also owns service-worker registration and the "new version — reload"
 * banner (never shown mid-game, so an update can't interrupt a hunt).
 */
export function OfflineIndicator() {
  const { t } = useI18n()
  const pathname = usePathname()
  const [isOnline, setIsOnline] = useState(true)
  const { updateReady, applyUpdate } = useServiceWorker()
  const [dismissed, setDismissed] = useState(false)

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

  const inGame = pathname === '/hunt' || pathname === '/tour'
  if (inGame) return null

  if (!isOnline) {
    return (
      <div className="offline-indicator game-offline-top" role="status" aria-live="polite">
        <span className="offline-indicator-icon" aria-hidden><WifiOff size={16} strokeWidth={2} /></span>
        <span className="offline-indicator-text">{t('offlineSiteBanner')}</span>
      </div>
    )
  }

  if (updateReady && !dismissed) {
    return (
      <div className="sw-update-banner" role="status" aria-live="polite">
        <span className="sw-update-text">{t('updateReady')}</span>
        <button type="button" className="sw-update-btn" onClick={applyUpdate}>{t('updateReload')}</button>
        <button type="button" className="sw-update-close" onClick={() => setDismissed(true)} aria-label={t('dismiss')}>×</button>
      </div>
    )
  }

  return null
}
