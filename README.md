# TourHunts

GPS puzzle walks for curious travellers. Players solve a puzzle at each stop,
follow the clue to the next place, and arrival is confirmed by GPS. The first
hunt in every city is free; a €5 city pass unlocks every hunt and walking tour
in that city. Installable PWA (works offline once a hunt is started), with an
Android wrapper via Trusted Web Activity.

- Game rules, scoring and data model: [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md)
- Architecture, auth flow and API map: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Go-live checklist: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- Payments: [PAYMENT_SETUP.md](PAYMENT_SETUP.md) · Android app: [APK_SETUP.md](APK_SETUP.md)

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router), TypeScript strict |
| Auth | Firebase Auth: anonymous guests, upgraded in place to Google or email accounts |
| Database | Cloud Firestore. All game and payment writes go through API routes using `firebase-admin`; client rules are deny-by-default |
| Payments | PayPal Checkout (Orders v2) and webhooks |
| Map | MapLibre GL |
| Tests / lint | Vitest, ESLint (`next/core-web-vitals`) |

## Quick start

```bash
npm install
cp .env.example .env.local       # fill in the values (see below)
npm run seed -- --dry-run        # validate the hunt content, writes nothing
npm run seed                     # write countries, cities, hunts and clues to Firestore
npm run dev                      # http://localhost:3000
```

Before you play locally, enable the **Anonymous** sign-in provider in the
Firebase console (Authentication → Sign-in method). Every visitor gets a silent
anonymous account, and API calls fail without it.

## Environment variables

Every variable is listed with comments in [.env.example](.env.example).

| Variable | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | build + runtime | Canonical origin. **Required in production**: PayPal return URLs and payment redirects are built only from this. |
| `NEXT_PUBLIC_FIREBASE_*` (6 vars) | build | Firebase web config (public). |
| `FIREBASE_SERVICE_ACCOUNT` | build + runtime, **secret** | Service-account JSON, raw or base64. Without it the Admin SDK falls back to Application Default Credentials. |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | runtime, **secret** | PayPal REST app. |
| `PAYPAL_MODE` | runtime | Exactly `live` or `sandbox`. Production refuses `sandbox` unless `PAYPAL_ALLOW_SANDBOX=true` (staging only). |
| `PAYPAL_WEBHOOK_ID` | runtime | Required. Without it every webhook is rejected. |
| `PAYPAL_MERCHANT_ID` | runtime | Optional, recommended. Captures paid to any other payee are refunded. |
| `NEXT_PUBLIC_LEGAL_NAME`, `NEXT_PUBLIC_LEGAL_KVK`, `NEXT_PUBLIC_LEGAL_ADDRESS`, `NEXT_PUBLIC_CONTACT_EMAIL` | build | Business identity shown on the legal pages (`lib/site.ts`). |
| `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_ADSENSE_CLIENT` | build | Optional. Only load after cookie consent. |

Admins are not configured by env var. They get a Firebase custom claim (see `set-admin` below).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js dev server, production build, production server. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run lint` | `next lint` (ESLint). `next build` also runs it, so lint **errors** fail the build. |
| `npm run test` / `test:watch` | Vitest unit tests in `tests/` (pure logic, no network or Firestore). |
| `npm run check` | typecheck, then lint, then test. Run this before pushing; CI runs the same steps plus a build. |
| `npm run seed` | Validates `scripts/seed-data/`, then upserts it into Firestore through the Admin SDK. `-- --dry-run` validates and prints counts without credentials or network. |
| `npm run set-admin -- you@example.com` | Grants the `admin: true` custom claim (`--revoke` removes it). The user must sign out and in again. |
| `npm run icons` | Renders the PWA, Apple and Android PNG icons from `public/icon.svg` and `public/icon-mask.svg`. |

## Firestore rules

The rules in [firestore.rules](firestore.rules) are deny-by-default. Clients can
read only the public catalogue, their own profile, and the multiplayer room
docs they listen to. Deploy them with the Firebase CLI:

```bash
npm i -g firebase-tools
firebase login
firebase use <project-id>
firebase deploy --only firestore:rules
```

## Folder map

```
app/                    Next.js App Router
  page.tsx, HomeClient   landing page
  country/ city/          catalogue pages (city page = hunts + city pass checkout)
  hunt/                   the game (HuntClient) and /hunt/complete results
  tour/                   self-guided walking tours (no scoring)
  multiplayer/            race rooms (create / join / live scoreboard)
  profile/                player history, level, achievements
  benches/ fountains/     community "places" guides (admin-editable)
  blog/                   markdown blog (content/blog)
  privacy/ terms/ contact/ legal pages
  sitemap.ts, robots.ts, opengraph-image.tsx
  api/                    all server logic. See docs/ARCHITECTURE.md for the route table
components/             UI (ClueScreen, MapView, PuzzleCard, CheckoutSheet, AuthProvider, …)
  game/                   game-screen building blocks
hooks/                  useGPS, useCredits, useI18n, useActiveRoom, useServiceWorker, …
lib/
  firebase.ts, auth.ts    client SDK
  firebaseAdmin.ts        server Admin SDK (lazy, so builds don't need credentials)
  apiAuth.ts              ID-token auth, validators, rate limiter, error boundary
  apiFetch.ts             client fetch that attaches the ID token
  clueView.ts             the only place that turns secret clue docs into client views
  arrival.ts              arrival transaction and scoring
  payments.ts, paypal.ts  idempotent payment grant/refund, PayPal REST client
  cityUnlock.ts           city pass price and unlock records
  sessionServer.ts, roomsServer.ts   session/room ownership helpers
  offlineQueue.ts, indexedDB.ts      offline write queue and cache
  i18n/                   UI strings per area (core, flows, game, legal), 6 languages
types/index.ts          shared types, SCORE, HINT_COSTS, CREDIT_PACKAGES, game constants
scripts/                seed (seed-data/, seed-lib/), set-admin, build-icons
public/                 PWA manifest, service worker, icons, .well-known/assetlinks.json
tests/                  Vitest unit tests
docs/                   GAME_DESIGN, ARCHITECTURE, DEPLOYMENT
firestore.rules         client security rules
```

## Languages

UI strings live in `lib/i18n/*.ts` as `{ en, nl, de, fr, it, es }`. `en` is the
fallback. Tests require every key in `legal`, `flows` and `game` to have all six
languages. Gaps in `core.ts` only print a warning.
