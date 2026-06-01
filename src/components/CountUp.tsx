'use client'

import { useEffect, useState } from 'react'

interface Props { to: number; duration?: number; className?: string }

// Animated count-up from 0 → target. Respects prefers-reduced-motion.
export default function CountUp({ to, duration = 900, className }: Props) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) { setValue(to); return }

    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      // ease-out exponential
      const eased = 1 - Math.pow(2, -10 * t)
      setValue(Math.round(to * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [to, duration])

  return <span className={className}>{value.toLocaleString('ar-EG')}</span>
}
