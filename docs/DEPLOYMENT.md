# Go-live checklist

Work through this list in order on the first production deploy. Tick each item.
The host is assumed to be Vercel, but any Node 20 host that runs `next build` /
`next start` works.

## 0. Pre-flight

- [ ] `npm ci && npm run check && npm run build` passes locally. CI (`.github/workflows/ci.yml`) is green on the commit you deploy.
- [ ] `npm run seed -- --dry-run` reports no validation errors.

## 1. Firebase project

- [ ] **Authentication → Sign-in method**: enable **Anonymous**, **Google** and **Email/Password**. Anonymous is required: every visitor plays under a silent anonymous account, and every API call needs its ID token.
- [ ] **Authentication → Settings → Authorized domains**: add the production domain (and any staging domain).
- [ ] **Firestore**: create the database (production mode) in an EU region.
- [ ] **Deploy the security rules** (deny-by-default):
  ```bash
  firebase login
  firebase use <project-id>
  firebase deploy --only firestore:rules
  ```
  Check: in the console Rules playground, an unauthenticated read of `hunts/<id>/clues/<id>` is **denied**.
- [ ] **Service account**: Project settings → Service accounts → *Generate new private key*. Keep the JSON out of git.

## 2. Environment variables (hosting provider)

Set these for **Production** (and Preview/staging with sandbox values). Mark the secrets as sensitive.

| Variable | Build | Runtime | Value |
|---|:-:|:-:|---|
| `NEXT_PUBLIC_SITE_URL` | ✔ | ✔ | `https://tourhunts.com` (no trailing path). Required: payment redirects use it. |
| `NEXT_PUBLIC_FIREBASE_API_KEY` … `NEXT_PUBLIC_FIREBASE_APP_ID` (6) | ✔ | ✔ | Firebase web app config |
| `FIREBASE_SERVICE_ACCOUNT` | ✔ | ✔ | Service-account JSON, raw on one line or base64. Needed at **build time** too: server components read Firestore while pre-rendering (catalogue, sitemap) and degrade to empty pages without it. |
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` | | ✔ | **Live** app credentials |
| `PAYPAL_MODE` | | ✔ | `live`. Production refuses anything else. |
| `PAYPAL_ALLOW_SANDBOX` | | ✔ | Leave **unset** in production. Use `true` only on staging. |
| `PAYPAL_WEBHOOK_ID` | | ✔ | From step 3 |
| `PAYPAL_MERCHANT_ID` | | ✔ | Your PayPal merchant account ID (recommended) |
| `NEXT_PUBLIC_LEGAL_NAME` | ✔ | | Registered business name, e.g. "TourHunts (eenmanszaak …)" |
| `NEXT_PUBLIC_LEGAL_KVK` | ✔ | | KvK (Chamber of Commerce) number |
| `NEXT_PUBLIC_LEGAL_ADDRESS` | ✔ | | Business address shown on the legal pages |
| `NEXT_PUBLIC_CONTACT_EMAIL` | ✔ | | Contact / privacy email |
| `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_ADSENSE_CLIENT` | ✔ | | Optional. Loaded only after cookie consent. |

`NEXT_PUBLIC_*` values are baked in at build time, so **redeploy** after you change them.

## 3. PayPal (live)

Full background is in [PAYMENT_SETUP.md](../PAYMENT_SETUP.md).

- [ ] developer.paypal.com → *Live* → Apps & Credentials → create a Merchant app. Copy the Client ID and Secret into the env vars.
- [ ] On that app, add a webhook with URL `https://<your-domain>/api/paypal/webhook` and subscribe to these events:
  - `CHECKOUT.ORDER.APPROVED`: captures orders whose buyer closed the tab before returning
  - `PAYMENT.CAPTURE.COMPLETED`: grants the purchase (also completes pending captures)
  - `PAYMENT.CAPTURE.REFUNDED`: revokes on a full refund (partial refunds are logged to `paymentIssues`)
  - `PAYMENT.CAPTURE.REVERSED`: revokes on a chargeback
- [ ] Copy the **Webhook ID** into `PAYPAL_WEBHOOK_ID`. Without it, every webhook is refused.
- [ ] Business account → Account settings → *Merchant account ID* → `PAYPAL_MERCHANT_ID`.

