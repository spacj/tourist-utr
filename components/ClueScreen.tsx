'use client'
import { useCallback, useEffect, useState } from 'react'
import { Clue, VerifyResponse } from '@/types'
import { useGPS } from '@/hooks/useGPS'
import { useCredits } from '@/hooks/useCredits'
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
  const [arrived,       setArrived]       = useState(false)
  const [arrivalData,   setArrivalData]   = useState<VerifyResponse | null>(null)
  const [userPos,       setUserPos]       = useState<{ lat: number; lng: number } | null>(null)
  const [unlockedTiers, setUnlockedTiers] = useState<Set<number>>(new Set())
  const [openHint,      setOpenHint]      = useState<number | null>(null)
  const [shopOpen,      setShopOpen]      = useState(false)

  const { credits, canAfford, unlockHint, startCheckout } = useCredits(initialCredits, sessionId)

  const handleArrived = useCallback((data: VerifyResponse) => {
    setArrived(true)
    setArrivalData(data)
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

  const showTarget = unlockedTiers.has(3)

  const hintRows: { tier: 1 | 2 | 3; label: string }[] = [
    { tier: 1, label: 'Neighbourhood clue' },
    { tier: 2, label: 'Street-level hint' },
    { tier: 3, label: 'Show on map' },
  ]

  const hintContent = (tier: 1 | 2 | 3): React.ReactNode => {
    if (tier === 1) return <p>{clue.hint1}</p>
    if (tier === 2) return <p>{clue.hint2}</p>
    if (tier === 3) return <p>{dynamicH3 ?? clue.hint3}</p>
  }

  return (
    <div className="game-layout">
      {/* Map */}
      <div className="game-map">
        <MapView
          clue={clue}
          userLat={userPos?.lat ?? null}
          userLng={userPos?.lng ?? null}
          showTarget={showTarget}
        />
        <div className="game-hud">
          <div className="hud-pill" style={{ background: 'rgba(34,201,122,.2)', color: '#22c97a', border: '1px solid rgba(34,201,122,.25)' }}>
            Clue {clue.order}/{clue.totalClues}
          </div>
          <div className="hud-pill" style={{ background: 'rgba(108,99,245,.15)', color: '#908af8', border: '1px solid rgba(108,99,245,.25)', pointerEvents: 'auto', cursor: 'pointer' }} onClick={() => setShopOpen(true)}>
            {credits} credits
          </div>
          <div className="hud-pill" style={{ background: 'rgba(245,165,74,.15)', color: '#f5a54a', border: '1px solid rgba(245,165,74,.25)' }}>
            {totalScore} pts
          </div>
        </div>

        {arrived && arrivalData && (
          <ArrivalBanner
            locationName={clue.locationName}
            pointsEarned={arrivalData.pointsEarned ?? 0}
            timeBonus={arrivalData.timeBonus ?? 0}
            hintPenalty={arrivalData.hintPenalty ?? 0}
            huntComplete={arrivalData.huntComplete ?? false}
            onNext={() => onComplete({ nextClue: arrivalData.nextClue ?? null, huntComplete: arrivalData.huntComplete ?? false })}
          />
        )}
      </div>

      {/* Bottom sheet (becomes side panel on desktop) */}
      <div className="bottom-sheet">
        <div className="sheet-handle" />

        <div className="progress-wrap">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${((clue.order - 1) / clue.totalClues) * 100}%` }} />
          </div>
          <span className="progress-text">{clue.order - 1}/{clue.totalClues}</span>
        </div>

        {/* Debug: skip to location */}
        {!arrived && (
          <button onClick={fakeArrive} className="btn-secondary" style={{ fontSize: 12, padding: 8, color: '#f5a54a', borderColor: 'rgba(245,165,74,.25)' }}>
            ⚡ Skip to location (test mode)
          </button>
        )}

        {/* Ring + GPS */}
        <div className="ring-stats">
          <ProximityRing distanceM={distanceM} bearing={bearing} arrived={arrived} accuracy={accuracy} />
          {gpsError && <p style={{ fontSize: 12, color: '#f05252', textAlign: 'center' }}>{gpsError}</p>}
        </div>

        {/* Clue */}
        <div className="clue-card">
          <div className="clue-label">Your clue</div>
          <p className="clue-text">{clue.riddle}</p>
        </div>

        {/* Hints */}
        <div>
          <div className="clue-label" style={{ marginBottom: 8 }}>Hints</div>
          {hintRows.map(({ tier, label }) => {
            const unlocked = unlockedTiers.has(tier)
            const isOpen = openHint === tier

            return (
              <div key={tier} className={`hint-row ${unlocked ? 'unlocked' : ''}`}>
                <div className="hint-header" onClick={() => doUnlock(tier)}>
                  <span className="hint-label">{label}</span>
                  <span className="hint-status" style={{ color: unlocked ? '#22c97a' : '#908af8' }}>
                    {unlocked ? 'Unlocked' : HINT_COSTS[tier] > 0 ? `${HINT_COSTS[tier]} credits` : 'Free'}
                  </span>
                </div>
                {unlocked && isOpen && (
                  <div className="hint-body">{hintContent(tier)}</div>
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
