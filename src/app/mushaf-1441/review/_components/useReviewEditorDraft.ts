'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import type {
  BulkApplyResult,
  CreateEntryInput,
  EntryFields,
  HamzahDetail,
  NarratorInput,
  OccurrenceCandidate,
  ReviewRow,
  SameWordMatch,
} from '../_lib/types'
import { isHamzahCategory } from './HamzahDetailFields'
import * as reviewApi from '../_lib/api'

export type WordMeta = {
  surah: number
  ayah: number
  word: number
  text: string
  page: number
}

export function validateEntryDraft(
  kind: 'farsh' | 'usul',
  readingText: string,
  categoryCode: string | null,
  narratorCount: number
): { valid: boolean; error?: string } {
  if (kind === 'farsh' && !readingText.trim()) {
    return { valid: false, error: 'نص القراءة مطلوب لفرش الحروف' }
  }
  if (kind === 'usul' && !categoryCode) {
    return { valid: false, error: 'الباب / القاعدة مطلوبة لأصول القراءات' }
  }
  if (narratorCount === 0) {
    return { valid: false, error: 'يجب اختيار راوٍ واحد على الأقل' }
  }
  return { valid: true }
}

export function serializeDraftSnapshot(state: {
  kind: 'farsh' | 'usul'
  categoryCode: string | null
  readingText: string
  variantType: string | null
  rulingText: string | null
  description: string | null
  performanceNote: string | null
  appliesWasl: boolean
  appliesWaqf: boolean
  hamzahDetail: unknown
  narrators: unknown[]
}): string {
  return JSON.stringify(state)
}

type UseReviewEditorDraftProps = {
  selectedRow: ReviewRow | null
  activeRowsForWord: ReviewRow[]
  newEntryDraft: CreateEntryInput | null
  selectedWordMeta: WordMeta | null
  onSaveRowEdits(row: ReviewRow, fields: EntryFields, narrators: NarratorInput[]): Promise<void>
  onCreateNewEntry(entry: CreateEntryInput): Promise<void>
  onBulkDelete(rows: ReviewRow[], note: string | null): Promise<void>
  onCopyToOccurrence(
    sourceEntryId: string,
    target: { surah: number; ayah: number; startWord: number }
  ): Promise<void>
  onBulkApply(
    sourceEntryId: string,
    targets: { surah: number; ayah: number; word: number }[]
  ): Promise<BulkApplyResult | null>
}

