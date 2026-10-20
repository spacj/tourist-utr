'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  pickTxt, type ActiveClueView, type ArrivalResponse, type CompletedClueView, type HintTier,
  type MysterySpec, type ClueEvidence,
} from '@/types'
import { useGPS, type GpsFix } from '@/hooks/useGPS'
import { useDeviceOrientation } from '@/hooks/useDeviceOrientation'
import { useCredits } from '@/hooks/useCredits'
import { useI18n } from '@/hooks/useI18n'
import { useIsAdmin } from '@/hooks/useIsAdmin'
import { useToast } from '@/components/Toast'
import { ConfirmDialog } from '@/components/Modal'
import { errorKey } from '@/lib/gameClient'
import { MapView } from './MapView'
import { ProximityRing } from './ProximityRing'
import { CreditShop } from './CreditShop'
import { PuzzleCard, type PuzzleSolved } from './PuzzleCard'
import { ClueHistory } from './ClueHistory'
import { CaseFile } from './CaseFile'
import { ClueHud } from './game/ClueHud'
import { HintList } from './game/HintList'
import { ClueNavigator, useNavReadout, useCheckInAvailable } from './game/ClueNavigator'
import { StopIntro, useTutorialState } from './game/StopIntro'
import { CheckInDialog } from './game/CheckInDialog'
import { useLocationCheck } from './game/useLocationCheck'

interface Props {
  clue: ActiveClueView
  huntId: string
  sessionId: string
  cityId: string | null
  credits: number
  score: number
  completed: CompletedClueView[]
  mystery: MysterySpec | null
  /** Evidence of stops reached but not yet in `completed` (mystery hunts). */
  extraEvidence: { id: string; evidence: ClueEvidence | null }[]
  /** False while the arrival flow is on screen — stops position checks. */
  active: boolean
  onArrived: (r: ArrivalResponse) => void
  onOfflineArrival: (fix: GpsFix) => void
  onClueUpdate: (view: ActiveClueView) => void
  onScore: (total: number) => void
}

type SheetState = 'minimized' | 'default' | 'expanded'

