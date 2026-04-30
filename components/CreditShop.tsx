// components/CreditShop.tsx
'use client'
import { CREDIT_PACKAGES } from '@/types'

interface Props {
  credits: number
  onBuy: (packageId: string) => void
  onClose: () => void
}

const s: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'absolute', inset: 0, background: 'rgba(20,20,30,.45)',
    display: 'flex', alignItems: 'flex-end', zIndex: 60,
    borderRadius: 14,
  },
  sheet: {
    background: 'var(--surface)', borderTop: '1px solid var(--border)',
    borderRadius: '14px 14px 0 0', width: '100%', padding: '22px 20px 32px',
    boxShadow: '0 -10px 30px rgba(20,20,30,0.10)',
  },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  h2: { fontSize: 17, fontWeight: 500, color: 'var(--text)' },
  closeBtn: {
    background: 'none', border: 'none', color: 'var(--text-muted)',
    fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: '0 2px',
  },
  sub: { fontSize: 13, color: 'var(--text-muted)', marginBottom: 18 },
  pkgs: { display: 'flex', gap: 10, marginBottom: 14 },
  pkg: {
    flex: 1, background: 'var(--surface-2)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '14px 8px', cursor: 'pointer',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 2, position: 'relative', fontFamily: 'inherit',
    transition: 'border-color .15s',
  },
  pkgPop: { borderColor: 'rgba(255,106,19,.45)' },
  badge: {
    position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%)',
    background: 'var(--gold)', color: '#fff', fontSize: 9, fontWeight: 700,
    padding: '2px 8px', borderRadius: 9, whiteSpace: 'nowrap',
  },
  badgeAmber: { background: 'var(--primary)' },
  num: { fontSize: 24, fontWeight: 600, color: 'var(--text)' },
  unit: { fontSize: 11, color: 'var(--text-muted)' },
  price: { fontSize: 13, fontWeight: 600, color: 'var(--gold)', marginTop: 4 },
  note: { fontSize: 11, color: 'var(--text-dim)', textAlign: 'center' as const },
}

export function CreditShop({ credits, onBuy, onClose }: Props) {
  return (
    <div style={s.backdrop} onClick={onClose}>
      <div style={s.sheet} onClick={(e) => e.stopPropagation()}>
        <div style={s.header}>
          <h2 style={s.h2}>Buy hint credits</h2>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>
        <p style={s.sub}>You have <strong style={{ color: 'var(--text)' }}>{credits}</strong> credits remaining</p>
        <div style={s.pkgs}>
          {CREDIT_PACKAGES.map((pkg) => (
            <button
              key={pkg.id}
              style={{ ...s.pkg, ...(pkg.badge === 'Popular' ? s.pkgPop : {}) }}
              onClick={() => onBuy(pkg.id)}
            >
              {pkg.badge && (
                <span style={{ ...s.badge, ...(pkg.badge === 'Best value' ? s.badgeAmber : {}) }}>
                  {pkg.badge}
                </span>
              )}
              <span style={s.num}>{pkg.credits}</span>
              <span style={s.unit}>credits</span>
              <span style={s.price}>€{(pkg.priceCents / 100).toFixed(2)}</span>
            </button>
          ))}
        </div>
        <p style={s.note}>Credits never expire · Hint 1: 1 cr · Hint 2: 2 cr · Map pin: 3 cr</p>
      </div>
    </div>
  )
}
