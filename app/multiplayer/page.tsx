'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { useI18n } from '@/hooks/useI18n'
import { Hunt, City, localizeHunt, localizeCity } from '@/types'
import { ROOM_CODE_LEN, normalizeCode } from '@/lib/rooms'

export default function MultiplayerEntryPage() {
  const router = useRouter()
  const { user, loading, signIn } = useAuth()
  const { lang, t } = useI18n()

  const [cities, setCities] = useState<City[]>([])
  const [hunts, setHunts] = useState<Hunt[]>([])
  const [unlockedCities, setUnlockedCities] = useState<Set<string>>(new Set())
  const [selectedHuntId, setSelectedHuntId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const [code, setCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/cities').then(r => r.json()).then(setCities).catch(() => {})
    fetch('/api/hunts').then(r => r.json()).then(setHunts).catch(() => {})
  }, [])

  useEffect(() => {
    if (!user) { setUnlockedCities(new Set()); return }
    fetch(`/api/city-unlocks?userId=${user.uid}`)
      .then(r => r.json())
      .then((ids: string[]) => setUnlockedCities(new Set(ids)))
      .catch(() => {})
  }, [user])

  const playableHunts = hunts.filter(h => h.active && (h.order === 0 || (h.cityId && unlockedCities.has(h.cityId))))

  const onCreate = async () => {
    if (!user || !selectedHuntId) return
    setCreating(true)
    try {
      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          huntId: selectedHuntId,
          userId: user.uid,
          displayName: user.displayName || 'Player',
          photoURL: user.photoURL || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setJoinError(data.error || 'create_failed')
        setCreating(false)
        return
      }
      router.push(`/multiplayer/${data.code}`)
    } catch {
      setCreating(false)
    }
  }

  const onJoin = async () => {
    if (!user) return
    const norm = normalizeCode(code)
    if (norm.length !== ROOM_CODE_LEN) {
      setJoinError('invalid_code')
      return
    }
    setJoining(true)
    setJoinError(null)
    try {
      const res = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: norm,
          userId: user.uid,
          displayName: user.displayName || 'Player',
          photoURL: user.photoURL || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setJoinError(data.error || 'join_failed')
        setJoining(false)
        return
      }
      router.push(`/multiplayer/${data.code}`)
    } catch {
      setJoinError('join_failed')
      setJoining(false)
    }
  }

  if (loading) {
    return <main className="page-center"><div className="spinner" /></main>
  }

  if (!user) {
    return (
      <main className="page-center">
        <div className="container" style={{ maxWidth: 480, padding: '32px 20px' }}>
          <a href="/" className="back-link">{t('backToHunts')}</a>
          <h1 className="mp-title">{t('playWithFriends')}</h1>
          <p className="mp-sub">{t('signInToPlayMp')}</p>
          <button onClick={signIn} className="cta-primary-btn" style={{ marginTop: 20 }}>
            {t('signInGoogle')}
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="page-center">
      <div className="container" style={{ maxWidth: 560, padding: '24px 20px 48px' }}>
        <a href="/" className="back-link">{t('backToHunts')}</a>
        <h1 className="mp-title">{t('playWithFriends')}</h1>

        {/* ── Join card ── */}
        <section className="mp-card">
          <h2 className="mp-card-title">{t('joinRoom')}</h2>
          <p className="mp-card-desc">{t('enterRoomCode')}</p>
          <div className="mp-code-input-row">
            <input
              type="text"
              className="mp-code-input"
              value={code}
              onChange={(e) => { setCode(normalizeCode(e.target.value)); setJoinError(null) }}
              placeholder="ABC123"
              maxLength={ROOM_CODE_LEN}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              inputMode="text"
            />
            <button
              className="mp-cta"
              onClick={onJoin}
              disabled={joining || code.length !== ROOM_CODE_LEN}
            >
              {joining ? '…' : t('joinRoom')}
            </button>
          </div>
          {joinError && (
            <div className="mp-error">
              {joinError === 'invalid_code' ? t('invalidRoomCode')
               : joinError === 'room_full' ? t('roomFull')
               : joinError === 'race_started' ? t('raceStarted')
               : t('invalidRoomCode')}
            </div>
          )}
        </section>

        {/* ── Create card ── */}
        <section className="mp-card">
          <h2 className="mp-card-title">{t('createRoom')}</h2>
          <p className="mp-card-desc">{t('shareRoomCode')}</p>
          {playableHunts.length === 0 ? (
            <div className="mp-empty">
              <p style={{ margin: 0, color: 'var(--text-secondary, #8b8aaa)' }}>
                {t('noHuntsYet')}
              </p>
              <a href="/" className="mp-cta-secondary" style={{ marginTop: 12 }}>
                {t('chooseCity')}
              </a>
            </div>
          ) : (
            <>
              <div className="mp-hunt-list">
                {playableHunts.map(rawHunt => {
                  const hunt = localizeHunt(rawHunt, lang)
                  const city = cities.find(c => c.id === hunt.cityId)
                  const cityName = city ? localizeCity(city, lang).name : hunt.city
                  const selected = selectedHuntId === hunt.id
                  return (
                    <button
                      key={hunt.id}
                      type="button"
                      className={`mp-hunt-item ${selected ? 'selected' : ''}`}
                      onClick={() => setSelectedHuntId(hunt.id)}
                    >
                      <div>
                        <div className="mp-hunt-name">{hunt.title}</div>
                        <div className="mp-hunt-meta">
                          {cityName} · {hunt.clueCount} {t('places')} · {hunt.durationMin} {t('min')}
                        </div>
                      </div>
                      <span className="mp-hunt-radio" aria-hidden>{selected ? '●' : '○'}</span>
                    </button>
                  )
                })}
              </div>
              <button
                className="mp-cta"
                onClick={onCreate}
                disabled={!selectedHuntId || creating}
                style={{ marginTop: 16, width: '100%' }}
              >
                {creating ? '…' : t('createRoom')}
              </button>
            </>
          )}
        </section>
      </div>
    </main>
  )
}
