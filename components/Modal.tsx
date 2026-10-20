'use client'
import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useI18n } from '@/hooks/useI18n'

/**
 * Accessible dialog: role="dialog" + aria-modal, focus moves in on open,
 * Tab is trapped inside, Escape closes, focus returns to the opener.
 * `variant="sheet"` docks it to the bottom on phones.
 */
export function Modal({
  open, onClose, title, children, variant = 'center', dismissible = true, className = '', labelledBy,
}: {
  open: boolean
  onClose: () => void
  /** Visible heading; also the accessible name. Omit only if `labelledBy` is given. */
  title?: ReactNode
  children: ReactNode
  variant?: 'center' | 'sheet'
  /** When false, Escape/backdrop don't close (e.g. while a payment redirects). */
  dismissible?: boolean
  className?: string
  labelledBy?: string
}) {
  const { t } = useI18n()
  const panelRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<Element | null>(null)
  // Callers usually pass an inline onClose; keep it in a ref so a re-render
  // doesn't re-run the focus effect (which would yank focus back to the start).
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const titleId = useRef(`modal-${Math.random().toString(36).slice(2, 9)}`).current

  useEffect(() => {
    if (!open) return
    openerRef.current = document.activeElement
    const panel = panelRef.current
    const focusables = () =>
      Array.from(panel?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      ) ?? []).filter(el => el.offsetParent !== null || el === document.activeElement)
    // Focus the first field/button, else the panel itself.
    const first = focusables().find(el => el.matches('input, textarea, select')) ?? focusables()[0]
    ;(first ?? panel)?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) { e.stopPropagation(); onCloseRef.current(); return }
      if (e.key !== 'Tab') return
      const els = focusables()
      if (!els.length) { e.preventDefault(); return }
      const firstEl = els[0], lastEl = els[els.length - 1]
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus() }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus() }
    }
    document.addEventListener('keydown', onKey, true)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = prevOverflow
      ;(openerRef.current as HTMLElement | null)?.focus?.()
    }
  }, [open, dismissible])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className={`modal-backdrop modal-${variant}`}
      onMouseDown={(e) => { if (dismissible && e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy ?? (title ? titleId : undefined)}
        tabIndex={-1}
        className={`modal-panel ${className}`}
      >
        {title && <h2 id={titleId} className="modal-title">{title}</h2>}
        {dismissible && (
          <button type="button" className="modal-close" onClick={onClose} aria-label={t('close')}>
            <X size={20} strokeWidth={2} aria-hidden />
          </button>
        )}
        {children}
      </div>
    </div>,
    document.body,
  )
}

/** Promise-free confirm dialog to replace window.confirm(). */
export function ConfirmDialog({
  open, title, body, confirmLabel, cancelLabel, danger = false, onConfirm, onCancel,
}: {
  open: boolean
  title: ReactNode
  body?: ReactNode
  confirmLabel: string
  cancelLabel: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title} className="confirm-dialog">
      {body && <div className="confirm-body">{body}</div>}
      <div className="confirm-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>{cancelLabel}</button>
        <button type="button" className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </Modal>
  )
}
