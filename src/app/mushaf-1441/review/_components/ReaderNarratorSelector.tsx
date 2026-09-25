'use client'

import { useId, useMemo, useRef, useEffect, useState } from 'react'
import type { NarratorInput } from '../_lib/types'
import { cn } from '@/lib/cn'

export interface CanonicalNarratorInfo {
  id: string
  nameAr: string
  nameShort: string
}

export interface CanonicalReaderInfo {
  id: string
  nameAr: string
  nameShort: string
  color: string
  narrators: [CanonicalNarratorInfo, CanonicalNarratorInfo]
}

export const CANONICAL_READERS: readonly CanonicalReaderInfo[] = [
  {
    id: 'Q01',
    nameAr: 'نافع المدني',
    nameShort: 'نافع',
    color: '#2563EB',
    narrators: [
      { id: 'Q01-R01', nameAr: 'قالون', nameShort: 'قالون' },
      { id: 'Q01-R02', nameAr: 'ورش', nameShort: 'ورش' },
    ],
  },
  {
    id: 'Q02',
    nameAr: 'ابن كثير المكي',
    nameShort: 'ابن كثير',
    color: '#16A34A',
    narrators: [
      { id: 'Q02-R01', nameAr: 'البزي', nameShort: 'البزي' },
      { id: 'Q02-R02', nameAr: 'قنبل', nameShort: 'قنبل' },
    ],
  },
  {
    id: 'Q03',
    nameAr: 'أبو عمرو البصري',
    nameShort: 'أبو عمرو',
    color: '#0891B2',
    narrators: [
      { id: 'Q03-R01', nameAr: 'الدوري عن أبي عمرو', nameShort: 'الدوري' },
      { id: 'Q03-R02', nameAr: 'السوسي', nameShort: 'السوسي' },
    ],
  },
  {
    id: 'Q04',
    nameAr: 'ابن عامر الشامي',
    nameShort: 'ابن عامر',
    color: '#7C3AED',
    narrators: [
      { id: 'Q04-R01', nameAr: 'هشام', nameShort: 'هشام' },
      { id: 'Q04-R02', nameAr: 'ابن ذكوان', nameShort: 'ابن ذكوان' },
    ],
  },
  {
    id: 'Q05',
    nameAr: 'عاصم الكوفي',
    nameShort: 'عاصم',
    color: '#EA580C',
    narrators: [
      { id: 'Q05-R01', nameAr: 'شعبة', nameShort: 'شعبة' },
      { id: 'Q05-R02', nameAr: 'حفص', nameShort: 'حفص' },
    ],
  },
  {
    id: 'Q06',
    nameAr: 'حمزة الكوفي',
    nameShort: 'حمزة',
    color: '#DC2626',
    narrators: [
      { id: 'Q06-R01', nameAr: 'خلف عن حمزة', nameShort: 'خلف' },
      { id: 'Q06-R02', nameAr: 'خلاد', nameShort: 'خلاد' },
    ],
  },
  {
    id: 'Q07',
    nameAr: 'الكسائي الكوفي',
    nameShort: 'الكسائي',
    color: '#DB2777',
    narrators: [
      { id: 'Q07-R01', nameAr: 'أبو الحارث', nameShort: 'أبو الحارث' },
      { id: 'Q07-R02', nameAr: 'الدوري عن الكسائي', nameShort: 'الدوري' },
    ],
  },
  {
    id: 'Q08',
    nameAr: 'أبو جعفر المدني',
    nameShort: 'أبو جعفر',
    color: '#CA8A04',
    narrators: [
      { id: 'Q08-R01', nameAr: 'ابن وردان', nameShort: 'ابن وردان' },
      { id: 'Q08-R02', nameAr: 'ابن جماز', nameShort: 'ابن جماز' },
    ],
  },
  {
    id: 'Q09',
    nameAr: 'يعقوب الحضرمي',
    nameShort: 'يعقوب',
    color: '#B45309',
    narrators: [
      { id: 'Q09-R01', nameAr: 'رويس', nameShort: 'رويس' },
      { id: 'Q09-R02', nameAr: 'روح', nameShort: 'روح' },
    ],
  },
  {
    id: 'Q10',
    nameAr: 'خلف العاشر',
    nameShort: 'خلف العاشر',
    color: '#475569',
    narrators: [
      { id: 'Q10-R01', nameAr: 'إسحاق', nameShort: 'إسحاق' },
      { id: 'Q10-R02', nameAr: 'إدريس', nameShort: 'إدريس' },
    ],
  },
]

