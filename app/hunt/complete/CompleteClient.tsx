'use client'
import { SITE_URL } from '@/lib/site'
import { ArrowLeft, ArrowRight, ArrowUp, Check, Share2, Trophy, Users } from 'lucide-react'
import { AchievementIcon } from '@/components/AchievementIcon'
import { StopIcon } from '@/components/StopIcon'
import { useEffect, useState } from 'react'
import { useI18n } from '@/hooks/useI18n'
import { useToast } from '@/components/Toast'
import { MysterySpec, ACHIEVEMENTS_DEF } from '@/types'
import { MysteryAccusation } from '@/components/MysteryAccusation'
import { Leaderboard } from '@/components/Leaderboard'
import { apiGet, apiPost } from '@/lib/apiFetch'
import { fmt } from '@/lib/i18n/fmt'

interface FinishResult {
  xpGained: number
  level: number
  title: string
  leveledUp: boolean
  newlyUnlocked: string[]
  alreadyFinished?: boolean
}

interface ClueRow {
  id: string
  locationName: string
  i18n: Record<string, { locationName?: string }> | null
  icon: string
  order: number
  arrivedAt: number | null
  pointsEarned: number
}

interface Props {
  huntTitle: string
  huntI18n: Record<string, { title?: string }> | null
  huntCity: string
  score: number
  clues: ClueRow[]
  totalClues: number
  cluesArrived: number
  hintsUsed: number
  creditsSpent: number
  cityId: string | null
  sessionId: string
  huntId: string
  mystery: MysterySpec | null
  cityName: string
  cityTotal: number
  cityDone: number
  nextHuntTitle: string | null
  nextHuntI18n: Record<string, { title?: string }> | null
}

function siteOrigin(): string {
  return SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '')
}

