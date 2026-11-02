'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, Users } from 'lucide-react'
import Image from 'next/image'
import { useAuth } from '@/components/AuthProvider'
import { useI18n } from '@/hooks/useI18n'
import { apiGet } from '@/lib/apiFetch'
import { fmt } from '@/lib/i18n/fmt'
import { City, Country, CREDIT_PACKAGES, localizeCity, localizeCountry } from '@/types'
import { ResumeRaceBanner } from '@/components/ResumeRaceBanner'
import { CookieSettingsLink } from '@/components/ConsentManager'
import { Wordmark } from '@/components/Logo'
import { SampleStop } from '@/components/SampleStop'
import { Avatar } from '@/components/Avatar'
import { LanguagePicker } from '@/components/LanguagePicker'
import { LEGAL } from '@/lib/site'
import type { BlogPostMeta } from '@/lib/blog'

// Utrecht Classic, the free flagship hunt (scripts/seed-data/hunts/utrecht-classic.mjs).
// Place names stay in Dutch: they are what's on the street signs.
const CLASSIC = {
  km: 4.2,
  stops: [
    { name: 'Domtoren', type: 'puzzleTypeCipher' },
    { name: 'Pandhof', type: 'puzzleTypeRebus' },
    { name: 'Museum Speelklok', type: 'puzzleTypeCipher' },
    { name: 'Nijntje, Mariaplaats', type: 'puzzleTypeWordplay' },
    { name: 'Oudegracht', type: 'puzzleTypeAnagram' },
    { name: 'Janskerkhof', type: 'puzzleTypeCipher' },
    { name: 'Sonnenborgh', type: 'puzzleTypeWordplay' },
    { name: 'Rietveld Schröderhuis', type: 'puzzleTypeAnagram' },
  ],
}

// Wikimedia Commons pictures of real stops; credits in the footer and in
// public/images/places/credits.json.
const PHOTO = {
  hero: { src: '/images/places/utrecht-de-domtoren-rm36075-vanaf-de-oudegracht.jpg', w: 1920, h: 1375 },
  pandhof: { src: '/images/places/de-pandhof-domkerk-utrecht.jpg', w: 1920, h: 1440 },
  wharf: { src: '/images/places/zicht-op-de-oudegracht-met-de-werfkelders.jpg', w: 1920, h: 1920 },
  map: { src: '/images/places/blaeu-1652-utrecht.jpg', w: 1920, h: 1504 },
}

const CREDITS = [
  { href: 'https://commons.wikimedia.org/wiki/File:Utrecht,_de_Domtoren_(RM36075)_vanaf_de_Oudegracht_230_ongeveer_foto5_2015-11-01_08.56.jpg', label: 'Domtoren vanaf de Oudegracht', by: 'Michielverbeek', lic: 'CC BY-SA 4.0', licHref: 'https://creativecommons.org/licenses/by-sa/4.0' },
  { href: 'https://commons.wikimedia.org/wiki/File:De_Pandhof,_Domkerk,_Utrecht.jpg', label: 'De Pandhof, Domkerk', by: 'Tunegravity', lic: 'CC0', licHref: 'https://creativecommons.org/publicdomain/zero/1.0/' },
  { href: 'https://commons.wikimedia.org/wiki/File:Zicht_op_de_Oudegracht_met_de_werfkelders_-_Utrecht_-_20396515_-_RCE.jpg', label: 'Oudegracht met de werfkelders', by: 'IJsbrand Heins', lic: 'CC BY-SA 4.0', licHref: 'https://creativecommons.org/licenses/by-sa/4.0' },
  { href: 'https://commons.wikimedia.org/wiki/File:Blaeu_1652_-_Utrecht.jpg', label: 'Blaeu 1652, Utrecht', by: null, lic: 'public domain', licHref: 'https://creativecommons.org/publicdomain/mark/1.0/' },
]

const LOCALE: Record<string, string> = { en: 'en-IE', nl: 'nl-NL', de: 'de-DE', fr: 'fr-FR', it: 'it-IT', es: 'es-ES' }

