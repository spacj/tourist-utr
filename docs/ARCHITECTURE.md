# Architecture

A short map of how TourHunts fits together. Game rules, the scoring table and
the full Firestore data model are in [GAME_DESIGN.md](GAME_DESIGN.md).
Payments are covered in detail in [PAYMENT_SETUP.md](../PAYMENT_SETUP.md).

## Principles

- **The server is the source of truth.** Scores, credits, unlocks and arrivals are computed and written only by API routes, through the Admin SDK (`lib/firebaseAdmin.ts`). `firestore.rules` is deny-by-default for clients.
- **Identity comes only from a verified Firebase ID token** (`Authorization: Bearer …`). A `userId` in a request body is ignored.
- **Secrets never leave the server.** Clue docs hold puzzle answers, on-site answers, the trivia key, hint texts and exact coordinates. `lib/clueView.ts` is the only code that turns them into client views.

## Auth flow

```
first visit ─► AuthProvider: onAuthStateChanged(null) ─► signInAnonymously()
                 └─ guest = Firebase anonymous user (real uid, isAnonymous = true)
API call ─► lib/apiFetch.ts attaches `Bearer <idToken>`
         ─► route: requireUser(req) / requireAdmin(req)   (lib/apiAuth.ts → adminAuth().verifyIdToken)
sign in  ─► linkWithPopup / linkWithCredential on the anonymous user
            └─ same uid, so sessions and progress carry over
admin    ─► custom claim `admin: true` (npm run set-admin) → AuthUser.isAdmin
```

- Guests can play the free hunt, buy hint credits for their own session and see leaderboards.
- Buying a hunt and multiplayer need a **registered** account: `requireUser(req, { registered: true })` returns `403 account_required` for anonymous users.
- `lib/sessionServer.ts › loadOwnedSession` checks that `sessions/{id}.userId` is the caller's uid. Otherwise it returns 403.

## Game loop (server side)

