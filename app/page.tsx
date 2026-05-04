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
    t('featOffline'),
    t('featMulti'),
    t('featReplay'),
  ]

  const howSteps = [
    { icon: '📍', title: t('howStep1Title'), desc: t('howStep1Desc') },
    { icon: '🧭', title: t('howStep2Title'), desc: t('howStep2Desc') },
    { icon: '🏆', title: t('howStep3Title'), desc: t('howStep3Desc') },
  ]

  const whyItems = [
    { icon: '📡', title: t('whyOffline'), desc: t('whyOfflineDesc') },
    { icon: '🌐', title: t('whyNoApp'), desc: t('whyNoAppDesc') },
    { icon: '📖', title: t('whyStories'), desc: t('whyStoriesDesc') },
    { icon: '🔓', title: t('whyPrice'), desc: t('whyPriceDesc') },
  ]

  const reviews = [
    { name: t('review1Name'), text: t('review1Text'), avatar: '👩‍❤️‍👨' },
    { name: t('review2Name'), text: t('review2Text'), avatar: '👨‍👩‍👧‍👦' },
    { name: t('review3Name'), text: t('review3Text'), avatar: '🧑' },
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
                {!user && (
                  <button onClick={signIn} className="hero-cta-btn">
                    {t('ctaButton')}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </button>
                )}
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

        {/* ── Stats bar ── */}
        <div className="stats-bar">
          <div className="stat-item">
            <div className="stat-num">2</div>
            <div className="stat-label">{t('statCities')}</div>
          </div>
          <div className="stat-item">
            <div className="stat-num">5</div>
            <div className="stat-label">{t('statHunts')}</div>
          </div>
          <div className="stat-item">
            <div className="stat-num">36</div>
            <div className="stat-label">{t('statStops')}</div>
          </div>
          <div className="stat-item">
            <div className="stat-num">4.9</div>
            <div className="stat-label">{t('statRating')}</div>
          </div>
        </div>

        {/* ── How it works ── */}
        <div className="section-label">{t('howItWorks')}</div>
        <div className="how-it-works">
          {howSteps.map((s, i) => (
            <div key={i} className="how-step" style={{ animationDelay: `${0.08 + i * 0.1}s` }}>
              <div className="how-step-num">{i + 1}</div>
              <div className="how-step-icon">{s.icon}</div>
              <h3 className="how-step-title">{s.title}</h3>
              <p className="how-step-desc">{s.desc}</p>
            </div>
          ))}
        </div>

        {/* ── Why UTR Tour ── */}
        <div className="why-section">
          <div className="section-label">{t('whyUtr')}</div>
          <div className="why-grid">
            {whyItems.map((w, i) => (
              <div key={i} className="why-card" style={{ animationDelay: `${0.06 + i * 0.08}s` }}>
                <div className="why-icon">{w.icon}</div>
                <h4 className="why-title">{w.title}</h4>
                <p className="why-desc">{w.desc}</p>
              </div>
            ))}
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

        {/* ── Multiplayer CTA ── */}
        <a href="/multiplayer" className="mp-home-cta">
          <div className="mp-home-cta-icon">👥</div>
          <div className="mp-home-cta-body">
            <div className="mp-home-cta-title">{t('playWithFriends')}</div>
            <div className="mp-home-cta-desc">{t('shareRoomCode')}</div>
          </div>
          <div className="mp-home-cta-arrow">→</div>
        </a>

        {/* ── Cities ── */}
        <div className="section-label">{t('chooseCity')}</div>

        {cities.length === 0 && (
          <div className="empty-card">
            <p>{t('noHuntsYet')}</p>
          </div>
        )}

        <div className="city-grid">
          {cities.map((rawCity) => {
            const city = localizeCity(rawCity, lang)
            const isUnlocked = unlocked.has(city.id)
            return <CityCard key={city.id} city={city} isUnlocked={isUnlocked} t={(key: string) => t(key as any)} />
          })}
        </div>

        {/* ── Reviews ── */}
        <div className="reviews-section">
          <div className="section-label">{t('reviewsTitle')}</div>
          <div className="reviews-grid">
            {reviews.map((r, i) => (
              <div key={i} className="review-card" style={{ animationDelay: `${0.08 + i * 0.1}s` }}>
                <div className="review-stars">★★★★★</div>
                <p className="review-text">"{r.text}"</p>
                <div className="review-author">
                  <span className="review-avatar">{r.avatar}</span>
                  <span className="review-name">{r.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── CTA section ── */}
        {!user && (
          <div className="cta-section">
            <div className="cta-content">
              <h2 className="cta-title">{t('ctaTitle')}</h2>
              <p className="cta-subtitle">{t('ctaSubtitle')}</p>
              <button onClick={signIn} className="cta-primary-btn">
                {t('ctaButton')}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </button>
            </div>
          </div>
        )}

        {!user && (
          <p className="footer-note">{t('signInHint')}</p>
        )}

        {/* ── Footer ── */}
        <footer className="site-footer">
          <div className="footer-top">
            <div className="footer-brand">
              <span className="footer-brand-icon">🧭</span>
              <p className="footer-brand-desc">{t('footerTagline')}</p>
            </div>
            <div className="footer-nav">
              <div className="footer-nav-col">
                <div className="footer-nav-title">{t('footerLinks')}</div>
                {cities.map(c => (
                  <a key={c.id} href={`/city/${c.id}`} className="footer-nav-link">{c.name}</a>
                ))}
              </div>
              <div className="footer-nav-col">
                <div className="footer-nav-title">{t('footerAbout')}</div>
                <a href="#" className="footer-nav-link">{t('footerContact')}</a>
                <a href="#" className="footer-nav-link">{t('footerPrivacy')}</a>
                <a href="#" className="footer-nav-link">{t('footerTerms')}</a>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <span>{t('footerCopy')}</span>
          </div>
        </footer>
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
