import type { Dict, Lang } from './types'
import { core } from './core'
import { legal } from './legal'
import { game } from './game'
import { flows } from './flows'

/**
 * UI strings, one file per area so features can add keys independently.
 * To add an area: create `./<area>.ts` exporting a Dict and list it here.
 * Later areas override earlier ones on key collisions.
 */
export const T: Dict = Object.assign({}, core, legal, flows, game)

export function t(lang: Lang, key: string): string {
  const entry = T[key]
  if (!entry) {
    if (process.env.NODE_ENV !== 'production') console.warn(`[i18n] missing key: ${key}`)
    return key
  }
  return entry[lang] ?? entry.en ?? key
}

export type { Dict, Lang }
