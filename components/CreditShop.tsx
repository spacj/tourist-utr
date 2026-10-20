'use client'
import { CREDIT_PACKAGES } from '@/types'
import { useI18n } from '@/hooks/useI18n'
import { fmt } from '@/lib/gameClient'
import { CheckoutSheet, type CheckoutOption } from './CheckoutSheet'

interface Props {
  credits: number
  /** Resolve true once the browser is redirecting to PayPal; false after showing an error. */
  onBuy: (packageId: string) => Promise<boolean>
  onClose: () => void
}

/** Hint-credit shop — CREDIT_PACKAGES mapped onto the shared CheckoutSheet (a Modal). */
export function CreditShop({ credits, onBuy, onClose }: Props) {
  const { t } = useI18n()
  const cheapestPerCredit = CREDIT_PACKAGES[0].priceCents / CREDIT_PACKAGES[0].credits
  const options: CheckoutOption[] = CREDIT_PACKAGES.map((pkg, i) => {
    const perCredit = (pkg.priceCents / pkg.credits / 100).toFixed(2)
    return {
      id: pkg.id,
      title: fmt(t('shopPackTitle'), { n: pkg.credits }),
      subtitle: i === 0 ? fmt(t('shopPerCredit'), { price: perCredit }) : fmt(t('shopPerCreditSave'), { price: perCredit }),
      priceCents: pkg.priceCents,
      comparePriceCents: i === 0 ? undefined : Math.round(cheapestPerCredit * pkg.credits),
      badge: pkg.id === 'medium' ? t('shopBadgePopular') : pkg.id === 'large' ? t('shopBadgeBest') : undefined,
      icon: '💎',
      accent: pkg.id === 'large' ? 'var(--primary)' : pkg.id === 'medium' ? 'var(--canal)' : undefined,
    }
  })

  return (
    <CheckoutSheet
      title={t('shopTitle')}
      subtitle={fmt(t(credits === 1 ? 'shopBalanceOne' : 'shopBalance'), { n: credits })}
      options={options}
      onConfirm={onBuy}
      onClose={onClose}
    />
  )
}
