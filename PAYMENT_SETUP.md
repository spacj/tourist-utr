# Payment Setup — TourHunts

The codebase already has PayPal Checkout fully wired:
- `lib/paypal.ts` — talks to the PayPal Orders v2 API
- `app/api/city-unlocks/checkout/route.ts` — creates an order, returns a PayPal approval URL
- `app/api/city-unlocks/capture/route.ts` — finalizes the order after the user approves
- `app/api/purchases/checkout/route.ts` + `capture/route.ts` — same flow for hint-credit packs

You just need to plug in PayPal credentials. Below is the exact step-by-step.

> **Why PayPal first?** It's already integrated, requires zero code changes, and works for cards (via PayPal's "Guest Checkout") and PayPal accounts. Stripe is a great alternative — see "Adding Stripe" at the bottom if you want it instead of, or alongside, PayPal.

---

## Step 1 — Create a PayPal Developer account

1. Go to https://developer.paypal.com and click **Log in to Dashboard** (top right).
2. Sign in with your existing PayPal account, or create one.
3. Once logged in you land on the Developer Dashboard.

If your business needs to receive money (you do), sign in with the **PayPal Business** account that will hold the payouts. If you don't have one yet, you can create a Business account during sign-up — it's free.

## Step 2 — Get sandbox credentials (testing)

Sandbox lets you test the full flow with fake credit cards and fake PayPal accounts before charging real money.

1. In the dashboard, go to **Apps & Credentials** → **Sandbox** tab.
2. Click **Create App**.
3. Name it `TourHunts Sandbox`.
4. Type: **Merchant**.
5. Click **Create**.
6. You're now on the app detail page. Copy these two values:
   - **Client ID** (long string starting with `A...`)
   - **Secret key** — click **Show** under "Client Secret" to reveal it.

> Keep these secret — anyone with the secret can charge customers on your behalf.

## Step 3 — Add credentials to `.env`

Open `.env` in the project root and replace the empty values:

```env
# PayPal
PAYPAL_CLIENT_ID=A...your-sandbox-client-id...
PAYPAL_CLIENT_SECRET=E...your-sandbox-secret...
PAYPAL_MODE=sandbox
```

Restart your dev server (`npm run dev` or `yarn dev`) so Next.js picks up the new env vars.

## Step 4 — Test the city-unlock flow

1. Open the app in your browser.
2. Sign in with Google.
3. Navigate to a city you haven't unlocked (e.g. Amsterdam).
4. Click **"Unlock all of Amsterdam — €5"**.
5. You're redirected to PayPal sandbox.
6. Use a sandbox buyer account to pay (PayPal generates them for you):
   - In your PayPal Developer dashboard → **Sandbox** → **Accounts**, you'll see test buyer + business accounts pre-created.
   - Note the **email + password** of the buyer account.
   - On the PayPal sandbox checkout page, sign in as that buyer.
7. Approve the payment.
8. You're redirected back to `/city/<id>?unlocked=1` and the city unlocks.

If something goes wrong, check the browser DevTools network tab + your dev server logs — both `checkout` and `capture` API routes log errors clearly.

## Step 5 — Test the hint-credit pack flow

1. Inside an active hunt, run out of credits.
2. Tap **Buy more** in the hint shop.
3. Pick a pack (€0.99 / €2.49 / €4.99).
4. Same sandbox flow as above.
5. After capture, your in-game credit count should bump.

## Step 6 — Go live

When you're ready to take real money:

1. In the PayPal Developer dashboard, switch from **Sandbox** to **Live** tab in **Apps & Credentials**.
2. Click **Create App** under Live.
3. PayPal may ask you to verify your business: bank account, tax info, etc. This can take a day or two for full activation.
4. Once approved, copy the **Live Client ID** and **Live Secret**.
5. In production env (Vercel / Netlify / your host), set:
   ```env
   PAYPAL_CLIENT_ID=<live client id>
   PAYPAL_CLIENT_SECRET=<live secret>
   PAYPAL_MODE=live
   ```
6. **Important:** keep the sandbox values in your local `.env` for development; only production gets the live values. Never commit live credentials to git.

## Step 7 — Webhook hardening (recommended, not required)

The current capture flow runs in the user's browser redirect. If a user closes the tab between paying and being redirected back, the order might be charged but the city not unlocked. To bulletproof this:

1. In the PayPal app settings (sandbox or live), click **Add webhook**.
2. URL: `https://yourdomain.com/api/paypal/webhook`
3. Events to subscribe to:
   - `CHECKOUT.ORDER.APPROVED`
   - `PAYMENT.CAPTURE.COMPLETED`
4. Implement `app/api/paypal/webhook/route.ts` that listens for `PAYMENT.CAPTURE.COMPLETED` events, verifies the signature with the webhook ID, and grants the unlock based on `custom_id` metadata.

This isn't done yet — opening it as a follow-up if you want hard guarantees. Most apps run fine without it.

## Step 8 — Tax / VAT considerations

PayPal Checkout doesn't compute or collect VAT for you. Options:

- **Simplest:** prices include VAT (€5 → €5 to the user, you remit €X to the tax authority). One-Stop-Shop (OSS) registration handles intra-EU sales.
- **Better:** add a tax provider (e.g. Stripe Tax, Quaderno) that splits net + tax at checkout.

For €5 micro-transactions to consumers, keeping prices VAT-inclusive is the most common setup. Talk to an accountant — this isn't legal advice.

---

## Adding Stripe (alternative or in addition)

If you want Stripe instead of (or alongside) PayPal:

1. `npm install @stripe/stripe-js stripe`
2. Get test keys from https://dashboard.stripe.com/test/apikeys
3. Add to `.env`:
   ```env
   STRIPE_SECRET_KEY=sk_test_...
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
   ```
4. Create `lib/stripe.ts` mirroring `lib/paypal.ts` (createCheckoutSession + the redirect-to-Stripe-Checkout pattern).
5. Add a new API route or extend the existing one to choose between providers.

I can wire Stripe in a follow-up commit if you want — say the word.

---

## Troubleshooting

- **"Payment unavailable" appears in the city flash banner**
  Means the checkout API returned no `url`. Check server logs — usually `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` are missing or wrong, or the `PAYPAL_MODE` doesn't match the credentials.

- **PayPal redirect succeeds but the city doesn't unlock**
  The capture step failed. Check the URL the user landed on — should be `/city/<id>?unlocked=1`. If it's `?paypal=cancelled`, the user cancelled. If it's the city URL with no params, the capture API probably errored — check server logs.

- **Webhook events not firing**
  Webhooks are not implemented yet (see Step 7). The redirect-based capture is the only finalization path right now.
