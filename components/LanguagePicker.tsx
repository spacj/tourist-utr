'use client'
import { Globe, ChevronDown } from 'lucide-react'
import { useI18n } from '@/hooks/useI18n'
import { LANGUAGES, type Lang } from '@/types'

/**
 * Compact language picker: a native <select> (keyboard, screen-reader and
 * mobile-picker friendly) dressed as a typewriter "EN ▾" chip. Scales to any
 * number of languages without overflowing the header.
 */
export function LanguagePicker({ className = '' }: { className?: string }) {
  const { lang, setLang, t } = useI18n()
  return (
    <label className={`lang-picker ${className}`}>
      <span className="sr-only">{t('selectLanguage')}</span>
      <Globe size={16} strokeWidth={2} aria-hidden />
      <span className="lang-picker-code" aria-hidden>{lang.toUpperCase()}</span>
      <ChevronDown size={14} strokeWidth={2} aria-hidden />
      <select value={lang} onChange={e => setLang(e.target.value as Lang)}>
        {LANGUAGES.map(l => (
          <option key={l.code} value={l.code} lang={l.code}>{l.label}</option>
        ))}
      </select>
    </label>
  )
}
