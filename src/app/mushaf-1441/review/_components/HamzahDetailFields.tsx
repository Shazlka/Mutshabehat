'use client'

// Comprehensive Hamzah Performance & Faces Builder for the Hamzah Usul chapters:
// - الهمزتان من كلمة واحدة (HAMZATAN_KALIMA)
// - الهمزتان من كلمتين (HAMZATAN_KALIMATAYN)
// - تغيير الهمز المفرد (TAGHYIR_HAMZ)
//
// Matches the architecture, live faces manager, multi-wajh tracking, and scholarly aesthetic of
// ImalahDetailFields. Enables reviewers to:
//   1. Select any reader individually, any narrator individually, or famous scholarly preset groups.
//   2. Choose varieties for الهمزة الأولى and الهمزة الثانية (تسهيل، إبدال، تحقيق، إسقاط).
//   3. Toggle إدخال ألف بين الهمزتين (مع الإدخال / بدون إدخال).
//   4. Choose applicability (وصلاً، وقفاً، أو كلاهما) and difference type (قولاً واحداً أو بخلف عنه).
//   5. Add the configured face to "تفاصيل الأداء والأوجه للرواة المحددين" with automatic nextWajhOrder.
//   6. Manage, edit inline, add alternative faces for the same narrator, and delete faces.
//   7. Live-synchronize both `narrators` array and structured `hamzahDetail` jsonb.

import { useState, useMemo } from 'react'
import type { HamzahDetail, HamzahSingleTreatment, NarratorInput } from '../_lib/types'
import { CANONICAL_READERS, HAFS_ID, type CanonicalReaderInfo } from './ReaderNarratorSelector'
import { nextWajhOrder } from './ImalahDetailFields'
import { cn } from '@/lib/cn'

export type PerformanceOption = 'wasl_waqf' | 'waqf_only' | 'wasl_only'
export type KhulfOption = 'qawlan_wahidan' | 'bikhulf'

export const HAMZAH_CATEGORY_CODES = new Set([
  'TAGHYIR_HAMZ',
  'HAMZATAN_KALIMA',
  'HAMZATAN_KALIMATAYN',
])

export function isHamzahCategory(categoryCode: string | null): boolean {
  return Boolean(categoryCode && HAMZAH_CATEGORY_CODES.has(categoryCode))
}

// Presets for الهمزتان من كلمة واحدة (HAMZATAN_KALIMA)
export const KALIMA_TASHIL_IDKHAL_IDS = [
  'Q01-R01', // قالون عن نافع
  'Q03-R01', // الدوري عن أبي عمرو
  'Q03-R02', // السوسي عن أبي عمرو
  'Q04-R01', // هشام عن ابن عامر (بخلف في المفتوحة وقولاً واحداً في غيرها)
  'Q08-R01', // ابن وردان عن أبي جعفر
  'Q08-R02', // ابن جماز عن أبي جعفر
] as const

export const KALIMA_TASHIL_NO_IDKHAL_IDS = [
  'Q01-R02', // ورش عن نافع
  'Q02-R01', // البزي عن ابن كثير
  'Q02-R02', // قنبل عن ابن كثير
  'Q09-R01', // رويس عن يعقوب
] as const

export const KALIMA_TAHQIQ_IDS = [
  'Q04-R02', // ابن ذكوان عن ابن عامر
  'Q05-R01', // شعبة عن عاصم
  'Q05-R02', // حفص عن عاصم
  'Q06-R01', // خلف عن حمزة
  'Q06-R02', // خلاد عن حمزة
  'Q07-R01', // أبو الحارث عن الكسائي
  'Q07-R02', // الدوري عن الكسائي
  'Q09-R02', // روح عن يعقوب
  'Q10-R01', // إسحاق عن خلف العاشر
  'Q10-R02', // إدريس عن خلف العاشر
] as const

// Presets for الهمزتان من كلمتين (HAMZATAN_KALIMATAYN)
export const KALIMATAYN_ISQAT_FIRST_IDS = [
  'Q03-R01', // الدوري عن أبي عمرو
  'Q03-R02', // السوسي عن أبي عمرو
] as const

