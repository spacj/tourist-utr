import { ImageResponse } from 'next/og'

/** Shared 1200×630 social card in the field-notebook style. */
export const ogSize = { width: 1200, height: 630 }

const INK = '#23201B'
const PAPER = '#F5F0E6'
const CANAL = '#2E6A58'
const BRICK = '#A33B2B'

export function renderOg({
  eyebrow, title, note, footer,
}: { eyebrow: string; title: string; note?: string; footer?: string }) {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: PAPER, padding: 48 }}>
        <div
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            border: `6px solid ${INK}`, borderRadius: 28, padding: '48px 56px', color: INK,
            fontFamily: 'serif',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <svg width="56" height="56" viewBox="0 0 512 512">
                <rect x="40" y="40" width="432" height="432" rx="84" fill="none" stroke={INK} strokeWidth="26" />
                <path d="M128 372 C 150 300, 230 330, 236 262 S 300 176, 344 168" fill="none" stroke={CANAL} strokeWidth="26" strokeLinecap="round" strokeDasharray="2 44" />
                <circle cx="128" cy="372" r="26" fill={CANAL} />
                <path d="M332 112 L 408 188 M 408 112 L 332 188" stroke={BRICK} strokeWidth="34" strokeLinecap="round" />
              </svg>
              <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: 0.5 }}>TourHunts</div>
            </div>
            <div style={{ fontSize: 24, color: CANAL, textTransform: 'uppercase', letterSpacing: 3 }}>{eyebrow}</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div style={{ fontSize: 76, lineHeight: 1.04, letterSpacing: -1.5, maxWidth: 980 }}>{title}</div>
            {note && (
              <div
                style={{
                  display: 'flex', fontSize: 28, lineHeight: 1.35, fontFamily: 'monospace',
                  color: '#5E574B', maxWidth: 960, borderLeft: `6px solid ${BRICK}`, paddingLeft: 22,
                }}
              >
                {note}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', fontSize: 24, color: '#5E574B' }}>
            {footer ?? 'First hunt in every city free · €5 unlocks the whole city'}
          </div>
        </div>
      </div>
    ),
    { ...ogSize },
  )
}
