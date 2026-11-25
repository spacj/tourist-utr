import type { Metadata } from 'next'
import { LegalPage } from '@/components/LegalPage'
import { LEGAL } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Creator terms',
  description: 'The terms for publishing and selling your own hunts on TourHunts: review, payouts, commission, refunds and your content.',
  alternates: { canonical: '/creator-terms' },
}

// DRAFT — have these reviewed by a lawyer/accountant before launch
// (who is the VAT supplier under EU rules for platforms, DAC7 reporting,
// licence wording).
export default function CreatorTermsPage() {
  return (
    <LegalPage title="Creator terms">
      <p>
        These terms apply when you publish and sell hunts or walking tours (&ldquo;your hunts&rdquo;)
        on TourHunts, offered by {LEGAL.name}{LEGAL.kvk ? ` (KvK ${LEGAL.kvk})` : ''}, {LEGAL.address}.
        They come on top of our general <a href="/terms">terms of use</a>. Dutch law applies.
      </p>

      <h2>Who can be a creator</h2>
      <ul>
        <li>You must be at least 18 and able to receive payouts through Stripe in the country you choose.</li>
        <li>Your profile details must be true. Stripe will ask you to verify your identity before you can be paid.</li>
      </ul>

      <h2>Review and publishing</h2>
      <ul>
        <li>
          Every hunt, and every change to a published hunt, is reviewed by us before it goes live.
          We may ask for changes, or decline a hunt without having to give a reason.
        </li>
        <li>
          We translate approved hunts into the other languages of the app. You can correct a
          translation; corrections are reviewed again.
        </li>
        <li>
          We may unpublish a hunt at any time, for example when a stop is no longer safe or
          reachable, when players report problems, or when these terms are broken.
        </li>
      </ul>

      <h2>Price and earnings</h2>
      <ul>
        <li>You choose the price players pay for your hunt, between €1 and €50, including VAT.</li>
        <li>
          We sell your hunt to players in our own name. We collect the VAT on each sale and pay it
          to the tax authorities.
        </li>
        <li>
          From each sale you receive the price excluding VAT, minus our commission of 20% of the
          price excluding VAT and a payment fee of 3% of the price paid. Example: a €5 hunt with
          21% VAT is €4.13 excluding VAT; minus €0.83 commission and €0.15 payment fee, you
          receive €3.15. The VAT rate can differ by the player&rsquo;s country.
        </li>
        <li>
          Your share is paid to your Stripe account at the moment of each sale, and Stripe pays it
          out to your bank account. Stripe&rsquo;s own Connected Account Agreement also applies.
        </li>
        <li>
          Hint credits that players buy while playing your hunt are part of the app, not of your
          hunt; their revenue stays with us. Your hunt is never offered as anyone&rsquo;s free first hunt.
        </li>
        <li>
          If we refund a player (within our 14-day refund policy, because of a problem with the
          hunt, or because of a chargeback), your share of that sale is taken back.
        </li>
        <li>
          You are responsible for the income tax on your earnings, and, if you are VAT-registered,
          for any VAT you must account for on what we pay you. EU law (DAC7) requires us to report
          the earnings of sellers on our platform, with their identifying details, to the Dutch tax
          authority once a year.
        </li>
      </ul>

      <h2>Your content</h2>
      <ul>
        <li>
          You keep the rights to your hunts. You give us a non-exclusive, worldwide licence to
          host, show, translate, adapt for the app and promote them for as long as they are
          published, and to keep them playable for players who already bought them.
        </li>
        <li>
          Everything in your hunts must be your own work or used with permission: no copied
          texts, riddles or photos.
        </li>
        <li>
          Stops must be in public places that players can reach safely and legally. No private
          property, no dangerous spots, nothing that disturbs residents. Keep facts accurate and
          fix stops that change.
        </li>
        <li>No hateful, discriminatory, sexual or otherwise unlawful content.</li>
      </ul>

      <h2>Ending</h2>
      <p>
        You can unpublish your hunts at any time. Players who bought a hunt keep access to it. We
        may suspend a creator account that breaks these terms; earnings for sales that were not
        refunded remain yours.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms. We will tell you about important changes at least 30 days in
        advance by email. Questions: <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>.
      </p>
    </LegalPage>
  )
}
