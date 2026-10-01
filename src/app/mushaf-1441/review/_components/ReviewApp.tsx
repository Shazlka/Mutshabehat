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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  CatalogNarrator,
  CreateEntryInput,
  EntryFields,
  NarratorInput,
  ReviewNarrator,
  ReviewOverview,
  ReviewPage,
  ReviewRow,
} from '../_lib/types'
import HistoryPanel from './HistoryPanel'
import ReviewMushafPane from './ReviewMushafPane'
import ReviewStatsBar from './ReviewStatsBar'
import ReviewEditorPane, { type WordMeta } from './ReviewEditorPane'
import ReviewNav from './ReviewNav'
import MobileReviewMushafView from './MobileReviewMushafView'
import MobileReviewEditorView from './MobileReviewEditorView'
import ReviewSaveStatusBar, { type SaveFailure } from './ReviewSaveStatusBar'
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

function findNextReviewWord(
  page: ReviewPage | null,
  currentWordKey: string | null
): { key: string; meta: WordMeta } | null {
  if (!page || page.words.length === 0) return null

  // 1. Build a set of keys for rows needing review (unreviewed or flagged)
  const rowsNeedingReview = page.rows.filter(
    (r) => !r.deleted && (r.reviewStatus === 'unreviewed' || r.reviewStatus === 'flagged')
  )

  const wordsNeedingReview = page.words.filter((w) =>
    rowsNeedingReview.some((r) => r.startKey <= w.key && w.key <= r.endKey)
  )

  if (wordsNeedingReview.length > 0) {
    if (currentWordKey) {
      const after = wordsNeedingReview.find((w) => w.key > currentWordKey)
      if (after) {
        return {
          key: after.key,
          meta: { surah: after.surah, ayah: after.ayah, word: after.word, text: after.text, page: page.page },
        }
      }
      const first = wordsNeedingReview[0]
      if (first.key !== currentWordKey) {
        return {
          key: first.key,
          meta: { surah: first.surah, ayah: first.ayah, word: first.word, text: first.text, page: page.page },
        }
      }
    } else {
      const first = wordsNeedingReview[0]
      return {
        key: first.key,
        meta: { surah: first.surah, ayah: first.ayah, word: first.word, text: first.text, page: page.page },
      }
    }
  }

  // 2. Fallback: find any word with existing variants
  const activeRows = page.rows.filter((r) => !r.deleted)
  const wordsWithVariants = page.words.filter((w) =>
    activeRows.some((r) => r.startKey <= w.key && w.key <= r.endKey)
  )
  if (wordsWithVariants.length > 0) {
    if (currentWordKey) {
      const after = wordsWithVariants.find((w) => w.key > currentWordKey)
      if (after) {
        return {
          key: after.key,
          meta: { surah: after.surah, ayah: after.ayah, word: after.word, text: after.text, page: page.page },
        }
      }
    }
    const first = wordsWithVariants[0]
    if (first.key !== currentWordKey) {
      return {
        key: first.key,
        meta: { surah: first.surah, ayah: first.ayah, word: first.word, text: first.text, page: page.page },
      }
    }
  }

  // 3. Fallback: next word in sequence
  if (currentWordKey) {
    const currentIndex = page.words.findIndex((w) => w.key === currentWordKey)
    if (currentIndex >= 0 && currentIndex < page.words.length - 1) {
      const nextWord = page.words[currentIndex + 1]
      return {
        key: nextWord.key,
        meta: { surah: nextWord.surah, ayah: nextWord.ayah, word: nextWord.word, text: nextWord.text, page: page.page },
      }
    }
  }

  return null
}

// ── Optimistic saves ────────────────────────────────────────────────────────────────────────────
// A save shows its result at once and finishes in the background (see submitSave); these build the
// row the reviewer sees in the meantime. The server's row replaces it when the request returns.

const TEMP_ROW_PREFIX = 'tmp-'
const isPendingRow = (row: { entryId: string }) => row.entryId.startsWith(TEMP_ROW_PREFIX)
const pad3 = (n: number) => String(n).padStart(3, '0')
const wordKey = (surah: number, ayah: number, word: number) => `${pad3(surah)}:${pad3(ayah)}:${pad3(word)}`

function toReviewNarrators(inputs: NarratorInput[], catalog: CatalogNarrator[]): ReviewNarrator[] {
  return inputs.map((input) => {
    const known = catalog.find((c) => c.id === input.id)
    return {
      id: input.id,
      code: known?.code ?? null,
      nameAr: known?.nameAr ?? input.id,
      action: input.action ?? null,
      wajhOrder: input.wajhOrder ?? 1,
      wajhNote: input.wajhNote ?? null,
    }
  })
}

