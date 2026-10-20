import type { Metadata } from 'next'
import { LegalPage } from '@/components/LegalPage'
import { LEGAL } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Questions, refunds, a clue that no longer works, or an idea for a new hunt? Write to us.',
  alternates: { canonical: '/contact' },
}

export default function ContactPage() {
  return (
    <LegalPage title="Contact">
      <p>
        TourHunts is a small, independent project from Utrecht. A real person reads every
        message, usually within a day or two.
      </p>
      <p className="legal-cta">
        <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>
      </p>
      <h2>Handy to mention</h2>
      <ul>
        <li><strong>A clue that doesn&rsquo;t work:</strong> the hunt name and stop number. A photo helps a lot.</li>
        <li><strong>A refund:</strong> the email you signed in with and the city.</li>
        <li><strong>Group or school bookings:</strong> the date, the city and roughly how many players.</li>
      </ul>
      <p>
        {LEGAL.name}{LEGAL.kvk ? ` · KvK ${LEGAL.kvk}` : ''} · {LEGAL.address}
      </p>
    </LegalPage>
  )
}
