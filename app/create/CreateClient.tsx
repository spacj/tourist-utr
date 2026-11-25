'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useI18n } from '@/hooks/useI18n'
import { apiGet, apiPost, ApiError } from '@/lib/apiFetch'
import { CREATOR_COUNTRIES } from '@/lib/creatorProfile'
import type { CreatorProfile } from '@/types'

const countryName = (code: string, lang: string) => {
  try {
    return new Intl.DisplayNames([lang], { type: 'region' }).of(code.toUpperCase()) ?? code.toUpperCase()
  } catch {
    return code.toUpperCase()
  }
}

/** /create — pitch for creators plus the "become a creator" profile form. */
export function CreateClient() {
  const { user, loading, signIn } = useAuth()
  const { t, lang } = useI18n()
  const registered = !!user && !user.isAnonymous
  const [creator, setCreator] = useState<CreatorProfile | null | undefined>(undefined)
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [country, setCountry] = useState('nl')
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!registered) return
    apiGet<{ creator: CreatorProfile | null }>('/api/creator/profile')
      .then(({ creator: c }) => {
        setCreator(c)
        if (c) {
          setDisplayName(c.displayName)
          setBio(c.bio)
          if (c.country) setCountry(c.country)
        } else if (user?.displayName) {
          setDisplayName(user.displayName)
        }
      })
      .catch(() => setCreator(null))
  }, [registered, user?.displayName])

  const countries = [...CREATOR_COUNTRIES]
    .map(code => ({ code, name: countryName(code, lang) }))
    .sort((a, b) => a.name.localeCompare(b.name, lang))

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (displayName.trim().length < 2) return setError(t('creatorErrName'))
    if (!creator && !acceptTerms) return setError(t('creatorErrTerms'))
    setState('saving')
    try {
      const res = await apiPost<{ creator: CreatorProfile }>('/api/creator/profile', {
        displayName, bio, country, acceptTerms: creator ? true : acceptTerms,
      })
      setCreator(res.creator)
      setState('saved')
    } catch (err) {
      setState('idle')
      const code = err instanceof ApiError ? err.code : ''
      setError(code === 'invalid_displayName' ? t('creatorErrName')
        : code === 'creator_terms_required' ? t('creatorErrTerms')
        : t('creatorErrGeneric'))
    }
  }

  return (
    <main className="page-center">
      <div className="container bench-add creator-page">
        <h1 className="bench-add-title">{t('creatorPageTitle')}</h1>
        <p className="bench-add-sub">{t('creatorPageSub')}</p>

        <ol className="creator-steps">
          {([1, 2, 3] as const).map(n => (
            <li key={n} className="creator-step">
              <span className="creator-step-n" aria-hidden>{n}</span>
              <div>
                <h2 className="creator-step-title">{t(`creatorStep${n}Title`)}</h2>
                <p className="creator-step-text">{t(`creatorStep${n}Text`)}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="creator-note">{t('creatorEarnNote')}</p>

        {loading || (registered && creator === undefined) ? (
          <div className="spinner" role="status" aria-label={t('loading')} />
        ) : !registered ? (
          <div className="empty-card">
            <p>{t('creatorSignInHint')}</p>
            <button type="button" className="btn-primary" onClick={signIn}>{t('signIn')}</button>
          </div>
        ) : (
          <form className="creator-form" onSubmit={save} noValidate>
            <h2 className="creator-form-title">{t('creatorFormTitle')}</h2>

            <label className="bench-add-label" htmlFor="creator-name">{t('creatorFieldName')}</label>
            <input
              id="creator-name" className="bench-add-input" maxLength={60} required
              value={displayName} onChange={e => setDisplayName(e.target.value)}
              aria-describedby="creator-name-hint"
            />
            <p id="creator-name-hint" className="creator-hint">{t('creatorFieldNameHint')}</p>

            <label className="bench-add-label" htmlFor="creator-bio">{t('creatorFieldBio')}</label>
            <textarea
              id="creator-bio" className="bench-add-textarea" rows={4} maxLength={600}
              value={bio} onChange={e => setBio(e.target.value)}
            />

            <label className="bench-add-label" htmlFor="creator-country">{t('creatorFieldCountry')}</label>
            <select
              id="creator-country" className="bench-add-input"
              value={country} onChange={e => setCountry(e.target.value)}
              disabled={!!creator?.stripeAccountId}
            >
              {countries.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>

            {!creator && (
              <label className="creator-check">
                <input type="checkbox" checked={acceptTerms} onChange={e => setAcceptTerms(e.target.checked)} />
                <span>
                  {t('creatorAcceptTerms')} ·{' '}
                  <a href="/creator-terms" target="_blank" rel="noopener">{t('creatorReadTerms')}</a>
                </span>
              </label>
            )}

            {error && <p className="creator-error" role="alert">{error}</p>}

            <div className="creator-actions">
              <button type="submit" className="btn-primary" disabled={state === 'saving'}>
                {creator ? t('creatorSave') : t('creatorBecome')}
              </button>
              {creator && <a href="/studio" className="btn-secondary">{t('creatorGoStudio')}</a>}
              {state === 'saved' && <span className="creator-saved" role="status">{t('creatorSaved')}</span>}
            </div>
          </form>
        )}
      </div>
    </main>
  )
}
