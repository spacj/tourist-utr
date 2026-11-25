import { describe, it, expect } from 'vitest'
import { HttpError } from '@/lib/apiAuth'
import { atbash, encode, scramble, letterBag } from '@/lib/cipher'
import {
  ALL_LANGS, buildPublishedHunt, emptyContent, emptyStop, joinAnswers, sanitizeDraftContent,
  validateDraft, validateTranslations, type DraftContent, type DraftStop, type DraftTranslations,
} from '@/lib/huntDraft'
import { CREATOR_HUNT_PRICE_EUROS, type Lang } from '@/types'

const UTRECHT = { lat: 52.0907, lng: 5.1214 }

function stop(i: number, over: Partial<DraftStop> = {}): DraftStop {
  return {
    ...emptyStop(`s${i}`),
    theme: `Theme ${i}`, riddle: `Riddle ${i}`, locationName: `Place ${i}`,
    lat: 52.09 + i * 0.001, lng: 5.12, radiusM: 50,
    hint1: 'Near the canal', hint2: 'Look up', funFact: `Fact ${i}`,
    trivia: { question: 'How old?', options: ['100', '200', '300', '400'], correctIndex: 2, explain: 'Old.' },
    puzzle: { type: 'cipher', scheme: 'atbash', prompt: `Decode: ${atbash(`PLACE${i}`)}`, answers: [`PLACE${i}`], hint: 'A↔Z', explain: 'Atbash.' },
    ...over,
  }
}

function draft(over: Partial<DraftContent> = {}): DraftContent {
  return {
    ...emptyContent('nl'),
    title: 'Grachten & geheimen',
    description: 'Een wandeling langs de mooiste plekken van de oude binnenstad.',
    cityId: 'city_utrecht',
    stops: [1, 2, 3, 4, 5].map(i => stop(i)),
    ...over,
  }
}

function translations(d: DraftContent): DraftTranslations {
  const out: DraftTranslations = {}
  for (const lang of ALL_LANGS) {
    if (lang === d.sourceLang) continue
    out[lang] = {
      title: `${lang} title`,
      description: `${lang} description`,
      stops: Object.fromEntries(d.stops.map(s => [s.id, {
        theme: `${lang} ${s.theme}`, riddle: `${lang} ${s.riddle}`, locationName: `${lang} ${s.locationName}`,
        hint1: `${lang} h1`, hint2: `${lang} h2`, funFact: `${lang} fact`,
        trivia: { question: `${lang} q`, options: ['100', '200', '300', '400'], explain: `${lang} e` },
        puzzle: { prompt: `${lang}: ${atbash(s.puzzle!.answers[0])}`, hint: `${lang} ph`, explain: `${lang} pe` },
      }])),
    }
  }
  return out
}

describe('cipher (TS twin of the seeder)', () => {
  it('encodes like the seeder', () => {
    expect(encode('atbash', 'Domtoren')).toBe('WLNGLIVM')
    expect(encode('caesar:3', 'abc xyz')).toBe('DEF ABC')
    expect(encode('a1z26', 'ab c')).toBe('1-2 / 3')
    expect(encode('reverse', 'Dom')).toBe('MOD')
  })
  it('scramble keeps the letters and changes the order', () => {
    const s = scramble('NEUDE')
    expect(letterBag(s)).toBe(letterBag('NEUDE'))
    expect(s.replace(/ /g, '')).not.toBe('NEUDE')
  })
})

