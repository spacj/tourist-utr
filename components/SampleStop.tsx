'use client'
import { useMemo, useState } from 'react'
import { ArrowRight, RotateCcw, Shuffle } from 'lucide-react'
import { useI18n } from '@/hooks/useI18n'
import { fmt } from '@/lib/i18n/fmt'

const ANSWER = 'OUDEGRACHT'
const SCRAMBLED = 'HDTREACOGU'.split('')

/**
 * The hero's "page torn from the notebook": a real clue in typewriter type
 * with a playable anagram. Purely client-side — nothing is sent anywhere.
 */
export function SampleStop({ ctaHref }: { ctaHref: string }) {
  const { t } = useI18n()
  const [picked, setPicked] = useState<number[]>([])

  const word = useMemo(() => picked.map(i => SCRAMBLED[i]).join(''), [picked])
  const full = picked.length === ANSWER.length
  const solved = word === ANSWER
  const wrong = full && !solved

  const pick = (i: number) => {
    if (solved || full || picked.includes(i)) return
    const next = [...picked, i]
    setPicked(next)
    const w = next.map(j => SCRAMBLED[j]).join('')
    try {
      if (w === ANSWER) navigator.vibrate?.([40, 30, 60])
      else if (next.length === ANSWER.length) navigator.vibrate?.([15, 20, 15])
    } catch {}
  }
  const unpick = (pos: number) => {
    if (solved) return
    setPicked(p => p.filter((_, k) => k !== pos))
  }

  const status = solved
    ? `${t('sampleSolved')}: ${t('samplePlace')}. ${t('sampleEveryStop')}`
    : wrong
      ? t('sampleWrong')
      : fmt(t('sampleProgress'), { n: picked.length, total: ANSWER.length })

  return (
    <article className={`nb-sample ${solved ? 'is-solved' : ''} ${wrong ? 'is-wrong' : ''}`} aria-labelledby="sample-title">
      <span className="nb-sample-tape" aria-hidden />
      <header className="nb-sample-head">
        <h2 id="sample-title" className="nb-sample-stamp">{t('sampleStamp')}</h2>
        <span className="nb-sample-type">
          <Shuffle size={16} strokeWidth={1.75} aria-hidden />
          {t('puzzleTypeAnagram')}
        </span>
      </header>

      <p className="typewriter nb-sample-clue">{t('sampleClue')}</p>
      <p className="nb-sample-task">{t('sampleTask')}</p>

      <div className="nb-slots" role="group" aria-label={t('sampleAnswerLabel')}>
        {Array.from({ length: ANSWER.length }, (_, pos) => {
          const idx = picked[pos]
          if (idx === undefined) return <span key={pos} className="nb-slot" aria-hidden />
          const letter = SCRAMBLED[idx]
          return (
            <button
              key={pos}
              type="button"
              className="nb-slot is-filled"
              onClick={() => unpick(pos)}
              disabled={solved}
              aria-label={fmt(t('sampleRemoveLetter'), { l: letter })}
            >
              {letter}
            </button>
          )
        })}
      </div>

      {!solved && (
        <div className="nb-tiles" role="group" aria-label={t('sampleLettersLabel')}>
          {SCRAMBLED.map((letter, i) => {
            const used = picked.includes(i)
            return (
              <button
                key={i}
                type="button"
                className={`nb-tile ${used ? 'is-used' : ''}`}
                onClick={() => pick(i)}
                disabled={used || full}
                aria-label={fmt(t('sampleAddLetter'), { l: letter })}
              >
                {letter}
              </button>
            )
          })}
        </div>
      )}

      <div className="nb-sample-foot">
        <p className={`nb-sample-status ${wrong ? 'is-wrong' : ''}`} aria-live="polite">
          {solved ? '' : status}
          {solved && <span className="sr-only">{status}</span>}
        </p>
        {!solved && picked.length > 0 && (
          <button type="button" className="btn-ghost nb-sample-clear" onClick={() => setPicked([])}>
            <RotateCcw size={16} strokeWidth={1.75} aria-hidden />
            {t('sampleClear')}
          </button>
        )}
      </div>

      {solved && (
        <div className="nb-sample-solved">
          <span className="stamp stamp-solved" aria-hidden>{t('sampleSolved')}</span>
          <p className="nb-sample-place">{t('samplePlace')}</p>
          <p className="nb-sample-every">{t('sampleEveryStop')}</p>
          <p className="nb-sample-more">{t('sampleEveryStopMore')}</p>
          <a href={ctaHref} className="btn-primary nb-cta">
            {t('homeCtaPick')}
            <ArrowRight size={18} strokeWidth={2} aria-hidden />
          </a>
        </div>
      )}
    </article>
  )
}