/** First sentence on line one, the rest on line two (every language's headline is two sentences). */
function TwoLines({ text }: { text: string }) {
  const cut = text.indexOf('. ')
  if (cut < 0) return <>{text}</>
  return (
    <>
      <span className="th-line">{text.slice(0, cut + 1)}</span>{' '}
      <span className="th-line">{text.slice(cut + 2)}</span>
    </>
  )
}

/** One city row: the link, its hunt count and, while active, its description.
 *  On phones each row carries its own small photo instead of the sticky one. */
function CityRow({ city, active, photo, onActivate, onPhotoError, t }: {
  city: City; active: boolean; photo: boolean; onActivate: () => void; onPhotoError: () => void; t: (k: string) => string
}) {
  const count = city.huntCount === 1 ? t('cityHuntOne') : fmt(t('cityHuntMany'), { n: city.huntCount })
  return (
    <li className={`th-city ${active ? 'is-active' : ''}`} data-city={city.id}>
      <a href={`/city/${city.id}`} className="th-city-link" onMouseEnter={onActivate} onFocus={onActivate}>
        <span className="th-city-thumb" aria-hidden>
          {photo && city.imageUrl && (
            <Image src={city.imageUrl} alt="" width={128} height={128} sizes="64px" loading="lazy" onError={onPhotoError} />
          )}
        </span>
        <span className="th-city-name">{city.name}</span>
        <span className="th-city-count">{count}</span>
      </a>
      <div className="th-city-more" aria-hidden={!active}>
        <p>{city.description}</p>
        <span className="th-city-go">{t('cityGo')} <ArrowRight size={16} strokeWidth={2} aria-hidden /></span>
      </div>
    </li>
  )
}

interface HomeClientProps {
  recentPosts: BlogPostMeta[]
}

