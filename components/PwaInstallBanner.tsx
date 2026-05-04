'use client'
import { useEffect, useState } from 'react'
import { useI18n } from '@/hooks/useI18n'

const DISMISS_KEY = 'pwa-install-dismissed-at'
const DISMISS_DAYS = 7

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  return (window.navigator as any).standalone === true
}

function isMobileWidth(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(max-width: 820px)').matches
}

function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const isIos = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream
  const isSafari = /^((?!chrome|crios|fxios|edgios|opios).)*safari/i.test(ua)
  return isIos && isSafari
}

function isRecentlyDismissed(): boolean {
  try {
    const at = localStorage.getItem(DISMISS_KEY)
    if (!at) return false
    const elapsed = Date.now() - Number(at)
    return elapsed < DISMISS_DAYS * 24 * 60 * 60 * 1000
  } catch {
    return false
  }
}

export function PwaInstallBanner() {
  const { t } = useI18n()
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [iosHint, setIosHint] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isStandalone() || !isMobileWidth() || isRecentlyDismissed()) return

    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)

    const onInstalled = () => {
      setVisible(false)
      setDeferred(null)
    }
    window.addEventListener('appinstalled', onInstalled)

    if (isIosSafari()) {
      const id = window.setTimeout(() => {
        setIosHint(true)
        setVisible(true)
      }, 4000)
      return () => {
        window.clearTimeout(id)
        window.removeEventListener('beforeinstallprompt', onBeforeInstall)
        window.removeEventListener('appinstalled', onInstalled)
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch {}
    setVisible(false)
  }

  const install = async () => {
    if (!deferred) return
    try {
      await deferred.prompt()
      const choice = await deferred.userChoice
      if (choice.outcome === 'dismissed') dismiss()
      setDeferred(null)
      setVisible(false)
    } catch {
      setVisible(false)
    }
  }

  if (!visible) return null

  return (
    <div className="pwa-banner" role="dialog" aria-live="polite">
      <div className="pwa-banner-icon" aria-hidden>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="2" width="14" height="20" rx="3"/>
          <line x1="12" y1="18" x2="12" y2="18"/>
        </svg>
      </div>
      <div className="pwa-banner-body">
        <div className="pwa-banner-title">{t('pwaInstallTitle')}</div>
        <div className="pwa-banner-desc">
          {iosHint ? t('pwaIosStep') : t('pwaInstallBody')}
        </div>
      </div>
      <div className="pwa-banner-actions">
        {!iosHint && deferred && (
          <button className="pwa-banner-cta" onClick={install}>
            {t('pwaInstallCta')}
          </button>
        )}
        <button className="pwa-banner-dismiss" onClick={dismiss} aria-label={t('pwaInstallDismiss')}>
          {iosHint ? '✕' : t('pwaInstallDismiss')}
        </button>
      </div>
    </div>
  )
}
