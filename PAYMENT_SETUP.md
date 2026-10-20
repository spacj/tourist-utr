# Payment Setup — TourHunts

Two things are sold through PayPal Checkout (Orders v2):

- **Single hunts** — price from `hunts/{id}.priceEuros` (1–50 €, else the €5 default, `huntPriceEuros`). Registered accounts only; bound to the buyer's Firebase uid. Every account also gets one free hunt of its choice (`users/{uid}.freeHuntId`, no payment involved).
- **City passes (legacy)** — no longer sold (`/api/city-unlocks/checkout` answers 410). Existing `cityUnlocks` still open every hunt in their city, and the capture route + webhook still process old orders and refunds.
- **Hint-credit packs** — `CREDIT_PACKAGES` in `types/index.ts`, credited to the buyer's own hunt session.

## How it works

| File | Role |
|---|---|
| `lib/paypal.ts` | REST client. Fails closed on `PAYPAL_MODE`, checks every response, caches the OAuth token, `refundCapture`, `getCapture`, webhook signature verification. |
| `lib/payments.ts` | Shared, idempotent grant (`processCapture`) and refund handling (`processRefund`). |
| `lib/huntAccess.ts` | Who may play which hunt (free hunt, purchases, legacy city passes); `grantHuntUnlock`. |
| `app/api/hunt-unlocks/checkout` · `app/api/purchases/checkout` | Authenticated (Bearer ID token). Price computed server-side; `custom_id` carries uid + hunt / session + package. |
| `app/api/hunt-unlocks/capture` · `app/api/purchases/capture` | Browser return URL from PayPal (`?token=<orderId>`). Captures, verifies, grants, redirects. |
| `app/api/city-unlocks/capture` | Legacy city-pass orders only. |
| `app/api/paypal/webhook` | Safety net + refunds. |

Every capture is verified before granting: status `COMPLETED`, currency `EUR`, amount equal to the server price recomputed from `custom_id`, intact `custom_id`, and (if `PAYPAL_MERCHANT_ID` is set) the payee. A mismatch is **refunded automatically** and logged in `paymentIssues`.

Idempotency: one Firestore transaction creates `payments/{orderId}` and `paymentsByCapture/{captureId}` with `create()` and applies the grant, so redirect, refresh and webhook can never grant twice.

Redirect flags:
- Hunt: `/city/{cityId}?paypal=success|cancelled|pending|refunded|error&hunt={huntId}`
- Legacy city pass: `/city/{cityId}?paypal=success&unlocked=1` · `?paypal=pending|refunded|error`
- Credits: `/hunt?session={sid}&credits=added|pending|refunded|error`

## Environment

```env
NEXT_PUBLIC_SITE_URL=https://tourhunts.com   # required in production
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_MODE=live                              # exactly live|sandbox
PAYPAL_WEBHOOK_ID=...
PAYPAL_MERCHANT_ID=...                        # optional, recommended
# PAYPAL_ALLOW_SANDBOX=true                   # staging only
FIREBASE_SERVICE_ACCOUNT=...                  # Admin SDK credentials
```

In production, `PAYPAL_MODE` other than `live` is refused unless `PAYPAL_ALLOW_SANDBOX=true`.

## Setup steps

1. **PayPal app** — developer.paypal.com → Apps & Credentials → create a *Merchant* app (Sandbox first, then Live). Copy Client ID + Secret.
2. **Webhook** — on the same app, add `https://<your-domain>/api/paypal/webhook` and subscribe to:
   - `CHECKOUT.ORDER.APPROVED` — captures orders whose buyer closed the tab before returning
   - `PAYMENT.CAPTURE.COMPLETED` — grant (also completes delayed/pending captures)
   - `PAYMENT.CAPTURE.REFUNDED` — revokes on **full** refund (partial refunds are logged to `paymentIssues`, grant kept)
   - `PAYMENT.CAPTURE.REVERSED` — revokes on chargeback

   Copy the Webhook ID into `PAYPAL_WEBHOOK_ID`. Without it every webhook is refused (fail closed). For local testing expose the dev server with ngrok.
3. **Merchant ID** (optional) — PayPal business account → Account settings → *Merchant account ID* → `PAYPAL_MERCHANT_ID`.
4. **Firebase Admin** — Firebase console → Project settings → Service accounts → *Generate new private key*; put the JSON (raw or base64) in `FIREBASE_SERVICE_ACCOUNT`.
5. Deploy, then buy one hunt for real and refund it from PayPal: the unlock should disappear.

## Testing (sandbox)

1. `PAYPAL_MODE=sandbox`, sandbox credentials, ngrok webhook URL.
2. With a registered account that has already used its free hunt, buy a hunt with a sandbox buyer (Developer dashboard → Sandbox → Accounts).
3. Expect `/city/<id>?paypal=success&hunt=<huntId>`; check `payments/<orderId>` and `huntUnlocks/<uid>__<huntId>` in Firestore.
4. Refresh the return URL → still success, no second grant.
5. Close the tab right after approving → the `CHECKOUT.ORDER.APPROVED` webhook captures and grants.
6. Refund in the sandbox business account → unlock removed / credits rolled back (credits may go negative if already spent).

## Firestore collections (server-only)

`payments/{orderId}`, `paymentsByCapture/{captureId}`, `paymentIssues/*`, `paypalRefunds/{refundId}`, `huntUnlocks/{uid}__{huntId}`, `cityUnlocks/{uid}__{cityId}` (legacy), `sessions/{sid}/purchases/{orderId}`. Plus `users/{uid}.freeHuntId` (server-written).

## Troubleshooting

- **Checkout returns 500** — server logs show `paypal_config_failed`/`paypal_oauth_failed`: missing credentials, wrong `PAYPAL_MODE`, or sandbox in production.
- **`?paypal=refunded`** — the capture didn't match the server price/currency/custom_id (e.g. the city price changed mid-checkout, or the city was already unlocked). See `paymentIssues`.
- **`?paypal=error`** — PayPal call failed or an automatic refund failed (refund manually; it's logged in `paymentIssues` with `refundError`).
- **Webhook 401** — wrong/missing `PAYPAL_WEBHOOK_ID` (sandbox vs live).

## Tax / VAT

PayPal doesn't handle VAT. Prices are VAT-inclusive; EU OSS registration covers intra-EU sales. Not legal advice.
