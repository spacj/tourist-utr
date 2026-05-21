'use client'
import { useIsAdmin } from '@/hooks/useIsAdmin'

/** Admin-only "Edit" link shown on a bench's public page. */
export function BenchEditButton({ benchId }: { benchId: string }) {
  const isAdmin = useIsAdmin()
  if (!isAdmin) return null
  return (
    <a href={`/benches/edit/${benchId}`} className="bench-edit-link">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
      Edit this bench
    </a>
  )
}
