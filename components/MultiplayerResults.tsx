'use client'
import { ChevronDown } from 'lucide-react'
import { RankMark, StopIcon } from '@/components/StopIcon'
import { fmt } from '@/lib/i18n/fmt'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useI18n } from '@/hooks/useI18n'
import { apiGet } from '@/lib/apiFetch'
import { Avatar as AvatarImg } from '@/components/Avatar'

type ClueTime = {
  clueId: string
  locationName: string | null
  icon: string
  order: number
  arrivedAt: number | null
  pointsEarned: number
}

type PlayerResult = {
  key: string
  isYou: boolean
  displayName: string
  photoURL: string | null
  isHost: boolean
  abandoned: boolean
  score: number
  cluesDone: number
  finishedAt: number | null
  totalTime: number | null
  clueTimes: ClueTime[]
}

type RaceClue = {
  id: string
  order: number
  locationName: string | null
  theme: string | null
  icon: string
  i18n: Record<string, { locationName?: string }> | null
}

type RaceData = {
  roomId: string
  code: string
  huntId: string
  huntTitle: string
  state: string
  startedAt: number | null
  finishedAt: number | null
  mySessionId: string | null
  clues: RaceClue[]
  results: PlayerResult[]
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return h > 0
    ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    : `${m}:${s.toString().padStart(2, '0')}`
}

function Avatar({ p, className }: { p: PlayerResult; className: string }) {
  return (
    <div className={className} aria-hidden>
      {p.photoURL
        ? <AvatarImg src={p.photoURL} />
        : <span>{p.displayName?.[0]?.toUpperCase() || '?'}</span>}
    </div>
  )
}

