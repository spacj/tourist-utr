/**
 * The TourHunts mark, inlined from public/icon.svg: an ink frame, a dotted
 * canal-green walking route and a brick-red X. Decorative by default; pass
 * `title` when the logo is the only content of a link or button.
 */
export function Logo({ size = 32, title, className }: { size?: number; title?: string; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      <rect width="512" height="512" rx="112" fill="#FFFDF8" />
      <rect x="40" y="40" width="432" height="432" rx="84" fill="none" stroke="#23201B" strokeWidth="26" />
      <path
        d="M128 372 C 150 300, 230 330, 236 262 S 300 176, 344 168"
        fill="none" stroke="#2E6A58" strokeWidth="26" strokeLinecap="round" strokeDasharray="2 42"
      />
      <circle cx="128" cy="372" r="26" fill="#2E6A58" />
      <path d="M332 112 L 408 188 M 408 112 L 332 188" stroke="#A33B2B" strokeWidth="34" strokeLinecap="round" />
    </svg>
  )
}

/** Logo + wordmark, used in mastheads and footers. */
export function Wordmark({ size = 30 }: { size?: number }) {
  return (
    <span className="wordmark">
      <Logo size={size} />
      <span className="wordmark-name">TourHunts</span>
    </span>
  )
}
