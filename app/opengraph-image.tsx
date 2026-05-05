import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'TourHunts — GPS-guided scavenger hunts in cities around the world'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #ff6a13 0%, #ff8a3d 50%, #ffa860 100%)',
          padding: '80px',
          color: 'white',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 64, height: 64,
              borderRadius: 16,
              background: 'rgba(255,255,255,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 36,
            }}
          >
            🧭
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 1 }}>TourHunts</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div
            style={{
              fontSize: 84,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -2,
              maxWidth: 900,
            }}
          >
            Self-guided GPS hunts in cities around the world.
          </div>
          <div style={{ fontSize: 30, opacity: 0.92, maxWidth: 900 }}>
            Solve riddles · Discover hidden stories · Race friends in real-time
          </div>
        </div>

        <div
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontSize: 22, opacity: 0.9,
          }}
        >
          <div>€5 lifetime per city · First hunt free</div>
          <div style={{ display: 'flex', gap: 12 }}>
            <span>🇬🇧</span><span>🇳🇱</span><span>🇩🇪</span>
            <span>🇫🇷</span><span>🇮🇹</span><span>🇪🇸</span>
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
