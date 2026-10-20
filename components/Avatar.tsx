/**
 * User avatar (Google profile photo). Plain <img> on purpose: these are tiny,
 * already-sized third-party images, so the Next image optimiser would only
 * add a round-trip. no-referrer is required for googleusercontent URLs.
 */
export function Avatar({ src, className, size = 40 }: { src: string; className?: string; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={className} width={size} height={size} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
  )
}
