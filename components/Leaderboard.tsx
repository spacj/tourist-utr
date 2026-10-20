'use client'
import { useCallback, useEffect, useState } from 'react'
import { Trophy } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { RankMark } from '@/components/StopIcon'
import { useI18n } from '@/hooks/useI18n'
import { apiGet } from '@/lib/apiFetch'
import { fmt } from '@/lib/i18n/fmt'
import { Avatar } from '@/components/Avatar'

interface Row {
  rank: number
  displayName: string
  photoURL: string | null
  score: number
  completedAt: number
  isYou: boolean
}
interface Data {
  leaderboard: Row[]
  yourRank: { rank: number; score: number; total: number } | null
  totalPlayers: number
}

/** Per-hunt leaderboard sheet: top players + the caller's own rank (token-based). */
export function Leaderboard({ huntId, onClose }: { huntId: string; onClose: () => void }) {
  const { t } = useI18n()
  const [data, setData] = useState<Data | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  const load = useCallback(() => {
    setState('loading')
    apiGet<Data>(`/api/leaderboard?huntId=${encodeURIComponent(huntId)}`)
      .then(d => {
        if (!d || !Array.isArray(d.leaderboard)) throw new Error('bad_shape')
        setData(d)
        setState('ready')
      })
      .catch(() => setState('error'))
  }, [huntId])
  useEffect(() => { load() }, [load])

  const youInTop = !!data?.leaderboard.some(r => r.isYou)

  return (
    <Modal open onClose={onClose} variant="sheet" title={<><Trophy size={20} strokeWidth={1.75} aria-hidden /> {t('leaderboardTitle')}</>} className="lb-panel">
      {state === 'loading' && (
        <div className="lb-state" aria-busy="true">
          <div className="spinner" role="status" aria-label={t('loading')} />
        </div>
      )}

      {state === 'error' && (
        <div className="lb-state" role="alert">
          <p className="flow-error-text">{t('loadError')}</p>
          <button type="button" className="btn-primary flow-retry" onClick={load}>{t('retry')}</button>
        </div>
      )}

      {state === 'ready' && data && data.leaderboard.length === 0 && (
        <p className="history-empty">{t('leaderboardEmpty')}</p>
      )}

      {state === 'ready' && data && data.leaderboard.length > 0 && (
        <>
          <p className="history-sub">{data.totalPlayers} {t('lbPlayers')}</p>
          <ol className="lb-list">
            {data.leaderboard.map(row => (
              <li key={row.rank} className={`lb-row ${row.isYou ? 'is-you' : ''}`} aria-current={row.isYou ? 'true' : undefined}>
                <span className="lb-rank"><RankMark rank={row.rank} label={fmt(t('rankLabel'), { n: row.rank })} /></span>
                {row.photoURL
                  ? <Avatar src={row.photoURL} className="lb-avatar" size={32} />
                  : <span className="lb-avatar lb-avatar-letter" aria-hidden>{row.displayName?.[0]?.toUpperCase() || '?'}</span>}
                <span className="lb-name">
                  {row.displayName}
                  {row.isYou && <span className="mp-tag">{t('lbYou')}</span>}
                </span>
                <span className="lb-score">{row.score}</span>
              </li>
            ))}
          </ol>
          {data.yourRank && !youInTop && (
            <div className="lb-yours" aria-label={fmt(t('lbYourRank'), { rank: data.yourRank.rank, total: data.yourRank.total })}>
              <span className="lb-rank"><RankMark rank={data.yourRank.rank} label={fmt(t('rankLabel'), { n: data.yourRank.rank })} /></span>
              <span className="lb-name">{t('lbYou')}</span>
              <span className="lb-score">{data.yourRank.score}</span>
            </div>
          )}
        </>
      )}
    </Modal>
  )
}
