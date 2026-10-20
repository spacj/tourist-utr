'use client'
import { Puzzle } from 'lucide-react'
import { useEffect } from 'react'
import { useI18n } from '@/hooks/useI18n'

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n()
  useEffect(() => { console.error(error) }, [error])
  return (
    <main className="page-center">
      <div className="container flow-status-page" role="alert">
        <div className="flow-status-icon" aria-hidden><Puzzle size={44} strokeWidth={1.5} /></div>
        <h1 className="flow-page-title">{t('errorPageTitle')}</h1>
        <p className="flow-page-sub">{t('errorPageBody')}</p>
        <div className="flow-actions-row">
          <button type="button" className="btn-primary" onClick={reset}>{t('retry')}</button>
          <a href="/" className="btn-secondary flow-btn">{t('home')}</a>
        </div>
      </div>
    </main>
  )
}
