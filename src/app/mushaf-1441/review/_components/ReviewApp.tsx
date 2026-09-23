'use client'

// Client screen for the Phase 4 qiraat review route.
//
// D9 — page text on the RIGHT, variant table on the LEFT: enforced structurally by DOM order
// inside a `dir="rtl"` flex row (the first child sits at the inline start, i.e. the right edge,
// in RTL). PagePane renders first; the table+editor column renders second.
//
// D7 — instant save lives in RowEditor/NarratorEditor; this component only owns page-level state
// (which page, which row is selected, filters, history) and reloads the row/page after a write.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReviewOverview, ReviewPage, ReviewRow } from '../_lib/types'
import HistoryPanel from './HistoryPanel'
import PagePane from './PagePane'
import ReviewNav from './ReviewNav'
import RowEditor from './RowEditor'
import { filterReviewRows, type KindFilter, type StatusFilter } from './statusMeta'
import VariantTable from './VariantTable'
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

  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')

  const [historyOpen, setHistoryOpen] = useState(false)
  const [deviceId, setDeviceId] = useState('')

  const rowRefs = useRef(new Map<string, HTMLButtonElement>())

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

  // Initial load.
  useEffect(() => {
    void loadPage(pageNumber)
    void loadOverview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const goToPage = useCallback(
    (target: number) => {
      const clamped = clampPage(target)
      setPageNumber(clamped)
      setSelectedRowId(null)
      setHoveredRowId(null)
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
      return { ...current, rows }
    })
    void loadOverview()
  }

  const filteredRows = useMemo(
    () => (page ? filterReviewRows(page.rows, statusFilter, kindFilter) : []),
    [page, statusFilter, kindFilter]
  )

  const selectedRow = page?.rows.find((row) => row.entryId === selectedRowId) ?? null

  function selectRow(row: ReviewRow) {
    setSelectedRowId(row.entryId)
  }

  function selectWord(key: string) {
    if (!page) return
    const covering = page.rows.filter((row) => !row.deleted && row.startKey <= key && key <= row.endKey)
    if (!covering.length) return
    setSelectedRowId(covering[0].entryId)
  }

  useEffect(() => {
    if (!selectedRowId) return
    const el = rowRefs.current.get(selectedRowId)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedRowId])

  // Keyboard shortcuts: <- -> pages, j/k rows, r = reviewed, f = flagged.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return
      if (event.metaKey || event.ctrlKey || event.altKey) return

      // Arabic mushaf convention: the next page is to the left.
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
      if (event.key === 'j' || event.key === 'k') {
        if (!filteredRows.length) return
        event.preventDefault()
        const currentIndex = filteredRows.findIndex((row) => row.entryId === selectedRowId)
        const nextIndex =
          event.key === 'j'
            ? Math.min(filteredRows.length - 1, currentIndex + 1)
            : Math.max(0, currentIndex === -1 ? 0 : currentIndex - 1)
        setSelectedRowId(filteredRows[nextIndex].entryId)
        return
      }
      if ((event.key === 'r' || event.key === 'f') && selectedRow && deviceId) {
        event.preventDefault()
        const status = event.key === 'r' ? 'reviewed' : 'flagged'
        void reviewApi.setStatus(selectedRow, status, null, deviceId).then((result) => {
          if (result.ok) applyRowUpdate(result.data)
        })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [pageNumber, goToPage, filteredRows, selectedRowId, selectedRow, deviceId])

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
            <PagePane
              page={page}
              selectedRow={selectedRow}
              hoveredRowId={hoveredRowId}
              onSelectWord={selectWord}
              onHoverWord={(rowIds) => setHoveredRowId(rowIds?.[0] ?? null)}
            />

            <div className="flex w-full max-w-[560px] shrink-0 flex-col overflow-hidden border-e border-[var(--color-border)]">
              <VariantTable
                page={page}
                selectedRowId={selectedRowId}
                hoveredRowId={hoveredRowId}
                statusFilter={statusFilter}
                kindFilter={kindFilter}
                onStatusFilterChange={setStatusFilter}
                onKindFilterChange={setKindFilter}
                onSelectRow={selectRow}
                onHoverRow={setHoveredRowId}
                registerRowRef={(entryId, el) => {
                  if (el) rowRefs.current.set(entryId, el)
                  else rowRefs.current.delete(entryId)
                }}
              />
              {selectedRow ? (
                <RowEditor
                  row={selectedRow}
                  page={page}
                  deviceId={deviceId}
                  onRowUpdated={applyRowUpdate}
                  onReloadPage={reloadCurrentPage}
                  onClose={() => setSelectedRowId(null)}
                />
              ) : null}
            </div>

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
