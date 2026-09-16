'use client'

import React, { useEffect, useState, useRef } from 'react'
import { QiraatLocus, QiraatVariant, QiraatAttribution } from '@/types/qiraat'

export interface QiraatHoverTooltipProps {
  locus: QiraatLocus
  anchorRect: {
    top: number
    bottom: number
    left: number
    right: number
    width: number
    height: number
  }
  surahName?: string
  onOpenDetail: (locus: QiraatLocus) => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}

export function formatPerformanceType(type?: string | null): string {
  if (!type) return ''
  const map: Record<string, string> = {
    orthographic_alef: 'إثبات الألف',
    deleted_alef: 'حذف الألف',
    pure_sad: 'الصاد الخالصة',
    pure_seen: 'السين الخالصة',
    ishmam_sad_zay: 'إشمام الصاد زايًا',
    kasr_haa: 'كسر الهاء',
    damm_haa: 'ضم الهاء',
    silah_mim: 'صلة ميم الجمع',
  }
  return map[type] || type
}

function getAttributionBadgeClass(role?: string, personType?: string): string {
  if (personType === 'imam' || role === 'imam') {
    return 'border border-[#fde68a] bg-[#fef3c7] text-[#854d0e]'
  }
  if (personType === 'rawi' || role === 'rawi') {
    return 'border border-[#a7f3d0] bg-[#ecfdf5] text-[#065f46]'
  }
  return 'border border-[#e5e7eb] bg-[#f9fafb] text-[#374151]'
}

