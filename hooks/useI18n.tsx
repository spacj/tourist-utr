'use client'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { Lang, t as translate } from '@/types'

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

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en')

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('lang') as Lang | null : null
    if (stored && ['en','nl','de','fr'].includes(stored)) {
      setLangState(stored)
      return
    }
    const browser = typeof navigator !== 'undefined' ? navigator.language.slice(0, 2) : 'en'
    if (['nl','de','fr'].includes(browser)) setLangState(browser as Lang)
  }, [])

  const setLang = (l: Lang) => {
    setLangState(l)
    if (typeof window !== 'undefined') localStorage.setItem('lang', l)
  }

  const value = useMemo<Ctx>(() => ({
    lang,
    setLang,
    t: (k: string) => translate(lang, k),
  }), [lang])

  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>
}

export const useI18n = () => useContext(I18nCtx)