export function CompleteClient({
  huntTitle, huntI18n, huntCity, score, clues, totalClues, cluesArrived, hintsUsed, creditsSpent,
  cityId, sessionId, huntId, mystery,
  cityName, cityTotal, cityDone, nextHuntTitle, nextHuntI18n,
}: Props) {
  const { t, lang } = useI18n()
  const toast = useToast()
  const [accuseBonus, setAccuseBonus] = useState(0)
  const [finish, setFinish] = useState<FinishResult | null>(null)
  const [lbOpen, setLbOpen] = useState(false)
  const [lbRank, setLbRank] = useState<{ rank: number; total: number } | null>(null)
  const displayScore = score + accuseBonus
  const cityHref = cityId ? `/city/${cityId}` : '/'

  // Roll the result into the player's progression once (server is idempotent),
  // then load the rank teaser so it includes this run.
  useEffect(() => {
    let cancelled = false
    apiPost<FinishResult | { skipped: string }>('/api/finish', { sessionId })
      .then(d => { if (!cancelled && d && 'level' in d && typeof d.level === 'number') setFinish(d) })
      .catch(() => {}) // progression is a bonus; the results below stand on their own
      .finally(() => {
        apiGet<{ yourRank: { rank: number; total: number } | null }>(`/api/leaderboard?huntId=${encodeURIComponent(huntId)}`)
          .then(d => { if (!cancelled && d?.yourRank) setLbRank({ rank: d.yourRank.rank, total: d.yourRank.total }) })
          .catch(() => {})
      })
    return () => { cancelled = true }
  }, [sessionId, huntId])

  // Badges come only from the server's `newlyUnlocked` (already-finished
  // replays report the same list, which is fine — it's this hunt's haul).
  const newBadges = (finish?.newlyUnlocked ?? [])
    .map(id => ACHIEVEMENTS_DEF.find(a => a.id === id))
    .filter((a): a is typeof ACHIEVEMENTS_DEF[number] => !!a)
  const localizedHuntTitle = (lang !== 'en' && huntI18n?.[lang]?.title) || huntTitle
  const localizedLocation = (c: ClueRow) => (lang !== 'en' && c.i18n?.[lang]?.locationName) || c.locationName

  const share = async () => {
    const url = `${siteOrigin()}${cityHref === '/' ? '' : cityHref}`
    const text = fmt(t('shareResultText'), { score: displayScore, city: huntCity, done: cluesArrived, total: totalClues })
    const title = fmt(t('shareResultTitle'), { city: huntCity })
    if (typeof navigator.share === 'function') {
      try { await navigator.share({ title, text, url }) } catch {}
      return
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`)
      toast.success(t('copied'))
    } catch {
      toast.error(t('copyFailed'))
    }
  }

  return (
    <main className="page-center">
      <div className="container cmp-container">
        <a href="/" className="topbar-back cmp-back">
          <ArrowLeft size={18} strokeWidth={2} aria-hidden />
          <span>{t('home')}</span>
        </a>

        <div className="badge-wrap">
          <span className="stamp stamp-solved cmp-stamp" aria-hidden>{t('ctaCompleted')}</span>
          <div className="badge-icon-big" aria-hidden><Trophy size={36} strokeWidth={1.5} /></div>
          <h1 className="cmp-title">{t('huntComplete')}</h1>
          <p className="cmp-hunt">{localizedHuntTitle}</p>
          <div className="cmp-score-label">{t('finalScore')}</div>
          <div className="cmp-score nb-num" aria-live="polite">{displayScore}</div>
          <div className="cmp-score-unit">{t('points')}</div>
        </div>

        {finish && finish.xpGained > 0 && (
          <div className="xp-card" role="status">
            <div className="xp-card-row">
              <span className="xp-gained">+{finish.xpGained} XP</span>
              <span className="xp-level">{t('levelLabel')} {finish.level} · {t(`levelTitle${finish.level}`)}</span>
            </div>
            {finish.leveledUp && <div className="xp-levelup"><ArrowUp size={16} strokeWidth={2} aria-hidden /> {t('levelUp')}</div>}
            {newBadges.length > 0 && (
              <div className="xp-badges">
                <div className="xp-badges-label">{t('newBadges')}</div>
                <ul className="xp-badges-row flow-plain-list">
                  {newBadges.map(b => (
                    <li key={b.id} className="xp-badge" title={t(`achDesc_${b.id}`)}>
                      <AchievementIcon id={b.id} size={16} /> {t(`ach_${b.id}`)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {mystery && (
          <MysteryAccusation sessionId={sessionId} mystery={mystery} onSolved={(b) => setAccuseBonus(b)} />
        )}

        <div className="stats-grid">
          {[
            { label: t('locations'), value: `${cluesArrived}/${totalClues}` },
            { label: t('hintsUsed'), value: hintsUsed },
            { label: t('creditsSpent'), value: creditsSpent },
          ].map(({ label, value }) => (
            <div key={label} className="stat-card">
              <div className="stat-value">{value}</div>
              <div className="stat-label">{label}</div>
            </div>
          ))}
        </div>

        <ol className="cmp-clues">
          {clues.map((sc, i) => (
            <li key={sc.id} className={`cmp-clue ${sc.arrivedAt ? 'is-done' : ''}`}>
              <div className="cmp-clue-main">
                {sc.arrivedAt ? <StopIcon icon={sc.icon} size="sm" className="cmp-clue-icon" /> : <div className="cmp-clue-icon" aria-hidden>{i + 1}</div>}
                <div>
                  <div className="cmp-clue-name">{localizedLocation(sc)}</div>
                  <div className="cmp-clue-status">{sc.arrivedAt ? <><Check size={14} strokeWidth={2.25} aria-hidden /> {t('ctaCompleted')}</> : t('notReached')}</div>
                </div>
              </div>
              <span className="cmp-clue-points">{sc.arrivedAt ? `+${sc.pointsEarned}` : '—'}</span>
            </li>
          ))}
        </ol>

        {cityTotal > 0 && (
          <div className="next-card">
            <div className="next-progress-head">
              <span>{cityName}</span>
              <span>{cityDone}/{cityTotal} {t('huntsSolvedSuffix')}</span>
            </div>
            <div className="next-progress-bar" aria-hidden>
              <div className="next-progress-fill" style={{ width: `${Math.round((cityDone / cityTotal) * 100)}%` }} />
            </div>
            {nextHuntTitle ? (
              <a href={cityHref} className="next-cta">
                <div className="next-cta-body">
                  <div className="next-cta-label">{t('playNext')}</div>
                  <div className="next-cta-title">{(lang !== 'en' && nextHuntI18n?.[lang]?.title) || nextHuntTitle}</div>
                </div>
                <ArrowRight className="next-cta-arrow" size={20} strokeWidth={2} aria-hidden />
              </a>
            ) : (
              <a href="/#countries" className="next-cta next-cta-done">
                <div className="next-cta-body">
                  <div className="next-cta-label">{t('cityCleared')}</div>
                  <div className="next-cta-title">{t('exploreMore')}</div>
                </div>
                <ArrowRight className="next-cta-arrow" size={20} strokeWidth={2} aria-hidden />
              </a>
            )}
            <a href="/multiplayer" className="next-secondary"><Users size={18} strokeWidth={1.75} aria-hidden /> {t('raceAFriend')}</a>
          </div>
        )}

        <button type="button" className="next-secondary cmp-lb-btn" onClick={() => setLbOpen(true)}>
          <Trophy size={18} strokeWidth={1.75} aria-hidden /> {lbRank ? fmt(t('lbYourRank'), { rank: lbRank.rank, total: lbRank.total }) : t('leaderboardTitle')}
        </button>

        <button type="button" onClick={share} className="btn-primary cmp-gap">
          <Share2 size={18} strokeWidth={1.75} aria-hidden /> {t('share')}
        </button>
        <a href={cityHref} className="btn-secondary flow-btn cmp-gap">{t('playAgain')}</a>
        <a href="/profile" className="btn-secondary flow-btn">{t('viewProfile')}</a>
      </div>

      {lbOpen && <Leaderboard huntId={huntId} onClose={() => setLbOpen(false)} />}
    </main>
  )
}
