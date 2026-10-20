'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { onSnapshot, collection, doc, query, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/components/AuthProvider'
import { useToast } from '@/components/Toast'
import { ConfirmDialog } from '@/components/Modal'
import { useI18n } from '@/hooks/useI18n'
import { useActiveRoom } from '@/hooks/useActiveRoom'
import { apiGet, apiPost } from '@/lib/apiFetch'
import { errorCode, errorKey } from '@/lib/apiErrors'
import { roomPost, roomErrorKey } from '@/lib/roomsClient'
import { fmt } from '@/lib/i18n/fmt'
import { normalizeCode, ROOM_CODE_LEN } from '@/lib/rooms'
import { MultiplayerResults } from '@/components/MultiplayerResults'
import { RoomConflictDialog, existingRoomFrom, type ExistingRoom } from '@/components/RoomConflictDialog'
import { Avatar } from '@/components/Avatar'

type Player = {
  key: string
  isYou: boolean
  displayName: string
  photoURL: string | null
  isHost: boolean
  score: number
  cluesDone: number
  finishedAt: number | null
  abandoned: boolean
}

type RoomDoc = {
  code: string
  huntId: string
  huntTitle: string
  state: 'lobby' | 'racing' | 'finished'
}

type PageError = { key: string; cityId?: string | null; huntId?: string | null }

