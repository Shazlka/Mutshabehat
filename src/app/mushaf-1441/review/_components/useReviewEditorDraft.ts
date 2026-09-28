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
import { normalizeVariantType } from './FarshFields'
import { summarizeActiveRows } from './facesSummary'
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
  // The match the reviewer picked to copy, awaiting a preview/confirm step before the actual
  // copy RPC fires. Whether the "verified-only, same category" filter is applied to the match
  // list, defaulted per which entry point opened the panel (owner request: "check for verified
  // data" should default to that filter; the plain "نسخ الوجه" copy button shows everything).
  const [previewMatch, setPreviewMatch] = useState<SameWordMatch | null>(null)
  const [verifiedOnlyFilter, setVerifiedOnlyFilter] = useState(false)

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
      const nextVariantType = selectedRow.variantType ? normalizeVariantType(selectedRow.variantType) : null
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
      const nextVariantType = newEntryDraft.variantType ? normalizeVariantType(newEntryDraft.variantType) : 'vowel'
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
    setPreviewMatch(null)
    setVerifiedOnlyFilter(false)
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
            variantType: variantType ? normalizeVariantType(variantType) : undefined,
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
      variantType: kind === 'farsh' && variantType ? normalizeVariantType(variantType) : undefined,
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

  async function performBulkDelete(rows: ReviewRow[], note: string) {
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

    await onBulkDelete(rows, note)
    setMultiSelectMode(false)
    setSelectedForDelete(new Set())
  }

  async function confirmBulkDelete() {
    const rows = activeRowsForWord.filter((r) => selectedForDelete.has(r.entryId))
    await performBulkDelete(rows, 'حذف جماعي من شاشة المراجعة')
  }

  // Feature 3: one-click "delete all" for every face currently recorded on the selected word --
  // a thin wrapper reusing the exact same confirmation copy and the same qiraat_review_bulk_delete
  // path the checkbox multi-select flow above already uses, without requiring multi-select mode
  // to be entered first.
  async function deleteAllForWord() {
    await performBulkDelete(activeRowsForWord, 'حذف الكل من شاشة المراجعة')
  }

  // Feature 4: pure derived, live summary of everything currently recorded for the selected
  // word, shown above "٣. الأوجه المسجلة" -- recomputes on every render from activeRowsForWord,
  // so it reflects add/edit/delete immediately with no extra state or request.
  const activeRowsSummary = useMemo(() => summarizeActiveRows(activeRowsForWord), [activeRowsForWord])

  async function openSameWordPanel(verifiedOnlyDefault = false) {
    if (!currentSurahNumber || !currentAyahNumber || !currentWordNumber) return
    setSameWordOpen(true)
    setSameWordLoading(true)
    setPreviewMatch(null)
    setVerifiedOnlyFilter(verifiedOnlyDefault)
    const result = await reviewApi.findSameWord({
      surah: currentSurahNumber,
      ayah: currentAyahNumber,
      word: currentWordNumber,
      excludeLocusId: selectedRow?.locationId ?? null,
    })
    setSameWordLoading(false)
    setSameWordMatches(result.ok ? result.data : [])
  }

  // The server already scopes findSameWord to reviewStatus === 'reviewed' (this app's
  // "verified"/"معتمد" concept). Narrow further, client-side only, to the same kind and (for
  // usul) the same category as the selected row -- so "check for verified data" only offers
  // configurations that are actually safe to copy in as-is. If the row has no category yet
  // (an unreviewed usul row the reviewer hasn't classified), don't filter by category so a
  // pick can set it for them.
  const verifiedSameCategoryMatches = useMemo(() => {
    if (!sameWordMatches) return []
    const targetKind = selectedRow?.kind
    return sameWordMatches.filter((m) => {
      if (targetKind && m.kind !== targetKind) return false
      if (m.kind === 'usul' && selectedRow?.categoryCode && m.categoryCode !== selectedRow.categoryCode) {
        return false
      }
      return true
    })
  }, [sameWordMatches, selectedRow])

  // Selecting a match no longer copies immediately -- it stages a preview the reviewer must
  // confirm (owner request: "before applying from verified data I should see what will be
  // copied into the new word").
  function selectMatchForPreview(match: SameWordMatch) {
    setPreviewMatch(match)
  }

  function cancelPreview() {
    setPreviewMatch(null)
  }

  async function confirmCopyFromMatch() {
    if (!previewMatch || !currentSurahNumber || !currentAyahNumber || !currentWordNumber) return
    await onCopyToOccurrence(previewMatch.entryId, {
      surah: currentSurahNumber,
      ayah: currentAyahNumber,
      startWord: currentWordNumber,
    })
    setPreviewMatch(null)
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
    deleteAllForWord,
    activeRowsSummary,
    sameWordOpen,
    setSameWordOpen,
    sameWordLoading,
    sameWordMatches,
    verifiedSameCategoryMatches,
    verifiedOnlyFilter,
    setVerifiedOnlyFilter,
    openSameWordPanel,
    previewMatch,
    selectMatchForPreview,
    cancelPreview,
    confirmCopyFromMatch,
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
