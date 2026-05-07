# Payment Setup — TourHunts

The codebase has PayPal Checkout fully wired:

- `lib/paypal.ts` — talks to the PayPal Orders v2 API + verifies webhooks
- `app/api/city-unlocks/checkout/route.ts` — creates an order, returns a PayPal approval URL
- `app/api/city-unlocks/capture/route.ts` — finalizes city unlock after the user approves
- `app/api/purchases/checkout/route.ts` + `capture/route.ts` — same flow for hint-credit packs
- `app/api/paypal/webhook/route.ts` — listens for `PAYMENT.CAPTURE.COMPLETED` + `PAYMENT.CAPTURE.REFUNDED` so unlocks/credits land even if the user closes the tab between paying and being redirected back

You just need to plug in PayPal credentials. Below is the full step-by-step.

---

## TL;DR — Going Live in 6 Steps

1. Create a PayPal **Live** app at https://developer.paypal.com → copy Client ID + Secret.
2. Add a **Webhook** to that app pointing at `https://yourdomain.com/api/paypal/webhook`. Subscribe to:
   - `PAYMENT.CAPTURE.COMPLETED`  (required — guarantees unlocks even if user closes tab)
   - `PAYMENT.CAPTURE.REFUNDED`  (recommended — auto-revokes unlocks on refund)
3. Copy the Webhook ID PayPal gives you back.
4. Set production env vars:
   ```
   PAYPAL_CLIENT_ID=<live client id>
   PAYPAL_CLIENT_SECRET=<live secret>
   PAYPAL_MODE=live
   PAYPAL_WEBHOOK_ID=<webhook id from step 3>
   NEXT_PUBLIC_SITE_URL=https://yourdomain.com
   ```
5. Deploy. The build will pick up the new env vars.
6. Run a single €5 city unlock with a real card to verify the end-to-end loop. Then refund it from PayPal to verify the refund webhook fires and the unlock disappears.

The rest of this document covers each step in detail, sandbox testing, security, taxes, troubleshooting, and how to add Stripe.

---

## Step 1 — Create a PayPal Developer account

1. Go to https://developer.paypal.com and click **Log in to Dashboard** (top right).
2. Sign in with your existing PayPal account, or create one. **Use a Business account** — money lands there. You can upgrade a Personal account inside PayPal.
3. Once logged in you land on the Developer Dashboard.

## Step 2 — Sandbox first (always test before going live)

Sandbox lets you test the full flow with fake credit cards and fake PayPal accounts.

1. **Apps & Credentials → Sandbox tab → Create App.**
2. Name it `TourHunts Sandbox`. Type: **Merchant**. Click **Create**.
3. On the app detail page, copy:
   - **Client ID** (long string starting with `A...`)
   - **Secret** — click **Show** to reveal.
4. **Add to `.env`:**
   ```env
   PAYPAL_CLIENT_ID=A...your-sandbox-client-id...
   PAYPAL_CLIENT_SECRET=E...your-sandbox-secret...
   PAYPAL_MODE=sandbox
   ```
5. Restart your dev server.

## Step 3 — Add a sandbox webhook (test the safety net)

