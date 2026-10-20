'use client'
import { useI18n } from '@/hooks/useI18n'
import { fmt } from '@/lib/i18n/fmt'
import {
  CITY_UNLOCK_PRICE_EUROS, LANGUAGES, isHuntFree, isTour, localizeCity, localizeHunt,
  type City, type Hunt, type Lang,
} from '@/types'
import { AreaMap } from '@/components/AreaMap'

const DIFFICULTY_KEY: Record<string, string> = { easy: 'diffEasy', medium: 'diffMedium', hard: 'diffHard' }

interface Props {
  city: City
  hunt: Hunt
  isMystery: boolean
  languages: Lang[]
  /** City-level centre only (lib/cityGeo) — never a stop. */
  center: { lat: number; lng: number } | null
  siblings: Hunt[]
}

/**
 * Spoiler-free hunt landing page. Server-rendered in English (crawlable),
 * then localised on the client like the rest of the app.
 */
export function HuntLanding({ city: rawCity, hunt: rawHunt, isMystery, languages, center, siblings }: Props) {
  const { lang, t } = useI18n()
  const city = localizeCity(rawCity, lang)
  const hunt = localizeHunt(rawHunt, lang)
  const tour = isTour(rawHunt)
  const free = isHuntFree(rawHunt)
  const price = rawCity.priceEuros ?? CITY_UNLOCK_PRICE_EUROS
  const difficulty = DIFFICULTY_KEY[hunt.difficulty] ? hunt.difficulty : 'medium'
  const cityHref = `/city/${encodeURIComponent(rawCity.id)}`
  const startHref = `${cityHref}?start=${encodeURIComponent(rawHunt.id)}`
  const kindLabel = tour ? t('landingKindTour') : isMystery ? t('landingKindMystery') : t('landingKindHunt')

  const expect = tour
    ? [t('expectTour1'), t('expectTour2'), t('expectTour3')]
    : [t('expectHunt1'), ...(isMystery ? [t('expectMystery')] : []), t('expectHunt2'), t('expectHunt3'), t('expectHunt4')]

  const langLabels = languages
    .map(code => LANGUAGES.find(l => l.code === code)?.label ?? code.toUpperCase())
    .join(', ')

  return (
    <main className="page-center">
      <article className="container landing">
        <a href={cityHref} className="city-back">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          {fmt(t('landingAllInCity'), { city: city.name })}
        </a>

        <header className="landing-head">
          <span className="landing-eyebrow">{kindLabel} · {city.name}</span>
          <h1 className="landing-title">{hunt.title}</h1>
          <p className="landing-desc">{hunt.description}</p>
        </header>

        <dl className="landing-facts">
          {!tour && (
            <div>
              <dt>{t('landingDifficulty')}</dt>
              <dd><span className={`meta-pill diff-pill diff-${difficulty}`}>{t(DIFFICULTY_KEY[difficulty])}</span></dd>
            </div>
          )}
          {hunt.durationMin > 0 && (
            <div>
              <dt>{t('landingDuration')}</dt>
              <dd>{fmt(t('landingAboutMin'), { n: hunt.durationMin })}</dd>
            </div>
          )}
          {hunt.distanceKm > 0 && (
            <div>
              <dt>{t('landingDistance')}</dt>
              <dd>{hunt.distanceKm} {t('km')}</dd>
            </div>
          )}
          {hunt.clueCount > 0 && (
            <div>
              <dt>{t('landingStops')}</dt>
              <dd>{hunt.clueCount}</dd>
            </div>
          )}
          <div>
            <dt>{t('landingLanguages')}</dt>
            <dd>{langLabels}</dd>
          </div>
        </dl>

        <section className={`landing-price ${free ? 'is-free' : ''}`}>
          <p className="landing-price-main">
            {free ? t('landingFree') : fmt(t('landingInPass'), { price, city: city.name })}
          </p>
          <p className="landing-price-note">
            {free ? t('landingFreeNote') : fmt(t('landingPassNote'), { city: city.name })}
          </p>
          <a href={startHref} className="btn-primary landing-cta">
            {tour ? t('landingStartTour') : t('landingStartHunt')} <span aria-hidden>→</span>
          </a>
        </section>

        <section className="landing-section">
          <h2 className="section-label">{t('landingExpectTitle')}</h2>
          <ul className="landing-expect">
            {expect.map((line, i) => <li key={i}>{line}</li>)}
          </ul>
        </section>

        {center && (
          <section className="landing-section">
            <h2 className="section-label">{t('landingAreaTitle')}</h2>
            <AreaMap lat={center.lat} lng={center.lng} label={fmt(t('landingAreaNote'), { city: city.name })} />
            <p className="landing-map-note">{fmt(t('landingAreaNote'), { city: city.name })}</p>
          </section>
        )}

        {siblings.length > 0 && (
          <section className="landing-section">
            <h2 className="section-label">{fmt(t('landingMoreInCity'), { city: city.name })}</h2>
            <ul className="landing-siblings">
              {siblings.map(raw => {
                const h = localizeHunt(raw, lang)
                return (
                  <li key={h.id}>
                    <a href={`${cityHref}/${encodeURIComponent(h.id)}`}>
                      <span className="landing-sibling-title">{h.title}</span>
                      <span className="landing-sibling-meta">
                        {isHuntFree(raw) ? t('freeHunt') : (isTour(raw) ? t('landingKindTour') : t('landingKindHunt'))}
                        {h.durationMin > 0 ? ` · ~${h.durationMin} ${t('min')}` : ''}
                      </span>
                    </a>
                  </li>
                )
              })}
            </ul>
          </section>
        )}
      </article>
    </main>
  )
}