describe('sanitizeDraftContent', () => {
  const body = { ...draft(), stops: draft().stops }
  it('accepts a full draft and keeps the shape', () => {
    const d = sanitizeDraftContent(body as unknown as Record<string, unknown>)
    expect(d.stops).toHaveLength(5)
    expect(d.sourceLang).toBe('nl')
  })
  it('ignores a price sent by the client', () => {
    const d = sanitizeDraftContent({ ...body, priceEuros: 49 } as unknown as Record<string, unknown>)
    expect('priceEuros' in d).toBe(false)
  })
  it('rejects bad structure', () => {
    const bad = (over: Record<string, unknown>, code: string) => {
      try { sanitizeDraftContent({ ...body, ...over } as unknown as Record<string, unknown>) } catch (e) {
        expect(e).toBeInstanceOf(HttpError); expect((e as HttpError).code).toBe(code); return
      }
      throw new Error('expected throw')
    }
    bad({ stops: [stop(1), stop(1)] }, 'duplicate_stop_id')
    bad({ stops: [{ ...stop(1), id: 'a b' }] }, 'invalid_stop_id')
    bad({ stops: [{ ...stop(1), lat: 95 }] }, 'invalid_lat')
    bad({ stops: [{ ...stop(1), radiusM: 10 }] }, 'invalid_radiusM')
    bad({ title: 'x'.repeat(81) }, 'text_too_long')
    bad({ coverImageUrl: 'http://insecure.example/x.jpg' }, 'invalid_coverImageUrl')
    bad({ cityId: 'bad id' }, 'invalid_cityId')
    bad({ stops: Array.from({ length: 26 }, (_, i) => stop(i)) }, 'too_many_stops')
  })
})

describe('validateDraft', () => {
  it('a complete hunt has no problems', () => {
    expect(validateDraft(draft(), UTRECHT)).toEqual([])
  })
  it('needs 5 stops for a hunt, 3 for a tour', () => {
    const few = draft({ stops: [stop(1), stop(2), stop(3)] })
    expect(validateDraft(few, UTRECHT)).toContainEqual({ where: 'hunt', code: 'too_few_stops', detail: '5' })
    const tour = draft({ tourType: 'tour', stops: [1, 2, 3].map(i => stop(i, { puzzle: null, hint1: '', hint2: '' })) })
    expect(validateDraft(tour, UTRECHT)).toEqual([])
  })
  it('hunt stops need a puzzle and hints', () => {
    const d = draft({ stops: [stop(1, { puzzle: null }), stop(2, { hint2: '' }), stop(3), stop(4), stop(5)] })
    const p = validateDraft(d, UTRECHT)
    expect(p).toContainEqual({ where: 1, code: 'puzzle_missing' })
    expect(p).toContainEqual({ where: 2, code: 'hints_missing' })
  })
  it('catches a cipher whose code is not in the prompt', () => {
    const d = draft()
    d.stops[0] = stop(1, { puzzle: { ...stop(1).puzzle!, prompt: 'Decode: XXXXX' } })
    expect(validateDraft(d, UTRECHT)).toContainEqual({ where: 1, code: 'puzzle_code_not_in_prompt' })
  })
  it('checks anagrams', () => {
    const d = draft()
    d.stops[0] = stop(1, { puzzle: { type: 'anagram', prompt: 'Unscramble: N E U D E', answers: ['NEUDE'], hint: 'h', explain: 'e' } })
    expect(validateDraft(d, UTRECHT)).toContainEqual({ where: 1, code: 'puzzle_anagram_in_order' })
    d.stops[0] = stop(1, { puzzle: { type: 'anagram', prompt: `Unscramble: ${scramble('NEUDE')}`, answers: ['NEUDE'], hint: 'h', explain: 'e' } })
    expect(validateDraft(d, UTRECHT)).toEqual([])
  })
  it('flags locations far from the city and missing pins', () => {
    const d = draft()
    d.stops[0] = stop(1, { lat: 52.37, lng: 4.89 }) // Amsterdam
    d.stops[1] = stop(2, { lat: null, lng: null })
    const p = validateDraft(d, UTRECHT)
    expect(p).toContainEqual({ where: 1, code: 'location_far_from_city' })
    expect(p).toContainEqual({ where: 2, code: 'location_missing' })
  })
  it('trivia needs 4 distinct options', () => {
    const d = draft()
    d.stops[0] = stop(1, { trivia: { question: 'q', options: ['a', 'a', 'b', 'c'], correctIndex: 0, explain: 'e' } })
    expect(validateDraft(d, UTRECHT)).toContainEqual({ where: 1, code: 'trivia_options_not_distinct' })
  })
})