function applyFieldsToRow(
  row: ReviewRow,
  fields: EntryFields,
  narrators: NarratorInput[],
  page: ReviewPage,
): ReviewRow {
  const next: ReviewRow = { ...row, narrators: toReviewNarrators(narrators, page.narrators) }
  if (fields.kind !== undefined) next.kind = fields.kind
  if (fields.readingText !== undefined) next.readingText = fields.readingText
  if (fields.uthmaniText !== undefined) next.uthmaniText = fields.uthmaniText
  if (fields.description !== undefined) next.description = fields.description
  if (fields.performanceNote !== undefined) next.performanceNote = fields.performanceNote
  if (fields.variantType !== undefined) next.variantType = fields.variantType
  if (fields.rulingText !== undefined) next.rulingText = fields.rulingText
  if (fields.appliesWasl !== undefined) next.appliesWasl = fields.appliesWasl
  if (fields.appliesWaqf !== undefined) next.appliesWaqf = fields.appliesWaqf
  if (fields.hamzahDetail !== undefined) next.hamzahDetail = fields.hamzahDetail
  if (fields.categoryCode !== undefined) {
    next.categoryCode = fields.categoryCode
    next.categoryNameAr = page.categories.find((c) => c.code === fields.categoryCode)?.nameAr ?? row.categoryNameAr
  }
  return next
}

function buildTempRow(tempId: string, draft: CreateEntryInput, page: ReviewPage): ReviewRow {
  const endAyah = draft.endAyah ?? draft.ayah
  const endWord = draft.endWord ?? draft.startWord
  const startKey = wordKey(draft.surah, draft.ayah, draft.startWord)
  const endKey = wordKey(draft.surah, endAyah, endWord)
  const hafsText = page.words.filter((w) => w.key >= startKey && w.key <= endKey).map((w) => w.text).join(' ')
  return {
    entryId: tempId,
    locationId: '',
    version: '',
    kind: draft.kind,
    categoryCode: draft.categoryCode ?? null,
    categoryNameAr: page.categories.find((c) => c.code === draft.categoryCode)?.nameAr ?? null,
    surah: draft.surah,
    ayah: draft.ayah,
    startWord: draft.startWord,
    endAyah,
    endWord,
    startKey,
    endKey,
    page: page.page,
    hafsText,
    readingText: draft.readingText ?? null,
    uthmaniText: draft.uthmaniText ?? null,
    description: draft.description ?? null,
    performanceNote: draft.performanceNote ?? null,
    variantType: draft.variantType ?? null,
    rulingText: draft.rulingText ?? null,
    options: null,
    notes: draft.notes ?? null,
    reviewStatus: 'unreviewed',
    locationReviewStatus: 'unreviewed',
    verificationStatus: 'REVIEWED',
    legacyRef: null,
    entryOrder: 9999,
    deleted: false,
    appliesWasl: draft.appliesWasl ?? true,
    appliesWaqf: draft.appliesWaqf ?? true,
    hamzahDetail: draft.hamzahDetail ?? null,
    narrators: toReviewNarrators(draft.narrators, page.narrators),
    flags: [],
  }
}

function pageStats(rows: ReviewRow[]): ReviewPage['stats'] {
  const live = rows.filter((r) => !r.deleted)
  return {
    total: live.length,
    unreviewed: live.filter((r) => r.reviewStatus === 'unreviewed').length,
    reviewed: live.filter((r) => r.reviewStatus === 'reviewed').length,
    flagged: live.filter((r) => r.reviewStatus === 'flagged').length,
    deleted: rows.length - live.length,
  }
}

type SaveJob = {
  label: string
  /** Jobs sharing a key run one after another (same entry / same locus); others run in parallel. */
  chainKey: string
  run(): Promise<{ ok: true } | { ok: false; message: string }>
  /** Undo the optimistic change after `run` failed (the page is also re-read from the server). */
  onFail(): void
  /** Put the optimistic change back before a retry. */
  redo(): void
}

