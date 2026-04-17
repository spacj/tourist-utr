// components/ArrivalBanner.tsx
'use client'

interface Props {
  locationName: string
  pointsEarned: number
  timeBonus: number
  hintPenalty: number
  huntComplete: boolean
  onNext: () => void
}

const s: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'absolute', inset: 0,
    background: 'rgba(10,10,18,.9)', backdropFilter: 'blur(6px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 50, borderRadius: 14,
  },
  card: {
    background: '#161622', border: '1px solid rgba(255,255,255,.08)',
    borderRadius: 14, padding: '26px 22px', width: 264, textAlign: 'center',
  },
  icon: {
    width: 54, height: 54, borderRadius: '50%',
    background: 'rgba(34,201,122,.1)', border: '1px solid rgba(34,201,122,.3)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 14px',
  },
  h2: { fontSize: 18, fontWeight: 500, marginBottom: 3, color: '#eeedf8' },
  loc: { fontSize: 13, color: '#8b8aaa', marginBottom: 16 },
  rows: {
    background: '#1c1c2a', borderRadius: 8, padding: '11px 12px',
    marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 7,
  },
  row: { display: 'flex', justifyContent: 'space-between', fontSize: 13 },
  lbl: { color: '#8b8aaa' },
  divider: { borderTop: '1px solid rgba(255,255,255,.07)', paddingTop: 7, fontWeight: 600, fontSize: 14 },
  btn: {
    width: '100%', background: '#6c63f5', color: '#fff', border: 'none',
    borderRadius: 8, padding: 12, fontSize: 14, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit',
  },
}

export function ArrivalBanner({ locationName, pointsEarned, timeBonus, hintPenalty, huntComplete, onNext }: Props) {
  return (
    <div style={s.backdrop}>
      <div style={s.card}>
        <div style={s.icon}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
            stroke="#22c97a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 style={s.h2}>You made it!</h2>
        <p style={s.loc}>{locationName}</p>
        <div style={s.rows}>
          <div style={s.row}>
            <span style={s.lbl}>Base score</span><span>+100</span>
          </div>
          {timeBonus > 0 && (
            <div style={s.row}>
              <span style={s.lbl}>Speed bonus</span>
              <span style={{ color: '#22c97a' }}>+{timeBonus}</span>
            </div>
          )}
          {hintPenalty > 0 && (
            <div style={s.row}>
              <span style={s.lbl}>Hints used</span>
              <span style={{ color: '#f05252' }}>−{hintPenalty}</span>
            </div>
          )}
          <div style={{ ...s.row, ...s.divider }}>
            <span style={s.lbl}>Points earned</span>
            <span>{pointsEarned}</span>
          </div>
        </div>
        <button style={s.btn} onClick={onNext}>
          {huntComplete ? 'See final score' : 'Next clue →'}
        </button>
      </div>
    </div>
  )
}
