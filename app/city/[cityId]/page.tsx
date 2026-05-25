'use client'
import { useCallback, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { useI18n } from '@/hooks/useI18n'
import { City, Hunt, isHuntFree, isTour, localizeCity, localizeHunt, TourCategory } from '@/types'
import { ResumeRaceBanner } from '@/components/ResumeRaceBanner'
import { CheckoutSheet, type CheckoutOption } from '@/components/CheckoutSheet'

const DIFFICULTY_META: Record<string, { key: string; color: string; bg: string }> = {
  easy:   { key: 'diffEasy',   color: '#22c97a', bg: 'rgba(34,201,122,.12)' },
  medium: { key: 'diffMedium', color: '#f5a54a', bg: 'rgba(245,165,74,.12)' },
  hard:   { key: 'diffHard',   color: '#f05252', bg: 'rgba(240,82,82,.12)' },
}

type ProgressEntry = {
  sessionId: string
  cluesCompleted: number
  totalClues: number
  status: 'in_progress' | 'completed'
  score: number
}
type ProgressMap = Record<string, ProgressEntry>

export default function CityPage() {
  const params = useParams<{ cityId: string }>()
  const cityId = params?.cityId as string
  const search = useSearchParams()
  const { user, signIn } = useAuth()
  const { lang, t } = useI18n()

  const [city, setCity] = useState<City | null>(null)
  const [hunts, setHunts] = useState<Hunt[]>([])
  const [cityState, setCityState] = useState<'loading' | 'ready' | 'notfound' | 'error'>('loading')
  const [huntsError, setHuntsError] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [progress, setProgress] = useState<ProgressMap>({})
  const [starting, setStarting] = useState<string | null>(null)
  const [unlocking, setUnlocking] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  /** When true, the CheckoutSheet is shown over the page — user has clicked
   *  unlock but hasn't yet been redirected to PayPal. */
  const [checkoutOpen, setCheckoutOpen] = useState(false)

  // Load city + hunts (with explicit loading / not-found / error states so the
  // page never shows a misleading "no hunts" card while a fetch is in flight).
  const loadCityAndHunts = useCallback(() => {
    if (!cityId) return
    setCityState('loading')
    setHuntsError(false)
    fetch('/api/cities')
      .then(r => { if (!r.ok) throw new Error('cities'); return r.json() })
      .then((cs: City[]) => {
        const found = cs.find(c => c.id === cityId) ?? null
        setCity(found)
        setCityState(found ? 'ready' : 'notfound')
      })
      .catch(() => setCityState('error'))
    fetch('/api/hunts')
      .then(r => { if (!r.ok) throw new Error('hunts'); return r.json() })
      .then((hs: Hunt[]) => {
        setHunts(
          hs.filter(h => h.cityId === cityId)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        )
      })
      .catch(() => setHuntsError(true))
  }, [cityId])

  useEffect(() => { loadCityAndHunts() }, [loadCityAndHunts])

  // Load unlock + progress
  useEffect(() => {
    if (!user || !cityId) { setUnlocked(false); setProgress({}); return }
    fetch(`/api/city-unlocks?userId=${user.uid}`)
      .then(r => r.json())
      .then((ids: string[]) => setUnlocked(ids.includes(cityId)))
      .catch(() => {})
    fetch(`/api/user-progress?userId=${user.uid}`)
      .then(r => r.json())
      .then((d) => { if (d && !d.error) setProgress(d) })
      .catch(() => {})
  }, [user, cityId])

  // Banner from PayPal redirect
  useEffect(() => {
    if (search?.get('unlocked') === '1') setFlash(t('unlockSuccess'))
    else if (search?.get('paypal') === 'cancelled') setFlash(null)
  }, [search, t])

  const startHunt = async (huntId: string, free: boolean) => {
    if (!user) { signIn(); return }
    if (!free && !unlocked) {
      setFlash(t('unlockToPlay'))
      return
    }
    setStarting(huntId)
    const res = await fetch('/api/start-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ huntId, userId: user.uid }),
    })
    const data = await res.json()
    if (!res.ok) {
      setStarting(null)
      if (data?.error === 'city_locked') setFlash(t('unlockToPlay'))
      else if (data?.error === 'sign_in_required') signIn()
      return
    }
    const route = data.tourType === 'tour' ? '/tour' : '/hunt'
    window.location.href = `${route}?session=${data.sessionId}`
  }

  const TOUR_CATEGORY_META: Record<TourCategory, { icon: string; color: string }> = {
    nightlife: { icon: '🌙', color: '#7c3aed' },
    food:      { icon: '🍝', color: '#dc2626' },
    shopping:  { icon: '🛍️', color: '#0891b2' },
    culture:   { icon: '🏛️', color: '#0d9488' },
    family:    { icon: '👨‍👩‍👧', color: '#f59e0b' },
    general:   { icon: '🧭', color: '#6366f1' },
  }

  const openCityCheckout = () => {
    if (!user) { signIn(); return }
    if (!city) return
    setCheckoutOpen(true)
  }

  const confirmCityCheckout = async (optionId: string) => {
    if (!user || !city) return
    setUnlocking(true)
    // The first option id is the city itself; any future "country-pass"
    // bundle id would dispatch to a different endpoint. For now only the
    // single-city case is wired to a real backend.
    if (optionId !== city.id) {
      setUnlocking(false)
      setFlash('That option will be available soon')
      return
    }
    const res = await fetch('/api/city-unlocks/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cityId: city.id, userId: user.uid }),
    })
    const data = await res.json()
    if (data?.url) {
      window.location.href = data.url
    } else {
      setUnlocking(false)
      setCheckoutOpen(false)
      setFlash(data?.error === 'sign_in_required' ? t('signInToUnlock') : 'Payment unavailable')
    }
  }

  if (cityState === 'loading') {
    return <main className="page-center"><div className="spinner" /></main>
  }

  if (cityState === 'error') {
    return (
      <main className="page-center">
        <div className="container">
          <a href="/" className="meta-item" style={{ display: 'inline-block', marginBottom: 12 }}>{t('backToHunts')}</a>
          <div className="empty-card">
            <p>{t('loadError')}</p>
            <button onClick={loadCityAndHunts} className="btn-primary" style={{ marginTop: 12 }}>{t('retry')}</button>
          </div>
        </div>
      </main>
    )
  }

  if (!city) {
    return (
      <main className="page-center">
        <div className="container">
          <a href="/" className="meta-item" style={{ display: 'inline-block', marginBottom: 12 }}>{t('backToHunts')}</a>
          <div className="empty-card"><p>{t('noHuntsYet')}</p></div>
        </div>
      </main>
    )
  }

  const localCity = localizeCity(city, lang)
  const unlockCta = t('unlockCityCta').replace('{city}', localCity.name)

  return (
    <main className="page-center">
      <div className="container">
        <a href={city.countryId ? `/country/${city.countryId}` : '/'} className="city-back">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          {city.countryId ? t('backToCountries') : t('backToHunts')}
        </a>

        {/* City hero */}
        <section className={`city-hero ${unlocked ? 'is-unlocked' : ''}`}>
          <div className="city-hero-emoji" aria-hidden>{localCity.coverEmoji ?? '📍'}</div>
          <div className="city-hero-meta">
            <span className="city-hero-eyebrow">{localCity.country}</span>
            <h1 className="city-hero-title">{localCity.name}</h1>
            <p className="city-hero-desc">{localCity.description}</p>
          </div>
          {unlocked ? (
            <div className="city-hero-cta city-hero-cta-unlocked">
              <span className="city-hero-cta-icon">✓</span>
              <span>{t('cityUnlockedNote')}</span>
            </div>
          ) : (
            <button onClick={openCityCheckout} disabled={unlocking} className="city-hero-cta">
              <span className="city-hero-cta-label">
                {unlocking ? t('unlockingCity') : unlockCta}
              </span>
              {!unlocking && <span className="city-hero-cta-arrow">→</span>}
            </button>
          )}
        </section>

        {flash && (
          <div className="city-flash" role="status">
            <span>{flash}</span>
          </div>
        )}

        <ResumeRaceBanner />

        {/* ── Multiplayer CTA ── */}
        <a href="/multiplayer" className="mp-home-cta" style={{ margin: '16px 0' }}>
          <div className="mp-home-cta-icon" aria-hidden>👥</div>
          <div className="mp-home-cta-body">
            <div className="mp-home-cta-title">{t('playWithFriends')}</div>
            <div className="mp-home-cta-desc">{t('shareRoomCode')}</div>
          </div>
          <div className="mp-home-cta-arrow" aria-hidden>→</div>
        </a>

        {(() => {
          const huntsOnly = hunts.filter(h => !isTour(h))
          const toursOnly = hunts.filter(h => isTour(h))

          const renderItem = (rawHunt: Hunt) => {
            const hunt = localizeHunt(rawHunt, lang)
            const free = isHuntFree(hunt)
            const locked = !free && !unlocked
            const diff = DIFFICULTY_META[hunt.difficulty] || DIFFICULTY_META.medium
            const huntProgress = progress[hunt.id]
            const isInProgress = huntProgress?.status === 'in_progress'
            const isCompleted = huntProgress?.status === 'completed'
            const totalSteps = hunt.clueCount || huntProgress?.totalClues || 0
            const cluesDone = Math.min(huntProgress?.cluesCompleted ?? 0, totalSteps)
            const pct = totalSteps > 0 ? Math.round((cluesDone / totalSteps) * 100) : 0
            const stateClass = isCompleted ? 'completed' : isInProgress ? 'resuming' : ''
            const tourMode = isTour(rawHunt)
            const cat = tourMode ? (rawHunt.tourCategory ?? 'general') : 'general'
            const catMeta = TOUR_CATEGORY_META[cat]

            return (
              <button
                key={hunt.id}
                className={`hunt-card ${stateClass} ${tourMode ? 'is-tour' : ''}`}
                onClick={() => locked ? openCityCheckout() : startHunt(hunt.id, free)}
                disabled={starting === hunt.id || unlocking}
                style={locked ? { opacity: 0.78 } : undefined}
              >
                {locked
                  ? <span className="hunt-badge" style={{ background: 'rgba(245,194,74,.18)', color: '#f5c24a' }}>🔒 {t('locked')}</span>
                  : free && !isCompleted && !isInProgress
                    ? <span className="hunt-badge" style={{ background: 'rgba(34,201,122,.16)', color: '#22c97a' }}>{t('freeHunt')}</span>
                    : isCompleted
                      ? <span className="hunt-badge completed-badge">✓ {t('ctaCompleted')}</span>
                      : isInProgress
                        ? <span className="hunt-badge resume-badge">{t('ctaResume')}</span>
                        : hunt.badge && <span className="hunt-badge">{hunt.badge}</span>
                }
                <div className="hunt-card-top">
                  <div>
                    <div className="hunt-title">{hunt.title}</div>
                    <div className="hunt-desc">{hunt.description}</div>
                  </div>
                  <div className="hunt-arrow">{starting === hunt.id ? '…' : (locked ? '🔒' : '→')}</div>
                </div>

                {huntProgress && totalSteps > 0 && !locked && (
                  <div className={`resume-bar ${isCompleted ? 'is-completed' : ''}`}>
                    <div className="resume-bar-track">
                      <div className="resume-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="resume-bar-text">
                      {isCompleted
                        ? (tourMode ? `✓ ${cluesDone}/${totalSteps}` : `${t('bestScore')} ${huntProgress.score}`)
                        : `${cluesDone}/${totalSteps}`}
                    </span>
                  </div>
                )}

                <div className="hunt-meta">
                  {tourMode ? (
                    <span className="meta-pill" style={{ color: catMeta.color, background: `${catMeta.color}1a`, border: `1px solid ${catMeta.color}40` }}>
                      <span style={{ marginRight: 4 }}>{catMeta.icon}</span>
                      {t(`cat${cat.charAt(0).toUpperCase()}${cat.slice(1)}` as any) || t('tourLabel')}
                    </span>
                  ) : (
                    <span className="meta-pill" style={{ color: diff.color, background: diff.bg, border: `1px solid ${diff.color}33` }}>
                      {t(diff.key)}
                    </span>
                  )}
                  {hunt.rating && (
                    <span className="hunt-rating">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="12,2 15.1,8.3 22,9.3 17,14.1 18.2,21 12,17.8 5.8,21 7,14.1 2,9.3 8.9,8.3" />
                      </svg>
                      {hunt.rating.toFixed(1)}
                    </span>
                  )}
                  <span className="meta-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    {hunt.clueCount} {tourMode ? t('tourStops').toLowerCase() : t('places')}
                  </span>
                  <span className="meta-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    ~{hunt.durationMin} {t('min')}
                  </span>
                  <span className="meta-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                    {hunt.distanceKm} {t('km')}
                  </span>
                </div>
              </button>
            )
          }

          return (
            <>
              {/* Hunts */}
              <h2 id="hunts" className="section-label" style={{ scrollMarginTop: '20px' }}>{t('availableHunts')}</h2>

              {huntsError ? (
                <div className="empty-card">
                  <p>{t('loadError')}</p>
                  <button onClick={loadCityAndHunts} className="btn-primary" style={{ marginTop: 12 }}>{t('retry')}</button>
                </div>
              ) : huntsOnly.length === 0 && toursOnly.length === 0 && (
                <div className="empty-card"><p>{t('noHuntsYet')}</p></div>
              )}

              {huntsOnly.map(renderItem)}

              {/* Self-guided tours */}
              {toursOnly.length > 0 && (
                <>
                  <h2 className="section-label" style={{ marginTop: 24 }}>{t('selfGuidedTours')}</h2>
                  {toursOnly.map(renderItem)}
                </>
              )}
            </>
          )
        })()}

        {!user && (
          <p className="footer-note">{t('signInHint')}</p>
        )}
      </div>

      {checkoutOpen && city && (() => {
        const cityPriceCents = Math.round((city.priceEuros ?? 5) * 100)
        // For now only the single city option dispatches to the real backend.
        // The "country pass" is offered as a coming-soon teaser so users
        // see that bundles are on the way; reaching out about interest
        // signals demand before we build the bundle capture flow.
        const options: CheckoutOption[] = [
          {
            id: city.id,
            title: `Unlock all of ${localCity.name}`,
            subtitle: `${hunts.length} hunt${hunts.length === 1 ? '' : 's'} · lifetime access · play offline`,
            items: [
              'Every hunt in this city, paid once',
              'Replay as many times as you like',
              'Works offline once you start',
              'Two-player races included',
            ],
            priceCents: cityPriceCents,
            icon: localCity.coverEmoji ?? '📍',
            accent: 'var(--primary)',
          },
          {
            id: 'country-pass',
            title: `${localCity.country} country pass`,
            subtitle: `Every city we ever release in ${localCity.country} — currently shipping`,
            items: [
              'All current cities in this country',
              'Every future city we add — no extra charge',
            ],
            priceCents: Math.round(cityPriceCents * 4.2),  // illustrative pricing
            comparePriceCents: Math.round(cityPriceCents * 7),
            badge: 'Best value',
            icon: '🌍',
            disabled: true,
            disabledReason: 'Coming soon — message us if you\'d use this',
            accent: '#0d9488',
          },
        ]
        return (
          <CheckoutSheet
            title={`Unlock ${localCity.name}`}
            subtitle="One payment. Lifetime access. No subscriptions or recurring charges."
            options={options}
            defaultSelectedId={city.id}
            onConfirm={confirmCityCheckout}
            onClose={() => setCheckoutOpen(false)}
          />
        )
      })()}
    </main>
  )
}
