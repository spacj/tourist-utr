'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { useToast } from '@/components/Toast'
import { useI18n } from '@/hooks/useI18n'
import { apiGet } from '@/lib/apiFetch'
import { roomPost, roomErrorKey } from '@/lib/roomsClient'
import { Hunt, City, isHuntFree, localizeHunt, localizeCity } from '@/types'
import { ROOM_CODE_LEN, normalizeCode } from '@/lib/rooms'
import { ResumeRaceBanner } from '@/components/ResumeRaceBanner'
import { RoomConflictDialog, existingRoomFrom, type ExistingRoom } from '@/components/RoomConflictDialog'

type RoomError = { key: string; cityId?: string | null }

export default function MultiplayerEntryPage() {
  const router = useRouter()
  const { user, loading, signIn } = useAuth()
  const { lang, t } = useI18n()
  const toast = useToast()

  const [cities, setCities] = useState<City[]>([])
  const [hunts, setHunts] = useState<Hunt[]>([])
  const [catalogState, setCatalogState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [unlockedCities, setUnlockedCities] = useState<Set<string>>(new Set())
  const [selectedHuntId, setSelectedHuntId] = useState<string | null>(null)

  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<RoomError | null>(null)
  const [code, setCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<RoomError | null>(null)
  const [conflict, setConflict] = useState<{ existing: ExistingRoom; retry: () => Promise<void> } | null>(null)

  const loadCatalog = useCallback(() => {
    setCatalogState('loading')
    Promise.all([apiGet<City[]>('/api/cities'), apiGet<Hunt[]>('/api/hunts')])
      .then(([cs, hs]) => { setCities(cs); setHunts(hs); setCatalogState('ready') })
      .catch(() => setCatalogState('error'))
  }, [])
  useEffect(() => { loadCatalog() }, [loadCatalog])

  useEffect(() => {
    if (!user) { setUnlockedCities(new Set()); return }
    apiGet<string[]>('/api/city-unlocks')
      .then(ids => setUnlockedCities(new Set(Array.isArray(ids) ? ids : [])))
      .catch(() => {})
  }, [user])

  const playableHunts = hunts.filter(h => h.active !== false && (isHuntFree(h) || (h.cityId && unlockedCities.has(h.cityId))))

  /** Shared failure handling for create + join. Returns the inline error to show, if any. */
  const handleRoomFailure = (
    r: { status: number; error: string; data: any },
    retry: () => Promise<void>,
  ): RoomError | null => {
    if (r.error === 'already_in_room') {
      const existing = existingRoomFrom(r.data)
      if (existing) { setConflict({ existing, retry }); return null }
    }
    if (r.error === 'account_required' || r.error === 'unauthenticated') {
      toast.info(t('signInToPlayMp'))
      signIn()
      return null
    }
    return { key: roomErrorKey(r.error, r.status), cityId: r.error === 'city_locked' ? (r.data?.cityId ?? null) : undefined }
  }

  const onCreate = async (force = false): Promise<void> => {
    if (!user || !selectedHuntId || creating) return
    setCreating(true)
    setCreateError(null)
    setConflict(null)
    const r = await roomPost<{ roomId: string; code: string }>('/api/rooms/create', {
      huntId: selectedHuntId,
      displayName: user.displayName || undefined,
      force,
    })
    if (r.ok) { router.push(`/multiplayer/${r.data.code}`); return }
    setCreating(false)
    setCreateError(handleRoomFailure(r, () => onCreate(true)))
  }

  const onJoin = async (force = false): Promise<void> => {
    if (!user || joining) return
    const norm = normalizeCode(code)
    if (norm.length !== ROOM_CODE_LEN) { setJoinError({ key: 'errCodeLength' }); return }
    setJoining(true)
    setJoinError(null)
    setConflict(null)
    const r = await roomPost<{ roomId: string; code: string }>('/api/rooms/join', {
      code: norm,
      displayName: user.displayName || undefined,
      force,
    })
    if (r.ok) { router.push(`/multiplayer/${r.data.code}`); return }
    setJoining(false)
    setJoinError(handleRoomFailure(r, () => onJoin(true)))
  }

  const renderError = (err: RoomError | null, id: string) => err && (
    <div className="mp-error" id={id} role="alert">
      {t(err.key)}
      {err.cityId && (
        <> <a href={`/city/${err.cityId}`} className="flow-inline-link">{t('unlockToPlay')} →</a></>
      )}
    </div>
  )

  if (loading) {
    return <main className="page-center" aria-busy="true"><div className="spinner" role="status" aria-label={t('loading')} /></main>
  }

  if (!user) {
    return (
      <main className="page-center">
        <div className="container flow-narrow">
          <a href="/" className="back-link">{t('home')}</a>
          <h1 className="mp-title">{t('playWithFriends')}</h1>
          <p className="mp-sub">{t('mpPitch')}</p>
          <ol className="mp-steps">
            <li><strong>1</strong><span>{t('mpStep1')}</span></li>
            <li><strong>2</strong><span>{t('mpStep2')}</span></li>
            <li><strong>3</strong><span>{t('mpStep3')}</span></li>
          </ol>
          <button type="button" onClick={signIn} className="cta-primary-btn flow-mt-20">{t('signIn')}</button>
          <p className="mp-sub mp-signin-note">{t('signInToPlayMp')}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="page-center">
      <div className="container flow-mp-container">
        <a href="/" className="back-link">{t('home')}</a>
        <h1 className="mp-title">{t('playWithFriends')}</h1>

        <ResumeRaceBanner />

        {/* ── Join card ── */}
        <section className="mp-card" aria-labelledby="mp-join-title">
          <h2 className="mp-card-title" id="mp-join-title">{t('joinRoom')}</h2>
          <form onSubmit={(e) => { e.preventDefault(); onJoin() }}>
            <label htmlFor="mp-code" className="mp-card-desc flow-label">{t('enterRoomCode')}</label>
            <div className="mp-code-input-row">
            <input
              id="mp-code"
              type="text"
              className="mp-code-input"
              value={code}
              onChange={(e) => { setCode(normalizeCode(e.target.value)); setJoinError(null) }}
              placeholder="ABC123"
              maxLength={ROOM_CODE_LEN}
              autoCapitalize="characters"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={!!joinError}
              aria-describedby={joinError ? 'mp-join-error' : undefined}
            />
            <button type="submit" className="mp-cta" disabled={joining || code.length !== ROOM_CODE_LEN}>
              {joining ? '…' : t('joinRoom')}
            </button>
            </div>
          </form>
          {renderError(joinError, 'mp-join-error')}
        </section>

        {/* ── Create card ── */}
        <section className="mp-card" aria-labelledby="mp-create-title">
          <h2 className="mp-card-title" id="mp-create-title">{t('createRoom')}</h2>
          <p className="mp-card-desc">{t('shareRoomCode')}</p>
          {catalogState === 'loading' ? (
            <div aria-busy="true">
              <span className="flow-sr-only" role="status">{t('loading')}</span>
              <span className="skel skel-line" />
              <span className="skel skel-line" />
              <span className="skel skel-line is-short" />
            </div>
          ) : catalogState === 'error' ? (
            <div className="mp-empty" role="alert">
              <p className="flow-error-text">{t('loadError')}</p>
              <button type="button" className="mp-cta-secondary flow-retry" onClick={loadCatalog}>{t('retry')}</button>
            </div>
          ) : playableHunts.length === 0 ? (
            <div className="mp-empty">
              <p className="flow-muted">{t('noPlayableHunts')}</p>
              <a href="/" className="mp-cta-secondary flow-mt-12">{t('chooseCity')}</a>
            </div>
          ) : (
            <>
              <div className="mp-hunt-list" role="radiogroup" aria-labelledby="mp-create-title">
                {playableHunts.map(rawHunt => {
                  const hunt = localizeHunt(rawHunt, lang)
                  const city = cities.find(c => c.id === hunt.cityId)
                  const cityName = city ? localizeCity(city, lang).name : hunt.city
                  const selected = selectedHuntId === hunt.id
                  return (
                    <button
                      key={hunt.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={`mp-hunt-item ${selected ? 'selected' : ''}`}
                      onClick={() => { setSelectedHuntId(hunt.id); setCreateError(null) }}
                    >
                      <span>
                        <span className="mp-hunt-name">{hunt.title}</span>
                        <span className="mp-hunt-meta">
                          {cityName} · {hunt.clueCount} {t('places')} · {hunt.durationMin} {t('min')}
                        </span>
                      </span>
                      <span className={`mp-hunt-radio ${selected ? 'is-on' : ''}`} aria-hidden />
                    </button>
                  )
                })}
              </div>
              <button
                type="button"
                className="mp-cta flow-full-cta"
                onClick={() => onCreate()}
                disabled={!selectedHuntId || creating}
                aria-describedby={createError ? 'mp-create-error' : undefined}
              >
                {creating ? '…' : t('createRoom')}
              </button>
              {renderError(createError, 'mp-create-error')}
            </>
          )}
        </section>
      </div>

      <RoomConflictDialog
        existing={conflict?.existing ?? null}
        onContinue={() => conflict?.retry()}
        onClose={() => setConflict(null)}
      />
    </main>
  )
}
