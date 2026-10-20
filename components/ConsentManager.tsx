'use client'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { useI18n } from '@/hooks/useI18n'

/**
 * GDPR/ePrivacy consent. Nothing non-essential loads before the visitor
 * chooses: Google Analytics needs "analytics", AdSense needs "ads".
 * Ads are never shown on in-game screens regardless of consent.
 *
 * The choice is stored locally (`consent.v2`) and can be changed any time
 * from the footer ("Cookie settings") via `useConsent().openSettings()`.
 */

type Choice = { analytics: boolean; ads: boolean; at: number }
const KEY = 'consent.v2'
const NO_AD_ROUTES = ['/hunt', '/tour', '/multiplayer']

interface ConsentCtx {
  choice: Choice | null
  openSettings: () => void
}
const Ctx = createContext<ConsentCtx>({ choice: null, openSettings: () => {} })
export const useConsent = () => useContext(Ctx)

function readChoice(): Choice | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Choice) : null
  } catch {
    return null
  }
}

function loadScript(id: string, src: string, attrs: Record<string, string> = {}) {
  if (document.getElementById(id)) return
  const s = document.createElement('script')
  s.id = id
  s.async = true
  s.src = src
  Object.entries(attrs).forEach(([k, v]) => s.setAttribute(k, v))
  document.head.appendChild(s)
}

export function ConsentManager({
  gaId, adsClient, children,
}: { gaId: string | null; adsClient: string | null; children: ReactNode }) {
  const { t } = useI18n()
  const pathname = usePathname() ?? '/'
  const [choice, setChoice] = useState<Choice | null>(null)
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState(false)
  const [analytics, setAnalytics] = useState(true)
  const [ads, setAds] = useState(false)

  useEffect(() => {
    const c = readChoice()
    setChoice(c)
    if (!c) setOpen(true)
  }, [])

  // Apply consent: load scripts only for what was accepted.
  useEffect(() => {
    if (!choice) return
    if (choice.analytics && gaId) {
      const w = window as any
      w.dataLayer = w.dataLayer || []
      w.gtag = w.gtag || function () { w.dataLayer.push(arguments) }
      w.gtag('consent', 'default', {
        analytics_storage: 'granted',
        ad_storage: choice.ads ? 'granted' : 'denied',
        ad_user_data: choice.ads ? 'granted' : 'denied',
        ad_personalization: choice.ads ? 'granted' : 'denied',
      })
      w.gtag('js', new Date())
      w.gtag('config', gaId, { anonymize_ip: true })
      loadScript('ga-src', `https://www.googletagmanager.com/gtag/js?id=${gaId}`)
    }
    const inGame = NO_AD_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))
    if (choice.ads && adsClient && !inGame) {
      loadScript('adsbygoogle-src', `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsClient}`, { crossorigin: 'anonymous' })
    }
  }, [choice, gaId, adsClient, pathname])

  const save = useCallback((c: Omit<Choice, 'at'>) => {
    const full = { ...c, at: Date.now() }
    try { localStorage.setItem(KEY, JSON.stringify(full)) } catch {}
    const hadScripts = !!(choice?.analytics || choice?.ads)
    const revoked = (choice?.analytics && !c.analytics) || (choice?.ads && !c.ads)
    setChoice(full)
    setOpen(false)
    setCustom(false)
    // Already-loaded third-party scripts can't be unloaded; reload to drop them.
    if (hadScripts && revoked) window.location.reload()
  }, [choice])

  const openSettings = useCallback(() => {
    const c = readChoice()
    setAnalytics(c?.analytics ?? true)
    setAds(c?.ads ?? false)
    setCustom(true)
    setOpen(true)
  }, [])

  return (
    <Ctx.Provider value={{ choice, openSettings }}>
      {children}
      {open && (
        <div className="consent" role="dialog" aria-modal="false" aria-labelledby="consent-title">
          <h2 id="consent-title" className="consent-title">{t('consentTitle')}</h2>
          <p className="consent-text">
            {t('consentText')}{' '}
            <a href="/privacy" className="consent-link">{t('footerPrivacy')}</a>
          </p>
          {custom && (
            <div className="consent-options">
              <label className="consent-option">
                <input type="checkbox" checked disabled />
                <span><strong>{t('consentEssential')}</strong> — {t('consentEssentialDesc')}</span>
              </label>
              <label className="consent-option">
                <input type="checkbox" checked={analytics} onChange={e => setAnalytics(e.target.checked)} />
                <span><strong>{t('consentAnalytics')}</strong> — {t('consentAnalyticsDesc')}</span>
              </label>
              <label className="consent-option">
                <input type="checkbox" checked={ads} onChange={e => setAds(e.target.checked)} />
                <span><strong>{t('consentAds')}</strong> — {t('consentAdsDesc')}</span>
              </label>
            </div>
          )}
          <div className="consent-actions">
            {custom ? (
              <button type="button" className="btn-primary consent-btn" onClick={() => save({ analytics, ads })}>{t('consentSave')}</button>
            ) : (
              <>
                <button type="button" className="btn-secondary consent-btn" onClick={() => save({ analytics: false, ads: false })}>{t('consentReject')}</button>
                <button type="button" className="btn-ghost consent-btn" onClick={() => setCustom(true)}>{t('consentCustomize')}</button>
                <button type="button" className="btn-primary consent-btn" onClick={() => save({ analytics: true, ads: true })}>{t('consentAccept')}</button>
              </>
            )}
          </div>
        </div>
      )}
    </Ctx.Provider>
  )
}

/** Footer link that reopens the consent dialog. */
export function CookieSettingsLink({ className }: { className?: string }) {
  const { openSettings } = useConsent()
  const { t } = useI18n()
  return (
    <button type="button" className={className} onClick={openSettings}>
      {t('consentSettings')}
    </button>
  )
}
