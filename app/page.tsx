'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useI18n } from '@/hooks/useI18n'
import { City, LANGUAGES, localizeCity } from '@/types'

function CityCard({ city, isUnlocked, t }: { city: City; isUnlocked: boolean; t: (key: string) => string }) {
  const [imgLoaded, setImgLoaded] = useState(false)
  return (
    <a
      href={`/city/${city.id}`}
      className={`city-card ${isUnlocked ? 'is-unlocked' : ''}`}
      style={{ textDecoration: 'none' }}
    >
      <div className="city-cover" aria-hidden>
        {city.imageUrl ? (
          <>
            <img
              src={city.imageUrl}
              alt={city.name}
              className={`city-cover-img ${imgLoaded ? 'loaded' : ''}`}
              onLoad={() => setImgLoaded(true)}
            />
            <div className="city-cover-overlay" />
          </>
        ) : (
          <div className="city-cover-emoji">{city.coverEmoji ?? '📍'}</div>
        )}
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
}

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
            <div className="hero-overlay-content">
              <div className="hero-overlay-top">
                {user ? (
                  <a href="/profile" className="avatar-btn avatar-btn-light">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="" className="avatar-img" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="avatar-letter">{user.displayName?.[0] || '?'}</span>
                    )}
                  </a>
                ) : (
                  <button onClick={signIn} className="sign-in-btn sign-in-btn-light">{t('signIn')}</button>
                )}
              </div>
              <div className="hero-overlay-bottom">
                <div className="hero-badge">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L4 8v12h6v-7h4v7h6V8z" />
                  </svg>
                  {t('subtitle')}
                </div>
                <h1 className="hero-overlay-title">{t('title')}</h1>
                <p className="hero-overlay-tagline">{t('tagline')}</p>
              </div>
            </div>
          </div>

          <div className="hero-content">
            <div className="hero-content-row">
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
          return <CityCard key={city.id} city={city} isUnlocked={isUnlocked} t={(key: string) => t(key as any)} />
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
