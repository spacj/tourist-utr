import { describe, it, expect } from 'vitest'
import { readdirSync } from 'node:fs'
import path from 'node:path'
import { T } from '@/lib/i18n'
import type { Dict, Lang } from '@/lib/i18n/types'
import { core } from '@/lib/i18n/core'

const LANGS: Lang[] = ['en', 'nl', 'de', 'fr', 'it', 'es']

/** Area files that must be fully translated. core.ts (legacy) is a soft check. */
const STRICT_AREAS = ['legal', 'flows', 'game', 'seo']
const I18N_DIR = path.resolve(__dirname, '../lib/i18n')
const present = new Set(readdirSync(I18N_DIR).map(f => f.replace(/\.ts$/, '')))

function missing(dict: Dict): string[] {
  const out: string[] = []
  for (const [key, entry] of Object.entries(dict)) {
    for (const l of LANGS) {
      const v = entry[l]
      if (typeof v !== 'string' || !v.trim()) out.push(`${key}.${l}`)
    }
  }
  return out
}

function placeholders(s: string): string[] {
  return Array.from(s.matchAll(/\{(\w+)\}/g), m => m[1]).sort()
}

describe('i18n dictionary', () => {
  it('every key in T has a non-empty en value', () => {
    const bad = Object.entries(T).filter(([, e]) => typeof e.en !== 'string' || !e.en.trim()).map(([k]) => k)
    expect(bad).toEqual([])
  })

  for (const area of STRICT_AREAS) {
    it.skipIf(!present.has(area))(`${area}.ts: every key has all 6 languages`, async () => {
      const mod = await import(`../lib/i18n/${area}.ts`)
      const dict = (mod[area] ?? Object.values(mod).find(v => v && typeof v === 'object')) as Dict
      expect(dict, `lib/i18n/${area}.ts should export a Dict named "${area}"`).toBeTruthy()
      expect(missing(dict)).toEqual([])
    })
  }

  it('translations keep the same {placeholders} as English', () => {
    const bad: string[] = []
    for (const [key, entry] of Object.entries(T)) {
      const want = placeholders(entry.en).join(',')
      for (const l of LANGS) {
        const v = entry[l]
        if (typeof v === 'string' && placeholders(v).join(',') !== want) bad.push(`${key}.${l}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('core.ts missing translations (soft warning only)', () => {
    const m = missing(core)
    if (m.length) console.warn(`[i18n] core.ts is missing ${m.length} translation(s):\n  ${m.join('\n  ')}`)
    expect(Array.isArray(m)).toBe(true)
  })
})
