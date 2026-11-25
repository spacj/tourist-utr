# Creator marketplace

Anyone with an account can build a hunt in the studio, send it for review and
earn from every sale. House hunts (seeded from `scripts/seed-data`) are
unchanged: €5, PayPal, and the free first hunt can only be spent on them.

## How it fits together

| Step | Where |
|---|---|
| Become a creator (profile, creator terms) | `/create` → `POST /api/creator/profile` → `creators/{uid}`, `creatorSlugs/{slug}` |
| Build a hunt (autosaved draft, map pins, validation) | `/studio`, `/studio/hunts/[id]` → `/api/studio/hunts*` → `huntDrafts/{id}` (server-only) |
| Send for review | `POST /api/studio/hunts/[id]/submit` (blocked until `validateDraft` passes) |
| Review, translate, publish | `/admin?tab=reviews` → `/admin/review/[id]` → `lib/publishDraft.ts` |
| Payouts | Stripe Connect Express, `POST /api/creator/stripe` (onboard / refresh / dashboard) |
| Buy | `POST /api/hunt-unlocks/checkout` → Stripe Checkout for creator hunts (destination charge) |
| Grant + ledger | `/api/stripe/return` and `/api/stripe/webhook` → `lib/creatorPayments.ts` → `huntUnlocks`, `payments`, `sales` |
| Owner dashboard | `/admin` (overview, reviews, creators, sales + refunds, payment issues, yearly CSV) |

Publishing writes `hunts/{id}` + `hunts/{id}/clues` in exactly the seeder's
shape (`lib/huntDraft.ts › buildPublishedHunt`), so the game engine plays
creator hunts unchanged. A creator hunt is listed (`active`) only when the
draft is live, the creator can take payments and is not suspended; buyers
keep access when it is unlisted.

**Money per €7 sale** (`lib/revenueSplit.ts`): VAT 21% out (€1.21), 3% payment
fee on the price (€0.21), 20% commission on the price excl. VAT (€1.16), the
creator gets €4.42. Rates: `PLATFORM_COMMISSION_BPS`, `PAYMENT_FEE_BPS`,
`VAT_RATE_BPS`; per-creator commission from the dashboard.

## One-time setup

1. **Stripe**
   - Enable Connect (platform, Express accounts) in the Stripe dashboard; set the
     platform profile and branding.
   - Turn on the payment methods you want for Checkout (cards, iDEAL, Bancontact, wallets).
   - Webhook endpoint `https://www.tourhunts.com/api/stripe/webhook`:
     - "Your account" events: `checkout.session.completed`,
       `checkout.session.async_payment_succeeded`, `charge.refunded`,
       `charge.dispute.closed` → secret in `STRIPE_WEBHOOK_SECRET`.
     - "Connected accounts" events: `account.updated` → secret in
       `STRIPE_CONNECT_WEBHOOK_SECRET`.
   - `STRIPE_SECRET_KEY` (test key first; production refuses `sk_test_` unless `STRIPE_ALLOW_TEST=true`).
2. **Firebase Storage** (cover photos): enable Storage in the Firebase console, then
   `firebase deploy --only storage` (rules in `storage.rules`).
3. **Claude** (translations): `ANTHROPIC_API_KEY`. Each approval makes five requests to
   `claude-opus-5-5`.
4. **Email** (optional): `RESEND_API_KEY`, `EMAIL_FROM` (verified domain), `ADMIN_NOTIFY_EMAIL`.
5. **Admin access**: `npm run set-admin -- you@example.com`, then sign out and in.

All variables are listed in `.env.example`.

## Day to day

- **Review**: open `/admin`, the overview says how many hunts wait. Check that
  stops are public, safe and reachable, facts are right, nothing is copied.
  "Approve and publish" translates and publishes (a minute or two). "Send back"
  emails the creator your notes.
- **New city requested**: add the city document in Firestore (`cities/{id}`,
  like the seed data, `active: true`) first, then pick it when approving.
- **Refund a creator sale**: `/admin?tab=sales` → Refund. The player loses
  access and the creator's share is reversed.
- **DAC7**: in January download last year's CSV from the overview for the
  accountant.

## Not built yet

- Creators editing the translations themselves.
- Test-playing a draft before review.
- Ratings/reviews, mystery hunts in the editor, the studio UI in other languages.
- Per-country VAT (OSS): one configured rate is used for now.
