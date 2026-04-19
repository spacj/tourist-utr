'use client'

interface Props {
  locationName: string
  pointsEarned: number
  timeBonus: number
  hintPenalty: number
  huntComplete: boolean
  onNext: () => void
}

export function ArrivalBanner({ locationName, pointsEarned, timeBonus, hintPenalty, huntComplete, onNext }: Props) {
  return (
    <div className="arrival-backdrop">
      <div className="arrival-card">
        <div style={{
          width: 54, height: 54, borderRadius: '50%',
          background: 'rgba(34,201,122,.1)', border: '1px solid rgba(34,201,122,.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 14px',
        }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
            stroke="#22c97a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 3 }}>You made it!</h2>
        <p style={{ fontSize: 13, color: '#8b8aaa', marginBottom: 16 }}>{locationName}</p>

        <div style={{
          background: '#1c1c2a', borderRadius: 8, padding: '11px 12px',
          marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 7,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: '#8b8aaa' }}>Base score</span><span>+100</span>
          </div>
          {timeBonus > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: '#8b8aaa' }}>Speed bonus</span>
              <span style={{ color: '#22c97a' }}>+{timeBonus}</span>
            </div>
          )}
          {hintPenalty > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: '#8b8aaa' }}>Hints used</span>
              <span style={{ color: '#f05252' }}>-{hintPenalty}</span>
            </div>
          )}
          <div style={{
            display: 'flex', justifyContent: 'space-between', fontSize: 14,
            borderTop: '1px solid rgba(255,255,255,.07)', paddingTop: 7, fontWeight: 600,
          }}>
            <span style={{ color: '#8b8aaa' }}>Points earned</span>
            <span>{pointsEarned}</span>
          </div>
        </div>

        <button className="btn-primary" onClick={onNext}>
          {huntComplete ? 'See final score' : 'Next clue →'}
        </button>
      </div>
    </div>
  )
}
