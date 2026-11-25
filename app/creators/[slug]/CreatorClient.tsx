'use client'
import { useI18n } from '@/hooks/useI18n'
import { fmt } from '@/lib/i18n/fmt'
import { huntPriceEuros, localizeHunt, type Hunt } from '@/types'
import type { PublicCreator } from '@/lib/catalog'

/** Public creator profile: bio plus their listed hunts, in the visitor's language. */
export function CreatorClient({ creator, hunts, cityNames }: {
  creator: PublicCreator
  hunts: Hunt[]
  cityNames: Record<string, string>
}) {
  const { t, lang } = useI18n()
  return (
    <main className="page-center">
      <div className="container creator-page">
        <h1 className="bench-add-title">{fmt(t('creatorPageHunts'), { name: creator.displayName })}</h1>
        {creator.bio && <p className="bench-add-sub admin-pre">{creator.bio}</p>}
        {hunts.length === 0 ? <p className="studio-empty">{t('creatorPageEmpty')}</p> : (
          <ul className="studio-list">
            {hunts.map(raw => {
              const h = localizeHunt(raw, lang)
              return (
                <li key={h.id} className="studio-item">
                  <div className="studio-item-main">
                    <a className="studio-item-title" href={`/city/${h.cityId}/${h.id}`}>{h.title}</a>
                    <span className="studio-item-meta">{cityNames[h.cityId] ?? h.city} · {h.clueCount} stops · €{huntPriceEuros(h).toFixed(2)}</span>
                    <span className="studio-item-meta">{h.description}</span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </main>
  )
}
