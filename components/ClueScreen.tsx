'use client'
import { useCallback, useEffect, useState } from 'react'
import { Clue, VerifyResponse } from '@/types'
import { useGPS } from '@/hooks/useGPS'
import { useCredits } from '@/hooks/useCredits'
import { MapView } from './MapView'
import { ProximityRing } from './ProximityRing'
import { ArrivalBanner } from './ArrivalBanner'

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

  const { unlockHint } = useCredits(initialCredits, sessionId)

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
    const ok = await unlockHint(clue.id, tier)
    if (ok) {
      setUnlockedTiers((prev) => new Set([...prev, tier]))
      setOpenHint(tier)
    }
  }

  const showTarget = unlockedTiers.has(2) || unlockedTiers.has(3)

  const hintRows: { tier: 1 | 2 | 3; label: string }[] = [
    { tier: 1, label: 'Neighbourhood clue' },
    { tier: 2, label: 'Photo hint' },
    { tier: 3, label: 'GPS nudge' },
  ]

  const hintContent = (tier: 1 | 2 | 3): React.ReactNode => {
    if (tier === 1) return <p>{clue.hint1}</p>
    if (tier === 2) return (
      <>
        <p style={{ marginBottom: clue.hint2PhotoUrl ? 8 : 0 }}>{clue.hint2}</p>
        {clue.hint2PhotoUrl && (
          <img src={clue.hint2PhotoUrl} alt="Location hint"
            style={{ width: '100%', borderRadius: 7, maxHeight: 160, objectFit: 'cover' }} />
        )}
      </>
    )
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
                    {unlocked ? 'Unlocked' : 'Tap to reveal'}
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
    </div>
  )
}
