'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { FeatureName } from '../../_features/host/QiraatFeaturesHost'
import { PHONE_MEMORIZATION_READY } from './flags'
import { morePopoverRows, phoneFooterItems, qiraatPopoverRows, type PhoneFooterItemId, type QiraatPopoverRowId } from './models'

type OpenPopover = 'qiraat' | 'more' | null

const iconClass = 'size-[22px] shrink-0'

function FooterIcon({ id, filled }: { id: PhoneFooterItemId; filled?: boolean }) {
  const common = { className: iconClass, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  if (id === 'index') return <svg {...common}><path d="M8 6h12M8 12h12M8 18h12" /><circle cx="4" cy="6" r="1" fill="currentColor" stroke="none" /><circle cx="4" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="4" cy="18" r="1" fill="currentColor" stroke="none" /></svg>
  if (id === 'search') return <svg {...common}><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></svg>
  if (id === 'bookmarks') return <svg {...common} fill="currentColor" stroke="none"><path d="M6 3.5A1.5 1.5 0 0 1 7.5 2h9A1.5 1.5 0 0 1 18 3.5V22l-6-3.8L6 22Z" /></svg>
  if (id === 'qiraat') return <svg {...common} fill={filled ? 'currentColor' : 'none'}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11a2 2 0 0 1 2 2v16a2.8 2.8 0 0 0-2.6-1.8H6.5A2.5 2.5 0 0 1 4 16.7Z" /><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v18a2.8 2.8 0 0 1 2.6-1.8h1.9a2.5 2.5 0 0 0 2.5-2.5Z" /></svg>
  if (id === 'more') return <svg {...common}><circle cx="12" cy="12" r="9" /><circle cx="8" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="16" cy="12" r="1" fill="currentColor" stroke="none" /></svg>
  return <svg {...common} fill="currentColor" stroke="none"><path d="m10.2 2 .6 2.1a8 8 0 0 1 2.4 0L13.8 2l2.6 1.1-1 1.9q.9.8 1.6 1.6l1.9-1 1.1 2.6-2.1.6a8 8 0 0 1 0 2.4l2.1.6-1.1 2.6-1.9-1q-.7.9-1.6 1.6l1 1.9-2.6 1.1-.6-2.1a8 8 0 0 1-2.4 0l-.6 2.1-2.6-1.1 1-1.9A9 9 0 0 1 7 13.4l-1.9 1L4 11.8l2.1-.6a8 8 0 0 1 0-2.4L4 8.2l1.1-2.6 1.9 1Q7.7 5.7 8.6 5l-1-1.9Z" /><circle cx="12" cy="10" r="3" fill="var(--qiraat-card-fill)" /></svg>
}

function MenuIcon({ children }: { children: ReactNode }) {
  return <span className="flex w-8 shrink-0 justify-center text-xl text-[var(--mushaf-brown)]" aria-hidden="true">{children}</span>
}

function PhonePopover(props: {
  id: string
  label: string
  openerId: string
  onClose: () => void
  children: ReactNode
}) {
  const { children, id, label, onClose, openerId } = props
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    panel.current?.querySelector<HTMLElement>('[role^="menuitem"]:not([aria-disabled="true"])')?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose() }
      if (event.key !== 'Tab') return
      const items = Array.from(panel.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([aria-disabled="true"])') ?? [])
      if (items.length === 0) return
      const current = items.indexOf(document.activeElement as HTMLElement)
      if (event.shiftKey && current <= 0) { event.preventDefault(); items.at(-1)?.focus() }
      else if (!event.shiftKey && current === items.length - 1) { event.preventDefault(); items[0]?.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown); document.getElementById(openerId)?.focus() }
  }, [onClose, openerId])
  return (
    <div className="fixed inset-0 z-[70] md:hidden">
      <button type="button" aria-label="إغلاق القائمة" onClick={onClose} className="absolute inset-0 cursor-default bg-transparent" />
      <div
        ref={panel}
        id={id}
        role="menu"
        aria-label={label}
        dir="rtl"
        className="phone-chrome-surface absolute inset-x-2 bottom-[calc(env(safe-area-inset-bottom)+82px)] mx-auto max-h-[min(60dvh,420px)] max-w-[330px] overflow-y-auto rounded-[28px] border p-1.5 text-[var(--mushaf-ink)] shadow-[0_14px_40px_color-mix(in_srgb,var(--mushaf-ink)_20%,transparent)]"
      >
        {children}
      </div>
    </div>
  )
}