export function useReviewEditorDraft({
  selectedRow,
  activeRowsForWord,
  newEntryDraft,
  selectedWordMeta,
  onSaveRowEdits,
  onCreateNewEntry,
  onBulkDelete,
  onCopyToOccurrence,
  onBulkApply,
}: UseReviewEditorDraftProps) {
  // Local edit draft for existing row or new entry
  const [kind, setKind] = useState<'farsh' | 'usul'>('farsh')
  const [categoryCode, setCategoryCode] = useState<string | null>(null)
  const [readingText, setReadingText] = useState('')
  const [variantType, setVariantType] = useState<string | null>(null)
  const [rulingText, setRulingText] = useState<string | null>(null)
  const [description, setDescription] = useState<string | null>(null)
  const [performanceNote, setPerformanceNote] = useState<string | null>(null)
  const [narrators, setNarrators] = useState<NarratorInput[]>([])
  const [appliesWasl, setAppliesWasl] = useState(true)
  const [appliesWaqf, setAppliesWaqf] = useState(true)
  const [hamzahDetail, setHamzahDetail] = useState<HamzahDetail | null>(null)

  // Snapshot for dirty checking
  const initialSnapshotRef = useRef<string>('')

  // Multi-select delete (feature 1)
  const [multiSelectMode, setMultiSelectMode] = useState(false)
  const [selectedForDelete, setSelectedForDelete] = useState<Set<string>>(new Set())

  // Same-word verified-config copy (feature 3)
  const [sameWordOpen, setSameWordOpen] = useState(false)
  const [sameWordLoading, setSameWordLoading] = useState(false)
  const [sameWordMatches, setSameWordMatches] = useState<SameWordMatch[] | null>(null)

  // Apply-to-all-occurrences (feature 7)
  const [bulkApplyOpen, setBulkApplyOpen] = useState(false)
  const [bulkApplyLoading, setBulkApplyLoading] = useState(false)
  const [occurrences, setOccurrences] = useState<OccurrenceCandidate[] | null>(null)
  const [selectedOccurrences, setSelectedOccurrences] = useState<Set<string>>(new Set())

  const isAddMode = Boolean(newEntryDraft)

  // Synchronize when selectedRow changes
  useEffect(() => {
    if (selectedRow) {
      const nextKind = selectedRow.kind
      const nextCategoryCode = selectedRow.categoryCode
      const nextReadingText = selectedRow.readingText ?? selectedRow.hafsText ?? ''
      const nextVariantType = selectedRow.variantType
      const nextRulingText = selectedRow.rulingText
      const nextDescription = selectedRow.description
      const nextPerformanceNote = selectedRow.performanceNote
      const nextAppliesWasl = selectedRow.appliesWasl
      const nextAppliesWaqf = selectedRow.appliesWaqf
      const nextHamzahDetail = selectedRow.hamzahDetail
      const nextNarrators = selectedRow.narrators.map((n) => ({
        id: n.id,
        action: n.action,
        wajhOrder: n.wajhOrder,
        wajhNote: n.wajhNote,
      }))

      setKind(nextKind)
      setCategoryCode(nextCategoryCode)
      setReadingText(nextReadingText)
      setVariantType(nextVariantType)
      setRulingText(nextRulingText)
      setDescription(nextDescription)
      setPerformanceNote(nextPerformanceNote)
      setAppliesWasl(nextAppliesWasl)
      setAppliesWaqf(nextAppliesWaqf)
      setHamzahDetail(nextHamzahDetail)
      setNarrators(nextNarrators)

      initialSnapshotRef.current = serializeDraftSnapshot({
        kind: nextKind,
        categoryCode: nextCategoryCode,
        readingText: nextReadingText,
        variantType: nextVariantType,
        rulingText: nextRulingText,
        description: nextDescription,
        performanceNote: nextPerformanceNote,
        appliesWasl: nextAppliesWasl,
        appliesWaqf: nextAppliesWaqf,
        hamzahDetail: nextHamzahDetail,
        narrators: nextNarrators,
      })
    }
  }, [selectedRow])

  // Synchronize when newEntryDraft changes
  useEffect(() => {
    if (newEntryDraft) {
      const nextKind = newEntryDraft.kind
      const nextCategoryCode = newEntryDraft.categoryCode ?? null
      const nextReadingText = newEntryDraft.readingText ?? newEntryDraft.uthmaniText ?? ''
      const nextVariantType = newEntryDraft.variantType ?? 'تشكيل'
      const nextRulingText = newEntryDraft.rulingText ?? null
      const nextDescription = newEntryDraft.description ?? null
      const nextPerformanceNote = newEntryDraft.performanceNote ?? null
      const nextAppliesWasl = true
      const nextAppliesWaqf = true
      const nextHamzahDetail = null
      const nextNarrators = newEntryDraft.narrators ?? []

      setKind(nextKind)
      setCategoryCode(nextCategoryCode)
      setReadingText(nextReadingText)
      setVariantType(nextVariantType)
      setRulingText(nextRulingText)
      setDescription(nextDescription)
      setPerformanceNote(nextPerformanceNote)
      setAppliesWasl(nextAppliesWasl)
      setAppliesWaqf(nextAppliesWaqf)
      setHamzahDetail(nextHamzahDetail)
      setNarrators(nextNarrators)

      initialSnapshotRef.current = serializeDraftSnapshot({
        kind: nextKind,
        categoryCode: nextCategoryCode,
        readingText: nextReadingText,
        variantType: nextVariantType,
        rulingText: nextRulingText,
        description: nextDescription,
        performanceNote: nextPerformanceNote,
        appliesWasl: nextAppliesWasl,
        appliesWaqf: nextAppliesWaqf,
        hamzahDetail: nextHamzahDetail,
        narrators: nextNarrators,
      })
    }
  }, [newEntryDraft])

  // Reset transient sub-panels on word change
  const resetTransientPanels = () => {
    setMultiSelectMode(false)
    setSelectedForDelete(new Set())
    setSameWordOpen(false)
    setSameWordMatches(null)
    setBulkApplyOpen(false)
    setOccurrences(null)
    setSelectedOccurrences(new Set())
  }

  // Calculate isDirty
  const isDirty = useMemo(() => {
    if (!selectedRow && !newEntryDraft) return false
    const current = serializeDraftSnapshot({
      kind,
      categoryCode,
      readingText,
      variantType,
      rulingText,
      description,
      performanceNote,
      appliesWasl,
      appliesWaqf,
      hamzahDetail,
      narrators,
    })
    return current !== initialSnapshotRef.current
  }, [
    selectedRow,
    newEntryDraft,
    kind,
    categoryCode,
    readingText,
    variantType,
    rulingText,
    description,
    performanceNote,
    appliesWasl,
    appliesWaqf,
    hamzahDetail,
    narrators,
  ])

  // Context metadata
  const currentSurahNumber = selectedRow?.surah ?? selectedWordMeta?.surah ?? null
  const currentAyahNumber = selectedRow?.ayah ?? selectedWordMeta?.ayah ?? null
  const currentWordNumber = selectedRow?.startWord ?? selectedWordMeta?.word ?? null
  const currentHafsText = selectedRow?.hafsText ?? selectedWordMeta?.text ?? ''

  async function handleSaveExisting(): Promise<boolean> {
    if (!selectedRow) return false
    const validation = validateEntryDraft(kind, readingText, categoryCode, narrators.length)
    if (!validation.valid) return false

    const isFarsh = kind === 'farsh'
    const fields: EntryFields = {
      kind,
      ...(isFarsh
        ? {
            readingText: readingText.trim(),
            variantType: variantType || undefined,
            description: description?.trim() || null,
            performanceNote: performanceNote?.trim() || null,
          }
        : {
            readingText: readingText.trim() || undefined,
            categoryCode: categoryCode || undefined,
            rulingText: rulingText?.trim() || null,
          }),
      appliesWasl,
      appliesWaqf,
      hamzahDetail: !isFarsh && isHamzahCategory(categoryCode) ? hamzahDetail : null,
    }

    await onSaveRowEdits(selectedRow, fields, narrators)
    initialSnapshotRef.current = serializeDraftSnapshot({
      kind,
      categoryCode,
      readingText,
      variantType,
      rulingText,
      description,
      performanceNote,
      appliesWasl,
      appliesWaqf,
      hamzahDetail,
      narrators,
    })
    return true
  }

  async function handleCreate(): Promise<boolean> {
    if (!newEntryDraft) return false
    const validation = validateEntryDraft(kind, readingText, categoryCode, narrators.length)
    if (!validation.valid) return false

    const draft: CreateEntryInput = {
      ...newEntryDraft,
      kind,
      readingText: readingText.trim() || undefined,
      categoryCode: kind === 'usul' && categoryCode ? categoryCode : undefined,
      variantType: kind === 'farsh' && variantType ? variantType : undefined,
      rulingText: kind === 'usul' ? rulingText?.trim() || null : null,
      description: description?.trim() || null,
      performanceNote: performanceNote?.trim() || null,
      narrators,
      appliesWasl,
      appliesWaqf,
      hamzahDetail: kind === 'usul' && isHamzahCategory(categoryCode) ? hamzahDetail : null,
    }

    await onCreateNewEntry(draft)
    return true
  }

  function toggleDeleteSelection(entryId: string) {
    setSelectedForDelete((prev) => {
      const next = new Set(prev)
      if (next.has(entryId)) next.delete(entryId)
      else next.add(entryId)
      return next
    })
  }

  async function confirmBulkDelete() {
    const rows = activeRowsForWord.filter((r) => selectedForDelete.has(r.entryId))
    if (rows.length === 0) return
    const narratorSummary = rows
      .map(
        (r) =>
          r.narrators.map((n) => n.nameAr).join('، ') ||
          (r.kind === 'usul' ? r.categoryNameAr ?? 'أصل' : r.readingText ?? '')
      )
      .join(' | ')

    if (
      !window.confirm(
        `سيتم حذف ${rows.length} أوجه مسجلة لهذه الكلمة (${narratorSummary}). هل تريد المتابعة؟`
      )
    ) {
      return
    }

    await onBulkDelete(rows, 'حذف جماعي من شاشة المراجعة')
    setMultiSelectMode(false)
    setSelectedForDelete(new Set())
  }

  async function openSameWordPanel() {
    if (!currentSurahNumber || !currentAyahNumber || !currentWordNumber) return
    setSameWordOpen(true)
    setSameWordLoading(true)
    const result = await reviewApi.findSameWord({
      surah: currentSurahNumber,
      ayah: currentAyahNumber,
      word: currentWordNumber,
      excludeLocusId: selectedRow?.locationId ?? null,
    })
    setSameWordLoading(false)
    setSameWordMatches(result.ok ? result.data : [])
  }

  async function copyFromMatch(match: SameWordMatch) {
    if (!currentSurahNumber || !currentAyahNumber || !currentWordNumber) return
    await onCopyToOccurrence(match.entryId, {
      surah: currentSurahNumber,
      ayah: currentAyahNumber,
      startWord: currentWordNumber,
    })
    setSameWordOpen(false)
  }

  async function openBulkApplyPanel() {
    if (!selectedRow) return
    setBulkApplyOpen(true)
    setBulkApplyLoading(true)
    const result = await reviewApi.findOccurrences(selectedRow.entryId)
    setBulkApplyLoading(false)
    if (result.ok) {
      setOccurrences(result.data)
      setSelectedOccurrences(
        new Set(result.data.filter((o) => o.status === 'add').map((o) => o.canonicalKey))
      )
    } else {
      setOccurrences([])
    }
  }

  function toggleOccurrence(key: string) {
    setSelectedOccurrences((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function confirmBulkApply(): Promise<boolean> {
    if (!selectedRow || !occurrences) return false
    const targets = occurrences
      .filter((o) => selectedOccurrences.has(o.canonicalKey))
      .map((o) => ({ surah: o.surah, ayah: o.ayah, word: o.word }))
    if (targets.length === 0) return false
    const result = await onBulkApply(selectedRow.entryId, targets)
    if (result) {
      setBulkApplyOpen(false)
      return true
    }
    return false
  }

  return {
    kind,
    setKind,
    categoryCode,
    setCategoryCode,
    readingText,
    setReadingText,
    variantType,
    setVariantType,
    rulingText,
    setRulingText,
    description,
    setDescription,
    performanceNote,
    setPerformanceNote,
    narrators,
    setNarrators,
    appliesWasl,
    setAppliesWasl,
    appliesWaqf,
    setAppliesWaqf,
    hamzahDetail,
    setHamzahDetail,
    isDirty,
    isAddMode,
    currentSurahNumber,
    currentAyahNumber,
    currentWordNumber,
    currentHafsText,
    multiSelectMode,
    setMultiSelectMode,
    selectedForDelete,
    setSelectedForDelete,
    toggleDeleteSelection,
    confirmBulkDelete,
    sameWordOpen,
    setSameWordOpen,
    sameWordLoading,
    sameWordMatches,
    openSameWordPanel,
    copyFromMatch,
    bulkApplyOpen,
    setBulkApplyOpen,
    bulkApplyLoading,
    occurrences,
    selectedOccurrences,
    setSelectedOccurrences,
    openBulkApplyPanel,
    toggleOccurrence,
    confirmBulkApply,
    handleSaveExisting,
    handleCreate,
    resetTransientPanels,
  }
}
