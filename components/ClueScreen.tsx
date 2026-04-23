'use client'
import { useCallback, useEffect, useState } from 'react'
import { Clue, VerifyResponse } from '@/types'
import { useGPS } from '@/hooks/useGPS'
import { useCredits } from '@/hooks/useCredits'
import { useI18n } from '@/hooks/useI18n'
import { MapView } from './MapView'
import { ProximityRing } from './ProximityRing'
import { ArrivalBanner } from './ArrivalBanner'
import { CreditShop } from './CreditShop'
import { HINT_COSTS } from '@/types'

interface Props {
  clue: Clue
  sessionId: string
  initialCredits: number
  totalScore: number
  onComplete: (result: { nextClue: Clue | null; huntComplete: boolean }) => void
}

export function ClueScreen({ clue, sessionId, initialCredits, totalScore, onComplete }: Props) {
  const { t } = useI18n()
  const [arrived,       setArrived]       = useState(false)
  const [arrivalData,   setArrivalData]   = useState<VerifyResponse | null>(null)
  const [userPos,       setUserPos]       = useState<{ lat: number; lng: number } | null>(null)
  const [unlockedTiers, setUnlockedTiers] = useState<Set<number>>(new Set())
  const [openHint,      setOpenHint]      = useState<number | null>(null)
  const [shopOpen,      setShopOpen]      = useState(false)
  const [showIntro,     setShowIntro]     = useState(true)
  const [reading,       setReading]       = useState(false)
  const [score,         setScore]         = useState(totalScore)

  const { credits, canAfford, unlockHint, startCheckout } = useCredits(initialCredits, sessionId)

  // Hide intro after 2.8s auto-dismiss and reset local state per-clue
  useEffect(() => {
    setShowIntro(true)
    setArrived(false)
    setArrivalData(null)
    setUnlockedTiers(new Set())
    setOpenHint(null)
    setScore(totalScore)
    const id = setTimeout(() => setShowIntro(false), 2800)
    return () => clearTimeout(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clue.id])

  const handleArrived = useCallback((data: VerifyResponse) => {
    setArrived(true)
    setArrivalData(data)
    setScore(s => s + (data.pointsEarned ?? 0))
    // Stop any read-aloud
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
  }, [])

  const { distanceM, bearing, dynamicH3, gpsError, accuracy } = useGPS({
    sessionId, clueId: clue.id, enabled: !arrived, onArrived: handleArrived,
  })

  useEffect(() => {
    if (arrived) return
    const id = navigator.geolocation.watchPosition(
      (p) => setUserPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      undefined,
      { enableHighAccuracy: true }
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [arrived])

  const doUnlock = async (tier: 1 | 2 | 3) => {
    if (unlockedTiers.has(tier)) {
      setOpenHint(openHint === tier ? null : tier)
      return
    }
    if (!canAfford(tier)) {
      setShopOpen(true)
      return
    }
    const ok = await unlockHint(clue.id, tier)
    if (ok) {
      setUnlockedTiers((prev) => new Set([...prev, tier]))
      setOpenHint(tier)
      try { (navigator as any).vibrate?.(25) } catch {}
    }
  }

  const fakeArrive = async () => {
    const res = await fetch('/api/verify-location', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, clueId: clue.id, lat: clue.lat, lng: clue.lng }),
    })
    const data = await res.json() as VerifyResponse
    if (data.arrived) handleArrived(data)
  }

  // Web Speech API read-aloud — no files, no storage
  const toggleReadAloud = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    if (reading) {
      window.speechSynthesis.cancel()
      setReading(false)
      return
    }
    const utter = new SpeechSynthesisUtterance(clue.riddle)
    utter.rate = 0.95
    utter.pitch = 1
    utter.onend = () => setReading(false)
    utter.onerror = () => setReading(false)
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utter)
    setReading(true)
  }

  useEffect(() => () => {
    // Cleanup speech on unmount
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
  }, [])

  const showTarget = unlockedTiers.has(3)

  const hintRows: { tier: 1 | 2 | 3; label: string }[] = [
    { tier: 1, label: t('neighbourhoodClue') },
    { tier: 2, label: t('streetHint') },
    { tier: 3, label: t('showMap') },
  ]

  const hintContent = (tier: 1 | 2 | 3): React.ReactNode => {
    if (tier === 1) return <p>{clue.hint1}</p>
    if (tier === 2) return <p>{clue.hint2}</p>
    if (tier === 3) return <p>{dynamicH3 ?? clue.hint3}</p>
  }

  // Dot trail — one segment per clue
  const dots = Array.from({ length: clue.totalClues }, (_, i) => {
    const order = i + 1
    if (order < clue.order) return 'done'
    if (order === clue.order) return 'current'
    return ''
  })

  return (
    <div className="game-layout">
      {/* ── Clue intro card ── */}
      {showIntro && (
        <div className="intro-backdrop" onClick={() => setShowIntro(false)}>
          <div className="intro-card" onClick={(e) => e.stopPropagation()}>
            <div className="intro-stop">{t('stop')} {clue.order} {t('of')} {clue.totalClues}</div>
            <div className="intro-icon">{clue.icon ?? '📍'}</div>
            <div className="intro-theme">{clue.theme ?? t('getReady')}</div>
            <div className="intro-sub">{t('yourClue')}</div>
            <button className="btn-primary" onClick={() => setShowIntro(false)}>
              {t('continue')}
            </button>
          </div>
        </div>
      )}

      {/* Map */}
      <div className="game-map">
        <MapView
          clue={clue}
          userLat={userPos?.lat ?? null}
          userLng={userPos?.lng ?? null}
          showTarget={showTarget}
        />
        <div className="game-hud">
          <div className="hud-pill" style={{ background: 'rgba(245,194,74,.18)', color: '#f5c24a', border: '1px solid rgba(245,194,74,.3)' }}>
            {clue.icon ?? '📍'} {clue.order}/{clue.totalClues}
          </div>
          <div className="hud-pill" style={{ background: 'rgba(108,99,245,.15)', color: '#8e85ff', border: '1px solid rgba(108,99,245,.3)', pointerEvents: 'auto', cursor: 'pointer' }} onClick={() => setShopOpen(true)}>
            💎 {credits}
          </div>
          <div className="hud-pill" style={{ background: 'rgba(245,165,74,.15)', color: '#f5a54a', border: '1px solid rgba(245,165,74,.3)' }}>
            ⭐ {score}
          </div>
        </div>

        {arrived && arrivalData && (
          <ArrivalBanner
            locationName={clue.locationName}
            pointsEarned={arrivalData.pointsEarned ?? 0}
            timeBonus={arrivalData.timeBonus ?? 0}
            streakBonus={arrivalData.streakBonus ?? 0}
            perfectBonus={arrivalData.perfectBonus ?? 0}
            hintPenalty={arrivalData.hintPenalty ?? 0}
            funFact={clue.funFact}
            trivia={clue.trivia ?? null}
            huntComplete={arrivalData.huntComplete ?? false}
            onNext={() => onComplete({ nextClue: arrivalData.nextClue ?? null, huntComplete: arrivalData.huntComplete ?? false })}
            onTriviaCorrect={() => setScore(s => s + 25)}
          />
        )}
      </div>

      {/* Bottom sheet */}
      <div className="bottom-sheet">
        <div className="sheet-handle" />

        {/* Dot trail */}
        <div className="dot-trail">
          {dots.map((state, i) => (
            <div key={i} className={`dot ${state}`} />
          ))}
          <span className="dot-trail-label">{clue.order - 1}/{clue.totalClues}</span>
        </div>

        {/* Debug: skip to location */}
        {!arrived && (
          <button onClick={fakeArrive} className="btn-ghost" style={{ justifyContent: 'center' }}>
            ⚡ {t('skipTest')}
          </button>
        )}

        {/* Ring + GPS */}
        <div className="ring-stats">
          <ProximityRing distanceM={distanceM} bearing={bearing} arrived={arrived} accuracy={accuracy} />
          {gpsError && <p style={{ fontSize: 12, color: 'var(--red)', textAlign: 'center' }}>{gpsError}</p>}
        </div>

        {/* Clue card */}
        <div className="clue-card">
          <div className="clue-card-header">
            <div className="clue-icon">{clue.icon ?? '📍'}</div>
            <div style={{ textAlign: 'right' }}>
              <div className="clue-label">{t('yourClue')}</div>
              {clue.theme && <div className="clue-theme">{clue.theme}</div>}
            </div>
          </div>
          <p className="clue-text">{clue.riddle}</p>
          <div className="clue-actions">
            <button
              className={`btn-ghost ${reading ? 'active' : ''}`}
              onClick={toggleReadAloud}
              aria-label={t('readAloud')}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                {reading ? <path d="M15.5 8.5a5 5 0 0 1 0 7" /> : <><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M19 5a9 9 0 0 1 0 14" /></>}
              </svg>
              {reading ? '…' : t('readAloud')}
            </button>
          </div>
        </div>

        {/* Hints */}
        <div>
          <div className="clue-label" style={{ marginBottom: 8 }}>{t('hints')}</div>
          {hintRows.map(({ tier, label }) => {
            const unlocked = unlockedTiers.has(tier as 1 | 2 | 3)
            const isOpen = openHint === tier

            return (
              <div key={tier} className={`hint-row ${unlocked ? 'unlocked' : ''}`}>
                <div className="hint-header" onClick={() => doUnlock(tier as 1 | 2 | 3)}>
                  <span className="hint-label">{label}</span>
                  <span className="hint-status" style={{ color: unlocked ? 'var(--green)' : HINT_COSTS[tier] === 0 ? 'var(--gold)' : 'var(--primary-2)' }}>
                    {unlocked ? t('unlocked') : HINT_COSTS[tier] > 0 ? `${HINT_COSTS[tier]} ${t('credits')}` : t('free')}
                  </span>
                </div>
                {unlocked && isOpen && (
                  <div className="hint-body">{hintContent(tier as 1 | 2 | 3)}</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {shopOpen && (
        <CreditShop
          credits={credits}
          onBuy={(pkgId) => startCheckout(pkgId)}
          onClose={() => setShopOpen(false)}
        />
      )}
    </div>
  )
}
