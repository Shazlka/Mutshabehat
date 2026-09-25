'use client'

// Comprehensive Imalah & Taqlil workstation for the الممال والمقلل Usul chapter
// (categoryCode: IMALAH_TAQLIL).
// Enables reviewers to:
//   1. Select any reader individually, any narrator individually, or multiple readers/narrators.
//   2. Choose between إمالة (Imalah), تقليل (Taqlil), or فتح (Fath).
//   3. Choose performance applicability: وصلاً, وقفاً, or وصلاً ووقفاً معاً.
//   4. Choose whether it is بخلف عنه (alternative face) or قولاً واحداً (definitive).
//   5. Add the configured face to "تفاصيل الأداء والأوجه للرواة المحددين".
//   6. Add multiple faces (أوجه متعددة) for the SAME reader/narrator (e.g. وقفا بخلف عنه ووصلا بخلف عنه).
//   7. Manage, edit, and delete individual faces with live synchronization to database entries.

import { useState, useMemo } from 'react'
import type { NarratorInput } from '../_lib/types'
import { CANONICAL_READERS, HAFS_ID, type CanonicalReaderInfo } from './ReaderNarratorSelector'
import { cn } from '@/lib/cn'

export type ImalahType = 'إمالة' | 'تقليل' | 'فتح' | 'إمالة وتقليل'
export type PerformanceOption = 'wasl_waqf' | 'waqf_only' | 'wasl_only'
export type KhulfOption = 'qawlan_wahidan' | 'bikhulf'

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
  type: 'إمالة' | 'تقليل' | 'إمالة وتقليل',
  wasl: boolean,
  waqf: boolean
): string {
  const perfText = wasl && waqf ? 'وصلاً ووقفاً' : waqf ? 'عند الوقف' : 'عند الوصل'
  return `${type} الألف ${perfText}`
}

export function buildFaceActionText(
  type: ImalahType,
  performance: PerformanceOption,
  khulf: KhulfOption
): string {
  const perfText =
    performance === 'wasl_waqf'
      ? 'وصلاً ووقفاً'
      : performance === 'waqf_only'
        ? 'وقفاً'
        : 'وصلاً'
  const khulfText = khulf === 'bikhulf' ? ' (بخلف عنه)' : ''
  return `${type} ${perfText}${khulfText}`
}

export function detectImalahType(rulingText: string | null): ImalahType | null {
  if (!rulingText) return null
  const text = rulingText.trim()
  if (text.includes('إمالة') && text.includes('تقليل')) return 'إمالة وتقليل'
  if (text.includes('تقليل')) return 'تقليل'
  if (text.includes('إمالة')) return 'إمالة'
  if (text.includes('فتح')) return 'فتح'
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
  narrators?: NarratorInput[]
  onChangeNarrators?(narrators: NarratorInput[]): void
  disabled?: boolean
}

export default function ImalahDetailFields(props: ImalahDetailFieldsProps) {
  if (!isImalahCategory(props.categoryCode)) return null
  return <ImalahFacesBuilder {...props} />
}

// Next wajh number for a narrator: after its highest existing wajh. Hafs (D8) never takes wajh 1.
export function nextWajhOrder(narrators: readonly NarratorInput[], id: string): number {
  const max = narrators.reduce((m, n) => (n.id === id ? Math.max(m, n.wajhOrder ?? 1) : m), 0)
  return Math.max(max + 1, id === HAFS_ID ? 2 : 1)
}

