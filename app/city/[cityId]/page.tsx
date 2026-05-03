'use client'
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { useI18n } from '@/hooks/useI18n'
import { City, Hunt, isHuntFree, localizeCity, localizeHunt } from '@/types'

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
  const [unlocked, setUnlocked] = useState(false)
  const [progress, setProgress] = useState<ProgressMap>({})
  const [starting, setStarting] = useState<string | null>(null)
  const [unlocking, setUnlocking] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)

  // Load city + hunts
  useEffect(() => {
    if (!cityId) return
    fetch('/api/cities').then(r => r.json()).then((cs: City[]) => {
      setCity(cs.find(c => c.id === cityId) ?? null)
    }).catch(() => {})
    fetch('/api/hunts').then(r => r.json()).then((hs: Hunt[]) => {
      setHunts(
        hs.filter(h => h.cityId === cityId)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      )
    }).catch(() => {})
  }, [cityId])

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
    window.location.href = `/hunt?session=${data.sessionId}`
  }

  const unlockCity = async () => {
    if (!user) { signIn(); return }
    if (!city) return
    setUnlocking(true)
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
      setFlash(data?.error === 'sign_in_required' ? t('signInToUnlock') : 'Payment unavailable')
    }
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
        <a href="/" className="city-back">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          {t('backToHunts')}
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
            <button onClick={unlockCity} disabled={unlocking} className="city-hero-cta">
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

        {/* Hunts */}
        <div className="section-label">{t('availableHunts')}</div>

        {hunts.length === 0 && (
          <div className="empty-card"><p>{t('noHuntsYet')}</p></div>
        )}

        {hunts.map((rawHunt) => {
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
          return (
            <button
              key={hunt.id}
              className={`hunt-card ${stateClass}`}
              onClick={() => locked ? unlockCity() : startHunt(hunt.id, free)}
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
                      ? `${t('bestScore')} ${huntProgress.score}`
                      : `${cluesDone}/${totalSteps}`}
                  </span>
                </div>
              )}

              <div className="hunt-meta">
                <span className="meta-pill" style={{ color: diff.color, background: diff.bg, border: `1px solid ${diff.color}33` }}>
                  {t(diff.key)}
                </span>
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
                  {hunt.clueCount} {t('places')}
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
        })}

        {!user && (
          <p className="footer-note">{t('signInHint')}</p>
        )}
      </div>
    </main>
  )
}
