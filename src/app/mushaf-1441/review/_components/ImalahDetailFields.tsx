'use client'

// Structured Imalah & Taqlil performance controls for the الممال والمقلل
// Usul chapter (categoryCode: IMALAH_TAQLIL).
// Lets the reviewer pick from a list (or quick buttons) between إمالة, تقليل, or both,
// and then configure wasl and waqf applicability.

import { useMemo } from 'react'
import { cn } from '@/lib/cn'

export type ImalahType = 'إمالة' | 'تقليل' | 'إمالة وتقليل'

export const IMALAH_CATEGORY_CODE = 'IMALAH_TAQLIL'

export function isImalahCategory(categoryCode: string | null): boolean {
  return categoryCode === IMALAH_CATEGORY_CODE
}

export const IMALAH_NARRATOR_IDS = [
  'Q06-R01', // خلف عن حمزة
  'Q06-R02', // خلاد عن حمزة
  'Q07-R01', // أبو الحارث عن الكسائي
  'Q07-R02', // الدوري عن الكسائي
  'Q10-R01', // إسحاق عن خلف العاشر
  'Q10-R02', // إدريس عن خلف العاشر
] as const

export const TAQLIL_NARRATOR_IDS = [
  'Q01-R02', // ورش عن نافع
  'Q03-R01', // الدوري عن أبي عمرو
  'Q03-R02', // السوسي عن أبي عمرو
] as const

export const WARSH_NARRATOR_ID = 'Q01-R02'

export function buildImalahRulingText(
  type: ImalahType,
  wasl: boolean,
  waqf: boolean
): string {
  const perfText = wasl && waqf ? 'وصلاً ووقفاً' : waqf ? 'عند الوقف' : 'عند الوصل'
  return `${type} الألف ${perfText}`
}

export function detectImalahType(rulingText: string | null): ImalahType | null {
  if (!rulingText) return null
  const text = rulingText.trim()
  if (text.includes('إمالة') && text.includes('تقليل')) return 'إمالة وتقليل'
  if (text.includes('تقليل')) return 'تقليل'
  if (text.includes('إمالة')) return 'إمالة'
  return null
}

export type ImalahDetailFieldsProps = {
  categoryCode: string | null
  rulingText: string | null
  onChangeRulingText(text: string): void
  appliesWasl: boolean
  onChangeAppliesWasl(wasl: boolean): void
  appliesWaqf: boolean
  onChangeAppliesWaqf(waqf: boolean): void
  onApplyNarrators?: (preset: 'imalah' | 'taqlil' | 'warsh') => void
  disabled?: boolean
}