export const KALIMATAYN_TASHIL_FIRST_IDS = [
  'Q01-R01', // قالون عن نافع
  'Q02-R01', // البزي عن ابن كثير
] as const

export const KALIMATAYN_TASHIL_SECOND_IDS = [
  'Q01-R02', // ورش عن نافع
  'Q02-R02', // قنبل عن ابن كثير
  'Q08-R01', // ابن وردان عن أبي جعفر
  'Q08-R02', // ابن جماز عن أبي جعفر
  'Q09-R01', // رويس عن يعقوب
] as const

export const KALIMATAYN_TAHQIQ_IDS = [
  'Q04-R01', // هشام عن ابن عامر
  'Q04-R02', // ابن ذكوان عن ابن عامر
  'Q05-R01', // شعبة عن عاصم
  'Q05-R02', // حفص عن عاصم
  'Q06-R01', // خلف عن حمزة
  'Q06-R02', // خلاد عن حمزة
  'Q07-R01', // أبو الحارث عن الكسائي
  'Q07-R02', // الدوري عن الكسائي
  'Q09-R02', // روح عن يعقوب
  'Q10-R01', // إسحاق عن خلف العاشر
  'Q10-R02', // إدريس عن خلف العاشر
] as const

export function buildHamzahFaceActionText(
  categoryCode: string,
  params: {
    kalimaFirst?: HamzahSingleTreatment
    kalimaSecond?: HamzahSingleTreatment
    kalimaIdkhal?: boolean
    kalimataynRelation?: 'متفقتان' | 'مختلفتان'
    kalimataynFirst?: HamzahSingleTreatment
    kalimataynSecond?: HamzahSingleTreatment
    singleTreatment?: HamzahSingleTreatment
    performance: PerformanceOption
    khulf: KhulfOption
  }
): string {
  const perfText =
    params.performance === 'wasl_waqf'
      ? 'وصلاً ووقفاً'
      : params.performance === 'waqf_only'
        ? 'وقفاً'
        : 'وصلاً'
  const khulfText = params.khulf === 'bikhulf' ? ' (بخلف عنه)' : ''

  if (categoryCode === 'HAMZATAN_KALIMA') {
    const first = params.kalimaFirst ?? 'تحقيق'
    const second = params.kalimaSecond ?? 'تسهيل'
    const idkhal = params.kalimaIdkhal ? ' مع الإدخال' : ' بدون إدخال'

    if (first === 'تحقيق' && second === 'تحقيق') {
      return `تحقيق الهمزتين${idkhal} ${perfText}${khulfText}`
    }
    if (second === 'تسهيل') {
      return `تسهيل الثانية${idkhal} ${perfText}${khulfText}`
    }
    if (second === 'إبدال') {
      return `إبدال الثانية حرف مد${idkhal} ${perfText}${khulfText}`
    }
    if (second === 'إسقاط') {
      return `إسقاط الثانية${idkhal} ${perfText}${khulfText}`
    }
    return `${first} الأولى و${second} الثانية${idkhal} ${perfText}${khulfText}`
  }

  if (categoryCode === 'HAMZATAN_KALIMATAYN') {
    const first = params.kalimataynFirst ?? 'تحقيق'
    const second = params.kalimataynSecond ?? 'تسهيل'

    if (first === 'إسقاط') {
      return `إسقاط الأولى ${perfText}${khulfText}`
    }
    if (first === 'تسهيل') {
      return `تسهيل الأولى ${perfText}${khulfText}`
    }
    if (first === 'تحقيق' && second === 'تحقيق') {
      return `تحقيق الهمزتين ${perfText}${khulfText}`
    }
    if (second === 'تسهيل') {
      return `تسهيل الثانية بين بين ${perfText}${khulfText}`
    }
    if (second === 'إبدال') {
      return `إبدال الثانية حرف مد ${perfText}${khulfText}`
    }
    if (second === 'حذف') {
      return `حذف الثانية ${perfText}${khulfText}`
    }
    return `${first} الأولى و${second} الثانية ${perfText}${khulfText}`
  }

  // TAGHYIR_HAMZ (single hamzah)
  const treatment = params.singleTreatment ?? 'تسهيل'
  return `${treatment} الهمزة ${perfText}${khulfText}`
}

