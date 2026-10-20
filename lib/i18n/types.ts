export type Lang = 'en' | 'nl' | 'de' | 'fr' | 'it' | 'es'

/** key → translation per language. `en` is the fallback. */
export type Dict = Record<string, Partial<Record<Lang, string>> & { en: string }>
