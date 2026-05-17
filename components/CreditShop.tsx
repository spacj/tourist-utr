// components/CreditShop.tsx
'use client'
import { CREDIT_PACKAGES } from '@/types'
import { CheckoutSheet, CheckoutOption } from './CheckoutSheet'

interface Props {
  credits: number
  onBuy: (packageId: string) => Promise<void> | void
  onClose: () => void
}

/**
 * Hint-credit shop. Thin wrapper that maps CREDIT_PACKAGES into the
 * shared CheckoutSheet's option model — gives credits and city unlocks
 * the same purchase look-and-feel.
 */
export function CreditShop({ credits, onBuy, onClose }: Props) {
  const options: CheckoutOption[] = CREDIT_PACKAGES.map((pkg, i) => {
    // 5cr / 15cr / 40cr — compute the per-credit value to surface savings
    // on the bigger packs, which is the actual reason a user upgrades.
    const cents = pkg.priceCents
    const perCredit = cents / pkg.credits
    const subtitle = i === 0
      ? `€${(perCredit / 100).toFixed(2)} per credit`
      : `€${(perCredit / 100).toFixed(2)} per credit — save vs. the smallest pack`
    // Synthetic "compare price" for the larger packs = what 5cr × N would
    // cost at the cheapest tier, to display the savings.
    const cheapestPerCredit = CREDIT_PACKAGES[0].priceCents / CREDIT_PACKAGES[0].credits
    const comparePriceCents = i === 0 ? undefined : Math.round(cheapestPerCredit * pkg.credits)
    return {
      id: pkg.id,
      title: `${pkg.credits} hint credits`,
      subtitle,
      priceCents: pkg.priceCents,
      comparePriceCents,
      badge: pkg.badge,
      icon: '💎',
      accent: pkg.badge === 'Best value' ? 'var(--primary)' : pkg.badge === 'Popular' ? '#6366f1' : undefined,
    }
  })

  return (
    <CheckoutSheet
      title="Buy hint credits"
      subtitle={`You have ${credits} credit${credits === 1 ? '' : 's'} remaining. Credits never expire.`}
      options={options}
      onConfirm={onBuy}
      onClose={onClose}
    />
  )
}
