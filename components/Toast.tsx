'use client'
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useI18n } from '@/hooks/useI18n'

/**
 * Lightweight toasts announced to screen readers (aria-live).
 * `toast.error(msg)` / `toast.success(msg)` / `toast.info(msg)`.
 * Errors stay 6s, others 3.5s; every toast can be dismissed.
 */
type Kind = 'success' | 'error' | 'info'
interface Item { id: number; kind: Kind; text: string }
interface ToastApi {
  success: (text: string) => void
  error: (text: string) => void
  info: (text: string) => void
}

const Ctx = createContext<ToastApi>({ success: () => {}, error: () => {}, info: () => {} })
export const useToast = () => useContext(Ctx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const [items, setItems] = useState<Item[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setItems(list => list.filter(i => i.id !== id)), [])

  const push = useCallback((kind: Kind, text: string) => {
    if (!text) return
    const id = nextId.current++
    setItems(list => [...list.filter(i => i.text !== text), { id, kind, text }].slice(-3))
    setTimeout(() => dismiss(id), kind === 'error' ? 6000 : 3500)
  }, [dismiss])

  const api = useRef<ToastApi>({
    success: (t) => push('success', t),
    error: (t) => push('error', t),
    info: (t) => push('info', t),
  })
  api.current.success = (t) => push('success', t)
  api.current.error = (t) => push('error', t)
  api.current.info = (t) => push('info', t)

  return (
    <Ctx.Provider value={api.current}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {items.map(i => (
          <div key={i.id} className={`toast toast-${i.kind}`} role={i.kind === 'error' ? 'alert' : 'status'}>
            <span className="toast-text">{i.text}</span>
            <button type="button" className="toast-close" onClick={() => dismiss(i.id)} aria-label={t('dismiss')}><X size={18} strokeWidth={2} aria-hidden /></button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
