// components/ClueScreen.tsx
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

  // Watch real user position for map dot
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
    if (tier === 1) return <p style={{ fontSize: 13, lineHeight: 1.65, color: '#8b8aaa' }}>{clue.hint1}</p>
    if (tier === 2) return (
      <>
        <p style={{ fontSize: 13, lineHeight: 1.65, color: '#8b8aaa', marginBottom: 8 }}>{clue.hint2}</p>
        {clue.hint2PhotoUrl && (
          <img src={clue.hint2PhotoUrl} alt="Location hint"
            style={{ width: '100%', borderRadius: 7, maxHeight: 160, objectFit: 'cover' }} />
        )}
      </>
    )
    if (tier === 3) return (
      <p style={{ fontSize: 13, lineHeight: 1.65, color: '#8b8aaa' }}>
        {dynamicH3 ?? clue.hint3}
      </p>
    )
  }

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 292px',
      height: '100dvh', background: '#0d0d14', color: '#eeedf8',
      fontFamily: 'system-ui, sans-serif', position: 'relative', overflow: 'hidden',
    }}>
      {/* Map */}
      <div style={{ position: 'relative', height: '100%' }}>
        <MapView
          clue={clue}
          userLat={userPos?.lat ?? null}
          userLng={userPos?.lng ?? null}
          showTarget={showTarget}
        />
        {/* HUD pills */}
        <div style={{ position: 'absolute', top: 12, left: 12, right: 12, display: 'flex', justifyContent: 'space-between', pointerEvents: 'none' }}>
          <div style={pill('#22c97a', 'rgba(34,201,122,.2)')}>
            Clue {clue.order} of {clue.totalClues}
          </div>
          <div style={pill('#f5a54a', 'rgba(245,165,74,.15)')}>
            Score: {totalScore} pts
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

      {/* Side panel */}
      <div style={{
        background: '#161622', borderLeft: '1px solid rgba(255,255,255,.08)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Top bar */}
        <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid rgba(255,255,255,.08)', flexShrink: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Utrecht hunt</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Progress */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,.06)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: '#6c63f5', borderRadius: 2, width: `${((clue.order - 1) / clue.totalClues) * 100}%`, transition: 'width .6s' }} />
            </div>
            <span style={{ fontSize: 11, color: '#8b8aaa', whiteSpace: 'nowrap' }}>{clue.order - 1} / {clue.totalClues} done</span>
          </div>

          {/* Ring */}
          <ProximityRing distanceM={distanceM} bearing={bearing} arrived={arrived} accuracy={accuracy} />

          {gpsError && <p style={{ fontSize: 12, color: '#f05252', textAlign: 'center' }}>{gpsError}</p>}

          {/* Clue card */}
          <div style={{ background: '#1c1c2a', border: '1px solid rgba(255,255,255,.08)', borderRadius: 9, padding: 13 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.07em', color: '#56556a', marginBottom: 6 }}>Your clue</div>
            <p style={{ fontSize: 13, lineHeight: 1.65 }}>{clue.riddle}</p>
          </div>

          {/* Hints */}
          <div>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.07em', color: '#56556a', marginBottom: 8 }}>Hints</div>
            {hintRows.map(({ tier, label }) => {
              const unlocked = unlockedTiers.has(tier)
              const isOpen = openHint === tier

              return (
                <div key={tier} style={{
                  border: `1px solid ${unlocked ? 'rgba(108,99,245,.38)' : 'rgba(255,255,255,.08)'}`,
                  borderRadius: 8, marginBottom: 6, overflow: 'hidden', transition: 'border-color .2s',
                }}>
                  <div onClick={() => doUnlock(tier)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '9px 12px', cursor: 'pointer',
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
                    <span style={{ fontSize: 11, fontWeight: 500, color: unlocked ? '#22c97a' : '#908af8' }}>
                      {unlocked ? 'Unlocked' : 'Tap to reveal'}
                    </span>
                  </div>
                  {unlocked && isOpen && (
                    <div style={{ padding: '9px 12px', borderTop: '1px solid rgba(255,255,255,.07)' }}>
                      {hintContent(tier)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function pill(color: string, bg: string): React.CSSProperties {
  return {
    background: bg, border: `1px solid ${color}44`,
    borderRadius: 18, padding: '4px 12px', fontSize: 11, fontWeight: 500, color,
  }
}
