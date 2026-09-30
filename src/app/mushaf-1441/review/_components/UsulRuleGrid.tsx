'use client'

import { useMemo, useState } from 'react'
import type { HamzahDetail, NarratorInput } from '../_lib/types'
import { cn } from '@/lib/cn'
import { normalizeArabic } from '@/lib/arabic'
import ImalahDetailFields, { isImalahCategory } from './ImalahDetailFields'
import HamzahDetailFields, { isHamzahCategory } from './HamzahDetailFields'

export interface CategoryOption {
  code: string
  nameAr: string
}

export const FALLBACK_USUL_CATEGORIES: readonly CategoryOption[] = [
  { code: 'USUL_TAHQIQ', nameAr: 'تحقيق' },
  { code: 'USUL_NAQL', nameAr: 'النقل' },
  { code: 'USUL_IBDAL', nameAr: 'الإبدال' },
  { code: 'SILAT_HA', nameAr: 'صلة هاء الكناية' },
  { code: 'TARQIQ_RA', nameAr: 'ترقيق الراءات' },
  { code: 'TAGHLIZ_LAM', nameAr: 'تغليظ اللامات' },
  { code: 'MADD_BADAL', nameAr: 'مد البدل' },
  { code: 'MADD_LIN', nameAr: 'مد اللين المهموز' },
  { code: 'IMALAH_TAQLIL', nameAr: 'الممال والمقلل' },
  { code: 'IDGHAM_SAGHIR', nameAr: 'المدغم الصغير' },
  { code: 'IDGHAM_KABIR', nameAr: 'المدغم الكبير' },
  { code: 'TAGHYIR_HAMZ', nameAr: 'تغيير الهمز' },
  { code: 'HAMZATAN_KALIMA', nameAr: 'الهمزتان من كلمة' },
  { code: 'HAMZATAN_KALIMATAYN', nameAr: 'الهمزتان من كلمتين' },
  { code: 'TARK_GHUNNA', nameAr: 'ترك الغنة' },
  { code: 'IKHFA', nameAr: 'الإخفاء' },
  { code: 'WAQF_HAMZA', nameAr: 'وقف حمزة' },
  { code: 'WAQF_RASM', nameAr: 'الوقف على مرسوم الخط' },
  { code: 'YAAT_IDAFA', nameAr: 'ياءات الإضافة' },
  { code: 'YAAT_ZAWAID', nameAr: 'ياءات الزوائد' },
  { code: 'BAYN_SURATAYN', nameAr: 'الأوجه بين السورتين' },
  { code: 'MADD_QABL_IDGHAM', nameAr: 'المد قبل الإدغام الكبير' },
  { code: 'USUL_MADD', nameAr: 'أصول المد' },
  { code: 'USUL_MIM_JAM', nameAr: 'ميم الجمع' },
  { code: 'USUL_SAKT', nameAr: 'السكت' },
]

type Props = {
  selectedCategoryCode: string | null
  onSelectCategory(code: string): void
  /** Multi-select: every ticked باب (primary first) and the toggle that adds/removes one. */
  selectedCategoryCodes?: string[]
  onToggleCategory?(code: string): void
  readingText: string
  onChangeReadingText(text: string): void
  rulingText: string | null
  onChangeRulingText(text: string): void
  availableCategories?: CategoryOption[]
  appliesWasl?: boolean
  onChangeAppliesWasl?(val: boolean): void
  appliesWaqf?: boolean
  onChangeAppliesWaqf?(val: boolean): void
  narrators?: NarratorInput[]
  onChangeNarrators?(narrators: NarratorInput[]): void
  hamzahDetail?: HamzahDetail | null
  onChangeHamzahDetail?(val: HamzahDetail | null): void
  disabled?: boolean
  // Feature 2: the two endpoints of an active Ctrl-click span on the Mushaf pane (anchor word +
  // extended word), so the الهمزتان من كلمتين builder can let the reviewer assign which literal
  // word carries الهمزة الأولى vs الهمزة الثانية.
  spanStart?: { key: string; text: string } | null
  spanEnd?: { key: string; text: string } | null
}

