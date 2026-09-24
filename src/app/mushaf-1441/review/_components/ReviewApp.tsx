'use client'

// High-speed Quran Qiraat review and database editing workstation.
//
// 2-Pane Workstation Architecture:
// - RIGHT PANE (~65-72%): Authentic Mushaf-1441 page layout with QCF V2 fonts, 15-line grid,
//   SVG Surah banners, Basmala, and status highlights. Interactive word selection.
// - LEFT PANE (~28-35%): Compact Single-Word Side Editor with direct 1-click confirmation,
//   chips-based reader/narrator grid (10 readers, 20 narrators), fast Usul/Farsh toggle,
//   and missing-word creation mode.
//
// Both panes scroll independently.

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CreateEntryInput, EntryFields, NarratorInput, ReviewOverview, ReviewPage, ReviewRow } from '../_lib/types'
import HistoryPanel from './HistoryPanel'
import ReviewMushafPane, { canonicalKeyForWord } from './ReviewMushafPane'
import ReviewEditorPane, { type WordMeta } from './ReviewEditorPane'
import ReviewNav from './ReviewNav'
import * as reviewApi from '../_lib/api'

const MIN_PAGE = 1
const MAX_PAGE = 604

function clampPage(page: number): number {
  return Math.min(MAX_PAGE, Math.max(MIN_PAGE, Math.round(page)))
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

export default function ReviewApp({ initialPage }: { initialPage: number }) {
  const [pageNumber, setPageNumber] = useState(() => clampPage(initialPage))
  const [page, setPage] = useState<ReviewPage | null>(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)

  const [overview, setOverview] = useState<ReviewOverview | null>(null)

  // Selection state
  const [selectedWordKey, setSelectedWordKey] = useState<string | null>(null)
  const [selectedWordMeta, setSelectedWordMeta] = useState<WordMeta | null>(null)
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null)

  // New entry draft (for State C: unhighlighted words)
  const [newEntryDraft, setNewEntryDraft] = useState<CreateEntryInput | null>(null)

  // Feedback & saving state
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [undoBanner, setUndoBanner] = useState<{ txid?: number; message: string } | null>(null)

  const [historyOpen, setHistoryOpen] = useState(false)
  const [deviceId, setDeviceId] = useState('')

  useEffect(() => {
    setDeviceId(reviewApi.getDeviceId())
  }, [])

  const loadPage = useCallback(async (target: number) => {
    setPageLoading(true)
    setPageError(null)
    const result = await reviewApi.getReviewPage(target, true)
    if (result.ok) {
      setPage(result.data)
    } else {
      setPage(null)
      setPageError(result.error.messageAr ?? result.error.message)
    }
    setPageLoading(false)
  }, [])

  const loadOverview = useCallback(async () => {
    const result = await reviewApi.getReviewOverview()
    if (result.ok) setOverview(result.data)
  }, [])

  useEffect(() => {
    void loadPage(pageNumber)
    void loadOverview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const goToPage = useCallback(
    (target: number) => {
      const clamped = clampPage(target)
      setPageNumber(clamped)
      setSelectedWordKey(null)
      setSelectedWordMeta(null)
      setSelectedRowId(null)
      setNewEntryDraft(null)
      setHoveredRowId(null)
      setErrorMessage(null)
      setSaveMessage(null)
      void loadPage(clamped)
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href)
        url.searchParams.set('page', String(clamped))
        window.history.replaceState(window.history.state, '', url)
      }
    },
    [loadPage]
  )

  const reloadCurrentPage = useCallback(async () => {
    await loadPage(pageNumber)
    await loadOverview()
  }, [loadPage, loadOverview, pageNumber])

  function applyRowUpdate(row: ReviewRow) {
    setPage((current) => {
      if (!current) return current
      const exists = current.rows.some((r) => r.entryId === row.entryId)
      const rows = exists
        ? current.rows.map((r) => (r.entryId === row.entryId ? row : r))
        : [...current.rows, row]

      // Recompute stats
      const total = rows.filter((r) => !r.deleted).length
      const unreviewed = rows.filter((r) => !r.deleted && r.reviewStatus === 'unreviewed').length
      const reviewed = rows.filter((r) => !r.deleted && r.reviewStatus === 'reviewed').length
      const flagged = rows.filter((r) => !r.deleted && r.reviewStatus === 'flagged').length
      const deleted = rows.filter((r) => r.deleted).length

      return { ...current, rows, stats: { total, unreviewed, reviewed, flagged, deleted } }
    })
    void loadOverview()
  }

  // Active rows for the currently selected word
  const activeRowsForWord = useMemo(() => {
    if (!page || !selectedWordKey) return []
    return page.rows.filter(
      (row) => !row.deleted && row.startKey <= selectedWordKey && selectedWordKey <= row.endKey
    )
  }, [page, selectedWordKey])

  // Currently selected row
  const selectedRow = useMemo(() => {
    if (!page) return null
    if (selectedRowId) {
      return page.rows.find((row) => row.entryId === selectedRowId && !row.deleted) ?? null
    }
    return activeRowsForWord[0] ?? null
  }, [page, selectedRowId, activeRowsForWord])

  // Handle word selection on the authentic Mushaf
  const handleSelectWord = useCallback(
    (key: string, meta: WordMeta) => {
      setSelectedWordKey(key)
      setSelectedWordMeta(meta)
      setErrorMessage(null)
      setSaveMessage(null)

      if (!page) return
      const covering = page.rows.filter(
        (r) => !r.deleted && r.startKey <= key && key <= r.endKey
      )

      if (covering.length > 0) {
        // State A / B: Existing entry found
        setSelectedRowId(covering[0].entryId)
        setNewEntryDraft(null)
      } else {
        // State C: Normal unhighlighted word -> initialize Add New Entry mode
        setSelectedRowId(null)
        setNewEntryDraft({
          surah: meta.surah,
          ayah: meta.ayah,
          startWord: meta.word,
          endAyah: meta.ayah,
          endWord: meta.word,
          kind: 'farsh',
          readingText: meta.text,
          uthmaniText: meta.text,
          narrators: [],
        })
      }
    },
    [page]
  )

  // Start new entry for a word (even if other variants already exist on it)
  const handleStartNewEntry = useCallback((meta: WordMeta) => {
    setSelectedRowId(null)
    setNewEntryDraft({
      surah: meta.surah,
      ayah: meta.ayah,
      startWord: meta.word,
      endAyah: meta.ayah,
      endWord: meta.word,
      kind: 'farsh',
      readingText: meta.text,
      uthmaniText: meta.text,
      narrators: [],
    })
  }, [])

  const handleCancelNewEntry = useCallback(() => {
    setNewEntryDraft(null)
    if (activeRowsForWord.length > 0) {
      setSelectedRowId(activeRowsForWord[0].entryId)
    } else {
      setSelectedWordKey(null)
      setSelectedWordMeta(null)
    }
  }, [activeRowsForWord])

  // 1-Click Confirm Row
  const handleConfirmRow = useCallback(
    async (row: ReviewRow) => {
      if (!deviceId) return
      setIsSaving(true)
      setErrorMessage(null)
      setSaveMessage(null)

      const result = await reviewApi.setStatus(row, 'reviewed', null, deviceId)
      setIsSaving(false)
      if (result.ok) {
        applyRowUpdate(result.data)
        setSaveMessage('تم اعتماد الموضع بنجاح ✓')
        setTimeout(() => setSaveMessage(null), 3000)
      } else {
        setErrorMessage(result.error.messageAr ?? result.error.message)
      }
    },
    [deviceId]
  )

  // Flag Row
  const handleFlagRow = useCallback(
    async (row: ReviewRow) => {
      if (!deviceId) return
      setIsSaving(true)
      setErrorMessage(null)
      setSaveMessage(null)

      const result = await reviewApi.setStatus(row, 'flagged', null, deviceId)
      setIsSaving(false)
      if (result.ok) {
        applyRowUpdate(result.data)
        setSaveMessage('تم تعليم الموضع للمراجعة ⚑')
        setTimeout(() => setSaveMessage(null), 3000)
      } else {
        setErrorMessage(result.error.messageAr ?? result.error.message)
      }
    },
    [deviceId]
  )

  // Save Row Edits (fields + narrators)
  const handleSaveRowEdits = useCallback(
    async (row: ReviewRow, fields: EntryFields, narrators: NarratorInput[]) => {
      if (!deviceId) return
      setIsSaving(true)
      setErrorMessage(null)
      setSaveMessage(null)

      // 1. Update entry fields
      const updateRes = await reviewApi.updateEntry(row, fields, deviceId)
      if (!updateRes.ok) {
        setIsSaving(false)
        setErrorMessage(updateRes.error.messageAr ?? updateRes.error.message)
        return
      }

      // 2. Update narrators
      const updatedRow = updateRes.data
      const narratorsRes = await reviewApi.setNarrators(updatedRow, narrators, deviceId)
      setIsSaving(false)
      if (!narratorsRes.ok) {
        applyRowUpdate(updatedRow)
        setErrorMessage(narratorsRes.error.messageAr ?? narratorsRes.error.message)
        return
      }

      applyRowUpdate(narratorsRes.data)
      setSaveMessage('تم حفظ التعديلات بنجاح ✓')
      setTimeout(() => setSaveMessage(null), 3000)
    },
    [deviceId]
  )

  // Create New Entry (State C)
  const handleCreateNewEntry = useCallback(
    async (draft: CreateEntryInput) => {
      if (!deviceId) return
      setIsSaving(true)
      setErrorMessage(null)
      setSaveMessage(null)

      const result = await reviewApi.createEntry(draft, deviceId)
      setIsSaving(false)
      if (result.ok) {
        applyRowUpdate(result.data)
        setSelectedRowId(result.data.entryId)
        setNewEntryDraft(null)
        setSaveMessage('تمت إضافة القراءة بنجاح إلى قاعدة البيانات ✓')
        setTimeout(() => setSaveMessage(null), 4000)
      } else {
        setErrorMessage(result.error.messageAr ?? result.error.message)
      }
    },
    [deviceId]
  )

  // Delete Row (Soft delete with undo)
  const handleDeleteRow = useCallback(
    async (row: ReviewRow) => {
      if (!deviceId) return
      if (!window.confirm('هل أنت متأكد من حذف هذا الموضع؟ يمكن التراجع بعد الحذف.')) return
      setIsSaving(true)
      setErrorMessage(null)
      setSaveMessage(null)

      const result = await reviewApi.deleteEntry(row, 'حذف من شاشة المراجعة', deviceId)
      setIsSaving(false)
      if (result.ok) {
        applyRowUpdate(result.data)
        setSelectedRowId(null)
        setUndoBanner({ message: 'تم حذف الموضع بنجاح. يمكنك استرجاعه من سجل التعديلات.' })
        setTimeout(() => setUndoBanner(null), 8000)
      } else {
        setErrorMessage(result.error.messageAr ?? result.error.message)
      }
    },
    [deviceId]
  )

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return
      if (event.metaKey || event.ctrlKey || event.altKey) return

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        goToPage(pageNumber + 1)
        return
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        goToPage(pageNumber - 1)
        return
      }
      if (event.key === 'r' && selectedRow && deviceId) {
        event.preventDefault()
        void handleConfirmRow(selectedRow)
        return
      }
      if (event.key === 'f' && selectedRow && deviceId) {
        event.preventDefault()
        void handleFlagRow(selectedRow)
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        setSelectedWordKey(null)
        setSelectedWordMeta(null)
        setSelectedRowId(null)
        setNewEntryDraft(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [pageNumber, goToPage, selectedRow, deviceId, handleConfirmRow, handleFlagRow])

  return (
    <div dir="rtl" lang="ar" className="flex h-dvh flex-col bg-[var(--color-paper)]">
      <ReviewNav
        pageNumber={pageNumber}
        page={page}
        overview={overview}
        historyOpen={historyOpen}
        onGoToPage={goToPage}
        onToggleHistory={() => setHistoryOpen((open) => !open)}
      />

      {/* Undo Notification Banner */}
      {undoBanner ? (
        <div className="flex items-center justify-between bg-amber-500 px-4 py-1.5 text-xs font-bold text-white shadow-sm">
          <span>{undoBanner.message}</span>
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="rounded bg-white/20 px-2 py-0.5 hover:bg-white/30"
          >
            فتح سجل التعديلات
          </button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {pageLoading || !page ? (
          <div className="flex flex-1 items-center justify-center">
            {pageError ? (
              <p
                className="rounded-md border border-[var(--color-danger)]/30 bg-[var(--color-danger-bg)] px-4 py-2 text-sm font-bold text-[var(--color-danger)]"
                role="alert"
              >
                {pageError}
              </p>
            ) : (
              <p className="text-sm text-[var(--color-ink-muted)]">جارٍ تحميل الصفحة…</p>
            )}
          </div>
        ) : (
          <>
            {/* RIGHT PANE: Authentic Mushaf-1441 Layout */}
            <ReviewMushafPane
              page={page}
              selectedWordKey={selectedWordKey}
              selectedRow={selectedRow}
              hoveredRowId={hoveredRowId}
              onSelectWord={handleSelectWord}
              onHoverWord={(rowIds) => setHoveredRowId(rowIds?.[0] ?? null)}
            />

            {/* LEFT PANE: Compact High-Speed Single-Word Editor */}
            <ReviewEditorPane
              page={page}
              selectedWordKey={selectedWordKey}
              selectedWordMeta={selectedWordMeta}
              selectedRow={selectedRow}
              activeRowsForWord={activeRowsForWord}
              newEntryDraft={newEntryDraft}
              onSelectRow={(row) => setSelectedRowId(row.entryId)}
              onStartNewEntry={handleStartNewEntry}
              onCancelNewEntry={handleCancelNewEntry}
              onConfirmRow={handleConfirmRow}
              onFlagRow={handleFlagRow}
              onSaveRowEdits={handleSaveRowEdits}
              onDeleteRow={handleDeleteRow}
              onCreateNewEntry={handleCreateNewEntry}
              isSaving={isSaving}
              saveMessage={saveMessage}
              errorMessage={errorMessage}
            />

            {/* History & Undo Side Drawer */}
            {historyOpen ? (
              <HistoryPanel
                page={pageNumber}
                deviceId={deviceId}
                onClose={() => setHistoryOpen(false)}
                onUndone={reloadCurrentPage}
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