export default function RoomLobbyPage() {
  const params = useParams<{ code: string }>()
  const router = useRouter()
  const { user, loading, signIn } = useAuth()
  const { t } = useI18n()
  const toast = useToast()
  const { active } = useActiveRoom()

  const rawCode = (params?.code as string) || ''
  const code = useMemo(() => normalizeCode(rawCode), [rawCode])
  const codeValid = code.length === ROOM_CODE_LEN && rawCode.replace(/[^A-Za-z0-9]/g, '').length === ROOM_CODE_LEN

  const [roomId, setRoomId] = useState<string | null>(null)
  const [room, setRoom] = useState<RoomDoc | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [error, setError] = useState<PageError | null>(null)
  const [conflict, setConflict] = useState<ExistingRoom | null>(null)
  const [starting, setStarting] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [confirmForfeit, setConfirmForfeit] = useState(false)
  const [copied, setCopied] = useState(false)
  // Were we already racing/finished when the page first loaded? Then the user
  // came to look at the scoreboard — never auto-redirect them to /hunt.
  const arrivedDuringActiveRace = useRef<boolean | null>(null)
  // signIn/displayName via refs so `resolve` (and the join it may trigger)
  // only re-runs when the code or the signed-in uid changes.
  const signInRef = useRef(signIn)
  signInRef.current = signIn
  const nameRef = useRef<string | null>(null)
  nameRef.current = user?.displayName ?? null
  const uid = user?.uid ?? null

  /** Resolve code → room and make sure the caller is a member (joining if needed). */
  const resolve = useCallback(async (force = false) => {
    setError(null)
    setConflict(null)
    let info: { roomId: string; state: RoomDoc['state']; isMember: boolean }
    try {
      info = await apiGet(`/api/rooms/get?code=${code}`)
    } catch (e) {
      const c = errorCode(e)
      setError({ key: c === 'network' ? 'errNetwork' : roomErrorKey(c, 0) })
      return
    }
    if (!info.isMember) {
      if (info.state !== 'lobby') { setError({ key: 'errRaceStarted' }); return }
      const r = await roomPost('/api/rooms/join', { code, displayName: nameRef.current || undefined, force })
      if (!r.ok) {
        if (r.error === 'already_in_room') {
          const existing = existingRoomFrom(r.data)
          if (existing) { setConflict(existing); return }
        }
        if (r.error === 'account_required' || r.error === 'unauthenticated') { signInRef.current(); return }
        setError({
          key: roomErrorKey(r.error, r.status),
          cityId: r.error === 'hunt_locked' ? (r.data?.cityId ?? null) : undefined,
          huntId: r.error === 'hunt_locked' ? (r.data?.huntId ?? null) : undefined,
        })
        return
      }
    }
    setRoomId(info.roomId)
  }, [code])

  useEffect(() => {
    if (loading || !uid || !codeValid) return
    resolve()
  }, [loading, uid, codeValid, resolve])

  // Live listeners for room + players.
  useEffect(() => {
    if (!roomId || !uid) return
    const unsubRoom = onSnapshot(doc(db, 'rooms', roomId), snap => {
      if (!snap.exists()) { setRoom(null); setError({ key: 'errRoomClosed' }); return }
      const d = snap.data()
      setRoom({ code: d.code, huntId: d.huntId, huntTitle: d.huntTitle, state: d.state })
    }, () => setError({ key: 'loadError' }))
    const unsubPlayers = onSnapshot(
      query(collection(db, 'rooms', roomId, 'players'), orderBy('joinedAt')),
      snap => {
        setPlayers(snap.docs.map((d, i) => {
          const p = d.data()
          return {
            key: `p${i}`,
            // Player docs are keyed by uid: this is the only uid comparison and
            // it never leaves the client.
            isYou: d.id === uid,
            displayName: p.displayName || t('playerFallback'),
            photoURL: p.photoURL ?? null,
            isHost: !!p.isHost,
            score: p.score ?? 0,
            cluesDone: p.cluesDone ?? 0,
            finishedAt: p.finishedAt?.toMillis?.() ?? null,
            abandoned: !!p.abandoned,
          }
        }))
      },
    )
    return () => { unsubRoom(); unsubPlayers() }
  }, [roomId, uid, t])

  useEffect(() => {
    if (room && arrivedDuringActiveRace.current === null) arrivedDuringActiveRace.current = room.state !== 'lobby'
  }, [room])

  // My race session comes from my private userActiveRooms pointer.
  const mySessionId = active && active.roomId === roomId ? active.sessionId : null
  const me = players.find(p => p.isYou)
  const isHost = !!me?.isHost

  // Waiting in the lobby and the host just started → go race.
  useEffect(() => {
    if (arrivedDuringActiveRace.current !== false) return
    if (room?.state === 'racing' && mySessionId) router.replace(`/hunt?session=${encodeURIComponent(mySessionId)}`)
  }, [room?.state, mySessionId, router])

  const onStart = async () => {
    if (!roomId || starting) return
    setStarting(true)
    try {
      const data = await apiPost<{ ok: boolean; hostSessionId: string | null }>('/api/rooms/start', { roomId })
      if (data.hostSessionId) { router.replace(`/hunt?session=${encodeURIComponent(data.hostSessionId)}`); return }
      setStarting(false)
    } catch (e) {
      setStarting(false)
      const c = errorCode(e)
      toast.error(t(
        c === 'not_host' ? 'errNotHost'
        : c === 'already_started' ? 'errRaceStarted'
        : c === 'no_clues' || c === 'hunt_not_found' ? 'huntUnavailable'
        : errorKey(e),
      ))
    }
  }

  const leave = async (forfeit: boolean) => {
    if (!roomId || leaving) return
    setLeaving(true)
    try {
      await apiPost(forfeit ? '/api/rooms/abandon' : '/api/rooms/leave', { roomId })
      router.replace('/multiplayer')
    } catch (e) {
      setLeaving(false)
      toast.error(t(errorKey(e)))
    }
  }

  const onLeaveClick = () => {
    if (room?.state === 'racing' && me && !me.finishedAt) setConfirmForfeit(true)
    else if (room?.state === 'racing') router.push('/multiplayer')
    else leave(false)
  }

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      toast.success(t('copied'))
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error(t('copyFailed'))
    }
  }

  const onShare = async () => {
    const url = window.location.href
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: t('shareRoomTitle'), text: fmt(t('shareRoomText'), { code }), url })
      } catch {}
    } else {
      onCopy()
    }
  }

  // ── Render ──

  if (!codeValid) {
    return (
      <main className="page-center">
        <div className="container flow-narrow">
          <h1 className="mp-title">{t('joinRoom')}</h1>
          <div className="mp-error" role="alert">{fmt(t('errCodeFormat'), { n: ROOM_CODE_LEN })}</div>
          <a href="/multiplayer" className="mp-cta-secondary flow-mt-12">{t('backToMultiplayer')}</a>
        </div>
      </main>
    )
  }

  if (loading) {
    return <main className="page-center" aria-busy="true"><div className="spinner" role="status" aria-label={t('loading')} /></main>
  }

  if (!user) {
    return (
      <main className="page-center">
        <div className="container flow-narrow">
          <h1 className="mp-title">{t('joinRoom')}</h1>
          <p className="mp-sub">{t('signInToPlayMp')}</p>
          <button type="button" onClick={signIn} className="cta-primary-btn flow-mt-20">{t('signIn')}</button>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="page-center">
        <div className="container flow-narrow">
          <a href="/multiplayer" className="back-link">{t('backToMultiplayer')}</a>
          <h1 className="mp-title">{t('joinRoom')}</h1>
          <div className="mp-error" role="alert">
            {t(error.key)}
            {error.cityId && (
              <>
                {' '}
                <a
                  href={`/city/${encodeURIComponent(error.cityId)}${error.huntId ? `?start=${encodeURIComponent(error.huntId)}` : ''}`}
                  className="flow-inline-link"
                >
                  {t('buyThisHunt')} →
                </a>
              </>
            )}
          </div>
          <div className="flow-actions-row">
            {(error.key === 'errNetwork' || error.key === 'loadError') && (
              <button type="button" className="mp-cta" onClick={() => resolve()}>{t('retry')}</button>
            )}
            <a href="/multiplayer" className="mp-cta-secondary">{t('createRoom')}</a>
          </div>
        </div>
      </main>
    )
  }

  if (conflict) {
    return (
      <main className="page-center">
        <div className="container flow-narrow">
          <a href="/multiplayer" className="back-link">{t('backToMultiplayer')}</a>
          <h1 className="mp-title">{t('joinRoom')}</h1>
          <RoomConflictDialog
            existing={conflict}
            onContinue={() => resolve(true)}
            onClose={() => router.push('/multiplayer')}
          />
        </div>
      </main>
    )
  }

  if (!roomId || !room) {
    return <main className="page-center" aria-busy="true"><div className="spinner" role="status" aria-label={t('loading')} /></main>
  }

  if (room.state === 'finished') {
    return (
      <main className="page-center">
        <div className="container flow-mp-wide">
          <a href="/" className="back-link">{t('home')}</a>
          <div className="mp-room-header">
            <div className="mp-room-badge">{t('raceFinished')}</div>
            <div className="mp-room-hunt">{room.huntTitle}</div>
          </div>
          <MultiplayerResults roomId={roomId} />
        </div>
      </main>
    )
  }

  const racing = room.state === 'racing'

  return (
    <main className="page-center">
      <div className="container flow-mp-container">
        <a href="/multiplayer" className="back-link">{t('backToMultiplayer')}</a>

        <div className="mp-room-header">
          <div className="mp-room-badge">{t('inRoomBadge')}</div>
          <h1 className="mp-room-hunt">{room.huntTitle}</h1>

          <div className="mp-code-display">
            <div className="mp-code-label" id="room-code-label">{t('roomCode')}</div>
            <button type="button" className="mp-code-value mp-code-value-btn" onClick={onCopy} aria-describedby="room-code-label" aria-label={`${t('copyCode')}: ${code.split('').join(' ')}`}>
              {code}
            </button>
            <div className="mp-code-actions">
              <button type="button" className="mp-cta-secondary" onClick={onCopy}>
                {copied ? t('copied') : t('copyCode')}
              </button>
              <button type="button" className="mp-cta-secondary" onClick={onShare}>{t('share')}</button>
            </div>
          </div>
        </div>

        <section className="mp-card" aria-labelledby="players-title">
          <h2 className="mp-card-title" id="players-title">
            {t('players')} <span className="mp-count">({players.length})</span>
          </h2>
          <ul className="mp-player-list">
            {players.map(p => (
              <li key={p.key} className="mp-player-row">
                <div className="mp-player-avatar" aria-hidden>
                  {p.photoURL
                    ? <Avatar src={p.photoURL} />
                    : <span>{p.displayName?.[0]?.toUpperCase() || '?'}</span>}
                </div>
                <div className="mp-player-name">
                  {p.displayName}
                  {p.isYou && <span className="mp-tag">{t('you')}</span>}
                  {p.isHost && <span className="mp-tag mp-tag-host">{t('host')}</span>}
                </div>
                {racing && (
                  <div className="mp-player-progress">
                    {p.abandoned ? t('playerForfeited') : `${p.cluesDone} ${t('stopsCompleted')} · ${p.score} ${t('points')}`}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>

        {room.state === 'lobby' && (
          isHost ? (
            <button type="button" className="mp-cta mp-cta-large" onClick={onStart} disabled={starting} aria-busy={starting}>
              {starting ? '…' : t('startRace')}
            </button>
          ) : (
            <div className="mp-waiting" role="status">{t('waitingForHost')}</div>
          )
        )}

        {racing && (mySessionId && !me?.finishedAt ? (
          <a href={`/hunt?session=${encodeURIComponent(mySessionId)}`} className="mp-cta mp-cta-large flow-block-cta">
            {t('goToHunt')} →
          </a>
        ) : (
          <div className="mp-waiting" role="status">{me?.finishedAt ? t('mpFinished') : t('raceStarted')}</div>
        ))}

        <button type="button" className="mp-cta-secondary mp-leave" onClick={onLeaveClick} disabled={leaving}>
          {racing && me && !me.finishedAt ? t('abandonRace') : t('leaveRoom')}
        </button>
      </div>

      <ConfirmDialog
        open={confirmForfeit}
        title={t('abandonRace')}
        body={t('abandonConfirm')}
        confirmLabel={t('abandonRace')}
        cancelLabel={t('keepRacing')}
        danger
        onConfirm={() => { setConfirmForfeit(false); leave(true) }}
        onCancel={() => setConfirmForfeit(false)}
      />
    </main>
  )
}
