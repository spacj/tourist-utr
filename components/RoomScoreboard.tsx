'use client'
import { Check, X } from 'lucide-react'
import { RankMark, StopIcon } from '@/components/StopIcon'
import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot, query, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/components/AuthProvider'
import { ConfirmDialog } from '@/components/Modal'
import { useToast } from '@/components/Toast'
import { useI18n } from '@/hooks/useI18n'
import { apiPost } from '@/lib/apiFetch'
import { errorKey } from '@/lib/apiErrors'
import { fmt } from '@/lib/i18n/fmt'
import { Avatar } from '@/components/Avatar'

interface Props {
  roomId: string
  totalClues: number
  huntId: string
}

type Player = {
  /** Player docs are keyed by uid; compared to the signed-in uid only. */
  isYou: boolean
  displayName: string
  photoURL: string | null
  score: number
  cluesDone: number
  finishedAt: number | null
  currentClueId?: string | null
}

// Public stop list written to the room doc at race start (no coordinates,
// answers or location names — hunts/*/clues is server-only).
type ClueInfo = {
  id: string
  order: number
  theme: string | null
  icon: string
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function RoomScoreboard({ roomId, totalClues }: Props) {
  const { user } = useAuth()
  const { t } = useI18n()
  const toast = useToast()
  const [confirmAbandon, setConfirmAbandon] = useState(false)
  const [abandoning, setAbandoning] = useState(false)
  const uid = user?.uid ?? null
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
            isYou: !!uid && d.id === uid,
            displayName: p.displayName || t('playerFallback'),
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
        setClues(Array.isArray(d.stops) ? d.stops.map((c: any) => ({
          id: String(c.id),
          order: c.order ?? 0,
          theme: c.theme ?? null,
          icon: c.icon ?? '',
        })) : [])
      }
    })
    return () => { unsub(); unsubRoom() }
  }, [roomId, uid, t])

  const sorted = [...players].sort((a, b) => {
    if (a.finishedAt && b.finishedAt) return a.finishedAt - b.finishedAt
    if (a.finishedAt) return -1
    if (b.finishedAt) return 1
    if (b.cluesDone !== a.cluesDone) return b.cluesDone - a.cluesDone
    return b.score - a.score
  })

  const myRank = sorted.findIndex(p => p.isYou) + 1
  const me = sorted.find(p => p.isYou) ?? null
  const ahead = me ? sorted.filter(p => p !== me && (p.cluesDone > me.cluesDone || (p.cluesDone === me.cluesDone && p.score > me.score))) : []
  const leader = sorted[0]
  const isRacing = roomStartedAt !== null && !players.every(p => p.finishedAt)

  if (players.length <= 1) return null

  const clueMap = new Map(clues.map(c => [c.id, c]))

  const abandon = async () => {
    setConfirmAbandon(false)
    if (abandoning) return
    setAbandoning(true)
    try {
      await apiPost('/api/rooms/abandon', { roomId })
      window.location.href = roomCode ? `/multiplayer/${roomCode}` : '/multiplayer'
    } catch (e) {
      setAbandoning(false)
      toast.error(t(errorKey(e)))
    }
  }

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
            <button type="button" className="mp-scoreboard-close" onClick={() => setOpen(false)} aria-label={t('close')}><X size={18} strokeWidth={2} aria-hidden /></button>
          </div>
          <ul className="mp-scoreboard-list">
            {sorted.map((p, i) => {
              const isMe = p.isYou
              const pct = totalClues ? Math.min(100, Math.round((p.cluesDone / totalClues) * 100)) : 0
              const currentClue = p.currentClueId ? clueMap.get(p.currentClueId) : null
              const elapsed = p.finishedAt && roomStartedAt ? p.finishedAt - roomStartedAt : null
              const behindMs = leader?.finishedAt && p.finishedAt ? p.finishedAt - leader.finishedAt : null

              return (
                <li key={i} className={`mp-scoreboard-row ${isMe ? 'is-me' : ''} ${p.finishedAt ? 'is-done' : ''}`}>
                  <span className="mp-scoreboard-rank">
                    <RankMark rank={i + 1} label={fmt(t('rankLabel'), { n: i + 1 })} />
                  </span>
                  <div className="mp-scoreboard-name">
                    {p.photoURL && (
                      <Avatar src={p.photoURL} className="mp-scoreboard-avatar-img" size={32} />
                    )}
                    <div className="mp-scoreboard-name-text">
                      {p.displayName}
                      {isMe && <span className="mp-tag">{t('you')}</span>}
                    </div>
                  </div>
                  <div className="mp-scoreboard-meta">
                    {currentClue && !p.finishedAt && (
                      <div className="mp-scoreboard-location">
                        <StopIcon icon={currentClue.icon} size="sm" /> {currentClue.theme ?? ''}
                      </div>
                    )}
                    {p.finishedAt && elapsed && (
                      <div className="mp-scoreboard-finish-time">
                        <Check size={14} strokeWidth={2.25} aria-hidden /> {formatTime(elapsed)}
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
              {fmt(t('playersAhead'), { n: ahead.length })}
            </div>
          )}
          {roomCode && (
            <a href={`/multiplayer/${roomCode}`} className="mp-scoreboard-lobby-link">
              {t('openLobby')} · {roomCode}
            </a>
          )}
          {isRacing && me && !me.finishedAt && (
            <button
              type="button"
              className="mp-scoreboard-abandon"
              onClick={() => setConfirmAbandon(true)}
              disabled={abandoning}
            >
              {t('abandonRace')}
            </button>
          )}
        </div>
      )}
      <ConfirmDialog
        open={confirmAbandon}
        title={t('abandonRace')}
        body={t('abandonConfirm')}
        confirmLabel={t('abandonRace')}
        cancelLabel={t('keepRacing')}
        danger
        onConfirm={abandon}
        onCancel={() => setConfirmAbandon(false)}
      />
    </>
  )
}
