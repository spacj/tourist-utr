/**
 * Decorative hand-drawn city map behind the home hero: canals, a few streets,
 * a numbered dotted walking route and the red X. Purely visual (aria-hidden).
 */
export function HeroMap() {
  return (
    <svg className="nb-hero-map" viewBox="0 0 1200 640" preserveAspectRatio="xMaxYMid slice" aria-hidden focusable="false">
      <defs>
        <pattern id="nb-grid" width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M32 0H0V32" fill="none" stroke="#2E6A58" strokeOpacity="0.07" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="1200" height="640" fill="url(#nb-grid)" />

      {/* canals (concentric arcs, like a Dutch grachtengordel) */}
      <g fill="none" stroke="#2E6A58" strokeOpacity="0.16" strokeLinecap="round">
        <path d="M-40 520 C 220 380, 420 600, 700 470 S 1080 300, 1260 380" strokeWidth="22" />
        <path d="M-40 560 C 240 430, 440 650, 720 520 S 1100 350, 1260 430" strokeWidth="3" />
        <path d="M640 -40 C 600 120, 760 220, 720 360 S 820 560, 780 700" strokeWidth="16" />
      </g>
      {/* streets */}
      <g fill="none" stroke="#23201B" strokeOpacity="0.08" strokeWidth="2">
        <path d="M80 80 L 520 260 L 980 120" />
        <path d="M200 640 L 360 300 L 300 40" />
        <path d="M900 640 L 860 380 L 1180 260" />
        <path d="M0 300 L 1200 210" />
      </g>

      {/* the route — kept to the right half (behind the sample card) so it
          never crosses the headline or copy; hidden on phones via CSS */}
      <g className="nb-hero-route">
        <path
          d="M700 600 C 760 540, 820 520, 880 470 S 960 360, 1040 330 S 1120 230, 1150 170"
          fill="none" stroke="#2E6A58" strokeOpacity="0.45" strokeWidth="4"
          strokeLinecap="round" strokeDasharray="1 16"
        />
        <g fontFamily="var(--font-mono), monospace" fontSize="15" fontWeight="700" textAnchor="middle">
          {[[700, 600, 1], [880, 470, 2], [1040, 330, 3]].map(([x, y, n]) => (
            <g key={n}>
              <circle cx={x} cy={y} r="15" fill="#FFFDF8" stroke="#23201B" strokeOpacity="0.45" strokeWidth="2" />
              <text x={x} y={y + 5} fill="#23201B" fillOpacity="0.6">{n}</text>
            </g>
          ))}
        </g>
        <path d="M1130 120 L 1170 160 M 1170 120 L 1130 160" stroke="#A33B2B" strokeOpacity="0.65" strokeWidth="8" strokeLinecap="round" />
      </g>
    </svg>
  )
}
