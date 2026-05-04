import type { Metadata, Viewport } from 'next'
import { Inter, Fraunces } from 'next/font/google'
import { AuthProvider } from '@/components/AuthProvider'
import { I18nProvider } from '@/hooks/useI18n'
import { PwaInstallBanner } from '@/components/PwaInstallBanner'
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

export const metadata: Metadata = {
  title: 'Netherlands Grand Tour — self-guided scavenger hunts',
  description: 'Explore the Netherlands one city at a time. GPS-guided walking adventures through historic Dutch cities — €5 lifetime access per city.',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body>
        <I18nProvider>
          <AuthProvider>
            {children}
            <PwaInstallBanner />
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  )
}
