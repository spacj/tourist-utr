// Builders that turn the compact per-language content in scripts/seed-data/
// into the Firestore document shapes described in docs/GAME_DESIGN.md.
//
// A clue is written as:
//
//   clue({ id, order, icon, lat, lng, radiusM,
//          puzzle: { type, scheme?, answers: [...] },   // answers: extra accepted answers
//          trivia: { correctIndex },
//          onSite: { answers: [...], fieldChecked: false },
//          evidence? },
//        { en: { theme, riddle, locationName, hint1, hint2, funFact,
//                trivia: { question, options, explain },
//                puzzle: { prompt, hint, explain },
//                onSite: { question, explain } },
//          nl: { …same keys… }, de, fr, it, es })
//
// English goes to the top level, the other languages into `i18n`. Trivia
// options default to the English ones when a language doesn't override them
// (numbers, names). Puzzle answers automatically also accept every
// language's place name, so a Dutch or Spanish player can type their word.

export const LANGS = ['nl', 'de', 'fr', 'it', 'es']

const stripParen = s => s.replace(/\s*\(.*?\)\s*/g, ' ').trim()
const parenContent = s => [...s.matchAll(/\(([^)]*)\)/g)].map(m => m[1].trim())
const norm = s => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '')

/** Unique (by normalised form) '|'-joined answer string; first entry stays first. */
export function joinAnswers(list) {
  const seen = new Set()
  const out = []
  for (const raw of list) {
    const a = String(raw ?? '').trim()
    if (!a) continue
    const k = norm(a)
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(a)
  }
  return out.join('|')
}

/** Every language's place name, with and without its parenthetical part. */
function placeNames(tr) {
  const names = []
  for (const lang of ['en', ...LANGS]) {
    const n = tr[lang]?.locationName
    if (!n) continue
    names.push(stripParen(n), ...parenContent(n))
  }
  return names
}

export function clue(base, tr) {
  const en = tr.en
  if (!en) throw new Error(`clue ${base.id}: missing English content`)
  const out = {
    id: base.id,
    order: base.order,
    icon: base.icon,
    theme: en.theme,
    riddle: en.riddle,
    locationName: en.locationName,
    lat: base.lat,
    lng: base.lng,
    radiusM: base.radiusM ?? 40,
    hint1: en.hint1 ?? '',
    hint2: en.hint2 ?? '',
    funFact: en.funFact,
  }

  if (base.trivia) {
    out.trivia = {
      question: en.trivia.question,
      options: en.trivia.options,
      correctIndex: base.trivia.correctIndex,
      explain: en.trivia.explain,
    }
  }

  if (base.puzzle) {
    const answers = [...base.puzzle.answers]
    if (base.puzzle.placeNames !== false) answers.push(...placeNames(tr))
    out.puzzle = {
      type: base.puzzle.type,
      ...(base.puzzle.scheme ? { scheme: base.puzzle.scheme } : {}),
      prompt: en.puzzle.prompt,
      answer: joinAnswers(answers),
      hint: en.puzzle.hint,
      explain: en.puzzle.explain,
    }
  }

  if (base.onSite) {
    out.onSite = {
      question: en.onSite.question,
      answer: joinAnswers(base.onSite.answers),
      explain: en.onSite.explain,
      fieldChecked: base.onSite.fieldChecked,
    }
  }

  if (base.evidence) out.evidence = base.evidence

  out.i18n = {}
  for (const lang of LANGS) {
    const t = tr[lang]
    if (!t) continue
    const block = {
      theme: t.theme,
      riddle: t.riddle,
      locationName: t.locationName,
      hint1: t.hint1 ?? '',
      hint2: t.hint2 ?? '',
      funFact: t.funFact,
    }
    if (base.trivia && t.trivia) {
      block.trivia = {
        question: t.trivia.question,
        options: t.trivia.options ?? en.trivia.options,
        correctIndex: base.trivia.correctIndex,
        explain: t.trivia.explain,
      }
    }
    if (base.puzzle && t.puzzle) block.puzzle = { prompt: t.puzzle.prompt, hint: t.puzzle.hint, explain: t.puzzle.explain }
    if (base.onSite && t.onSite) block.onSite = { question: t.onSite.question, explain: t.onSite.explain }
    out.i18n[lang] = block
  }
  return out
}

/**
 * A hunt module: { id, meta, clues, secrets? }. `meta.i18n` holds
 * title/description per language. `secrets` (mystery hunts) is written to
 * huntSecrets/{id} and never to the public hunt doc.
 */
export function hunt({ id, meta, clues, secrets }) {
  return { id, meta, clues, ...(secrets ? { secrets } : {}) }
}
