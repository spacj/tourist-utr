'use client'
import { useI18n } from '@/hooks/useI18n'
import { fmt } from '@/lib/gameClient'

/** Pinned top HUD. Every control is a ≥44 px button. Shows the server's totalScore. */
export function ClueHud({
  icon, order, totalClues, credits, score, historyCount, hasCase,
  onBack, onIntro, onShop, onHistory, onCase, onHelp,
}: {
  icon: string | null
  order: number
  totalClues: number
  credits: number
  score: number
  historyCount: number
  hasCase: boolean
  onBack: () => void
  onIntro: () => void
  onShop: () => void
  onHistory: () => void
  onCase: () => void
  onHelp: () => void
}) {
  const { t } = useI18n()
  return (
    <div className="game-hud">
      <button type="button" onClick={onBack} className="hud-back" aria-label={t('backToCity')}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </button>
      <button type="button" onClick={onIntro} className="hud-pill hud-stop"
        aria-label={fmt(t('hudStopLabel'), { n: order, total: totalClues })}>
        <span aria-hidden>{icon ?? '📍'}</span> {order}/{totalClues}
      </button>
      <button type="button" onClick={onShop} className="hud-pill hud-credits"
        aria-label={fmt(t('hudCreditsLabel'), { n: credits })}>
        <span aria-hidden>💎</span> {credits}
      </button>
      <button type="button" onClick={onHistory} className="hud-pill hud-score"
        aria-label={fmt(t('hudScoreLabel'), { n: score })}>
        <span aria-hidden>⭐</span> {score}
      </button>
      {historyCount > 0 && (
        <button type="button" onClick={onHistory} className="hud-pill hud-history" aria-label={t('history')}>
          <span aria-hidden>📜</span> {historyCount}
        </button>
      )}
      {hasCase && (
        <button type="button" onClick={onCase} className="hud-pill hud-case" aria-label={t('caseFile')}>
          <span aria-hidden>🔍</span> <span className="hud-case-label">{t('caseFile')}</span>
        </button>
      )}
      <button type="button" onClick={onHelp} className="hud-pill hud-help" aria-label={t('helpLabel')}>?</button>
    </div>
  )
}
