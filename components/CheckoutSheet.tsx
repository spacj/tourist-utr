'use client'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { Check, Clock, Lock } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { useToast } from '@/components/Toast'
import { useI18n } from '@/hooks/useI18n'

/**
 * A purchase option the user can pick before being sent to PayPal.
 * For credits: id is the CreditPackage id. For cities: id is the cityId.
 */
export interface CheckoutOption {
  id: string
  /** Headline label, e.g. "Utrecht" or "15 hint credits". */
  title: string
  /** One-line value prop. */
  subtitle?: string
  /** Bullet list of what's included. */
  items?: string[]
  /** Price in cents. */
  priceCents: number
  /** "Most popular" / "Best value" badge. */
  badge?: string
  /** Strike-through price (for bundles that show savings). */
  comparePriceCents?: number
  /** Emoji (content) or icon element shown in a neutral badge next to the title. */
  icon?: ReactNode
  /** Visual accent color for the option. */
  accent?: string
  disabled?: boolean
  disabledReason?: string
}

interface Props {
  /** Headline at the top of the sheet, e.g. "Unlock Utrecht". */
  title: string
  subtitle?: string
  options: CheckoutOption[]
  /** Initial selection — defaults to the first non-disabled option. */
  defaultSelectedId?: string
  /**
   * Called when the user confirms. Resolve `true` once the browser is being
   * redirected to PayPal — the button then stays in its "Redirecting…" state
   * until the page unloads. Resolve false/undefined (after showing your own
   * error) or throw to re-enable the button.
   */
  onConfirm: (optionId: string) => Promise<boolean | void> | boolean | void
  onClose: () => void
}

const eur = (cents: number) => (cents / 100).toFixed(2)

/**
 * Confirmation sheet shown BEFORE redirecting to PayPal: what you're buying,
 * the options, trust signals and one explicit "Pay with PayPal" button.
 * Used by both the credit shop and the city unlock flow.
 */
export function CheckoutSheet({ title, subtitle, options, defaultSelectedId, onConfirm, onClose }: Props) {
  const { t } = useI18n()
  const toast = useToast()
  const firstAvailable = options.find(o => !o.disabled)?.id ?? options[0]?.id ?? ''
  const [selectedId, setSelectedId] = useState<string>(defaultSelectedId ?? firstAvailable)
  const [submitting, setSubmitting] = useState(false)

  // Coming back from PayPal via the browser's back button restores this page
  // from the bfcache with `submitting` still true — re-enable the button.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => { if (e.persisted) setSubmitting(false) }
    window.addEventListener('pageshow', onShow)
    return () => window.removeEventListener('pageshow', onShow)
  }, [])

  const selected = options.find(o => o.id === selectedId) ?? options[0]

  const handleConfirm = async () => {
    if (!selected || selected.disabled || submitting) return
    setSubmitting(true)
    try {
      const redirecting = await onConfirm(selected.id)
      if (redirecting !== true) setSubmitting(false)
    } catch {
      toast.error(t('checkoutFailed'))
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      variant="sheet"
      dismissible={!submitting}
      className="checkout-panel"
      title={title}
    >
      {subtitle && <p className="checkout-subtitle">{subtitle}</p>}

      <div className="checkout-options" role="radiogroup" aria-label={t('checkoutOptionsLabel')}>
        {options.map(opt => {
          const isSelected = selectedId === opt.id
          const style = opt.accent ? ({ '--accent': opt.accent } as CSSProperties) : undefined
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={`checkout-option ${isSelected ? 'is-selected' : ''} ${opt.disabled ? 'is-disabled' : ''}`}
              onClick={() => !opt.disabled && setSelectedId(opt.id)}
              disabled={opt.disabled || submitting}
              style={style}
            >
              {opt.badge && <span className="checkout-option-badge">{opt.badge}</span>}
              <span className="checkout-option-main">
                <span className="checkout-option-headline">
                  {opt.icon && <span className="checkout-option-icon" aria-hidden>{opt.icon}</span>}
                  <span className="checkout-option-title">{opt.title}</span>
                </span>
                {opt.subtitle && <span className="checkout-option-subtitle">{opt.subtitle}</span>}
                {opt.items && opt.items.length > 0 && (
                  <span className="checkout-option-items">
                    {opt.items.map((it, i) => <span key={i} className="checkout-option-item">{it}</span>)}
                  </span>
                )}
                {opt.disabled && opt.disabledReason && (
                  <span className="checkout-option-disabled-reason">{opt.disabledReason}</span>
                )}
              </span>
              <span className="checkout-option-price-block">
                {opt.comparePriceCents ? <span className="checkout-option-compare">€{eur(opt.comparePriceCents)}</span> : null}
                <span className="checkout-option-price">€{eur(opt.priceCents)}</span>
              </span>
              <span className={`checkout-option-radio ${isSelected ? 'is-checked' : ''}`} aria-hidden>
                {isSelected && <Check size={12} strokeWidth={3} />}
              </span>
            </button>
          )
        })}
      </div>

      <ul className="checkout-trust">
        <li>
          <Lock size={16} strokeWidth={1.75} aria-hidden />
          {t('checkoutSecure')}
        </li>
        <li>
          <Clock size={16} strokeWidth={1.75} aria-hidden />
          {t('checkoutNoSubscription')}
        </li>
        <li>
          <Check size={16} strokeWidth={1.75} aria-hidden />
          <a href="/terms" target="_blank" rel="noopener" className="checkout-trust-link">{t('checkoutRefundable')}</a>
        </li>
      </ul>

      <div className="checkout-cta-row">
        <div className="checkout-total">
          <span className="checkout-total-label">{t('checkoutTotal')}</span>
          <span className="checkout-total-value">€{eur(selected?.priceCents ?? 0)}</span>
        </div>
        <button
          type="button"
          className="checkout-cta"
          onClick={handleConfirm}
          disabled={submitting || !selected || selected.disabled}
          aria-busy={submitting}
        >
          {submitting ? (
            <span className="checkout-cta-loading">
              <span className="spinner-mini" aria-hidden /> {t('checkoutRedirecting')}
            </span>
          ) : (
            <>
              {t('checkoutPayWith')}{' '}
              <span className="checkout-cta-paypal">
                <span className="checkout-cta-paypal-p1">Pay</span>
                <span className="checkout-cta-paypal-p2">Pal</span>
              </span>
            </>
          )}
        </button>
      </div>
      <p className="checkout-footnote">{t('checkoutFootnote')}</p>
    </Modal>
  )
}
