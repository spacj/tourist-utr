import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { ALL_LANGS, CODED_PUZZLES, type DraftContent, type DraftTranslations, type LangTranslation } from '@/lib/huntDraft'
import type { Lang } from '@/types'

/**
 * Translate a creator's hunt into the five other app languages with Claude
 * (one structured-output request per language, in parallel). Called when an
 * admin approves a draft; the result is validated (validateTranslations)
 * before anything is published, so a lost cipher code never ships.
 *
 * Needs ANTHROPIC_API_KEY.
 */

const MODEL = 'claude-opus-5-5'

const LANG_NAMES: Record<Lang, string> = {
  en: 'English', nl: 'Dutch', de: 'German', fr: 'French', it: 'Italian', es: 'Spanish',
}

const STOP_FIELDS = [
  'id', 'theme', 'riddle', 'locationName', 'hint1', 'hint2', 'funFact',
  'trivia_question', 'trivia_options', 'trivia_explain',
  'puzzle_prompt', 'puzzle_hint', 'puzzle_explain', 'puzzle_answer',
] as const

const str = { type: 'string' }
const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'description', 'stops'],
  properties: {
    title: str,
    description: str,
    stops: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [...STOP_FIELDS],
        properties: Object.fromEntries(STOP_FIELDS.map(f => [f, f === 'trivia_options' ? { type: 'array', items: str } : str])),
      },
    },
  },
}

const SYSTEM = `You translate self-guided city scavenger hunts for the TourHunts app. Players walk from stop to stop, solve a riddle to find each place, and read a short story when they arrive.

Translate every text field from the source language into the target language so it reads as if written by a native travel writer: natural, warm, concise, the same tone and length as the source. Keep facts, numbers and dates exactly.

Rules:
- Place names (locationName): use the name a visitor speaking the target language would know. Keep the local name when there is no common translated name.
- Trivia options: keep the same order and count. Translate words; leave numbers and proper names as they are.
- Puzzle prompts: translate the instruction around the puzzle, but copy any code, cipher text, number sequence or spaced capital letters (for example "WLNGLIVM" or "N E U D E") exactly, character for character.
- puzzle_answer: for word puzzles (wordplay, logic, numbers, rebus) give the answer in the target language as a single word or short phrase. For coded puzzles (cipher, anagram, reverse) return an empty string.
- Fields that are empty in the source stay empty strings.
- Return every stop with its original id.`

interface SourceStop {
  id: string
  theme: string; riddle: string; locationName: string; hint1: string; hint2: string; funFact: string
  trivia_question: string; trivia_options: string[]; trivia_explain: string
  puzzle_type: string; puzzle_prompt: string; puzzle_hint: string; puzzle_explain: string; puzzle_answer: string
}

function sourcePayload(d: DraftContent) {
  return {
    title: d.title,
    description: d.description,
    stops: d.stops.map((s): SourceStop => ({
      id: s.id,
      theme: s.theme, riddle: s.riddle, locationName: s.locationName,
      hint1: s.hint1, hint2: s.hint2, funFact: s.funFact,
      trivia_question: s.trivia?.question ?? '',
      trivia_options: s.trivia?.options ?? [],
      trivia_explain: s.trivia?.explain ?? '',
      puzzle_type: s.puzzle?.type ?? '',
      puzzle_prompt: s.puzzle?.prompt ?? '',
      puzzle_hint: s.puzzle?.hint ?? '',
      puzzle_explain: s.puzzle?.explain ?? '',
      puzzle_answer: s.puzzle && !CODED_PUZZLES.includes(s.puzzle.type) ? (s.puzzle.answers[0] ?? '') : '',
    })),
  }
}

type RawStop = Record<(typeof STOP_FIELDS)[number], string | string[]>
interface RawTranslation { title: string; description: string; stops: RawStop[] }

const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

function toLangTranslation(d: DraftContent, raw: RawTranslation): LangTranslation {
  const byId = new Map(raw.stops.map(st => [s(st.id), st]))
  return {
    title: s(raw.title),
    description: s(raw.description),
    stops: Object.fromEntries(d.stops.map(src => {
      const st = byId.get(src.id)
      if (!st) return [src.id, { theme: '', riddle: '', locationName: '', hint1: '', hint2: '', funFact: '' }]
      const options = Array.isArray(st.trivia_options) ? st.trivia_options.map(s) : []
      return [src.id, {
        theme: s(st.theme), riddle: s(st.riddle), locationName: s(st.locationName),
        hint1: s(st.hint1), hint2: s(st.hint2), funFact: s(st.funFact),
        ...(src.trivia ? { trivia: { question: s(st.trivia_question), options, explain: s(st.trivia_explain) } } : {}),
        ...(src.puzzle ? {
          puzzle: {
            prompt: s(st.puzzle_prompt), hint: s(st.puzzle_hint), explain: s(st.puzzle_explain),
            ...(s(st.puzzle_answer) && !CODED_PUZZLES.includes(src.puzzle.type) ? { answer: s(st.puzzle_answer) } : {}),
          },
        } : {}),
      }]
    })),
  }
}

let client: Anthropic | null = null
const anthropic = () => (client ??= new Anthropic())

async function translateOne(d: DraftContent, target: Lang): Promise<LangTranslation> {
  const response = await anthropic().beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: `Source language: ${LANG_NAMES[d.sourceLang]}\nTarget language: ${LANG_NAMES[target]}\n\n${JSON.stringify(sourcePayload(d))}`,
    }],
  })
  if (response.stop_reason === 'refusal') throw new Error(`translation to ${target} was declined`)
  if (response.stop_reason === 'max_tokens') throw new Error(`translation to ${target} was cut off`)
  const text = response.content.flatMap(b => (b.type === 'text' ? [b.text] : [])).join('')
  return toLangTranslation(d, JSON.parse(text) as RawTranslation)
}

/** All five other languages; throws if any request fails. */
export async function translateDraft(d: DraftContent): Promise<DraftTranslations> {
  const targets = ALL_LANGS.filter(l => l !== d.sourceLang)
  const results = await Promise.all(targets.map(async l => [l, await translateOne(d, l)] as const))
  return Object.fromEntries(results) as DraftTranslations
}
