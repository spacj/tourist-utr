'use client'
import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, Users, Armchair, Droplet } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { useI18n } from '@/hooks/useI18n'
import { apiGet } from '@/lib/apiFetch'
import { Country, localizeCountry } from '@/types'
import { ResumeRaceBanner } from '@/components/ResumeRaceBanner'
import { CookieSettingsLink } from '@/components/ConsentManager'
import { Logo, Wordmark } from '@/components/Logo'
import { SampleStop } from '@/components/SampleStop'
import type { BlogPostMeta } from '@/lib/blog'
import { Avatar } from '@/components/Avatar'
import Image from 'next/image'
import { LanguagePicker } from '@/components/LanguagePicker'
import { HeroMap } from '@/components/HeroMap'

// Live cities, shown as stamps under the hero CTA (real pages, real links).
const HERO_CITIES = [
  { id: 'city_utrecht', name: 'Utrecht' },
  { id: 'city_amsterdam', name: 'Amsterdam' },
  { id: 'city_delft', name: 'Delft' },
  { id: 'city_leiden', name: 'Leiden' },
  { id: 'city_haarlem', name: 'Haarlem' },
  { id: 'city_the_hague', name: 'Den Haag' },
  { id: 'city_rotterdam', name: 'Rotterdam' },
]

/** A real photo for the hero, added later by the owner (see app/page.tsx → HERO_PHOTO). */
export interface HeroPhoto {
  src: string
  alt: string
  /** Optional handwritten-style caption under the photo. */
  caption?: string
}

/** Each country is a small "map card": a dotted route, the flag, and its numbers. */
function CountryCard({ country, t }: { country: Country; t: (key: string) => string }) {
  const isComingSoon = country.comingSoon || country.cityCount === 0
  const art = (
    <span className="nb-map-art" aria-hidden>
      <svg viewBox="0 0 240 90" preserveAspectRatio="none" className="nb-map-route">
        <path d="M14 70 C 60 20, 100 86, 140 46 S 200 18, 222 30" />
      </svg>
      <span className="nb-map-x" />
      <span className="nb-map-flag">{country.flag}</span>
    </span>
  )
  const body = (
    <div className="nb-map-body">
      <h3 className="nb-map-name">{country.name}</h3>
      {country.tagline && <span className="nb-map-tagline">{country.tagline}</span>}
      {country.description && <span className="nb-map-desc">{country.description}</span>}
      <span className="nb-map-meta">
        {isComingSoon ? (
          <span className="stamp stamp-small">{t('comingSoon')}</span>
        ) : (
          <>
            <span className="nb-num">{country.cityCount}</span> {t('cityWord')}
            <span aria-hidden> · </span>
            <span className="nb-num">{country.huntCount}</span> {t('hunts')}
          </>
        )}
      </span>
      {!isComingSoon && (
        <span className="nb-map-go">
          {t('countryCardCta')}
          <ArrowRight size={18} strokeWidth={2} aria-hidden />
        </span>
      )}
    </div>
  )
  if (isComingSoon) {
    return <div className="nb-map-card is-soon">{art}{body}</div>
  }
  return <a href={`/country/${country.id}`} className="nb-map-card">{art}{body}</a>
}

/** Hand-drawn style route strip: three stops and an X. */
function RouteStrip() {
  return (
    <svg className="nb-route-svg" viewBox="0 0 960 120" aria-hidden focusable="false">
      <path className="nb-route-path" d="M70 70 C 170 10, 300 110, 400 62 S 600 20, 700 72 S 850 92, 896 50" />
      {[[70, 70], [400, 62], [700, 72]].map(([x, y], i) => (
        <g key={i} className="nb-route-stop">
          <circle cx={x} cy={y} r="20" />
          <text x={x} y={y + 7} textAnchor="middle">{i + 1}</text>
        </g>
      ))}
      <path className="nb-route-x" d="M884 30 L 916 62 M 916 30 L 884 62" />
    </svg>
  )
}

interface HomeClientProps {
  recentPosts: BlogPostMeta[]
  /** Slot for a real photo from a route. Null → the hero stays typographic. */
  heroPhoto?: HeroPhoto | null
}

