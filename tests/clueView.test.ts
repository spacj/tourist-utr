import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import {
  toActiveClueView, toArrivedStopView, toCompletedClueView, zoneFor, navState, answerHash,
  acceptedAnswers, matchesAnswer, normalizeDifficulty, hintsUnlockedFor,
  type ClueDoc, type SessionClueDoc,
} from '@/lib/clueView'
import { haversineM } from '@/lib/geo'
import {
  normalizePuzzleAnswer, ZONE_RADIUS_M, ZONE_MAX_OFFSET_FRACTION, MIN_ARRIVAL_RADIUS_M, ONSITE_MAX_ATTEMPTS,
  type Difficulty,
} from '@/types'

const HUNT = 'utrecht-classic'
const CLUE = 'clue-03'

/** A clue full of secrets, each tagged so leaks are easy to grep for. */
function makeClue(over: Partial<ClueDoc> = {}): ClueDoc {
  return {
    id: CLUE,
    order: 2,
    icon: 'tower',
    theme: 'Medieval Utrecht',
    riddle: 'RIDDLE_TEXT stand under the tallest tower',
    locationName: 'SECRET_LOCATION_NAME Domtoren',
    lat: 52.0908,
    lng: 5.1214,
    radiusM: 25,
    hint1: 'SECRET_HINT1 near the cathedral',
    hint2: 'SECRET_HINT2 look up at the bells',
    hint2PhotoUrl: 'https://example.com/SECRET_PHOTO.jpg',
    funFact: 'SECRET_FUNFACT 112 metres tall',
    trivia: {
      question: 'How tall is the Dom Tower?',
      options: ['SECRET_OPT_A 80 m', 'SECRET_OPT_B 112 m', 'SECRET_OPT_C 150 m'],
      correctIndex: 1,
      explain: 'SECRET_TRIVIA_EXPLAIN',
    },
    puzzle: {
      type: 'anagram',
      prompt: 'Unscramble: MOD',
      answer: 'SECRETANSWERDOM|Domtoren',
      hint: 'SECRET_PUZZLE_HINT',
      explain: 'SECRET_PUZZLE_EXPLAIN',
    },
    onSite: {
      question: 'How many bells?',
      answer: 'SECRETONSITE14|fourteen',
      explain: 'SECRET_ONSITE_EXPLAIN',
      fieldChecked: true,
    },
    i18n: {
      nl: { riddle: 'RIDDLE_NL', hint1: 'SECRET_HINT1_NL', hint2: 'SECRET_HINT2_NL', puzzle: { prompt: 'Ontwar: MOD', hint: 'SECRET_PUZZLE_HINT_NL' } },
    },
    ...over,
  } as ClueDoc
}

function view(difficulty: Difficulty, sc: SessionClueDoc | null = null, tiers: string[] = [], clue = makeClue()) {
  return toActiveClueView({ huntId: HUNT, clueId: CLUE, clue, sc, difficulty, totalClues: 8, unlockedTiers: tiers })
}

const solved: SessionClueDoc = { puzzleSolvedAt: { seconds: 1 } }

const SECRETS = [
  'SECRETANSWERDOM', 'secretanswerdom', 'Domtoren', 'domtoren',
  'SECRETONSITE14', 'fourteen',
  'SECRET_HINT1', 'SECRET_HINT2', 'SECRET_PHOTO', 'SECRET_PUZZLE_HINT',
  'SECRET_OPT_', 'SECRET_TRIVIA_EXPLAIN', 'SECRET_ONSITE_EXPLAIN', 'SECRET_FUNFACT',
  'SECRET_LOCATION_NAME', 'correctIndex',
]

describe('toActiveClueView — never leaks secrets', () => {
  for (const difficulty of ['easy', 'medium', 'hard'] as Difficulty[]) {
    for (const [label, sc] of [['before solve', null], ['after solve', solved]] as const) {
      it(`${difficulty} ${label}`, () => {
        const json = JSON.stringify(view(difficulty, sc))
        for (const s of SECRETS) expect(json, `leaked ${s}`).not.toContain(s)
        // Puzzle explain only after solving.
        if (sc) expect(json).toContain('SECRET_PUZZLE_EXPLAIN')
        else expect(json).not.toContain('SECRET_PUZZLE_EXPLAIN')
      })
    }
  }

  it('riddle is withheld until the puzzle is solved', () => {
    expect(view('medium').riddle).toBeNull()
    expect(view('medium', solved).riddle?.en).toContain('RIDDLE_TEXT')
    expect(view('medium', solved).riddle?.nl).toBe('RIDDLE_NL')
  })

  it('riddle is shown immediately when there is no puzzle', () => {
    const v = view('medium', null, [], makeClue({ puzzle: undefined }))
    expect(v.puzzle).toBeNull()
    expect(v.riddle?.en).toContain('RIDDLE_TEXT')
  })

  it('puzzle exposes only prompt, hashes and hasHint', () => {
    const p = view('medium').puzzle!
    expect(p.prompt.en).toBe('Unscramble: MOD')
    expect(p.prompt.nl).toBe('Ontwar: MOD')
    expect(p.hasHint).toBe(true)
    expect(Object.keys(p).sort()).toEqual(['answerHashes', 'explain', 'hasHint', 'prompt', 'type'])
  })

  it('hint texts appear only for unlocked tiers', () => {
    const none = view('medium')
    expect(none.hintsUnlocked).toEqual({})
    const v = view('medium', null, ['1', '2', 'puzzle'])
    expect(v.hintsUnlocked['1']?.text?.en).toContain('SECRET_HINT1')
    expect(v.hintsUnlocked['1']?.text?.nl).toBe('SECRET_HINT1_NL')
    expect(v.hintsUnlocked['2']?.photoUrl).toContain('SECRET_PHOTO')
    expect(v.hintsUnlocked.puzzle?.text?.nl).toBe('SECRET_PUZZLE_HINT_NL')
    // Tier 1 alone must not reveal tier 2.
    expect(JSON.stringify(view('medium', null, ['1']))).not.toContain('SECRET_HINT2')
  })

  it('hasOnSite only for field-checked questions', () => {
    expect(view('easy').hasOnSite).toBe(true)
    const unchecked = makeClue({ onSite: { question: 'q', answer: 'a', fieldChecked: false } })
    expect(view('easy', null, [], unchecked).hasOnSite).toBe(false)
  })
})

