'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useI18n } from '@/hooks/useI18n'
import { City, LANGUAGES, localizeCity } from '@/types'

export default function HomePage() {
  const { user, loading, signIn } = useAuth()
  const { lang, setLang, t } = useI18n()
  const [cities, setCities] = useState<City[]>([])
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set())
  const [cookieAccepted, setCookieAccepted] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)

  useEffect(() => {
    setCookieAccepted(localStorage.getItem('cookieConsent') === 'yes')
    setMounted(true)
  }, [])

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

  const acceptCookies = () => {
    localStorage.setItem('cookieConsent', 'yes')
    setCookieAccepted(true)
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
          <div className="hero-img-wrap">
            <img
              src="https://images.unsplash.com/photo-1526512340740-9217d0159da9?w=880&q=80"
              alt="Canal in the Netherlands"
              className={`hero-img ${imgLoaded ? 'loaded' : ''}`}
              onLoad={() => setImgLoaded(true)}
            />
            <div className="hero-img-overlay" />
          </div>

          <div className="hero-content">
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

            <div className="hero-bottom-row">
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
        </div>

        {/* ── Features ── */}
        <div className="features">
          <div className="features-title">{t('whatsIncluded')}</div>
          {features.map((f, i) => (
            <div key={i} className="feature" style={{ animationDelay: `${0.08 + i * 0.06}s` }}>
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
              className={`city-card ${isUnlocked ? 'is-unlocked' : ''}`}
              style={{ textDecoration: 'none' }}
            >
              <div className="city-cover" aria-hidden>
                <div className="city-cover-emoji">{city.coverEmoji ?? '📍'}</div>
                {isUnlocked
                  ? <span className="city-cover-tag city-cover-tag-unlocked">✓ {t('unlocked')}</span>
                  : <span className="city-cover-tag">{t('firstFree')}</span>}
              </div>
              <div className="city-body">
                <div className="city-body-top">
                  <div>
                    <div className="city-name">{city.name}</div>
                    <div className="city-country">{city.country}</div>
                  </div>
                  <div className="city-arrow">→</div>
                </div>
                <p className="city-desc">{city.description}</p>
                <div className="city-foot">
                  <span className="city-foot-pill">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
                    {city.huntCount} {t('hunts')}
                  </span>
                  {!isUnlocked && (
                    <span className="city-foot-price">€{city.priceEuros}</span>
                  )}
                </div>
              </div>
            </a>
          )
        })}

        {!user && (
          <p className="footer-note">{t('signInHint')}</p>
        )}
      </div>

      {/* ── Cookie banner ── */}
      {mounted && !cookieAccepted && (
        <div className="cookie-banner">
          <div className="cookie-body">
            <span className="cookie-icon">🍪</span>
            <span className="cookie-text">
              We use cookies to enhance your experience and save progress.
            </span>
          </div>
          <div className="cookie-actions">
            <button className="cookie-accept" onClick={acceptCookies}>Accept</button>
          </div>
        </div>
      )}
    </main>
  )
}
