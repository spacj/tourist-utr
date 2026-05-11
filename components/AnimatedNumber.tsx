'use client'
import { useEffect, useRef, useState } from 'react'

interface Props {
  /** Target number to count up to. */
  value: number
  /** Decimal places to render (e.g. 1 for ratings like 4.9). Default 0. */
  decimals?: number
  /** Animation duration in ms. */
  durationMs?: number
}

/**
 * Counts a number up from 0 to `value` once it enters the viewport. Uses
 * IntersectionObserver to defer the animation until visible, then a single
 * requestAnimationFrame loop with an ease-out curve.
 */
export function AnimatedNumber({ value, decimals = 0, durationMs = 1100 }: Props) {
  const ref = useRef<HTMLSpanElement | null>(null)
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined' || typeof requestAnimationFrame === 'undefined') {
      setDisplay(value)
      return
    }
    let started = false
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && !started) {
          started = true
          io.unobserve(el)
          const start = performance.now()
          const step = (now: number) => {
            const t = Math.min(1, (now - start) / durationMs)
            // ease-out cubic
            const eased = 1 - Math.pow(1 - t, 3)
            setDisplay(value * eased)
            if (t < 1) requestAnimationFrame(step)
            else setDisplay(value)
          }
          requestAnimationFrame(step)
        }
      }
    }, { threshold: 0.4 })
    io.observe(el)
    return () => io.disconnect()
  }, [value, durationMs])

  const formatted = decimals > 0 ? display.toFixed(decimals) : Math.round(display).toString()
  return <span ref={ref}>{formatted}</span>
}