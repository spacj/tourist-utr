'use client'
import { Smartphone, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useI18n } from '@/hooks/useI18n'

const DISMISS_KEY = 'pwa-install-dismissed-at'
const DISMISS_DAYS = 30
const VIEWS_KEY = 'pwa-page-views'
const MIN_PAGE_VIEWS = 2
/** Set (to anything) once the player completes a stop. */
export const PWA_ENGAGED_KEY = 'pwa-engaged'
/** Window event the game can dispatch when a stop is completed. */
export const PWA_ENGAGED_EVENT = 'tourhunts:stop-completed'

/** Never interrupt gameplay or a race lobby. */
const HIDDEN_PREFIXES = ['/hunt', '/tour', '/multiplayer']

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** Call from game code after a stop is completed (also fine to dispatch PWA_ENGAGED_EVENT). */
export function markPwaEngaged(): void {
  try { localStorage.setItem(PWA_ENGAGED_KEY, '1') } catch {}
}

function isStandalone(): boolean {
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  return (window.navigator as any).standalone === true
}

function isMobileWidth(): boolean {
  return window.matchMedia('(max-width: 820px)').matches
}

function isIosSafari(): boolean {
  const ua = navigator.userAgent
  const isIos = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream
  const isSafari = /^((?!chrome|crios|fxios|edgios|opios).)*safari/i.test(ua)
  return isIos && isSafari
}

function read(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}

function isRecentlyDismissed(): boolean {
  const at = Number(read(DISMISS_KEY))
  return !!at && Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000
}

function isEngaged(): boolean {
  return !!read(PWA_ENGAGED_KEY) || Number(read(VIEWS_KEY) || 0) >= MIN_PAGE_VIEWS
}

export function PwaInstallBanner() {
  const { t } = useI18n()
  const pathname = usePathname() || '/'
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [ios, setIos] = useState(false)
  const [eligible, setEligible] = useState(false)
  const [dismissed, setDismissed] = useState(true)

  const onHiddenRoute = HIDDEN_PREFIXES.some(p => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(`${p}?`))

  // Count page views (client navigations included) toward engagement.
  useEffect(() => {
    try { localStorage.setItem(VIEWS_KEY, String(Number(read(VIEWS_KEY) || 0) + 1)) } catch {}
    if (isEngaged()) setEligible(true)
  }, [pathname])

  useEffect(() => {
    if (isStandalone() || !isMobileWidth()) return
    setDismissed(isRecentlyDismissed())
    setIos(isIosSafari())
    if (isEngaged()) setEligible(true)

    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => { setDeferred(null); setDismissed(true) }
    const onEngaged = () => { markPwaEngaged(); setEligible(true) }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    window.addEventListener(PWA_ENGAGED_EVENT, onEngaged)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
      window.removeEventListener(PWA_ENGAGED_EVENT, onEngaged)
    }
  }, [])

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch {}
    setDismissed(true)
  }

  const install = async () => {
    if (!deferred) return
    try {
      await deferred.prompt()
      const choice = await deferred.userChoice
      if (choice.outcome === 'dismissed') dismiss()
    } catch {}
    setDeferred(null)
  }

  const canOffer = !!deferred || ios
  if (dismissed || !eligible || onHiddenRoute || !canOffer) return null

  const showIosHint = ios && !deferred

  return (
    <div className="pwa-banner" role="region" aria-label={t('pwaInstallTitle')}>
      <div className="pwa-banner-icon" aria-hidden>
        <Smartphone size={28} strokeWidth={1.75} />
      </div>
      <div className="pwa-banner-body">
        <div className="pwa-banner-title">{t('pwaInstallTitle')}</div>
        <div className="pwa-banner-desc">{showIosHint ? t('pwaIosStep') : t('pwaInstallBody')}</div>
      </div>
      <div className="pwa-banner-actions">
        {deferred && (
          <button type="button" className="pwa-banner-cta" onClick={install}>{t('pwaInstallCta')}</button>
        )}
        <button type="button" className="pwa-banner-dismiss" onClick={dismiss} aria-label={t('pwaInstallDismiss')}>
          {showIosHint ? <X size={18} strokeWidth={2} aria-hidden /> : t('pwaInstallDismiss')}
        </button>
      </div>
    </div>
  )
}
