'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useI18n } from '@/hooks/useI18n'
import { Hunt, LANGUAGES } from '@/types'

const DIFFICULTY_META: Record<string, { label: string; color: string; bg: string }> = {
  easy:   { label: 'Easy',   color: '#22c97a', bg: 'rgba(34,201,122,.12)' },
  medium: { label: 'Medium', color: '#f5a54a', bg: 'rgba(245,165,74,.12)' },
  hard:   { label: 'Hard',   color: '#f05252', bg: 'rgba(240,82,82,.12)' },
}

function SkylineSvg() {
  return (
    <svg className="hero-skyline" viewBox="0 0 400 80" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f5c24a" stopOpacity="0" />
          <stop offset="100%" stopColor="#f5c24a" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      {/* Dom Tower silhouette centre */}
      <path d="M0 80 L0 60 L30 58 L40 55 L55 56 L70 52 L88 54 L100 48 L115 50 L130 45
               L148 47 L160 38 L170 30 L175 12 L180 8 L185 12 L190 30 L200 38 L212 47
               L228 45 L242 50 L258 48 L272 54 L288 52 L302 56 L316 55 L330 58 L360 60 L400 62 L400 80 Z"
        fill="url(#sky)" />
      <path d="M175 40 L175 12 L180 4 L185 12 L185 40 Z" fill="#f5c24a" opacity="0.55" />
    </svg>
  )
}

type ProgressMap = Record<string, { sessionId: string; cluesCompleted: number; totalClues: number }>

export default function HomePage() {
  const { user, loading, signIn } = useAuth()
  const { lang, setLang, t } = useI18n()
  const [hunts, setHunts] = useState<Hunt[]>([])
  const [starting, setStarting] = useState<string | null>(null)
  const [progress, setProgress] = useState<ProgressMap>({})

  useEffect(() => {
    fetch('/api/hunts').then(r => r.json()).then(setHunts).catch(() => {})
  }, [])

  useEffect(() => {
    if (!user) { setProgress({}); return }
    fetch(`/api/user-progress?userId=${user.uid}`)
      .then(r => r.json())
      .then((d) => { if (d && !d.error) setProgress(d) })
      .catch(() => {})
  }, [user])

  const startHunt = async (huntId: string) => {
    if (!user) { signIn(); return }
    setStarting(huntId)
    const res = await fetch('/api/start-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ huntId, userId: user.uid }),
    })
    const { sessionId } = await res.json()
    window.location.href = `/hunt?session=${sessionId}`
  }

  if (loading) {
    return (
      <main className="page-center">
        <div className="spinner" />
      </main>
    )
  }

  const features = [
    t('featStops'),
    t('featStories'),
    t('featTrivia'),
    t('featGps'),
    t('featReplay'),
  ]

  return (
    <main className="page-center">
      <div className="container">
        {/* ── Hero ── */}
        <div className="hero">
          <SkylineSvg />
          <div className="hero-top">
            <div className="hero-brand">
              <div className="hero-logo">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                  stroke="#1a1300" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L4 8v12h6v-7h4v7h6V8z" />
                </svg>
              </div>
              <div>
                <div className="hero-title">{t('title')}</div>
                <div className="hero-sub">{t('subtitle')}</div>
              </div>
            </div>
            {user ? (
              <a href="/profile" className="avatar-btn">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" className="avatar-img" referrerPolicy="no-referrer" />
                ) : (
                  <span className="avatar-letter">{user.displayName?.[0] || '?'}</span>
                )}
              </a>
            ) : (
              <button onClick={signIn} className="sign-in-btn">{t('signIn')}</button>
            )}
          </div>

          <p className="hero-tagline">
            <em>{t('tagline')}</em>
          </p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <span className="price-tag">{t('priceTag')}</span>
            <div className="lang-switch">
              {LANGUAGES.map(l => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  className={`lang-btn ${lang === l.code ? 'active' : ''}`}
                  title={l.label}
                  aria-label={l.label}
                >
                  {l.flag}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Features ── */}
        <div className="features">
          <div className="features-title">{t('whatsIncluded')}</div>
          {features.map((f, i) => (
            <div key={i} className="feature">
              <span className="feature-check">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
              <span>{f}</span>
            </div>
          ))}
        </div>

        {/* ── Hunts ── */}
        <div className="section-label">{t('availableHunts')}</div>

        {hunts.length === 0 && (
          <div className="empty-card">
            <p>No hunts available yet.</p>
          </div>
        )}

        {hunts.map((hunt) => {
          const diff = DIFFICULTY_META[hunt.difficulty] || DIFFICULTY_META.medium
          const inProgress = progress[hunt.id]
          const pct = inProgress
            ? Math.round((inProgress.cluesCompleted / Math.max(1, inProgress.totalClues)) * 100)
            : 0
          return (
            <button
              key={hunt.id}
              className={`hunt-card ${inProgress ? 'resuming' : ''}`}
              onClick={() => startHunt(hunt.id)}
              disabled={starting === hunt.id}
            >
              {inProgress
                ? <span className="hunt-badge resume-badge">{t('ctaResume')}</span>
                : hunt.badge && <span className="hunt-badge">{hunt.badge}</span>
              }
              <div className="hunt-card-top">
                <div>
                  <div className="hunt-title">{hunt.title}</div>
                  <div className="hunt-desc">{hunt.description}</div>
                </div>
                <div className="hunt-arrow">{starting === hunt.id ? '…' : '→'}</div>
              </div>

              {inProgress && (
                <div className="resume-bar">
                  <div className="resume-bar-track">
                    <div className="resume-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="resume-bar-text">
                    {inProgress.cluesCompleted}/{inProgress.totalClues}
                  </span>
                </div>
              )}

              <div className="hunt-meta">
                <span className="meta-pill" style={{ color: diff.color, background: diff.bg, border: `1px solid ${diff.color}33` }}>
                  {diff.label}
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
