'use client'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { onSnapshot, collection, doc, query, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/components/AuthProvider'
import { useI18n } from '@/hooks/useI18n'
import { normalizeCode, ROOM_CODE_LEN } from '@/lib/rooms'
import { setActiveLobby, clearActiveLobby } from '@/lib/activeRoom'
import { MultiplayerResults } from '@/components/MultiplayerResults'

type Player = {
  userId: string
  displayName: string
  photoURL: string | null
  isHost: boolean
  score: number
  cluesDone: number
  finishedAt: number | null
  sessionId: string | null
  currentClueId?: string | null
}

type RoomDoc = {
  code: string
  hostUserId: string
  huntId: string
  huntTitle: string
  state: 'lobby' | 'racing' | 'finished'
  startedAt: any
  finishedAt: any
}

export default function RoomLobbyPage() {
  const params = useParams<{ code: string }>()
  const router = useRouter()
  const { user, loading, signIn } = useAuth()
  const { t } = useI18n()

  const code = useMemo(() => normalizeCode((params?.code as string) || ''), [params])
  const [roomId, setRoomId] = useState<string | null>(null)
  const [room, setRoom] = useState<RoomDoc | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [autoJoined, setAutoJoined] = useState(false)

  // Resolve code -> roomId, and ensure user is a member.
  useEffect(() => {
    if (loading || !user || code.length !== ROOM_CODE_LEN) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/rooms/get?code=${code}`)
        const data = await res.json()
        if (!res.ok) {
          if (!cancelled) setError(data.error || 'not_found')
          return
        }
        if (cancelled) return
        setRoomId(data.roomId)
        const isMember = (data.players as Player[]).some(p => p.userId === user.uid)

        // If they're already a member and the race has started, jump straight to their session.
        if (isMember && data.state === 'racing') {
          const me = (data.players as Player[]).find(p => p.userId === user.uid)
          if (me?.sessionId) {
            router.replace(`/hunt?session=${me.sessionId}`)
            return
          }
        }

        if (!isMember && !autoJoined) {
          // Try to join (might 409 if race already started).
          setAutoJoined(true)
          const joinRes = await fetch('/api/rooms/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code,
              userId: user.uid,
              displayName: user.displayName || 'Player',
              photoURL: user.photoURL || null,
            }),
          })
          if (!joinRes.ok) {
            const j = await joinRes.json()
            if (!cancelled) setError(j.error || 'join_failed')
            return
          }
          // Successfully joined — persist lobby reference for resume.
          if (!cancelled) {
            setActiveLobby({
              code,
              roomId: data.roomId,
              huntTitle: data.huntTitle,
              joinedAt: Date.now(),
            })
          }
        } else if (isMember) {
          // Existing member — refresh activeLobby so the resume banner stays accurate.
          setActiveLobby({
            code,
            roomId: data.roomId,
            huntTitle: data.huntTitle,
            joinedAt: Date.now(),
          })
        }
      } catch {
        if (!cancelled) setError('not_found')
      }
    })()
    return () => { cancelled = true }
  }, [code, user, loading, autoJoined, router])

  // Live listeners for room + players.
  useEffect(() => {
    if (!roomId) return
    const unsubRoom = onSnapshot(doc(db, 'rooms', roomId), snap => {
      if (snap.exists()) setRoom(snap.data() as RoomDoc)
    })
    const unsubPlayers = onSnapshot(
      query(collection(db, 'rooms', roomId, 'players'), orderBy('joinedAt')),
      snap => {
        setPlayers(snap.docs.map(d => {
          const p = d.data()
          return {
            userId: p.userId,
            displayName: p.displayName || 'Player',
            photoURL: p.photoURL ?? null,
            isHost: !!p.isHost,
            score: p.score ?? 0,
            cluesDone: p.cluesDone ?? 0,
            finishedAt: p.finishedAt?.toMillis?.() ?? null,
            sessionId: p.sessionId ?? null,
            currentClueId: p.currentClueId ?? null,
          }
        }))
      }
    )
    return () => { unsubRoom(); unsubPlayers() }
  }, [roomId])

  // When the room transitions to racing, jump to the player's session.
  // The lobby is replaced by the active session — once race begins, the lobby UI is
  // not what the user wants to see.
  useEffect(() => {
    if (!user || !room || !roomId) return
    if (room.state !== 'racing') return
    const me = players.find(p => p.userId === user.uid)
    if (me?.sessionId) {
      // Lobby is over — clear stale localStorage so the resume banner uses the live race.
      clearActiveLobby()
      router.replace(`/hunt?session=${me.sessionId}`)
    }
  }, [room, players, user, roomId, router])

  // When the race finishes, clear the lobby reference (the result page is the next stop).
  useEffect(() => {
    if (room?.state === 'finished') clearActiveLobby()
  }, [room?.state])

  const isHost = !!user && !!room && user.uid === room.hostUserId
  const canStart = isHost && room?.state === 'lobby' && players.length >= 1

  const onStart = async () => {
    if (!user || !roomId) return
    setStarting(true)
    try {
      const res = await fetch('/api/rooms/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, userId: user.uid }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'start_failed')
        return
      }
      // Optimistic navigation — listener would catch up but we have hostSessionId.
      if (data.hostSessionId) {
        clearActiveLobby()
        router.replace(`/hunt?session=${data.hostSessionId}`)
      }
    } finally {
      setStarting(false)
    }
  }

  const onLeave = async () => {
    if (!user || !roomId) return
    try {
      await fetch('/api/rooms/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, userId: user.uid }),
      })
    } finally {
      clearActiveLobby()
      router.replace('/multiplayer')
    }
  }

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  const onShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try {
        await (navigator as any).share({ title: 'Join my UTR hunt', text: `Join my hunt — code ${code}`, url })
      } catch {}
    } else {
      onCopy()
    }
  }

  if (loading) {
    return <main className="page-center"><div className="spinner" /></main>
  }
  if (!user) {
    return (
      <main className="page-center">
        <div className="container" style={{ maxWidth: 480, padding: '32px 20px' }}>
          <h1 className="mp-title">{t('joinRoom')}</h1>
          <p className="mp-sub">{t('signInToPlayMp')}</p>
          <button onClick={signIn} className="cta-primary-btn" style={{ marginTop: 20 }}>
            {t('signInGoogle')}
          </button>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="page-center">
        <div className="container" style={{ maxWidth: 480, padding: '32px 20px' }}>
          <a href="/multiplayer" className="back-link">{t('backToHunts')}</a>
          <h1 className="mp-title">{t('joinRoom')}</h1>
          <div className="mp-error">
            {error === 'invalid_code' || error === 'not_found' ? t('invalidRoomCode')
             : error === 'room_full' ? t('roomFull')
             : error === 'race_started' ? t('raceStarted')
             : t('invalidRoomCode')}
          </div>
          <a href="/multiplayer" className="mp-cta-secondary" style={{ marginTop: 16, display: 'inline-block' }}>
            {t('createRoom')}
          </a>
        </div>
      </main>
    )
  }

  // Finished state — show enhanced race results.
  if (room?.state === 'finished' && roomId) {
    return (
      <main className="page-center">
        <div className="container" style={{ maxWidth: 800, padding: '20px 20px 48px' }}>
          <a href="/" className="back-link">{t('backToHunts')}</a>
          <div className="mp-room-header">
            <div className="mp-room-badge">{t('raceFinished')}</div>
            <div className="mp-room-hunt">{room.huntTitle}</div>
          </div>
          <MultiplayerResults roomId={roomId} />
        </div>
      </main>
    )
  }

  return (
    <main className="page-center">
      <div className="container" style={{ maxWidth: 560, padding: '20px 20px 48px' }}>
        <a href="/multiplayer" className="back-link">{t('backToHunts')}</a>

        <div className="mp-room-header">
          <div className="mp-room-badge">{t('inRoomBadge')}</div>
          <div className="mp-room-hunt">{room?.huntTitle ?? '…'}</div>

          <div className="mp-code-display">
            <div className="mp-code-label">{t('roomCode')}</div>
            <div className="mp-code-value" onClick={onCopy} role="button" tabIndex={0}>
              {code}
            </div>
            <div className="mp-code-actions">
              <button className="mp-cta-secondary" onClick={onCopy}>
                {copied ? t('copied') : t('copyCode')}
              </button>
              <button className="mp-cta-secondary" onClick={onShare}>
                {t('share')}
              </button>
            </div>
          </div>
        </div>

        <section className="mp-card">
          <h2 className="mp-card-title">
            {t('players')} <span className="mp-count">({players.length})</span>
          </h2>
          <ul className="mp-player-list">
            {players.map(p => {
              const isMe = !!user && p.userId === user.uid
              return (
                <li key={p.userId} className="mp-player-row">
                  <div className="mp-player-avatar">
                    {p.photoURL
                      ? <img src={p.photoURL} alt="" referrerPolicy="no-referrer" />
                      : <span>{p.displayName?.[0]?.toUpperCase() || '?'}</span>}
                  </div>
                  <div className="mp-player-name">
                    {p.displayName}
                    {isMe && <span className="mp-tag">{t('you')}</span>}
                    {p.isHost && <span className="mp-tag mp-tag-host">{t('host')}</span>}
                  </div>
                  {room?.state === 'racing' && (
                    <div className="mp-player-progress">
                      {p.cluesDone} {t('stopsCompleted')} · {p.score} {t('points')}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>

        {room?.state === 'lobby' && (
          isHost ? (
            <button
              className="mp-cta mp-cta-large"
              onClick={onStart}
              disabled={!canStart || starting}
            >
              {starting ? '…' : t('startRace')}
            </button>
          ) : (
            <div className="mp-waiting">{t('waitingForHost')}</div>
          )
        )}

        {room?.state === 'racing' && (() => {
          const me = players.find(p => p.userId === user?.uid)
          if (me?.sessionId) {
            return (
              <a href={`/hunt?session=${me.sessionId}`} className="mp-cta mp-cta-large" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
                {t('goToHunt')} →
              </a>
            )
          }
          return <div className="mp-waiting">{t('raceStarted')}</div>
        })()}

        <button className="mp-cta-secondary mp-leave" onClick={onLeave}>
          {t('leaveRoom')}
        </button>
      </div>
    </main>
  )
}
