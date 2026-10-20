'use client'
import { useState } from 'react'
import { Lightbulb } from 'lucide-react'
import { useI18n } from '@/hooks/useI18n'
import { HINT_COSTS, SCORE, pickTxt, type ActiveClueView } from '@/types'
import { fmt } from '@/lib/gameClient'

type Tier = 1 | 2 | 3

const ROWS: { tier: Tier; labelKey: string; descKey: string }[] = [
  { tier: 1, labelKey: 'hintTier1', descKey: 'hintTier1Desc' },
  { tier: 2, labelKey: 'hintTier2', descKey: 'hintTier2Desc' },
  { tier: 3, labelKey: 'hintTier3', descKey: 'hintTier3Desc' },
]

/**
 * Location hints. Tier 1 is free, tier 2 street-level, tier 3 reveals the
 * pin. The text comes from the server (view.hintsUnlocked) — never from the clue.
 */
export function HintList({
  clue, credits, unlocking, onUnlock,
}: {
  clue: ActiveClueView
  credits: number
  unlocking: number | 'puzzle' | null
  onUnlock: (tier: Tier) => void
}) {
  const { t, lang } = useI18n()
  const [open, setOpen] = useState<Tier | null>(null)

  return (
    <section className="hint-tabs" aria-labelledby={`hints-${clue.id}`}>
      <h3 id={`hints-${clue.id}`} className="clue-label game-section-label">{t('hints')}</h3>
      {ROWS.map(({ tier, labelKey, descKey }) => {
        const key = String(tier) as '1' | '2' | '3'
        const unlocked = key === '3' ? !!clue.hintsUnlocked['3'] || clue.pinRevealed : !!clue.hintsUnlocked[key]
        const cost = HINT_COSTS[tier]
        const busy = unlocking === tier
        const penalty = tier === 2 ? SCORE.hint2Penalty : tier === 3 ? SCORE.pinRevealPenalty : 0
        const isOpen = open === tier && unlocked
        const content = key !== '3' ? clue.hintsUnlocked[key] : undefined
        return (
          <div key={tier} className={`hint-row ${unlocked ? 'unlocked' : ''}`}>
            <button
              type="button"
              className="hint-header game-hint-btn"
              onClick={() => {
                if (unlocked) setOpen(isOpen ? null : tier)
                else { setOpen(tier); onUnlock(tier) }
              }}
              disabled={busy || (unlocking !== null && !unlocked)}
              aria-expanded={unlocked ? isOpen : undefined}
              aria-busy={busy}
            >
              <span className="game-hint-text">
                <span className="hint-label">{t(labelKey)}</span>
                <span className="game-hint-desc">
                  {t(descKey)}{penalty > 0 && !unlocked ? ` · ${fmt(t('hintPenaltyNote'), { points: penalty })}` : ''}
                </span>
              </span>
              <span className={`hint-status ${unlocked ? 'is-unlocked' : cost === 0 ? 'is-free' : credits < cost ? 'is-short' : ''}`}>
                {busy ? '…' : unlocked ? t('unlocked') : cost > 0 ? (
                  <><Lightbulb size={16} strokeWidth={1.75} aria-hidden /> {cost}<span className="sr-only"> {t('credits')}</span></>
                ) : t('free')}
              </span>
            </button>
            {isOpen && (
              <div className="hint-body">
                {tier === 3 ? (
                  <p>{t('pinRevealedNote')}</p>
                ) : (
                  <>
                    <p>{pickTxt(content?.text, lang) || t('hintEmpty')}</p>
                    {content?.photoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={content.photoUrl} alt={t('hintPhotoAlt')} className="game-hint-photo" loading="lazy" />
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}
