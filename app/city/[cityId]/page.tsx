'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { useToast } from '@/components/Toast'
import { useI18n } from '@/hooks/useI18n'
import { apiGet, apiPost } from '@/lib/apiFetch'
import { errorCode, errorKey } from '@/lib/apiErrors'
import { fmt } from '@/lib/i18n/fmt'
import {
  CITY_UNLOCK_PRICE_EUROS, City, Hunt, TourCategory, isHuntFree, isTour, localizeCity, localizeHunt,
} from '@/types'
import { ResumeRaceBanner } from '@/components/ResumeRaceBanner'
import { CheckoutSheet, type CheckoutOption } from '@/components/CheckoutSheet'

const DIFFICULTY_KEY: Record<string, string> = { easy: 'diffEasy', medium: 'diffMedium', hard: 'diffHard' }

const TOUR_CATEGORY_ICON: Record<TourCategory, string> = {
  nightlife: '🌙',
  food: '🍝',
  shopping: '🛍️',
  culture: '🏛️',
  family: '👨‍👩‍👧',
  general: '🧭',
}

type ProgressEntry = {
  sessionId: string
  cluesCompleted: number
  totalClues: number
  status: 'in_progress' | 'completed'
  score: number
}
type ProgressMap = Record<string, ProgressEntry>
type LoadState = 'loading' | 'ready' | 'error'
type Flash = { kind: 'success' | 'info' | 'error'; text: string }

/** Values of `?paypal=` the capture route redirects back with. */
const PAYPAL_FLASH: Record<string, { kind: Flash['kind']; key: string }> = {
  success:  { kind: 'success', key: 'unlockSuccess' },
  pending:  { kind: 'info',    key: 'paypalPending' },
  refunded: { kind: 'error',   key: 'paypalRefunded' },
  error:    { kind: 'error',   key: 'paypalError' },
}

