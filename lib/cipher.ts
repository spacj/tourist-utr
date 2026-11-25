/**
 * Puzzle encoders, TypeScript twin of scripts/seed-lib/cipher.mjs (keep the
 * two in sync). Used by the creator editor ("generate the coded text") and by
 * draft validation, so a creator's cipher can never ship unsolvable.
 *
 *   caesar:N  each letter moved N places forward (A→D for N=3)
 *   atbash    A↔Z, B↔Y, …
 *   a1z26     A=1 … Z=26, letters joined with '-', words with ' / '
 *   reverse   right-to-left
 */

const A = 'A'.charCodeAt(0)

/** Uppercase, strip diacritics, keep letters + spaces only. */
export function plain(s: string): string {
  return s
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z ]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const mapLetters = (s: string, f: (i: number) => number) =>
  s.replace(/[A-Z]/g, ch => String.fromCharCode(A + f(ch.charCodeAt(0) - A)))

export const caesar = (s: string, n: number) => mapLetters(plain(s), i => (((i + n) % 26) + 26) % 26)
export const atbash = (s: string) => mapLetters(plain(s), i => 25 - i)
export const a1z26 = (s: string) =>
  plain(s).split(' ').map(w => [...w].map(ch => ch.charCodeAt(0) - A + 1).join('-')).join(' / ')
export const reverse = (s: string) => [...plain(s)].reverse().join('')

export const CIPHER_SCHEMES = ['atbash', 'a1z26', 'caesar:1', 'caesar:2', 'caesar:3', 'caesar:4', 'caesar:5', 'caesar:7', 'caesar:13'] as const

export function isScheme(s: unknown): s is string {
  return typeof s === 'string' && (s === 'atbash' || s === 'a1z26' || s === 'reverse' || /^caesar:-?\d{1,2}$/.test(s))
}

/** Encode `answer` with `scheme`; the result must appear in the puzzle prompt. */
export function encode(scheme: string, answer: string): string {
  if (scheme === 'atbash') return atbash(answer)
  if (scheme === 'a1z26') return a1z26(answer)
  if (scheme === 'reverse') return reverse(answer)
  const m = /^caesar:(-?\d+)$/.exec(scheme)
  if (m) return caesar(answer, Number(m[1]))
  throw new Error(`unknown cipher scheme "${scheme}"`)
}

/** Sorted letters, ignoring everything but A–Z. */
export const letterBag = (s: string) => [...plain(s).replace(/ /g, '')].sort().join('')

/** The longest run of single capitals separated by spaces ("N E U D E"). */
export function anagramLetters(prompt: string): string {
  const runs = prompt.match(/(?:\b[A-Z]\b[ ·]*){3,}/g) || []
  return runs.sort((a, b) => b.length - a.length)[0]?.replace(/[^A-Z]/g, '') ?? ''
}

/** Shuffle an answer into spaced capitals that are not already in order. */
export function scramble(answer: string, seed = 7): string {
  const letters = [...plain(answer).replace(/ /g, '')]
  if (letters.length < 3) return letters.join(' ')
  let s = seed
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
  for (let tries = 0; tries < 10; tries++) {
    const out = [...letters]
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]]
    }
    if (out.join('') !== letters.join('')) return out.join(' ')
  }
  return [...letters].reverse().join(' ')
}