describe('translations and publishing', () => {
  it('validateTranslations wants every other language', () => {
    const d = draft()
    const tr = translations(d)
    expect(validateTranslations(d, tr)).toEqual([])
    delete tr.fr
    expect(validateTranslations(d, tr)).toContainEqual({ where: 'hunt', code: 'translation_missing', detail: 'fr' })
  })

  it('publishes in the seeder shape: English on top, five languages in i18n', () => {
    const d = draft()
    const { hunt, clues } = buildPublishedHunt(d, translations(d), {
      huntId: 'c_abc', ownerUid: 'u1', creatorName: 'Anna', creatorSlug: 'anna',
      cityName: 'Utrecht', active: true, version: 1, order: 1000,
    })
    expect(hunt.title).toBe('en title')
    expect(hunt.priceEuros).toBe(CREATOR_HUNT_PRICE_EUROS)
    expect(hunt.ownerUid).toBe('u1')
    expect(hunt.clueCount).toBe(5)
    expect(Object.keys(hunt.i18n as object).sort()).toEqual(['de', 'es', 'fr', 'it', 'nl'])
    expect((hunt.i18n as Record<Lang, { title: string }>).nl.title).toBe(d.title) // source language

    const c = clues[0]
    expect(c.id).toBe('s1')
    expect(c.order).toBe(1)
    expect(c.riddle).toBe('en Riddle 1')
    expect(c.hint2PhotoUrl).toBeNull()
    expect((c.trivia as { correctIndex: number }).correctIndex).toBe(2)
    const puzzle = c.puzzle as { prompt: string; answer: string; scheme: string }
    expect(puzzle.scheme).toBe('atbash')
    // The canonical answer first, then every language's place name.
    expect(puzzle.answer.split('|')[0]).toBe('PLACE1')
    expect(puzzle.answer).toContain('en Place 1')
    expect(puzzle.answer).toContain('Place 1')
    const nl = (c.i18n as Record<string, { riddle: string; puzzle: { prompt: string } }>).nl
    expect(nl.riddle).toBe('Riddle 1')
    expect(nl.puzzle.prompt).toBe(d.stops[0].puzzle!.prompt) // source language
    expect(puzzle.prompt).toBe(`en: ${atbash('PLACE1')}`)
    expect((c.i18n as Record<string, { puzzle: { prompt: string } }>).de.puzzle.prompt).toContain(atbash('PLACE1'))
  })

  it('a translation that loses the cipher code is caught', () => {
    const d = draft()
    const tr = translations(d)
    tr.de!.stops.s1.puzzle!.prompt = 'Entschlüssle: XYZ'
    expect(validateTranslations(d, tr)).toContainEqual({ where: 1, code: 'translation_puzzle_code', detail: 'de' })
  })

  it('word puzzles accept the answer in every language', () => {
    const d = draft()
    d.stops[0] = stop(1, { puzzle: { type: 'wordplay', prompt: 'Wat heeft tanden maar bijt niet?', answers: ['kam'], hint: 'h', explain: 'e' } })
    const tr = translations(d)
    tr.en!.stops.s1.puzzle = { prompt: 'What has teeth but cannot bite?', hint: 'h', explain: 'e', answer: 'comb' }
    tr.de!.stops.s1.puzzle = { prompt: 'Was hat Zähne, beißt aber nicht?', hint: 'h', explain: 'e', answer: 'Kamm' }
    const { clues } = buildPublishedHunt(d, tr, {
      huntId: 'c_abc', ownerUid: 'u1', creatorName: 'Anna', creatorSlug: 'anna',
      cityName: 'Utrecht', active: true, version: 1, order: 1000,
    })
    const answer = (clues[0].puzzle as { answer: string }).answer.split('|')
    expect(answer[0]).toBe('kam')
    expect(answer).toContain('comb')
    expect(answer).toContain('Kamm')
  })

  it('joinAnswers dedupes by normalised form, first stays first', () => {
    expect(joinAnswers(['Dom Tower', 'domtower', 'Domtoren', ' ', 'DOMTOREN'])).toBe('Dom Tower|Domtoren')
  })
})
