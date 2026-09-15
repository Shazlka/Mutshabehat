'use client'

import { useEffect, useRef, useState, type MouseEvent, type TouchEvent } from 'react'
import GroupRow, { type GroupRowData } from './GroupRow'
import GroupRowTitlesOnly, { type GroupRowTitleData } from './GroupRowTitlesOnly'
import {
  isSwipeNavPriorityEnabled,
  SWIPE_NAV_PRIORITY_EVENT,
} from './SwipeNavigationSetting'

type Props =
  | {
      mode: 'full'
      groups: GroupRowData[]
      startIndex: number
    }
  | {
      mode: 'titles-only'
      groups: GroupRowTitleData[]
      startIndex: number
    }

const SWIPE_THRESHOLD = 56
const RESIST_FACTOR = 0.18

export default function MainGroupSwipePager(props: Props) {
  const [enabled, setEnabled] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [offset, setOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const startX = useRef(0)
  const startY = useRef(0)
  const isHoriz = useRef<boolean | null>(null)
  const swallowedClick = useRef(false)

  useEffect(() => {
    const refresh = () => setEnabled(isSwipeNavPriorityEnabled())
    refresh()
    window.addEventListener(SWIPE_NAV_PRIORITY_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(SWIPE_NAV_PRIORITY_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  useEffect(() => {
    setActiveIndex(0)
    setOffset(0)
  }, [props.groups])

  const hasPrevious = activeIndex > 0
  const hasNext = activeIndex < props.groups.length - 1

  const verticalList = (
    <div className="divide-y divide-[var(--color-border-soft)] mt-2">
      {props.mode === 'full'
        ? props.groups.map((group, i) => (
            <GroupRow key={group.id} group={group} index={props.startIndex + i} />
          ))
        : props.groups.map((group, i) => (
            <GroupRowTitlesOnly key={group.id} group={group} index={props.startIndex + i} />
          ))}
    </div>
  )

  function onTouchStart(e: TouchEvent<HTMLDivElement>) {
    if (!enabled) return
    const touch = e.touches[0]
    startX.current = touch.clientX
    startY.current = touch.clientY
    isHoriz.current = null
    swallowedClick.current = false
    setIsDragging(true)
    setIsAnimating(false)
  }

  function onTouchMove(e: TouchEvent<HTMLDivElement>) {
    if (!enabled || !isDragging) return

    const dx = e.touches[0].clientX - startX.current
    const dy = e.touches[0].clientY - startY.current
    const absX = Math.abs(dx)
    const absY = Math.abs(dy)

    if (isHoriz.current === null) {
      if (absX < 3 && absY < 3) return
      isHoriz.current = absX >= 3
    }

    if (!isHoriz.current) return
    if (e.cancelable) e.preventDefault()

    let x = dx
    if (dx < 0 && !hasNext) x = dx * RESIST_FACTOR
    if (dx > 0 && !hasPrevious) x = dx * RESIST_FACTOR

    if (Math.abs(x) > 8) swallowedClick.current = true
    setOffset(x)
  }

  function onTouchEnd(e: TouchEvent<HTMLDivElement>) {
    if (!enabled || !isDragging) return

    setIsDragging(false)
    const dx = e.changedTouches[0].clientX - startX.current
    setIsAnimating(true)

    if (dx < -SWIPE_THRESHOLD && hasNext) {
      setActiveIndex((value) => value + 1)
    } else if (dx > SWIPE_THRESHOLD && hasPrevious) {
      setActiveIndex((value) => value - 1)
    }

    setOffset(0)
    window.setTimeout(() => setIsAnimating(false), 220)
  }

  function onClickCapture(e: MouseEvent<HTMLDivElement>) {
    if (!swallowedClick.current) return
    e.preventDefault()
    e.stopPropagation()
    swallowedClick.current = false
  }

  function goTo(index: number) {
    const next = Math.max(0, Math.min(props.groups.length - 1, index))
    if (next === activeIndex) return
    swallowedClick.current = false
    setIsAnimating(true)
    setActiveIndex(next)
    setOffset(0)
    window.setTimeout(() => setIsAnimating(false), 220)
  }

  if (!enabled) return verticalList

  const current = props.groups[activeIndex]

  return (
    <>
      <section className="mt-2 md:hidden" aria-label="استعراض المجموعات بالسحب">
        <div className="mb-3 flex items-center justify-between gap-3 text-[11px] text-[var(--color-ink-muted)]">
          <span className="font-mono tabular-nums" dir="ltr">
            {activeIndex + 1} / {props.groups.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => goTo(activeIndex - 1)}
              disabled={!hasPrevious}
              className="touch-target-sm rounded-full border border-[var(--color-border)] text-[18px] font-bold text-[var(--color-primary)] disabled:opacity-30 tap-shrink"
              aria-label="المجموعة السابقة">
              ›
            </button>
            <button
              type="button"
              onClick={() => goTo(activeIndex + 1)}
              disabled={!hasNext}
              className="touch-target-sm rounded-full border border-[var(--color-border)] text-[18px] font-bold text-[var(--color-primary)] disabled:opacity-30 tap-shrink"
              aria-label="المجموعة التالية">
              ‹
            </button>
          </div>
        </div>

        <div
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onClickCapture={onClickCapture}
          className="relative overflow-hidden"
          style={{ touchAction: 'pan-x' }}>
          <div
            style={{
              transform: `translateX(${offset}px)`,
              transition: isAnimating ? 'transform 0.22s cubic-bezier(0.25,0.46,0.45,0.94)' : 'none',
              willChange: 'transform',
            }}>
            {props.mode === 'full' ? (
              <GroupRow group={current as GroupRowData} index={props.startIndex + activeIndex} />
            ) : (
              <GroupRowTitlesOnly group={current as GroupRowTitleData} index={props.startIndex + activeIndex} />
            )}
          </div>
        </div>
      </section>
      <div className="hidden md:block">
        {verticalList}
      </div>
    </>
  )
}
