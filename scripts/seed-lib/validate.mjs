// Content validation. Runs on every seed (and on --dry-run) and refuses to
// write anything if a single rule fails. Each rule mirrors a game-design
// constraint from docs/GAME_DESIGN.md or a past content bug.

import { LANGS } from './build.mjs'
import { encode, anagramLetters, letterBag, plain } from './cipher.mjs'

const PUZZLE_TYPES = new Set(['cipher', 'anagram', 'wordplay', 'reverse', 'logic', 'numbers', 'rebus'])
const DIFFICULTIES = new Set(['easy', 'medium', 'hard'])
const MIN_RADIUS_M = 40
const MAX_CITY_DISTANCE_M = 12000
// Rough city centres (OSM) — a sanity net for swapped or mistyped coordinates.
const CITY_CENTRES = {
  city_utrecht: [52.0907, 5.1214],
  city_amsterdam: [52.3731, 4.8926],
  city_the_hague: [52.0799, 4.3113],
  city_rotterdam: [51.9225, 4.4792],
  city_delft: [52.0116, 4.3571],
  city_leiden: [52.1601, 4.4970],
  city_haarlem: [52.3809, 4.6368],
  city_milan: [45.4642, 9.1900],
  city_rome: [41.8967, 12.4822],
}

const R = 6371000
const rad = x => (x * Math.PI) / 180
export function distanceM(lat1, lng1, lat2, lng2) {
  const dLat = rad(lat2 - lat1)
  const dLng = rad(lng2 - lng1)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

const nonEmpty = v => typeof v === 'string' && v.trim().length > 0
const squash = s => plain(s).replace(/ /g, '')

/** Recursively look for a forbidden key anywhere in an object. */
function findKey(obj, key, path = '') {
  if (!obj || typeof obj !== 'object') return []
  const hits = []
  for (const [k, v] of Object.entries(obj)) {
    const p = path ? `${path}.${k}` : k
    if (k === key) hits.push(p)
    hits.push(...findKey(v, key, p))
  }
  return hits
}

export function validateContent({ COUNTRIES, CITIES, HUNTS }) {
  const errors = []
  const err = (where, msg) => errors.push(`${where}: ${msg}`)
  const stats = { ciphersVerified: 0, anagramsVerified: 0, reversesVerified: 0, onSite: 0, onSiteFieldChecked: 0 }

  // ── Countries & cities ────────────────────────────────────────────
  const seen = new Set()
  for (const c of COUNTRIES) {
    if (seen.has(`country:${c.id}`)) err(`country ${c.id}`, 'duplicate id')
    seen.add(`country:${c.id}`)
    for (const lang of LANGS) {
      if (!nonEmpty(c.i18n?.[lang]?.name) || !nonEmpty(c.i18n?.[lang]?.description)) err(`country ${c.id}`, `i18n.${lang} incomplete`)
    }
  }
  for (const c of CITIES) {
    if (seen.has(`city:${c.id}`)) err(`city ${c.id}`, 'duplicate id')
    seen.add(`city:${c.id}`)
    if (!COUNTRIES.some(k => k.id === c.countryId)) err(`city ${c.id}`, `unknown countryId ${c.countryId}`)
    for (const lang of LANGS) {
      if (!nonEmpty(c.i18n?.[lang]?.name) || !nonEmpty(c.i18n?.[lang]?.description)) err(`city ${c.id}`, `i18n.${lang} incomplete`)
    }
  }

  // ── Hunts ─────────────────────────────────────────────────────────
  const huntIds = new Set()
  for (const h of HUNTS) {
    const H = `hunt ${h.id}`
    if (huntIds.has(h.id)) err(H, 'duplicate hunt id')
    huntIds.add(h.id)
    const m = h.meta
    const city = CITIES.find(c => c.id === m.cityId)
    if (!city) err(H, `unknown cityId ${m.cityId}`)
    if (!DIFFICULTIES.has(m.difficulty)) err(H, `bad difficulty ${m.difficulty}`)
    for (const k of ['rating', 'badge']) {
      const hits = findKey(m, k)
      if (hits.length) err(H, `invented field "${k}" present (${hits.join(', ')}) — remove it`)
    }
    for (const lang of LANGS) {
      if (!nonEmpty(m.i18n?.[lang]?.title) || !nonEmpty(m.i18n?.[lang]?.description)) err(H, `meta i18n.${lang} title/description missing`)
    }

    // Mystery: the public doc must not carry the solution.
    if (m.mystery) {
      if ('solution' in m.mystery) err(H, 'mystery.solution must live in huntSecrets, not the public hunt doc')
      const sol = h.secrets?.mysterySolution
      if (!sol?.suspect || !sol?.weapon || !sol?.place) err(H, 'mystery hunt without secrets.mysterySolution')
      else {
        // Evidence must eliminate everything except the solution.
        const out = { suspects: new Set(), weapons: new Set(), places: new Set() }
        for (const c of h.clues) for (const [k, ids] of Object.entries(c.evidence?.eliminates ?? {})) for (const id of ids) out[k]?.add(id)
        const left = k => m.mystery[k].map(x => x.id).filter(id => !out[k].has(id))
        const exp = { suspects: sol.suspect, weapons: sol.weapon, places: sol.place }
        for (const k of Object.keys(exp)) {
          const l = left(k)
          if (l.length !== 1 || l[0] !== exp[k]) err(H, `evidence leaves ${k} [${l.join(', ')}], expected only "${exp[k]}"`)
        }
      }
      for (const lang of LANGS) {
        if (!nonEmpty(m.mystery.i18n?.[lang]?.intro)) err(H, `mystery i18n.${lang}.intro missing`)
      }
    }

    const isTour = m.tourType === 'tour'
    const clueIds = new Set()
    h.clues.forEach((c, idx) => {
      const C = `${h.id}/${c.id}`
      if (clueIds.has(c.id)) err(C, 'duplicate clue id')
      clueIds.add(c.id)
      if (c.order !== idx + 1) err(C, `order ${c.order} but position ${idx + 1}`)
      if (typeof c.lat !== 'number' || typeof c.lng !== 'number') err(C, 'lat/lng missing')
      else if (CITY_CENTRES[m.cityId] && distanceM(c.lat, c.lng, ...CITY_CENTRES[m.cityId]) > MAX_CITY_DISTANCE_M) err(C, `coordinates ${c.lat},${c.lng} far from ${m.cityId}`)
      if (!(c.radiusM >= MIN_RADIUS_M)) err(C, `radiusM ${c.radiusM} < ${MIN_RADIUS_M}`)
      const h3 = findKey(c, 'hint3')
      if (h3.length) err(C, `hint3 still present (${h3.join(', ')}) — it's a map-pin reveal now`)
      for (const k of ['riddle', 'locationName', 'funFact', 'theme']) if (!nonEmpty(c[k])) err(C, `${k} empty`)
      if (!isTour && (!nonEmpty(c.hint1) || !nonEmpty(c.hint2))) err(C, 'hint1/hint2 empty')

      for (const lang of LANGS) {
        const t = c.i18n?.[lang]
        if (!t) { err(C, `i18n.${lang} missing`); continue }
        for (const k of ['riddle', 'locationName', 'funFact', 'theme']) if (!nonEmpty(t[k])) err(C, `i18n.${lang}.${k} empty`)
        if (!isTour && (!nonEmpty(t.hint1) || !nonEmpty(t.hint2))) err(C, `i18n.${lang} hint1/hint2 empty`)
        if (c.trivia) {
          if (!t.trivia || !nonEmpty(t.trivia.question) || !nonEmpty(t.trivia.explain)) err(C, `i18n.${lang}.trivia incomplete`)
          else if (t.trivia.options?.length !== c.trivia.options.length) err(C, `i18n.${lang}.trivia options count differs`)
        }
        if (c.puzzle && (!t.puzzle || !nonEmpty(t.puzzle.prompt) || !nonEmpty(t.puzzle.hint) || !nonEmpty(t.puzzle.explain))) err(C, `i18n.${lang}.puzzle incomplete`)
        if (c.onSite && (!t.onSite || !nonEmpty(t.onSite.question) || !nonEmpty(t.onSite.explain))) err(C, `i18n.${lang}.onSite incomplete`)
      }

      if (c.trivia) {
        const { options, correctIndex, question, explain } = c.trivia
        if (!Array.isArray(options) || options.length !== 4) err(C, 'trivia needs exactly 4 options')
        if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= (options?.length ?? 0)) err(C, `trivia correctIndex ${correctIndex} out of range`)
        if (!nonEmpty(question) || !nonEmpty(explain)) err(C, 'trivia question/explain empty')
        if (new Set(options.map(o => o.toLowerCase().replace(/[^a-z0-9]+/g, ''))).size !== options.length) err(C, 'trivia options not distinct')
      }

      if (c.puzzle) {
        const p = c.puzzle
        if (!PUZZLE_TYPES.has(p.type)) err(C, `puzzle type "${p.type}" not allowed`)
        if (!nonEmpty(p.answer)) err(C, 'puzzle.answer empty')
        const canonical = (p.answer || '').split('|')[0]
        const prompts = [p.prompt, ...LANGS.map(l => c.i18n?.[l]?.puzzle?.prompt).filter(Boolean)]
        if (p.type === 'cipher' || p.type === 'reverse') {
          if (!p.scheme) err(C, `${p.type} puzzle without scheme`)
          else {
            try {
              const enc = encode(p.scheme, canonical)
              for (const pr of prompts) {
                if (!pr.replace(/\s+/g, ' ').includes(enc)) { err(C, `${p.scheme} of "${canonical}" = "${enc}" not found in prompt "${pr.slice(0, 80)}…"`); break }
              }
              if (p.type === 'cipher') stats.ciphersVerified++
              else stats.reversesVerified++
            } catch (e) { err(C, e.message) }
          }
        }
        if (p.type === 'anagram') {
          for (const pr of prompts) {
            const letters = anagramLetters(pr)
            if (letterBag(letters) !== letterBag(canonical)) { err(C, `anagram letters "${letters}" don't match "${canonical}" in "${pr.slice(0, 60)}…"`); break }
            if (squash(letters) === squash(canonical)) { err(C, 'anagram letters are already in the right order'); break }
          }
          stats.anagramsVerified++
        }
      } else if (!isTour && !m.tourType) {
        // Hunts: every stop has a puzzle (the puzzle is the clue).
        err(C, 'hunt clue without puzzle')
      }

      if (c.onSite) {
        stats.onSite++
        if (typeof c.onSite.fieldChecked !== 'boolean') err(C, 'onSite.fieldChecked missing')
        if (c.onSite.fieldChecked) stats.onSiteFieldChecked++
        if (!nonEmpty(c.onSite.answer) || !nonEmpty(c.onSite.question)) err(C, 'onSite question/answer empty')
      }
    })

    // Cipher variety: two ciphers in a row (in play order) never share a scheme.
    const ciphers = h.clues.filter(c => c.puzzle?.type === 'cipher')
    for (let i = 1; i < ciphers.length; i++) {
      if (ciphers[i].puzzle.scheme === ciphers[i - 1].puzzle.scheme) {
        err(`${h.id}/${ciphers[i].id}`, `same cipher scheme (${ciphers[i].puzzle.scheme}) as the previous cipher ${ciphers[i - 1].id}`)
      }
    }
    for (const c of ciphers) stats.schemes = { ...stats.schemes, [c.puzzle.scheme]: (stats.schemes?.[c.puzzle.scheme] ?? 0) + 1 }
  }

  return { errors, stats }
}
