'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useToast } from '@/components/Toast'
import { useI18n } from '@/hooks/useI18n'
import { apiGet, apiPost } from '@/lib/apiFetch'
import { errorCode, errorKey } from '@/lib/apiErrors'
import { fmt } from '@/lib/i18n/fmt'
import {
  City, Hunt, HuntAccessSummary, TourCategory, huntAccessFor, huntPriceEuros, isTour, localizeCity, localizeHunt,
} from '@/types'
import { ResumeRaceBanner } from '@/components/ResumeRaceBanner'
import { CheckoutSheet, type CheckoutOption } from '@/components/CheckoutSheet'
import { ConfirmDialog } from '@/components/Modal'
import { SaveMapOffline } from '@/components/SaveMapOffline'
import { cityCenter } from '@/lib/cityGeo'
import { LanguagePicker } from '@/components/LanguagePicker'
import { StopIcon } from '@/components/StopIcon'
import { ArrowLeft, Baby, Check, Compass, Gift, Landmark, Lock, Moon, ShoppingBag, Tag, Users, UtensilsCrossed, type LucideIcon } from 'lucide-react'

const DIFFICULTY_KEY: Record<string, string> = { easy: 'diffEasy', medium: 'diffMedium', hard: 'diffHard' }

const TOUR_CATEGORY_ICON: Record<TourCategory, LucideIcon> = {
  nightlife: Moon,
  food: UtensilsCrossed,
  shopping: ShoppingBag,
  culture: Landmark,
  family: Baby,
  general: Compass,
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
/** Per-card access: 'resume' = an unfinished session (always playable). */
type CardAccess = 'resume' | 'owned' | 'free' | 'locked' | 'unknown'

/** Values of `?paypal=` the capture routes redirect back with. */
const PAYPAL_FLASH: Record<string, { kind: Flash['kind']; key: string }> = {
  success:  { kind: 'success', key: 'huntUnlockSuccess' },
  pending:  { kind: 'info',    key: 'paypalPending' },
  refunded: { kind: 'error',   key: 'paypalRefunded' },
  error:    { kind: 'error',   key: 'paypalError' },
}

interface Props {
  cityId: string
  /** Server-rendered catalogue data. null when the server couldn't read
   *  Firestore: the client then fetches /api/cities + /api/hunts itself. */
  initialCity: City | null
  initialHunts: Hunt[] | null
}

export function CityClient({ cityId, initialCity, initialHunts }: Props) {
  const hasInitial = initialCity !== null && initialHunts !== null
  const { user, loading: authLoading, signIn } = useAuth()
  const { lang, t } = useI18n()
  const toast = useToast()

  const [city, setCity] = useState<City | null>(initialCity)
  const [hunts, setHunts] = useState<Hunt[]>(initialHunts ?? [])
  const [cityState, setCityState] = useState<LoadState | 'notfound'>(hasInitial ? 'ready' : 'loading')
  const [huntsState, setHuntsState] = useState<LoadState>(hasInitial ? 'ready' : 'loading')
  const [accessChecked, setAccessChecked] = useState(false)
  const [highlight, setHighlight] = useState<string | null>(null)
  const [access, setAccess] = useState<HuntAccessSummary | null>(null)
  const [progress, setProgress] = useState<ProgressMap>({})
  const [starting, setStarting] = useState<string | null>(null)
  const [flash, setFlash] = useState<Flash | null>(null)
  /** Hunt whose single-hunt checkout sheet is open. */
  const [checkoutHunt, setCheckoutHunt] = useState<Hunt | null>(null)
  /** Hunt waiting for "use your free hunt on it?" confirmation. */
  const [confirmHunt, setConfirmHunt] = useState<Hunt | null>(null)
  /** Hunt just bought (?paypal=…&hunt=) — used to confirm a pending payment. */
  const [paidHuntId, setPaidHuntId] = useState<string | null>(null)

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

  useEffect(() => {
    if (!hasInitial) loadCityAndHunts()
  }, [hasInitial, loadCityAndHunts])

  const loadAccess = useCallback(() => {
    apiGet<HuntAccessSummary>('/api/hunt-access')
      .then(a => setAccess(a && Array.isArray(a.owned) && Array.isArray(a.cityPasses) ? a : null))
      .catch(() => {})
      .finally(() => setAccessChecked(true))
  }, [])

  // Access + progress. Guests play under an anonymous account, so their
  // free hunt and progress are fetched too.
  useEffect(() => {
    if (authLoading || !cityId) return
    loadAccess()
    apiGet<ProgressMap>('/api/user-progress')
      .then(d => setProgress(d && typeof d === 'object' ? d : {}))
      .catch(() => setProgress({}))
  }, [authLoading, user, cityId, loadAccess])

  // Result of a PayPal round-trip: show it once, then strip the query string
  // so a reload or share doesn't replay the message.
  const handledPaypal = useRef(false)
  useEffect(() => {
    // Read from location (not useSearchParams) so the page can be statically
    // rendered without a Suspense boundary hiding the hunt list from crawlers.
    const params = new URLSearchParams(window.location.search)
    const flag = params.get('paypal')
    if (!flag || handledPaypal.current) return
    handledPaypal.current = true
    const rawHunt = params.get('hunt')
    const huntId = rawHunt && /^[A-Za-z0-9_-]{1,128}$/.test(rawHunt) ? rawHunt : null
    if (flag === 'cancelled') toast.info(t('paypalCancelled'))
    else {
      const meta = PAYPAL_FLASH[flag] ?? PAYPAL_FLASH.error
      // A legacy city-pass order (no hunt id) keeps its old message.
      const key = flag === 'success' && !huntId ? 'unlockSuccess' : meta.key
      setFlash({ kind: meta.kind, text: t(key) })
    }
    if (huntId) {
      setPaidHuntId(huntId)
      setHighlight(huntId)
      window.setTimeout(() => {
        document.getElementById(`hunt-${huntId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 300)
    }
    if (flag === 'success' && huntId) {
      setAccess(a => a && !a.owned.includes(huntId) ? { ...a, owned: [...a.owned, huntId] } : a)
    }
    if (flag === 'success' || flag === 'pending') {
      // Re-read access (the webhook usually lands within a minute when pending).
      loadAccess()
      if (flag === 'pending') {
        window.setTimeout(loadAccess, 20_000)
        window.setTimeout(loadAccess, 60_000)
      }
    }
    window.history.replaceState(null, '', window.location.pathname)
  }, [t, toast, loadAccess])

  // A pending payment that has since landed: replace the "processing" banner.
  useEffect(() => {
    if (flash?.kind !== 'info' || !paidHuntId || !access?.owned.includes(paidHuntId)) return
    setFlash({ kind: 'success', text: t('huntUnlockSuccess') })
  }, [access, paidHuntId, flash, t])

  const askSignIn = (key: string) => {
    toast.info(t(key))
    signIn()
  }

  const accessOf = (hunt: Hunt): CardAccess => {
    if (progress[hunt.id]?.status === 'in_progress') return 'resume'
    if (!access) return 'unknown'
    return huntAccessFor(access, hunt)
  }

  const openCheckout = (hunt: Hunt) => {
    // Purchases are tied to a registered account so they can't be lost.
    if (!user) { askSignIn('accountNeededToBuy'); return }
    setCheckoutHunt(hunt)
  }

  const startHunt = async (hunt: Hunt) => {
    if (starting) return
    setStarting(hunt.id)
    try {
      const data = await apiPost<{ sessionId: string; resumed: boolean; tourType: 'hunt' | 'tour' }>(
        '/api/start-session', { huntId: hunt.id },
      )
      const route = data.tourType === 'tour' ? '/tour' : '/hunt'
      // Keep `starting` set: every card stays disabled until the page unloads.
      window.location.href = `${route}?session=${encodeURIComponent(data.sessionId)}`
    } catch (e) {
      setStarting(null)
      const code = errorCode(e)
      if (code === 'hunt_locked') {
        setAccess(a => a ? { ...a, freeAvailable: false } : a)
        loadAccess()
        openCheckout(hunt)
      } else if (code === 'sign_in_required' || code === 'account_required' || code === 'unauthenticated') {
        askSignIn('accountNeededToBuy')
      } else if (code === 'hunt_not_found' || code === 'no_clues') toast.error(t('huntUnavailable'))
      else toast.error(t(errorKey(e)))
    }
  }

  /** Tap on a hunt card: play it, confirm spending the free hunt, or buy it. */
  const chooseHunt = (hunt: Hunt) => {
    if (starting) return
    switch (accessOf(hunt)) {
      case 'free': setConfirmHunt(hunt); break
      case 'locked': openCheckout(hunt); break
      // owned / resume / unknown (access couldn't be read: the server decides).
      default: startHunt(hunt)
    }
  }

  /** Resolves true while the browser is being sent to PayPal. */
  const confirmHuntCheckout = async (): Promise<boolean> => {
    const hunt = checkoutHunt
    if (!hunt) return false
    try {
      const data = await apiPost<{ url: string }>('/api/hunt-unlocks/checkout', { huntId: hunt.id })
      if (!data?.url) throw new Error('no_url')
      window.location.href = data.url
      return true
    } catch (e) {
      const code = errorCode(e)
      if (code === 'account_required' || code === 'unauthenticated') {
        setCheckoutHunt(null)
        askSignIn('accountNeededToBuy')
      } else if (code === 'already_unlocked') {
        setCheckoutHunt(null)
        setAccess(a => a && !a.owned.includes(hunt.id) ? { ...a, owned: [...a.owned, hunt.id] } : a)
        loadAccess()
        toast.success(t('alreadyUnlockedHunt'))
      } else {
        toast.error(t(code === 'hunt_not_found' ? 'errNotFound' : errorKey(e) === 'errGeneric' ? 'checkoutFailed' : errorKey(e)))
      }
      return false
    }
  }

  // ?start={huntId} (from a hunt landing page): scroll to and highlight the
  // card, then treat it like a tap (start, confirm the free hunt, or buy).
  const handledStart = useRef(false)
  useEffect(() => {
    if (handledStart.current || huntsState !== 'ready' || authLoading || !accessChecked) return
    handledStart.current = true
    const params = new URLSearchParams(window.location.search)
    const huntId = params.get('start')
    if (!huntId) return
    params.delete('start')
    const qs = params.toString()
    window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''))
    const hunt = hunts.find(h => h.id === huntId)
    if (!hunt) return
    setHighlight(hunt.id)
    window.requestAnimationFrame(() => {
      document.getElementById(`hunt-${hunt.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    chooseHunt(hunt)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [huntsState, authLoading, accessChecked, hunts])

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
  const hasCityPass = !!access?.cityPasses.includes(city.id)
  const minPrice = hunts.length ? Math.min(...hunts.map(h => huntPriceEuros(h))) : huntPriceEuros(null)
  const priceText = (euros: number) => (Number.isInteger(euros) ? String(euros) : euros.toFixed(2))
  const huntsOnly = hunts.filter(h => !isTour(h))
  const toursOnly = hunts.filter(h => isTour(h))
  const busy = starting !== null

  const renderItem = (rawHunt: Hunt) => {
    const hunt = localizeHunt(rawHunt, lang)
    const cardAccess = accessOf(rawHunt)
    const locked = cardAccess === 'locked'
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
      <div
        key={hunt.id}
        id={`hunt-${hunt.id}`}
        className={`hunt-card-wrap ${highlight === hunt.id ? 'is-highlighted' : ''}`}
      >
      <button
        type="button"
        className={`hunt-card ${isCompleted ? 'completed' : isInProgress ? 'resuming' : ''} ${tourMode ? 'is-tour' : ''} ${locked ? 'is-locked' : ''}`}
        onClick={() => chooseHunt(rawHunt)}
        disabled={busy}
        aria-busy={isStarting}
      >
        {locked
          ? (
            <span className="hunt-badge locked-badge">
              <Lock size={12} strokeWidth={2.4} aria-hidden />
              <span className="flow-sr-only">{t('locked')}: </span>
              {fmt(t('priceTag'), { price: priceText(huntPriceEuros(rawHunt)) })}
            </span>
          )
          : isCompleted
            ? <span className="hunt-badge completed-badge"><Check size={12} strokeWidth={2.6} aria-hidden /> {t('ctaCompleted')}</span>
            : isInProgress
              ? <span className="hunt-badge resume-badge">{t('ctaResume')}</span>
              : cardAccess === 'free'
                ? <span className="hunt-badge free-badge">{t('freeFirstHuntBadge')}</span>
                : cardAccess === 'owned'
                  ? <span className="hunt-badge owned-badge"><Check size={12} strokeWidth={2.6} aria-hidden /> {t('ownedBadge')}</span>
                  : null
        }
        <span className="hunt-card-top">
          <span>
            <span className="hunt-title">{hunt.title}</span>
            <span className="hunt-desc">{hunt.description}</span>
          </span>
          <span className="hunt-arrow" aria-hidden>
            {isStarting ? <span className="spinner-mini" /> : (locked ? <Lock size={16} strokeWidth={2} /> : '→')}
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
              <span aria-hidden className="cat-pill-icon">{(() => { const Icon = TOUR_CATEGORY_ICON[cat]; return <Icon size={14} strokeWidth={2} /> })()}</span>
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
      <a
        href={`/city/${encodeURIComponent(cityId)}/${encodeURIComponent(hunt.id)}`}
        className="hunt-card-details"
        aria-label={fmt(t('huntDetailsFor'), { title: hunt.title })}
      >
        {t('huntDetails')} <span aria-hidden>→</span>
      </a>
      </div>
    )
  }

  const center = cityCenter(city)
  const localCheckoutHunt = checkoutHunt ? localizeHunt(checkoutHunt, lang) : null
  const checkoutOptions: CheckoutOption[] = localCheckoutHunt ? [{
    id: localCheckoutHunt.id,
    title: localCheckoutHunt.title,
    subtitle: localCheckoutHunt.durationMin > 0
      ? fmt(t('checkoutHuntSubtitle'), { n: localCheckoutHunt.clueCount, min: localCheckoutHunt.durationMin })
      : undefined,
    items: [
      fmt(t('checkoutHuntItem1'), { n: localCheckoutHunt.clueCount }),
      ...(isTour(localCheckoutHunt) ? [] : [t('checkoutHuntItem2')]),
      t('checkoutHuntItem3'),
      t('checkoutHuntItem4'),
    ],
    priceCents: Math.round(huntPriceEuros(localCheckoutHunt) * 100),
    icon: <StopIcon icon={localCity.coverEmoji} />,
  }] : []
  const localConfirmHunt = confirmHunt ? localizeHunt(confirmHunt, lang) : null

  return (
    <main className="page-center">
      <div className="container">
        <div className="page-topbar">
          <a href={backHref} className="city-back">
            <ArrowLeft size={16} strokeWidth={2.4} aria-hidden />
            {backLabel}
          </a>
          <LanguagePicker />
        </div>

        <section className={`city-hero ${hasCityPass ? 'is-unlocked' : ''}`}>
          <StopIcon icon={localCity.coverEmoji} size="lg" className="city-hero-emoji" />
          <div className="city-hero-meta">
            <span className="city-hero-eyebrow">{localCity.country}</span>
            <h1 className="city-hero-title">{localCity.name}</h1>
            <p className="city-hero-desc">{localCity.description}</p>
          </div>
          {hasCityPass ? (
            <div className="city-hero-cta city-hero-cta-unlocked">
              <span className="city-hero-cta-icon" aria-hidden><Check size={16} strokeWidth={2.6} /></span>
              <span>{t('cityUnlockedNote')}</span>
            </div>
          ) : (
            <p className="city-hero-cta city-hero-cta-unlocked city-hero-pricing">
              <span className="city-hero-cta-icon" aria-hidden>
                {access?.freeAvailable === false ? <Tag size={14} strokeWidth={2.4} /> : <Gift size={14} strokeWidth={2.4} />}
              </span>
              <span>
                {fmt(t(access?.freeAvailable === false ? 'pricingLinePaid' : 'pricingLineFree'), { price: priceText(minPrice) })}
              </span>
            </p>
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
          <div className="mp-home-cta-icon" aria-hidden><Users size={20} strokeWidth={1.9} /></div>
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

        {center && huntsState === 'ready' && hunts.length > 0 && (
          <SaveMapOffline cityName={localCity.name} center={center} />
        )}

        {!authLoading && !user && <p className="footer-note">{t('signInSaveHint')}</p>}
      </div>

      {localCheckoutHunt && (
        <CheckoutSheet
          title={fmt(t('checkoutHuntSheetTitle'), { hunt: localCheckoutHunt.title })}
          subtitle={t('checkoutHuntSheetSub')}
          options={checkoutOptions}
          defaultSelectedId={localCheckoutHunt.id}
          onConfirm={confirmHuntCheckout}
          onClose={() => setCheckoutHunt(null)}
        />
      )}

      <ConfirmDialog
        open={!!localConfirmHunt}
        title={localConfirmHunt ? fmt(t('useFreeHuntTitle'), { hunt: localConfirmHunt.title }) : ''}
        body={t('useFreeHuntBody')}
        confirmLabel={t('useFreeHuntConfirm')}
        cancelLabel={t('cancelBtn')}
        onConfirm={() => {
          const h = confirmHunt
          setConfirmHunt(null)
          if (h) startHunt(h)
        }}
        onCancel={() => setConfirmHunt(null)}
      />
    </main>
  )
}
