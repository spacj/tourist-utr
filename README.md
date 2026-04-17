# Utrecht Scavenger Hunt

GPS-confirmed tourist scavenger hunt built with Next.js 14. Players explore Utrecht following cryptic clues, confirming arrivals via GPS. A tiered hint system costs credits — everyone starts with 10 free, and more can be purchased in-app via Stripe.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Map | Mapbox GL JS |
| Database | PostgreSQL + Prisma |
| Payments | Stripe Checkout |
| Deploy | Vercel |

---

## Quick start

```bash
npm install
cp .env.example .env.local        # fill in all vars
npx prisma migrate dev --name init
npm run db:seed
npm run stripe:listen              # separate terminal
npm run dev
```

---

## File map

```
app/
  page.tsx                         landing page + server action to create session
  hunt/
    page.tsx                       server component: load session, current clue
    HuntClient.tsx                 client shell: clue transitions, score tracking
    complete/page.tsx              final score with per-clue breakdown
  api/
    verify-location/route.ts       GPS haversine check, score compute, next clue
    hints/unlock/route.ts          credit deduction + hint record (atomic)
    purchases/
      checkout/route.ts            Stripe Checkout session
      webhook/route.ts             credit top-up on checkout.session.completed
    session-credits/route.ts       re-fetch credits after Stripe redirect

components/
  ClueScreen.tsx                   main game screen (wires everything)
  MapView.tsx                      Mapbox GL — user dot + conditional target pin
  ProximityRing.tsx                animated SVG arc ring + bearing needle
  CreditShop.tsx                   bottom-sheet with three credit packages
  ArrivalBanner.tsx                score breakdown overlay on GPS confirm

hooks/
  useGPS.ts                        polls GPS every 5s, calls verify-location
  useCredits.ts                    credit state, hint unlock, Stripe redirect

lib/
  prisma.ts                        singleton client safe for Next.js hot reload

types/
  index.ts                         types + HINT_COSTS + CREDIT_PACKAGES + SCORE config

prisma/
  schema.prisma                    full data model
  seed.ts                          4 Utrecht clues ready to use
```

---

## How credits work

- New session → `HuntSession.credits = 10` (set by `STARTING_CREDITS`)
- Hint 1 is free (no deduction)
- Hint 2 costs **3 credits**, Hint 3 costs **5 credits** (set in `HINT_COSTS`)
- If balance is insufficient the Credit Shop opens automatically
- Three packages: 5 cr / €0.99 · 15 cr / €2.49 · 40 cr / €4.99
- Stripe Checkout handles payment; webhook adds credits atomically with idempotency check
- All credit math is server-side — client receives the updated balance in API responses

## How GPS confirmation works

1. `useGPS` polls `navigator.geolocation` every 5 seconds
2. Posts `{ sessionId, clueId, lat, lng }` to `/api/verify-location`
3. Server runs **haversine distance** — target coords never leave the server
4. Returns `{ distanceM, bearing }` or `{ arrived: true, pointsEarned, nextClue }`
5. ProximityRing arc fills as distance shrinks (scale: 0–400 m)
6. Needle rotates to live bearing
7. Hint 3 text updates every cycle: *"You're about 80m north-east of the location"*

## Map visibility rules

| State | What the map shows |
|---|---|
| No hints unlocked | User dot only, "unlock hint 2 to reveal the pin" overlay |
| Hint 2 or 3 unlocked | User dot + purple target pin |
| Arrived | Both markers + arrival banner overlay |

## Scoring

```
Base          +100 pts
Speed bonus   + 20 pts   (arrived within 10 min of clue unlock)
Hint 2 used   − 10 pts
Hint 3 used   − 25 pts
Minimum          0 pts
```

---

## Stripe setup (local)

```bash
stripe login
npm run stripe:listen
# Copy the whsec_... secret → STRIPE_WEBHOOK_SECRET in .env.local
```

Production: add `https://your-domain.vercel.app/api/purchases/webhook` in the Stripe dashboard with event `checkout.session.completed`.

---

## Editing clues

Update `prisma/seed.ts` and re-run `npm run db:seed`. Fields:

```typescript
{
  order: 1,
  riddle: "...",            // puzzle text shown to player
  locationName: "...",      // revealed after GPS confirm
  lat, lng,                 // target coordinates
  radiusM: 40,              // confirm radius (metres)
  hint1: "...",             // free
  hint2: "...",             // 3 credits + optional photo
  hint2PhotoUrl: "...",
  hint3: "...",             // 5 credits — static fallback (dynamic generated server-side)
}
```