export const HAFS_ID = 'Q05-R02'
const ALL_NARRATOR_IDS = CANONICAL_READERS.flatMap((r) => r.narrators.map((n) => n.id))

type Props = {
  narrators: NarratorInput[]
  onChange(narrators: NarratorInput[]): void
  disabled?: boolean
}

function IndeterminateCheckbox({
  checked,
  indeterminate,
  onChange,
  disabled,
  ariaLabel,
}: {
  checked: boolean
  indeterminate: boolean
  onChange: () => void
  disabled?: boolean
  ariaLabel: string
}) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate
    }
  }, [indeterminate])

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      aria-label={ariaLabel}
      className="h-4 w-4 cursor-pointer rounded border-[var(--color-border)] text-[var(--color-primary)] accent-[var(--color-primary)] focus:ring-[var(--color-primary)]"
    />
  )
}

export default function ReaderNarratorSelector({ narrators, onChange, disabled }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  const narratorFacesMap = useMemo(() => {
    const map = new Map<string, NarratorInput[]>()
    for (const item of narrators) {
      if (!item.id) continue
      const list = map.get(item.id) ?? []
      list.push(item)
      map.set(item.id, list)
    }
    return map
  }, [narrators])

  const selectedCount = narratorFacesMap.size
  const hafsEntry = (narratorFacesMap.get(HAFS_ID) ?? [])[0]

  function toggleNarrator(id: string) {
    if (disabled) return
    const existing = narratorFacesMap.get(id) ?? []
    if (existing.length > 0) {
      // Remove all faces for this narrator
      onChange(narrators.filter((n) => n.id !== id))
    } else {
      const isHafs = id === HAFS_ID
      onChange([
        ...narrators,
        {
          id,
          action: null,
          wajhOrder: isHafs ? 2 : 1,
          wajhNote: isHafs ? 'وجه ثانٍ لحفص' : null,
        },
      ])
    }
  }

  function toggleReader(reader: CanonicalReaderInfo) {
    if (disabled) return
    const [n1, n2] = reader.narrators
    const hasN1 = (narratorFacesMap.get(n1.id)?.length ?? 0) > 0
    const hasN2 = (narratorFacesMap.get(n2.id)?.length ?? 0) > 0
    const bothSelected = hasN1 && hasN2

    if (bothSelected) {
      // Remove both
      onChange(narrators.filter((n) => n.id !== n1.id && n.id !== n2.id))
    } else {
      // Add missing ones
      const next = [...narrators]
      if (!hasN1) {
        next.push({ id: n1.id, wajhOrder: 1, action: null, wajhNote: null })
      }
      if (!hasN2) {
        const isHafs = n2.id === HAFS_ID
        next.push({
          id: n2.id,
          action: null,
          wajhOrder: isHafs ? 2 : 1,
          wajhNote: isHafs ? 'وجه ثانٍ لحفص' : null,
        })
      }
      onChange(next)
    }
  }

  function selectSpecificList(ids: string[]) {
    if (disabled) return
    const idSet = new Set(ids)
    // Keep existing items if in ids, add missing
    const next: NarratorInput[] = []
    for (const item of narrators) {
      if (idSet.has(item.id)) next.push(item)
    }
    for (const id of ids) {
      if (!next.some((n) => n.id === id)) {
        const isHafs = id === HAFS_ID
        next.push({
          id,
          action: null,
          wajhOrder: isHafs ? 2 : 1,
          wajhNote: isHafs ? 'وجه ثانٍ لحفص' : null,
        })
      }
    }
    onChange(next)
  }

  function selectAll() {
    selectSpecificList(ALL_NARRATOR_IDS)
  }

  function clearAll() {
    if (disabled) return
    onChange([])
  }

  function selectSabah() {
    const sabahIds = CANONICAL_READERS.slice(0, 7).flatMap((r) => r.narrators.map((n) => n.id))
    selectSpecificList(sabahIds)
  }

  function selectThalatha() {
    const thalathaIds = CANONICAL_READERS.slice(7).flatMap((r) => r.narrators.map((n) => n.id))
    selectSpecificList(thalathaIds)
  }

  function selectKufis() {
    const kufiReaders = ['Q05', 'Q06', 'Q07', 'Q10']
    const ids = CANONICAL_READERS.filter((r) => kufiReaders.includes(r.id)).flatMap((r) =>
      r.narrators.map((n) => n.id)
    )
    selectSpecificList(ids)
  }

  function selectMadaniyan() {
    const madaniReaders = ['Q01', 'Q08']
    const ids = CANONICAL_READERS.filter((r) => madaniReaders.includes(r.id)).flatMap((r) =>
      r.narrators.map((n) => n.id)
    )
    selectSpecificList(ids)
  }

  function updateNarratorField(id: string, patch: Partial<NarratorInput>) {
    const next = narrators.map((n) => (n.id === id ? { ...n, ...patch } : n))
    onChange(next)
  }

  function updateFaceAt(index: number, patch: Partial<NarratorInput>) {
    onChange(narrators.map((n, i) => (i === index ? { ...n, ...patch } : n)))
  }

  return (
    <div className="space-y-3" dir="rtl">
      {/* Quick selection toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-[var(--color-border-soft)] pb-2">
        <div className="flex items-center gap-1">
          <span className="text-xs font-bold text-[var(--color-ink)]">
            نسبة القراءة ({selectedCount}/20):
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1 text-[11px]">
          <button
            type="button"
            onClick={selectAll}
            disabled={disabled || selectedCount === 20}
            className="rounded border border-[var(--color-border)] px-1.5 py-0.5 font-bold hover:bg-[var(--color-surface-2)] disabled:opacity-40"
          >
            الكل (عشرة)
          </button>
          <button
            type="button"
            onClick={selectSabah}
            disabled={disabled}
            className="rounded border border-[var(--color-border)] px-1.5 py-0.5 font-bold hover:bg-[var(--color-surface-2)] disabled:opacity-40"
          >
            السبعة
          </button>
          <button
            type="button"
            onClick={selectThalatha}
            disabled={disabled}
            className="rounded border border-[var(--color-border)] px-1.5 py-0.5 font-bold hover:bg-[var(--color-surface-2)] disabled:opacity-40"
          >
            الثلاثة
          </button>
          <button
            type="button"
            onClick={selectKufis}
            disabled={disabled}
            className="rounded border border-[var(--color-border)] px-1.5 py-0.5 font-bold hover:bg-[var(--color-surface-2)] disabled:opacity-40"
          >
            الكوفيون
          </button>
          <button
            type="button"
            onClick={selectMadaniyan}
            disabled={disabled}
            className="rounded border border-[var(--color-border)] px-1.5 py-0.5 font-bold hover:bg-[var(--color-surface-2)] disabled:opacity-40"
          >
            المدنيان
          </button>
          {selectedCount > 0 ? (
            <button
              type="button"
              onClick={clearAll}
              disabled={disabled}
              className="rounded border border-[var(--color-danger)]/30 px-1.5 py-0.5 font-bold text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]"
            >
              مسح
            </button>
          ) : null}
        </div>
      </div>

      {/* Readers and Narrators Grid */}
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {CANONICAL_READERS.map((reader) => {
          const [n1, n2] = reader.narrators
          const s1 = narratorFacesMap.has(n1.id)
          const s2 = narratorFacesMap.has(n2.id)
          const both = s1 && s2
          const indeterminate = (s1 || s2) && !both

          return (
            <div
              key={reader.id}
              className={cn(
                'rounded-lg border p-1.5 transition-colors',
                both
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]/20'
                  : indeterminate
                    ? 'border-[var(--color-border)] bg-[var(--color-surface-2)]/60'
                    : 'border-[var(--color-border-soft)] bg-[var(--color-surface)]'
              )}
            >
              {/* Reader Header with Toggle */}
              <div className="flex items-center justify-between gap-1 pb-1">
                <label className="flex cursor-pointer items-center gap-1.5 select-none">
                  <IndeterminateCheckbox
                    checked={both}
                    indeterminate={indeterminate}
                    onChange={() => toggleReader(reader)}
                    disabled={disabled}
                    ariaLabel={`اختيار راويي ${reader.nameAr}`}
                  />
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: reader.color }}
                    aria-hidden="true"
                  />
                  <span className="text-xs font-bold text-[var(--color-ink)]">
                    {reader.nameAr}
                  </span>
                </label>
              </div>

              {/* Narrator Chips */}
              <div className="flex items-center gap-1">
                {reader.narrators.map((narrator) => {
                  const isSelected = narratorFacesMap.has(narrator.id)
                  return (
                    <button
                      key={narrator.id}
                      type="button"
                      onClick={() => toggleNarrator(narrator.id)}
                      disabled={disabled}
                      aria-pressed={isSelected}
                      className={cn(
                        'flex flex-1 items-center justify-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium transition-all select-none',
                        isSelected
                          ? 'border border-[var(--color-primary)] bg-[var(--color-primary)] font-bold text-white shadow-xs'
                          : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-soft)] hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-surface-2)]'
                      )}
                    >
                      <span className="text-[10px]">{isSelected ? '✓' : ''}</span>
                      <span>{narrator.nameShort}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Hafs Rule D8 Special Guard */}
      {hafsEntry ? (
        <div className="rounded-lg border border-[var(--color-warn)] bg-[var(--color-warn-bg)]/50 p-2.5 text-xs text-[var(--color-ink)]">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-[var(--color-warn)]">
              ⚠️ قاعدة د٨ (حفص هو الأصل):
            </span>
            <span className="text-[11px] text-[var(--color-ink-muted)]">
              يلزم وجه ثانٍ وملاحظة
            </span>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className="text-[10px] font-bold text-[var(--color-ink-muted)]">
                رقم الوجه لحفص:
              </label>
              <div className="mt-0.5 flex gap-1">
                {[2, 3, 4].map((order) => (
                  <button
                    key={order}
                    type="button"
                    onClick={() => updateNarratorField(HAFS_ID, { wajhOrder: order })}
                    className={cn(
                      'flex-1 rounded border py-0.5 text-xs font-bold',
                      hafsEntry.wajhOrder === order
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                        : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)]'
                    )}
                  >
                    وجه {order}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-[var(--color-ink-muted)]">
                ملاحظة الوجه (مطلوبة):
              </label>
              <input
                type="text"
                value={hafsEntry.wajhNote ?? ''}
                onChange={(e) => updateNarratorField(HAFS_ID, { wajhNote: e.target.value })}
                placeholder="مثال: بخلف عنه، أو وجه التوسط"
                className="mt-0.5 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-xs"
              />
            </div>
          </div>
        </div>
      ) : null}

      {/* Advanced Details Toggle (for action text / wajh notes for other narrators) */}
      {selectedCount > 0 ? (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-[11px] font-bold text-[var(--color-primary)] hover:underline"
          >
            {showAdvanced ? '− إخفاء تفاصيل الأداء والأوجه' : '+ تفاصيل الأداء والأوجه للرواة المحددين'}
          </button>

          {showAdvanced ? (
            <div className="mt-2 space-y-2 rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-2)]/30 p-2">
              {narrators.map((item, index) => {
                const reader = CANONICAL_READERS.find((r) =>
                  r.narrators.some((n) => n.id === item.id)
                )
                const narratorInfo = reader?.narrators.find((n) => n.id === item.id)
                return (
                  <div
                    key={`${item.id}-${index}`}
                    className="flex flex-wrap items-center gap-2 rounded border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-1.5 text-xs"
                  >
                    <span className="min-w-16 font-bold text-[var(--color-ink)]">
                      {narratorInfo?.nameAr ?? item.id}:
                    </span>
                    <label className="flex items-center gap-1 text-[11px] text-[var(--color-ink-muted)]">
                      <span>الوجه:</span>
                      <input
                        type="number"
                        min={item.id === HAFS_ID ? 2 : 1}
                        max={5}
                        value={item.wajhOrder ?? 1}
                        onChange={(e) =>
                          updateFaceAt(index, {
                            wajhOrder: Math.max(item.id === HAFS_ID ? 2 : 1, Number(e.target.value)),
                          })
                        }
                        className="w-12 rounded border border-[var(--color-border)] px-1 py-0.5 text-center"
                      />
                    </label>
                    <label className="flex flex-1 items-center gap-1 text-[11px] text-[var(--color-ink-muted)]">
                      <span>الأداء:</span>
                      <input
                        type="text"
                        value={item.action ?? ''}
                        onChange={(e) => updateFaceAt(index, { action: e.target.value })}
                        placeholder="نص الأداء (اختياري)"
                        className="flex-1 rounded border border-[var(--color-border)] px-1.5 py-0.5"
                      />
                    </label>
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
