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
    position: 'absolute', inset: 0, background: 'rgba(0,0,0,.6)',
    display: 'flex', alignItems: 'flex-end', zIndex: 60,
    borderRadius: 14,
  },
  sheet: {
    background: '#161622', borderTop: '1px solid rgba(255,255,255,.08)',
    borderRadius: '14px 14px 0 0', width: '100%', padding: '22px 20px 32px',
  },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  h2: { fontSize: 17, fontWeight: 500, color: '#eeedf8' },
  closeBtn: {
    background: 'none', border: 'none', color: '#8b8aaa',
    fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: '0 2px',
  },
  sub: { fontSize: 13, color: '#8b8aaa', marginBottom: 18 },
  pkgs: { display: 'flex', gap: 10, marginBottom: 14 },
  pkg: {
    flex: 1, background: '#1c1c2a', border: '1px solid rgba(255,255,255,.08)',
    borderRadius: 10, padding: '14px 8px', cursor: 'pointer',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 2, position: 'relative', fontFamily: 'inherit',
    transition: 'border-color .15s',
  },
  pkgPop: { borderColor: 'rgba(108,99,245,.45)' },
  badge: {
    position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%)',
    background: '#6c63f5', color: '#fff', fontSize: 9, fontWeight: 700,
    padding: '2px 8px', borderRadius: 9, whiteSpace: 'nowrap',
  },
  badgeAmber: { background: '#BA7517' },
  num: { fontSize: 24, fontWeight: 600, color: '#eeedf8' },
  unit: { fontSize: 11, color: '#8b8aaa' },
  price: { fontSize: 13, fontWeight: 600, color: '#908af8', marginTop: 4 },
  note: { fontSize: 11, color: '#56556a', textAlign: 'center' as const },
}

export function CreditShop({ credits, onBuy, onClose }: Props) {
  return (
    <div style={s.backdrop} onClick={onClose}>
      <div style={s.sheet} onClick={(e) => e.stopPropagation()}>
        <div style={s.header}>
          <h2 style={s.h2}>Buy hint credits</h2>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>
        <p style={s.sub}>You have <strong style={{ color: '#eeedf8' }}>{credits}</strong> credits remaining</p>
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
