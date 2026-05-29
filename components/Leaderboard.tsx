'use client'
import { useEffect, useState } from 'react'
import { useI18n } from '@/hooks/useI18n'

interface Row { rank: number; displayName: string; score: number; isYou: boolean }
interface Data { leaderboard: Row[]; yourRank: { rank: number; score: number; total: number } | null; totalPlayers: number }

/** Per-hunt leaderboard sheet. Reads /api/leaderboard (top 10 + your rank). */
export function Leaderboard({ huntId, userId, onClose }: { huntId: string; userId?: string | null; onClose: () => void }) {
  const { t } = useI18n()
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const qs = new URLSearchParams({ huntId, ...(userId ? { userId } : {}) })
    fetch(`/api/leaderboard?${qs}`)
      .then(r => r.json())
      .then((d) => { if (d && Array.isArray(d.leaderboard)) setData(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [huntId, userId])

  const outsideTop = data?.yourRank && data.yourRank.rank > 10

  return (
    <div className="history-backdrop" onClick={onClose}>
      <div className="history-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grab" aria-hidden />
        <div className="history-header">
          <h2 className="history-title">🏆 {t('leaderboardTitle')}</h2>
          <button className="history-close" onClick={onClose} aria-label={t('close')}>✕</button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 28 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : !data || data.leaderboard.length === 0 ? (
          <p className="history-empty">{t('leaderboardEmpty')}</p>
        ) : (
          <>
            <p className="history-sub">{data.totalPlayers} {t('lbPlayers')}</p>
            <ol className="lb-list">
              {data.leaderboard.map(row => (
                <li key={row.rank} className={`lb-row ${row.isYou ? 'is-you' : ''}`}>
                  <span className={`lb-rank ${row.rank <= 3 ? 'lb-medal' : ''}`}>
                    {row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : row.rank}
                  </span>
                  <span className="lb-name">{row.displayName}{row.isYou ? ` · ${t('lbYou')}` : ''}</span>
                  <span className="lb-score">{row.score}</span>
                </li>
              ))}
            </ol>
            {outsideTop && data.yourRank && (
              <div className="lb-yours">
                <span className="lb-rank">{data.yourRank.rank}</span>
                <span className="lb-name">{t('lbYou')}</span>
                <span className="lb-score">{data.yourRank.score}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
