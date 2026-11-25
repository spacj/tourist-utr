import type { DraftProblem } from '@/lib/huntDraft'
import type { HuntDraftStatus } from '@/types'

/** Plain-English texts for the creator studio and the admin review. */

const PROBLEMS: Record<string, string> = {
  title_missing: 'Give your hunt a title.',
  description_too_short: 'Write a description of at least 20 characters.',
  city_missing: 'Choose a city, or tell us which city it is in.',
  too_few_stops: 'Add at least {n} stops.',
  location_missing: 'Put this stop on the map.',
  location_far_from_city: 'This stop is more than 15 km from the city centre.',
  location_same_as_previous: 'This stop is in the same place as the previous one.',
  theme_missing: 'Add a short theme (a few words).',
  riddle_missing: 'Write the riddle that leads players here.',
  locationName_missing: 'Add the name of the place.',
  funFact_missing: 'Add a fun fact or short story for when players arrive.',
  hints_missing: 'Add both hints.',
  trivia_incomplete: 'Complete the quiz question and its explanation.',
  trivia_needs_4_options: 'The quiz question needs 4 answer options.',
  trivia_options_not_distinct: 'The 4 quiz options must all be different.',
  puzzle_missing: 'Every stop of a hunt needs a puzzle.',
  puzzle_incomplete: 'Complete the puzzle: instructions, hint and explanation.',
  puzzle_answer_missing: 'Add the puzzle answer.',
  puzzle_scheme_missing: 'Choose a cipher.',
  puzzle_answer_not_letters: 'A coded answer needs letters.',
  puzzle_code_not_in_prompt: 'The coded answer is not in the puzzle text. Use “Generate code”.',
  puzzle_anagram_mismatch: 'The letters in the puzzle don’t match the answer. Use “Generate code”.',
  puzzle_anagram_in_order: 'The anagram letters are already in the right order.',
  translation_missing: 'Translation missing ({lang}).',
  translation_trivia: 'Quiz translation incomplete ({lang}).',
  translation_puzzle: 'Puzzle translation incomplete ({lang}).',
  translation_puzzle_code: 'The translation lost the puzzle code ({lang}).',
}

export function problemText(p: DraftProblem): string {
  const msg = PROBLEMS[p.code] ?? p.code
  return msg.replace('{n}', p.detail ?? '').replace('{lang}', (p.detail ?? '').toUpperCase())
}

export const STATUS_LABEL: Record<HuntDraftStatus, string> = {
  draft: 'Draft',
  pending_review: 'In review',
  approved: 'Live',
  rejected: 'Changes needed',
  unpublished: 'Unpublished',
}

export const eur = (cents: number) =>
  new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(cents / 100)

export const date = (ms: number | null | undefined) =>
  ms ? new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

export const LANG_LABEL: Record<string, string> = {
  en: 'English', nl: 'Nederlands', de: 'Deutsch', fr: 'Français', it: 'Italiano', es: 'Español',
}

/** Upload an image to Firebase Storage under creators/{uid}/ and return its URL. */
export async function uploadCreatorImage(uid: string, file: File, name: string): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Use a JPG, PNG or WebP image.')
  if (file.size > 5 * 1024 * 1024) throw new Error('The image must be smaller than 5 MB.')
  const [{ getStorage, ref, uploadBytes, getDownloadURL }, { firebaseApp }] = await Promise.all([
    import('firebase/storage'),
    import('@/lib/firebase'),
  ])
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const r = ref(getStorage(firebaseApp), `creators/${uid}/${name}-${Date.now()}.${ext}`)
  await uploadBytes(r, file, { contentType: file.type, cacheControl: 'public, max-age=31536000' })
  return getDownloadURL(r)
}
