'use client'
import { useI18n } from '@/hooks/useI18n'

export default function NotFound() {
  const { t } = useI18n()
  return (
    <main className="page-center">
      <div className="container flow-status-page">
        <div className="flow-status-icon" aria-hidden>🧭</div>
        <h1 className="flow-page-title">{t('notFoundTitle')}</h1>
        <p className="flow-page-sub">{t('notFoundBody')}</p>
        <div className="flow-actions-row">
          <a href="/" className="btn-primary flow-btn">{t('home')}</a>
          <a href="/#countries" className="btn-secondary flow-btn">{t('exploreCities')}</a>
        </div>
      </div>
    </main>
  )
}
