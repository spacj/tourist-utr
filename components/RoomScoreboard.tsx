'use client'
import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot, query, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/components/AuthProvider'
import { useI18n } from '@/hooks/useI18n'

interface Props {
  roomId: string
  totalClues: number
  huntId: string
}

type Player = {
  userId: string
  displayName: string
  photoURL: string | null
  score: number
  cluesDone: number
  finishedAt: number | null
  currentClueId?: string | null
}

type ClueInfo = {
  id: string
  order: number
  locationName: string
  icon: string
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function RoomScoreboard({ roomId, totalClues, huntId }: Props) {
  const { user } = useAuth()
  const { t } = useI18n()
  const [players, setPlayers] = useState<Player[]>([])
  const [roomCode, setRoomCode] = useState<string | null>(null)
  const [roomStartedAt, setRoomStartedAt] = useState<number | null>(null)
  const [clues, setClues] = useState<ClueInfo[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'rooms', roomId, 'players'), orderBy('joinedAt')),
      snap => {
        setPlayers(snap.docs.map(d => {
          const p = d.data()
          return {
            userId: p.userId,
            displayName: p.displayName || 'Player',
            photoURL: p.photoURL ?? null,
            score: p.score ?? 0,
            cluesDone: p.cluesDone ?? 0,
            finishedAt: p.finishedAt?.toMillis?.() ?? null,
            currentClueId: p.currentClueId ?? null,
          }
        }))
      }
    )
    const unsubRoom = onSnapshot(doc(db, 'rooms', roomId), s => {
      if (s.exists()) {
        const d = s.data()
        setRoomCode(d.code ?? null)
        setRoomStartedAt(d.startedAt?.toMillis?.() ?? null)
      }
    })
    return () => { unsub(); unsubRoom() }
  }, [roomId])

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'hunts', huntId, 'clues'), orderBy('order')),
      snap => {
        setClues(snap.docs.map(d => ({
          id: d.id,
          order: d.data().order,
          locationName: d.data().locationName,
          icon: d.data().icon ?? '📍',
        })))
      }
    )
    return () => unsub()
  }, [huntId])

  const sorted = [...players].sort((a, b) => {
    if (a.finishedAt && b.finishedAt) return a.finishedAt - b.finishedAt
    if (a.finishedAt) return -1
    if (b.finishedAt) return 1
    if (b.cluesDone !== a.cluesDone) return b.cluesDone - a.cluesDone
    return b.score - a.score
  })

  const myRank = user ? sorted.findIndex(p => p.userId === user.uid) + 1 : 0
  const me = user ? sorted.find(p => p.userId === user.uid) : null
  const ahead = me ? sorted.filter(p => p !== me && (p.cluesDone > me.cluesDone || (p.cluesDone === me.cluesDone && p.score > me.score))) : []
  const leader = sorted[0]
  const isRacing = roomStartedAt !== null && !players.every(p => p.finishedAt)

  if (players.length <= 1) return null

  const clueMap = new Map(clues.map(c => [c.id, c]))

  return (
    <>
      <button
        type="button"
        className={`mp-scoreboard-fab ${open ? 'open' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label={t('liveScoreboard')}
      >
        <span className="mp-scoreboard-fab-rank">#{myRank || '–'}</span>
        <span className="mp-scoreboard-fab-label">/{players.length}</span>
      </button>

      {open && (
        <div className="mp-scoreboard-panel">
          <div className="mp-scoreboard-header">
            <span>{t('liveScoreboard')}</span>
            <button className="mp-scoreboard-close" onClick={() => setOpen(false)} aria-label="close">×</button>
          </div>
          <ul className="mp-scoreboard-list">
            {sorted.map((p, i) => {
              const isMe = !!user && p.userId === user.uid
              const pct = totalClues ? Math.min(100, Math.round((p.cluesDone / totalClues) * 100)) : 0
              const currentClue = p.currentClueId ? clueMap.get(p.currentClueId) : null
              const elapsed = p.finishedAt && roomStartedAt ? p.finishedAt - roomStartedAt : null
              const behindMs = leader?.finishedAt && p.finishedAt ? p.finishedAt - leader.finishedAt : null

              return (
                <li key={p.userId} className={`mp-scoreboard-row ${isMe ? 'is-me' : ''} ${p.finishedAt ? 'is-done' : ''}`}>
                  <span className="mp-scoreboard-rank">
                    {i === 0 && p.finishedAt ? '🥇' : i === 1 && p.finishedAt ? '🥈' : i === 2 && p.finishedAt ? '🥉' : i + 1}
                  </span>
                  <div className="mp-scoreboard-name">
                    {p.photoURL && (
                      <img src={p.photoURL} alt="" className="mp-scoreboard-avatar-img" referrerPolicy="no-referrer" />
                    )}
                    <div className="mp-scoreboard-name-text">
                      {p.displayName}
                      {isMe && <span className="mp-tag">{t('you')}</span>}
                    </div>
                  </div>
                  <div className="mp-scoreboard-meta">
                    {currentClue && !p.finishedAt && (
                      <div className="mp-scoreboard-location">
                        {currentClue.icon} {currentClue.locationName}
                      </div>
                    )}
                    {p.finishedAt && elapsed && (
                      <div className="mp-scoreboard-finish-time">
                        ✓ {formatTime(elapsed)}
                        {behindMs && behindMs > 0 && (
                          <span className="mp-scoreboard-behind">+{formatTime(behindMs)}</span>
                        )}
                      </div>
                    )}
                    <div className="mp-scoreboard-progress">
                      <div className="mp-scoreboard-progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="mp-scoreboard-numbers">
                      {p.cluesDone}/{totalClues} · {p.score}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
          {isRacing && ahead.length > 0 && (
            <div className="mp-scoreboard-foot">
              {ahead.length} {t('players')} {t('mpBehindLeader')}
            </div>
          )}
          {roomCode && (
            <a href={`/multiplayer/${roomCode}`} className="mp-scoreboard-lobby-link">
              {t('openLobby')} · {roomCode}
            </a>
          )}
          {isRacing && me && !me.finishedAt && user && (
            <button
              type="button"
              className="mp-scoreboard-abandon"
              onClick={async () => {
                if (!confirm(t('abandonConfirm'))) return
                await fetch('/api/rooms/abandon', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ roomId, userId: user.uid }),
                })
                window.location.href = `/multiplayer/${roomCode}`
              }}
            >
              {t('abandonRace')}
            </button>
          )}
        </div>
      )}
    </>
  )
}
