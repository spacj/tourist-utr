'use client'
import { ArrowLeft, CircleHelp, Lightbulb, MapPin, ScrollText, Search, Star } from 'lucide-react'
import { useI18n } from '@/hooks/useI18n'
import { fmt } from '@/lib/gameClient'

/** Pinned top HUD. Every control is a ≥44 px button. Shows the server's totalScore. */
export function ClueHud({
  order, totalClues, credits, score, historyCount, hasCase,
  onBack, onIntro, onShop, onHistory, onCase, onHelp,
}: {
  /** The stop's content icon (unused in the HUD, which shows a neutral pin). */
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
        <ArrowLeft size={20} strokeWidth={2} aria-hidden />
      </button>
      <button type="button" onClick={onIntro} className="hud-pill hud-stop"
        aria-label={fmt(t('hudStopLabel'), { n: order, total: totalClues })}>
        <MapPin size={18} strokeWidth={1.75} aria-hidden /> <span className="hud-num">{order}/{totalClues}</span>
      </button>
      <button type="button" onClick={onShop} className="hud-pill hud-credits"
        aria-label={fmt(t('hudCreditsLabel'), { n: credits })}>
        <Lightbulb size={18} strokeWidth={1.75} aria-hidden /> <span className="hud-num">{credits}</span>
      </button>
      <button type="button" onClick={onHistory} className="hud-pill hud-score"
        aria-label={fmt(t('hudScoreLabel'), { n: score })}>
        <Star size={18} strokeWidth={1.75} aria-hidden /> <span className="hud-num">{score}</span>
      </button>
      {historyCount > 0 && (
        <button type="button" onClick={onHistory} className="hud-pill hud-history" aria-label={t('history')}>
          <ScrollText size={18} strokeWidth={1.75} aria-hidden /> <span className="hud-num">{historyCount}</span>
        </button>
      )}
      {hasCase && (
        <button type="button" onClick={onCase} className="hud-pill hud-case" aria-label={t('caseFile')}>
          <Search size={18} strokeWidth={1.75} aria-hidden /> <span className="hud-case-label">{t('caseFile')}</span>
        </button>
      )}
      <button type="button" onClick={onHelp} className="hud-pill hud-help" aria-label={t('helpLabel')}>
        <CircleHelp size={20} strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  )
}
