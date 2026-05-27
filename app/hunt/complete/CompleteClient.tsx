'use client'
import { useEffect, useState } from 'react'
import { useI18n } from '@/hooks/useI18n'
import { MysterySpec, ACHIEVEMENTS_DEF } from '@/types'
import { MysteryAccusation } from '@/components/MysteryAccusation'

interface FinishResult {
  xpGained: number
  level: number
  title: string
  leveledUp: boolean
  newlyUnlocked: string[]
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
  freeCapReached: boolean
  cityId: string | null
  fullHuntStops: number
  sessionId: string
  mystery: MysterySpec | null
  cityName: string
  cityTotal: number
  cityDone: number
  nextHuntTitle: string | null
  nextHuntI18n: Record<string, { title?: string }> | null
}

export function CompleteClient({
  huntTitle, huntI18n, huntCity, score, clues, totalClues, cluesArrived, hintsUsed, creditsSpent,
  freeCapReached, cityId, fullHuntStops, sessionId, mystery,
  cityName, cityTotal, cityDone, nextHuntTitle, nextHuntI18n,
}: Props) {
  const { t, lang } = useI18n()
  const [accuseBonus, setAccuseBonus] = useState(0)
  const [finish, setFinish] = useState<FinishResult | null>(null)
  const displayScore = score + accuseBonus

  // Roll the result into the player's progression once (server is idempotent).
  useEffect(() => {
    fetch('/api/finish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
      .then(r => r.json())
      .then((d) => { if (d && typeof d.level === 'number') setFinish(d) })
      .catch(() => {})
  }, [sessionId])

  const newBadges = (finish?.newlyUnlocked ?? [])
    .map(id => ACHIEVEMENTS_DEF.find(a => a.id === id))
    .filter(Boolean) as typeof ACHIEVEMENTS_DEF[number][]
  const localizedHuntTitle = (lang !== 'en' && huntI18n?.[lang]?.title) || huntTitle
  const localizedLocation = (c: ClueRow) =>
    (lang !== 'en' && c.i18n?.[lang]?.locationName) || c.locationName

  // Earned achievements (computed client-side; can sync with server later)
  const achievements: { id: string; icon: string; label: string }[] = []
  if (cluesArrived > 0) achievements.push({ id: 'explorer', icon: '🧭', label: t('achExplorer') })
  if (hintsUsed === 0 && cluesArrived === totalClues) achievements.push({ id: 'perfect_hunt', icon: '💎', label: t('achFlawless') })
  if (cluesArrived === totalClues) achievements.push({ id: 'finisher', icon: '🏁', label: t('achFinisher') })
  if (score >= 1000) achievements.push({ id: 'thousand', icon: '🎯', label: t('ach1000') })

  const share = async () => {
    const text = `I scored ${score} points exploring ${huntCity} on the Grand Tour — ${cluesArrived}/${totalClues} stops found! 🏆`
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try { await (navigator as any).share({ title: `${huntCity} Grand Tour`, text }) } catch {}
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try { await navigator.clipboard.writeText(text) } catch {}
    }
  }

  return (
    <main className="page-center">
      <div className="container" style={{ textAlign: 'center' }}>
        <a href="/" className="topbar-back" style={{ alignSelf: 'flex-start' }} aria-label={t('home')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          <span>{t('home')}</span>
        </a>

        {/* Badge card */}
        <div className="badge-wrap">
          <div className="badge-icon-big">🏆</div>
          <h1 style={{ fontFamily: 'var(--font-serif, Georgia), serif', fontSize: 26, fontWeight: 600, marginBottom: 4 }}>
            {t('huntComplete')}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--gold)', marginBottom: 16, letterSpacing: '0.02em' }}>{localizedHuntTitle}</p>

          <div style={{ fontSize: 12, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 2 }}>
            {t('finalScore')}
          </div>
          <div style={{ fontFamily: 'var(--font-serif, Georgia), serif', fontSize: 58, fontWeight: 700, color: 'var(--gold)', lineHeight: 1 }}>
            {displayScore}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{t('points')}</div>
        </div>

        {/* Progression: XP earned, level, and any newly unlocked badges */}
        {finish && finish.xpGained > 0 && (
          <div className="xp-card">
            <div className="xp-card-row">
              <span className="xp-gained">+{finish.xpGained} XP</span>
              <span className="xp-level">{t('levelLabel')} {finish.level} · {finish.title}</span>
            </div>
            {finish.leveledUp && <div className="xp-levelup">⬆️ {t('levelUp')}</div>}
            {newBadges.length > 0 && (
              <div className="xp-badges">
                <div className="xp-badges-label">{t('newBadges')}</div>
                <div className="xp-badges-row">
                  {newBadges.map(b => (
                    <span key={b.id} className="xp-badge" title={b.description}>
                      <span aria-hidden>{b.icon}</span> {b.title}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Mystery finale — accuse a suspect, weapon and place */}
        {mystery && (
          <MysteryAccusation sessionId={sessionId} mystery={mystery} onSolved={(b) => setAccuseBonus(b)} />
        )}

        {/* Free-teaser cap reached — invite the player to unlock the city */}
        {freeCapReached && (
          <a
            href={cityId ? `/city/${cityId}` : '/'}
            className="free-cap-cta"
          >
            <div className="free-cap-cta-icon" aria-hidden>🔓</div>
            <div className="free-cap-cta-body">
              <div className="free-cap-cta-title">{t('freeCapTitle')}</div>
              <div className="free-cap-cta-desc">
                {t('freeCapDesc')
                  .replace('{done}', String(cluesArrived))
                  .replace('{total}', String(fullHuntStops))
                  .replace('{city}', huntCity)}
              </div>
            </div>
            <div className="free-cap-cta-arrow" aria-hidden>→</div>
          </a>
        )}

        {/* Achievements earned */}
        {achievements.length > 0 && (
          <div className="achievements-row">
            {achievements.map(a => (
              <span key={a.id} className="ach-chip">
                <span>{a.icon}</span>
                {a.label}
              </span>
            ))}
          </div>
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

        {/* Clue list */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 14, overflow: 'hidden', marginBottom: 18, textAlign: 'left',
        }}>
          {clues.map((sc, i) => (
            <div key={sc.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px',
              borderBottom: i < clues.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 9,
                  background: sc.arrivedAt ? 'rgba(34,201,122,.14)' : 'rgba(255,255,255,.05)',
                  border: `1px solid ${sc.arrivedAt ? 'rgba(34,201,122,.35)' : 'rgba(255,255,255,.08)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14,
                }}>
                  {sc.arrivedAt ? sc.icon : i + 1}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{localizedLocation(sc)}</div>
                  {sc.arrivedAt && (
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                      ✓ {t('ctaCompleted')}
                    </div>
                  )}
                </div>
              </div>
              <span style={{
                fontSize: 14, fontWeight: 600,
                color: sc.arrivedAt ? 'var(--gold)' : 'var(--text-dim)',
                fontFamily: 'var(--font-serif, Georgia), serif',
              }}>
                {sc.arrivedAt ? `+${sc.pointsEarned}` : '—'}
              </span>
            </div>
          ))}
        </div>

        {/* What's next — turn the finish into the start of the next hunt */}
        {cityTotal > 0 && (
          <div className="next-card">
            <div className="next-progress-head">
              <span>{cityName}</span>
              <span>{cityDone}/{cityTotal} {t('huntsSolvedSuffix')}</span>
            </div>
            <div className="next-progress-bar">
              <div className="next-progress-fill" style={{ width: `${Math.round((cityDone / cityTotal) * 100)}%` }} />
            </div>
            {nextHuntTitle ? (
              <a href={cityId ? `/city/${cityId}` : '/'} className="next-cta">
                <div className="next-cta-body">
                  <div className="next-cta-label">{t('playNext')}</div>
                  <div className="next-cta-title">{(lang !== 'en' && nextHuntI18n?.[lang]?.title) || nextHuntTitle}</div>
                </div>
                <span className="next-cta-arrow" aria-hidden>→</span>
              </a>
            ) : (
              <a href={cityId ? `/city/${cityId}` : '/'} className="next-cta next-cta-done">
                <div className="next-cta-body">
                  <div className="next-cta-label">🎉 {t('cityCleared')}</div>
                  <div className="next-cta-title">{t('exploreMore')}</div>
                </div>
                <span className="next-cta-arrow" aria-hidden>→</span>
              </a>
            )}
            <a href="/multiplayer" className="next-secondary">👥 {t('raceAFriend')}</a>
          </div>
        )}

        <button onClick={share} className="btn-primary" style={{ marginBottom: 8 }}>
          📣 {t('share')}
        </button>
        <a href="/" className="btn-secondary" style={{ marginBottom: 8 }}>
          {t('playAgain')}
        </a>
        <a href="/profile" className="btn-secondary" style={{ textDecoration: 'none' }}>
          {t('viewProfile')}
        </a>
      </div>
    </main>
  )
}