export default function CityPage() {
  const params = useParams<{ cityId: string }>()
  const cityId = params?.cityId as string
  const search = useSearchParams()
  const { user, loading: authLoading, signIn } = useAuth()
  const { lang, t } = useI18n()
  const toast = useToast()

  const [city, setCity] = useState<City | null>(null)
  const [hunts, setHunts] = useState<Hunt[]>([])
  const [cityState, setCityState] = useState<LoadState | 'notfound'>('loading')
  const [huntsState, setHuntsState] = useState<LoadState>('loading')
  const [unlocked, setUnlocked] = useState(false)
  const [progress, setProgress] = useState<ProgressMap>({})
  const [starting, setStarting] = useState<string | null>(null)
  const [flash, setFlash] = useState<Flash | null>(null)
  const [checkoutOpen, setCheckoutOpen] = useState(false)

  const loadCityAndHunts = useCallback(() => {
    if (!cityId) return
    setCityState('loading')
    setHuntsState('loading')
    apiGet<City[]>('/api/cities')
      .then(cs => {
        const found = cs.find(c => c.id === cityId) ?? null
        setCity(found)
        setCityState(found ? 'ready' : 'notfound')
      })
      .catch(() => setCityState('error'))
    apiGet<Hunt[]>('/api/hunts')
      .then(hs => {
        setHunts(hs.filter(h => h.cityId === cityId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)))
        setHuntsState('ready')
      })
      .catch(() => setHuntsState('error'))
  }, [cityId])

  useEffect(() => { loadCityAndHunts() }, [loadCityAndHunts])

  const loadUnlocks = useCallback(() => {
    apiGet<string[]>('/api/city-unlocks')
      .then(ids => setUnlocked(Array.isArray(ids) && ids.includes(cityId)))
      .catch(() => {})
  }, [cityId])

  // Unlocks + progress. Guests play under an anonymous account, so their
  // progress is fetched too (unlocks are always [] for them).
  useEffect(() => {
    if (authLoading || !cityId) return
    loadUnlocks()
    apiGet<ProgressMap>('/api/user-progress')
      .then(d => setProgress(d && typeof d === 'object' ? d : {}))
      .catch(() => setProgress({}))
  }, [authLoading, user, cityId, loadUnlocks])

  // Result of a PayPal round-trip: show it once, then strip the query string
  // so a reload or share doesn't replay the message.
  const handledPaypal = useRef(false)
  useEffect(() => {
    const flag = search?.get('paypal')
    if (!flag || handledPaypal.current) return
    handledPaypal.current = true
    if (flag === 'cancelled') toast.info(t('paypalCancelled'))
    else {
      const meta = PAYPAL_FLASH[flag] ?? PAYPAL_FLASH.error
      setFlash({ kind: meta.kind, text: t(meta.key) })
    }
    if (flag === 'success') setUnlocked(true)
    if (flag === 'pending') {
      // The webhook usually lands within a minute — check again shortly.
      window.setTimeout(loadUnlocks, 20_000)
      window.setTimeout(loadUnlocks, 60_000)
    }
    window.history.replaceState(null, '', window.location.pathname)
  }, [search, t, toast, loadUnlocks])

  // A pending payment that has since landed: replace the "processing" banner.
  useEffect(() => {
    if (unlocked && flash?.kind === 'info') setFlash({ kind: 'success', text: t('unlockSuccess') })
  }, [unlocked, flash, t])

  const askSignIn = (key: string) => {
    toast.info(t(key))
    signIn()
  }

  const openCityCheckout = () => {
    if (!city) return
    if (!user) { askSignIn('accountNeededForPass'); return }
    setCheckoutOpen(true)
  }

  const startHunt = async (huntId: string, free: boolean) => {
    if (starting) return
    if (!free && !unlocked) { openCityCheckout(); return }
    setStarting(huntId)
    try {
      const data = await apiPost<{ sessionId: string; resumed: boolean; tourType: 'hunt' | 'tour' }>(
        '/api/start-session', { huntId },
      )
      const route = data.tourType === 'tour' ? '/tour' : '/hunt'
      // Keep `starting` set: every card stays disabled until the page unloads.
      window.location.href = `${route}?session=${encodeURIComponent(data.sessionId)}`
    } catch (e) {
      setStarting(null)
      const code = errorCode(e)
      if (code === 'city_locked') { setUnlocked(false); openCityCheckout() }
      else if (code === 'sign_in_required' || code === 'account_required' || code === 'unauthenticated') askSignIn('accountNeededForPass')
      else if (code === 'hunt_not_found' || code === 'no_clues') toast.error(t('huntUnavailable'))
      else toast.error(t(errorKey(e)))
    }
  }

  /** Resolves true while the browser is being sent to PayPal. */
  const confirmCityCheckout = async (): Promise<boolean> => {
    if (!city) return false
    try {
      const data = await apiPost<{ url: string }>('/api/city-unlocks/checkout', { cityId: city.id })
      if (!data?.url) throw new Error('no_url')
      window.location.href = data.url
      return true
    } catch (e) {
      const code = errorCode(e)
      if (code === 'account_required' || code === 'unauthenticated') {
        setCheckoutOpen(false)
        askSignIn('accountNeededForPass')
      } else if (code === 'already_unlocked') {
        setCheckoutOpen(false)
        setUnlocked(true)
        toast.success(t('alreadyUnlocked'))
      } else {
        toast.error(t(code === 'city_not_found' ? 'errNotFound' : errorKey(e) === 'errGeneric' ? 'checkoutFailed' : errorKey(e)))
      }
      return false
    }
  }

  if (cityState === 'loading') {
    return (
      <main className="page-center" aria-busy="true">
        <div className="container">
          <span className="flow-sr-only" role="status">{t('loading')}</span>
          <span className="skel skel-line is-short" />
          <span className="skel skel-hero" />
          <span className="skel skel-card" />
          <span className="skel skel-card" />
        </div>
      </main>
    )
  }

  if (cityState === 'error' || cityState === 'notfound' || !city) {
    return (
      <main className="page-center">
        <div className="container">
          <a href="/" className="city-back">{t('home')}</a>
          <div className="empty-card" role={cityState === 'error' ? 'alert' : undefined}>
            <p>{cityState === 'error' ? t('loadError') : t('cityNotFound')}</p>
            {cityState === 'error'
              ? <button type="button" onClick={loadCityAndHunts} className="btn-primary flow-retry">{t('retry')}</button>
              : <a href="/" className="btn-primary flow-retry">{t('exploreCities')}</a>}
          </div>
        </div>
      </main>
    )
  }

  const localCity = localizeCity(city, lang)
  const backHref = city.countryId ? `/country/${city.countryId}` : '/'
  const backLabel = city.countryId && localCity.country ? fmt(t('backToCountry'), { country: localCity.country }) : t('home')
  const unlockCta = fmt(t('unlockCityCta'), { city: localCity.name })
  const huntsOnly = hunts.filter(h => !isTour(h))
  const toursOnly = hunts.filter(h => isTour(h))
  const busy = starting !== null

  const renderItem = (rawHunt: Hunt) => {
    const hunt = localizeHunt(rawHunt, lang)
    const free = isHuntFree(hunt)
    const locked = !free && !unlocked
    const huntProgress = progress[hunt.id]
    const isInProgress = huntProgress?.status === 'in_progress'
    const isCompleted = huntProgress?.status === 'completed'
    const totalSteps = hunt.clueCount || huntProgress?.totalClues || 0
    const cluesDone = Math.min(huntProgress?.cluesCompleted ?? 0, totalSteps)
    const pct = totalSteps > 0 ? Math.round((cluesDone / totalSteps) * 100) : 0
    const tourMode = isTour(rawHunt)
    const cat: TourCategory = tourMode ? (rawHunt.tourCategory ?? 'general') : 'general'
    const difficulty = DIFFICULTY_KEY[hunt.difficulty] ? hunt.difficulty : 'medium'
    const isStarting = starting === hunt.id

    return (
      <button
        key={hunt.id}
        type="button"
        className={`hunt-card ${isCompleted ? 'completed' : isInProgress ? 'resuming' : ''} ${tourMode ? 'is-tour' : ''} ${locked ? 'is-locked' : ''}`}
        onClick={() => locked ? openCityCheckout() : startHunt(hunt.id, free)}
        disabled={busy}
        aria-busy={isStarting}
      >
        {locked
          ? <span className="hunt-badge locked-badge">🔒 {t('locked')}</span>
          : free && !isCompleted && !isInProgress
            ? <span className="hunt-badge free-badge">{t('freeHunt')}</span>
            : isCompleted
              ? <span className="hunt-badge completed-badge">✓ {t('ctaCompleted')}</span>
              : isInProgress
                ? <span className="hunt-badge resume-badge">{t('ctaResume')}</span>
                : null
        }
        <span className="hunt-card-top">
          <span>
            <span className="hunt-title">{hunt.title}</span>
            <span className="hunt-desc">{hunt.description}</span>
          </span>
          <span className="hunt-arrow" aria-hidden>
            {isStarting ? <span className="spinner-mini" /> : (locked ? '🔒' : '→')}
          </span>
        </span>

        {huntProgress && totalSteps > 0 && !locked && (
          <span className={`resume-bar ${isCompleted ? 'is-completed' : ''}`}>
            <span className="resume-bar-track">
              <span className="resume-bar-fill" style={{ width: `${pct}%` }} />
            </span>
            <span className="resume-bar-text">
              {isCompleted
                ? (tourMode ? `✓ ${cluesDone}/${totalSteps}` : `${t('bestScore')} ${huntProgress.score}`)
                : `${cluesDone}/${totalSteps}`}
            </span>
          </span>
        )}

        <span className="hunt-meta">
          {tourMode ? (
            <span className={`meta-pill cat-pill cat-${cat}`}>
              <span aria-hidden className="cat-pill-icon">{TOUR_CATEGORY_ICON[cat]}</span>
              {t(`cat${cat.charAt(0).toUpperCase()}${cat.slice(1)}`)}
            </span>
          ) : (
            <span className={`meta-pill diff-pill diff-${difficulty}`}>{t(DIFFICULTY_KEY[difficulty])}</span>
          )}
          <span className="meta-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            {hunt.clueCount} {tourMode ? t('tourStops').toLowerCase() : t('places')}
          </span>
          <span className="meta-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            ~{hunt.durationMin} {t('min')}
          </span>
          <span className="meta-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            {hunt.distanceKm} {t('km')}
          </span>
        </span>
      </button>
    )
  }

  const cityPriceCents = Math.round((city.priceEuros ?? CITY_UNLOCK_PRICE_EUROS) * 100)
  const checkoutOptions: CheckoutOption[] = [{
    id: city.id,
    title: fmt(t('checkoutCityTitle'), { city: localCity.name }),
    subtitle: fmt(t('checkoutCitySubtitle'), { n: hunts.length }),
    items: [t('checkoutCityItem1'), t('checkoutCityItem2'), t('checkoutCityItem3'), t('checkoutCityItem4')],
    priceCents: cityPriceCents,
    icon: localCity.coverEmoji ?? '📍',
  }]

  return (
    <main className="page-center">
      <div className="container">
        <a href={backHref} className="city-back">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          {backLabel}
        </a>

        <section className={`city-hero ${unlocked ? 'is-unlocked' : ''}`}>
          <div className="city-hero-emoji" aria-hidden>{localCity.coverEmoji ?? '📍'}</div>
          <div className="city-hero-meta">
            <span className="city-hero-eyebrow">{localCity.country}</span>
            <h1 className="city-hero-title">{localCity.name}</h1>
            <p className="city-hero-desc">{localCity.description}</p>
          </div>
          {unlocked ? (
            <div className="city-hero-cta city-hero-cta-unlocked">
              <span className="city-hero-cta-icon" aria-hidden>✓</span>
              <span>{t('cityUnlockedNote')}</span>
            </div>
          ) : (
            <button type="button" onClick={openCityCheckout} disabled={checkoutOpen || busy} className="city-hero-cta">
              <span className="city-hero-cta-label">{unlockCta}</span>
              <span className="city-hero-cta-arrow" aria-hidden>→</span>
            </button>
          )}
        </section>

        {flash && (
          <div className={`city-flash flow-flash is-${flash.kind}`} role={flash.kind === 'error' ? 'alert' : 'status'}>
            <span className="flow-flash-text">{flash.text}</span>
            <button type="button" className="flow-flash-close" onClick={() => setFlash(null)} aria-label={t('dismiss')}>×</button>
          </div>
        )}

        <ResumeRaceBanner />

        <a href="/multiplayer" className="mp-home-cta flow-mp-cta">
          <div className="mp-home-cta-icon" aria-hidden>👥</div>
          <div className="mp-home-cta-body">
            <div className="mp-home-cta-title">{t('playWithFriends')}</div>
            <div className="mp-home-cta-desc">{t('shareRoomCode')}</div>
          </div>
          <div className="mp-home-cta-arrow" aria-hidden>→</div>
        </a>

        <h2 id="hunts" className="section-label flow-anchor">{t('availableHunts')}</h2>

        {huntsState === 'loading' && (
          <div aria-busy="true">
            <span className="flow-sr-only" role="status">{t('loading')}</span>
            <span className="skel skel-card" />
            <span className="skel skel-card" />
          </div>
        )}

        {huntsState === 'error' && (
          <div className="empty-card" role="alert">
            <p>{t('loadError')}</p>
            <button type="button" onClick={loadCityAndHunts} className="btn-primary flow-retry">{t('retry')}</button>
          </div>
        )}

        {huntsState === 'ready' && hunts.length === 0 && (
          <div className="empty-card"><p>{t('noHuntsYet')}</p></div>
        )}

        {huntsState === 'ready' && huntsOnly.map(renderItem)}

        {huntsState === 'ready' && toursOnly.length > 0 && (
          <>
            <h2 className="section-label flow-section-gap">{t('selfGuidedTours')}</h2>
            {toursOnly.map(renderItem)}
          </>
        )}

        {!authLoading && !user && <p className="footer-note">{t('signInSaveHint')}</p>}
      </div>

      {checkoutOpen && (
        <CheckoutSheet
          title={fmt(t('checkoutCitySheetTitle'), { city: localCity.name })}
          subtitle={t('checkoutCitySheetSub')}
          options={checkoutOptions}
          defaultSelectedId={city.id}
          onConfirm={confirmCityCheckout}
          onClose={() => setCheckoutOpen(false)}
        />
      )}
    </main>
  )
}
