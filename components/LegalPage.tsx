import type { ReactNode } from 'react'
import { LEGAL } from '@/lib/site'
import { Wordmark } from '@/components/Logo'

/** Shared shell for the privacy / terms / contact pages: a plain ruled sheet. */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="legal-page">
      <a href="#main" className="skip-link">Skip to content</a>
      <header className="legal-head">
        <a href="/" className="legal-back" aria-label="TourHunts home">
          <Wordmark size={30} />
        </a>
      </header>
      <main id="main" className="legal-body" tabIndex={-1}>
        <h1>{title}</h1>
        <p className="legal-updated">Last updated: {LEGAL.updated}</p>
        {children}
      </main>
      <footer className="legal-foot">
        <nav aria-label="Legal">
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="/contact">Contact</a>
        </nav>
      </footer>
    </div>
  )
}
