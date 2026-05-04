'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useI18n } from '@/hooks/useI18n'

type ClueTime = {
  clueId: string
  locationName: string
  icon: string
  order: number
  arrivedAt: number | null
  pointsEarned: number
}

type PlayerResult = {
  userId: string
  displayName: string
  photoURL: string | null
  isHost: boolean
  sessionId?: string | null
  score: number
  cluesDone: number
  finishedAt: number | null
  totalTime: number | null
  clueTimes: ClueTime[]
}

type RaceData = {
  roomId: string
  code: string
  huntId: string
  huntTitle: string
  state: string
  startedAt: number | null
  finishedAt: number | null
  clues: { id: string; order: number; locationName: string; icon: string }[]
  results: PlayerResult[]
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function localizeLocation(clueTime: ClueTime, lang: string): string {
  return clueTime.locationName
}

export function MultiplayerResults({ roomId }: { roomId: string }) {
  const { user } = useAuth()
  const { t, lang } = useI18n()
  const [data, setData] = useState<RaceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/rooms/results?roomId=${roomId}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [roomId])

  if (loading) {
    return (
      <div className="mp-results-loading">
        <div className="spinner" />
        <p>{t('mpDetailedResults')}</p>
      </div>
    )
  }

  if (!data) return null

  const meRank = user ? data.results.findIndex(p => p.userId === user.uid) + 1 : 0
  const leader = data.results.find(p => p.finishedAt)

  return (
    <div className="mp-results">
      {/* Overall standings */}
      <div className="mp-results-header">
        <h2 className="mp-results-title">{t('raceResults')}</h2>
        <p className="mp-results-subtitle">
          {data.huntTitle} · {data.results.length} {t('players')}
        </p>
      </div>

      {/* Top 3 podium */}
      {data.results.filter(p => p.finishedAt).length > 0 && (
        <div className="mp-podium">
          {data.results
            .filter(p => p.finishedAt)
            .slice(0, 3)
            .map((p, i) => (
              <div key={p.userId} className={`mp-podium-item mp-podium-${i + 1}`}>
                <div className="mp-podium-medal">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                </div>
                <div className="mp-podium-avatar">
                  {p.photoURL ? (
                    <img src={p.photoURL} alt="" referrerPolicy="no-referrer" />
                  ) : (
                    <span>{p.displayName?.[0]?.toUpperCase() || '?'}</span>
                  )}
                </div>
                <div className="mp-podium-name">
                  {p.displayName}
                  {user && p.userId === user.uid && <span className="mp-tag">{t('you')}</span>}
                </div>
                <div className="mp-podium-time">
                  {p.totalTime ? formatTime(p.totalTime) : '—'}
                </div>
                <div className="mp-podium-score">{p.score} {t('points')}</div>
              </div>
            ))}
        </div>
      )}

      {/* Full results table */}
      <div className="mp-results-table-wrap">
        <table className="mp-results-table">
          <thead>
            <tr>
              <th className="mp-th-rank">#</th>
              <th className="mp-th-name">{t('players')}</th>
              <th className="mp-th-progress">{t('mpPlayerProgress')}</th>
              <th className="mp-th-time">{t('mpRaceTime')}</th>
              <th className="mp-th-score">{t('points')}</th>
            </tr>
          </thead>
          <tbody>
            {data.results.map((p, i) => {
              const isMe = !!user && p.userId === user.uid
              const rank = i + 1
              const pct = data.clues.length ? Math.round((p.cluesDone / data.clues.length) * 100) : 0
              const behindLeader = leader?.totalTime && p.totalTime ? p.totalTime - leader.totalTime : null

              return (
                <tr key={p.userId} className={`mp-results-row ${isMe ? 'is-me' : ''} ${p.finishedAt ? 'is-done' : ''}`}>
                  <td className="mp-td-rank">
                    <span className={`mp-rank-cell ${rank <= 3 && p.finishedAt ? `mp-medal-${rank}` : ''}`}>
                      {rank <= 3 && p.finishedAt
                        ? (rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉')
                        : rank}
                    </span>
                  </td>
                  <td className="mp-td-name">
                    <div className="mp-td-avatar">
                      {p.photoURL ? (
                        <img src={p.photoURL} alt="" referrerPolicy="no-referrer" />
                      ) : (
                        <span>{p.displayName?.[0]?.toUpperCase() || '?'}</span>
                      )}
                    </div>
                    <div>
                      <div className="mp-td-display-name">
                        {p.displayName}
                        {isMe && <span className="mp-tag">{t('you')}</span>}
                      </div>
                      {!p.finishedAt && p.cluesDone > 0 && (
                        <div className="mp-td-status">
                          {t('mpCurrentClue')}: {p.clueTimes.length > 0 ? p.clueTimes[p.cluesDone - 1]?.locationName : '...'}
                        </div>
                      )}
                      {!p.finishedAt && p.cluesDone === 0 && (
                        <div className="mp-td-status">{t('mpNotStarted')}</div>
                      )}
                      {p.finishedAt && behindLeader && behindLeader > 0 && (
                        <div className="mp-td-behind">+{formatTime(behindLeader)} {t('mpBehindLeader')}</div>
                      )}
                    </div>
                  </td>
                  <td className="mp-td-progress">
                    <div className="mp-progress-bar">
                      <div className="mp-progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="mp-progress-text">{p.cluesDone}/{data.clues.length}</span>
                  </td>
                  <td className="mp-td-time">
                    {p.totalTime ? formatTime(p.totalTime) : '—'}
                  </td>
                  <td className="mp-td-score">
                    <span className="mp-score-value">{p.score}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Per-player clue breakdown (expandable) */}
      <div className="mp-breakdown-section">
        <h3 className="mp-breakdown-title">{t('mpClueTimes')}</h3>
        <div className="mp-breakdown-grid">
          {data.results.map(p => {
            const isMe = !!user && p.userId === user.uid
            const isExpanded = expandedPlayer === p.userId
            return (
              <div key={p.userId} className={`mp-breakdown-card ${isMe ? 'is-me' : ''}`}>
                <button
                  className="mp-breakdown-toggle"
                  onClick={() => setExpandedPlayer(isExpanded ? null : p.userId)}
                >
                  <div className="mp-breakdown-player">
                    <div className="mp-breakdown-avatar">
                      {p.photoURL ? (
                        <img src={p.photoURL} alt="" referrerPolicy="no-referrer" />
                      ) : (
                        <span>{p.displayName?.[0]?.toUpperCase() || '?'}</span>
                      )}
                    </div>
                    <span className="mp-breakdown-name">{p.displayName}</span>
                    {isMe && <span className="mp-tag">{t('you')}</span>}
                  </div>
                  <div className="mp-breakdown-summary">
                    <span>{p.score} pts</span>
                    <span className={`mp-chevron ${isExpanded ? 'open' : ''}`}>▾</span>
                  </div>
                </button>
                {isExpanded && (
                  <div className="mp-breakdown-detail">
                    {p.clueTimes.length === 0 && (
                      <div className="mp-breakdown-empty">{t('mpNotStarted')}</div>
                    )}
                    {p.clueTimes.map((ct, idx) => {
                      const isFirst = idx === 0
                      const prevTime = idx > 0 ? p.clueTimes[idx - 1].arrivedAt : (data.startedAt || 0)
                      const delta = ct.arrivedAt && prevTime ? ct.arrivedAt - prevTime : null
                      return (
                        <div key={ct.clueId} className={`mp-breakdown-clue ${ct.arrivedAt ? 'done' : ''}`}>
                          <span className="mp-breakdown-clue-icon">{ct.icon}</span>
                          <span className="mp-breakdown-clue-name">
                            {localizeLocation(ct, lang)}
                            {ct.arrivedAt && isFirst && <span className="mp-first-badge">{t('mpFirstArrival')}</span>}
                          </span>
                          <span className="mp-breakdown-clue-time">
                            {ct.arrivedAt && data.startedAt ? formatTime(ct.arrivedAt - data.startedAt) : '—'}
                          </span>
                          {delta && (
                            <span className="mp-breakdown-clue-delta">+{formatTime(delta)}</span>
                          )}
                          {ct.arrivedAt && (
                            <span className="mp-breakdown-clue-points">+{ct.pointsEarned}</span>
                          )}
                        </div>
                      )
                    })}
                    {p.totalTime && (
                      <div className="mp-breakdown-total">
                        <span>{t('mpTotalTime')}</span>
                        <span>{formatTime(p.totalTime)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="mp-results-actions">
        <a href={`/hunt/complete?session=${data.results.find(p => user && p.userId === user.uid)?.sessionId || ''}`} className="mp-cta-secondary" style={{ display: 'inline-block', textAlign: 'center' }}>
          {t('seeFinal')}
        </a>
        <a href="/multiplayer" className="mp-cta-secondary mp-leave" style={{ textAlign: 'center', display: 'inline-block' }}>
          {t('playAgain')}
        </a>
      </div>
    </div>
  )
}