export function HomeClient({ recentPosts, heroPhoto = null }: HomeClientProps) {
  const { user, loading, signIn } = useAuth()
  const { lang, t } = useI18n()
  const [countries, setCountries] = useState<Country[]>([])
  const [countriesState, setCountriesState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const loadCountries = useCallback(() => {
    setCountriesState('loading')
    apiGet<Country[]>('/api/countries')
      .then(cs => { setCountries(Array.isArray(cs) ? cs : []); setCountriesState('ready') })
      .catch(() => setCountriesState('error'))
  }, [])

  useEffect(() => { loadCountries() }, [loadCountries])

  const showGuestCtas = !loading && !user

  const steps = [
    { title: t('routeFindTitle'), desc: t('routeFindDesc') },
    { title: t('routeWalkTitle'), desc: t('routeWalkDesc') },
    { title: t('routeDiscoverTitle'), desc: t('routeDiscoverDesc') },
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
    <div className="nb-home">
      <a href="#main" className="skip-link">{t('skipToContent')}</a>

      {/* ── Masthead ── */}
      <header className="nb-masthead">
        <a href="/" className="nb-brand" aria-label={t('homeAria')}>
          <Wordmark size={34} />
        </a>
        <div className="nb-mast-right">
          <LanguagePicker />
          {loading ? (
            <span className="avatar-btn flow-avatar-placeholder" aria-hidden />
          ) : user ? (
            <a href="/profile" className="avatar-btn" aria-label={t('viewProfile')}>
              {user.photoURL ? (
                <Avatar src={user.photoURL} className="avatar-img" size={36} />
              ) : (
                <span className="avatar-letter">{user.displayName?.[0] || '?'}</span>
              )}
            </a>
          ) : (
            <button type="button" onClick={signIn} className="btn-secondary nb-signin">{t('signIn')}</button>
          )}
        </div>
      </header>

      <main id="main" className="nb-main" tabIndex={-1}>
        {/* ── Hero: the pitch + a page torn from the notebook ── */}
        <section className="nb-hero" aria-labelledby="home-title">
          <HeroMap />
          <div className="nb-hero-copy">
            <p className="nb-kicker">{t('homeKicker')}</p>
            <h1 id="home-title" className="nb-h1">{t('homeH1')}</h1>
            <svg className="nb-h1-swash" viewBox="0 0 320 18" aria-hidden focusable="false">
              <path d="M4 12 C 60 4, 120 16, 180 9 S 280 5, 316 10" fill="none" stroke="#A33B2B" strokeWidth="4" strokeLinecap="round" />
            </svg>
            <p className="nb-lede">{t('homeLede')}</p>
            <div className="nb-hero-actions">
              <a href={startHref} className="btn-primary nb-cta">
                {t('homeCtaPick')}
                <ArrowRight size={18} strokeWidth={2} aria-hidden />
              </a>
              <a href="/multiplayer" className="btn-ghost nb-cta-ghost">
                <Users size={18} strokeWidth={1.75} aria-hidden />
                {t('playWithFriends')}
              </a>
            </div>
            <nav className="nb-city-stamps" aria-label={t('homeCitiesAria')}>
              {HERO_CITIES.map(c => (
                <a key={c.id} href={`/city/${c.id}`} className="nb-city-stamp">{c.name}</a>
              ))}
            </nav>
            <ul className="nb-facts" aria-label={t('statsAria')}>
              <li>{t('homeFactFree')}</li>
              <li>{t('homeFactApp')}</li>
              <li>{t('homeFactLangs')}</li>
            </ul>
          </div>

          <div className="nb-hero-page">
            {heroPhoto && (
              <figure className="nb-photo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <Image src={heroPhoto.src} alt={heroPhoto.alt} width={900} height={600} sizes="(max-width: 700px) 90vw, 420px" priority />
                {heroPhoto.caption && <figcaption>{heroPhoto.caption}</figcaption>}
              </figure>
            )}
            <div className="nb-card-behind" aria-hidden>
              <span className="nb-card-behind-head">{t('homeBehindHead')}</span>
              <span className="nb-card-behind-title">Pandhof</span>
              <span className="nb-card-behind-stamp">{t('homeBehindStamp')}</span>
            </div>
            <SampleStop ctaHref={startHref} />
          </div>
        </section>

        <ResumeRaceBanner />

        {/* ── How it works: route strip ── */}
        <section className="nb-section nb-route" aria-labelledby="route-title">
          <h2 id="route-title" className="nb-h2">{t('routeTitle')}</h2>
          <RouteStrip />
          <ol className="nb-route-notes">
            {steps.map((s, i) => (
              <li key={i} className="nb-note">
                <span className="nb-note-num" aria-hidden>{i + 1}</span>
                <h3 className="nb-note-title">{s.title}</h3>
                <p className="nb-note-desc">{s.desc}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Cities ── */}
        <section className="nb-section nb-cities" aria-labelledby="countries">
          <h2 id="countries" className="nb-h2 flow-anchor">{t('citiesTitle')}</h2>
          <p className="nb-section-lede">{t('citiesLede')}</p>

          {countriesState === 'loading' && (
            <div className="skel-grid" aria-busy="true">
              <span className="flow-sr-only" role="status">{t('loading')}</span>
              <span className="skel skel-card" />
              <span className="skel skel-card" />
            </div>
          )}

          {countriesState === 'error' && (
            <div className="empty-card" role="alert">
              <p>{t('loadError')}</p>
              <button type="button" className="btn-secondary flow-retry" onClick={loadCountries}>{t('retry')}</button>
            </div>
          )}

          {countriesState === 'ready' && countries.length === 0 && (
            <div className="empty-card"><p>{t('noCountriesYet')}</p></div>
          )}

          {countries.length > 0 && (
            <ul className="nb-map-grid">
              {countries.map(rawCountry => {
                const country = localizeCountry(rawCountry, lang)
                return <li key={country.id}><CountryCard country={country} t={t} /></li>
              })}
            </ul>
          )}
        </section>

        {/* ── Pricing note + friends ── */}
        <section className="nb-section nb-split" aria-labelledby="pricing-title">
          <div className="nb-price">
            <h2 id="pricing-title" className="nb-h2">{t('pricingTitle')}</h2>
            <p className="nb-price-line"><span className="nb-price-mark">€0</span>{t('priceLineFree')}</p>
            <p className="nb-price-line"><span className="nb-price-mark">€5</span>{t('priceLineHunt')}</p>
            <p className="nb-price-detail">{t('priceDetail')}</p>
          </div>
          <div className="nb-friends">
            <h3 className="nb-h3">{t('friendsTitle')}</h3>
            <p>{t('friendsDesc')}</p>
            <a href="/multiplayer" className="btn-secondary nb-friends-btn">
              <Users size={18} strokeWidth={1.75} aria-hidden />
              {t('playWithFriends')}
            </a>
          </div>
        </section>

        {/* ── Founder note ── */}
        <section className="nb-section nb-founder" aria-labelledby="founder-title">
          <h2 id="founder-title" className="nb-h2">{t('founderTitle')}</h2>
          <p className="nb-founder-body">{t('founderBody')}</p>
          <p className="nb-founder-sign">{t('founderSign')}</p>
        </section>

        {/* ── From the blog ── */}
        {recentPosts.length > 0 && (
          <section className="nb-section home-blog-section" aria-labelledby="home-blog-title">
            <div className="home-blog-head">
              <h2 id="home-blog-title" className="nb-h2 flow-m0">{t('fromTheBlog')}</h2>
              <a href="/blog" className="home-blog-all">{t('allStories')} <ArrowRight size={16} strokeWidth={2} aria-hidden /></a>
            </div>
            <ul className="home-blog-list">
              {recentPosts.map(post => (
                <li key={post.slug} className="home-blog-card">
                  <a href={`/blog/${post.slug}`} className="home-blog-card-link">
                    {post.heroImage && (
                      <div className="home-blog-card-cover">
                        <Image src={post.heroImage} alt={post.heroAlt} width={640} height={360} sizes="(max-width: 700px) 100vw, 33vw" />
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

        {/* ── FAQ as notebook Q&A ── */}
        <section className="nb-section nb-faq" aria-labelledby="faq-title">
          <h2 id="faq-title" className="nb-h2">{t('faqTitle')}</h2>
          <div className="faq-list">
            {faq.map((item, i) => (
              <details key={i} className="faq-item">
                <summary className="faq-q">
                  <span className="faq-q-mark" aria-hidden>Q.</span>
                  <span className="faq-q-text">{item.q}</span>
                  <span className="faq-toggle" aria-hidden />
                </summary>
                <p className="faq-a"><span className="faq-a-mark" aria-hidden>A.</span>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {showGuestCtas && (
          <p className="nb-signin-note">
            {t('signInSaveHint')}{' '}
            <button type="button" className="flow-link-btn" onClick={signIn}>{t('signIn')}</button>
          </p>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="nb-footer">
        <div className="nb-footer-grid">
          <div className="nb-footer-brand">
            <Logo size={40} />
            <p>{t('footerTagline')}</p>
          </div>
          <nav className="nb-footer-col" aria-label={t('countries')}>
            <h2 className="nb-footer-title">{t('countries')}</h2>
            {countries.filter(c => !c.comingSoon).map(c => (
              <a key={c.id} href={`/country/${c.id}`}>{localizeCountry(c, lang).name}</a>
            ))}
          </nav>
          <nav className="nb-footer-col" aria-label={t('footerAbout')}>
            <h2 className="nb-footer-title">{t('footerAbout')}</h2>
            <a href="/blog">{t('footerBlog')}</a>
            <a href="/contact">{t('footerContact')}</a>
            <a href="/privacy">{t('footerPrivacy')}</a>
            <a href="/terms">{t('footerTerms')}</a>
            <CookieSettingsLink className="nb-footer-btn" />
          </nav>
          <nav className="nb-footer-col" aria-label={t('footerAlso')}>
            <h2 className="nb-footer-title">{t('footerAlso')}</h2>
            <a href="/benches"><Armchair size={16} strokeWidth={1.75} aria-hidden /> {t('footerBenches')}</a>
            <a href="/fountains"><Droplet size={16} strokeWidth={1.75} aria-hidden /> {t('footerFountains')}</a>
          </nav>
        </div>
        <p className="nb-footer-copy">{t('footerCopy')}</p>
      </footer>

      {/* ── Sticky mobile CTA ── */}
      {mounted && (
        <nav className="sticky-cta" aria-label={t('quickActionsAria')}>
          <a href={startHref} className="btn-primary sticky-cta-primary">
            {t('stickyCtaPrimary')}
            <ArrowRight size={18} strokeWidth={2} aria-hidden />
          </a>
          <a href="/multiplayer" className="btn-secondary sticky-cta-secondary" aria-label={t('playWithFriends')}>
            <Users size={20} strokeWidth={1.75} aria-hidden />
          </a>
        </nav>
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
    </div>
  )
}
