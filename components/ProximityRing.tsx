// components/ProximityRing.tsx
'use client'

const R = 52
const C = 2 * Math.PI * R   // ≈ 326.7

interface Props {
  distanceM: number | null
  bearing: number
  arrived: boolean
  accuracy: number | null
}

export function ProximityRing({ distanceM, bearing, arrived, accuracy }: Props) {
  const MAX  = 400
  const fill = distanceM === null ? 0 : Math.max(0, 1 - distanceM / MAX)
  const dash = (fill * C).toFixed(1)

  const needleX = 65 + 38 * Math.sin((bearing * Math.PI) / 180)
  const needleY = 65 - 38 * Math.cos((bearing * Math.PI) / 180)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg width="130" height="130" viewBox="0 0 130 130" style={{ overflow: 'visible' }}>
        {/* Track */}
        <circle cx="65" cy="65" r={R} fill="none"
          stroke="rgba(255,255,255,.06)" strokeWidth="9" />
        {/* Fill arc */}
        <circle cx="65" cy="65" r={R} fill="none"
          stroke={arrived ? '#22c97a' : '#6c63f5'}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${C.toFixed(1)}`}
          transform="rotate(-90 65 65)"
          style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1), stroke .4s' }}
        />
        {/* Direction needle (hidden when arrived or no reading yet) */}
        {!arrived && distanceM !== null && distanceM > 15 && (
          <line
            x1="65" y1="65"
            x2={needleX.toFixed(1)} y2={needleY.toFixed(1)}
            stroke="#6c63f5" strokeWidth="2.5" strokeLinecap="round"
            style={{ transition: 'x2 .9s ease, y2 .9s ease' }}
          />
        )}
        {/* Centre text */}
        {arrived ? (
          <>
            <text x="65" y="61" textAnchor="middle" fontSize="26"
              fill="#22c97a" fontFamily="system-ui" fontWeight="600">✓</text>
            <text x="65" y="78" textAnchor="middle" fontSize="11"
              fill="#22c97a" fontFamily="system-ui">arrived!</text>
          </>
        ) : (
          <>
            <text x="65" y="60" textAnchor="middle" fontSize="22"
              fill="#eeedf8" fontFamily="system-ui" fontWeight="600">
              {distanceM === null ? '…' : distanceM}
            </text>
            <text x="65" y="77" textAnchor="middle" fontSize="11"
              fill="#8b8aaa" fontFamily="system-ui">
              {distanceM === null ? 'locating' : 'metres'}
            </text>
          </>
        )}
      </svg>
      {accuracy !== null && (
        <span style={{ fontSize: 11, color: '#56556a' }}>GPS ±{accuracy}m</span>
      )}
    </div>
  )
}
