'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useI18n } from '@/hooks/useI18n'
import { City, LANGUAGES, localizeCity } from '@/types'

function SkylineSvg() {
  return (
    <svg className="hero-skyline" viewBox="0 0 400 80" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f5c24a" stopOpacity="0" />
          <stop offset="100%" stopColor="#f5c24a" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      <path d="M0 80 L0 60 L30 58 L40 55 L55 56 L70 52 L88 54 L100 48 L115 50 L130 45
               L148 47 L160 38 L170 30 L175 12 L180 8 L185 12 L190 30 L200 38 L212 47
               L228 45 L242 50 L258 48 L272 54 L288 52 L302 56 L316 55 L330 58 L360 60 L400 62 L400 80 Z"
        fill="url(#sky)" />
      <path d="M175 40 L175 12 L180 4 L185 12 L185 40 Z" fill="#f5c24a" opacity="0.55" />
    </svg>
  )
}

export default function HomePage() {
  const { user, loading, signIn } = useAuth()
  const { lang, setLang, t } = useI18n()
  const [cities, setCities] = useState<City[]>([])
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/cities').then(r => r.json()).then(setCities).catch(() => {})
  }, [])

  useEffect(() => {
    if (!user) { setUnlocked(new Set()); return }
    fetch(`/api/city-unlocks?userId=${user.uid}`)
      .then(r => r.json())
      .then((ids: string[]) => setUnlocked(new Set(ids)))
      .catch(() => {})
  }, [user])

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

        {/* ── Cities ── */}
        <div className="section-label">{t('chooseCity')}</div>

        {cities.length === 0 && (
          <div className="empty-card">
            <p>{t('noHuntsYet')}</p>
          </div>
        )}

        {cities.map((rawCity) => {
          const city = localizeCity(rawCity, lang)
          const isUnlocked = unlocked.has(city.id)
          return (
            <a
              key={city.id}
              href={`/city/${city.id}`}
              className="hunt-card"
              style={{ textDecoration: 'none' }}
            >
              {isUnlocked
                ? <span className="hunt-badge completed-badge">✓ {t('unlocked')}</span>
                : <span className="hunt-badge">{t('firstFree')}</span>
              }
              <div className="hunt-card-top">
                <div>
                  <div className="hunt-title">
                    {city.coverEmoji && <span style={{ marginRight: 8 }}>{city.coverEmoji}</span>}
                    {city.name}
                  </div>
                  <div className="hunt-desc">{city.description}</div>
                </div>
                <div className="hunt-arrow">→</div>
              </div>
              <div className="hunt-meta">
                <span className="meta-item">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  {city.country}
                </span>
                <span className="meta-item">
                  {city.huntCount} {t('hunts')}
                </span>
                {!isUnlocked && (
                  <span className="meta-pill" style={{ color: '#f5c24a', background: 'rgba(245,194,74,.12)', border: '1px solid rgba(245,194,74,.3)' }}>
                    €{city.priceEuros}
                  </span>
                )}
              </div>
            </a>
          )
        })}

        {!user && (
          <p className="footer-note">{t('signInHint')}</p>
        )}
      </div>
    </main>
  )
}
