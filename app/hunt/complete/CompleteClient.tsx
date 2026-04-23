'use client'
import { useI18n } from '@/hooks/useI18n'

interface ClueRow {
  id: string
  locationName: string
  icon: string
  order: number
  arrivedAt: number | null
  pointsEarned: number
}

interface Props {
  huntTitle: string
  score: number
  clues: ClueRow[]
  totalClues: number
  cluesArrived: number
  hintsUsed: number
  creditsSpent: number
}

export function CompleteClient({
  huntTitle, score, clues, totalClues, cluesArrived, hintsUsed, creditsSpent,
}: Props) {
  const { t } = useI18n()

  // Earned achievements (computed client-side; can sync with server later)
  const achievements: { id: string; icon: string; label: string }[] = []
  if (cluesArrived > 0) achievements.push({ id: 'explorer', icon: '🧭', label: 'Explorer' })
  if (hintsUsed === 0 && cluesArrived === totalClues) achievements.push({ id: 'perfect_hunt', icon: '💎', label: 'Flawless' })
  if (cluesArrived === totalClues) achievements.push({ id: 'finisher', icon: '🏁', label: 'Finisher' })
  if (score >= 1000) achievements.push({ id: 'thousand', icon: '🎯', label: '1000+' })

  const share = async () => {
    const text = `I scored ${score} points exploring Utrecht on the Grand Tour — ${cluesArrived}/${totalClues} stops found! 🏆`
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try { await (navigator as any).share({ title: 'Utrecht Grand Tour', text }) } catch {}
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try { await navigator.clipboard.writeText(text) } catch {}
    }
  }

  return (
    <main className="page-center">
      <div className="container" style={{ textAlign: 'center' }}>
        {/* Badge card */}
        <div className="badge-wrap">
          <div className="badge-icon-big">🏆</div>
          <h1 style={{ fontFamily: 'var(--font-serif, Georgia), serif', fontSize: 26, fontWeight: 600, marginBottom: 4 }}>
            {t('huntComplete')}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--gold)', marginBottom: 16, letterSpacing: '0.02em' }}>{huntTitle}</p>

          <div style={{ fontSize: 12, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 2 }}>
            {t('finalScore')}
          </div>
          <div style={{ fontFamily: 'var(--font-serif, Georgia), serif', fontSize: 58, fontWeight: 700, color: 'var(--gold)', lineHeight: 1 }}>
            {score}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{t('points')}</div>
        </div>

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
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{sc.locationName}</div>
                  {sc.arrivedAt && (
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                      ✓ Completed
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