export default function ReviewApp({ initialPage }: { initialPage: number }) {
  const [pageNumber, setPageNumber] = useState(() => clampPage(initialPage))
  const [page, setPage] = useState<ReviewPage | null>(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)

  const [overview, setOverview] = useState<ReviewOverview | null>(null)

  // Latest page/pageNumber for background save jobs, which outlive the render that started them.
  const pageRef = useRef<ReviewPage | null>(null)
  const pageNumberRef = useRef(pageNumber)
  const selectedWordKeyRef = useRef<string | null>(null)
  useEffect(() => {
    pageRef.current = page
    pageNumberRef.current = pageNumber
  }, [page, pageNumber])

  // Selection state
  const [selectedWordKey, setSelectedWordKey] = useState<string | null>(null)
  const [selectedWordMeta, setSelectedWordMeta] = useState<WordMeta | null>(null)
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  useEffect(() => {
    selectedWordKeyRef.current = selectedWordKey
  }, [selectedWordKey])
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null)

  // Feature 1: Ctrl/Cmd-click (desktop) or "ربط بالكلمة التالية" (mobile) multi-word span
  // selection -- `selectedWordKey`/`selectedWordMeta` above stay the anchor; these two track
  // the span's second endpoint, an ordered pair by canonical key.
  const [spanEndKey, setSpanEndKey] = useState<string | null>(null)
  const [spanEndMeta, setSpanEndMeta] = useState<WordMeta | null>(null)
  // Mobile touch equivalent of holding Ctrl while clicking: a one-shot "armed" toggle that the
  // next word tap consumes and then clears.
  const [linkModeActive, setLinkModeActive] = useState(false)

  const clearSpanSelection = useCallback(() => {
    setSpanEndKey(null)
    setSpanEndMeta(null)
    setLinkModeActive(false)
  }, [])

  const toggleLinkMode = useCallback(() => {
    setLinkModeActive((v) => !v)
  }, [])

  // New entry draft (for State C: unhighlighted words)
  const [newEntryDraft, setNewEntryDraft] = useState<CreateEntryInput | null>(null)

  // Feedback & saving state
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [undoBanner, setUndoBanner] = useState<{ txid?: number; message: string } | null>(null)

  const [historyOpen, setHistoryOpen] = useState(false)
  const [deviceId, setDeviceId] = useState('')

  // Mobile review state & viewport
  const [isMobile, setIsMobile] = useState(false)
  const [mobileView, setMobileView] = useState<'mushaf' | 'editor'>('mushaf')
  const mushafScrollRef = useRef<HTMLDivElement | null>(null)
  const mushafScrollPosRef = useRef<number>(0)
  const [zoom, setZoom] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mushaf_review_mobile_zoom')
      if (saved) {
        const parsed = parseFloat(saved)
        if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 2) return parsed
      }
    }
    return 1
  })

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)')
    setIsMobile(mql.matches)
    const handler = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches)
    }
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  const handleChangeZoom = useCallback((newZoom: number) => {
    setZoom(newZoom)
    if (typeof window !== 'undefined') {
      localStorage.setItem('mushaf_review_mobile_zoom', String(newZoom))
    }
  }, [])

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
      setMobileView('mushaf')
      setSelectedWordKey(null)
      setSelectedWordMeta(null)
      setSelectedRowId(null)
      setNewEntryDraft(null)
      setHoveredRowId(null)
      setErrorMessage(null)
      setSaveMessage(null)
      clearSpanSelection()
      void loadPage(clamped)
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href)
        url.searchParams.set('page', String(clamped))
        url.searchParams.delete('word')
        window.history.replaceState(window.history.state, '', url)
      }
    },
    [loadPage, clearSpanSelection]
  )

  const reloadCurrentPage = useCallback(async () => {
    await loadPage(pageNumber)
    await loadOverview()
  }, [loadPage, loadOverview, pageNumber])

  // The overview is a 39 KB / ~1 s request; a burst of saves refreshes it once, not once per save.
  const overviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleOverviewRefresh = useCallback(() => {
    if (overviewTimerRef.current) clearTimeout(overviewTimerRef.current)
    overviewTimerRef.current = setTimeout(() => {
      overviewTimerRef.current = null
      void loadOverview()
    }, 1500)
  }, [loadOverview])

  // Insert or replace a row (optionally replacing `replaceId`, the optimistic placeholder). Rows of
  // another page are ignored: a save can finish after the reviewer has turned the page.
  function upsertRow(row: ReviewRow, replaceId?: string) {
    if (row.page !== pageNumberRef.current) return
    setPage((current) => {
      if (!current) return current
      const at = current.rows.findIndex((r) => r.entryId === (replaceId ?? row.entryId))
      const existing = current.rows.findIndex((r) => r.entryId === row.entryId)
      let rows: ReviewRow[]
      if (at >= 0) {
        rows = current.rows.map((r, i) => (i === at ? row : r))
        if (existing >= 0 && existing !== at) rows = rows.filter((r, i) => i !== existing)
      } else if (existing >= 0) {
        rows = current.rows.map((r, i) => (i === existing ? row : r))
      } else {
        rows = [...current.rows, row]
      }
      return { ...current, rows, stats: pageStats(rows) }
    })
    scheduleOverviewRefresh()
  }

  function applyRowUpdate(row: ReviewRow) {
    upsertRow(row)
  }

  function removeRow(entryId: string) {
    setPage((current) => {
      if (!current) return current
      const rows = current.rows.filter((r) => r.entryId !== entryId)
      return { ...current, rows, stats: pageStats(rows) }
    })
  }

  // Re-read the current page without blanking it (loadPage shows the loading screen).
  const reloadSilent = useCallback(async () => {
    const target = pageNumberRef.current
    const result = await reviewApi.getReviewPage(target, true)
    if (result.ok && target === pageNumberRef.current) setPage(result.data)
    scheduleOverviewRefresh()
  }, [scheduleOverviewRefresh])

  // ── Background save queue ────────────────────────────────────────────────────────────────────
  const chainsRef = useRef(new Map<string, Promise<void>>())
  const pendingRef = useRef(0)
  const failureSeqRef = useRef(0)
  const tempSeqRef = useRef(0)
  const [pendingSaves, setPendingSaves] = useState(0)
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [saveFailures, setSaveFailures] = useState<SaveFailure[]>([])
  const submitSaveRef = useRef<(job: SaveJob) => void>(() => {})

  const submitSave = useCallback(
    (job: SaveJob) => {
      pendingRef.current += 1
      setPendingSaves(pendingRef.current)
      const previous = chainsRef.current.get(job.chainKey) ?? Promise.resolve()
      const next = previous.then(async () => {
        let outcome: { ok: true } | { ok: false; message: string }
        try {
          outcome = await job.run()
        } catch {
          outcome = { ok: false, message: 'تعذّر الاتصال بالخادم' }
        }
        pendingRef.current -= 1
        setPendingSaves(pendingRef.current)
        if (outcome.ok) {
          setLastSavedAt(Date.now())
        } else {
          job.onFail()
          const id = ++failureSeqRef.current
          const dismiss = () => setSaveFailures((list) => list.filter((f) => f.id !== id))
          setSaveFailures((list) => [
            ...list,
            {
              id,
              label: job.label,
              message: outcome.message,
              dismiss,
              retry: () => {
                dismiss()
                job.redo()
                submitSaveRef.current(job)
              },
            },
          ])
        }
        // Once the queue is empty, reconcile with the server in the background.
        if (pendingRef.current === 0) void reloadSilent()
      })
      chainsRef.current.set(job.chainKey, next)
    },
    [reloadSilent],
  )
  useEffect(() => {
    submitSaveRef.current = submitSave
  }, [submitSave])

  // Leaving with a save still in flight would lose it.
  useEffect(() => {
    if (pendingSaves === 0) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [pendingSaves])

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
    (key: string, meta: WordMeta, extend = false, openEditorOnMobile = true) => {
      if (mushafScrollRef.current) {
        mushafScrollPosRef.current = mushafScrollRef.current.scrollTop
      }

      // Feature 1: Ctrl/Cmd-click (or mobile "ربط بالكلمة التالية") on a second word extends
      // the current selection into a two-word span instead of replacing it. The anchor word
      // (selectedWordKey/selectedWordMeta) never changes here; only the span end does. When a
      // new-entry draft is open, its span (surah/ayah/startWord .. endAyah/endWord) is kept
      // ordered by canonical key so it never matters which word was clicked first.
      if (extend && selectedWordKey && selectedWordMeta && key !== selectedWordKey) {
        setSpanEndKey(key)
        setSpanEndMeta(meta)
        setLinkModeActive(false)
        setErrorMessage(null)
        setSaveMessage(null)

        const anchorKey = selectedWordKey
        const anchorMeta = selectedWordMeta
        const [startMeta, endMeta] = anchorKey <= key ? [anchorMeta, meta] : [meta, anchorMeta]
        // A brand-new word (State C) auto-opens the draft with just its own single-word text
        // (see the `setNewEntryDraft` call below, and the mirror in `handleStartNewEntry`).
        // Extending that draft into a two-word span must recompute the reading text from BOTH
        // words -- this is the actual live path a Ctrl-click span goes through in practice
        // (select an unhighlighted word, then Ctrl-click its neighbour); the position-only merge
        // below previously left "نص القراءة المقروء به:" stuck on the first word alone.
        const combinedText = `${startMeta.text} ${endMeta.text}`

        setNewEntryDraft((current) =>
          current
            ? {
                ...current,
                surah: startMeta.surah,
                ayah: startMeta.ayah,
                startWord: startMeta.word,
                endAyah: endMeta.ayah,
                endWord: endMeta.word,
                readingText: combinedText,
                uthmaniText: combinedText,
              }
            : current
        )
        return
      }

      clearSpanSelection()
      setSelectedWordKey(key)
      setSelectedWordMeta(meta)
      setErrorMessage(null)
      setSaveMessage(null)

      if (openEditorOnMobile && typeof window !== 'undefined') {
        const isMobileScreen = window.matchMedia('(max-width: 767px)').matches
        if (isMobileScreen) {
          setMobileView('editor')
          const url = new URL(window.location.href)
          url.searchParams.set('word', key)
          window.history.pushState({ mobileView: 'editor', wordKey: key, page: pageNumber }, '', url)
        }
      }

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
    [page, pageNumber, selectedWordKey, selectedWordMeta, clearSpanSelection]
  )

  const handleMobileBack = useCallback(() => {
    setMobileView('mushaf')
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.delete('word')
      window.history.replaceState(window.history.state, '', url)
      requestAnimationFrame(() => {
        if (mushafScrollRef.current) {
          mushafScrollRef.current.scrollTop = mushafScrollPosRef.current
        }
      })
    }
  }, [])

  const handleMobileSaveAndNext = useCallback(async () => {
    if (!page) return
    const next = findNextReviewWord(page, selectedWordKey)
    if (next) {
      handleSelectWord(next.key, next.meta, false, true)
      setSaveMessage('تم الحفظ، والانتقال للموضع التالي ✓')
      setTimeout(() => setSaveMessage(null), 3000)
    } else {
      setSaveMessage('تم الحفظ بنجاح — لا توجد مواضع أخرى بحاجة للمراجعة في هذه الصفحة ✓')
      setTimeout(() => setSaveMessage(null), 4000)
    }
  }, [page, selectedWordKey, handleSelectWord])

  // Browser history popstate handler (for mobile Back button)
  useEffect(() => {
    function onPopState(e: PopStateEvent) {
      if (typeof window === 'undefined') return
      const isMobileScreen = window.matchMedia('(max-width: 767px)').matches
      if (!isMobileScreen) return

      if (e.state && e.state.mobileView === 'editor' && e.state.wordKey) {
        setMobileView('editor')
      } else {
        setMobileView('mushaf')
        requestAnimationFrame(() => {
          if (mushafScrollRef.current) {
            mushafScrollRef.current.scrollTop = mushafScrollPosRef.current
          }
        })
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  // Start new entry for a word (even if other variants already exist on it). If a Ctrl-click
  // span is currently active for the anchor word, the new entry starts pre-populated with that
  // span's ordered end point.
  const handleStartNewEntry = useCallback(
    (meta: WordMeta) => {
      setSelectedRowId(null)

      // If a Ctrl-click span is active for this word (i.e. `meta` is the current anchor),
      // pre-populate the new entry with the span's ordered end point instead of a single word --
      // and the reading/uthmani text must carry BOTH spanned words, in Quran reading order, not
      // just the anchor's own text (a two-word entry like إدغام كبير/الهمزتان من كلمتين needs the
      // whole span's text to start from, not half of it).
      let endAyah = meta.ayah
      let endWord = meta.word
      let combinedText = meta.text
      if (spanEndKey && spanEndMeta && selectedWordKey) {
        const anchorIsEarlier = selectedWordKey <= spanEndKey
        const endMeta = anchorIsEarlier ? spanEndMeta : meta
        endAyah = endMeta.ayah
        endWord = endMeta.word
        combinedText = anchorIsEarlier ? `${meta.text} ${spanEndMeta.text}` : `${spanEndMeta.text} ${meta.text}`
      }

      setNewEntryDraft({
        surah: meta.surah,
        ayah: meta.ayah,
        startWord: meta.word,
        endAyah,
        endWord,
        kind: 'farsh',
        readingText: combinedText,
        uthmaniText: combinedText,
        narrators: [],
      })
    },
    [spanEndKey, spanEndMeta, selectedWordKey]
  )

  const handleCancelNewEntry = useCallback(() => {
    setNewEntryDraft(null)
    clearSpanSelection()
    if (activeRowsForWord.length > 0) {
      setSelectedRowId(activeRowsForWord[0].entryId)
    } else {
      setSelectedWordKey(null)
      setSelectedWordMeta(null)
    }
  }, [activeRowsForWord, clearSpanSelection])

  // 1-Click Confirm Row
  const handleConfirmRow = useCallback(
    async (row: ReviewRow) => {
      if (!deviceId) return
      if (isPendingRow(row)) {
        setErrorMessage('هذا الوجه ما زال قيد الحفظ — انتظر لحظة')
        return
      }
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
      if (isPendingRow(row)) {
        setErrorMessage('هذا الوجه ما زال قيد الحفظ — انتظر لحظة')
        return
      }
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

  // Save Row Edits (fields + narrators). Optimistic: the row updates at once and the two requests
  // (fields, then narrators) run in the background; progress and failures show in the status bar.
  const handleSaveRowEdits = useCallback(
    async (row: ReviewRow, fields: EntryFields, narrators: NarratorInput[]) => {
      if (!deviceId) return
      if (narrators.length === 0) {
        setErrorMessage('يجب اختيار راوٍ واحد على الأقل')
        return
      }
      if (isPendingRow(row)) {
        setErrorMessage('هذا الوجه ما زال قيد الحفظ — انتظر لحظة ثم عدّله')
        return
      }
      const current = pageRef.current
      if (!current) return
      setErrorMessage(null)
      setSaveMessage(null)

      const optimistic = () => {
        const base = pageRef.current?.rows.find((r) => r.entryId === row.entryId) ?? row
        upsertRow(applyFieldsToRow(base, fields, narrators, pageRef.current ?? current))
      }
      optimistic()

      submitSave({
        label: 'حفظ التعديلات',
        chainKey: `entry:${row.entryId}`,
        run: async () => {
          // Read the version at run time: an earlier queued save of this entry may have bumped it.
          const latest = pageRef.current?.rows.find((r) => r.entryId === row.entryId) ?? row
          const updateRes = await reviewApi.updateEntry(latest, fields, deviceId)
          if (!updateRes.ok) return { ok: false, message: updateRes.error.messageAr ?? updateRes.error.message }
          const narratorsRes = await reviewApi.setNarrators(updateRes.data, narrators, deviceId)
          if (!narratorsRes.ok) {
            upsertRow(updateRes.data)
            return { ok: false, message: narratorsRes.error.messageAr ?? narratorsRes.error.message }
          }
          upsertRow(narratorsRes.data)
          return { ok: true }
        },
        onFail: () => void reloadSilent(),
        redo: optimistic,
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deviceId, submitSave, reloadSilent]
  )

  // Create New Entry (State C). Returns whether the save actually succeeded, so callers that
  // need to know (e.g. the nquran.com reference panel's "أُضيف" confirmation) don't have to guess
  // from stale props -- most callers still just fire-and-forget it, which remains fine since a
  // resolved boolean is simply a value they can ignore. `options.autoVerify` marks the freshly
  // created row reviewed/verified in the same round trip (used by the nquran.com "إضافة كوجه"
  // button, per the owner's explicit request -- every other caller leaves the new row unreviewed,
  // same as before).
  const handleCreateNewEntry = useCallback(
    async (draft: CreateEntryInput, options?: { autoVerify?: boolean }): Promise<boolean> => {
      if (!deviceId) return false
      const current = pageRef.current
      if (!current) return false
      setErrorMessage(null)
      setSaveMessage(null)

      // Optimistic: the new وجه appears (and the draft closes) immediately; the requests run in the
      // background. A placeholder row stands in until the server's row replaces it.
      const tempId = `${TEMP_ROW_PREFIX}${++tempSeqRef.current}`
      const tempRow = buildTempRow(tempId, draft, current)
      let created: ReviewRow | null = null
      upsertRow(tempRow)
      setSelectedRowId(tempId)
      setNewEntryDraft(null)

      submitSave({
        label: 'إضافة وجه',
        chainKey: `loc:${draft.surah}:${draft.ayah}:${draft.startWord}`,
        run: async () => {
          let row = created
          if (!row) {
            const result = await reviewApi.createEntry(draft, deviceId)
            if (!result.ok) return { ok: false, message: result.error.messageAr ?? result.error.message }
            row = result.data
            created = row
            upsertRow(row, tempId)
          }
          const needsUpdate =
            (draft.appliesWasl !== undefined && draft.appliesWasl !== true) ||
            (draft.appliesWaqf !== undefined && draft.appliesWaqf !== true) ||
            draft.hamzahDetail
          if (needsUpdate) {
            const updateRes = await reviewApi.updateEntry(
              row,
              {
                appliesWasl: draft.appliesWasl ?? true,
                appliesWaqf: draft.appliesWaqf ?? true,
                hamzahDetail: draft.hamzahDetail ?? null,
              },
              deviceId
            )
            if (updateRes.ok) {
              row = updateRes.data
              created = row
              upsertRow(row)
            }
          }
          if (options?.autoVerify) {
            const statusRes = await reviewApi.setStatus(row, 'reviewed', null, deviceId)
            if (statusRes.ok) {
              row = statusRes.data
              created = row
              upsertRow(row)
            }
          }
          setSelectedRowId((selected) => (selected === tempId ? row.entryId : selected))
          return { ok: true }
        },
        onFail: () => {
          if (created) {
            // Created on the server; only a follow-up step failed. Keep it (the reload shows the truth).
            void reloadSilent()
            return
          }
          removeRow(tempId)
          setSelectedRowId((selected) => (selected === tempId ? null : selected))
          // Give the reviewer their inputs back if they are still on the same word.
          if (selectedWordKeyRef.current === wordKey(draft.surah, draft.ayah, draft.startWord)) {
            setNewEntryDraft((existing) => existing ?? draft)
          }
          void reloadSilent()
        },
        redo: () => {
          if (!created) {
            upsertRow(tempRow)
            setSelectedRowId(tempId)
            setNewEntryDraft(null)
          }
        },
      })
      return true
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deviceId, submitSave, reloadSilent]
  )

  // Multi-select delete (feature 1): all-or-nothing, version-checked per row.
  const handleBulkDelete = useCallback(
    async (rows: ReviewRow[], note: string | null) => {
      if (!deviceId || rows.length === 0) return
      if (rows.some(isPendingRow)) {
        setErrorMessage('هذا الوجه ما زال قيد الحفظ — انتظر لحظة')
        return
      }
      setIsSaving(true)
      setErrorMessage(null)
      setSaveMessage(null)

      const items = rows.map((r) => ({ entryId: r.entryId, expectedVersion: r.version }))
      const result = await reviewApi.bulkDeleteEntries(items, note, deviceId)
      setIsSaving(false)
      if (result.ok) {
        result.data.deleted.forEach(applyRowUpdate)
        setSelectedRowId(null)
        setUndoBanner({ message: `تم حذف ${result.data.deleted.length} أوجه. يمكن استرجاعها من سجل التعديلات.` })
        setTimeout(() => setUndoBanner(null), 8000)
      } else {
        setErrorMessage(result.error.messageAr ?? result.error.message)
        if (result.error.code === 'VERSION_CONFLICT') void reloadCurrentPage()
      }
    },
    [deviceId, reloadCurrentPage]
  )

  // Copy a previously reviewed configuration onto this occurrence (feature 3). New copy always
  // lands unreviewed -- never share a mutable row across two Quranic locations.
  const handleCopyToOccurrence = useCallback(
    async (sourceEntryId: string, target: { surah: number; ayah: number; startWord: number }) => {
      if (!deviceId) return
      setIsSaving(true)
      setErrorMessage(null)
      setSaveMessage(null)
      const result = await reviewApi.copyEntryToOccurrence(sourceEntryId, target, deviceId)
      setIsSaving(false)
      if (result.ok) {
        setSaveMessage('تم نسخ الوجه إلى هذا الموضع (غير معتمد بعد، بحاجة لمراجعة)')
        setTimeout(() => setSaveMessage(null), 5000)
        await reloadCurrentPage()
        setSelectedRowId(result.data.entryId)
      } else {
        setErrorMessage(result.error.messageAr ?? result.error.message)
      }
    },
    [deviceId, reloadCurrentPage]
  )

  // Apply-to-all-occurrences (feature 7): transactional; skips exact-equivalent matches.
  const handleBulkApply = useCallback(
    async (sourceEntryId: string, targets: { surah: number; ayah: number; word: number }[]) => {
      if (!deviceId) return null
      setIsSaving(true)
      setErrorMessage(null)
      const result = await reviewApi.bulkApply(sourceEntryId, targets, deviceId)
      setIsSaving(false)
      if (result.ok) {
        setSaveMessage(
          `تم تطبيق الوجه على ${result.data.added.length} موضعًا. موجود مسبقًا: ${result.data.skipped.length}.` +
            (result.data.errors.length ? ` تعذّر على ${result.data.errors.length} مواضع.` : '')
        )
        setTimeout(() => setSaveMessage(null), 7000)
        void reloadCurrentPage()
        return result.data
      }
      setErrorMessage(result.error.messageAr ?? result.error.message)
      return null
    },
    [deviceId, reloadCurrentPage]
  )

  // Delete Row (Soft delete with undo)
  const handleDeleteRow = useCallback(
    async (row: ReviewRow) => {
      if (!deviceId) return
      if (isPendingRow(row)) {
        setErrorMessage('هذا الوجه ما زال قيد الحفظ — انتظر لحظة')
        return
      }
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
        clearSpanSelection()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [pageNumber, goToPage, selectedRow, deviceId, handleConfirmRow, handleFlagRow, clearSpanSelection])

  return (
    <div dir="rtl" lang="ar" className="flex h-dvh flex-col bg-[var(--color-paper)]">
      {/* Undo Notification Banner (Shared) */}
      {undoBanner ? (
        <div className="flex items-center justify-between bg-amber-500 px-4 py-1.5 text-xs font-bold text-white shadow-sm z-50">
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

      {pageLoading || !page ? (
        <div className="flex flex-1 items-center justify-center">
          {pageError ? (
            <div className="flex flex-col items-center gap-3">
              <p
                className="rounded-md border border-[var(--color-danger)]/30 bg-[var(--color-danger-bg)] px-4 py-2 text-sm font-bold text-[var(--color-danger)]"
                role="alert"
              >
                {pageError}
              </p>
              <button
                type="button"
                onClick={() => void loadPage(pageNumber)}
                className="min-h-11 rounded-lg bg-[var(--color-primary)] px-5 text-sm font-bold text-[var(--color-paper)] hover:bg-[var(--color-primary-hover)]"
              >
                إعادة المحاولة
              </button>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-ink-muted)]">جارٍ تحميل الصفحة…</p>
          )}
        </div>
      ) : (
        <>
          {/* DESKTOP WORKSPACE (>= 768px): Side-by-side intact */}
          <div className="hidden md:flex flex-col h-full min-h-0 flex-1">
            <ReviewNav
              pageNumber={pageNumber}
              page={page}
              overview={overview}
              historyOpen={historyOpen}
              onGoToPage={goToPage}
              onToggleHistory={() => setHistoryOpen((open) => !open)}
            />

            <div className="flex min-h-0 flex-1 overflow-hidden" dir="rtl">
              {/* RIGHT PANE: Authentic Mushaf-1441 Layout (25% width) */}
              <div className="w-1/4 min-w-[260px] max-w-[32%] flex flex-col h-full overflow-hidden shrink-0 border-l border-[var(--color-border)]">
                <ReviewMushafPane
                  page={page}
                  selectedWordKey={selectedWordKey}
                  selectedRow={selectedRow}
                  hoveredRowId={hoveredRowId}
                  onSelectWord={handleSelectWord}
                  onHoverWord={(rowIds) => setHoveredRowId(rowIds?.[0] ?? null)}
                  spanEndKey={spanEndKey}
                />
                <ReviewStatsBar pageStats={page.stats} overview={overview} />
              </div>

              {/* LEFT PANE: Compact High-Speed Single-Word Editor (75% width) */}
              <div className="w-3/4 flex-1 min-w-0 h-full overflow-hidden flex flex-col">
                <ReviewEditorPane
                  page={page}
                  selectedWordKey={selectedWordKey}
                  selectedWordMeta={selectedWordMeta}
                  selectedRow={selectedRow}
                  activeRowsForWord={activeRowsForWord}
                  newEntryDraft={newEntryDraft}
                  spanEndKey={spanEndKey}
                  spanEndMeta={spanEndMeta}
                  onSelectRow={(row) => setSelectedRowId(row.entryId)}
                  onStartNewEntry={handleStartNewEntry}
                  onCancelNewEntry={handleCancelNewEntry}
                  onConfirmRow={handleConfirmRow}
                  onFlagRow={handleFlagRow}
                  onSaveRowEdits={handleSaveRowEdits}
                  onDeleteRow={handleDeleteRow}
                  onBulkDelete={handleBulkDelete}
                  onCopyToOccurrence={handleCopyToOccurrence}
                  onBulkApply={handleBulkApply}
                  onCreateNewEntry={handleCreateNewEntry}
                  isSaving={isSaving}
                  saveMessage={saveMessage}
                  errorMessage={errorMessage}
                />
              </div>

              {/* History & Undo Side Drawer */}
              {historyOpen ? (
                <HistoryPanel
                  page={pageNumber}
                  deviceId={deviceId}
                  onClose={() => setHistoryOpen(false)}
                  onUndone={reloadCurrentPage}
                />
              ) : null}
            </div>
          </div>

          {/* MOBILE INTERFACE (< 768px): View A (Mushaf) or View B (Dedicated Full-Screen Editor) */}
          <div className="flex md:hidden flex-col h-full min-h-0 flex-1 overflow-hidden">
            {mobileView === 'mushaf' ? (
              <MobileReviewMushafView
                page={page}
                pageNumber={pageNumber}
                overview={overview}
                selectedWordKey={selectedWordKey}
                selectedRow={selectedRow}
                hoveredRowId={hoveredRowId}
                onSelectWord={handleSelectWord}
                onHoverWord={(rowIds) => setHoveredRowId(rowIds?.[0] ?? null)}
                onGoToPage={goToPage}
                onToggleHistory={() => setHistoryOpen((open) => !open)}
                zoom={zoom}
                onChangeZoom={handleChangeZoom}
                scrollContainerRef={mushafScrollRef}
                spanEndKey={spanEndKey}
                linkModeActive={linkModeActive}
                onToggleLinkMode={toggleLinkMode}
              />
            ) : (
              <MobileReviewEditorView
                page={page}
                selectedWordKey={selectedWordKey}
                selectedWordMeta={selectedWordMeta}
                selectedRow={selectedRow}
                activeRowsForWord={activeRowsForWord}
                newEntryDraft={newEntryDraft}
                spanEndKey={spanEndKey}
                spanEndMeta={spanEndMeta}
                onSelectRow={(row) => setSelectedRowId(row.entryId)}
                onStartNewEntry={handleStartNewEntry}
                onCancelNewEntry={handleCancelNewEntry}
                onConfirmRow={handleConfirmRow}
                onFlagRow={handleFlagRow}
                onSaveRowEdits={handleSaveRowEdits}
                onDeleteRow={handleDeleteRow}
                onBulkDelete={handleBulkDelete}
                onCopyToOccurrence={handleCopyToOccurrence}
                onBulkApply={handleBulkApply}
                onCreateNewEntry={handleCreateNewEntry}
                isSaving={isSaving}
                saveMessage={saveMessage}
                errorMessage={errorMessage}
                onBack={handleMobileBack}
                onSaveAndNext={handleMobileSaveAndNext}
              />
            )}

            {historyOpen ? (
              <HistoryPanel
                page={pageNumber}
                deviceId={deviceId}
                onClose={() => setHistoryOpen(false)}
                onUndone={reloadCurrentPage}
              />
            ) : null}
          </div>
        </>
      )}

      <ReviewSaveStatusBar pending={pendingSaves} lastSavedAt={lastSavedAt} failures={saveFailures} />
    </div>
  )
}
