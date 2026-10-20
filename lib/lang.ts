import type { Lang } from '@/lib/i18n/types'

/** Shared by the server layout and the client I18nProvider (no 'use client'). */
export const SUPPORTED_LANGS: Lang[] = ['en', 'nl', 'de', 'fr', 'it', 'es']
export const LANG_COOKIE = 'lang'

export function isLang(v: unknown): v is Lang {
  return typeof v === 'string' && (SUPPORTED_LANGS as string[]).includes(v)
}

/** Best match for an Accept-Language header or a navigator.languages list. */
export function matchLang(prefs: readonly string[] | string | null | undefined): Lang | null {
  const list = typeof prefs === 'string'
    ? prefs.split(',').map(p => p.split(';')[0].trim())
    : (prefs ?? [])
  for (const p of list) {
    const code = p.slice(0, 2).toLowerCase()
    if (isLang(code)) return code
  }
  return null
}

/**
 * Inline <head> script, runs before first paint and before React: sets
 * <html lang> using the same order as the client provider (cookie →
 * localStorage → browser languages → en). Keep in sync with
 * detectClientLang() in hooks/useI18n.tsx.
 */
export const LANG_BOOT_SCRIPT = `(function(){try{var s=${JSON.stringify(SUPPORTED_LANGS)},l=null,m=document.cookie.match(/(?:^|;\\s*)lang=([a-z]{2})/);if(m&&s.indexOf(m[1])>=0)l=m[1];if(!l){try{var v=localStorage.getItem('lang');if(s.indexOf(v)>=0)l=v}catch(e){}}if(!l){var n=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language||'en'];for(var i=0;i<n.length&&!l;i++){var c=String(n[i]).slice(0,2).toLowerCase();if(s.indexOf(c)>=0)l=c}}document.documentElement.lang=l||'en'}catch(e){}})();`
