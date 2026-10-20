'use client'
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useI18n } from '@/hooks/useI18n'
import { apiGet } from '@/lib/apiFetch'
import { fmt } from '@/lib/i18n/fmt'
import { CITY_UNLOCK_PRICE_EUROS, City, Country, localizeCity, localizeCountry } from '@/types'
import { ResumeRaceBanner } from '@/components/ResumeRaceBanner'

function CityCard({ city, isUnlocked, t }: { city: City; isUnlocked: boolean; t: (key: string) => string }) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgFailed, setImgFailed] = useState(false)
  const showImage = city.imageUrl && !imgFailed
  return (
    <a href={`/city/${city.id}`} className={`city-card flow-card-link ${isUnlocked ? 'is-unlocked' : ''}`}>
      <div className="city-cover" aria-hidden>
        {showImage ? (
          <>
            <img
              src={city.imageUrl}
              alt=""
              className={`city-cover-img ${imgLoaded ? 'loaded' : ''}`}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgFailed(true)}
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
          <div className="city-arrow" aria-hidden>→</div>
        </div>
        <p className="city-desc">{city.description}</p>
        <div className="city-foot">
          <span className="city-foot-pill">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
            {city.huntCount} {t('hunts')}
          </span>
          {!isUnlocked && (
            <span className="city-foot-price">€{city.priceEuros ?? CITY_UNLOCK_PRICE_EUROS}</span>
          )}
        </div>
      </div>
    </a>
  )
}

export function CountryClient({ country: rawCountry }: { country: Country }) {
  const { user } = useAuth()
  const { lang, t } = useI18n()

  const country = localizeCountry(rawCountry, lang)
  const [cities, setCities] = useState<City[]>([])
  const [citiesState, setCitiesState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set())

  const loadCities = useCallback(() => {
    setCitiesState('loading')
    apiGet<City[]>(`/api/cities?countryId=${encodeURIComponent(rawCountry.id)}`)
      .then(cs => { setCities(Array.isArray(cs) ? cs : []); setCitiesState('ready') })
      .catch(() => setCitiesState('error'))
  }, [rawCountry.id])

  useEffect(() => { loadCities() }, [loadCities])

  useEffect(() => {
    if (!user) { setUnlocked(new Set()); return }
    apiGet<string[]>('/api/city-unlocks')
      .then(ids => setUnlocked(new Set(Array.isArray(ids) ? ids : [])))
      .catch(() => {})
  }, [user])

  const heroBg = country.imageUrl ? `url(${country.imageUrl})` : undefined

  return (
    <main className="page-center">
      <div className="container flow-pb-48">
        <a href="/#countries" className="back-link flow-back-top">{t('backToCountries')}</a>

        {/* Country hero */}
        <section
          className="country-hero"
          style={{ backgroundImage: heroBg }}
        >
          <div className="country-hero-overlay" />
          <div className="country-hero-content">
            <span className="country-hero-flag" aria-hidden>{rawCountry.flag}</span>
            <h1 className="country-hero-title">{country.name}</h1>
            {country.tagline && <p className="country-hero-tagline">{country.tagline}</p>}
            <p className="country-hero-desc">{country.description}</p>
            <div className="country-hero-stats" role="list">
              <span role="listitem">
                <strong>{country.cityCount}</strong> {t('cityWord')}
              </span>
              <span role="listitem">
                <strong>{country.huntCount}</strong> {t('hunts')}
              </span>
            </div>
          </div>
        </section>

        <ResumeRaceBanner />

        {/* Multiplayer CTA */}
        <a href="/multiplayer" className="mp-home-cta flow-mp-cta">
          <div className="mp-home-cta-icon" aria-hidden>👥</div>
          <div className="mp-home-cta-body">
            <div className="mp-home-cta-title">{t('playWithFriends')}</div>
            <div className="mp-home-cta-desc">{t('shareRoomCode')}</div>
          </div>
          <div className="mp-home-cta-arrow" aria-hidden>→</div>
        </a>

        {/* Cities */}
        <h2 className="section-label">
          {fmt(t('citiesIn'), { country: country.name })}
        </h2>

        {citiesState === 'loading' && (
          <div className="skel-grid" aria-busy="true">
            <span className="flow-sr-only" role="status">{t('loading')}</span>
            <span className="skel skel-card" />
            <span className="skel skel-card" />
          </div>
        )}

        {citiesState === 'error' && (
          <div className="empty-card" role="alert">
            <p>{t('loadError')}</p>
            <button type="button" className="btn-primary flow-retry" onClick={loadCities}>{t('retry')}</button>
          </div>
        )}

        {citiesState === 'ready' && cities.length === 0 && (
          <div className="empty-card">
            <p>{rawCountry.comingSoon ? t('comingSoon') : t('noCitiesYet')}</p>
          </div>
        )}

        <div className="city-grid">
          {cities.map((rawCity) => {
            const city = localizeCity(rawCity, lang)
            const isUnlocked = unlocked.has(city.id)
            return <CityCard key={city.id} city={city} isUnlocked={isUnlocked} t={t} />
          })}
        </div>
      </div>
    </main>
  )
}