export function HomeClient({ recentPosts }: HomeClientProps) {
  const { user, loading, signIn } = useAuth()
  const { lang, t } = useI18n()
  const rootRef = useRef<HTMLDivElement>(null)
  const [countries, setCountries] = useState<Country[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [listState, setListState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [activeCity, setActiveCity] = useState<string | null>(null)
  // City covers live in Firestore; one that 404s is dropped rather than shown broken.
  const [deadPhotos, setDeadPhotos] = useState<ReadonlySet<string>>(new Set())
  const dropPhoto = (id: string) => setDeadPhotos(s => new Set(s).add(id))
  const [solved, setSolved] = useState(false)
  const [post, setPost] = useState(0)
  const [openFaq, setOpenFaq] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const load = useCallback(() => {
    setListState('loading')
    Promise.all([apiGet<Country[]>('/api/countries'), apiGet<City[]>('/api/cities')])
      .then(([cs, cy]) => {
        setCountries(Array.isArray(cs) ? cs : [])
        setCities(Array.isArray(cy) ? cy : [])
        setListState('ready')
      })
      .catch(() => setListState('error'))
  }, [])
  useEffect(() => { load() }, [load])

  const money = (cents: number) => new Intl.NumberFormat(LOCALE[lang] ?? 'en-IE', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: cents % 100 ? 2 : 0,
  }).format(cents / 100)
  const km = new Intl.NumberFormat(LOCALE[lang] ?? 'en-IE').format(CLASSIC.km)

  // Live countries in their order, each with its live cities; empty ones are "coming soon".
  const groups = countries
    .filter(c => !c.comingSoon && (c.cityCount ?? 0) > 0)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(c => ({
      country: localizeCountry(c, lang),
      cities: cities.filter(ci => (ci.countryId ?? 'nl') === c.id).map(ci => localizeCity(ci, lang)),
    }))
    .filter(g => g.cities.length > 0)
  const soon = countries.filter(c => c.comingSoon || c.cityCount === 0).map(c => localizeCountry(c, lang).name)
  const allCities = groups.flatMap(g => g.cities)
  const shownCity = allCities.find(c => c.id === activeCity) ?? allCities[0]

  // On scroll, the row nearest the middle of the screen becomes the active city.
  useEffect(() => {
    const root = rootRef.current
    if (!root || allCities.length === 0 || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) setActiveCity((e.target as HTMLElement).dataset.city ?? null)
    }, { rootMargin: '-45% 0px -45% 0px' })
    root.querySelectorAll('.th-city').forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [allCities.length])

  // Section entrances: hidden only once this script runs, so no-JS visitors see everything.
  useEffect(() => {
    const root = rootRef.current
    if (!root || typeof IntersectionObserver === 'undefined') return
    root.classList.add('is-armed')
    const io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target) }
    }, { rootMargin: '0px 0px -10% 0px' })
    root.querySelectorAll('[data-reveal]').forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [listState, recentPosts.length])

  const steps = [
    { title: t('routeFindTitle'), desc: t('routeFindDesc') },
    { title: t('routeWalkTitle'), desc: t('routeWalkDesc') },
    { title: t('routeDiscoverTitle'), desc: t('routeDiscoverDesc') },
  ]

  const faq = [1, 2, 3, 4, 5].map(n => ({ topic: t(`faqTopic${n}`), q: t(`faqQ${n}`), a: t(`faqA${n}`) }))
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(item => ({ '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } })),
  }

  const activePost = recentPosts[post]

  return (
    <div className="nb-home th" ref={rootRef}>
      <a href="#main" className="skip-link">{t('skipToContent')}</a>

      <main id="main" className="th-main" tabIndex={-1}>
        {/* ── Hero: a notebook sheet on a canal-green field ── */}
        <section className="th-hero" aria-labelledby="home-title">
          <header className="th-bar">
            <a href="/" className="th-brand" aria-label={t('homeAria')}>
              <Wordmark size={32} />
            </a>
            <nav className="th-nav" aria-label={t('navMain')}>
              <a href="#cities">{t('cities')}</a>
              <a href="#how">{t('navHow')}</a>
              <a href="#prices">{t('navPrices')}</a>
              <a href="/multiplayer">{t('playWithFriends')}</a>
            </nav>
            <div className="th-bar-end">
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
                <button type="button" onClick={signIn} className="th-signin">{t('signIn')}</button>
              )}
            </div>
          </header>

          <div className="th-sheet">
            <h1 id="home-title" className="th-h1"><TwoLines text={t('homeH1')} /></h1>
            <div className="th-hero-copy">
              <p className="th-lede">{t('homeLede')}</p>
              <div className="th-actions">
                <a href="#cities" className="th-btn th-btn-primary">
                  {t('homeCtaPick')}
                  <ArrowRight size={18} strokeWidth={2} aria-hidden />
                </a>
                <a href="/multiplayer" className="th-btn th-btn-quiet">
                  <Users size={18} strokeWidth={1.75} aria-hidden />
                  {t('playWithFriends')}
                </a>
              </div>
              <p className="th-facts">
                {t('homeFactFree')}<span aria-hidden> · </span>{t('homeFactApp')}<span aria-hidden> · </span>{t('homeFactLangs')}
              </p>
            </div>

            <div className="th-hero-play">
              <figure className={`th-plate th-plate-hero ${solved ? 'is-solved' : ''}`}>
                <div className="th-plate-img">
                  <Image src={PHOTO.hero.src} width={PHOTO.hero.w} height={PHOTO.hero.h} alt={t('heroPhotoAlt')}
                    sizes="(max-width: 900px) 92vw, 520px" priority />
                </div>
                <figcaption aria-live="polite">{solved ? t('samplePlace') : t('heroPhotoBefore')}</figcaption>
              </figure>
              <SampleStop ctaHref="#cities" onSolve={() => setSolved(true)} />
            </div>
          </div>
        </section>

        <ResumeRaceBanner />

        {/* ── How it works: the route printed as an itinerary slip ── */}
        <section id="how" className="th-how" aria-labelledby="how-title">
          <div className="th-how-text" data-reveal>
            <h2 id="how-title" className="th-h2">{t('routeTitle')}</h2>
            <p className="th-body">{t('itinIntro')}</p>
            <figure className="th-plate th-plate-small">
              <div className="th-plate-img">
                <Image src={PHOTO.pandhof.src} width={PHOTO.pandhof.w} height={PHOTO.pandhof.h} alt={t('pandhofAlt')}
                  sizes="(max-width: 900px) 92vw, 440px" loading="lazy" />
              </div>
              <figcaption>{t('pandhofCaption')}</figcaption>
            </figure>
          </div>

          <div className="th-slip" data-reveal>
            <h3 className="th-slip-head">{t('itinEveryStop')}</h3>
            <ul className="th-slip-rows">
              {steps.map(s => (
                <li key={s.title} className="th-slip-step">
                  <strong>{s.title}</strong>
                  <span>{s.desc}</span>
                </li>
              ))}
            </ul>
            <h3 className="th-slip-head">{t('itinRoute')}</h3>
            <ol className="th-slip-rows">
              {CLASSIC.stops.map(s => (
                <li key={s.name} className="th-slip-row">
                  <span>{s.name}</span>
                  <span className="th-slip-val">{t(s.type)}</span>
                </li>
              ))}
            </ol>
            <p className="th-slip-total">
              <span>{fmt(t('itinStopsKm'), { n: CLASSIC.stops.length, km })}</span>
              <span>{t('itinTime')}</span>
            </p>
          </div>
        </section>

        {/* ── Cities: a sticky photograph and the list of places ── */}
        <section id="cities" className="th-cities" aria-labelledby="cities-title">
          <div className="th-cities-photo" aria-hidden>
            {allCities.map(c => c.imageUrl && !deadPhotos.has(c.id) && (
              <Image key={c.id} src={c.imageUrl} alt="" fill sizes="40vw"
                className={c.id === shownCity?.id ? 'is-shown' : ''} loading="lazy" onError={() => dropPhoto(c.id)} />
            ))}
          </div>

          <div className="th-cities-list">
            <h2 id="cities-title" className="th-h2 flow-anchor">{t('citiesTitle')}</h2>
            <p className="th-body">{t('citiesLede')}</p>

            {listState === 'loading' && (
              <div className="th-city-skel" aria-busy="true">
                <span className="flow-sr-only" role="status">{t('loading')}</span>
                {[0, 1, 2, 3, 4].map(i => <span key={i} />)}
              </div>
            )}
            {listState === 'error' && (
              <div className="th-note" role="alert">
                <p>{t('loadError')}</p>
                <button type="button" className="th-btn th-btn-quiet" onClick={load}>{t('retry')}</button>
              </div>
            )}
            {listState === 'ready' && groups.length === 0 && (
              <div className="th-note"><p>{t('noCountriesYet')}</p></div>
            )}

            {groups.map(g => (
              <div key={g.country.id} className="th-country">
                <h3 className="th-country-name">
                  <a href={`/country/${g.country.id}`}>{g.country.name}</a>
                </h3>
                <ul className="th-city-list">
                  {g.cities.map(c => (
                    <CityRow key={c.id} city={c} t={t} photo={!deadPhotos.has(c.id)}
                      active={c.id === shownCity?.id} onActivate={() => setActiveCity(c.id)}
                      onPhotoError={() => dropPhoto(c.id)} />
                  ))}
                </ul>
              </div>
            ))}
            {listState === 'ready' && soon.length > 0 && (
              <p className="th-soon">{fmt(t('citiesNext'), { list: soon.join(', ') })}</p>
            )}
          </div>
        </section>

        {/* ── Prices, set like a menu ── */}
        <section id="prices" className="th-prices" aria-labelledby="prices-title">
          <div className="th-prices-side" data-reveal>
            <h2 id="prices-title" className="th-h2">{t('pricingTitle')}</h2>
            <figure className="th-plate th-plate-tall">
              <div className="th-plate-img">
                <Image src={PHOTO.wharf.src} width={PHOTO.wharf.w} height={PHOTO.wharf.h} alt={t('wharfAlt')}
                  sizes="(max-width: 900px) 60vw, 300px" loading="lazy" />
              </div>
              <figcaption>{t('wharfCaption')}</figcaption>
            </figure>
          </div>

          <div className="th-menu" data-reveal>
            <div className="th-menu-col">
              <h3 className="th-menu-group">{t('menuHunts')}</h3>
              <div className="th-menu-item">
                <p className="th-menu-row"><span>{t('menuFirstHunt')}</span><span>{money(0)}</span></p>
                <p className="th-menu-desc">{t('menuFirstHuntDesc')}</p>
              </div>
              <div className="th-menu-item">
                <p className="th-menu-row"><span>{t('menuNextHunt')}</span><span>{money(500)}</span></p>
                <p className="th-menu-desc">{t('menuNextHuntDesc')}</p>
              </div>

              <h3 className="th-menu-group">{t('menuTogether')}</h3>
              <div className="th-menu-item">
                <p className="th-menu-row"><span>{t('menuRace')}</span><span>{t('menuIncluded')}</span></p>
                <p className="th-menu-desc">{t('friendsDesc')}</p>
              </div>
            </div>

            <div className="th-menu-col">
              <h3 className="th-menu-group">{t('menuHints')}</h3>
              <div className="th-menu-item">
                <p className="th-menu-row"><span>{t('menuHintFree')}</span><span>{t('menuFree')}</span></p>
                <p className="th-menu-desc">{t('menuHintFreeDesc')}</p>
              </div>
              {CREDIT_PACKAGES.map((pkg, i) => (
                <div key={pkg.id} className="th-menu-item">
                  <p className="th-menu-row"><span>{fmt(t('shopPackTitle'), { n: pkg.credits })}</span><span>{money(pkg.priceCents)}</span></p>
                  {i === 0 && <p className="th-menu-desc">{t('menuPackDesc')}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── The founders' letter, on Blaeu's map of Utrecht ── */}
        <section className="th-letter" aria-labelledby="letter-title">
          <Image src={PHOTO.map.src} alt={t('mapAlt')} fill sizes="100vw" className="th-letter-map" loading="lazy" />
          <div className="th-letter-sheet" data-reveal>
            <h2 id="letter-title" className="th-h3">{t('letterTitle')}</h2>
            <p className="th-body">{t('founderBody')}</p>
            <p className="th-letter-sign">{t('founderSign')}</p>
            <p className="th-letter-strip">
              {t('letterStrip')} <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>
            </p>
          </div>
        </section>

        {/* ── From the blog: one square plate, three tabs ── */}
        {activePost && (
          <section className="th-blog" aria-labelledby="blog-title">
            <div className="th-blog-plate">
              {activePost.heroImage && (
                <Image key={activePost.slug} src={activePost.heroImage} alt={activePost.heroAlt} width={900} height={900}
                  sizes="(max-width: 900px) 92vw, 45vw" loading="lazy" />
              )}
            </div>
            <div className="th-blog-text">
              <h2 id="blog-title" className="th-h2">{t('fromTheBlog')}</h2>
              <div className="th-tabs" role="tablist" aria-label={t('blogTabsAria')}>
                {recentPosts.map((p, i) => (
                  <button key={p.slug} type="button" role="tab" id={`blog-tab-${i}`} aria-controls="blog-panel"
                    aria-selected={i === post} tabIndex={i === post ? 0 : -1} className="th-tab"
                    onClick={() => setPost(i)}
                    onKeyDown={e => {
                      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
                      const n = (post + (e.key === 'ArrowRight' ? 1 : -1) + recentPosts.length) % recentPosts.length
                      setPost(n)
                      document.getElementById(`blog-tab-${n}`)?.focus()
                    }}>
                    {p.category}
                  </button>
                ))}
              </div>
              <div id="blog-panel" role="tabpanel" aria-labelledby={`blog-tab-${post}`} className="th-blog-panel">
                <h3 className="th-h3">{activePost.title}</h3>
                <p className="th-body">{activePost.excerpt}</p>
                <p className="th-meta">{activePost.readMinutes} {t('min')}</p>
              </div>
              <div className="th-cells">
                <a href={`/blog/${activePost.slug}`} className="th-cell th-cell-ink">{t('blogRead')} <ArrowRight size={18} strokeWidth={2} aria-hidden /></a>
                <a href="/blog" className="th-cell">{t('allStories')}</a>
              </div>
            </div>
          </section>
        )}

        {/* ── Questions, filed as index cards ── */}
        <section className="th-faq" aria-labelledby="faq-title">
          <h2 id="faq-title" className="th-h2">{t('faqTitle')}</h2>
          <div className="th-cards">
            {faq.map((item, i) => {
              const open = i === openFaq
              return (
                <div key={i} className={`th-card th-card-${i % 3} ${open ? 'is-open' : ''}`} style={{ ['--i' as string]: i }}>
                  <span className="th-card-tab" aria-hidden>{item.topic}</span>
                  <h3 className="th-card-q">
                    <button type="button" aria-expanded={open} aria-controls={`faq-a-${i}`} id={`faq-q-${i}`}
                      onClick={() => setOpenFaq(open ? -1 : i)}>
                      {item.q}
                    </button>
                  </h3>
                  <div id={`faq-a-${i}`} role="region" aria-labelledby={`faq-q-${i}`} className="th-card-a" hidden={!open}>
                    <p>{item.a}</p>
                  </div>
                </div>
              )
            })}
          </div>
          {!loading && !user && (
            <p className="th-signin-note">
              {t('signInSaveHint')}{' '}
              <button type="button" className="flow-link-btn" onClick={signIn}>{t('signIn')}</button>
            </p>
          )}
        </section>
      </main>

      {/* ── Footer: the back of the notebook, uncovered as the page lifts ── */}
      <footer className="th-foot">
        <div className="th-foot-inner">
        <div className="th-foot-top">
          <div className="th-foot-invite">
            <p className="th-foot-line">{t('footerInvite')}</p>
            <a href="#cities" className="th-btn th-btn-primary">
              {t('homeCtaPick')}
              <ArrowRight size={18} strokeWidth={2} aria-hidden />
            </a>
          </div>
          <nav className="th-foot-links" aria-label={t('footerAbout')}>
            <a href="/blog">{t('footerBlog')}</a>
            <a href="/contact">{t('footerContact')}</a>
            <a href="/benches">{t('footerBenches')}</a>
            <a href="/fountains">{t('footerFountains')}</a>
          </nav>
        </div>
        <div className="th-foot-legal">
          <p className="th-credits">
            {t('footerPhotos')}, via Wikimedia Commons:{' '}
            {CREDITS.map((c, i) => (
              <span key={c.href}>
                <a href={c.href}>{c.label}</a>{c.by ? ` (${c.by}, ` : ' ('}<a href={c.licHref}>{c.lic}</a>){i < CREDITS.length - 1 ? '; ' : '.'}
              </span>
            ))}
          </p>
          <p className="th-legal-links">
            <span>{t('footerCopy')}</span>
            <a href="/privacy">{t('footerPrivacy')}</a>
            <a href="/terms">{t('footerTerms')}</a>
            <CookieSettingsLink className="th-linkbtn" />
          </p>
        </div>
        <p className="th-foot-name" aria-hidden>TourHunts</p>
        </div>
      </footer>

      {mounted && (
        <nav className="sticky-cta" aria-label={t('quickActionsAria')}>
          <a href="#cities" className="btn-primary sticky-cta-primary">
            {t('stickyCtaPrimary')}
            <ArrowRight size={18} strokeWidth={2} aria-hidden />
          </a>
          <a href="/multiplayer" className="btn-secondary sticky-cta-secondary" aria-label={t('playWithFriends')}>
            <Users size={20} strokeWidth={1.75} aria-hidden />
          </a>
        </nav>
      )}

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
    </div>
  )
}
