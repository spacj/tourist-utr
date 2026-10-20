import type { Metadata } from 'next'

// Admin-only form: keep it out of search results (also disallowed in robots.txt).
export const metadata: Metadata = {
  title: 'Edit spot',
  robots: { index: false, follow: false },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