export type HamzahDetailFieldsProps = {
  categoryCode: string | null
  rulingText?: string | null
  onChangeRulingText?(text: string): void
  appliesWasl?: boolean
  onChangeAppliesWasl?(val: boolean): void
  appliesWaqf?: boolean
  onChangeAppliesWaqf?(val: boolean): void
  narrators?: NarratorInput[]
  onChangeNarrators?(narrators: NarratorInput[]): void
  // Legacy / Direct HamzahDetail bindings
  value?: HamzahDetail | null
  onChange?(value: HamzahDetail | null): void
  hamzahDetail?: HamzahDetail | null
  onChangeHamzahDetail?(value: HamzahDetail | null): void
  disabled?: boolean
}

export default function HamzahDetailFields(props: HamzahDetailFieldsProps) {
  if (!isHamzahCategory(props.categoryCode)) return null
  return <HamzahFacesBuilder {...props} />
}

function HamzahFacesBuilder({
  categoryCode,
  rulingText,
  onChangeRulingText,
  onChangeAppliesWasl,
  onChangeAppliesWaqf,
  narrators = [],
  onChangeNarrators,
  value,
  onChange,
  hamzahDetail,
  onChangeHamzahDetail,
  disabled,
}: HamzahDetailFieldsProps) {
  const currentCategory = categoryCode ?? 'HAMZATAN_KALIMA'
  const activeDetail = hamzahDetail ?? value ?? null
  const setDetail = onChangeHamzahDetail ?? onChange ?? (() => {})

  // Mode tabs for reader selection
  const [selectorTab, setSelectorTab] = useState<'presets' | 'readers' | 'narrators'>('presets')
  const [selectedNarratorIds, setSelectedNarratorIds] = useState<Set<string>>(new Set())

  // Config states for HAMZATAN_KALIMA
  const [kalimaFirst, setKalimaFirst] = useState<HamzahSingleTreatment>('تحقيق')
  const [kalimaSecond, setKalimaSecond] = useState<HamzahSingleTreatment>('تسهيل')
  const [kalimaIdkhal, setKalimaIdkhal] = useState<boolean>(true)

  // Config states for HAMZATAN_KALIMATAYN
  const [kalimataynRelation, setKalimataynRelation] = useState<'متفقتان' | 'مختلفتان'>('متفقتان')
  const [kalimataynFirst, setKalimataynFirst] = useState<HamzahSingleTreatment>('تحقيق')
  const [kalimataynSecond, setKalimataynSecond] = useState<HamzahSingleTreatment>('تسهيل')

  // Config states for TAGHYIR_HAMZ
  const [singleTreatment, setSingleTreatment] = useState<HamzahSingleTreatment>('تسهيل')

  // Common face modifiers
  const [facePerformance, setFacePerformance] = useState<PerformanceOption>(
    currentCategory === 'HAMZATAN_KALIMATAYN' ? 'wasl_only' : 'wasl_waqf'
  )
  const [faceKhulf, setFaceKhulf] = useState<KhulfOption>('qawlan_wahidan')
  const [customActionText, setCustomActionText] = useState('')
  const [addedMessage, setAddedMessage] = useState<string | null>(null)

  // Computed action text preview
  const computedAction = useMemo(() => {
    if (customActionText.trim()) return customActionText.trim()
    return buildHamzahFaceActionText(currentCategory, {
      kalimaFirst,
      kalimaSecond,
      kalimaIdkhal,
      kalimataynRelation,
      kalimataynFirst,
      kalimataynSecond,
      singleTreatment,
      performance: facePerformance,
      khulf: faceKhulf,
    })
  }, [
    currentCategory,
    customActionText,
    kalimaFirst,
    kalimaSecond,
    kalimaIdkhal,
    kalimataynRelation,
    kalimataynFirst,
    kalimataynSecond,
    singleTreatment,
    facePerformance,
    faceKhulf,
  ])

  // Count existing faces per narrator
  const narratorFacesCount = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of narrators) {
      if (item.id) map.set(item.id, (map.get(item.id) ?? 0) + 1)
    }
    return map
  }, [narrators])

  // Selection toggle helpers
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

    // Sync Wasl / Waqf applicability
    if (onChangeAppliesWasl && onChangeAppliesWaqf) {
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
    }

    // Sync HamzahDetail JSONB state
    if (currentCategory === 'HAMZATAN_KALIMA') {
      setDetail({
        mode: 'kalima',
        first: kalimaFirst,
        second: kalimaSecond,
        idkhalAlif: kalimaIdkhal,
      })
    } else if (currentCategory === 'HAMZATAN_KALIMATAYN') {
      setDetail({
        mode: 'kalimatayn',
        harakahRelation: kalimataynRelation,
        firstTreatment: kalimataynFirst,
        secondTreatment: kalimataynSecond,
        isqatFirst: kalimataynFirst === 'إسقاط',
        isqatSecond: kalimataynSecond === 'حذف',
        ibdalMadd: kalimataynSecond === 'إبدال',
      })
    } else {
      setDetail({
        mode: 'single',
        treatment: singleTreatment,
      })
    }

    // Auto update rulingText if empty or placeholder
    if (
      onChangeRulingText &&
      (!rulingText ||
        rulingText.trim() === '' ||
        rulingText.includes('الهمز') ||
        rulingText.includes('تسهيل') ||
        rulingText.includes('تحقيق') ||
        rulingText.includes('إبدال'))
    ) {
      onChangeRulingText(computedAction)
    }

    setAddedMessage(`تمت إضافة الوجه لـ (${ids.length}) رواة بنجاح ✓`)
    setTimeout(() => setAddedMessage(null), 4000)
  }

  // Add another face specifically for a narrator
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

  // Update a face at index
  function handleUpdateFaceAtIndex(index: number, patch: Partial<NarratorInput>) {
    if (disabled || !onChangeNarrators) return
    const next = narrators.map((n, i) => (i === index ? { ...n, ...patch } : n))
    onChangeNarrators(next)
  }

  // Remove a face at index
  function handleRemoveFaceAtIndex(index: number) {
    if (disabled || !onChangeNarrators) return
    const next = narrators.filter((_, i) => i !== index)
    onChangeNarrators(next)
  }

  const categoryTitle =
    currentCategory === 'HAMZATAN_KALIMA'
      ? 'مُنشئ أوجه الهمزتين من كلمة واحدة وتفاصيل الأداء'
      : currentCategory === 'HAMZATAN_KALIMATAYN'
        ? 'مُنشئ أوجه الهمزتين من كلمتين وتفاصيل الأداء'
        : 'مُنشئ أوجه تغيير الهمز المفرد وتفاصيل الأداء'

  return (
    <div
      className="space-y-3 rounded-xl border border-amber-300 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20 p-3 shadow-xs"
      dir="rtl"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-amber-200 dark:border-amber-900/60 pb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-base">🎯</span>
          <span className="text-xs font-black text-amber-950 dark:text-amber-100">
            {categoryTitle}
          </span>
        </div>
        <span className="rounded-full bg-amber-200/70 dark:bg-amber-900/60 px-2 py-0.5 text-[10px] font-bold text-amber-900 dark:text-amber-200">
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
            <span className="font-bold text-amber-900 dark:text-amber-300">
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

        {/* Mode tabs */}
        <div className="flex rounded-lg border border-amber-200 dark:border-amber-900 bg-[var(--color-surface)] p-0.5 text-[11px] font-bold">
          <button
            type="button"
            onClick={() => setSelectorTab('presets')}
            className={cn(
              'flex-1 rounded-md py-1 transition-all text-center',
              selectorTab === 'presets'
                ? 'bg-amber-600 text-white shadow-2xs'
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
                ? 'bg-amber-600 text-white shadow-2xs'
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
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
            )}
          >
            حسب الرواة (العشرون)
          </button>
        </div>

        {/* Tab 1: Presets */}
        {selectorTab === 'presets' ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {currentCategory === 'HAMZATAN_KALIMA' ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    selectPresetGroup(KALIMA_TASHIL_IDKHAL_IDS)
                    setKalimaSecond('تسهيل')
                    setKalimaIdkhal(true)
                  }}
                  disabled={disabled}
                  className="rounded-md border border-amber-400 bg-amber-100/70 dark:bg-amber-900/40 px-2 py-1 text-xs font-bold text-amber-950 dark:text-amber-100 hover:bg-amber-200 transition-colors"
                >
                  + أهل التسهيل مع الإدخال (قالون، أبو عمرو، هشام، أبو جعفر)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    selectPresetGroup(KALIMA_TASHIL_NO_IDKHAL_IDS)
                    setKalimaSecond('تسهيل')
                    setKalimaIdkhal(false)
                  }}
                  disabled={disabled}
                  className="rounded-md border border-amber-400 bg-amber-100/70 dark:bg-amber-900/40 px-2 py-1 text-xs font-bold text-amber-950 dark:text-amber-100 hover:bg-amber-200 transition-colors"
                >
                  + أهل التسهيل بدون إدخال (ورش، ابن كثير، رويس)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    selectPresetGroup(['Q01-R02'])
                    setKalimaSecond('إبدال')
                    setKalimaIdkhal(false)
                  }}
                  disabled={disabled}
                  className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs font-bold hover:bg-[var(--color-surface-2)]"
                >
                  + ورش (إبدال حرف مد)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    selectPresetGroup(KALIMA_TAHQIQ_IDS)
                    setKalimaSecond('تحقيق')
                    setKalimaIdkhal(false)
                  }}
                  disabled={disabled}
                  className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs font-bold hover:bg-[var(--color-surface-2)]"
                >
                  + أهل التحقيق (الكوفيون، ابن عامر، روح)
                </button>
              </>
            ) : currentCategory === 'HAMZATAN_KALIMATAYN' ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    selectPresetGroup(KALIMATAYN_ISQAT_FIRST_IDS)
                    setKalimataynFirst('إسقاط')
                    setKalimataynSecond('تحقيق')
                  }}
                  disabled={disabled}
                  className="rounded-md border border-amber-400 bg-amber-100/70 dark:bg-amber-900/40 px-2 py-1 text-xs font-bold text-amber-950 dark:text-amber-100 hover:bg-amber-200 transition-colors"
                >
                  + أبو عمرو البصري (إسقاط الأولى وصلاً)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    selectPresetGroup(KALIMATAYN_TASHIL_FIRST_IDS)
                    setKalimataynFirst('تسهيل')
                    setKalimataynSecond('تحقيق')
                  }}
                  disabled={disabled}
                  className="rounded-md border border-amber-400 bg-amber-100/70 dark:bg-amber-900/40 px-2 py-1 text-xs font-bold text-amber-950 dark:text-amber-100 hover:bg-amber-200 transition-colors"
                >
                  + قالون والبزي (تسهيل / إسقاط الأولى وصلاً)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    selectPresetGroup(KALIMATAYN_TASHIL_SECOND_IDS)
                    setKalimataynFirst('تحقيق')
                    setKalimataynSecond('تسهيل')
                  }}
                  disabled={disabled}
                  className="rounded-md border border-amber-400 bg-amber-100/70 dark:bg-amber-900/40 px-2 py-1 text-xs font-bold text-amber-950 dark:text-amber-100 hover:bg-amber-200 transition-colors"
                >
                  + ورش وقنبل وأبو جعفر ورويس (تسهيل / إبدال الثانية وصلاً)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    selectPresetGroup(KALIMATAYN_TAHQIQ_IDS)
                    setKalimataynFirst('تحقيق')
                    setKalimataynSecond('تحقيق')
                  }}
                  disabled={disabled}
                  className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs font-bold hover:bg-[var(--color-surface-2)]"
                >
                  + المحققون (الكوفيون وابن عامر وروح)
                </button>
              </>
            ) : (
              // TAGHYIR_HAMZ presets
              <>
                <button
                  type="button"
                  onClick={() => {
                    selectPresetGroup(['Q01-R02'])
                    setSingleTreatment('إبدال')
                  }}
                  disabled={disabled}
                  className="rounded-md border border-amber-400 bg-amber-100/70 dark:bg-amber-900/40 px-2 py-1 text-xs font-bold text-amber-950 dark:text-amber-100 hover:bg-amber-200 transition-colors"
                >
                  + ورش (إبدال الفاء الساكنة)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    selectPresetGroup(['Q08-R01', 'Q08-R02'])
                    setSingleTreatment('إبدال')
                  }}
                  disabled={disabled}
                  className="rounded-md border border-amber-400 bg-amber-100/70 dark:bg-amber-900/40 px-2 py-1 text-xs font-bold text-amber-950 dark:text-amber-100 hover:bg-amber-200 transition-colors"
                >
                  + أبو جعفر (إبدال الهمز الساكن ومفتوح بعد ضم)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    selectPresetGroup(['Q03-R02'])
                    setSingleTreatment('إبدال')
                  }}
                  disabled={disabled}
                  className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs font-bold hover:bg-[var(--color-surface-2)]"
                >
                  + السوسي عن أبي عمرو (إبدال الهمز الساكن)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    selectPresetGroup(['Q06-R01', 'Q06-R02'])
                    setSingleTreatment('تسهيل')
                    setFacePerformance('waqf_only')
                  }}
                  disabled={disabled}
                  className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs font-bold hover:bg-[var(--color-surface-2)]"
                >
                  + حمزة (تغيير الهمز وقفاً)
                </button>
              </>
            )}
          </div>
        ) : null}

        {/* Tab 2: Readers (10 Readers) */}
        {selectorTab === 'readers' ? (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 pt-1">
            {CANONICAL_READERS.map((reader) => {
              const [n1, n2] = reader.narrators
              const bothSelected =
                selectedNarratorIds.has(n1.id) && selectedNarratorIds.has(n2.id)
              const partiallySelected =
                (selectedNarratorIds.has(n1.id) || selectedNarratorIds.has(n2.id)) && !bothSelected
              return (
                <button
                  key={reader.id}
                  type="button"
                  onClick={() => toggleReader(reader)}
                  disabled={disabled}
                  className={cn(
                    'flex flex-col items-center justify-center rounded-lg border p-1.5 text-center text-xs font-bold transition-all select-none',
                    bothSelected
                      ? 'border-amber-600 bg-amber-600 text-white shadow-xs'
                      : partiallySelected
                        ? 'border-amber-400 bg-amber-100 text-amber-950 dark:bg-amber-950/60 dark:text-amber-200'
                        : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:border-amber-400 hover:bg-[var(--color-surface-2)]'
                  )}
                >
                  <span className="flex items-center gap-1">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: reader.color }}
                    />
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
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto p-1 rounded-md border border-amber-200 dark:border-amber-900 bg-[var(--color-surface)]">
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
                        ? 'border border-amber-600 bg-amber-600 text-white shadow-2xs'
                        : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:border-amber-400 hover:bg-[var(--color-surface-2)]'
                    )}
                  >
                    <span className="whitespace-nowrap">{n.nameShort}</span>
                    <div className="flex items-center gap-1 text-[10px]">
                      {existingCount > 0 ? (
                        <span
                          className={cn(
                            'rounded px-1 py-0.2',
                            isSelected ? 'bg-amber-800 text-white' : 'bg-amber-100 text-amber-900'
                          )}
                        >
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

      {/* STEP 2: Configure Face Details */}
      <div className="space-y-2 border-t border-amber-200 dark:border-amber-900/60 pt-2.5">
        <label className="text-xs font-bold text-[var(--color-ink)]">
          ٢. حدد معالجة الهمزة وصيغة الوجه (نوع المعالجة للأولى والثانية والخلاف):
        </label>

        {/* 2a. Category-specific treatments */}
        {currentCategory === 'HAMZATAN_KALIMA' ? (
          <div className="space-y-2 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-[var(--color-surface)] p-2">
            {/* First Hamzah */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-[var(--color-ink-muted)] min-w-20">
                الهمزة الأولى:
              </span>
              {(['تحقيق', 'تسهيل', 'إبدال', 'إسقاط'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setKalimaFirst(t)
                    setCustomActionText('')
                  }}
                  disabled={disabled}
                  className={cn(
                    'rounded-md border px-2.5 py-1 text-xs font-bold transition-all',
                    kalimaFirst === t && !customActionText
                      ? 'border-amber-600 bg-amber-600 text-white shadow-xs'
                      : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:border-amber-400'
                  )}
                >
                  {kalimaFirst === t && !customActionText ? '✓ ' : ''}{t}
                </button>
              ))}
            </div>

            {/* Second Hamzah */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-[var(--color-ink-muted)] min-w-20">
                الهمزة الثانية:
              </span>
              {[
                { id: 'تسهيل', label: 'تسهيل بين بين' },
                { id: 'إبدال', label: 'إبدال حرف مد' },
                { id: 'تحقيق', label: 'تحقيق' },
                { id: 'إسقاط', label: 'إسقاط' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setKalimaSecond(item.id as HamzahSingleTreatment)
                    setCustomActionText('')
                  }}
                  disabled={disabled}
                  className={cn(
                    'rounded-md border px-2.5 py-1 text-xs font-bold transition-all',
                    kalimaSecond === item.id && !customActionText
                      ? 'border-amber-600 bg-amber-600 text-white shadow-xs'
                      : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:border-amber-400'
                  )}
                >
                  {kalimaSecond === item.id && !customActionText ? '✓ ' : ''}{item.label}
                </button>
              ))}
            </div>

            {/* Idkhal Alif */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[11px] font-bold text-[var(--color-ink-muted)] min-w-20">
                إدخال ألف:
              </span>
              {[
                { val: true, label: 'مع الإدخال (إدخال ألف)' },
                { val: false, label: 'بدون إدخال' },
              ].map((item) => (
                <button
                  key={String(item.val)}
                  type="button"
                  onClick={() => {
                    setKalimaIdkhal(item.val)
                    setCustomActionText('')
                  }}
                  disabled={disabled}
                  className={cn(
                    'rounded-md border px-2.5 py-1 text-xs font-bold transition-all',
                    kalimaIdkhal === item.val && !customActionText
                      ? 'border-blue-600 bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 shadow-2xs'
                      : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-2)]'
                  )}
                >
                  {kalimaIdkhal === item.val && !customActionText ? '✓ ' : ''}{item.label}
                </button>
              ))}
            </div>
          </div>
        ) : currentCategory === 'HAMZATAN_KALIMATAYN' ? (
          <div className="space-y-2 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-[var(--color-surface)] p-2">
            {/* Harakah relation */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-[var(--color-ink-muted)] min-w-20">
                نوع الهمزتين:
              </span>
              {[
                { id: 'متفقتان', label: 'متفقتان في الحركة' },
                { id: 'مختلفتان', label: 'مختلفتان في الحركة' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setKalimataynRelation(item.id as 'متفقتان' | 'مختلفتان')
                    setCustomActionText('')
                  }}
                  disabled={disabled}
                  className={cn(
                    'rounded-md border px-2.5 py-1 text-xs font-bold transition-all',
                    kalimataynRelation === item.id && !customActionText
                      ? 'border-amber-600 bg-amber-600 text-white shadow-xs'
                      : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:border-amber-400'
                  )}
                >
                  {kalimataynRelation === item.id && !customActionText ? '✓ ' : ''}{item.label}
                </button>
              ))}
            </div>

            {/* First Hamzah in Kalimatayn */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-[var(--color-ink-muted)] min-w-20">
                معالجة الأولى:
              </span>
              {[
                { id: 'تحقيق', label: 'تحقيق الأولى' },
                { id: 'إسقاط', label: 'إسقاط الأولى' },
                { id: 'تسهيل', label: 'تسهيل الأولى' },
                { id: 'إبدال', label: 'إبدال الأولى' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setKalimataynFirst(item.id as HamzahSingleTreatment)
                    setCustomActionText('')
                  }}
                  disabled={disabled}
                  className={cn(
                    'rounded-md border px-2.5 py-1 text-xs font-bold transition-all',
                    kalimataynFirst === item.id && !customActionText
                      ? 'border-amber-600 bg-amber-600 text-white shadow-xs'
                      : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:border-amber-400'
                  )}
                >
                  {kalimataynFirst === item.id && !customActionText ? '✓ ' : ''}{item.label}
                </button>
              ))}
            </div>

            {/* Second Hamzah in Kalimatayn */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-[var(--color-ink-muted)] min-w-20">
                معالجة الثانية:
              </span>
              {[
                { id: 'تسهيل', label: 'تسهيل بين بين' },
                { id: 'إبدال', label: 'إبدال حرف مد' },
                { id: 'تحقيق', label: 'تحقيق الثانية' },
                { id: 'حذف', label: 'حذف / إسقاط' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setKalimataynSecond(item.id as HamzahSingleTreatment)
                    setCustomActionText('')
                  }}
                  disabled={disabled}
                  className={cn(
                    'rounded-md border px-2.5 py-1 text-xs font-bold transition-all',
                    kalimataynSecond === item.id && !customActionText
                      ? 'border-amber-600 bg-amber-600 text-white shadow-xs'
                      : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:border-amber-400'
                  )}
                >
                  {kalimataynSecond === item.id && !customActionText ? '✓ ' : ''}{item.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          // TAGHYIR_HAMZ (single hamzah)
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-[var(--color-surface)] p-2">
            <span className="text-[11px] font-bold text-[var(--color-ink-muted)] min-w-20">
              نوع المعالجة:
            </span>
            {(['تحقيق', 'تسهيل', 'إبدال', 'نقل', 'حذف', 'سكت قبل الهمز'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setSingleTreatment(t)
                  setCustomActionText('')
                }}
                disabled={disabled}
                className={cn(
                  'rounded-md border px-2.5 py-1 text-xs font-bold transition-all',
                  singleTreatment === t && !customActionText
                    ? 'border-amber-600 bg-amber-600 text-white shadow-xs'
                    : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:border-amber-400'
                )}
              >
                {singleTreatment === t && !customActionText ? '✓ ' : ''}{t}
              </button>
            ))}
          </div>
        )}

        {/* 2b. Performance condition (وصلاً / وقفاً / كلاهما) */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold text-[var(--color-ink-muted)] min-w-16">
            الأداء:
          </span>
          {[
            { id: 'wasl_only', label: 'عند الوصل فقط' },
            { id: 'wasl_waqf', label: 'وصلاً ووقفاً' },
            { id: 'waqf_only', label: 'عند الوقف فقط' },
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
          <span className="text-[11px] font-bold text-[var(--color-ink-muted)] min-w-16">
            الخلاف:
          </span>
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
                className="text-[10px] font-bold text-amber-600 hover:underline"
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
            className="mt-1 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-xs font-bold text-amber-950 dark:text-amber-100"
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
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-600 bg-amber-600 px-3 py-2 text-center text-xs font-black text-white shadow-xs hover:bg-amber-700 disabled:opacity-50 transition-all select-none"
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
      <div className="border-t border-amber-200 dark:border-amber-900/60 pt-2.5 space-y-2">
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
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: reader?.color ?? '#888' }}
                      />
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
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
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
                        className="rounded border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-100"
                        title="إضافة وجه آخر لنفس الراوي"
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
                            wajhOrder: Math.max(
                              face.id === HAFS_ID ? 2 : 1,
                              Number(e.target.value) || 1
                            ),
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
                        placeholder="مثال: تسهيل الثانية..."
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
                        onChange={(e) =>
                          handleUpdateFaceAtIndex(index, { wajhNote: e.target.value })
                        }
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
