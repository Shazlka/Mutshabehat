'use client'

import { useEffect, useState } from 'react'
import type { QiraatLocus, QiraatVariant, QiraatAttribution } from '@/types/qiraat'

interface QiraatDetailSheetProps {
  isOpen: boolean
  onClose: () => void
  locus: QiraatLocus | null
  surahName?: string
  allLoci?: QiraatLocus[]
  onSelectLocus?: (locus: QiraatLocus) => void
}

function formatPerformanceType(type?: string | null): string {
  if (!type) return ''
  const map: Record<string, string> = {
    orthographic_alef: 'إثبات الألف',
    orthographic_hadhf: 'حذف الألف',
    pure_sad: 'الصاد الخالصة',
    pure_seen: 'السين الخالصة',
    ishmam_sad_zay: 'إشمام الصاد زايًا',
    kasr_haa: 'كسر الهاء',
    damm_haa: 'ضم الهاء',
    silah_mim: 'صلة ميم الجمع',
  }
  return map[type] || type
}

export default function QiraatDetailSheet({
  isOpen,
  onClose,
  locus,
  surahName = 'الفاتحة',
  allLoci = [],
  onSelectLocus,
}: QiraatDetailSheetProps) {
  const [activeVariantIndex, setActiveVariantIndex] = useState<number>(0)
  const [showSourceImage, setShowSourceImage] = useState(false)

  // Reset active variant when locus changes
  useEffect(() => {
    setActiveVariantIndex(0)
    setShowSourceImage(false)
  }, [locus?.id])

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showSourceImage) {
          setShowSourceImage(false)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, showSourceImage, onClose])

  if (!isOpen || !locus) return null

  const variants = locus.variants || []
  const activeVariant = variants[activeVariantIndex] ?? variants[0]

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qiraat-sheet-title"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="إغلاق لوحة القراءات"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[#2a2111]/45 backdrop-blur-[1.5px] transition-opacity"
      />

      {/* Main Sheet / Modal Container */}
      <section
        className="relative flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-[#d7c7a7] bg-[#fffdf8] shadow-[0_24px_60px_-12px_rgba(42,33,17,0.45)] sm:rounded-2xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Top Header */}
        <header className="flex items-center justify-between gap-3 border-b border-[#eadfc9] bg-[#fdfbf6] px-4 py-3">
          <div className="flex items-center gap-2">
            <span
              className="flex size-7 items-center justify-center rounded-full bg-[#b8871d] text-xs font-black text-white shadow-sm"
              style={{ fontFamily: 'var(--font-cairo), system-ui, sans-serif' }}
            >
              {locus.source_marker}
            </span>
            <div>
              <p className="text-[11px] font-bold text-[#b8871d]">
                القراءات العشر · المصدر: مصحف القراءات العشر ص {locus.printed_page}
              </p>
              <h2 id="qiraat-sheet-title" className="text-base font-black leading-tight text-[#171717]">
                سورة {surahName} · الآية {locus.ayah.toLocaleString('ar-EG')}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="rounded-md border border-[#8db596] bg-[#f0f9f2] px-2 py-0.5 text-[11px] font-bold text-[#1e6133]">
              موثّق ومحقّق
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق"
              className="flex size-9 items-center justify-center rounded-md border border-[#d7c7a7] text-lg font-bold text-[#59461d] transition-colors hover:bg-[#fff7df]"
            >
              ×
            </button>
          </div>
        </header>

        {/* Loci Switcher Pills (if multiple loci on this page) */}
        {allLoci.length > 1 ? (
          <div className="flex items-center gap-1.5 border-b border-[#f0e8d8] bg-[#fcf9f2] px-4 py-2 overflow-x-auto">
            <span className="text-[11px] font-bold text-[#80662c] shrink-0">مواضع الصفحة:</span>
            {allLoci.map((loc) => {
              const isCurrent = loc.id === locus.id
              return (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => onSelectLocus?.(loc)}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-colors shrink-0 ${
                    isCurrent
                      ? 'bg-[#171717] text-white shadow-sm'
                      : 'border border-[#e2d5bd] bg-white text-[#59461d] hover:bg-[#f7f0e0]'
                  }`}
                >
                  <span className="font-sans font-bold">{loc.marker_display}</span>
                  <span className="font-[family-name:var(--font-amiri-quran)] text-sm">{loc.mushaf_base_word}</span>
                  <span className="text-[10px] opacity-75 font-mono">({loc.ayah})</span>
                </button>
              )
            })}
          </div>
        ) : null}

        {/* Scrollable Content */}
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 text-right">
          {/* Locus Focus Card */}
          <div className="rounded-xl border border-[#e8ddc7] bg-[#fbf7ee] p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#80662c]">الكلمة في مصحف المدينة (حفص):</span>
              <span className="rounded bg-[#eedfc0] px-2 py-0.5 text-[10px] font-bold text-[#59461d]">
                {locus.targets.length > 1 ? `${locus.targets.length} مواضع في الآية` : 'موضع واحد'}
              </span>
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-3">
              <p className="font-[family-name:var(--font-amiri-quran)] text-3xl font-normal leading-relaxed text-[#171717]">
                {locus.mushaf_base_word}
              </p>
              <p className="text-xs text-[#665b48]" dir="ltr">
                {locus.surah}:{locus.ayah} ({locus.targets.map(t => `L${t.line_number}:W${t.word_index_in_line}`).join(', ')})
              </p>
            </div>

            {/* If multiple targets (like marker 4 عَلَيْهِمْ معًا) */}
            {locus.targets.length > 1 ? (
              <div className="mt-2 space-y-1 rounded-md border border-[#e4d6be] bg-white/70 p-2 text-xs text-[#59461d]">
                <p className="font-bold text-[#80662c]">تفصيل المواضع في الآية (معًا):</p>
                {locus.targets.map((target, idx) => (
                  <div key={target.id} className="flex items-center justify-between text-[11px]">
                    <span>الموضع {idx + 1}: السطر {target.line_number}، الكلمة {target.word_index_in_line}</span>
                    <span className="font-mono text-[#80662c]">{target.quran_word_id}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {/* Raw Heading from Source Book */}
            <div className="mt-3 rounded-lg border border-[#dfceb0] bg-white p-2.5">
              <p className="text-[11px] font-bold text-[#80662c]">نص الهامش من المصدر المطبوع:</p>
              <p className="mt-1 text-sm font-medium leading-relaxed text-[#2a2111]">
                {locus.source_heading_raw}
              </p>
            </div>
          </div>

          {/* Variants Selector Tabs */}
          {variants.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-[#80662c]">
                  أوجه القراءات الواردة ({variants.length} أوجه):
                </h3>
              </div>

              {/* Variant Navigation Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {variants.map((v, idx) => {
                  const isSelected = idx === activeVariantIndex
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setActiveVariantIndex(idx)}
                      className={`flex flex-col items-start gap-1 rounded-lg border p-2.5 text-right transition-all ${
                        isSelected
                          ? 'border-[#9c7016] bg-[#fffaf0] shadow-sm ring-1 ring-[#9c7016]'
                          : 'border-[#eadfc9] bg-white hover:bg-[#fbf7ee]'
                      }`}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="rounded bg-[#f0e8d8] px-1.5 py-0.5 text-[10px] font-bold text-[#59461d]">
                          الوجه {idx + 1}
                        </span>
                        {isSelected ? (
                          <span className="size-2 rounded-full bg-[#b8871d]" />
                        ) : null}
                      </div>
                      <span className="mt-1 font-[family-name:var(--font-amiri-quran)] text-xl font-normal text-[#171717]">
                        {v.display_text}
                      </span>
                      {v.performance_type ? (
                        <span className="text-[10px] text-[#80662c]">{formatPerformanceType(v.performance_type)}</span>
                      ) : null}
                    </button>
                  )
                })}
              </div>

              {/* Active Variant Detail Card */}
              {activeVariant ? (
                <div className="rounded-xl border border-[#d7c7a7] bg-white p-4 shadow-sm space-y-3.5">
                  <div className="border-b border-[#f0e8d8] pb-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-[family-name:var(--font-amiri-quran)] text-3xl font-normal text-[#171717]">
                        {activeVariant.display_text}
                      </span>
                      {activeVariant.performance_type ? (
                        <span className="rounded-full bg-[#fef3c7] px-3 py-1 text-xs font-bold text-[#92400e] border border-[#f59e0b]/30">
                          {formatPerformanceType(activeVariant.performance_type)}
                        </span>
                      ) : null}
                    </div>
                    {activeVariant.performance_text ? (
                      <p className="mt-2 text-xs leading-relaxed text-[#665b48]">
                        <span className="font-bold text-[#80662c]">كيفية الأداء: </span>
                        {activeVariant.performance_text}
                      </p>
                    ) : null}
                  </div>

                  {/* Attributed Imams and Rawis */}
                  <div>
                    <h4 className="text-xs font-bold text-[#80662c] mb-2">
                      القراء والرواة الذين قرؤوا بهذا الوجه:
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {activeVariant.attributions.map((attr) => {
                        const isImam = attr.role === 'imam'
                        const person = attr.person
                        const isKhalafHamza = person?.id === 'KHALAF_HAMZA'
                        const isKhalafAshir = person?.id === 'KHALAF_ASHIR'

                        return (
                          <div
                            key={attr.id}
                            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold ${
                              isImam
                                ? 'border-[#f59e0b]/40 bg-[#fffbeb] text-[#92400e]'
                                : 'border-[#10b981]/40 bg-[#ecfdf5] text-[#065f46]'
                            }`}
                          >
                            <span
                              className={`size-2 rounded-full ${
                                isImam ? 'bg-[#d97706]' : 'bg-[#10b981]'
                              }`}
                            />
                            <span>
                              {isImam ? 'الإمام ' : 'الراوي '}
                              {person?.display_name || attr.attribution_raw}
                            </span>
                            {/* Clear indicator for Khalaf disambiguation */}
                            {isKhalafHamza ? (
                              <span className="rounded bg-[#a7f3d0] px-1 py-0.2 text-[9px] text-[#064e3b]">
                                عن حمزة
                              </span>
                            ) : isKhalafAshir ? (
                              <span className="rounded bg-[#fde68a] px-1 py-0.2 text-[9px] text-[#78350f]">
                                العاشر
                              </span>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Raw line quote */}
                  {activeVariant.source_line_raw ? (
                    <div className="rounded-lg border border-[#f0e8d8] bg-[#fcf9f2] p-2.5 text-xs text-[#59461d]">
                      <span className="font-bold text-[#80662c]">نص العزو في الكتاب: </span>
                      <span>«{activeVariant.source_line_raw}»</span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-center text-sm text-[#665b48] py-4">لا توجد أوجه مسجلة لهذا الموضع.</p>
          )}

          {/* Source Information & Reference */}
          <div className="rounded-lg border border-[#eadfc9] bg-[#fffaf0] p-3 text-xs leading-6 text-[#665b48] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#80662c]">توثيق المصدر المعتمد:</span>
              <button
                type="button"
                onClick={() => setShowSourceImage(!showSourceImage)}
                className="rounded-md border border-[#b99b51] bg-white px-2.5 py-1 text-[11px] font-bold text-[#59461d] transition-colors hover:bg-[#fbf5e6]"
              >
                {showSourceImage ? 'إخفاء صورة المصدر' : 'عرض صورة الصفحة الأصلية'}
              </button>
            </div>
            <p>
              • المصدر: <span className="font-bold text-[#171717]">مصحف القراءات العشر بالرسم العثماني</span>
            </p>
            <p>
              • الصفحة المطبوعة: <span className="font-bold text-[#171717]">ص {locus.printed_page}</span> (سورة الفاتحة)
            </p>
            <p>
              • رقم صفحة ملف الـ PDF: <span className="font-bold text-[#171717]">ص {locus.pdf_page}</span>
            </p>

            {/* Source Image Viewer toggle */}
            {showSourceImage ? (
              <div className="mt-3 rounded-lg border border-[#d7c7a7] bg-white p-2 text-center">
                <p className="mb-2 text-[11px] font-bold text-[#80662c]">
                  صورة الصفحة الأصلية من مصحف القراءات العشر (ص {locus.printed_page}):
                </p>
                <div className="max-h-96 overflow-auto rounded border border-[#eae0cc] bg-[#f9f7f2]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/mushaf-1441/qiraat/source-image?page=${locus.mushaf_page}`}
                    alt={`مصحف القراءات العشر ص ${locus.printed_page}`}
                    className="w-full object-contain"
                    loading="lazy"
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Footer Actions */}
        <footer className="flex items-center justify-between border-t border-[#eadfc9] bg-[#fdfbf6] px-4 py-2.5">
          <p className="text-[11px] text-[#80662c]">
            انقر على أي موضع قراءة في المصحف لعرض التفاصيل
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-[#171717] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#3a3326]"
          >
            إغلاق
          </button>
        </footer>
      </section>
    </div>
  )
}
