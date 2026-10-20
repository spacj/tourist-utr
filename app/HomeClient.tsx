'use client'
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useI18n } from '@/hooks/useI18n'
import { apiGet } from '@/lib/apiFetch'
import { Country, LANGUAGES, localizeCountry } from '@/types'
import { ResumeRaceBanner } from '@/components/ResumeRaceBanner'
import { AnimatedNumber } from '@/components/AnimatedNumber'
import { useScrollReveal } from '@/hooks/useScrollReveal'
import { CookieSettingsLink } from '@/components/ConsentManager'
import type { BlogPostMeta } from '@/lib/blog'

function CountryCard({ country, t }: { country: Country; t: (key: string) => string }) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgFailed, setImgFailed] = useState(false)
  const isComingSoon = country.comingSoon || country.cityCount === 0
  const href = isComingSoon ? '#' : `/country/${country.id}`
  const showImage = country.imageUrl && !imgFailed
  return (
    <a
      href={href}
      className={`country-card flow-card-link ${isComingSoon ? 'is-coming-soon' : ''}`}
      onClick={(e) => { if (isComingSoon) e.preventDefault() }}
      aria-disabled={isComingSoon}
    >
      <div className="country-cover" aria-hidden>
        {showImage ? (
          <>
            <img
              src={country.imageUrl}
              alt=""
              className={`country-cover-img ${imgLoaded ? 'loaded' : ''}`}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgFailed(true)}
            />
            <div className="country-cover-overlay" />
          </>
        ) : (
          <div className="country-cover-emoji">{country.flag}</div>
        )}
        <span className="country-cover-flag" aria-hidden>{country.flag}</span>
        {isComingSoon && (
          <span className="country-cover-tag country-cover-tag-soon">{t('comingSoon')}</span>
        )}
      </div>
      <div className="country-body">
        <div className="country-body-top">
          <div>
            <div className="country-name">{country.name}</div>
            {country.tagline && <div className="country-tagline">{country.tagline}</div>}
          </div>
          {!isComingSoon && <div className="country-arrow">→</div>}
        </div>
        <p className="country-desc">{country.description}</p>
        <div className="country-foot">
          <span className="country-foot-pill">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2c3 4 3 16 0 20M12 2c-3 4-3 16 0 20"/></svg>
            {country.cityCount} {t('cityWord')}
          </span>
          <span className="country-foot-pill">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
            {country.huntCount} {t('hunts')}
          </span>
        </div>
      </div>
    </a>
  )
}

interface HomeClientProps {
  recentPosts: BlogPostMeta[]
}

