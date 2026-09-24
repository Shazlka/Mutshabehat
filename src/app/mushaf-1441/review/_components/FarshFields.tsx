'use client'

import { cn } from '@/lib/cn'

export const CANONICAL_VARIANT_TYPES = [
  { code: 'تشكيل', label: 'تشكيل / حركة' },
  { code: 'حرف', label: 'إبدال حرف' },
  { code: 'زيادة', label: 'زيادة حرف/كلمة' },
  { code: 'حذف', label: 'حذف حرف/كلمة' },
  { code: 'تقديم وتأخير', label: 'تقديم وتأخير' },
  { code: 'أخرى', label: 'أخرى' },
] as const

type Props = {
  readingText: string
  onChangeReadingText(text: string): void
  variantType: string | null
  onChangeVariantType(type: string): void
  description: string | null
  onChangeDescription(desc: string): void
  performanceNote: string | null
  onChangePerformanceNote(note: string): void
  disabled?: boolean
}

export default function FarshFields({
  readingText,
  onChangeReadingText,
  variantType,
  onChangeVariantType,
  description,
  onChangeDescription,
  performanceNote,
  onChangePerformanceNote,
  disabled,
}: Props) {
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

      {/* Variant Type Chips */}
      <div>
        <label className="text-xs font-bold text-[var(--color-ink)]">نوع الاختلاف:</label>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {CANONICAL_VARIANT_TYPES.map((t) => {
            const isSelected = variantType === t.code
            return (
              <button
                key={t.code}
                type="button"
                onClick={() => onChangeVariantType(t.code)}
                disabled={disabled}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-all select-none',
                  isSelected
                    ? 'border border-[var(--color-primary)] bg-[var(--color-primary)] font-bold text-white shadow-xs'
                    : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-soft)] hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-surface-2)]'
                )}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Description & Performance Note */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <label className="text-[10px] font-bold text-[var(--color-ink-muted)]">
            بيان الفرق (اختياري):
          </label>
          <input
            type="text"
            value={description ?? ''}
            onChange={(e) => onChangeDescription(e.target.value)}
            disabled={disabled}
            placeholder="مثال: بضم الياء، بكسر التاء..."
            className="mt-0.5 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs text-[var(--color-ink)] focus:border-[var(--color-primary)] focus:outline-none"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-[var(--color-ink-muted)]">
            ملاحظة الأداء (اختياري):
          </label>
          <input
            type="text"
            value={performanceNote ?? ''}
            onChange={(e) => onChangePerformanceNote(e.target.value)}
            disabled={disabled}
            placeholder="مثال: وصلًا ووقفًا، يختص بالوقف..."
            className="mt-0.5 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs text-[var(--color-ink)] focus:border-[var(--color-primary)] focus:outline-none"
          />
        </div>
      </div>
    </div>
  )
}
