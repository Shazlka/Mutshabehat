'use client'

import { cn } from '@/lib/cn'

export interface CanonicalVariantTypeItem {
  code: string
  label: string
  dbEnum: string
}

export const CANONICAL_VARIANT_TYPES: readonly CanonicalVariantTypeItem[] = [
  { code: 'تشكيل', label: 'تشكيل / حركة', dbEnum: 'vowel' },
  { code: 'حرف', label: 'إبدال حرف', dbEnum: 'consonant' },
  { code: 'زيادة', label: 'زيادة حرف/كلمة', dbEnum: 'addition' },
  { code: 'حذف', label: 'حذف حرف/كلمة', dbEnum: 'omission' },
  { code: 'تقديم وتأخير', label: 'تقديم وتأخير', dbEnum: 'word_form' },
  { code: 'أخرى', label: 'أخرى', dbEnum: 'other' },
] as const

export function normalizeVariantType(raw: string | null | undefined): string {
  if (!raw) return 'other'
  const trimmed = raw.trim().toLowerCase()
  switch (trimmed) {
    case 'vowel':
    case 'harakah':
    case 'تشكيل':
    case 'تشكيل / حركة':
    case 'حركة':
      return 'vowel'
    case 'consonant':
    case 'letter':
    case 'حرف':
    case 'إبدال حرف':
    case 'إبدال':
      return 'consonant'
    case 'addition':
    case 'زيادة':
    case 'زيادة حرف/كلمة':
    case 'زيادة حرف':
      return 'addition'
    case 'omission':
    case 'حذف':
    case 'حذف حرف/كلمة':
    case 'حذف حرف':
      return 'omission'
    case 'word_form':
    case 'تقديم وتأخير':
    case 'تقديم وتأخير / بنية الكلمة':
    case 'بنية الكلمة':
      return 'word_form'
    case 'orthography':
    case 'رسم':
      return 'orthography'
    case 'hamza':
    case 'hamz':
    case 'همز':
    case 'همزة':
      return 'hamza'
    case 'madd':
    case 'مد':
      return 'madd'
    case 'idgham':
    case 'إدغام':
      return 'idgham'
    case 'ishmam':
    case 'إشمام':
      return 'ishmam'
    case 'imalah':
    case 'إمالة':
      return 'imalah'
    case 'taqlil':
    case 'تقليل':
      return 'taqlil'
    case 'sakt':
    case 'سكت':
      return 'sakt'
    case 'naql':
    case 'نقل':
      return 'naql'
    case 'ikhfa':
    case 'إخفاء':
      return 'ikhfa'
    case 'ghunnah':
    case 'غنة':
      return 'ghunnah'
    case 'pronoun':
    case 'ضمير':
      return 'pronoun'
    case 'grammar':
    case 'إعراب':
      return 'grammar'
    case 'other':
    case 'أخرى':
      return 'other'
    default:
      return trimmed
  }
}

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
  const normSelected = normalizeVariantType(variantType)

  return (
    <div className="space-y-2" dir="rtl">
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
          className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 font-quran text-xl text-[var(--color-ink)] placeholder:font-sans placeholder:text-xs placeholder:text-[var(--color-ink-muted)]/60 focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
        />
      </div>

      {/* Variant Type Chips */}
      <div>
        <label className="text-xs font-bold text-[var(--color-ink)]">نوع الاختلاف:</label>
        <div className="mt-1 flex flex-wrap gap-1">
          {CANONICAL_VARIANT_TYPES.map((t) => {
            const isSelected = normSelected === t.dbEnum
            return (
              <button
                key={t.code}
                type="button"
                onClick={() => onChangeVariantType(t.dbEnum)}
                disabled={disabled}
                className={cn(
                  'rounded px-2 py-0.5 text-xs font-medium transition-all select-none',
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
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
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
            className="mt-0.5 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-xs text-[var(--color-ink)] focus:border-[var(--color-primary)] focus:outline-none"
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
            className="mt-0.5 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-xs text-[var(--color-ink)] focus:border-[var(--color-primary)] focus:outline-none"
          />
        </div>
      </div>
    </div>
  )
}
