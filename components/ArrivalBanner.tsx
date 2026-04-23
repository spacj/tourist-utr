'use client'
import { useState } from 'react'
import { useI18n } from '@/hooks/useI18n'
import { Trivia } from '@/types'

interface Props {
  locationName: string
  pointsEarned: number
  timeBonus: number
  hintPenalty: number
  streakBonus?: number
  perfectBonus?: number
  funFact?: string | null
  trivia?: Trivia | null
  huntComplete: boolean
  onNext: () => void
  onTriviaCorrect?: () => void
}

export function ArrivalBanner({
  locationName, pointsEarned, timeBonus, hintPenalty,
  streakBonus = 0, perfectBonus = 0, funFact, trivia,
  huntComplete, onNext, onTriviaCorrect,
}: Props) {
  const { t } = useI18n()
  const [picked, setPicked] = useState<number | null>(null)
  const [bonusClaimed, setBonusClaimed] = useState(false)

  const pickTrivia = (i: number) => {
    if (picked !== null) return
    setPicked(i)
    if (trivia && i === trivia.correctIndex && !bonusClaimed) {
      setBonusClaimed(true)
      onTriviaCorrect?.()
    }
  }

  const share = async () => {
    const text = `I just reached ${locationName} on the Utrecht Grand Tour 🏆 +${pointsEarned} pts`
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try {
        await (navigator as any).share({ title: 'Utrecht Grand Tour', text })
      } catch {}
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try { await navigator.clipboard.writeText(text) } catch {}
    }
  }

  const isCorrect = trivia && picked === trivia.correctIndex

  return (
    <div className="arrival-backdrop">
      <div className="arrival-card">
        <div className="arrival-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
            stroke="#22c97a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 className="arrival-title">{t('youMadeIt')}</h2>
        <p className="arrival-loc">{locationName}</p>

        <div className="score-breakdown">
          <div className="score-row">
            <span style={{ color: 'var(--text-muted)' }}>{t('baseScore')}</span>
            <span>+100</span>
          </div>
          {timeBonus > 0 && (
            <div className="score-row">
              <span style={{ color: 'var(--text-muted)' }}>⚡ {t('speedBonus')}</span>
              <span style={{ color: 'var(--green)' }}>+{timeBonus}</span>
            </div>
          )}
          {perfectBonus > 0 && (
            <div className="score-row">
              <span style={{ color: 'var(--text-muted)' }}>🧠 No-hint bonus</span>
              <span style={{ color: 'var(--green)' }}>+{perfectBonus}</span>
            </div>
          )}
          {streakBonus > 0 && (
            <div className="score-row">
              <span style={{ color: 'var(--text-muted)' }}>🔥 Streak bonus</span>
              <span style={{ color: 'var(--gold)' }}>+{streakBonus}</span>
            </div>
          )}
          {hintPenalty > 0 && (
            <div className="score-row">
              <span style={{ color: 'var(--text-muted)' }}>{t('hintsUsed')}</span>
              <span style={{ color: 'var(--red)' }}>−{hintPenalty}</span>
            </div>
          )}
          <div className="score-row-total">
            <span style={{ color: 'var(--text-muted)' }}>{t('pointsEarned')}</span>
            <span style={{ color: 'var(--gold)' }}>{pointsEarned + (bonusClaimed ? 25 : 0)}</span>
          </div>
        </div>

        {/* ── Fun fact story card ── */}
        {funFact && (
          <div className="fact-card">
            <div className="fact-label">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2a7 7 0 00-4 12.7V17a1 1 0 001 1h6a1 1 0 001-1v-2.3A7 7 0 0012 2zm-2 18h4v2h-4z" />
              </svg>
              {t('didYouKnow')}
            </div>
            <p className="fact-text">{funFact}</p>
          </div>
        )}

        {/* ── Trivia (bonus +25 pts) ── */}
        {trivia && (
          <div className="trivia-card">
            <div className="trivia-head">🎓 {t('quickQuiz')}</div>
            <p className="trivia-q">{trivia.question}</p>
            <div className="trivia-opts">
              {trivia.options.map((opt, i) => {
                let cls = 'trivia-opt'
                if (picked !== null) {
                  if (i === trivia.correctIndex) cls += ' correct'
                  else if (i === picked)         cls += ' wrong'
                }
                return (
                  <button
                    key={i}
                    className={cls}
                    onClick={() => pickTrivia(i)}
                    disabled={picked !== null}
                  >
                    {opt}
                  </button>
                )
              })}
            </div>
            {picked !== null && (
              <div className={`trivia-explain ${!isCorrect ? 'wrong' : ''}`}>
                <strong>{isCorrect ? `✓ ${t('correct')}` : `✗ ${t('notQuite')}`}</strong>
                <div style={{ marginTop: 4 }}>{trivia.explain}</div>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={share} className="btn-ghost" style={{ flex: 'none' }} aria-label={t('share')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/>
            </svg>
            {t('share')}
          </button>
          <button className="btn-primary" onClick={onNext} style={{ flex: 1 }}>
            {huntComplete ? t('seeFinal') : t('nextClue')}
          </button>
        </div>
      </div>
    </div>
  )
}