function renderQarisForVariant(variant: QiraatVariant) {
  if (!variant.attributions || variant.attributions.length === 0) {
    if (variant.source_line_raw) {
      const parts = variant.source_line_raw.split(':')
      const text = parts.length > 1 ? parts[1].trim() : variant.source_line_raw
      return <span className="text-xs text-[#59461d]">{text}</span>
    }
    return null
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {variant.attributions.map((attr) => {
        const isImam = attr.role === 'imam' || attr.person?.person_type === 'imam'
        const isRawi = attr.role === 'rawi' || attr.person?.person_type === 'rawi'
        const displayName = attr.person ? attr.person.display_name : attr.attribution_raw

        return (
          <span
            key={attr.id || `${attr.person_id}-${attr.variant_id}`}
            className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-bold leading-tight ${getAttributionBadgeClass(
              attr.role,
              attr.person?.person_type
            )}`}
            title={
              attr.person
                ? `${isImam ? 'الإمام' : isRawi ? 'الراوي' : ''} ${attr.person.canonical_name || attr.person.display_name}`
                : attr.attribution_raw
            }
          >
            {isImam ? <span className="text-[9px] opacity-75 font-normal">الإمام</span> : null}
            {isRawi ? <span className="text-[9px] opacity-75 font-normal">الراوي</span> : null}
            <span>{displayName}</span>
          </span>
        )
      })}
    </div>
  )
}

export default function QiraatHoverTooltip({
  locus,
  anchorRect,
  surahName = 'الفاتحة',
  onOpenDetail,
  onMouseEnter,
  onMouseLeave,
}: QiraatHoverTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<React.CSSProperties>({
    position: 'fixed',
    top: -9999,
    left: -9999,
    opacity: 0,
  })
  const [placement, setPlacement] = useState<'top' | 'bottom'>('top')
  const [arrowLeft, setArrowLeft] = useState<number>(50)

  useEffect(() => {
    if (!anchorRect) return

    const tooltipWidth = Math.min(380, window.innerWidth - 32)
    const centerX = anchorRect.left + anchorRect.width / 2

    // Clamp horizontally within screen
    let left = centerX - tooltipWidth / 2
    if (left < 16) left = 16
    if (left + tooltipWidth > window.innerWidth - 16) {
      left = window.innerWidth - tooltipWidth - 16
    }

    // Relative arrow position percentage
    const relativeArrowPos = ((centerX - left) / tooltipWidth) * 100
    setArrowLeft(Math.max(10, Math.min(90, relativeArrowPos)))

    // Estimate tooltip height ~220px to 320px depending on variants count
    const estimatedHeight = 110 + locus.variants.length * 68
    const spaceAbove = anchorRect.top
    const spaceBelow = window.innerHeight - anchorRect.bottom

    let place: 'top' | 'bottom' = 'top'
    let top = 0

    if (spaceAbove >= estimatedHeight + 12 || spaceAbove > spaceBelow) {
      place = 'top'
      top = Math.max(12, anchorRect.top - 10)
    } else {
      place = 'bottom'
      top = Math.min(window.innerHeight - estimatedHeight - 12, anchorRect.bottom + 10)
    }

    setPlacement(place)
    setStyle({
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      width: `${tooltipWidth}px`,
      zIndex: 60,
      opacity: 1,
      transform: place === 'top' ? 'translateY(-100%)' : 'translateY(0)',
      transition: 'opacity 150ms ease-out, transform 150ms ease-out',
    })
  }, [anchorRect, locus])

  return (
    <div
      ref={tooltipRef}
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="pointer-events-auto select-none rounded-xl border border-[#d7c7a7] bg-[#fffef9]/98 p-3.5 text-right shadow-[0_16px_48px_-8px_rgba(42,33,17,0.38)] backdrop-blur-sm transition-all"
      dir="rtl"
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-2 border-b border-[#ebdcc3] pb-2">
        <div className="flex items-center gap-2">
          <span
            className="flex size-5 items-center justify-center rounded-full bg-[#b8871d] text-[10px] font-black text-white shadow-sm"
            style={{ fontFamily: 'var(--font-cairo), system-ui, sans-serif' }}
          >
            {locus.source_marker}
          </span>
          <span className="text-xs font-bold text-[#80662c]">
            سورة {surahName} · آية {locus.ayah.toLocaleString('ar-EG')}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="rounded bg-[#f5ecda] px-1.5 py-0.5 text-[10px] font-bold text-[#80662c] border border-[#e5d5be]">
            خلاف في الكلمة
          </span>
          <span className="font-[family-name:var(--font-amiri-quran)] text-lg font-bold text-[#8f1d14]">
            {locus.mushaf_base_word}
          </span>
        </div>
      </div>

      {/* Variants List with Words and Qaris */}
      <div className="mt-2.5 space-y-2">
        {locus.variants.map((variant, idx) => (
          <div
            key={variant.id || idx}
            className="rounded-lg border border-[#ebdcc3] bg-[#fcf9f2] p-2 transition-colors hover:bg-[#fff9ed]"
          >
            {/* Top Row: The Word Variant & Rule */}
            <div className="flex items-baseline justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="rounded bg-[#e8ddc7] px-1 py-0.5 text-[9px] font-bold text-[#59461d]">
                  الوجه {idx + 1}
                </span>
                <span className="font-[family-name:var(--font-amiri-quran)] text-xl font-bold text-[#8f1d14]">
                  {variant.display_text}
                </span>
              </div>
              {variant.performance_type ? (
                <span className="rounded-full bg-[#fef3c7] px-2 py-0.5 text-[10px] font-bold text-[#92400e] border border-[#f59e0b]/30">
                  {formatPerformanceType(variant.performance_type)}
                </span>
              ) : null}
            </div>

            {/* Bottom Row: The Qaris who read this variant */}
            <div className="mt-1.5 flex flex-col gap-1 border-t border-[#f0e4cf] pt-1.5">
              <div className="flex items-center gap-1 text-[10px] font-bold text-[#80662c]">
                <span>القرّاء والرواة:</span>
              </div>
              {renderQarisForVariant(variant)}
            </div>
          </div>
        ))}
      </div>

      {/* Action Footer */}
      <button
        type="button"
        onClick={() => onOpenDetail(locus)}
        className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#b99b51] bg-[#fdf8ec] py-1.5 text-xs font-bold text-[#59461d] shadow-sm transition-colors hover:bg-[#b8871d] hover:text-white"
      >
        <span>عرض التفاصيل الكاملة والأوجه وصورة المصدر</span>
        <span aria-hidden="true">←</span>
      </button>

      {/* Arrow Indicator */}
      <div
        className={`pointer-events-none absolute size-2.5 rotate-45 border-[#d7c7a7] bg-[#fffef9] ${
          placement === 'top'
            ? '-bottom-[6px] border-b border-r'
            : '-top-[6px] border-t border-l'
        }`}
        style={{ left: `${arrowLeft}%` }}
      />
    </div>
  )
}
