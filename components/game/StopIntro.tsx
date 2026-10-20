'use client'
import { useEffect, useState } from 'react'
import { useI18n } from '@/hooks/useI18n'
import { Modal } from '@/components/Modal'
import { pickTxt, type ActiveClueView } from '@/types'

const TUTORIAL_KEY = 'hasSeenTutorial'

/**
 * First-run tutorial, then the per-stop intro card — never both at once.
 * The tutorial shows once per device (re-openable via `forceTutorial`);
 * the intro shows at each new stop after the tutorial is dismissed.
 */
export function StopIntro({
  clue, tutorialOpen, onTutorialClose, introOpen, onIntroClose,
}: {
  clue: ActiveClueView
  tutorialOpen: boolean
  onTutorialClose: () => void
  introOpen: boolean
  onIntroClose: () => void
}) {
  const { t, lang } = useI18n()

  // Auto-dismiss the intro after a few seconds.
  useEffect(() => {
    if (!introOpen || tutorialOpen) return
    const id = setTimeout(onIntroClose, 3500)
    return () => clearTimeout(id)
  }, [introOpen, tutorialOpen, onIntroClose, clue.id])

  if (tutorialOpen) {
    return (
      <Modal open onClose={onTutorialClose} title={t('tutorialTitle')} className="game-tutorial">
        <ul className="tutorial-steps">
          <li><span aria-hidden>🧩</span><span>{t('tutorialStep1')}</span></li>
          <li><span aria-hidden>🧭</span><span>{t('tutorialStep2')}</span></li>
          <li><span aria-hidden>💡</span><span>{t('tutorialStep3')}</span></li>
          <li><span aria-hidden>📍</span><span>{t('tutorialStep4')}</span></li>
        </ul>
        <button type="button" className="btn-primary game-modal-cta" onClick={onTutorialClose}>{t('tutorialGotIt')}</button>
      </Modal>
    )
  }

  if (!introOpen) return null
  const navKey = clue.navigation === 'compass' ? 'introNavCompass' : 'introNavWarmth'
  return (
    <div className="intro-backdrop" onClick={onIntroClose}>
      <div className="intro-card" role="dialog" aria-modal="false" aria-label={t('yourClue')} onClick={(e) => e.stopPropagation()}>
        <div className="intro-stop">{t('stop')} {clue.order} {t('of')} {clue.totalClues}</div>
        <div className="intro-icon" aria-hidden>{clue.icon ?? '📍'}</div>
        <div className="intro-theme">{pickTxt(clue.theme, lang) || t('getReady')}</div>
        <div className="intro-sub">{t(clue.puzzle ? 'introSolveFirst' : 'introReadClue')} · {t(navKey)}</div>
        <button type="button" className="btn-primary" onClick={onIntroClose} autoFocus>
          {t('continue')}
        </button>
      </div>
    </div>
  )
}

/** Has the first-run tutorial been seen on this device? */
export function useTutorialState(): [boolean, () => void, () => void] {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    try { if (localStorage.getItem(TUTORIAL_KEY) !== 'yes') setOpen(true) } catch {}
  }, [])
  const close = () => {
    setOpen(false)
    try { localStorage.setItem(TUTORIAL_KEY, 'yes') } catch {}
  }
  return [open, close, () => setOpen(true)]
}
