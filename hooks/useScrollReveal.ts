'use client'
import { useEffect, useRef } from 'react'

/**
 * Adds a CSS class to the element (default: 'is-visible') the first time it
 * enters the viewport. Pair with a base `.reveal` class that defines the
 * hidden + visible states. Stops observing after the first reveal so it's
 * cheap. Respects prefers-reduced-motion via the CSS rule on .reveal.
 *
 *   const ref = useScrollReveal<HTMLElement>()
 *   <section ref={ref} className="reveal"> ... </section>
 */
export function useScrollReveal<T extends HTMLElement = HTMLElement>(
  options: { threshold?: number; rootMargin?: string; revealClass?: string } = {}
) {
  const ref = useRef<T | null>(null)
  const { threshold = 0.12, rootMargin = '0px 0px -8% 0px', revealClass = 'is-visible' } = options

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      // Fallback: instantly show
      el.classList.add(revealClass)
      return
    }
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          el.classList.add(revealClass)
          io.unobserve(el)
        }
      }
    }, { threshold, rootMargin })
    io.observe(el)
    return () => io.disconnect()
  }, [threshold, rootMargin, revealClass])

  return ref
}