export default function ImalahDetailFields({
  categoryCode,
  rulingText,
  onChangeRulingText,
  appliesWasl,
  onChangeAppliesWasl,
  appliesWaqf,
  onChangeAppliesWaqf,
  onApplyNarrators,
  disabled,
}: ImalahDetailFieldsProps) {
  if (!isImalahCategory(categoryCode)) return null

  const activeType = useMemo(() => detectImalahType(rulingText), [rulingText])

  function handleSelectType(type: ImalahType) {
    if (disabled) return
    const newText = buildImalahRulingText(type, appliesWasl, appliesWaqf)
    onChangeRulingText(newText)
  }

  function handleSetPreset(preset: 'wasl_waqf' | 'waqf_only' | 'wasl_only') {
    if (disabled) return
    let nextWasl = true
    let nextWaqf = true
    if (preset === 'waqf_only') {
      nextWasl = false
      nextWaqf = true
    } else if (preset === 'wasl_only') {
      nextWasl = true
      nextWaqf = false
    }
    onChangeAppliesWasl(nextWasl)
    onChangeAppliesWaqf(nextWaqf)
    if (activeType) {
      onChangeRulingText(buildImalahRulingText(activeType, nextWasl, nextWaqf))
    }
  }

  function handleToggleWasl() {
    if (disabled) return
    if (appliesWasl && !appliesWaqf) return
    const nextWasl = !appliesWasl
    onChangeAppliesWasl(nextWasl)
    if (activeType) {
      onChangeRulingText(buildImalahRulingText(activeType, nextWasl, appliesWaqf))
    }
  }

  function handleToggleWaqf() {
    if (disabled) return
    if (appliesWaqf && !appliesWasl) return
    const nextWaqf = !appliesWaqf
    onChangeAppliesWaqf(nextWaqf)
    if (activeType) {
      onChangeRulingText(buildImalahRulingText(activeType, appliesWasl, nextWaqf))
    }
  }

  return (
    <div className="space-y-2.5 rounded-lg border border-fuchsia-300 dark:border-fuchsia-900 bg-fuchsia-50/60 dark:bg-fuchsia-950/20 p-2.5" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-black text-fuchsia-900 dark:text-fuchsia-200">
          <span>🔤</span>
          <span>حكم الممال والمقلل</span>
        </span>
        <span className="text-[10px] font-bold text-fuchsia-700 dark:text-fuchsia-400">
          اختر نوع الحكم ثم حالة الأداء
        </span>
      </div>

      {/* 1. Imalah / Taqlil Type: Select list and Quick Chips */}
      <div className="space-y-1.5">
        <label htmlFor="imalah-type-select" className="text-xs font-bold text-[var(--color-ink)]">
          ١. نوع الحكم (إمالة / تقليل):
        </label>
        <select
          id="imalah-type-select"
          value={activeType ?? ''}
          onChange={(e) => {
            const val = e.target.value as ImalahType
            if (val) handleSelectType(val)
          }}
          disabled={disabled}
          className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs font-bold text-[var(--color-ink)] focus:border-fuchsia-600 focus:outline-none focus:ring-1 focus:ring-fuchsia-600"
        >
          <option value="">-- اختر من القائمة: إمالة أو تقليل --</option>
          <option value="إمالة">إمالة (إمالة كبرى / إضجاع)</option>
          <option value="تقليل">تقليل (إمالة صغرى / بين بين)</option>
          <option value="إمالة وتقليل">إمالة وتقليل (أوجه الجمع / كلاهما)</option>
        </select>

        {/* Quick Segmented Chips */}
        <div className="flex gap-1.5 pt-0.5">
          {(['إمالة', 'تقليل', 'إمالة وتقليل'] as const).map((t) => {
            const isSelected = activeType === t
            return (
              <button
                key={t}
                type="button"
                onClick={() => handleSelectType(t)}
                disabled={disabled}
                className={cn(
                  'flex-1 rounded-md border px-2 py-1 text-center text-xs font-bold transition-all select-none',
                  isSelected
                    ? 'border-fuchsia-600 bg-fuchsia-600 text-white shadow-xs'
                    : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-soft)] hover:border-fuchsia-400 hover:bg-[var(--color-surface-2)]'
                )}
              >
                {isSelected ? '✓ ' : ''}{t}
              </button>
            )
          })}
        </div>
      </div>

      {/* 2. Performance state: Wasl and Waqf */}
      <div className="space-y-1.5 pt-1.5 border-t border-fuchsia-200 dark:border-fuchsia-900/60">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-[var(--color-ink)]">
            ٢. حالة الأداء (وصل / وقف):
          </label>
          <span className="text-[11px] font-bold text-fuchsia-800 dark:text-fuchsia-300">
            {appliesWasl && appliesWaqf
              ? 'وصلاً ووقفاً'
              : appliesWaqf
                ? 'عند الوقف فقط'
                : 'عند الوصل فقط'}
          </span>
        </div>

        {/* Presets */}
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => handleSetPreset('wasl_waqf')}
            disabled={disabled}
            className={cn(
              'flex-1 rounded-md border py-1 text-center text-[11px] font-bold transition-all',
              appliesWasl && appliesWaqf
                ? 'border-green-600 bg-green-50 text-green-800 shadow-2xs'
                : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-2)]'
            )}
          >
            {appliesWasl && appliesWaqf ? '✓ ' : ''}وصلاً ووقفاً
          </button>
          <button
            type="button"
            onClick={() => handleSetPreset('waqf_only')}
            disabled={disabled}
            className={cn(
              'flex-1 rounded-md border py-1 text-center text-[11px] font-bold transition-all',
              !appliesWasl && appliesWaqf
                ? 'border-green-600 bg-green-50 text-green-800 shadow-2xs'
                : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-2)]'
            )}
          >
            {!appliesWasl && appliesWaqf ? '✓ ' : ''}وقفاً فقط
          </button>
          <button
            type="button"
            onClick={() => handleSetPreset('wasl_only')}
            disabled={disabled}
            className={cn(
              'flex-1 rounded-md border py-1 text-center text-[11px] font-bold transition-all',
              appliesWasl && !appliesWaqf
                ? 'border-green-600 bg-green-50 text-green-800 shadow-2xs'
                : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-2)]'
            )}
          >
            {appliesWasl && !appliesWaqf ? '✓ ' : ''}وصلاً فقط
          </button>
        </div>

        {/* Direct Toggles */}
        <div className="flex items-center justify-between pt-0.5">
          <span className="text-[10px] text-[var(--color-ink-muted)]">تبديل مباشر:</span>
          <div className="flex gap-1.5">
            <button
              type="button"
              aria-pressed={appliesWasl}
              disabled={disabled}
              onClick={handleToggleWasl}
              className={cn(
                'rounded-md border px-2.5 py-0.5 text-[11px] font-bold transition-all',
                appliesWasl
                  ? 'border-green-600 bg-green-50 text-green-800'
                  : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-muted)]'
              )}
            >
              {appliesWasl ? '✓ ' : ''}الوصل
            </button>
            <button
              type="button"
              aria-pressed={appliesWaqf}
              disabled={disabled}
              onClick={handleToggleWaqf}
              className={cn(
                'rounded-md border px-2.5 py-0.5 text-[11px] font-bold transition-all',
                appliesWaqf
                  ? 'border-green-600 bg-green-50 text-green-800'
                  : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-muted)]'
              )}
            >
              {appliesWaqf ? '✓ ' : ''}الوقف
            </button>
          </div>
        </div>
      </div>

      {/* 3. Quick Narrator Presets */}
      {onApplyNarrators ? (
        <div className="space-y-1 pt-1.5 border-t border-fuchsia-200 dark:border-fuchsia-900/60">
          <label className="text-[10px] font-bold text-[var(--color-ink-muted)]">
            ٣. تحديد الرواة بضغطة واحدة مع ضبط الأداء:
          </label>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => onApplyNarrators('imalah')}
              disabled={disabled}
              className="flex-1 rounded border border-fuchsia-300 dark:border-fuchsia-800 bg-[var(--color-surface)] px-1.5 py-1 text-[11px] font-bold text-fuchsia-900 dark:text-fuchsia-200 hover:bg-fuchsia-100 dark:hover:bg-fuchsia-900/40 transition-colors"
            >
              + رواة الإمالة (حمزة، الكسائي، خلف)
            </button>
            <button
              type="button"
              onClick={() => onApplyNarrators('taqlil')}
              disabled={disabled}
              className="flex-1 rounded border border-fuchsia-300 dark:border-fuchsia-800 bg-[var(--color-surface)] px-1.5 py-1 text-[11px] font-bold text-fuchsia-900 dark:text-fuchsia-200 hover:bg-fuchsia-100 dark:hover:bg-fuchsia-900/40 transition-colors"
            >
              + رواة التقليل (ورش، أبو عمرو)
            </button>
            <button
              type="button"
              onClick={() => onApplyNarrators('warsh')}
              disabled={disabled}
              className="rounded border border-fuchsia-300 dark:border-fuchsia-800 bg-[var(--color-surface)] px-2 py-1 text-[11px] font-bold text-fuchsia-900 dark:text-fuchsia-200 hover:bg-fuchsia-100 dark:hover:bg-fuchsia-900/40 transition-colors"
            >
              + ورش فقط
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
