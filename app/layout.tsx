import type { Metadata, Viewport } from 'next'
import { Instrument_Sans, Young_Serif, Courier_Prime } from 'next/font/google'
import { AuthProvider } from '@/components/AuthProvider'
import { I18nProvider } from '@/hooks/useI18n'
import { PwaInstallBanner } from '@/components/PwaInstallBanner'
import { OfflineIndicator } from '@/components/OfflineIndicator'
import { ConsentManager } from '@/components/ConsentManager'
import { ToastProvider } from '@/components/Toast'
import { SITE_URL, SITE_NAME } from '@/lib/site'
import './globals.css'
import './styles/components.css'
import './styles/flows.css'
import './styles/game.css'

// Google Analytics 4 and AdSense. Production-only, and loaded by
// <ConsentManager> only after the visitor opts in (GDPR/ePrivacy).
const IS_PROD = process.env.NODE_ENV === 'production'
const GA_ID = IS_PROD ? (process.env.NEXT_PUBLIC_GA_ID || 'G-KQ3MX9KC6G') : null
const ADSENSE_CLIENT = IS_PROD ? (process.env.NEXT_PUBLIC_ADSENSE_CLIENT || 'ca-pub-7503389769071622') : null

// Field-notebook type: a crisp grotesk for UI, a warm display serif for
// headings, and a typewriter face for clues and case notes.
const sans = Instrument_Sans({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-sans',
})

const display = Young_Serif({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  weight: '400',
  variable: '--font-serif',
})

const typewriter = Courier_Prime({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  weight: ['400', '700'],
  variable: '--font-mono',
})

const DEFAULT_TITLE = 'TourHunts — puzzle walks through Dutch cities'
const DEFAULT_DESC = 'Walk Utrecht, Amsterdam, Delft and more with a phone full of riddles. Crack each clue, find the place, hear its story. Your first hunt in every city is free; €5 unlocks the rest of that city.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: '%s · TourHunts',
  },
  description: DEFAULT_DESC,
  applicationName: SITE_NAME,
  authors: [{ name: 'TourHunts' }],
  generator: 'Next.js',
  keywords: [
    'scavenger hunt', 'city puzzle walk', 'self-guided walking tour',
    'Utrecht scavenger hunt', 'Utrecht walking tour', 'Amsterdam scavenger hunt',
    'Delft city game', 'Leiden walking tour', 'Haarlem scavenger hunt',
    'family activity Netherlands', 'outdoor escape game', 'treasure hunt app',
  ],
  category: 'travel',
  referrer: 'origin-when-cross-origin',
  creator: 'TourHunts',
  publisher: 'TourHunts',
  formatDetection: { email: false, address: false, telephone: false },
  // No site-wide canonical: each page declares its own (a layout-level
  // canonical would tell Google every page is the homepage). Languages share
  // one URL (client-side switch), so no hreflang alternates either.
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESC,
  },
  twitter: {
    card: 'summary_large_image',
    title: DEFAULT_TITLE,
    description: DEFAULT_DESC,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'TourHunts',
    statusBarStyle: 'default',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Allow pinch-zoom for accessibility (WCAG 2.5.5 / 1.4.4). Inputs use 16px
  // font so iOS Safari won't auto-zoom on focus.
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: '#F5F0E6',
}

const ORG_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/icon-512.png`,
  sameAs: [],
}

const WEBSITE_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  url: SITE_URL,
  inLanguage: ['en', 'nl', 'de', 'fr', 'it', 'es'],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} ${typewriter.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_JSONLD) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_JSONLD) }}
        />
      </head>
      <body>
        <I18nProvider>
          <AuthProvider>
            <ToastProvider>
              <ConsentManager gaId={GA_ID} adsClient={ADSENSE_CLIENT}>
                {children}
                <PwaInstallBanner />
                <OfflineIndicator />
              </ConsentManager>
            </ToastProvider>
          </AuthProvider>
        </I18nProvider>
        <script dangerouslySetInnerHTML={{ __html: `
          if('serviceWorker' in navigator){
            window.addEventListener('load',function(){
              navigator.serviceWorker.register('/sw.js').catch(function(){})
            })
          }
        ` }} />

      </body>
    </html>
  )
}
