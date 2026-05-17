'use client'
import { useEffect, useState } from 'react'

/**
 * A purchase option the user can pick before being sent to PayPal.
 * For credits: id is the CreditPackage id. For cities: id is the cityId.
 * The optional `bundleIds` carries every cityId included in a country pass.
 */
export interface CheckoutOption {
  id: string
  /** Headline label, e.g. "Utrecht" or "15 hint credits". */
  title: string
  /** One-line value prop. */
  subtitle?: string
  /** Per-item items list (rendered as bullets) — best for bundles. */
  items?: string[]
  /** Price in cents. */
  priceCents: number
  /** "Most popular" / "Best value" badge. */
  badge?: string
  /** Strike-through price (for bundles that show savings). */
  comparePriceCents?: number
  /** Emoji or icon to show next to the title. */
  icon?: string
  /** Visual accent color for the option. */
  accent?: string
  /** Optional CTA override (e.g. for a "Coming soon" placeholder). */
  disabled?: boolean
  disabledReason?: string
}

interface Props {
  /** Headline at the top of the sheet, e.g. "Unlock Utrecht" or "Buy hint credits". */
  title: string
  /** One-line subtitle below the title. */
  subtitle?: string
  /** Options the user can choose between. */
  options: CheckoutOption[]
  /** Initial selection — defaults to the first non-disabled option. */
  defaultSelectedId?: string
  /** Called when the user confirms — pass the chosen option id back. */
  onConfirm: (optionId: string) => Promise<void> | void
  onClose: () => void
}

/**
 * Confirmation sheet shown BEFORE redirecting to PayPal. The user gets:
 *  - A clear summary of what they're buying (title + subtitle)
 *  - The available bundle options as a card stack, comparable at a glance
 *  - Trust signals (Secure / PayPal / No subscription / Refundable)
 *  - One obvious "Pay with PayPal" CTA — the redirect only fires after they
 *    explicitly tap it.
 *
 * Used by both the credit shop and the city unlock flow.
 */
export function CheckoutSheet({
  title, subtitle, options, defaultSelectedId, onConfirm, onClose,
}: Props) {
  const firstAvailable = options.find(o => !o.disabled)?.id ?? options[0]?.id ?? ''
  const [selectedId, setSelectedId] = useState<string>(defaultSelectedId ?? firstAvailable)
  const [submitting, setSubmitting] = useState(false)

  // Escape-key dismiss for desktop
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const selected = options.find(o => o.id === selectedId) ?? options[0]
  const totalEur = (selected?.priceCents ?? 0) / 100

  const handleConfirm = async () => {
    if (!selected || selected.disabled || submitting) return
    setSubmitting(true)
    try {
      await onConfirm(selected.id)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="checkout-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="checkout-title">
      <div className="checkout-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="checkout-handle" aria-hidden />
        <button type="button" className="checkout-close" onClick={onClose} aria-label="Close">✕</button>

        <header className="checkout-head">
          <h2 id="checkout-title" className="checkout-title">{title}</h2>
          {subtitle && <p className="checkout-subtitle">{subtitle}</p>}
        </header>

        <ul className="checkout-options" role="radiogroup" aria-label="Purchase options">
          {options.map(opt => {
            const isSelected = selectedId === opt.id
            const eur = (opt.priceCents / 100).toFixed(2)
            const compareEur = opt.comparePriceCents ? (opt.comparePriceCents / 100).toFixed(2) : null
            const accent = opt.accent ?? 'var(--primary)'
            return (
              <li key={opt.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  className={`checkout-option ${isSelected ? 'is-selected' : ''} ${opt.disabled ? 'is-disabled' : ''}`}
                  onClick={() => !opt.disabled && setSelectedId(opt.id)}
                  disabled={opt.disabled}
                  style={isSelected ? { borderColor: accent, background: `${accent}10` } : undefined}
                >
                  {opt.badge && (
                    <span className="checkout-option-badge" style={{ background: accent }}>{opt.badge}</span>
                  )}
                  <div className="checkout-option-main">
                    <div className="checkout-option-headline">
                      {opt.icon && <span className="checkout-option-icon" aria-hidden>{opt.icon}</span>}
                      <span className="checkout-option-title">{opt.title}</span>
                    </div>
                    {opt.subtitle && <div className="checkout-option-subtitle">{opt.subtitle}</div>}
                    {opt.items && opt.items.length > 0 && (
                      <ul className="checkout-option-items">
                        {opt.items.map((it, i) => (
                          <li key={i}>{it}</li>
                        ))}
                      </ul>
                    )}
                    {opt.disabled && opt.disabledReason && (
                      <div className="checkout-option-disabled-reason">{opt.disabledReason}</div>
                    )}
                  </div>
                  <div className="checkout-option-price-block">
                    {compareEur && <div className="checkout-option-compare">€{compareEur}</div>}
                    <div className="checkout-option-price" style={{ color: isSelected ? accent : undefined }}>€{eur}</div>
                  </div>
                  <span className={`checkout-option-radio ${isSelected ? 'is-checked' : ''}`} aria-hidden style={isSelected ? { borderColor: accent, background: accent } : undefined}>
                    {isSelected && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        <ul className="checkout-trust" aria-label="Trust signals">
          <li>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Secure payment
          </li>
          <li>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/><polyline points="12 7 12 12 15 14"/></svg>
            No subscription
          </li>
          <li>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            Refundable 14 days
          </li>
        </ul>

        <div className="checkout-cta-row">
          <div className="checkout-total">
            <span className="checkout-total-label">Total</span>
            <span className="checkout-total-value">€{totalEur.toFixed(2)}</span>
          </div>
          <button
            type="button"
            className="checkout-cta"
            onClick={handleConfirm}
            disabled={submitting || !selected || selected.disabled}
          >
            {submitting ? (
              <span className="checkout-cta-loading">
                <span className="spinner-mini" aria-hidden /> Redirecting…
              </span>
            ) : (
              <>
                Pay with{' '}
                <span className="checkout-cta-paypal">
                  <span className="checkout-cta-paypal-p1">Pay</span>
                  <span className="checkout-cta-paypal-p2">Pal</span>
                </span>
              </>
            )}
          </button>
        </div>
        <p className="checkout-footnote">
          You'll be redirected to PayPal to complete payment. We never see your card details.
        </p>
      </div>
    </div>
  )
}