/** The "find" half of a stop: puzzle → navigation → walk there. */
export function ClueScreen({
  clue, huntId, sessionId, cityId, credits: creditsProp, score, completed, mystery, extraEvidence,
  active, onArrived, onOfflineArrival, onClueUpdate, onScore,
}: Props) {
  const { t, lang } = useI18n()
  const toast = useToast()
  const router = useRouter()
  const isAdmin = useIsAdmin()

  const [shopOpen, setShopOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [caseOpen, setCaseOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [checkInOpen, setCheckInOpen] = useState(false)
  const [introOpen, setIntroOpen] = useState(true)
  const [tutorialOpen, closeTutorial, openTutorial] = useTutorialState()
  const [sheetState, setSheetState] = useState<SheetState>('default')
  const [isOffline, setIsOffline] = useState(false)
  const [reading, setReading] = useState(false)
  const [solvedOffline, setSolvedOffline] = useState<string | null>(null)

  const { credits, unlock, unlocking, startCheckout } = useCredits(creditsProp, sessionId)
  const { fix, error: gpsError, retry: retryGps } = useGPS(true)
  const compass = useDeviceOrientation()

  // New stop → show its intro, reset per-stop UI.
  useEffect(() => {
    setIntroOpen(true)
    setCheckInOpen(false)
    setSheetState('default')
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
    setReading(false)
  }, [clue.id])

  useEffect(() => {
    const update = () => setIsOffline(typeof navigator !== 'undefined' && !navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  // Keep the screen awake while hunting.
  useEffect(() => {
    let lock: any = null
    let cancelled = false
    const acquire = async () => {
      try {
        const wl = (navigator as any).wakeLock
        if (!wl) return
        lock = await wl.request('screen')
        if (cancelled) lock?.release?.().catch(() => {})
      } catch {}
    }
    acquire()
    const onVis = () => { if (document.visibilityState === 'visible') acquire() }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVis)
      try { lock?.release?.() } catch {}
    }
  }, [])

  // Prime audio on the first gesture (iOS autoplay rules) for the chimes.
  useEffect(() => {
    const prime = () => {
      try {
        const AC = (window as any).AudioContext || (window as any).webkitAudioContext
        if (AC) { const ctx = new AC(); ctx.resume().then(() => ctx.close().catch(() => {})).catch(() => {}) }
      } catch {}
    }
    window.addEventListener('touchstart', prime, { once: true, passive: true })
    window.addEventListener('click', prime, { once: true })
    return () => {
      window.removeEventListener('touchstart', prime)
      window.removeEventListener('click', prime)
    }
  }, [])

  useEffect(() => () => { if (typeof window !== 'undefined') window.speechSynthesis?.cancel() }, [])

  const showError = useCallback((code: string) => toast.error(t(errorKey(code))), [toast, t])

  const loc = useLocationCheck({
    sessionId, clue, fix, enabled: active, onArrived, onOfflineArrival, onError: showError, onScore,
  })
  const readout = useNavReadout(clue, fix, { warmth: loc.warmth, distanceM: loc.distanceM, bearing: loc.bearing })
  const checkIn = useCheckInAvailable(clue, fix, gpsError)

  // ── Hints ──
  const doUnlock = async (tier: HintTier) => {
    const r = await unlock(clue.id, tier)
    if (r.ok) {
      if (r.data.clue) onClueUpdate(r.data.clue)
      if (tier === 3) toast.success(t('pinRevealedToast'))
      try { (navigator as any).vibrate?.(25) } catch {}
      return
    }
    if (r.code === 'busy') return
    if (r.code === 'insufficient_credits') {
      toast.info(t('errInsufficientCredits'))
      setShopOpen(true)
      return
    }
    showError(r.code)
  }

  const onPuzzleSolved = (r: PuzzleSolved) => {
    if (r.offline) { setSolvedOffline(clue.id); return }
    if (typeof r.totalScore === 'number') onScore(r.totalScore)
    if (r.clue) onClueUpdate(r.clue)
    if (r.bonus > 0) toast.success(t('puzzleSolvedToast'))
  }

  const toggleReadAloud = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    if (reading) { window.speechSynthesis.cancel(); setReading(false); return }
    const text = pickTxt(clue.riddle, lang)
    if (!text) return
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = lang
    utter.rate = 0.95
    utter.onend = () => setReading(false)
    utter.onerror = () => setReading(false)
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utter)
    setReading(true)
  }

  // ── Bottom sheet gestures ──
  const touchStartY = useRef<number | null>(null)
  const onHandleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return
    const dy = e.changedTouches[0].clientY - touchStartY.current
    touchStartY.current = null
    if (Math.abs(dy) < 24) return
    setSheetState(prev => dy > 0
      ? (prev === 'expanded' ? 'default' : 'minimized')
      : (prev === 'minimized' ? 'default' : 'expanded'))
  }
  const cycleSheet = () => setSheetState(prev =>
    prev === 'minimized' ? 'default' : prev === 'default' ? 'expanded' : 'minimized')

  const leave = () => router.push(cityId ? `/city/${cityId}` : '/')

  const closeIntro = useCallback(() => setIntroOpen(false), [])

  const dots = Array.from({ length: clue.totalClues }, (_, i) =>
    i + 1 < clue.order ? 'done' : i + 1 === clue.order ? 'current' : '')

  const riddle = pickTxt(clue.riddle, lang)
  const theme = pickTxt(clue.theme, lang)
  const knownEvidence = [
    ...completed.map(c => ({ id: c.id, evidence: c.evidence })),
    ...extraEvidence,
  ]

  return (
    <div className="game-layout">
      <StopIntro
        clue={clue}
        tutorialOpen={tutorialOpen}
        onTutorialClose={closeTutorial}
        introOpen={introOpen && active}
        onIntroClose={closeIntro}
      />

      <ClueHud
        icon={clue.icon}
        order={clue.order}
        totalClues={clue.totalClues}
        credits={credits}
        score={score}
        historyCount={completed.length}
        hasCase={!!mystery}
        onBack={() => setLeaveOpen(true)}
        onIntro={() => setIntroOpen(true)}
        onShop={() => setShopOpen(true)}
        onHistory={() => setHistoryOpen(true)}
        onCase={() => setCaseOpen(true)}
        onHelp={openTutorial}
      />

      {isOffline && (
        <div className="game-offline-banner" role="status">
          <span aria-hidden>📡</span> {t('offlineBanner')}
        </div>
      )}

      {historyOpen && <ClueHistory completedClues={completed} onClose={() => setHistoryOpen(false)} />}
      {caseOpen && mystery && (
        <CaseFile mystery={mystery} knownClues={knownEvidence} onClose={() => setCaseOpen(false)} />
      )}

      <div className="game-map">
        <MapView
          zone={clue.zone}
          showZone={clue.navigation !== 'compass'}
          target={clue.target}
          showPin={clue.showPin}
          userLat={fix?.lat ?? null}
          userLng={fix?.lng ?? null}
        />
        {active && sheetState === 'minimized' && (
          <button type="button" className="floating-compass" onClick={() => setSheetState('default')} aria-label={t('expand')}>
            <ProximityRing
              mode={readout.mode} distanceM={readout.distanceM} bearing={readout.bearing}
              warmth={readout.warmth} accuracy={fix?.accuracy ?? null} heading={compass.heading} compact
            />
          </button>
        )}
      </div>

      <div className={`bottom-sheet ${sheetState}`}>
        <button
          type="button"
          className="sheet-handle-btn"
          onClick={cycleSheet}
          onTouchStart={(e) => { touchStartY.current = e.touches[0].clientY }}
          onTouchEnd={onHandleTouchEnd}
          aria-label={sheetState === 'expanded' ? t('collapse') : t('expand')}
        >
          <div className="sheet-handle" />
          <span className="sheet-handle-hint">
            {sheetState === 'expanded' ? `▾ ${t('collapse')}`
              : sheetState === 'minimized' ? `▴ ${t('expand')}`
              : `▴ ${t('moreHints')}`}
          </span>
        </button>

        <div className="dot-trail" aria-label={`${t('stop')} ${clue.order} ${t('of')} ${clue.totalClues}`}>
          {dots.map((state, i) => <div key={i} className={`dot ${state}`} aria-hidden />)}
          <span className="dot-trail-label" aria-hidden>{clue.order - 1}/{clue.totalClues}</span>
        </div>

        {active && isAdmin && (
          <button type="button" onClick={loc.debugArrive} className="btn-ghost game-admin-skip">
            ⚡ {t('skipTest')}
          </button>
        )}

        <ClueNavigator
          readout={readout}
          fix={fix}
          gpsError={gpsError}
          onRetryGps={retryGps}
          heading={compass.heading}
          compassNeedsPermission={compass.needsPermission}
          onEnableCompass={async () => {
            const ok = await compass.requestPermission()
            if (!ok) toast.error(t('compassDenied'))
          }}
          poorAccuracy={checkIn.poor}
          canCheckIn={checkIn.available && active}
          onCheckIn={() => setCheckInOpen(true)}
        />

        {clue.puzzle ? (
          <PuzzleCard
            huntId={huntId}
            sessionId={sessionId}
            clue={clue}
            solvedOffline={solvedOffline === clue.id}
            onSolved={onPuzzleSolved}
            credits={credits}
            unlockingHint={unlocking === 'puzzle'}
            onUnlockHint={() => { void doUnlock('puzzle') }}
          />
        ) : (
          <div className="clue-card">
            <div className="clue-card-header">
              <div className="clue-icon" aria-hidden>{clue.icon ?? '📍'}</div>
              <div className="clue-card-titles">
                <div className="clue-label">{t('yourClue')}</div>
                {theme && <div className="clue-theme">{theme}</div>}
              </div>
            </div>
            <p className="clue-text">{riddle}</p>
            {riddle && (
              <div className="clue-actions">
                <button type="button" className={`btn-ghost ${reading ? 'active' : ''}`} onClick={toggleReadAloud} aria-pressed={reading}>
                  🔊 {reading ? t('stopReading') : t('readAloud')}
                </button>
              </div>
            )}
          </div>
        )}

        <HintList clue={clue} credits={credits} unlocking={unlocking} onUnlock={(tier) => { void doUnlock(tier) }} />
      </div>

      {shopOpen && (
        <CreditShop
          credits={credits}
          onBuy={async (pkgId) => {
            const r = await startCheckout(pkgId)
            if (!r.ok) showError(r.code ?? 'checkout_failed')
            return r.ok
          }}
          onClose={() => setShopOpen(false)}
        />
      )}

      <CheckInDialog
        open={checkInOpen}
        onClose={() => setCheckInOpen(false)}
        sessionId={sessionId}
        clueId={clue.id}
        fix={fix}
        onArrived={(r) => { setCheckInOpen(false); loc.markDone(); onArrived(r) }}
      />

      <ConfirmDialog
        open={leaveOpen}
        title={t('leaveHuntTitle')}
        body={t('leaveHuntBody')}
        confirmLabel={t('leaveHuntConfirmBtn')}
        cancelLabel={t('keepPlaying')}
        onConfirm={leave}
        onCancel={() => setLeaveOpen(false)}
      />
    </div>
  )
}
