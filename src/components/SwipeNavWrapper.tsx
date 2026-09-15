'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  isSwipeNavPriorityEnabled,
  SWIPE_NAV_PRIORITY_EVENT,
} from './SwipeNavigationSetting'

interface Props {
  prevGroupId: string | null
  nextGroupId: string | null
  children: ReactNode
}

const SWIPE_THRESHOLD = 60   // px to commit navigation
const RESIST_FACTOR   = 0.15 // drag resistance when no neighbor in that direction
const DEFAULT_AXIS_THRESHOLD = 4
const PRIORITY_AXIS_THRESHOLD = 2

export default function SwipeNavWrapper({ prevGroupId, nextGroupId, children }: Props) {
  const router        = useRouter()
  const containerRef  = useRef<HTMLDivElement>(null)

  // Refs for touch tracking — avoid re-renders during gesture
  const startX    = useRef(0)
  const startY    = useRef(0)
  const isHoriz   = useRef<boolean | null>(null)
  const committed = useRef(false)

  const [offset,    setOffset]    = useState(0)
  const [isAnim,    setIsAnim]    = useState(false)
  const [direction, setDirection] = useState<'left' | 'right' | null>(null)
  const [preferSwipeNav, setPreferSwipeNav] = useState(false)

  useEffect(() => {
    const refresh = () => setPreferSwipeNav(isSwipeNavPriorityEnabled())
    refresh()
    window.addEventListener(SWIPE_NAV_PRIORITY_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(SWIPE_NAV_PRIORITY_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  // In default mode, vertical scrolling remains native. In priority mode,
  // horizontal swipes can prevent scroll once the gesture is classified.
  const onTouchStart = useCallback((e: TouchEvent) => {
    const t = e.touches[0]
    startX.current    = t.clientX
    startY.current    = t.clientY
    isHoriz.current   = null
    committed.current = false
    setIsAnim(false)
    setDirection(null)
  }, [])

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (committed.current) return
    const dx = e.touches[0].clientX - startX.current
    const dy = e.touches[0].clientY - startY.current
    const absX = Math.abs(dx)
    const absY = Math.abs(dy)

    // Decide axis once we have enough movement signal
    if (isHoriz.current === null) {
      const threshold = preferSwipeNav ? PRIORITY_AXIS_THRESHOLD : DEFAULT_AXIS_THRESHOLD
      if (absX < threshold && absY < threshold) return
      isHoriz.current = preferSwipeNav ? absX >= threshold : absX > absY
    }

    // Let vertical touches pass through in default mode.
    if (!isHoriz.current) return

    if (preferSwipeNav && e.cancelable) {
      e.preventDefault()
    }

    // Resist dragging when there's no neighbor in that direction
    // RTL: left swipe (dx < 0) = التالية (next), right swipe (dx > 0) = السابقة (prev)
    let x = dx
    if (dx < 0 && !nextGroupId) x = dx * RESIST_FACTOR
    if (dx > 0 && !prevGroupId) x = dx * RESIST_FACTOR

    setOffset(x)
    setDirection(dx < 0 ? 'left' : 'right')
  }, [nextGroupId, preferSwipeNav, prevGroupId])

  const onTouchEnd = useCallback((e: TouchEvent) => {
    if (committed.current) return
    if (!isHoriz.current) {
      setOffset(0)
      return
    }

    const dx = e.changedTouches[0].clientX - startX.current

    if (dx < -SWIPE_THRESHOLD && nextGroupId) {
      // Swipe left → التالية
      committed.current = true
      setIsAnim(true)
      setOffset(-window.innerWidth)
      setTimeout(() => router.push(`/groups/${nextGroupId}`), 220)
    } else if (dx > SWIPE_THRESHOLD && prevGroupId) {
      // Swipe right → السابقة
      committed.current = true
      setIsAnim(true)
      setOffset(window.innerWidth)
      setTimeout(() => router.push(`/groups/${prevGroupId}`), 220)
    } else {
      // Not far enough — spring back
      setIsAnim(true)
      setOffset(0)
      setDirection(null)
      setTimeout(() => setIsAnim(false), 300)
    }
  }, [nextGroupId, prevGroupId, router])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove',  onTouchMove,  { passive: !preferSwipeNav })
    el.addEventListener('touchend',   onTouchEnd,   { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove',  onTouchMove)
      el.removeEventListener('touchend',   onTouchEnd)
    }
  }, [onTouchStart, onTouchMove, onTouchEnd, preferSwipeNav])

  const progress = Math.min(Math.abs(offset) / SWIPE_THRESHOLD, 1)

  return (
    // Default mode keeps vertical scroll native. Priority mode favors
    // right/left group navigation for users who want swipes instead of scroll.
    <div
      ref={containerRef}
      className="relative overflow-hidden"
      style={{ touchAction: preferSwipeNav ? 'pan-x' : 'pan-y' }}
    >
      {/* Edge hint — السابقة (right edge in RTL) */}
      {prevGroupId && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 z-10 flex items-center pr-3"
          style={{ opacity: direction === 'right' ? progress * 0.85 : 0, transition: 'opacity 0.08s' }}
        >
          <span className="text-[32px] font-bold select-none text-[var(--color-primary)] drop-shadow">›</span>
        </div>
      )}

      {/* Edge hint — التالية (left edge in RTL) */}
      {nextGroupId && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-3"
          style={{ opacity: direction === 'left' ? progress * 0.85 : 0, transition: 'opacity 0.08s' }}
        >
          <span className="text-[32px] font-bold select-none text-[var(--color-primary)] drop-shadow">‹</span>
        </div>
      )}

      {/* The card — translates with the finger */}
      <div
        style={{
          transform:  `translateX(${offset}px)`,
          transition: isAnim ? 'transform 0.22s cubic-bezier(0.25,0.46,0.45,0.94)' : 'none',
          willChange: 'transform',
        }}
      >
        {children}
      </div>
    </div>
  )
}
