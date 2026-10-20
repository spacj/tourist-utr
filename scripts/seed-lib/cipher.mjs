// Puzzle encoders used by the seeder's validation. Every cipher / reverse /
// anagram puzzle declares a `scheme`; validation re-encodes the canonical
// answer (the first `|`-separated alternative) and checks the result is
// literally printed in every language's prompt — so no puzzle can ship
// unsolvable because of a typo.
//
//   caesar:N   each letter moved N places FORWARD (A→D for N=3). Decode by
//              moving N places back. The hint states N; the prompt doesn't.
//   atbash     the alphabet folded in half: A↔Z, B↔Y, C↔X …
//   a1z26      A=1 … Z=26, letters joined with '-', words with ' / '
//   reverse    the answer written right-to-left (spaces kept in place)
//   anagram    the prompt shows the answer's letters as spaced capitals

const A = 'A'.charCodeAt(0)

/** Uppercase, strip diacritics, keep letters + spaces only. */
export function plain(s) {
  return s
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z ]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const mapLetters = (s, f) => s.replace(/[A-Z]/g, ch => String.fromCharCode(A + f(ch.charCodeAt(0) - A)))

export function caesar(s, n) {
  return mapLetters(plain(s), i => (((i + n) % 26) + 26) % 26)
}

export function atbash(s) {
  return mapLetters(plain(s), i => 25 - i)
}

export function a1z26(s) {
  return plain(s).split(' ').map(w => [...w].map(ch => ch.charCodeAt(0) - A + 1).join('-')).join(' / ')
}

export function reverse(s) {
  return [...plain(s)].reverse().join('')
}

/** Encode `answer` with `scheme`; returns the string that must appear in the prompt. */
export function encode(scheme, answer) {
  if (scheme === 'atbash') return atbash(answer)
  if (scheme === 'a1z26') return a1z26(answer)
  if (scheme === 'reverse') return reverse(answer)
  const m = /^caesar:(-?\d+)$/.exec(scheme)
  if (m) return caesar(answer, Number(m[1]))
  throw new Error(`unknown cipher scheme "${scheme}"`)
}

/** Sorted letters of a string, ignoring everything but A–Z. */
export const letterBag = s => [...plain(s).replace(/ /g, '')].sort().join('')

/**
 * Find the anagram letters in a prompt: the longest run of single capital
 * letters separated by spaces (e.g. "N E U D E").
 */
export function anagramLetters(prompt) {
  const runs = prompt.match(/(?:\b[A-Z]\b[ ·]*){3,}/g) || []
  return runs.sort((a, b) => b.length - a.length)[0]?.replace(/[^A-Z]/g, '') ?? ''
}