function ImalahFacesBuilder({
  rulingText,
  onChangeRulingText,
  onChangeAppliesWasl,
  onChangeAppliesWaqf,
  narrators = [],
  onChangeNarrators,
  disabled,
}: ImalahDetailFieldsProps) {

  // Selection mode: by readers, by individual narrators, or famous presets
  const [selectorTab, setSelectorTab] = useState<'presets' | 'readers' | 'narrators'>('presets')
  const [selectedNarratorIds, setSelectedNarratorIds] = useState<Set<string>>(new Set())

  // Face configuration
  const [faceType, setFaceType] = useState<ImalahType>('إمالة')
  const [facePerformance, setFacePerformance] = useState<PerformanceOption>('wasl_waqf')
  const [faceKhulf, setFaceKhulf] = useState<KhulfOption>('qawlan_wahidan')
  const [customActionText, setCustomActionText] = useState('')
  const [addedMessage, setAddedMessage] = useState<string | null>(null)

  // Computed preview of face action
  const computedAction = useMemo(() => {
    if (customActionText.trim()) return customActionText.trim()
    return buildFaceActionText(faceType, facePerformance, faceKhulf)
  }, [faceType, facePerformance, faceKhulf, customActionText])

  // Map narrators to their existing faces count
  const narratorFacesCount = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of narrators) {
      if (item.id) map.set(item.id, (map.get(item.id) ?? 0) + 1)
    }
    return map
  }, [narrators])

  // Toggle selection helpers
  function toggleNarratorId(id: string) {
    if (disabled) return
    setSelectedNarratorIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleReader(reader: CanonicalReaderInfo) {
    if (disabled) return
    const [n1, n2] = reader.narrators
    const bothSelected = selectedNarratorIds.has(n1.id) && selectedNarratorIds.has(n2.id)
    setSelectedNarratorIds((prev) => {
      const next = new Set(prev)
      if (bothSelected) {
        next.delete(n1.id)
        next.delete(n2.id)
      } else {
        next.add(n1.id)
        next.add(n2.id)
      }
      return next
    })
  }

  function selectPresetGroup(ids: readonly string[]) {
    if (disabled) return
    setSelectedNarratorIds(new Set(ids))
  }

  function selectAllNarrators() {
    if (disabled) return
    const allIds = CANONICAL_READERS.flatMap((r) => r.narrators.map((n) => n.id))
    setSelectedNarratorIds(new Set(allIds))
  }

  function clearSelection() {
    if (disabled) return
    setSelectedNarratorIds(new Set())
  }

  // Add the configured face to selected narrators
  function handleAddConfiguredFace() {
    if (disabled || !onChangeNarrators || selectedNarratorIds.size === 0) return

    const currentNarrators = [...narrators]
    const ids = Array.from(selectedNarratorIds)

    for (const id of ids) {
      const existingFaces = currentNarrators.filter((n) => n.id === id)
      const wajhOrder = nextWajhOrder(currentNarrators, id)

      // Disambiguate action if the same narrator already has the identical action text
      let finalAction = computedAction
      if (existingFaces.some((f) => (f.action ?? '').trim() === finalAction.trim())) {
        finalAction = `${finalAction} (وجه ${wajhOrder})`
      }

      const wajhNote =
        (faceKhulf === 'bikhulf'
          ? 'بخلف عنه'
          : facePerformance === 'waqf_only'
            ? 'عند الوقف'
            : facePerformance === 'wasl_only'
              ? 'عند الوصل'
              : null) ?? (id === HAFS_ID ? 'وجه ثانٍ لحفص' : null)

      currentNarrators.push({
        id,
        action: finalAction,
        wajhOrder,
        wajhNote,
      })
    }

    onChangeNarrators(currentNarrators)

    // Sync Wasl and Waqf applicability if face performance specifies it
    if (facePerformance === 'waqf_only') {
      onChangeAppliesWasl(false)
      onChangeAppliesWaqf(true)
    } else if (facePerformance === 'wasl_only') {
      onChangeAppliesWasl(true)
      onChangeAppliesWaqf(false)
    } else {
      onChangeAppliesWasl(true)
      onChangeAppliesWaqf(true)
    }

    // Auto update rulingText if empty or matching default
    if (!rulingText || rulingText.trim() === '' || rulingText.includes('إمالة') || rulingText.includes('تقليل')) {
      if (faceType === 'إمالة' || faceType === 'تقليل' || faceType === 'إمالة وتقليل') {
        const perf = facePerformance === 'waqf_only' ? false : true
        const waqf = facePerformance === 'wasl_only' ? false : true
        onChangeRulingText(buildImalahRulingText(faceType, perf, waqf))
      }
    }

    setAddedMessage(`تمت إضافة الوجه لـ (${ids.length}) رواة بنجاح ✓`)
    setTimeout(() => setAddedMessage(null), 4000)
  }

  // Add another face specifically for a narrator from the live list
  function handleAddAnotherFaceForNarrator(narratorId: string) {
    if (disabled || !onChangeNarrators) return
    const nextOrder = nextWajhOrder(narrators, narratorId)
    const nextAction = `وجه ${nextOrder} (بخلف عنه)`

    const next = [
      ...narrators,
      {
        id: narratorId,
        action: nextAction,
        wajhOrder: nextOrder,
        wajhNote: 'بخلف عنه',
      },
    ]
    onChangeNarrators(next)
  }

  // Update a face at a specific index
  function handleUpdateFaceAtIndex(index: number, patch: Partial<NarratorInput>) {
    if (disabled || !onChangeNarrators) return
    const next = narrators.map((n, i) => (i === index ? { ...n, ...patch } : n))
    onChangeNarrators(next)
  }

  // Remove a face at a specific index
  function handleRemoveFaceAtIndex(index: number) {
    if (disabled || !onChangeNarrators) return
    const next = narrators.filter((_, i) => i !== index)
    onChangeNarrators(next)
  }

  return (
    <div className="space-y-3 rounded-xl border border-fuchsia-300 dark:border-fuchsia-900 bg-fuchsia-50/60 dark:bg-fuchsia-950/20 p-3 shadow-xs" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-fuchsia-200 dark:border-fuchsia-900/60 pb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-base">🔤</span>
          <span className="text-xs font-black text-fuchsia-900 dark:text-fuchsia-100">
            مُنشئ أوجه الممال والمقلل وتفاصيل الأداء
          </span>
        </div>
        <span className="rounded-full bg-fuchsia-200/70 dark:bg-fuchsia-900/60 px-2 py-0.5 text-[10px] font-bold text-fuchsia-900 dark:text-fuchsia-200">
          أصول القراءات
        </span>
      </div>

      {/* STEP 1: Select Readers / Narrators */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-bold text-[var(--color-ink)]">
            ١. اختر القراء أو الرواة المستهدفين:
          </label>
          <div className="flex items-center gap-1 text-[11px]">
            <span className="font-bold text-fuchsia-800 dark:text-fuchsia-300">
              المحدد: {selectedNarratorIds.size}/20 راوٍ
            </span>
            <button
              type="button"
              onClick={selectAllNarrators}
              disabled={disabled || selectedNarratorIds.size === 20}
              className="rounded border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] font-bold hover:bg-[var(--color-surface-2)] disabled:opacity-40"
            >
              الكل
            </button>
            <button
              type="button"
              onClick={clearSelection}
              disabled={disabled || selectedNarratorIds.size === 0}
              className="rounded border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] font-bold hover:bg-[var(--color-surface-2)] disabled:opacity-40 text-red-600"
            >
              مسح
            </button>
          </div>
        </div>

        {/* Selector mode tabs */}
        <div className="flex rounded-lg border border-fuchsia-200 dark:border-fuchsia-900 bg-[var(--color-surface)] p-0.5 text-[11px] font-bold">
          <button
            type="button"
            onClick={() => setSelectorTab('presets')}
            className={cn(
              'flex-1 rounded-md py-1 transition-all text-center',
              selectorTab === 'presets'
                ? 'bg-fuchsia-600 text-white shadow-2xs'
                : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
            )}
          >
            مجموعات جاهزة سريعة
          </button>
          <button
            type="button"
            onClick={() => setSelectorTab('readers')}
            className={cn(
              'flex-1 rounded-md py-1 transition-all text-center',
              selectorTab === 'readers'
                ? 'bg-fuchsia-600 text-white shadow-2xs'
                : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
            )}
          >
            حسب القراء (العشرة)
          </button>
          <button
            type="button"
            onClick={() => setSelectorTab('narrators')}
            className={cn(
              'flex-1 rounded-md py-1 transition-all text-center',
              selectorTab === 'narrators'
                ? 'bg-fuchsia-600 text-white shadow-2xs'
                : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
            )}
          >
            حسب الرواة (العشرون)
          </button>
        </div>

        {/* Tab 1: Presets */}
        {selectorTab === 'presets' ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => selectPresetGroup(IMALAH_NARRATOR_IDS)}
              disabled={disabled}
              className="rounded-md border border-fuchsia-400 bg-fuchsia-100/70 dark:bg-fuchsia-900/40 px-2 py-1 text-xs font-bold text-fuchsia-950 dark:text-fuchsia-100 hover:bg-fuchsia-200 transition-colors"
            >
              + أهل الإمالة (حمزة، الكسائي، خلف العاشر)
            </button>
            <button
              type="button"
              onClick={() => selectPresetGroup(TAQLIL_NARRATOR_IDS)}
              disabled={disabled}
              className="rounded-md border border-fuchsia-400 bg-fuchsia-100/70 dark:bg-fuchsia-900/40 px-2 py-1 text-xs font-bold text-fuchsia-950 dark:text-fuchsia-100 hover:bg-fuchsia-200 transition-colors"
            >
              + أهل التقليل (ورش، أبو عمرو)
            </button>
            <button
              type="button"
              onClick={() => selectPresetGroup([WARSH_NARRATOR_ID])}
              disabled={disabled}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs font-bold hover:bg-[var(--color-surface-2)]"
            >
              + ورش فقط
            </button>
            <button
              type="button"
              onClick={() => selectPresetGroup(['Q06-R01', 'Q06-R02', 'Q07-R01', 'Q07-R02'])}
              disabled={disabled}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs font-bold hover:bg-[var(--color-surface-2)]"
            >
              + الأخوان (حمزة والكسائي)
            </button>
            <button
              type="button"
              onClick={() => selectPresetGroup(['Q03-R01', 'Q03-R02'])}
              disabled={disabled}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs font-bold hover:bg-[var(--color-surface-2)]"
            >
              + أبو عمرو البصري
            </button>
          </div>
        ) : null}

        {/* Tab 2: Readers (10 Readers) */}
        {selectorTab === 'readers' ? (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 pt-1">
            {CANONICAL_READERS.map((reader) => {
              const [n1, n2] = reader.narrators
              const bothSelected = selectedNarratorIds.has(n1.id) && selectedNarratorIds.has(n2.id)
              const partiallySelected = (selectedNarratorIds.has(n1.id) || selectedNarratorIds.has(n2.id)) && !bothSelected
              return (
                <button
                  key={reader.id}
                  type="button"
                  onClick={() => toggleReader(reader)}
                  disabled={disabled}
                  className={cn(
                    'flex flex-col items-center justify-center rounded-lg border p-1.5 text-center text-xs font-bold transition-all select-none',
                    bothSelected
                      ? 'border-fuchsia-600 bg-fuchsia-600 text-white shadow-xs'
                      : partiallySelected
                        ? 'border-fuchsia-400 bg-fuchsia-100 text-fuchsia-950 dark:bg-fuchsia-950/60 dark:text-fuchsia-200'
                        : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:border-fuchsia-400 hover:bg-[var(--color-surface-2)]'
                  )}
                >
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: reader.color }} />
                    <span>{reader.nameShort}</span>
                    {bothSelected ? <span>✓</span> : partiallySelected ? <span>~</span> : null}
                  </span>
                  <span className="text-[10px] opacity-75">
                    {reader.narrators.map((n) => n.nameShort).join(' / ')}
                  </span>
                </button>
              )
            })}
          </div>
        ) : null}

        {/* Tab 3: Individual Narrators (20 Narrators) */}
        {selectorTab === 'narrators' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto p-1 rounded-md border border-fuchsia-200 dark:border-fuchsia-900 bg-[var(--color-surface)]">
            {CANONICAL_READERS.map((reader) =>
              reader.narrators.map((n) => {
                const isSelected = selectedNarratorIds.has(n.id)
                const existingCount = narratorFacesCount.get(n.id) ?? 0
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => toggleNarratorId(n.id)}
                    disabled={disabled}
                    className={cn(
                      'flex items-center justify-between gap-1 rounded-md px-2 py-1 text-right text-xs font-bold transition-all select-none',
                      isSelected
                        ? 'border border-fuchsia-600 bg-fuchsia-600 text-white shadow-2xs'
                        : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:border-fuchsia-400 hover:bg-[var(--color-surface-2)]'
                    )}
                  >
                    <span className="whitespace-nowrap">{n.nameShort}</span>
                    <div className="flex items-center gap-1 text-[10px]">
                      {existingCount > 0 ? (
                        <span className={cn('rounded px-1 py-0.2', isSelected ? 'bg-fuchsia-800 text-white' : 'bg-amber-100 text-amber-900')}>
                          {existingCount} وجه
                        </span>
                      ) : null}
                      <span>{isSelected ? '✓' : ''}</span>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        ) : null}
      </div>

      {/* STEP 2: Configure Face Details (Action, Performance, Khulf) */}
      <div className="space-y-2 border-t border-fuchsia-200 dark:border-fuchsia-900/60 pt-2.5">
        <label className="text-xs font-bold text-[var(--color-ink)]">
          ٢. حدد صيغة الوجه المراد إضافته (نوع الحكم والأداء والخلاف):
        </label>

        {/* 2a. Action type */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold text-[var(--color-ink-muted)] min-w-16">الحكم:</span>
          {(['إمالة', 'تقليل', 'فتح', 'إمالة وتقليل'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setFaceType(t)
                setCustomActionText('')
              }}
              disabled={disabled}
              className={cn(
                'rounded-md border px-2.5 py-1 text-xs font-bold transition-all',
                faceType === t && !customActionText
                  ? 'border-fuchsia-600 bg-fuchsia-600 text-white shadow-xs'
                  : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:border-fuchsia-400'
              )}
            >
              {faceType === t && !customActionText ? '✓ ' : ''}{t}
            </button>
          ))}
        </div>

        {/* 2b. Performance condition (وصل / وقف / كلاهما) */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold text-[var(--color-ink-muted)] min-w-16">الأداء:</span>
          {[
            { id: 'wasl_waqf', label: 'وصلاً ووقفاً' },
            { id: 'waqf_only', label: 'عند الوقف فقط' },
            { id: 'wasl_only', label: 'عند الوصل فقط' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setFacePerformance(item.id as PerformanceOption)
                setCustomActionText('')
              }}
              disabled={disabled}
              className={cn(
                'rounded-md border px-2.5 py-1 text-xs font-bold transition-all',
                facePerformance === item.id && !customActionText
                  ? 'border-green-600 bg-green-50 text-green-800 shadow-2xs dark:bg-green-950/40 dark:text-green-300'
                  : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-2)]'
              )}
            >
              {facePerformance === item.id && !customActionText ? '✓ ' : ''}{item.label}
            </button>
          ))}
        </div>

        {/* 2c. Khulf option */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold text-[var(--color-ink-muted)] min-w-16">الخلاف:</span>
          {[
            { id: 'qawlan_wahidan', label: 'قولاً واحداً (الأصل)' },
            { id: 'bikhulf', label: 'بخلف عنه (ذو وجهين)' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setFaceKhulf(item.id as KhulfOption)
                setCustomActionText('')
              }}
              disabled={disabled}
              className={cn(
                'rounded-md border px-2.5 py-1 text-xs font-bold transition-all',
                faceKhulf === item.id && !customActionText
                  ? 'border-amber-600 bg-amber-50 text-amber-800 shadow-2xs dark:bg-amber-950/40 dark:text-amber-300'
                  : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-2)]'
              )}
            >
              {faceKhulf === item.id && !customActionText ? '✓ ' : ''}{item.label}
            </button>
          ))}
        </div>

        {/* Live action text preview and custom edit */}
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold text-[var(--color-ink-muted)]">
              صيغة الأداء الناتجة للوجه (قابلة للتعديل):
            </span>
            {customActionText ? (
              <button
                type="button"
                onClick={() => setCustomActionText('')}
                className="text-[10px] font-bold text-fuchsia-600 hover:underline"
              >
                استعادة التوليد التلقائي ⟳
              </button>
            ) : null}
          </div>
          <input
            type="text"
            value={computedAction}
            onChange={(e) => setCustomActionText(e.target.value)}
            disabled={disabled}
            className="mt-1 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-xs font-bold text-fuchsia-950 dark:text-fuchsia-100"
            placeholder="نص الأداء..."
          />
        </div>
      </div>

      {/* STEP 3: Add Face Action Button */}
      <div className="pt-1">
        <button
          type="button"
          onClick={handleAddConfiguredFace}
          disabled={disabled || selectedNarratorIds.size === 0}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-fuchsia-600 bg-fuchsia-600 px-3 py-2 text-center text-xs font-black text-white shadow-xs hover:bg-fuchsia-700 disabled:opacity-50 transition-all select-none"
        >
          <span>➕</span>
          <span>
            إضافة هذا الوجه ({computedAction}) إلى الرواة المحددين ({selectedNarratorIds.size})
          </span>
        </button>

        {addedMessage ? (
          <p className="mt-1.5 text-center text-xs font-bold text-green-700 dark:text-green-400 animate-fade-in">
            {addedMessage}
          </p>
        ) : null}
      </div>

      {/* STEP 4: Live Faces Manager (All configured faces for this entry) */}
      <div className="border-t border-fuchsia-200 dark:border-fuchsia-900/60 pt-2.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-bold text-[var(--color-ink)]">
            ٣. تفاصيل الأداء والأوجه المسجلة حالياً ({narrators.length} وجهاً):
          </label>
          <span className="text-[11px] text-[var(--color-ink-muted)]">
            يمكنك إضافة وجه آخر لنفس القارئ أو تعديل أي وجه
          </span>
        </div>

        {narrators.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--color-border)] p-3 text-center text-xs text-[var(--color-ink-muted)]">
            لم يُضف أي وجه بعد. اختر الرواة من الأعلى ثم اضغط على زر الإضافة أعلاه.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto p-1 rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)]">
            {narrators.map((face, index) => {
              const reader = CANONICAL_READERS.find((r) =>
                r.narrators.some((n) => n.id === face.id)
              )
              const narratorInfo = reader?.narrators.find((n) => n.id === face.id)
              return (
                <div
                  key={`${face.id}-${index}`}
                  className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-2 text-xs shadow-2xs space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: reader?.color ?? '#888' }} />
                      <span className="font-bold text-[var(--color-ink)]">
                        {narratorInfo?.nameAr ?? face.id}
                      </span>
                      <span className="text-[10px] text-[var(--color-ink-muted)]">
                        ({reader?.nameShort})
                      </span>
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.2 text-[10px] font-bold',
                          (face.wajhOrder ?? 1) > 1
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                            : 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950/40 dark:text-fuchsia-300'
                        )}
                      >
                        وجه {face.wajhOrder ?? 1}
                        {(face.wajhOrder ?? 1) > 1 ? ' (بخلف)' : ''}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleAddAnotherFaceForNarrator(face.id)}
                        disabled={disabled}
                        className="rounded border border-fuchsia-300 dark:border-fuchsia-800 bg-fuchsia-50 dark:bg-fuchsia-950/40 px-2 py-0.5 text-[10px] font-bold text-fuchsia-800 dark:text-fuchsia-300 hover:bg-fuchsia-100"
                        title="إضافة وجه آخر لنفس الراوي (مثلاً: وقفا بخلف عنه، أو وصلا بخلف عنه)"
                      >
                        + وجه آخر لنفس الراوي
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveFaceAtIndex(index)}
                        disabled={disabled}
                        className="rounded border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/40 px-1.5 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300 hover:bg-red-100"
                        title="حذف هذا الوجه"
                      >
                        ✕ حذف
                      </button>
                    </div>
                  </div>

                  {/* Inline edit inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 pt-0.5">
                    <div>
                      <label className="text-[10px] font-bold text-[var(--color-ink-muted)]">
                        رقم الوجه:
                      </label>
                      <input
                        type="number"
                        min={face.id === HAFS_ID ? 2 : 1}
                        max={9}
                        value={face.wajhOrder ?? 1}
                        onChange={(e) =>
                          handleUpdateFaceAtIndex(index, {
                            wajhOrder: Math.max(face.id === HAFS_ID ? 2 : 1, Number(e.target.value) || 1),
                          })
                        }
                        disabled={disabled}
                        className="mt-0.5 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.5 text-center text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-[var(--color-ink-muted)]">
                        الأداء:
                      </label>
                      <input
                        type="text"
                        value={face.action ?? ''}
                        onChange={(e) => handleUpdateFaceAtIndex(index, { action: e.target.value })}
                        disabled={disabled}
                        placeholder="مثال: إمالة وصلاً..."
                        className="mt-0.5 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-xs font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-[var(--color-ink-muted)]">
                        الملاحظة / الخلاف:
                      </label>
                      <input
                        type="text"
                        value={face.wajhNote ?? ''}
                        onChange={(e) => handleUpdateFaceAtIndex(index, { wajhNote: e.target.value })}
                        disabled={disabled}
                        placeholder="مثال: بخلف عنه، وقفاً..."
                        className="mt-0.5 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-xs"
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
