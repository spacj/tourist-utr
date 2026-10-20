import type { ReactNode } from 'react'
import { LEGAL } from '@/lib/site'

/** Shared shell for the privacy / terms / contact pages. */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="legal-page">
      <a href="/" className="legal-back">← TourHunts</a>
      <article className="legal-body">
        <h1>{title}</h1>
        <p className="legal-updated">Last updated: {LEGAL.updated}</p>
        {children}
      </article>
      <footer className="legal-foot">
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
        <a href="/contact">Contact</a>
      </footer>
    </main>
  )
}
