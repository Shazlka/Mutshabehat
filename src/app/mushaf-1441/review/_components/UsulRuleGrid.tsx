'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/cn'

export interface CategoryOption {
  code: string
  nameAr: string
}

export const FALLBACK_USUL_CATEGORIES: readonly CategoryOption[] = [
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
  { code: 'USUL_NAQL', nameAr: 'النقل' },
  { code: 'USUL_SAKT', nameAr: 'السكت' },
]

type Props = {
  selectedCategoryCode: string | null
  onSelectCategory(code: string): void
  readingText: string
  onChangeReadingText(text: string): void
  rulingText: string | null
  onChangeRulingText(text: string): void
  availableCategories?: CategoryOption[]
  disabled?: boolean
}

export default function UsulRuleGrid({
  selectedCategoryCode,
  onSelectCategory,
  readingText,
  onChangeReadingText,
  rulingText,
  onChangeRulingText,
  availableCategories,
  disabled,
}: Props) {
  const [filterQuery, setFilterQuery] = useState('')

  const categories = useMemo(() => {
    if (availableCategories && availableCategories.length > 0) {
      return availableCategories.filter((c) => c.code !== 'AYAH_COUNT')
    }
    return FALLBACK_USUL_CATEGORIES
  }, [availableCategories])

  const filteredCategories = useMemo(() => {
    const q = filterQuery.trim().toLowerCase()
    if (!q) return categories
    return categories.filter((c) => c.nameAr.includes(q) || c.code.toLowerCase().includes(q))
  }, [categories, filterQuery])

  return (
    <div className="space-y-3" dir="rtl">
      {/* Reading Text Input */}
      <div>
        <label className="flex items-center justify-between text-xs font-bold text-[var(--color-ink)]">
          <span>نص القراءة المقروء به:</span>
          <span className="text-[11px] text-[var(--color-ink-muted)]">مع الضبط والشكل</span>
        </label>
        <input
          type="text"
          value={readingText}
          onChange={(e) => onChangeReadingText(e.target.value)}
          disabled={disabled}
          placeholder="اكتب نص الكلمة في هذه القراءة..."
          dir="rtl"
          className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 font-quran text-2xl text-[var(--color-ink)] placeholder:font-sans placeholder:text-xs placeholder:text-[var(--color-ink-muted)]/60 focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-bold text-[var(--color-ink)]">
          باب الأصول ({categories.length} بابًا):
        </label>
        {categories.length > 8 ? (
          <input
            type="search"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="تصفية الأبواب..."
            className="h-7 w-32 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-[11px] text-[var(--color-ink)] focus:w-44 focus:ring-1 focus:ring-[var(--color-primary)] transition-all"
          />
        ) : null}
      </div>

      {/* Grid of Category Chips */}
      <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto p-1 rounded-md border border-[var(--color-border-soft)] bg-[var(--color-surface-2)]/20">
        {filteredCategories.map((category) => {
          const isSelected = selectedCategoryCode === category.code
          return (
            <button
              key={category.code}
              type="button"
              onClick={() => onSelectCategory(category.code)}
              disabled={disabled}
              className={cn(
                'flex items-center justify-between gap-1 rounded-md px-2.5 py-1.5 text-right text-xs font-medium transition-all select-none',
                isSelected
                  ? 'border border-[var(--color-primary)] bg-[var(--color-primary)] font-bold text-white shadow-xs'
                  : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-soft)] hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-surface-2)]'
              )}
            >
              <span className="truncate">{category.nameAr}</span>
              {isSelected ? <span className="text-[11px]">✓</span> : null}
            </button>
          )
        })}
      </div>

      {/* Ruling statement / notes input */}
      <div>
        <label className="text-[10px] font-bold text-[var(--color-ink-muted)]">
          بيان الحكم أو الملاحظة (اختياري):
        </label>
        <textarea
          value={rulingText ?? ''}
          onChange={(e) => onChangeRulingText(e.target.value)}
          disabled={disabled}
          placeholder="مثال: إمالة الألف، أو نقل حركة الهمزة..."
          rows={2}
          className="mt-1 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted)]/60 focus:border-[var(--color-primary)] focus:outline-none"
        />
      </div>
    </div>
  )
}