## 4. Content and admin

- [ ] Seed production: put the production `FIREBASE_SERVICE_ACCOUNT` in `.env.local` (or the shell), then run:
  ```bash
  npm run seed -- --dry-run
  npm run seed
  ```
- [ ] Sign in on the live site once with your own account, then run:
  ```bash
  npm run set-admin -- you@example.com
  ```
  Sign out and back in. Admin-only tools (bench and fountain editing, geocoding, debug arrival) now appear.

## 5. Deploy and smoke-test

- [ ] Deploy. Open the site in a private window. A guest can browse, start the free hunt in a city and solve the first puzzle.
- [ ] `/privacy` and `/terms` show the legal name, KvK, address and contact email (not the fallbacks).
- [ ] `https://<domain>/sitemap.xml` and `/robots.txt` load and use the production origin.
- [ ] `https://<domain>/manifest.json` and `/sw.js` load. Lighthouse marks the PWA as installable.

## 6. Payment test plan

First run this in **sandbox** on a staging deploy (`PAYPAL_MODE=sandbox`, `PAYPAL_ALLOW_SANDBOX=true`, sandbox webhook pointed at staging). Then do one real live purchase and refund it.

| # | Scenario | Expected |
|---|---|---|
| 0 | Fresh guest taps any hunt | "Use your free hunt on …?" dialog. Confirming starts it and writes `users/<uid>.freeHuntId`. Every other hunt now shows €5 with a lock. |
| 1 | Guest taps a locked hunt | Asked to register or sign in. Purchases need a registered account. |
| 2 | Registered user buys a hunt with a sandbox buyer | Redirect to `/city/<id>?paypal=success&hunt=<huntId>`. Firestore has `payments/<orderId>` (`status: granted`) and `huntUnlocks/<uid>__<huntId>`. |
| 3 | **Refresh** the return URL | Still success. No second `payments` doc, no duplicate grant. |
| 4 | Approve in PayPal, then **close the tab** before the redirect | Within about a minute, the `CHECKOUT.ORDER.APPROVED` webhook captures the order and grants it. Reloading the city page shows the hunt as owned. |
| 5 | Cancel on the PayPal page | `?paypal=cancelled`, nothing charged, nothing granted. |
| 6 | Pay for an already-owned hunt in a second tab | The second payment is refunded automatically (`?paypal=refunded`) and logged in `paymentIssues` with `already_unlocked`. |
| 7 | Buy a hint-credit pack during a hunt | `/hunt?session=<sid>&credits=added`. Session credits go up by the package amount, once. |
| 8 | **Full refund** from the PayPal business account | Webhook `PAYMENT.CAPTURE.REFUNDED`: the hunt unlock is deleted, or the credits are rolled back (the balance may go negative). `payments/<orderId>.status` is `refunded_by_paypal`. |
| 9 | **Partial refund** | Grant kept. A `paymentIssues` entry with `partial_refund` appears for manual review. |
| 10 | Webhook with a wrong `PAYPAL_WEBHOOK_ID` | The PayPal dashboard shows delivery failures (401). Fix the env var and redeliver. |

After a live test, check `paymentIssues` is empty, apart from the expected entries from rows 6 and 9.

## 7. Search and Android

- [ ] **Google Search Console**: add the domain property, verify it (DNS), and submit `https://<domain>/sitemap.xml`.
- [ ] **TWA / Play Store** (see [APK_SETUP.md](../APK_SETUP.md)): get the SHA-256 fingerprint of the signing key (`keytool -list -v -keystore tourhunts.keystore -alias tourhunts`). If you use Play App Signing, use the fingerprint from Play Console → *App integrity* as well. Replace `REPLACE_WITH_SHA256_OF_YOUR_KEYSTORE_HERE` in `public/.well-known/assetlinks.json` and redeploy. Check `https://<domain>/.well-known/assetlinks.json` serves it. Then confirm the app opens without an address bar.

## 8. After launch

- [ ] Watch server logs for `[payments]` and `[api]` errors during the first days.
- [ ] Check the `paymentIssues` collection regularly. Every entry needs a human decision.
- [ ] Rate limiting is in memory per instance. Put a CDN/WAF rate limit in front of `/api/*` if abuse shows up.
