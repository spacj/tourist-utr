import type { Metadata } from 'next'
import { LegalPage } from '@/components/LegalPage'
import { LEGAL } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: 'What TourHunts collects when you play, why, and how to get it deleted.',
  alternates: { canonical: '/privacy' },
}

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy">
      <p>
        TourHunts is run by {LEGAL.name}{LEGAL.kvk ? ` (KvK ${LEGAL.kvk})` : ''}, {LEGAL.address}.
        We are the controller of the personal data described here. Questions or requests:{' '}
        <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>.
      </p>

      <h2>What we collect, and why</h2>
      <ul>
        <li>
          <strong>Your account.</strong> If you sign in with Google or email we store your name,
          email address and profile photo (if any) so we can save your progress and show your name
          on leaderboards. Without signing in you play under an anonymous ID stored on your device.
        </li>
        <li>
          <strong>Your location, during a hunt only.</strong> While a hunt is running, your phone
          sends its position to us so we can check whether you have reached the next stop. We keep
          the time you reached each stop, not a track of where you walked. Location is never
          used when you are not playing.
        </li>
        <li>
          <strong>Game progress.</strong> Stops reached, puzzles solved, hints used, scores, XP and
          multiplayer rooms you joined.
        </li>
        <li>
          <strong>Purchases.</strong> Payments are handled by PayPal. We receive the order
          number, amount and status, never your card or bank details.
        </li>
        <li>
          <strong>Analytics and ads (only with your consent).</strong> Google Analytics shows us
          which pages and hunts people use; Google AdSense may show ads on blog pages. Both are off
          until you accept them in the cookie dialog, and ads never appear during a game.
        </li>
      </ul>

      <h2>Legal basis</h2>
      <p>
        Account, progress, location checks and purchases: to provide the service you asked for
        (performance of a contract). Analytics and ads: your consent, which you can withdraw at any
        time via &ldquo;Cookie settings&rdquo; in the footer.
      </p>

      <h2>Who else processes your data</h2>
      <ul>
        <li>Google Firebase (authentication and database, EU/US, covered by the EU–US Data Privacy Framework)</li>
        <li>PayPal (payments)</li>
        <li>Google Analytics and AdSense (only with consent)</li>
        <li>Our hosting provider, which serves the website</li>
      </ul>

      <h2>How long we keep it</h2>
      <p>
        Account and progress data: until you delete your account. Payment records: 7 years, as
        Dutch tax law requires. Anonymous guest progress: removed after 12 months of inactivity.
      </p>

      <h2>Your rights</h2>
      <p>
        You can ask to see, correct, export or delete your data, or object to its use. Email{' '}
        <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a> and we will reply within 30 days. You
        may also complain to the Dutch data protection authority, the{' '}
        <a href="https://www.autoriteitpersoonsgegevens.nl" rel="noopener">Autoriteit Persoonsgegevens</a>.
      </p>

      <h2>Cookies and local storage</h2>
      <p>
        Essential storage keeps you signed in, remembers your language and lets a hunt continue
        offline. Everything else follows your choice in the cookie dialog.
      </p>
    </LegalPage>
  )
}