export default function UsulRuleGrid({
  selectedCategoryCode,
  onSelectCategory,
  selectedCategoryCodes,
  onToggleCategory,
  readingText,
  onChangeReadingText,
  rulingText,
  onChangeRulingText,
  availableCategories,
  appliesWasl,
  onChangeAppliesWasl,
  appliesWaqf,
  onChangeAppliesWaqf,
  narrators,
  onChangeNarrators,
  hamzahDetail,
  onChangeHamzahDetail,
  disabled,
  spanStart,
  spanEnd,
}: Props) {
  const [filterQuery, setFilterQuery] = useState('')
  const [showAllCategories, setShowAllCategories] = useState(!selectedCategoryCode)

  const categories = useMemo(() => {
    if (availableCategories && availableCategories.length > 0) {
      return availableCategories.filter((c) => c.code !== 'AYAH_COUNT')
    }
    return FALLBACK_USUL_CATEGORIES
  }, [availableCategories])

  const selectedCategory = useMemo(() => {
    return categories.find((c) => c.code === selectedCategoryCode)
  }, [categories, selectedCategoryCode])

  const ticked = selectedCategoryCodes ?? (selectedCategoryCode ? [selectedCategoryCode] : [])
  const selectedNames = ticked.map((code) => categories.find((c) => c.code === code)?.nameAr ?? code).join('، ')

  const filteredCategories = useMemo(() => {
    const q = filterQuery.trim()
    if (!q) return categories
    const normQ = normalizeArabic(q).toLowerCase()
    return categories.filter(
      (c) =>
        c.nameAr.includes(q) ||
        normalizeArabic(c.nameAr).toLowerCase().includes(normQ) ||
        c.code.toLowerCase().includes(q.toLowerCase())
    )
  }, [categories, filterQuery])

  return (
    <div className="space-y-1.5" dir="rtl">
      {/* Reading Text & Selected Category Row */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[200px]">
          <label className="flex items-center justify-between text-xs font-bold text-[var(--color-ink)]">
            <span>نص القراءة المقروء به:</span>
            <span className="text-[10px] text-[var(--color-ink-muted)]">مع الضبط والشكل</span>
          </label>
          <input
            type="text"
            value={readingText}
            onChange={(e) => onChangeReadingText(e.target.value)}
            disabled={disabled}
            placeholder="اكتب نص الكلمة في هذه القراءة..."
            dir="rtl"
            className="mt-0.5 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 font-quran text-lg text-[var(--color-ink)] placeholder:font-sans placeholder:text-xs placeholder:text-[var(--color-ink-muted)]/60 focus:border-[var(--color-primary)] focus:outline-none"
          />
        </div>

        {selectedCategory && !showAllCategories ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-primary)]/40 bg-[var(--color-primary-soft)]/20 px-2.5 py-1 text-xs h-[38px] shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-[var(--color-ink-muted)]">الباب:</span>
              <span className="font-bold text-[var(--color-primary)]">{selectedNames}</span>
              <span className="rounded bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-300 px-1 text-[9px] font-bold">✓</span>
            </div>
            <button
              type="button"
              onClick={() => setShowAllCategories(true)}
              disabled={disabled}
              className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.2 text-[10px] font-bold text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-2)]"
            >
              تغيير ▾
            </button>
          </div>
        ) : null}
      </div>

      {/* Expandable Category Picker Grid when changing */}
      {(!selectedCategory || showAllCategories) && (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-bold text-[var(--color-ink)]">
              اختر باب الأصول ({categories.length} بابًا):
            </label>
            <div className="flex items-center gap-1.5">
              {categories.length > 8 ? (
                <input
                  type="search"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder="تصفية الأبواب..."
                  className="h-6 w-32 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-[11px] text-[var(--color-ink)] focus:w-40 focus:ring-1 focus:ring-[var(--color-primary)] transition-all"
                />
              ) : null}
              {selectedCategory ? (
                <button
                  type="button"
                  onClick={() => setShowAllCategories(false)}
                  className="text-[11px] font-bold text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
                >
                  إلغاء
                </button>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1 p-1 rounded-md border border-[var(--color-border-soft)] bg-[var(--color-surface-2)]/20">
            {filteredCategories.map((category) => {
              const isSelected = ticked.includes(category.code)
              return (
                <button
                  key={category.code}
                  type="button"
                  role="checkbox"
                  aria-checked={isSelected}
                  onClick={() => {
                    if (onToggleCategory) onToggleCategory(category.code)
                    else onSelectCategory(category.code)
                    // Stay open while ticking plain أبواب; collapse once a structured (همزة/إمالة) one is chosen.
                    if (!onToggleCategory || isHamzahCategory(category.code) || isImalahCategory(category.code)) setShowAllCategories(false)
                  }}
                  disabled={disabled}
                  className={cn(
                    'flex items-center justify-between gap-1 rounded px-2 py-1 text-right text-xs font-medium transition-all select-none',
                    isSelected
                      ? 'border border-[var(--color-primary)] bg-[var(--color-primary)] font-bold text-white shadow-xs'
                      : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-soft)] hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-surface-2)]'
                  )}
                >
                  <span>{category.nameAr}</span>
                  {isSelected ? <span className="text-[10px]">✓</span> : null}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Structured Imalah & Taqlil controls */}
      {isImalahCategory(selectedCategoryCode) ? (
        <ImalahDetailFields
          categoryCode={selectedCategoryCode}
          rulingText={rulingText}
          onChangeRulingText={onChangeRulingText}
          appliesWasl={appliesWasl ?? true}
          onChangeAppliesWasl={onChangeAppliesWasl ?? (() => {})}
          appliesWaqf={appliesWaqf ?? true}
          onChangeAppliesWaqf={onChangeAppliesWaqf ?? (() => {})}
          narrators={narrators}
          onChangeNarrators={onChangeNarrators}
          disabled={disabled}
        />
      ) : null}

      {/* Structured Hamzah controls */}
      {isHamzahCategory(selectedCategoryCode) ? (
        <HamzahDetailFields
          categoryCode={selectedCategoryCode}
          rulingText={rulingText}
          onChangeRulingText={onChangeRulingText}
          appliesWasl={appliesWasl ?? true}
          onChangeAppliesWasl={onChangeAppliesWasl ?? (() => {})}
          appliesWaqf={appliesWaqf ?? true}
          onChangeAppliesWaqf={onChangeAppliesWaqf ?? (() => {})}
          narrators={narrators}
          onChangeNarrators={onChangeNarrators}
          hamzahDetail={hamzahDetail}
          onChangeHamzahDetail={onChangeHamzahDetail}
          disabled={disabled}
          spanStart={spanStart}
          spanEnd={spanEnd}
        />
      ) : null}
    </div>
  )
}