export function MultiplayerResults({ roomId }: { roomId: string }) {
  const { t, lang } = useI18n()
  const [data, setData] = useState<RaceData | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(() => {
    setState('loading')
    apiGet<RaceData>(`/api/rooms/results?roomId=${encodeURIComponent(roomId)}`)
      .then(d => { setData(d); setState('ready') })
      .catch(() => setState('error'))
  }, [roomId])
  useEffect(() => { load() }, [load])

  const clueById = useMemo(() => new Map((data?.clues ?? []).map(c => [c.id, c])), [data])

  /** Earliest arrival per stop across all players → the "1st to arrive" badge. */
  const firstArrival = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of data?.results ?? []) {
      for (const ct of p.clueTimes) {
        if (ct.arrivedAt && (!m.has(ct.clueId) || ct.arrivedAt < m.get(ct.clueId)!)) m.set(ct.clueId, ct.arrivedAt)
      }
    }
    return m
  }, [data])

  const stopName = (clueId: string, fallback: string | null, idx: number): string => {
    const c = clueById.get(clueId)
    return (lang !== 'en' && c?.i18n?.[lang]?.locationName) || c?.locationName || fallback || c?.theme || `${t('stop')} ${idx + 1}`
  }

  if (state === 'loading') {
    return (
      <div className="mp-results-loading" aria-busy="true">
        <div className="spinner" />
        <p role="status">{t('mpDetailedResults')}</p>
      </div>
    )
  }

  if (state === 'error' || !data) {
    return (
      <div className="empty-card" role="alert">
        <p>{t('loadError')}</p>
        <button type="button" className="btn-primary flow-retry" onClick={load}>{t('retry')}</button>
      </div>
    )
  }

  const finishers = data.results.filter(p => p.finishedAt && !p.abandoned)
  const leader = finishers[0]
  const totalStops = data.clues.length

  return (
    <div className="mp-results">
      <div className="mp-results-header">
        <h2 className="mp-results-title">{t('raceResults')}</h2>
        <p className="mp-results-subtitle">{data.huntTitle} · {data.results.length} {t('players')}</p>
      </div>

      {finishers.length > 0 && (
        <div className="mp-podium">
          {finishers.slice(0, 3).map((p, i) => (
            <div key={p.key} className={`mp-podium-item mp-podium-${i + 1}`}>
              <div className="mp-podium-medal"><RankMark rank={i + 1} label={[t('mpMedalGold'), t('mpMedalSilver'), t('mpMedalBronze')][i]} /></div>
              <Avatar p={p} className="mp-podium-avatar" />
              <div className="mp-podium-name">
                {p.displayName}
                {p.isYou && <span className="mp-tag">{t('you')}</span>}
              </div>
              <div className="mp-podium-time">{p.totalTime ? formatTime(p.totalTime) : '—'}</div>
              <div className="mp-podium-score">{p.score} {t('points')}</div>
            </div>
          ))}
        </div>
      )}

      <div className="mp-results-table-wrap">
        <table className="mp-results-table">
          <thead>
            <tr>
              <th className="mp-th-rank" scope="col">#</th>
              <th className="mp-th-name" scope="col">{t('players')}</th>
              <th className="mp-th-progress" scope="col">{t('mpPlayerProgress')}</th>
              <th className="mp-th-time" scope="col">{t('mpRaceTime')}</th>
              <th className="mp-th-score" scope="col">{t('points')}</th>
            </tr>
          </thead>
          <tbody>
            {data.results.map((p, i) => {
              const rank = i + 1
              const medal = rank <= 3 && p.finishedAt && !p.abandoned
              const pct = totalStops ? Math.round((p.cluesDone / totalStops) * 100) : 0
              const behind = leader?.totalTime && p.totalTime && !p.abandoned ? p.totalTime - leader.totalTime : null
              const last = p.cluesDone > 0 ? p.clueTimes.filter(c => c.arrivedAt).slice(-1)[0] : null
              return (
                <tr key={p.key} className={`mp-results-row ${p.isYou ? 'is-me' : ''} ${p.finishedAt ? 'is-done' : ''}`}>
                  <td className="mp-td-rank">
                    <span className={`mp-rank-cell ${medal ? `mp-medal-${rank}` : ''}`}>{medal ? <RankMark rank={rank} label={fmt(t('rankLabel'), { n: rank })} /> : rank}</span>
                  </td>
                  <td className="mp-td-name">
                    <Avatar p={p} className="mp-td-avatar" />
                    <div>
                      <div className="mp-td-display-name">
                        {p.displayName}
                        {p.isYou && <span className="mp-tag">{t('you')}</span>}
                      </div>
                      {p.abandoned && <div className="mp-td-status">{t('playerForfeited')}</div>}
                      {!p.abandoned && !p.finishedAt && last && (
                        <div className="mp-td-status">{t('mpCurrentClue')}: {stopName(last.clueId, last.locationName, p.cluesDone - 1)}</div>
                      )}
                      {!p.abandoned && !p.finishedAt && p.cluesDone === 0 && (
                        <div className="mp-td-status">{t('mpNotStarted')}</div>
                      )}
                      {p.finishedAt && behind !== null && behind > 0 && (
                        <div className="mp-td-behind">+{formatTime(behind)} {t('mpBehindLeader')}</div>
                      )}
                    </div>
                  </td>
                  <td className="mp-td-progress">
                    <div className="mp-progress-bar" aria-hidden>
                      <div className="mp-progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="mp-progress-text">{p.cluesDone}/{totalStops}</span>
                  </td>
                  <td className="mp-td-time">{p.totalTime && !p.abandoned ? formatTime(p.totalTime) : '—'}</td>
                  <td className="mp-td-score"><span className="mp-score-value">{p.score}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mp-breakdown-section">
        <h3 className="mp-breakdown-title">{t('mpClueTimes')}</h3>
        <div className="mp-breakdown-grid">
          {data.results.map(p => {
            const isExpanded = expanded === p.key
            const panelId = `mp-breakdown-${p.key}`
            return (
              <div key={p.key} className={`mp-breakdown-card ${p.isYou ? 'is-me' : ''}`}>
                <button
                  type="button"
                  className="mp-breakdown-toggle"
                  onClick={() => setExpanded(isExpanded ? null : p.key)}
                  aria-expanded={isExpanded}
                  aria-controls={panelId}
                >
                  <span className="mp-breakdown-player">
                    <Avatar p={p} className="mp-breakdown-avatar" />
                    <span className="mp-breakdown-name">{p.displayName}</span>
                    {p.isYou && <span className="mp-tag">{t('you')}</span>}
                  </span>
                  <span className="mp-breakdown-summary">
                    <span>{p.score} {t('points')}</span>
                    <ChevronDown className={`mp-chevron ${isExpanded ? 'open' : ''}`} size={18} strokeWidth={2} aria-hidden />
                  </span>
                </button>
                {isExpanded && (
                  <div className="mp-breakdown-detail" id={panelId}>
                    {p.clueTimes.length === 0 && <div className="mp-breakdown-empty">{t('mpNotStarted')}</div>}
                    {p.clueTimes.map((ct, idx) => {
                      const prev = idx > 0 ? p.clueTimes[idx - 1].arrivedAt : data.startedAt
                      const delta = ct.arrivedAt && prev ? ct.arrivedAt - prev : null
                      const wasFirst = !!ct.arrivedAt && firstArrival.get(ct.clueId) === ct.arrivedAt && data.results.length > 1
                      return (
                        <div key={ct.clueId} className={`mp-breakdown-clue ${ct.arrivedAt ? 'done' : ''}`}>
                          <StopIcon icon={ct.icon} size="sm" className="mp-breakdown-clue-icon" />
                          <span className="mp-breakdown-clue-name">
                            {stopName(ct.clueId, ct.locationName, idx)}
                            {wasFirst && <span className="mp-first-badge">{t('mpFirstArrival')}</span>}
                          </span>
                          <span className="mp-breakdown-clue-time">
                            {ct.arrivedAt && data.startedAt ? formatTime(ct.arrivedAt - data.startedAt) : '—'}
                          </span>
                          {delta ? <span className="mp-breakdown-clue-delta">+{formatTime(delta)}</span> : null}
                          {ct.arrivedAt && <span className="mp-breakdown-clue-points">+{ct.pointsEarned}</span>}
                        </div>
                      )
                    })}
                    {p.totalTime && !p.abandoned ? (
                      <div className="mp-breakdown-total">
                        <span>{t('mpTotalTime')}</span>
                        <span>{formatTime(p.totalTime)}</span>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="mp-results-actions">
        {data.mySessionId && (
          <a href={`/hunt/complete?session=${encodeURIComponent(data.mySessionId)}`} className="mp-cta-secondary">
            {t('seeFinal')}
          </a>
        )}
        <a href="/multiplayer" className="mp-cta-secondary mp-leave">{t('newRace')}</a>
      </div>
    </div>
  )
}
