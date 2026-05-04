import type { Metadata, Viewport } from 'next'
import { Inter, Fraunces } from 'next/font/google'
import { AuthProvider } from '@/components/AuthProvider'
import { I18nProvider } from '@/hooks/useI18n'
import { PwaInstallBanner } from '@/components/PwaInstallBanner'
import { OfflineIndicator } from '@/components/OfflineIndicator'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
})

const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  weight: ['500', '600', '700'],
  variable: '--font-serif',
})

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://nl-tour.app'
const SITE_NAME = 'NL Grand Tour'
const DEFAULT_TITLE = 'Netherlands Grand Tour — GPS scavenger hunts in Dutch cities'
const DEFAULT_DESC = 'Self-guided GPS walking adventures through Utrecht, Amsterdam and beyond. Solve riddles, discover hidden stories, race friends in real-time multiplayer. €5 lifetime per city — first hunt free.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: '%s · NL Grand Tour',
  },
  description: DEFAULT_DESC,
  applicationName: SITE_NAME,
  authors: [{ name: 'NL Grand Tour' }],
  generator: 'Next.js',
  keywords: [
    'scavenger hunt', 'walking tour', 'GPS game', 'Netherlands tour', 'Utrecht tour',
    'Amsterdam walking tour', 'self-guided tour', 'city game', 'treasure hunt app',
    'Dutch cities', 'tourist activity Netherlands', 'multiplayer city game', 'family activity Utrecht',
  ],
  category: 'travel',
  referrer: 'origin-when-cross-origin',
  creator: 'NL Grand Tour',
  publisher: 'NL Grand Tour',
  formatDetection: { email: false, address: false, telephone: false },
  alternates: {
    canonical: SITE_URL,
    languages: {
      'en': SITE_URL,
      'nl': SITE_URL,
      'de': SITE_URL,
      'fr': SITE_URL,
      'it': SITE_URL,
      'es': SITE_URL,
      'x-default': SITE_URL,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    alternateLocale: ['nl_NL', 'de_DE', 'fr_FR', 'it_IT', 'es_ES'],
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
    ],
    apple: '/icon.svg',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'NL Tour',
    statusBarStyle: 'black-translucent',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0b0d1a',
}

const ORG_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/icon.svg`,
  sameAs: [],
}

const WEBSITE_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  url: SITE_URL,
  inLanguage: ['en', 'nl', 'de', 'fr', 'it', 'es'],
  potentialAction: {
    '@type': 'SearchAction',
    target: `${SITE_URL}/?q={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
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
            {children}
            <PwaInstallBanner />
            <OfflineIndicator />
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
