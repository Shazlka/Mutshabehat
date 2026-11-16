'use client'

/**
 * Quran Search Sheet (بحث في القرآن) — iOS parity
 * Features:
 * - Three modes: Smart («ذكي»), Exact («مطابق»), Broad («موسّع»)
 * - Ayah reference parsing («البقرة 255», «2:255»)
 * - Client-side lazy load of public/quran/ayahs.json with module-level caching
 * - Text snippet with search match highlighting
 * - Share button with navigator.share and clipboard fallback
 * - Capped at 200 results with progressive «عرض المزيد» pager
 *
 * References:
 * - iOS: apps/ios/Sources/Reader/AyahSearchView.swift:4–370
 * - iOS: apps/ios/MushafCore/Sources/MushafCore/QuranSearch.swift:3–114
 * - Pure search engine: src/lib/quran-search.ts
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  fetchAyahsData,
  getCachedAyahsData,
  getSearchMatchRanges,
  MAX_SEARCH_RESULTS,
  type QuranSearchMode,
  type QuranSearchResult,
  searchQuran,
} from '@/lib/quran-search'

export interface QuranSearchSheetProps {
  open: boolean
  onClose(): void
  onGoToAyah(surah: number, ayah: number, page: number): void
}

const PAGE_SIZE = 50

const STRINGS = {
  sheetTitle: 'البحث في القرآن',
  close: 'إغلاق',
  searchPlaceholder: 'ابحث في القرآن الكريم أو اكتب رقم الآية (مثل 2:255)...',
  clearSearch: 'مسح البحث',
  submitSearch: 'بحث',
  modeSmart: 'ذكي',
  modeExact: 'مطابق',
  modeBroad: 'موسّع',
  modeSmartDesc: 'البحث الذكي: يشمل ترتيب الكلمات ورقم الآية وتطابق الرسم القرآني',
  modeExactDesc: 'البحث المطابق: يطابق نص الآية كما هي بالعبارة المتصلة',
  modeBroadDesc: 'البحث الموسع: يبحث عن أي كلمة من كلمات البحث',
  totalResults: (count: number) => `إجمالي الآيات في نتائج البحث: ${count}`,
  noResultsTitle: 'لا توجد نتائج',
  noResultsDesc: 'جرّب البحث الموسع أو راجع كتابة الكلمة',
  loadingData: 'جارٍ تجهيز محرك البحث القرآني...',
  errorLoading: 'تعذر تحميل بيانات القرآن. يرجى المحاولة مرة أخرى.',
  retry: 'إعادة المحاولة',
  loadMore: (shown: number, total: number) => `عرض المزيد (${shown} من ${total})`,
  shareAyah: 'مشاركة الآية',
  copiedToast: 'تم نسخ نص الآية إلى الحافظة',
  guideTitle: 'أمثلة للبحث السريع:',
  guideExamples: [
    'الله لا إله إلا هو',
    '2:255',
    'البقرة 255',
    'اهدنا الصراط',
    'رب العالمين',
    'الصلاة والزكاة',
  ],
  ayahPageLabel: (surah: string, ayah: number, page: number) =>
    `سورة ${surah} : آية ${ayah} · صفحة ${page}`,
} as const

function HighlightedAyahText({
  text,
  ranges,
}: {
  text: string
  ranges: Array<[number, number]>
}) {
  if (ranges.length === 0) {
    return <span className="font-quran leading-loose">{text}</span>
  }

  const elements: React.ReactNode[] = []
  let cursor = 0

  ranges.forEach(([start, end], idx) => {
    if (start > cursor) {
      elements.push(text.slice(cursor, start))
    }
    elements.push(
      <mark
        key={`match-${idx}`}
        className="rounded-sm bg-[var(--mushaf-gold,#b99b51)]/35 px-1 font-bold text-[var(--mushaf-ink,#171717)]"
      >
        {text.slice(start, end)}
      </mark>
    )
    cursor = end
  })

  if (cursor < text.length) {
    elements.push(text.slice(cursor))
  }

  return <span className="font-quran leading-loose">{elements}</span>
}

export function QuranSearchSheet({ open, onClose, onGoToAyah }: QuranSearchSheetProps) {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<QuranSearchMode>('smart')
  const [storedResults, setStoredResults] = useState<QuranSearchResult[]>([])
  const [storedHasSearched, setStoredHasSearched] = useState(false)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [loadingData, setLoadingData] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const dialogRef = useRef<HTMLElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const ayahsRef = useRef<Record<string, Record<string, string>> | null>(null)
  const modeListId = useId()

  // Derive "no active query" state during render rather than syncing via useEffect
  const isQueryActive = query.trim().length > 0
  const results = isQueryActive ? storedResults : []
  const hasSearched = isQueryActive && storedHasSearched

  // Focus trap & Escape listener
  useEffect(() => {
    if (!open) return
    const prevActive = document.activeElement as HTMLElement | null
    inputRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null)
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      } else if (!dialogRef.current.contains(document.activeElement)) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (prevActive && document.contains(prevActive)) {
        prevActive.focus()
      }
    }
  }, [open, onClose])

  // Eagerly prefetch or load ayahs data via promise when sheet opens (no synchronous setState in effect)
  useEffect(() => {
    if (!open) return
    if (getCachedAyahsData()) {
      ayahsRef.current = getCachedAyahsData()
      return
    }

    let isMounted = true
    void Promise.resolve()
      .then(() => {
        if (!isMounted) return
        setLoadingData(true)
        setLoadError(false)
        return fetchAyahsData()
      })
      .then((data) => {
        if (isMounted && data) {
          ayahsRef.current = data
          setLoadingData(false)
        }
      })
      .catch(() => {
        if (isMounted) {
          setLoadError(true)
          setLoadingData(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [open])

  // Execute search
  const runSearch = (searchQuery: string, searchMode: QuranSearchMode) => {
    const trimmed = searchQuery.trim()
    if (!trimmed) {
      setStoredResults([])
      setStoredHasSearched(false)
      return
    }

    if (!ayahsRef.current) {
      // Data might still be fetching; fetch and run once loaded
      setLoadingData(true)
      setLoadError(false)
      fetchAyahsData()
        .then((data) => {
          ayahsRef.current = data
          setLoadingData(false)
          const res = searchQuran({ query: trimmed, mode: searchMode, ayahs: data })
          setStoredResults(res)
          setStoredHasSearched(true)
          setVisibleCount(PAGE_SIZE)
        })
        .catch(() => {
          setLoadError(true)
          setLoadingData(false)
        })
      return
    }

    const res = searchQuran({ query: trimmed, mode: searchMode, ayahs: ayahsRef.current })
    setStoredResults(res)
    setStoredHasSearched(true)
    setVisibleCount(PAGE_SIZE)
  }

  // Debounced search on query or mode changes (no synchronous setState in effect body)
  useEffect(() => {
    if (!open) return
    const trimmed = query.trim()
    if (!trimmed) return

    const timer = setTimeout(() => {
      runSearch(trimmed, mode)
    }, 250)

    return () => clearTimeout(timer)
  }, [query, mode, open])

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    runSearch(query, mode)
  }

  const handleClear = () => {
    setQuery('')
    setStoredResults([])
    setStoredHasSearched(false)
    inputRef.current?.focus()
  }

  const handleSelectExample = (example: string) => {
    setQuery(example)
    runSearch(example, mode)
  }

  const handleShare = async (e: React.MouseEvent, item: QuranSearchResult) => {
    e.stopPropagation()
    const shareText = `${item.text}\n\n[سورة ${item.surahName} - آية ${item.ayah} - ص ${item.page}]`

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `سورة ${item.surahName} آية ${item.ayah}`,
          text: shareText,
        })
        return
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return
      }
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareText)
        setToastMessage(STRINGS.copiedToast)
        setTimeout(() => setToastMessage(null), 2500)
      } catch {
        // Clipboard access denied or failed
      }
    }
  }

  const modeDescription = useMemo(() => {
    switch (mode) {
      case 'smart':
        return STRINGS.modeSmartDesc
      case 'exact':
        return STRINGS.modeExactDesc
      case 'broad':
        return STRINGS.modeBroadDesc
    }
  }, [mode])

  if (!open) return null

  const displayedResults = results.slice(0, visibleCount)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs motion-reduce:backdrop-blur-none sm:items-center"
      onClick={onClose}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={STRINGS.sheetTitle}
        dir="rtl"
        className="flex h-[92vh] max-h-full w-full flex-col overflow-hidden bg-[var(--mushaf-cream,#fff7df)] text-[var(--mushaf-ink,#171717)] sm:h-[88vh] sm:max-w-2xl sm:rounded-2xl sm:border sm:border-[var(--mushaf-rule,#d7c7a7)] sm:shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex shrink-0 items-center justify-between border-b border-[var(--mushaf-rule,#d7c7a7)] px-4 py-3">
          <h2 className="text-lg font-black text-[var(--mushaf-ink,#171717)]">
            {STRINGS.sheetTitle}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label={STRINGS.close}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-[var(--mushaf-rule,#d7c7a7)] bg-[var(--mushaf-cream-2,#fffaf0)] px-3 text-sm font-bold text-[var(--mushaf-ink,#171717)] hover:bg-[var(--mushaf-cream-3,#fffdf8)] active:opacity-75"
          >
            {STRINGS.close}
          </button>
        </header>

        {/* Search Controls Strip */}
        <div className="shrink-0 border-b border-[var(--mushaf-rule,#d7c7a7)]/60 bg-[var(--mushaf-cream-2,#fffaf0)] px-4 py-3 space-y-2.5">
          {/* Mode Selector (Segmented Control) */}
          <div
            role="tablist"
            id={modeListId}
            aria-label="نمط البحث"
            className="flex rounded-xl border border-[var(--mushaf-rule,#d7c7a7)] bg-[var(--mushaf-cream,#fff7df)] p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'smart'}
              onClick={() => setMode('smart')}
              className={`flex min-h-[40px] flex-1 items-center justify-center rounded-lg text-xs font-bold transition-all ${
                mode === 'smart'
                  ? 'border border-[var(--mushaf-rule,#d7c7a7)] bg-[var(--mushaf-paper,#fffdf6)] text-[var(--mushaf-gold-ink,#80662c)] shadow-xs'
                  : 'text-[var(--mushaf-brown,#665b48)] hover:text-[var(--mushaf-ink,#171717)]'
              }`}
            >
              {STRINGS.modeSmart}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'exact'}
              onClick={() => setMode('exact')}
              className={`flex min-h-[40px] flex-1 items-center justify-center rounded-lg text-xs font-bold transition-all ${
                mode === 'exact'
                  ? 'border border-[var(--mushaf-rule,#d7c7a7)] bg-[var(--mushaf-paper,#fffdf6)] text-[var(--mushaf-gold-ink,#80662c)] shadow-xs'
                  : 'text-[var(--mushaf-brown,#665b48)] hover:text-[var(--mushaf-ink,#171717)]'
              }`}
            >
              {STRINGS.modeExact}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'broad'}
              onClick={() => setMode('broad')}
              className={`flex min-h-[40px] flex-1 items-center justify-center rounded-lg text-xs font-bold transition-all ${
                mode === 'broad'
                  ? 'border border-[var(--mushaf-rule,#d7c7a7)] bg-[var(--mushaf-paper,#fffdf6)] text-[var(--mushaf-gold-ink,#80662c)] shadow-xs'
                  : 'text-[var(--mushaf-brown,#665b48)] hover:text-[var(--mushaf-ink,#171717)]'
              }`}
            >
              {STRINGS.modeBroad}
            </button>
          </div>

          <p className="text-center text-[11px] font-medium text-[var(--mushaf-brown,#665b48)]">
            {modeDescription}
          </p>

          {/* Search Input Bar */}
          <form onSubmit={handleFormSubmit} className="relative flex items-center">
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={STRINGS.searchPlaceholder}
              aria-label={STRINGS.searchPlaceholder}
              className="h-12 w-full rounded-xl border border-[var(--mushaf-rule,#d7c7a7)] bg-[var(--mushaf-paper,#fffdf6)] pl-24 pr-11 text-sm text-[var(--mushaf-ink,#171717)] placeholder:text-[var(--mushaf-muted,#8b7f6a)] focus:border-[var(--mushaf-gold,#b99b51)] focus:outline-none"
            />
            {/* Magnifying Glass Icon */}
            <span className="pointer-events-none absolute right-3.5 text-[var(--mushaf-brown,#665b48)]">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>

            {/* Clear Button */}
            {query && (
              <button
                type="button"
                onClick={handleClear}
                aria-label={STRINGS.clearSearch}
                className="absolute left-12 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-base text-[var(--mushaf-brown,#665b48)] hover:text-[var(--mushaf-ink,#171717)]"
              >
                ✕
              </button>
            )}

            {/* Submit Arrow Button */}
            <button
              type="submit"
              aria-label={STRINGS.submitSearch}
              className="absolute left-1.5 flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg bg-[var(--mushaf-gold-ink,#80662c)] text-white hover:opacity-90 active:scale-95 transition-all"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </form>
        </div>

        {/* Results / Empty / Guide Content Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Data Loading State */}
          {loadingData && (
            <div className="flex flex-col items-center justify-center p-12 text-center text-[var(--mushaf-brown,#665b48)]">
              <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[var(--mushaf-gold,#b99b51)] border-t-transparent" />
              <p className="text-xs font-bold">{STRINGS.loadingData}</p>
            </div>
          )}

          {/* Load Error */}
          {loadError && (
            <div className="flex flex-col items-center justify-center p-12 text-center text-[var(--app-danger,#B4232A)]">
              <p className="mb-3 text-sm font-bold">{STRINGS.errorLoading}</p>
              <button
                type="button"
                onClick={() => {
                  setLoadingData(true)
                  setLoadError(false)
                  fetchAyahsData()
                    .then((data) => {
                      ayahsRef.current = data
                      setLoadingData(false)
                      if (query.trim()) runSearch(query, mode)
                    })
                    .catch(() => {
                      setLoadError(true)
                      setLoadingData(false)
                    })
                }}
                className="min-h-[44px] rounded-lg border border-[var(--app-danger,#B4232A)]/40 px-4 py-2 text-xs font-bold hover:bg-[var(--app-danger,#B4232A)]/10"
              >
                {STRINGS.retry}
              </button>
            </div>
          )}

          {/* Initial State / Search Guide */}
          {!loadingData && !loadError && !hasSearched && !query.trim() && (
            <div className="flex flex-col items-center p-6 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[var(--mushaf-rule,#d7c7a7)] bg-[var(--mushaf-cream-2,#fffaf0)] text-[var(--mushaf-gold-ink,#80662c)]">
                <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>

              <h3 className="mb-1 text-base font-black text-[var(--mushaf-ink,#171717)]">
                {STRINGS.sheetTitle}
              </h3>
              <p className="mb-6 max-w-sm text-xs text-[var(--mushaf-brown,#665b48)] leading-relaxed">
                ابحث عن أي كلمة أو عبارة، أو أدخل رقم السورة والآية للانتقال المباشر.
              </p>

              <div className="w-full max-w-md text-right">
                <p className="mb-2 text-xs font-bold text-[var(--mushaf-brown,#665b48)]">
                  {STRINGS.guideTitle}
                </p>
                <div className="flex flex-wrap gap-2">
                  {STRINGS.guideExamples.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => handleSelectExample(ex)}
                      className="flex min-h-[44px] items-center rounded-xl border border-[var(--mushaf-rule,#d7c7a7)] bg-[var(--mushaf-paper,#fffdf6)] px-3 py-2 text-xs font-bold text-[var(--mushaf-gold-ink,#80662c)] hover:border-[var(--mushaf-gold,#b99b51)] hover:bg-[var(--mushaf-cream-2,#fffaf0)] active:opacity-75"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Empty Results State */}
          {!loadingData && !loadError && hasSearched && results.length === 0 && (
            <div className="flex flex-col items-center justify-center p-12 text-center text-[var(--mushaf-brown,#665b48)]">
              <svg className="mb-3 h-12 w-12 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <h3 className="mb-1 text-base font-bold text-[var(--mushaf-ink,#171717)]">
                {STRINGS.noResultsTitle}
              </h3>
              <p className="text-xs text-[var(--mushaf-brown,#665b48)]">
                {STRINGS.noResultsDesc}
              </p>
            </div>
          )}

          {/* Results List */}
          {!loadingData && !loadError && results.length > 0 && (
            <div className="space-y-3">
              {/* Results Count Header */}
              <div className="flex items-center justify-between pb-1 text-xs font-bold text-[var(--mushaf-brown,#665b48)]">
                <span>{STRINGS.totalResults(results.length)}</span>
                {results.length >= MAX_SEARCH_RESULTS && (
                  <span className="text-[11px] text-[var(--app-caution,#A14D07)]">
                    (تم إيقاف النتائج عند الحد الأقصى {MAX_SEARCH_RESULTS})
                  </span>
                )}
              </div>

              {/* Cards */}
              <ul className="space-y-3">
                {displayedResults.map((r) => {
                  const ranges = getSearchMatchRanges(r.text, query, mode)
                  return (
                    <li key={`${r.surah}:${r.ayah}`}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          onGoToAyah(r.surah, r.ayah, r.page)
                          onClose()
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            onGoToAyah(r.surah, r.ayah, r.page)
                            onClose()
                          }
                        }}
                        className="group flex flex-col rounded-2xl border border-[var(--qiraat-card-stroke,#D9C99B)] bg-[var(--qiraat-card-fill,#FFFEFA)] p-4 text-right shadow-xs transition-all hover:border-[var(--mushaf-gold,#b99b51)] hover:shadow-md cursor-pointer"
                      >
                        {/* Card Header */}
                        <div className="flex items-center justify-between border-b border-[var(--mushaf-rule,#d7c7a7)]/40 pb-2.5">
                          <span className="text-xs font-black text-[var(--mushaf-gold-ink,#80662c)]">
                            {STRINGS.ayahPageLabel(r.surahName, r.ayah, r.page)}
                          </span>

                          <button
                            type="button"
                            onClick={(e) => handleShare(e, r)}
                            aria-label={STRINGS.shareAyah}
                            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-[var(--mushaf-brown,#665b48)] hover:bg-[var(--mushaf-cream-2,#fffaf0)] hover:text-[var(--mushaf-ink,#171717)]"
                          >
                            <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                            </svg>
                          </button>
                        </div>

                        {/* Ayah Snippet */}
                        <div className="mt-3 text-base text-[var(--mushaf-ink,#171717)] leading-loose">
                          <HighlightedAyahText text={r.text} ranges={ranges} />
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>

              {/* Progressive Pager Button */}
              {results.length > visibleCount && (
                <div className="pt-2 pb-4 text-center">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, results.length))}
                    className="min-h-[44px] w-full rounded-xl border border-[var(--mushaf-rule,#d7c7a7)] bg-[var(--mushaf-cream-2,#fffaf0)] px-6 py-2.5 text-xs font-bold text-[var(--mushaf-gold-ink,#80662c)] hover:bg-[var(--mushaf-cream-3,#fffdf8)] active:opacity-80"
                  >
                    {STRINGS.loadMore(visibleCount, results.length)}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Toast Notification */}
        {toastMessage && (
          <div
            role="status"
            aria-live="polite"
            className="absolute bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-[var(--mushaf-rule,#d7c7a7)] bg-[var(--mushaf-ink,#171717)] px-4 py-2 text-xs font-bold text-white shadow-xl animate-fade-in"
          >
            {toastMessage}
          </div>
        )}
      </section>
    </div>
  )
}
