import type { Metadata } from 'next'
import { LegalPage } from '@/components/LegalPage'
import { LEGAL } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Terms of use',
  description: 'The rules for playing TourHunts: prices, refunds, hint credits and playing safely.',
  alternates: { canonical: '/terms' },
}

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use">
      <p>
        These terms apply to TourHunts, offered by {LEGAL.name}{LEGAL.kvk ? ` (KvK ${LEGAL.kvk})` : ''},
        {' '}{LEGAL.address}. By playing you agree to them. Dutch law applies.
      </p>

      <h2>What you get</h2>
      <ul>
        <li>The first hunt in each city is free.</li>
        <li>
          A city pass (usually €5, the price is always shown before you pay) unlocks every hunt
          and tour in that city for your account, with no time limit and no subscription.
        </li>
        <li>
          Hint credits are optional. They are tied to the hunt you buy them in, and unused
          credits cannot be exchanged for money.
        </li>
      </ul>

      <h2>Refunds</h2>
      <p>
        If you are not happy with a city pass, email{' '}
        <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a> within 14 days of buying it and we will
        refund it, no questions asked. Hint credits that have already been spent are not refunded.
        If a payment ever goes through but your purchase is not activated, we refund it
        automatically.
      </p>

      <h2>Play safely</h2>
      <p>
        Hunts take place in public streets. Watch traffic, cyclists and canals, don&rsquo;t enter
        private property, and respect opening hours and local rules. Children should play with an
        adult. You take part at your own risk; we are not liable for injury, loss or damage while
        playing, except where the law does not allow us to exclude it.
      </p>

      <h2>Fair play</h2>
      <p>
        Faking your location or tampering with the game to climb leaderboards is not allowed. We
        may remove scores or close accounts that do so.
      </p>

      <h2>Content</h2>
      <p>
        We check our stops and stories carefully, but streets change: a shop closes, a statue is
        restored. If something is wrong, tell us and we&rsquo;ll fix it. Riddles, texts and
        images are ours or used with permission. Please don&rsquo;t copy them.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms. If a change affects something you have already paid for, we
        will tell you first.
      </p>
    </LegalPage>
  )
}
