'use client'

/**
 * Last-resort boundary: replaces the root layout, so no providers, fonts or
 * stylesheets are available — inline styles and plain English only.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#F5F0E6', color: '#23201B', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <main role="alert" style={{ maxWidth: 420, padding: 24, textAlign: 'center' }}>
          <div aria-hidden style={{ fontSize: 48 }}>🧭</div>
          <h1 style={{ fontSize: 24, margin: '12px 0 8px' }}>Something went wrong</h1>
          <p style={{ fontSize: 16, lineHeight: 1.5, color: '#5E574B', margin: '0 0 20px' }}>
            TourHunts hit an unexpected error. Your hunt progress is saved — try again, or head back home.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button type="button" onClick={reset} style={{ minHeight: 46, padding: '0 20px', border: 0, borderRadius: 12, background: '#C2410C', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
              Try again
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" style={{ minHeight: 46, padding: '0 20px', display: 'inline-flex', alignItems: 'center', borderRadius: 12, border: '1px solid rgba(43,38,30,0.26)', color: '#23201B', fontSize: 16, fontWeight: 600, textDecoration: 'none' }}>
              Home
            </a>
          </div>
        </main>
      </body>
    </html>
  )
}
