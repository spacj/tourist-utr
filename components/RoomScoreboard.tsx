'use client'
import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot, query, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/components/AuthProvider'
import { useI18n } from '@/hooks/useI18n'

interface Props {
  roomId: string
  totalClues: number
}

type Player = {
  userId: string
  displayName: string
  photoURL: string | null
  score: number
  cluesDone: number
  finishedAt: number | null
}

export function RoomScoreboard({ roomId, totalClues }: Props) {
  const { user } = useAuth()
  const { t } = useI18n()
  const [players, setPlayers] = useState<Player[]>([])
  const [roomCode, setRoomCode] = useState<string | null>(null)
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
          }
        }))
      }
    )
    const unsubRoom = onSnapshot(doc(db, 'rooms', roomId), s => {
      if (s.exists()) setRoomCode(s.data().code ?? null)
    })
    return () => { unsub(); unsubRoom() }
  }, [roomId])

  // Sort: finished first by completion time, then by score, then by progress.
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

  if (players.length <= 1) return null

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
              return (
                <li key={p.userId} className={`mp-scoreboard-row ${isMe ? 'is-me' : ''} ${p.finishedAt ? 'is-done' : ''}`}>
                  <span className="mp-scoreboard-rank">{i + 1}</span>
                  <div className="mp-scoreboard-name">
                    {p.displayName}
                    {isMe && <span className="mp-tag">{t('you')}</span>}
                  </div>
                  <div className="mp-scoreboard-meta">
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
          {ahead.length > 0 && (
            <div className="mp-scoreboard-foot">
              {ahead.length} {t('players')} ahead
            </div>
          )}
          {roomCode && (
            <a
              href={`/multiplayer/${roomCode}`}
              className="mp-scoreboard-lobby-link"
            >
              {t('openLobby')} · {roomCode}
            </a>
          )}
        </div>
      )}
    </>
  )
}