export function HomeClient({ recentPosts }: HomeClientProps) {
  const { user, loading, signIn } = useAuth()
  const { lang, setLang, t } = useI18n()
  const [countries, setCountries] = useState<Country[]>([])
  const [countriesState, setCountriesState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [mounted, setMounted] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const loadCountries = useCallback(() => {
    setCountriesState('loading')
    apiGet<Country[]>('/api/countries')
      .then(cs => { setCountries(Array.isArray(cs) ? cs : []); setCountriesState('ready') })
      .catch(() => setCountriesState('error'))
  }, [])

  useEffect(() => { loadCountries() }, [loadCountries])

  // Only auth-dependent bits (avatar / sign-in prompts) wait for auth.
  const showGuestCtas = !loading && !user
  const statValue = (n: number) => (countriesState === 'ready' ? n : '–')

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

  const faq = [
    { q: t('faqQ1'), a: t('faqA1') },
    { q: t('faqQ2'), a: t('faqA2') },
    { q: t('faqQ3'), a: t('faqA3') },
    { q: t('faqQ4'), a: t('faqA4') },
    { q: t('faqQ5'), a: t('faqA5') },
  ]

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(item => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  }

  const startHref = '#countries'

  return (
    <main className="page-center">
      <div className="container">
        {/* ── Hero ── */}
        <div className="hero">
          <div className="hero-img-wrap">
            <img
              src="https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1600&q=85&auto=format&fit=crop"
              srcSet="https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=900&q=80&auto=format&fit=crop 900w, https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1600&q=85&auto=format&fit=crop 1600w"
              sizes="(max-width: 767px) 100vw, 1100px"
              alt={t('heroImgAlt')}
              className={`hero-img ${imgLoaded ? 'loaded' : ''}`}
              onLoad={() => setImgLoaded(true)}
            />
            <div className="hero-img-overlay" />
            <div className="hero-overlay-content">
              <div className="hero-overlay-top">
                <a href="/" className="hero-brand" aria-label={t('homeAria')}>
                  <span className="hero-brand-mark" aria-hidden>🧭</span>
                  <span className="hero-brand-name">TourHunts</span>
                </a>
                <div className="hero-top-right">
                  <div className="lang-switch hero-langs" role="group" aria-label={t('selectLanguage')}>
                    {LANGUAGES.map(l => (
                      <button
                        key={l.code}
                        type="button"
                        aria-pressed={lang === l.code}
                        onClick={() => setLang(l.code)}
                        className={`lang-btn ${lang === l.code ? 'active' : ''}`}
                        title={l.label}
                        aria-label={l.label}
                      >
                        {l.flag}
                      </button>
                    ))}
                  </div>
                  {loading ? (
                    <span className="avatar-btn avatar-btn-light flow-avatar-placeholder" aria-hidden />
                  ) : user ? (
                    <a href="/profile" className="avatar-btn avatar-btn-light" aria-label={t('viewProfile')}>
                      {user.photoURL ? (
                        <img src={user.photoURL} alt="" className="avatar-img" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="avatar-letter">{user.displayName?.[0] || '?'}</span>
                      )}
                    </a>
                  ) : (
                    <button type="button" onClick={signIn} className="sign-in-btn sign-in-btn-light">{t('signIn')}</button>
                  )}
                </div>
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
                <div className="hero-trust" aria-hidden>
                  <span className="hero-trust-chip">🎟️ {t('pricingFreeTag')}</span>
                  <span className="hero-trust-chip">📡 {t('whyOffline')}</span>
                  <span className="hero-trust-chip">🌐 EN · NL · DE · FR · IT · ES</span>
                </div>
                <div className="hero-cta-row">
                  <a href="#countries" className="hero-cta-btn">
                    {t('ctaButton')}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </a>
                  <a href="/multiplayer" className="hero-cta-ghost">
                    👥 {t('playWithFriends')}
                  </a>
                </div>
                <p className="hero-microcopy">🎮 {t('heroMicrocopy')}</p>
              </div>

              {/* Desktop-only product preview — gives visitors an immediate
                  sense of the gameplay (a clue with a puzzle to solve). */}
              <aside className="hero-preview-card" aria-hidden>
                <div className="hero-preview-head">
                  <span className="hero-preview-chip">📍 {t('previewChip')}</span>
                  <span className="hero-preview-pts">{t('previewPts')}</span>
                </div>
                <h3 className="hero-preview-title">{t('previewTitle')}</h3>
                <p className="hero-preview-text">{t('previewText')}</p>
                <div className="hero-preview-puzzle">
                  <div className="hero-preview-puzzle-label">🔤 {t('puzzleTypeAnagram')}</div>
                  <div className="hero-preview-tiles">
                    {['H','D','T','R','E','A','C','O','G','U'].map((c, i) => (
                      <span key={i} className="hero-preview-tile">{c}</span>
                    ))}
                  </div>
                </div>
                <div className="hero-preview-actions">
                  <span className="hero-preview-solve">{t('previewSolve')} →</span>
                  <span className="hero-preview-streak">🔥 {t('previewStreak')}</span>
                </div>
              </aside>
            </div>
          </div>
        </div>

        <ResumeRaceBanner />

        {/* ── Stats bar ── */}
        <div className="stats-bar" role="list" aria-label={t('statsAria')}>
          <div className="stat-item" role="listitem">
            <div className="stat-num">{statValue(countries.filter(c => !c.comingSoon).length)}</div>
            <div className="stat-label">{t('countries')}</div>
          </div>
          <div className="stat-item" role="listitem">
            <div className="stat-num">{statValue(countries.reduce((sum, c) => sum + (c.cityCount || 0), 0))}</div>
            <div className="stat-label">{t('statCities')}</div>
          </div>
          <div className="stat-item" role="listitem">
            <div className="stat-num">{statValue(countries.reduce((sum, c) => sum + (c.huntCount || 0), 0))}</div>
            <div className="stat-label">{t('statHunts')}</div>
          </div>
        </div>

        {/* ── Pricing clarity ── */}
        <section className="pricing-section" aria-labelledby="pricing-title">
          <h2 id="pricing-title" className="section-label">{t('pricingTitle')}</h2>
          <div className="pricing-cards">
            <div className="pricing-card pricing-card-free">
              <div className="pricing-card-head">
                <span className="pricing-card-tag">{t('pricingFreeTag')}</span>
                <span className="pricing-card-price">€0</span>
              </div>
              <h3 className="pricing-card-title">{t('pricingFreeTitle')}</h3>
              <p className="pricing-card-desc">{t('pricingFreeDesc')}</p>
            </div>
            <div className="pricing-card pricing-card-paid">
              <div className="pricing-card-head">
                <span className="pricing-card-tag pricing-card-tag-gold">★</span>
                <span className="pricing-card-price">€5</span>
              </div>
              <h3 className="pricing-card-title">{t('pricingCityTitle')}</h3>
              <p className="pricing-card-desc">{t('pricingCityDesc')}</p>
            </div>
          </div>
          <p className="pricing-note">{t('pricingNote')}</p>
        </section>

        {/* ── Mid-page CTA banner ── */}
        <div className="mid-cta">
          <div className="mid-cta-body">
            <h2 className="mid-cta-title">{t('midCtaTitle')}</h2>
            <p className="mid-cta-desc">{t('midCtaDesc')}</p>
          </div>
          <div className="mid-cta-actions">
            <a href={startHref} className="cta-primary-btn cta-primary-btn-compact">
              {t('stickyCtaPrimary')}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </a>
            <a href="/multiplayer" className="cta-secondary-btn">
              👥 {t('stickyCtaSecondary')}
            </a>
          </div>
        </div>

        {/* ── How it works ── */}
        <section aria-labelledby="how-it-works-title">
          <h2 id="how-it-works-title" className="section-label">{t('howItWorks')}</h2>
          <div className="how-it-works">
            {howSteps.map((s, i) => (
              <div key={i} className="how-step" style={{ animationDelay: `${0.08 + i * 0.1}s` }}>
                <div className="how-step-num">{i + 1}</div>
                <div className="how-step-icon" aria-hidden>{s.icon}</div>
                <h3 className="how-step-title">{s.title}</h3>
                <p className="how-step-desc">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Why TourHunts ── */}
        <section className="why-section" aria-labelledby="why-title">
          <h2 id="why-title" className="section-label">{t('whyUtr')}</h2>
          <div className="why-grid">
            {whyItems.map((w, i) => (
              <div key={i} className="why-card" style={{ animationDelay: `${0.06 + i * 0.08}s` }}>
                <div className="why-icon" aria-hidden>{w.icon}</div>
                <h3 className="why-title">{w.title}</h3>
                <p className="why-desc">{w.desc}</p>
              </div>
            ))}
          </div>
        </section>

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
          <div className="mp-home-cta-icon" aria-hidden>👥</div>
          <div className="mp-home-cta-body">
            <div className="mp-home-cta-title">{t('playWithFriends')}</div>
            <div className="mp-home-cta-desc">{t('shareRoomCode')}</div>
          </div>
          <div className="mp-home-cta-arrow" aria-hidden>→</div>
        </a>

        {/* ── Countries ── */}
        <h2 id="countries" className="section-label" style={{ scrollMarginTop: '20px' }}>{t('chooseCountry')}</h2>

        {countriesState === 'loading' && (
          <div className="skel-grid" aria-busy="true">
            <span className="flow-sr-only" role="status">{t('loading')}</span>
            <span className="skel skel-card" />
            <span className="skel skel-card" />
            <span className="skel skel-card" />
          </div>
        )}

        {countriesState === 'error' && (
          <div className="empty-card" role="alert">
            <p>{t('loadError')}</p>
            <button type="button" className="btn-primary flow-retry" onClick={loadCountries}>{t('retry')}</button>
          </div>
        )}

        {countriesState === 'ready' && countries.length === 0 && (
          <div className="empty-card">
            <p>{t('noCountriesYet')}</p>
          </div>
        )}

        <div className="country-grid">
          {countries.map((rawCountry) => {
            const country = localizeCountry(rawCountry, lang)
            return <CountryCard key={country.id} country={country} t={t} />
          })}
        </div>

        {/* ── From the blog ── */}
        {recentPosts.length > 0 && (
          <section className="home-blog-section" aria-labelledby="home-blog-title">
            <div className="home-blog-head">
              <h2 id="home-blog-title" className="section-label flow-m0">{t('fromTheBlog')}</h2>
              <a href="/blog" className="home-blog-all">{t('allStories')} →</a>
            </div>
            <ul className="home-blog-list">
              {recentPosts.map(post => (
                <li key={post.slug} className="home-blog-card">
                  <a href={`/blog/${post.slug}`} className="home-blog-card-link">
                    {post.heroImage && (
                      <div className="home-blog-card-cover">
                        <img src={post.heroImage} alt={post.heroAlt} loading="lazy" />
                      </div>
                    )}
                    <div className="home-blog-card-body">
                      <div className="home-blog-card-meta">
                        <span className="home-blog-card-cat">{post.category}</span>
                        <span aria-hidden>·</span>
                        <span>{post.readMinutes} {t('min')}</span>
                      </div>
                      <h3 className="home-blog-card-title">{post.title}</h3>
                      <p className="home-blog-card-excerpt">{post.excerpt}</p>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── FAQ ── */}
        <section className="faq-section" aria-labelledby="faq-title">
          <h2 id="faq-title" className="section-label">{t('faqTitle')}</h2>
          <div className="faq-list">
            {faq.map((item, i) => (
              <details key={i} className="faq-item">
                <summary className="faq-q">
                  <span>{item.q}</span>
                  <span className="faq-toggle" aria-hidden>+</span>
                </summary>
                <p className="faq-a">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ── CTA section ── */}
        {showGuestCtas && (
          <div className="cta-section">
            <div className="cta-content">
              <h2 className="cta-title">{t('ctaTitle')}</h2>
              <p className="cta-subtitle">{t('ctaSubtitle')}</p>
              <button type="button" onClick={signIn} className="cta-primary-btn">
                {t('ctaButton')}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </button>
            </div>
          </div>
        )}

        {showGuestCtas && (
          <p className="footer-note">{t('signInSaveHint')}</p>
        )}

        {/* ── Benches + Fountains map CTAs ── */}
        <a href="/benches" className="mp-home-cta benches-home-cta">
          <div className="mp-home-cta-icon" aria-hidden>🪑</div>
          <div className="mp-home-cta-body">
            <div className="mp-home-cta-title">{t('benchesCtaTitle')}</div>
            <div className="mp-home-cta-desc">{t('benchesCtaDesc')}</div>
          </div>
          <div className="mp-home-cta-arrow" aria-hidden>→</div>
        </a>
        <a href="/fountains" className="mp-home-cta fountains-home-cta">
          <div className="mp-home-cta-icon" aria-hidden>⛲</div>
          <div className="mp-home-cta-body">
            <div className="mp-home-cta-title">{t('fountainsCtaTitle')}</div>
            <div className="mp-home-cta-desc">{t('fountainsCtaDesc')}</div>
          </div>
          <div className="mp-home-cta-arrow" aria-hidden>→</div>
        </a>

        {/* ── Footer ── */}
        <footer className="site-footer">
          <div className="footer-top">
            <div className="footer-brand">
              <span className="footer-brand-icon">🧭</span>
              <p className="footer-brand-desc">{t('footerTagline')}</p>
            </div>
            <div className="footer-nav">
              <div className="footer-nav-col">
                <div className="footer-nav-title">{t('countries')}</div>
                {countries.filter(c => !c.comingSoon).map(c => (
                  <a key={c.id} href={`/country/${c.id}`} className="footer-nav-link">{localizeCountry(c, lang).name}</a>
                ))}
              </div>
              <div className="footer-nav-col">
                <div className="footer-nav-title">{t('footerAbout')}</div>
                <a href="/blog" className="footer-nav-link">{t('footerBlog')}</a>
                <a href="/benches" className="footer-nav-link">{t('footerBenches')}</a>
                <a href="/fountains" className="footer-nav-link">{t('footerFountains')}</a>
                <a href="/contact" className="footer-nav-link">{t('footerContact')}</a>
                <a href="/privacy" className="footer-nav-link">{t('footerPrivacy')}</a>
                <a href="/terms" className="footer-nav-link">{t('footerTerms')}</a>
                <CookieSettingsLink className="footer-nav-link footer-nav-button" />
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <span>{t('footerCopy')}</span>
          </div>
        </footer>
      </div>

      {/* ── Sticky mobile CTA bar ── */}
      {mounted && (
        <nav className="sticky-cta" aria-label={t('quickActionsAria')}>
          <a href={startHref} className="sticky-cta-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 0-8 8c0 6 8 12 8 12s8-6 8-12a8 8 0 0 0-8-8z"/></svg>
            {t('stickyCtaPrimary')}
          </a>
          <a href="/multiplayer" className="sticky-cta-secondary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span className="sticky-cta-secondary-text">{t('stickyCtaSecondary')}</span>
          </a>
        </nav>
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
    </main>
  )
}
