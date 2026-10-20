'use client'
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { Lang, t as translate } from '@/types'
import { LANG_COOKIE, isLang, matchLang } from '@/lib/lang'

/**
 * Language handling — why it works this way:
 *
 * The root layout stays STATIC (blog, legal, landing pages are prerendered /
 * ISR). Reading `cookies()` or `Accept-Language` there would force every
 * route into dynamic rendering, so SSR always renders English.
 *
 * To keep returning visitors from seeing English for long:
 *  1. `setLang` persists the choice in a `lang` cookie (1 year, SameSite=Lax)
 *     as well as localStorage.
 *  2. A tiny inline script in <head> (LANG_BOOT_SCRIPT, rendered by the
 *     layout) reads that cookie before first paint and sets <html lang>, so
 *     screen readers / translators / hyphenation see the right language.
 *  3. The provider resolves the language in a layout effect: it runs right
 *     after hydration, before the hydrated tree is painted, and re-renders
 *     synchronously. (Reading the cookie in the useState initializer would
 *     render different text than the server HTML and trigger a hydration
 *     mismatch, which React "fixes" by throwing away the SSR tree.)
 *
 * A dynamic route that can afford it may pass `initialLang` from the cookie.
 */

const ONE_YEAR_S = 60 * 60 * 24 * 365

function readCookieLang(): Lang | null {
  if (typeof document === 'undefined') return null
  const m = document.cookie.match(/(?:^|;\s*)lang=([a-z]{2})/)
  return m && isLang(m[1]) ? m[1] : null
}

function writeCookieLang(l: Lang) {
  if (typeof document === 'undefined') return
  const secure = location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${LANG_COOKIE}=${l}; Max-Age=${ONE_YEAR_S}; Path=/; SameSite=Lax${secure}`
}

function readStoredLang(): Lang | null {
  try {
    const v = localStorage.getItem('lang')
    return isLang(v) ? v : null
  } catch { return null }
}

/** Client-side resolution order: cookie → localStorage → browser languages → en. */
export function detectClientLang(): Lang {
  return readCookieLang()
    ?? readStoredLang()
    ?? matchLang(typeof navigator !== 'undefined' ? (navigator.languages?.length ? navigator.languages : [navigator.language]) : null)
    ?? 'en'
}

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

type Ctx = {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string) => string
}

const I18nCtx = createContext<Ctx>({
  lang: 'en',
  setLang: () => {},
  t: (k) => k,
})

export function I18nProvider({ children, initialLang = 'en' }: { children: React.ReactNode; initialLang?: Lang }) {
  const [lang, setLangState] = useState<Lang>(initialLang)

  useIsoLayoutEffect(() => {
    const detected = detectClientLang()
    if (detected !== lang) setLangState(detected)
    // Migrate visitors who only have the older localStorage setting.
    if (!readCookieLang() && readStoredLang()) writeCookieLang(detected)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (document.documentElement.lang !== lang) document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((l: Lang) => {
    if (!isLang(l)) return
    setLangState(l)
    try { localStorage.setItem('lang', l) } catch {}
    writeCookieLang(l)
  }, [])

  const value = useMemo<Ctx>(() => ({
    lang,
    setLang,
    t: (k: string) => translate(lang, k),
  }), [lang, setLang])

  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>
}

export const useI18n = () => useContext(I18nCtx)