describe('navigation / target per difficulty (GAME_DESIGN.md table)', () => {
  const expected = { lat: 52.0908, lng: 5.1214, radiusM: Math.max(25, MIN_ARRIVAL_RADIUS_M) }

  it('easy before solve → compass + target, no pin', () => {
    const v = view('easy')
    expect(v.navigation).toBe('compass')
    expect(v.target).toEqual(expected)
    expect(v.showPin).toBe(false)
  })
  it('easy after solve → compass + pin', () => {
    const v = view('easy', solved)
    expect(v.navigation).toBe('compass')
    expect(v.target).toEqual(expected)
    expect(v.showPin).toBe(true)
  })
  it('medium before solve → warmth, target withheld', () => {
    const v = view('medium')
    expect(v.navigation).toBe('warmth')
    expect(v.target).toBeNull()
    expect(v.showPin).toBe(false)
  })
  it('medium after solve → compass + target', () => {
    const v = view('medium', solved)
    expect(v.navigation).toBe('compass')
    expect(v.target).toEqual(expected)
    expect(v.showPin).toBe(false)
  })
  it('hard before solve → warmth, target withheld', () => {
    const v = view('hard')
    expect(v.navigation).toBe('warmth')
    expect(v.target).toBeNull()
  })
  it('hard after solve → warmth + target (for offline arrival)', () => {
    const v = view('hard', solved)
    expect(v.navigation).toBe('warmth')
    expect(v.target).toEqual(expected)
    expect(v.showPin).toBe(false)
  })
  it('pin reveal (tier 3) unlocks compass + pin on any difficulty', () => {
    for (const d of ['easy', 'medium', 'hard'] as Difficulty[]) {
      const viaTier = view(d, null, ['3'])
      expect(viaTier.navigation).toBe('compass')
      expect(viaTier.showPin).toBe(true)
      expect(viaTier.pinRevealed).toBe(true)
      expect(viaTier.target).toEqual(expected)
      const viaSc = view(d, { pinRevealedAt: { seconds: 1 } })
      expect(viaSc.showPin).toBe(true)
    }
  })
  it('the "solved" flag requires a puzzle', () => {
    // A clue without a puzzle is never "solved", so medium stays on warmth.
    const v = view('medium', solved, [], makeClue({ puzzle: undefined }))
    expect(v.puzzleSolved).toBe(false)
    expect(v.target).toBeNull()
  })
  it('navState matches the table directly', () => {
    expect(navState('easy', false, false)).toEqual({ navigation: 'compass', sendTarget: true, showPin: false })
    expect(navState('medium', false, false)).toEqual({ navigation: 'warmth', sendTarget: false, showPin: false })
    expect(navState('medium', true, false)).toEqual({ navigation: 'compass', sendTarget: true, showPin: false })
    expect(navState('hard', false, false)).toEqual({ navigation: 'warmth', sendTarget: false, showPin: false })
    expect(navState('hard', true, false)).toEqual({ navigation: 'warmth', sendTarget: true, showPin: false })
  })
  it('normalizeDifficulty defaults unknown values to medium', () => {
    expect(normalizeDifficulty('easy')).toBe('easy')
    expect(normalizeDifficulty('hard')).toBe('hard')
    expect(normalizeDifficulty('EXTREME')).toBe('medium')
    expect(normalizeDifficulty(undefined)).toBe('medium')
  })
})

