'use client'

import { useEffect, useMemo } from 'react'
import { cn } from '@/lib/cn'

export type SubCategoryOption = { categoryCode: string; labelAr: string }

type Props = {
  categoryCode: string | null
  options: readonly SubCategoryOption[] | undefined
  value: string | null
  onChange(value: string | null): void
  disabled?: boolean
}

/** The closed list of التصنيف الفرعي for the chosen باب (single choice; click the chosen one again to clear it). */
export default function SubCategoryChips({ categoryCode, options, value, onChange, disabled }: Props) {
  const list = useMemo(
    () => (categoryCode ? (options ?? []).filter((o) => o.categoryCode === categoryCode) : []),
    [categoryCode, options],
  )

  // A label that belongs to another باب (the reviewer changed the باب) is dropped, never sent.
  useEffect(() => {
    if (value && list.length > 0 && !list.some((o) => o.labelAr === value)) onChange(null)
  }, [value, list, onChange])

  if (!categoryCode || list.length === 0) return null

  return (
    <div className="space-y-1" data-subcategory-chips>
      <label className="text-[11px] font-bold text-[var(--color-ink)]">التصنيف الفرعي:</label>
      <div className="flex flex-wrap gap-1">
        {list.map((o) => {
          const selected = value === o.labelAr
          return (
            <button
              key={o.labelAr}
              type="button"
              disabled={disabled}
              onClick={() => onChange(selected ? null : o.labelAr)}
              className={cn(
                'rounded px-2 py-0.5 text-[11px] font-medium transition-all select-none',
                selected
                  ? 'border border-[var(--color-primary)] bg-[var(--color-primary)] font-bold text-white shadow-xs'
                  : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-soft)] hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-surface-2)]',
              )}
            >
              {o.labelAr}
            </button>
          )
        })}
      </div>
      {!value ? <p className="text-[11px] font-bold text-amber-700">بلا تصنيف فرعي — اختر</p> : null}
    </div>
  )
}