const rowClass = 'flex min-h-[58px] w-full items-center justify-between gap-3 border-b border-[var(--mushaf-rule-soft)] px-5 text-start text-base font-semibold last:border-b-0 disabled:opacity-50'

export function PhoneFooterBar(props: {
  visible: boolean
  pageNumber: number
  pageCount: number
  qiraatEnabled: boolean
  farshOnly: boolean
  filterName: string
  onInteraction: () => void
  onPopoverOpenChange: (open: boolean) => void
  onGoToPage: (page: number) => void
  onOpenIndex: () => void
  onOpenSearch: () => void
  onOpenBookmarks: () => void
  onToggleQiraat: () => void
  onOpenQiraatFeature: (feature: FeatureName) => void
  onOpenMutoon: () => void
  onOpenSettings: () => void
}) {
  const [popover, setPopover] = useState<OpenPopover>(null)
  const [previewPage, setPreviewPage] = useState<number | null>(null)
  const setOpen = (next: OpenPopover) => {
    setPopover(next)
    props.onPopoverOpenChange(next !== null)
    props.onInteraction()
  }
  const { onPopoverOpenChange, visible } = props
  useEffect(() => {
    if (visible) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPopover(null)
    onPopoverOpenChange(false)
  }, [visible, onPopoverOpenChange])

  const closeAnd = (action: () => void) => {
    setOpen(null)
    window.requestAnimationFrame(action)
  }
  const featureByRow: Record<QiraatPopoverRowId, FeatureName | null> = {
    toggle: null,
    filter: 'readerPicker',
    legend: 'legend',
    pageSummary: 'pageSummary',
    search: 'search',
    usulIndex: 'usulIndex',
  }
  const featureFor = (id: QiraatPopoverRowId) => featureByRow[id]
  const activate = (id: PhoneFooterItemId) => {
    props.onInteraction()
    if (id === 'index') props.onOpenIndex()
    else if (id === 'search') props.onOpenSearch()
    else if (id === 'bookmarks') props.onOpenBookmarks()
    else if (id === 'settings') props.onOpenSettings()
  }
  const sliderValue = previewPage ?? props.pageNumber
  const commitSlider = () => {
    if (previewPage !== null && previewPage !== props.pageNumber) props.onGoToPage(previewPage)
    setPreviewPage(null)
  }
  return (
    <>
      <div
        className={`fixed inset-x-0 bottom-0 z-[60] hidden px-2 pb-[max(10px,calc(env(safe-area-inset-bottom)-4px))] transition-[opacity,transform] duration-[220ms] ease-out max-md:block md:hidden ${props.visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-5 opacity-0'}`}
        aria-hidden={!props.visible}
        onPointerDown={props.onInteraction}
      >
        <div className="mx-auto mb-1 flex max-w-md items-center gap-2 rounded-full border border-[var(--mushaf-rule-soft)] bg-[var(--qiraat-card-fill)]/95 px-3 py-1 shadow-sm">
          <span className="w-14 text-center text-[11px] font-bold tabular-nums text-[var(--mushaf-brown)]">صفحة {sliderValue}</span>
          <input
            type="range"
            min={1}
            max={props.pageCount}
            value={sliderValue}
            aria-label="انتقال سريع للصفحة"
            onPointerDown={() => setPreviewPage(props.pageNumber)}
            onChange={(event) => setPreviewPage(Number(event.target.value))}
            onPointerUp={commitSlider}
            onPointerCancel={() => setPreviewPage(null)}
            onKeyUp={commitSlider}
            className="h-11 min-w-0 flex-1 accent-[var(--mushaf-gold)]"
          />
        </div>
        <div className="phone-chrome-surface mx-auto grid h-[62px] max-w-md grid-cols-6 rounded-[24px] border px-1 text-[var(--mushaf-ink)] shadow-[0_8px_30px_color-mix(in_srgb,var(--mushaf-ink)_18%,transparent)]" role="toolbar" aria-label="أدوات قارئ المصحف">
          {phoneFooterItems(props.qiraatEnabled).map((item) => {
            const menu = item.id === 'qiraat' || item.id === 'more'
            const expanded = popover === item.id
            return (
              <button
                key={item.id}
                id={`phone-footer-${item.id}`}
                type="button"
                aria-label={item.value ? `${item.label}، ${item.value}` : item.label}
                aria-pressed={item.id === 'qiraat' ? props.qiraatEnabled : undefined}
                aria-haspopup={menu ? 'menu' : undefined}
                aria-expanded={menu ? expanded : undefined}
                aria-controls={expanded ? `phone-${item.id}-menu` : undefined}
                onPointerDown={menu ? (event) => {
                  if (event.pointerType !== 'mouse' || event.button === 0) {
                    event.preventDefault()
                    setOpen(item.id as OpenPopover)
                  }
                } : undefined}
                onClick={(event) => {
                  if (menu) {
                    if (event.detail === 0) setOpen(expanded ? null : item.id as OpenPopover)
                    return
                  }
                  activate(item.id)
                }}
                className="flex min-h-11 min-w-0 touch-manipulation flex-col items-center justify-center gap-0.5 rounded-[18px] px-0.5 text-[9px] font-semibold leading-none transition-transform duration-[220ms] ease-out active:scale-[1.16] motion-reduce:transition-none motion-reduce:active:scale-100"
              >
                <FooterIcon id={item.id} filled={item.id === 'qiraat' && props.qiraatEnabled} />
                <span className="w-full truncate">{item.label}</span>
              </button>
            )
          })}
        </div>
      </div>
      {popover === 'qiraat' ? (
        <PhonePopover id="phone-qiraat-menu" label="قائمة القراءات" openerId="phone-footer-qiraat" onClose={() => setOpen(null)}>
          {qiraatPopoverRows({ enabled: props.qiraatEnabled, farshOnly: props.farshOnly, filterName: props.filterName }).map((row) => (
            <button
              key={row.id}
              type="button"
              role={row.id === 'toggle' ? 'menuitemcheckbox' : 'menuitem'}
              aria-checked={row.id === 'toggle' ? row.checked : undefined}
              disabled={row.disabled}
              onClick={() => closeAnd(() => {
                if (row.id === 'toggle') props.onToggleQiraat()
                else {
                  const feature = featureFor(row.id)
                  if (feature) props.onOpenQiraatFeature(feature)
                }
              })}
              className={rowClass}
            >
              <span>{row.label}</span>
              <MenuIcon>{row.id === 'toggle' ? (row.checked ? '✓' : '') : row.id === 'filter' ? '☷' : row.id === 'legend' ? '◐' : row.id === 'pageSummary' ? '☷' : row.id === 'search' ? '⌕' : '☰'}</MenuIcon>
            </button>
          ))}
        </PhonePopover>
      ) : null}
      {popover === 'more' ? (
        <PhonePopover id="phone-more-menu" label="قائمة المزيد" openerId="phone-footer-more" onClose={() => setOpen(null)}>
          {morePopoverRows(PHONE_MEMORIZATION_READY).map((row) => row.id === 'mutshabehat' ? (
            <Link key={row.id} href="/" prefetch={false} role="menuitem" onClick={() => setOpen(null)} className={rowClass}>
              <span>{row.label}</span><MenuIcon>◫</MenuIcon>
            </Link>
          ) : row.id === 'memorization' && PHONE_MEMORIZATION_READY ? (
            <Link key={row.id} href="/memorization" prefetch={false} role="menuitem" onClick={() => setOpen(null)} className={rowClass}>
              <span>{row.label}</span><MenuIcon>▣</MenuIcon>
            </Link>
          ) : (
            <button
              key={row.id}
              type="button"
              role="menuitem"
              aria-disabled={row.disabled || undefined}
              disabled={row.disabled}
              onClick={() => closeAnd(props.onOpenMutoon)}
              className={rowClass}
            >
              <span>{row.label}{row.hint ? <small className="ms-2 text-xs text-[var(--mushaf-brown)]">{row.hint}</small> : null}</span>
              <MenuIcon>{row.id === 'mutoon' ? '☷' : '▣'}</MenuIcon>
            </button>
          ))}
        </PhonePopover>
      ) : null}
    </>
  )
}