1. On the same sandbox app page, scroll to **Webhooks** → **Add Webhook**.
2. Webhook URL: for local testing you need a public URL — use [ngrok](https://ngrok.com) or [localtunnel](https://localtunnel.github.io/www/).
   - Run `ngrok http 3000`
   - Use the `https://xxx.ngrok-free.app/api/paypal/webhook` URL
3. **Event types** — check exactly these two:
   - `PAYMENT.CAPTURE.COMPLETED`
   - `PAYMENT.CAPTURE.REFUNDED`
4. Save. PayPal returns a **Webhook ID**. Copy it.
5. **Add to `.env`:**
   ```env
   PAYPAL_WEBHOOK_ID=8YN12345AB6789012
   ```
6. Restart the dev server.

> **If you skip the webhook**, the app still works — but if a user closes their tab between paying and being redirected back, their unlock won't apply. That's why it's required for live mode.

## Step 4 — Test the city-unlock flow (sandbox)

1. Open the app (`http://localhost:3000` or your ngrok URL).
2. Sign in with Google.
3. Navigate to a paid city (e.g. Amsterdam).
4. Click **"Unlock all of Amsterdam — €5"**.
5. PayPal sandbox loads.
6. Sign in with a sandbox buyer account — find one at PayPal Developer dashboard → **Sandbox → Accounts**. Each account has email + password listed (click the dot menu → "View / Edit Account").
7. Approve the payment.
8. You're redirected to `/city/amsterdam?unlocked=1` and the city unlocks.
9. Check your dev server logs — webhook also fires (`PAYMENT.CAPTURE.COMPLETED`); the route logs that it skipped because the redirect already wrote the unlock. **Both paths writing the same Firestore doc with idempotency checks is correct.**

To **test the close-tab scenario**:
1. Start a fresh checkout (different city or a different sandbox account).
2. After approving on PayPal, before being redirected back, close the tab.
3. The webhook will still fire and write the unlock — verify in Firestore.

## Step 5 — Test refunds

1. In your Sandbox business account at sandbox.paypal.com, find the captured transaction → Refund.
2. Watch the webhook fire `PAYMENT.CAPTURE.REFUNDED` in your dev server logs.
3. The `cityUnlocks/{userId}_{cityId}` doc gets deleted, and the city locks again.

## Step 6 — Test the hint-credit pack flow

1. Inside an active hunt, run out of credits.
2. Tap **Buy more** in the hint shop.
3. Pick a pack (€0.99 / €2.49 / €4.99).
4. Same sandbox flow.
5. After capture, your in-game credit count bumps. The purchase doc is keyed by capture ID under `sessions/{sessionId}/purchases/{captureId}`.

## Step 7 — Go Live

When sandbox is solid:

1. Switch to **Apps & Credentials → Live tab**.
2. **Create App** there (PayPal may verify your business — bank account, tax ID — which can take a day or two).
3. Once approved, copy **Live Client ID + Live Secret**.
4. **Live Webhook** — same as sandbox, but on the Live app, with the production URL `https://tourhunts.com/api/paypal/webhook`. Subscribe to the same two events. Copy the new live Webhook ID.
5. In your production env (Vercel / Netlify / wherever you deploy):
   ```env
   PAYPAL_CLIENT_ID=<live client id>
   PAYPAL_CLIENT_SECRET=<live secret>
   PAYPAL_MODE=live
   PAYPAL_WEBHOOK_ID=<live webhook id>
   NEXT_PUBLIC_SITE_URL=https://tourhunts.com
   ```
6. Deploy. Verify with a real €5 transaction (you can refund it to yourself afterwards).

> **Never commit live credentials to git.** Sandbox in `.env`, Live in your hosting provider's encrypted env secret store.

---

## Webhook events explained

Only **two events** are subscribed; that's intentional.

| Event | What it does | Required? |
|---|---|---|
| `PAYMENT.CAPTURE.COMPLETED` | Server-side confirmation that money landed. Used as a safety net when the user's redirect from PayPal back to the app fails (closed tab, lost network). The webhook handler checks if the unlock/credits already exist (the redirect-capture may have written them) and only writes if not — so this is idempotent. | **Yes** for live |
| `PAYMENT.CAPTURE.REFUNDED` | Customer or you initiated a refund. Webhook revokes the matching unlock or rolls back credits. | Recommended |
| `CHECKOUT.ORDER.APPROVED` | Order approved but not yet captured. Logged but not acted on (capture is the source of truth). | Don't subscribe — noise |
| `BILLING.SUBSCRIPTION.*` | Subscriptions. Not used. | Don't subscribe |

Other PayPal events exist (e.g. dispute, chargeback) but adding handlers for those is optional and depends on how much support burden you want to automate.

---

## Security Notes (now fixed)

The capture routes now validate that the captured order's `metadata` (set during checkout) matches the URL params. Without this, an attacker could:

1. Pay €5 to unlock City A
2. Modify the redirect URL from `?cityId=A&userId=Me&token=...` to `?cityId=B&userId=Me&token=...`
3. Trigger the capture against the same paid order → grant access to City B for the price of City A

The capture routes now refuse to grant access if `metadata.cityId !== url.cityId` or `metadata.userId !== url.userId`. The webhook handler has the same check.

The webhook itself is verified with PayPal's signature — `verifyWebhook` calls PayPal's `verify-webhook-signature` API for every inbound event. Without `PAYPAL_WEBHOOK_ID` configured, the handler **fails closed** (refuses all events), so missing the env var means missed webhooks rather than security holes.

---

## Tax / VAT

PayPal Checkout doesn't compute or collect VAT for you. Options for €5 micro-transactions:

- **Simplest:** prices include VAT. €5 charged → you remit €X to the tax authority. EU One-Stop-Shop (OSS) registration handles intra-EU sales without per-country reporting.
- **Tax provider:** integrate Stripe Tax or Quaderno to split net + tax at checkout.

Talk to an accountant — this isn't legal advice.

---

## Adding Stripe (alternative)

If you want Stripe instead of (or alongside) PayPal:

1. `npm install stripe`
2. Get test keys from https://dashboard.stripe.com/test/apikeys.
3. Add to `.env`:
   ```env
   STRIPE_SECRET_KEY=sk_test_...
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```
4. Mirror `lib/paypal.ts` → `lib/stripe.ts` with `createCheckoutSession()` and the redirect-to-Stripe-Checkout pattern.
5. Mirror the capture routes to verify Stripe webhook signatures.

I can wire Stripe end-to-end in a follow-up commit — say the word.

---

## Troubleshooting

- **"Payment unavailable" appears in the city flash banner.**
  Checkout API returned no `url`. Server logs almost always show `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` missing or wrong, or `PAYPAL_MODE` mismatch.

- **PayPal redirect succeeds but the city doesn't unlock, lands on `?paypal=mismatch`.**
  Order metadata didn't match URL params — the security guard kicked in. Check that the user didn't tamper with the URL. The webhook will still write the unlock if the metadata is consistent.

- **Webhook returns 401 Unverified.**
  `PAYPAL_WEBHOOK_ID` not set, or set to the wrong ID (sandbox vs live), or PayPal hasn't propagated the webhook yet. Verify in PayPal Developer dashboard → your app → Webhooks tab. The handler intentionally fails closed — better than silently accepting forged events.

- **Webhook doesn't fire at all in local dev.**
  PayPal can't reach `localhost`. Use ngrok or a similar tunnel; configure the webhook URL in the sandbox app's Webhooks section to the public tunnel URL.

- **Refund webhook fires but credits don't roll back.**
  Refund handler decrements the credit count. If the user spent more credits than were refunded, the balance can go negative — that's intentional. Consider tightening if needed.