describe('zoneFor', () => {
  const targets = [
    { id: 'clue-01', lat: 52.0908, lng: 5.1214 },
    { id: 'clue-02', lat: 52.3731, lng: 4.8926 },
    { id: 'rome-07', lat: 41.8902, lng: 12.4922 },
    { id: 'oslo-x', lat: 59.9139, lng: 10.7522 },
  ]

  it('is deterministic per clue id', () => {
    for (const t of targets) expect(zoneFor(t.id, t.lat, t.lng)).toEqual(zoneFor(t.id, t.lat, t.lng))
  })
  it('differs between clue ids', () => {
    expect(zoneFor('a', 52, 5)).not.toEqual(zoneFor('b', 52, 5))
  })
  it('contains the target, offset by 25–60 % of the radius', () => {
    for (let i = 0; i < 200; i++) {
      const t = { id: `clue-${i}`, lat: 52 + (i % 7) * 0.5, lng: 5 + (i % 11) * 0.3 }
      const z = zoneFor(t.id, t.lat, t.lng)
      expect(z.radiusM).toBe(ZONE_RADIUS_M)
      const d = haversineM(z.lat, z.lng, t.lat, t.lng)
      expect(d).toBeLessThanOrEqual(z.radiusM)
      // Allow a little slack for the 6-decimal rounding and the flat-earth approximation.
      expect(d).toBeLessThanOrEqual(ZONE_RADIUS_M * ZONE_MAX_OFFSET_FRACTION + 1)
      expect(d).toBeGreaterThanOrEqual(ZONE_RADIUS_M * ZONE_MAX_OFFSET_FRACTION * 0.25 - 1)
    }
  })
  it('active view zone is the deterministic zone', () => {
    expect(view('hard').zone).toEqual(zoneFor(CLUE, 52.0908, 5.1214))
  })
})

describe('answer hashes', () => {
  const sha = (s: string) => createHash('sha256').update(s).digest('hex')

  it('answerHash = sha256(`huntId:clueId:normalized`)', () => {
    expect(answerHash(HUNT, CLUE, 'domtoren')).toBe(sha(`${HUNT}:${CLUE}:domtoren`))
  })
  it('active view hashes every accepted (normalized) answer', () => {
    const hashes = view('medium').puzzle!.answerHashes
    expect(hashes).toEqual([
      sha(`${HUNT}:${CLUE}:secretanswerdom`),
      sha(`${HUNT}:${CLUE}:domtoren`),
    ])
    for (const h of hashes) expect(h).toMatch(/^[0-9a-f]{64}$/)
  })
  it('a client-side check with normalizePuzzleAnswer matches', () => {
    const hashes = view('medium').puzzle!.answerHashes
    const typed = '  DOM-toren! '
    expect(hashes).toContain(sha(`${HUNT}:${CLUE}:${normalizePuzzleAnswer(typed)}`))
  })
  it('hashes are salted per hunt and clue', () => {
    expect(answerHash('h1', 'c1', 'x')).not.toBe(answerHash('h2', 'c1', 'x'))
    expect(answerHash('h1', 'c1', 'x')).not.toBe(answerHash('h1', 'c2', 'x'))
  })
  it('acceptedAnswers / matchesAnswer', () => {
    expect(acceptedAnswers('TWENTY|20|twenty| ')).toEqual(['twenty', '20'])
    expect(acceptedAnswers(undefined)).toEqual([])
    expect(matchesAnswer('TWENTY|20', ' Twenty ')).toBe(true)
    expect(matchesAnswer('TWENTY|20', '21')).toBe(false)
    expect(matchesAnswer('TWENTY|20', '   ')).toBe(false)
    expect(matchesAnswer('', '')).toBe(false)
  })
  it('hintsUnlockedFor ignores unknown tiers', () => {
    expect(hintsUnlockedFor(makeClue(), ['7', 'bogus'])).toEqual({})
  })
})

describe('arrived / completed views', () => {
  it('arrived view: no on-site answer, no trivia key before answering, fun fact after quiz', () => {
    const v = toArrivedStopView({ clueId: CLUE, clue: makeClue(), sc: null, totalClues: 8 })
    const json = JSON.stringify(v)
    for (const s of ['SECRETONSITE14', 'fourteen', 'correctIndex', 'SECRET_TRIVIA_EXPLAIN', 'SECRET_FUNFACT']) {
      expect(json).not.toContain(s)
    }
    expect(v.onSite?.attemptsLeft).toBe(ONSITE_MAX_ATTEMPTS)
    expect(v.trivia?.options).toHaveLength(3)

    const after = toArrivedStopView({
      clueId: CLUE, clue: makeClue(), totalClues: 8,
      sc: { trivia: { pickedIndex: 0, correct: false }, onSite: { attempts: 3, correct: false } },
    })
    expect(after.triviaResult).toMatchObject({ correct: false, pickedIndex: 0, correctIndex: 1 })
    expect(after.funFact?.en).toContain('SECRET_FUNFACT')
    expect(after.onSite).toMatchObject({ attemptsLeft: 0, done: true, correct: false })
  })
  it('completed view never includes the puzzle or on-site answers', () => {
    const v = toCompletedClueView({ clueId: CLUE, clue: makeClue(), sc: { breakdown: { arrival: 50, clean: 25 } } })
    const json = JSON.stringify(v)
    for (const s of ['SECRETANSWERDOM', 'SECRETONSITE14', 'fourteen']) expect(json).not.toContain(s)
    expect(v.points).toBe(75)
  })
})
