'use client'
import { useEffect, useRef, useState, type ComponentType } from 'react'
import {
  Brain, Check, Eye, Flag, GraduationCap, Lightbulb, MapPin, Puzzle, Search, Share2, WifiOff, X,
  type LucideProps,
} from 'lucide-react'
import { useI18n } from '@/hooks/useI18n'
import { useToast } from '@/components/Toast'
import { apiPost, ApiError } from '@/lib/apiFetch'
import { errorKey, fmt, vibrate } from '@/lib/gameClient'
import {
  breakdownTotal, localizeEvidenceText, pickTxt,
  type ArrivedStopView, type StopBreakdown, type Txt,
} from '@/types'

type Phase = 'onsite' | 'trivia' | 'story'

function firstPhase(s: ArrivedStopView): Phase {
  if (s.offline) return 'story'
  if (s.onSite && !s.onSite.done) return 'onsite'
  if (s.trivia && !s.triviaResult) return 'trivia'
  return 'story'
}

function celebrate() {
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext
    if (AC) {
      const ctx = new AC()
      ;[660, 880, 1175].forEach((f, i) => {
        const osc = ctx.createOscillator(); const g = ctx.createGain()
        osc.frequency.value = f; osc.connect(g); g.connect(ctx.destination)
        const t0 = ctx.currentTime + i * 0.14
        g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.16, t0 + 0.01)
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22)
        osc.start(t0); osc.stop(t0 + 0.25)
      })
      setTimeout(() => ctx.close?.(), 1000)
    }
  } catch {}
  vibrate([60, 40, 60, 40, 120])
}

/**
 * The on-site half of a stop (GAME_DESIGN.md): on-site question (verified
 * stops only, ≤3 attempts) → quick quiz (one attempt) → story & fun fact →
 * next stop. Every answer is checked server-side; the fun fact arrives with
 * the quiz result so it can't give the answer away.
 */