1. `POST /api/start-session`: resumes an unfinished session for that hunt if there is one (never charged). Otherwise checks access with `lib/huntAccess.ts › claimHuntAccess` (owned, or spend the account's one free hunt; else `402 hunt_locked`, or `401 sign_in_required` for guests), then creates `sessions/{id}` with starting credits and caches the difficulty. Returns the first `ActiveClueView`.
2. `POST /api/verify-puzzle`: the server checks the answer (`normalizePuzzleAnswer`, `|`-separated alternatives) and awards the puzzle points. The client can pre-check offline against `answerHashes`.
3. `POST /api/hints/unlock`: deducts credits and records `hintUnlocks`. The hint text comes back from the server.
4. `POST /api/verify-location` (GPS) or `POST /api/onsite` ("I'm here" plus on-site question): both go through `lib/arrival.ts › performArrival`. That is one idempotent transaction: teleport check, scoring (`arrivalBreakdown`), next-stop unlock and the room scoreboard mirror.
5. `POST /api/trivia`: the quiz bonus. `POST /api/finish`: closes the session and updates progression. `POST /api/accuse`: the verdict for mystery hunts.

Offline: writes are queued in IndexedDB (`lib/offlineQueue.ts`) and replayed with their original `at` timestamp. `resolveAt` accepts timestamps up to 2 h old.

## Data model (summary)

| Collection | Access | Notes |
|---|---|---|
| `countries`, `cities`, `hunts`, `benches` | public read | catalogue |
| `hunts/{id}/clues/{id}`, `huntSecrets/{id}` | server only | answers, coordinates, mystery solution |
| `sessions/{id}` (+ `sessionClues`, `hintUnlocks`, `purchases`) | server only | one play-through: score, credits, progress |
| `users/{uid}` | own read; client may write only `displayName`, `photoURL`, `updatedAt` | profile and progression (server-written), `freeHuntId` (the hunt that used the free slot) |
| `rooms/{id}` (+ `players`, `clueClaims`) | signed-in read | multiplayer realtime listeners |
| `userActiveRooms/{uid}` | own read | the current race |
| `huntUnlocks/{uid}__{huntId}` | server only | purchased hunts |
| `cityUnlocks/{uid}__{cityId}` | server only | legacy city passes (no longer sold, still honoured) |
| `payments`, `paymentsByCapture`, `paymentIssues`, `paypalRefunds` | server only | payment idempotency and audit |

## API routes

Auth legend: **public**: no token needed. **optional**: works without a token and personalises with one. **user**: any verified user, guests included. **registered**: non-anonymous user. **admin**: `admin` claim. Rate limits are per server instance (`lib/apiAuth.ts › rateLimit`).

| Route | Methods | Auth | Rate limit |
|---|---|---|---|
| `/api/countries` | GET | public | |
| `/api/cities` | GET | public | |
| `/api/hunts` | GET | public | |
| `/api/benches` | GET | public | |
| `/api/benches` | POST, PATCH | admin | |
| `/api/geocode` | GET | admin | |
| `/api/leaderboard` | GET | optional | per IP |
| `/api/user-progress` | GET | optional | |
| `/api/hunt-access` | GET | optional | |
| `/api/city-unlocks` | GET | optional (legacy) | |
| `/api/rooms/active` | GET | optional | |
| `/api/start-session` | POST | user | 10/min |
| `/api/session-credits` | GET | user (session owner) | |
| `/api/verify-puzzle` | POST | user (session owner) | 10/min per clue |
| `/api/verify-location` | POST | user (session owner); `debugArrive` admin only | 40/min |
| `/api/onsite` | POST | user (session owner) | 10/min per clue |
| `/api/hints/unlock` | POST | user (session owner) | 30/min |
| `/api/trivia` | POST | user (session owner) | 30/min |
| `/api/finish` | POST | user (session owner) | |
| `/api/accuse` | POST | user (session owner) | 10/min |
| `/api/user-history` | GET | user | |
| `/api/purchases/checkout` | POST | user (session owner) | 10/min |
| `/api/hunt-unlocks/checkout` | POST | registered | 10/min |
| `/api/city-unlocks/checkout` | POST | retired: always `410 city_pass_retired` | |
| `/api/purchases/capture` | GET | none: PayPal browser return; grant derived only from the PayPal-verified order | |
| `/api/hunt-unlocks/capture` | GET | none: same as above | |
| `/api/city-unlocks/capture` | GET | none: same as above (legacy orders only) | |
| `/api/paypal/webhook` | POST | PayPal signature (`verifyWebhook` + `PAYPAL_WEBHOOK_ID`) | |
| `/api/rooms/get` | GET | user | 20/min per uid, plus per IP |
| `/api/rooms/create` | POST | registered | 10/min |
| `/api/rooms/join` | POST | registered | 20/min per uid, plus per IP |
| `/api/rooms/start`, `/leave`, `/abandon`, `/dismiss` | POST | registered | |
| `/api/rooms/results` | GET | registered | |

All handlers are wrapped in `handle()`. An `HttpError` becomes `{ error: code, ...extra }` with its status (e.g. `402 { error: 'hunt_locked', huntId, cityId, priceEuros }`). Anything else is logged and becomes a 500 `server_error`. Malformed JSON bodies return 400 `invalid_json`.

## Payments (summary)

Checkout routes compute the price on the server and put `{uid, hunt | session + package}` into PayPal's `custom_id` (legacy orders carry a city). Capture (redirect or webhook) calls `lib/payments.ts › processCapture`, which works in two steps:

1. It checks the money with `verifyCaptureMoney`: status, EUR, exact amount, payee.
2. In one transaction it `create()`s `payments/{orderId}` and `paymentsByCapture/{captureId}` and applies the grant.

So redirect, refresh and webhook can never grant twice. A mismatched payment is refunded automatically and logged to `paymentIssues`. A full refund or reversal webhook revokes the grant.

## Tests

`tests/` (Vitest, node environment, `server-only` stubbed) covers the pure logic:

- request validators and the rate limiter
- geo maths
- clue-view secrecy and the per-difficulty navigation table
- answer hashes and search zones
- scoring
- custom_id encoding, amount checks and PayPal mode
- hunt access resolution (free hunt, purchases, legacy city passes) and per-hunt prices
- i18n completeness

Run `npm run check`.
