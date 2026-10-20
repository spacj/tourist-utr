'use client'
import { useI18n } from '@/hooks/useI18n'

export default function HuntLoading() {
  const { t } = useI18n()
  return (
    <main className="page-center" aria-busy="true">
      <div className="container">
        <span className="flow-sr-only" role="status">{t('loadingHunt')}</span>
        <span className="skel skel-line is-short" />
        <span className="skel skel-hero" />
        <span className="skel skel-line" />
        <span className="skel skel-line" />
        <span className="skel skel-line is-short" />
      </div>
    </main>
  )
}