export function ArrivalBanner({
  stop: initial, sessionId, huntCity, huntComplete, onNext, onScore,
}: {
  stop: ArrivedStopView
  sessionId: string
  huntCity: string
  huntComplete: boolean
  onNext: (finalStop: ArrivedStopView) => void
  onScore: (total: number) => void
}) {
  const { t, lang } = useI18n()
  const toast = useToast()
  const [stop, setStop] = useState(initial)
  const [phase, setPhase] = useState<Phase>(() => firstPhase(initial))
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [onSiteMsg, setOnSiteMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [onSiteExplain, setOnSiteExplain] = useState<Txt | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => { celebrate(); headingRef.current?.focus() }, [])

  const addPoints = (field: keyof StopBreakdown, pts: number) => {
    if (!pts) return
    setStop(s => ({ ...s, breakdown: { ...s.breakdown, [field]: (s.breakdown[field] ?? 0) + pts } }))
  }

  const fail = (e: unknown) => {
    toast.error(t(errorKey(e instanceof ApiError ? e.code : 'network')))
  }

  // ── On-site question ──
  const submitOnSite = async () => {
    if (busy || !answer.trim()) return
    setBusy(true)
    try {
      const r = await apiPost<{
        correct: boolean; attemptsLeft: number; done: boolean; bonus: number; explain: Txt | null; totalScore: number
      }>('/api/onsite', { sessionId, clueId: stop.id, answer })
      onScore(r.totalScore)
      addPoints('onSite', r.bonus)
      setStop(s => ({ ...s, onSite: s.onSite && { ...s.onSite, attemptsLeft: r.attemptsLeft, done: r.done, correct: r.correct } }))
      if (r.correct) {
        vibrate([40, 30, 60])
        setOnSiteMsg({ ok: true, text: fmt(t('onSiteCorrect'), { points: r.bonus }) })
      } else {
        vibrate([15, 20, 15])
        setOnSiteMsg({ ok: false, text: r.done ? t('onSiteOut') : fmt(t('attemptsLeft'), { n: r.attemptsLeft }) })
      }
      if (r.explain) setOnSiteExplain(r.explain)
      setAnswer('')
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  // ── Quiz ──
  const pickTrivia = async (index: number) => {
    if (busy || stop.triviaResult) return
    setBusy(true)
    try {
      const r = await apiPost<{
        correct: boolean; correctIndex: number; explain: Txt | null; bonus: number; funFact: Txt | null; totalScore: number
      }>('/api/trivia', { sessionId, clueId: stop.id, index })
      onScore(r.totalScore)
      vibrate(r.correct ? [40, 30, 60] : [15, 20, 15])
      setStop(s => ({
        ...s,
        funFact: r.funFact,
        triviaResult: { correct: r.correct, pickedIndex: index, correctIndex: r.correctIndex, explain: r.explain },
        breakdown: { ...s.breakdown, trivia: (s.breakdown.trivia ?? 0) + r.bonus },
      }))
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  const place = pickTxt(stop.locationName, lang)
  const total = breakdownTotal(stop.breakdown)

  const share = async () => {
    const text = fmt(t('shareArrivalText'), { place: place || fmt(t('stopN'), { n: stop.order }), city: huntCity, points: total })
    try {
      if ((navigator as any).share) await (navigator as any).share({ title: t('title'), text })
      else if (navigator.clipboard) { await navigator.clipboard.writeText(text); toast.success(t('copied')) }
    } catch {}
  }

  const b = stop.breakdown
  const rows: { key: string; Icon: ComponentType<LucideProps>; label: string; value: number }[] = [
    { key: 'puzzle', Icon: Puzzle, label: t('bdPuzzle'), value: b.puzzle },
    { key: 'arrival', Icon: MapPin, label: t('bdArrival'), value: b.arrival },
    { key: 'onSite', Icon: Eye, label: t('bdOnSite'), value: b.onSite },
    { key: 'trivia', Icon: GraduationCap, label: t('bdTrivia'), value: b.trivia },
    { key: 'clean', Icon: Brain, label: t('bdClean'), value: b.clean },
    { key: 'raceFirst', Icon: Flag, label: t('bdRaceFirst'), value: b.raceFirst },
    { key: 'hintPenalty', Icon: Lightbulb, label: t('bdHints'), value: b.hintPenalty },
  ].filter(r => r.value !== 0)

  const evidence = localizeEvidenceText(stop.evidence ?? undefined, lang)
  const tr = stop.trivia
  const res = stop.triviaResult

  return (
    <div className="arrival-backdrop">
      <div className="arrival-card" role="dialog" aria-modal="true" aria-labelledby={`arrival-${stop.id}`}>
        <div className="arrival-header">
          <span className="stamp stamp-found arrival-stamp" aria-hidden>{t('stampFound')}</span>
          <div className="arrival-icon" aria-hidden>
            <Check size={26} strokeWidth={2.25} />
          </div>
          <h2 className="arrival-title" id={`arrival-${stop.id}`} tabIndex={-1} ref={headingRef}>{t('youMadeIt')}</h2>
          <p className="arrival-loc">{place || fmt(t('stopN'), { n: stop.order })}</p>
          <ol className="arrival-steps" aria-label={t('stopProgress')}>
            {stop.onSite && <li className={phase === 'onsite' ? 'is-current' : 'is-done'}>{t('phaseOnSite')}</li>}
            {tr && <li className={phase === 'trivia' ? 'is-current' : phase === 'story' ? 'is-done' : ''}>{t('phaseQuiz')}</li>}
            <li className={phase === 'story' ? 'is-current' : ''}>{t('phaseStory')}</li>
          </ol>
        </div>

        <div className="arrival-body" aria-live="polite">
          {stop.offline && (
            <div className="fact-card arrival-offline">
              <p className="fact-text"><WifiOff size={16} strokeWidth={1.75} aria-hidden /> {t('arrivalOffline')}</p>
            </div>
          )}

          {phase === 'onsite' && stop.onSite && (
            <div className="trivia-card onsite-card">
              <div className="trivia-head"><Eye size={18} strokeWidth={1.75} aria-hidden /> {fmt(t('onSiteTitle'), { points: 50 })}</div>
              <p className="trivia-q typewriter">{pickTxt(stop.onSite.question, lang)}</p>
              {!stop.onSite.done ? (
                <form className="puzzle-input-row" onSubmit={(e) => { e.preventDefault(); void submitOnSite() }}>
                  <label htmlFor={`onsite-${stop.id}`} className="sr-only">{t('puzzlePlaceholder')}</label>
                  <input id={`onsite-${stop.id}`} className="puzzle-input" value={answer}
                    onChange={(e) => setAnswer(e.target.value)} autoComplete="off" disabled={busy}
                    placeholder={t('puzzlePlaceholder')} />
                  <button type="submit" className="puzzle-submit" disabled={busy || !answer.trim()}>
                    {busy ? '…' : t('puzzleSubmit')}
                  </button>
                </form>
              ) : null}
              {onSiteMsg && (
                <div className={`trivia-explain ${onSiteMsg.ok ? '' : 'wrong'}`} role="status">
                  <strong>{onSiteMsg.ok ? <Check size={16} strokeWidth={2} aria-hidden /> : <X size={16} strokeWidth={2} aria-hidden />} {onSiteMsg.text}</strong>
                  {onSiteExplain && <div className="trivia-explain-body">{pickTxt(onSiteExplain, lang)}</div>}
                </div>
              )}
              {stop.onSite.done && (
                <button type="button" className="btn-primary game-phase-next"
                  onClick={() => setPhase(tr && !res ? 'trivia' : 'story')}>
                  {t('continue')}
                </button>
              )}
            </div>
          )}

          {phase === 'trivia' && tr && (
            <div className="trivia-card">
              <div className="trivia-head"><GraduationCap size={18} strokeWidth={1.75} aria-hidden /> {t('quickQuiz')}</div>
              <p className="trivia-q typewriter" id={`quiz-${stop.id}`}>{pickTxt(tr.question, lang)}</p>
              <div className="trivia-opts" role="group" aria-labelledby={`quiz-${stop.id}`}>
                {tr.options.map((opt, i) => {
                  let cls = 'trivia-opt'
                  if (res) {
                    if (i === res.correctIndex) cls += ' correct'
                    else if (i === res.pickedIndex) cls += ' wrong'
                  }
                  return (
                    <button key={i} type="button" className={cls} onClick={() => pickTrivia(i)}
                      disabled={busy || !!res} aria-pressed={res ? i === res.pickedIndex : undefined}>
                      {pickTxt(opt, lang)}
                    </button>
                  )
                })}
              </div>
              {res && (
                <div className={`trivia-explain ${res.correct ? '' : 'wrong'}`} role="status">
                  <strong>{res.correct ? <><Check size={16} strokeWidth={2} aria-hidden /> {t('quizCorrect')}</> : <><X size={16} strokeWidth={2} aria-hidden /> {t('notQuite')}</>}</strong>
                  {res.explain && <div className="trivia-explain-body">{pickTxt(res.explain, lang)}</div>}
                </div>
              )}
              {res && (
                <button type="button" className="btn-primary game-phase-next" onClick={() => setPhase('story')}>
                  {t('continue')}
                </button>
              )}
            </div>
          )}

          {phase === 'story' && (
            <>
              {!stop.offline && (
                <div className="score-breakdown">
                  {rows.map(r => (
                    <div key={r.key} className="score-row">
                      <span className="score-row-label"><r.Icon size={16} strokeWidth={1.75} aria-hidden /> {r.label}</span>
                      <span className={r.value < 0 ? 'score-neg' : 'score-pos'}>{r.value > 0 ? `+${r.value}` : `−${-r.value}`}</span>
                    </div>
                  ))}
                  <div className="score-row-total">
                    <span className="score-row-label">{t('pointsEarned')}</span>
                    <span className="score-pos">{total}</span>
                  </div>
                </div>
              )}
              {evidence && (
                <div className="evidence-card">
                  <div className="evidence-label"><Search size={16} strokeWidth={1.75} aria-hidden /> {t('newEvidence')}</div>
                  <p className="evidence-text typewriter">{evidence}</p>
                </div>
              )}
              {stop.funFact && (
                <div className="fact-card">
                  <div className="fact-label">{t('didYouKnow')}</div>
                  <p className="fact-text">{pickTxt(stop.funFact, lang)}</p>
                </div>
              )}
            </>
          )}
        </div>

        {phase === 'story' && (
          <div className="arrival-footer">
            {!stop.offline && (
              <button type="button" onClick={share} className="btn-ghost btn-share">
                <Share2 size={18} strokeWidth={1.75} aria-hidden />
                {t('share')}
              </button>
            )}
            <button type="button" className="btn-primary btn-next" onClick={() => onNext(stop)}>
              {huntComplete ? t('seeFinal') : t('nextClue')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
