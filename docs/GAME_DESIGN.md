# TourHunts game design (v2)

This is the source of truth for how a hunt plays. The server enforces it, and the client only displays what the server allows.

## The loop at one stop

```
 ┌── 1. FIND ──────────────────────────────┐   ┌── 2. ON SITE ───────────────────┐
 │ Puzzle (cipher/anagram/…) → place name  │   │ Arrival confirmed               │
 │ Solving unlocks navigation help         │──▶│ On-site question (if verified)  │
 │ Hints narrow it down (credits)          │   │ Quick quiz (trivia)             │
 │ Walk there → GPS confirms arrival       │   │ Story / fun fact revealed       │
 └─────────────────────────────────────────┘   │ → Next stop                     │
                                               └─────────────────────────────────┘
```

### 1. Find
- **The puzzle is the clue.** A stop shows its puzzle (prompt + type). Solving it reveals the place, and the riddle becomes the story card. If a stop has no puzzle, the riddle itself is the clue.
- **Navigation help depends on difficulty and on whether the puzzle is solved**:

  | Difficulty | Before solving | After solving |
  |---|---|---|
  | easy   | compass (distance + direction) | compass + exact pin |
  | medium | search zone + warmth only | compass (distance + direction) |
  | hard   | search zone + warmth only | warmth only (no direction) |

  - **Search zone:** a 350 m circle on the map that contains the target, but whose centre is offset from it. The offset is deterministic per clue (seeded by clue id), so it doesn't move on reload.
  - **Warmth bands:** `cold` (>400 m), `warm` (150–400 m), `hot` (50–150 m), `burning` (<50 m).
  - Exact target coordinates are only sent to the client once the compass is unlocked (easy from the start; medium after solving). On hard they are sent after solving too, so offline arrival detection works, but the UI shows warmth only.
- **Hints** (credits, server returns the content):
  - Tier 1, free: neighbourhood clue (`hint1`). Free hints never cost score or the "perfect" bonus.
  - Tier 2, 2 credits: street-level clue (`hint2`, optional photo).
  - Tier 3, 4 credits: **reveal the pin**. Exact location on the map and compass unlocked, on any difficulty.
  - Puzzle hint, 3 credits: nudges the puzzle (`puzzle.hint`).
- **Arrival:**
  - Arrival is automatic when within `max(radiusM, 40) + min(gpsAccuracy, 30)` metres.
  - If GPS is denied or poor, and the stop has a verified on-site question, the player can tap **"I'm here"** and answer it. A correct answer within 300 m (or with no GPS at all) confirms arrival.

### 2. On site
After arrival, in this order:
1. **On-site question.** Only shown if `onSite.fieldChecked === true`, i.e. someone verified it on location. Up to 3 attempts, server-checked.
2. **Quick quiz.** One attempt, server-checked. The quiz is answered **before** the fun fact is shown, so the fun fact can't give the answer away.
3. **Story and fun fact.**
4. **Next stop.**

## Scoring (server-computed, shown as a breakdown)

| Event | Points |
|---|---|
| Puzzle solved | 100 |
| Arrived at the stop | 50 |
| On-site question correct | 50 |
| Quiz correct | 25 |
| Clean stop (no paid hints at this stop) | 25 |
| Tier-2 hint / puzzle hint | −10 each |
| Pin reveal (tier 3) | −25 |
| Race: first to arrive (multiplayer) | +20 |

- **Ties** are broken by total time (`completedAt − startedAt`): faster ranks higher.
- There's no time bonus and no streak bonus. They were confusing and rewarded running rather than thinking.
- The HUD always shows the server's `totalScore`.

## Pricing
- The first hunt in every city is **free and complete**: no stop limit.
- A city pass costs €5 and unlocks every hunt and tour in that city. It needs a registered account so the purchase can't be lost.
- Hint credits: every session starts with 12; extra packs are sold per session.

## Data model

### `hunts/{huntId}` (public)
`title, description, city, cityId, order, difficulty ('easy'|'medium'|'hard'), durationMin, distanceKm, tourType?, mystery? (public parts only: suspects, weapons, places, intro), i18n`.
There's **no `rating` and no `badge`**: those were invented. Ratings come from real players later.

### `huntSecrets/{huntId}` (server-only)
`{ mysterySolution: { suspect, weapon, place } }`

### `hunts/{huntId}/clues/{clueId}` (server-only)
```ts
{
  id, order, icon, theme,
  riddle,                      // story / clue text
  locationName, lat, lng,
  radiusM,                     // >= 40
  hint1, hint2, hint2PhotoUrl?,
  funFact,
  trivia: { question, options[4], correctIndex, explain },
  puzzle?: { type: 'cipher'|'anagram'|'wordplay'|'reverse'|'logic'|'numbers'|'rebus',
             prompt, answer /* '|'-separated accepted answers, incl. translations */,
             hint, explain },
  onSite?: { question, answer /* '|'-separated */, explain, fieldChecked: boolean },
  i18n: { [lang]: { theme, riddle, locationName, hint1, hint2, funFact,
                    trivia: { question, options, explain },
                    puzzle: { prompt, hint, explain },
                    onSite: { question, explain } } },
}
```

### What the client receives for the active stop
```
id, order, totalClues, icon, theme, riddle (only once solved), puzzle { type, prompt, answerHashes[] },
i18n (same fields), zone { lat, lng, radiusM }, navigation: 'compass'|'warmth',
target { lat, lng, radiusM } | null, hasOnSite, hintsUnlocked {1,2,3,puzzle: content}
```
- `answerHashes` are SHA-256 hashes of `huntId:clueId:normalizedAnswer`. They let the client check a puzzle answer offline. The server still verifies the answer and awards the points.
- Completed stops are sent in full: location name, coordinates, fun fact, and the player's results.
