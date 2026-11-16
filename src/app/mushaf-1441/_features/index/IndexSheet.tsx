'use client'

/**
 * Index Sheet (الفهرس) — iOS parity
 * Tabs: «السور» (Surahs), «الأجزاء» (Juz), «الفواصل» (Bookmarks).
 * Includes surah search, juz navigation, bookmarks listing, and page scrubber footer (1–604).
 *
 * References:
 * - iOS: apps/ios/Sources/Reader/IndexSheet.swift:5–250
 * - Web: AUDIT-reader-qiraat-2026-11-16.md (Index sheet & bottom slider re-homing)
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { normalizeArabic } from '@/lib/arabic'
import { JUZ_STARTS } from '@/lib/juz'
import {
  getMushaf1441PageForAyahKey,
  getMushaf1441PageMetadata,
  getMushaf1441SurahOption,
  MUSHAF_1441_SURAH_OPTIONS,
  type Mushaf1441SurahOption,
} from '../../../../../packages/quran-data/mushaf1441/pageMetadata'
import { MUSHAF_1441_PAGE_COUNT } from '../../../../../packages/quran-data/mushaf1441/pageLoader'
import { toLatinDigits } from '@/lib/quran-search'

export interface IndexBookmark {
  id: string
  type: 'ayah' | 'page'
  surah: number
  ayah?: number
  page: number
  note?: string
  createdAt: string
}

export interface IndexSheetProps {
  open: boolean
  onClose(): void
  currentPage: number
  currentSurah: number
  onGoToPage(page: number): void
  bookmarks?: ReadonlyArray<IndexBookmark>
  onOpenBookmark?(b: IndexBookmark): void
  onDeleteBookmark?(id: string): void
}

type IndexTab = 'surahs' | 'juz' | 'bookmarks'

const STRINGS = {
  sheetTitle: 'الفهرس',
  close: 'إغلاق',
  tabSurahs: 'السور',
  tabJuz: 'الأجزاء',
  tabBookmarks: 'الفواصل',
  searchSurahsPlaceholder: 'ابحث باسم السورة أو رقمها...',
  clearSearch: 'مسح البحث',
  noSurahsFound: 'لا توجد سور مطابقة للبحث',
  currentSurah: 'الحالية',
  currentJuz: 'الجزء الحالي',
  ayahCount: (count: number) => `${count} آية`,
  pageLabel: (page: number) => `ص ${page}`,
  juzTitle: (juz: number) => `الجزء ${juz}`,
  juzSubtitle: (surah: string, ayah: number, page: number) =>
    `يبدأ من سورة ${surah} آية ${ayah} · صفحة ${page}`,
  noBookmarksTitle: 'لا توجد فواصل محفوظة',
  noBookmarksDesc: 'يمكنك حفظ فاصلة لصفحة أو آية للرجوع إليها لاحقاً',
  ayahBookmark: 'آية',
  pageBookmark: 'صفحة',
  deleteBookmark: 'حذف الفاصلة',
  sliderAriaLabel: 'انتقال سريع للصفحة',
  juzHizbInfo: (juz: number | string, hizb: number | string) =>
    `الجزء ${juz} · الحزب ${hizb}`,
} as const

function getSurahForPage(page: number): Mushaf1441SurahOption | null {
  const meta = getMushaf1441PageMetadata(page)
  if (meta && meta.surahNumbers.length > 0) {
    return getMushaf1441SurahOption(meta.surahNumbers[0])
  }
  for (let i = MUSHAF_1441_SURAH_OPTIONS.length - 1; i >= 0; i--) {
    const s = MUSHAF_1441_SURAH_OPTIONS[i]
    if (s.firstPage && s.firstPage <= page) {
      return s
    }
  }
  return null
}

export function IndexSheet({
  open,
  onClose,
  currentPage,
  currentSurah,
  onGoToPage,
  bookmarks = [],
  onOpenBookmark,
  onDeleteBookmark,
}: IndexSheetProps) {
  const [activeTab, setActiveTab] = useState<IndexTab>('surahs')
  const [searchQuery, setSearchQuery] = useState('')
  const [sliderPreview, setSliderPreview] = useState<number | null>(null)

  const dialogRef = useRef<HTMLElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const currentSurahRowRef = useRef<HTMLButtonElement>(null)
  const currentJuzRowRef = useRef<HTMLButtonElement>(null)
  const tabListId = useId()

  // Focus restoration & initial focus
  useEffect(() => {
    if (!open) return
    const prevActive = document.activeElement as HTMLElement | null
    closeButtonRef.current?.focus()
    return () => {
      if (prevActive && document.contains(prevActive)) {
        prevActive.focus()
      }
    }
  }, [open])

  // Focus trap and Escape key listener
  useEffect(() => {
    if (!open) return
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
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  // Scroll current row into view when tab activates
  useEffect(() => {
    if (!open) return
    if (activeTab === 'surahs' && !searchQuery.trim()) {
      currentSurahRowRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    } else if (activeTab === 'juz') {
      currentJuzRowRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [open, activeTab, searchQuery])

  // Filtered surahs by query (name or number)
  const filteredSurahs = useMemo(() => {
    const q = searchQuery.trim()
    if (!q) return MUSHAF_1441_SURAH_OPTIONS

    const latin = toLatinDigits(q)
    const num = parseInt(latin, 10)
    const normQ = normalizeArabic(q).replace(/^ال/, '')

    return MUSHAF_1441_SURAH_OPTIONS.filter((s) => {
      if (!isNaN(num) && s.surahNumber === num) return true
      if (String(s.surahNumber).includes(latin)) return true
      const sNorm = normalizeArabic(s.name)
      const sNormNoAl = sNorm.replace(/^ال/, '')
      return sNorm.includes(normQ) || sNormNoAl.includes(normQ)
    })
  }, [searchQuery])

  // Precomputed juz metadata
  const juzList = useMemo(() => {
    return JUZ_STARTS.map((j, idx) => {
      const startPage = getMushaf1441PageForAyahKey(`${j.surah}:${j.ayah}`) ?? 1
      const surahOption = getMushaf1441SurahOption(j.surah)
      const nextJuz = JUZ_STARTS[idx + 1]
      const nextJuzPage = nextJuz
        ? (getMushaf1441PageForAyahKey(`${nextJuz.surah}:${nextJuz.ayah}`) ?? MUSHAF_1441_PAGE_COUNT + 1)
        : MUSHAF_1441_PAGE_COUNT + 1
      const isCurrent = currentPage >= startPage && currentPage < nextJuzPage

      return {
        juzNumber: j.juz,
        startSurah: j.surah,
        startSurahName: surahOption?.name ?? `سورة ${j.surah}`,
        startAyah: j.ayah,
        startPage,
        isCurrent,
      }
    })
  }, [currentPage])

  if (!open) return null

  // Page scrubber values
  const sliderValue = sliderPreview ?? currentPage
  const previewSurah = getSurahForPage(sliderValue)
  const previewName = previewSurah?.name ?? ''
  const previewMeta = getMushaf1441PageMetadata(sliderValue)
  // RTL slider percentage: page 1 is on the right (100%), page 604 on the left (0%)
  const leftPct = 100 - ((sliderValue - 1) / (MUSHAF_1441_PAGE_COUNT - 1)) * 100

  const commitScrubber = () => {
    if (sliderPreview !== null && sliderPreview !== currentPage) {
      onGoToPage(sliderPreview)
    }
    setSliderPreview(null)
  }

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

        {/* Tab Bar (Segmented Control) */}
        <div className="shrink-0 border-b border-[var(--mushaf-rule,#d7c7a7)]/60 bg-[var(--mushaf-cream-2,#fffaf0)] px-4 py-2">
          <div
            role="tablist"
            id={tabListId}
            aria-label={STRINGS.sheetTitle}
            className="flex rounded-xl border border-[var(--mushaf-rule,#d7c7a7)] bg-[var(--mushaf-cream,#fff7df)] p-1"
          >
            <button
              type="button"
              role="tab"
              id={`${tabListId}-tab-surahs`}
              aria-selected={activeTab === 'surahs'}
              aria-controls={`${tabListId}-panel-surahs`}
              tabIndex={activeTab === 'surahs' ? 0 : -1}
              onClick={() => setActiveTab('surahs')}
              className={`flex min-h-[44px] flex-1 items-center justify-center rounded-lg text-sm font-bold transition-all ${
                activeTab === 'surahs'
                  ? 'border border-[var(--mushaf-rule,#d7c7a7)] bg-[var(--mushaf-paper,#fffdf6)] text-[var(--mushaf-gold-ink,#80662c)] shadow-xs'
                  : 'text-[var(--mushaf-brown,#665b48)] hover:text-[var(--mushaf-ink,#171717)]'
              }`}
            >
              {STRINGS.tabSurahs}
            </button>
            <button
              type="button"
              role="tab"
              id={`${tabListId}-tab-juz`}
              aria-selected={activeTab === 'juz'}
              aria-controls={`${tabListId}-panel-juz`}
              tabIndex={activeTab === 'juz' ? 0 : -1}
              onClick={() => setActiveTab('juz')}
              className={`flex min-h-[44px] flex-1 items-center justify-center rounded-lg text-sm font-bold transition-all ${
                activeTab === 'juz'
                  ? 'border border-[var(--mushaf-rule,#d7c7a7)] bg-[var(--mushaf-paper,#fffdf6)] text-[var(--mushaf-gold-ink,#80662c)] shadow-xs'
                  : 'text-[var(--mushaf-brown,#665b48)] hover:text-[var(--mushaf-ink,#171717)]'
              }`}
            >
              {STRINGS.tabJuz}
            </button>
            <button
              type="button"
              role="tab"
              id={`${tabListId}-tab-bookmarks`}
              aria-selected={activeTab === 'bookmarks'}
              aria-controls={`${tabListId}-panel-bookmarks`}
              tabIndex={activeTab === 'bookmarks' ? 0 : -1}
              onClick={() => setActiveTab('bookmarks')}
              className={`flex min-h-[44px] flex-1 items-center justify-center rounded-lg text-sm font-bold transition-all ${
                activeTab === 'bookmarks'
                  ? 'border border-[var(--mushaf-rule,#d7c7a7)] bg-[var(--mushaf-paper,#fffdf6)] text-[var(--mushaf-gold-ink,#80662c)] shadow-xs'
                  : 'text-[var(--mushaf-brown,#665b48)] hover:text-[var(--mushaf-ink,#171717)]'
              }`}
            >
              {STRINGS.tabBookmarks}
              {bookmarks.length > 0 ? (
                <span className="mr-1.5 rounded-full bg-[var(--app-favorite,#8F6A00)]/15 px-1.5 py-0.5 text-[10px] font-black text-[var(--app-favorite,#8F6A00)] tabular-nums">
                  {bookmarks.length}
                </span>
              ) : null}
            </button>
          </div>
        </div>

        {/* Tab Panels */}
        <div className="flex-1 overflow-y-auto">
          {/* Tab 1: Surahs */}
          {activeTab === 'surahs' && (
            <div
              id={`${tabListId}-panel-surahs`}
              role="tabpanel"
              aria-labelledby={`${tabListId}-tab-surahs`}
              className="flex flex-col"
            >
              {/* Search Bar */}
              <div className="sticky top-0 z-10 border-b border-[var(--mushaf-rule,#d7c7a7)]/40 bg-[var(--mushaf-cream,#fff7df)] px-4 py-2.5">
                <div className="relative flex items-center">
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={STRINGS.searchSurahsPlaceholder}
                    aria-label={STRINGS.searchSurahsPlaceholder}
                    className="h-11 w-full rounded-xl border border-[var(--mushaf-rule,#d7c7a7)] bg-[var(--mushaf-paper,#fffdf6)] px-10 text-sm text-[var(--mushaf-ink,#171717)] placeholder:text-[var(--mushaf-muted,#8b7f6a)] focus:border-[var(--mushaf-gold,#b99b51)] focus:outline-none"
                  />
                  <span className="pointer-events-none absolute right-3 text-[var(--mushaf-brown,#665b48)]">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </span>
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label={STRINGS.clearSearch}
                      className="absolute left-2 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-base text-[var(--mushaf-brown,#665b48)] hover:text-[var(--mushaf-ink,#171717)]"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Surahs List */}
              {filteredSurahs.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center text-[var(--mushaf-brown,#665b48)]">
                  <svg className="mb-3 h-10 w-10 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-sm font-bold">{STRINGS.noSurahsFound}</p>
                </div>
              ) : (
                <ul className="divide-y divide-[var(--mushaf-rule,#d7c7a7)]/40">
                  {filteredSurahs.map((surah) => {
                    const isCurrent = surah.surahNumber === currentSurah
                    return (
                      <li key={surah.surahNumber}>
                        <button
                          ref={isCurrent ? currentSurahRowRef : undefined}
                          type="button"
                          onClick={() => {
                            onGoToPage(surah.firstPage ?? 1)
                            onClose()
                          }}
                          className={`flex min-h-[52px] w-full items-center justify-between px-4 py-3 text-right transition-colors hover:bg-[var(--mushaf-cream-2,#fffaf0)] active:bg-[var(--mushaf-cream-3,#fffdf8)] ${
                            isCurrent ? 'bg-[var(--mushaf-paper,#fffdf6)]' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--mushaf-rule,#d7c7a7)] bg-[var(--mushaf-cream-2,#fffaf0)] font-mono text-xs font-bold text-[var(--mushaf-brown,#665b48)] tabular-nums">
                              {surah.surahNumber}
                            </span>
                            <div className="flex flex-col">
                              <span className="text-base font-bold text-[var(--mushaf-ink,#171717)]">
                                {surah.name}
                              </span>
                              <span className="text-xs text-[var(--mushaf-brown,#665b48)]">
                                {STRINGS.ayahCount(surah.ayahCount)} · {STRINGS.pageLabel(surah.firstPage ?? 1)}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {isCurrent && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--app-progress,#1A7340)]/30 bg-[var(--app-progress,#1A7340)]/10 px-2.5 py-0.5 text-xs font-bold text-[var(--app-progress,#1A7340)]">
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                                {STRINGS.currentSurah}
                              </span>
                            )}
                            <span className="text-xs font-medium text-[var(--mushaf-muted,#8b7f6a)] tabular-nums">
                              {STRINGS.pageLabel(surah.firstPage ?? 1)}
                            </span>
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}

          {/* Tab 2: Juz */}
          {activeTab === 'juz' && (
            <div
              id={`${tabListId}-panel-juz`}
              role="tabpanel"
              aria-labelledby={`${tabListId}-tab-juz`}
              className="flex flex-col"
            >
              <ul className="divide-y divide-[var(--mushaf-rule,#d7c7a7)]/40">
                {juzList.map((item) => (
                  <li key={item.juzNumber}>
                    <button
                      ref={item.isCurrent ? currentJuzRowRef : undefined}
                      type="button"
                      onClick={() => {
                        onGoToPage(item.startPage)
                        onClose()
                      }}
                      className={`flex min-h-[52px] w-full items-center justify-between px-4 py-3 text-right transition-colors hover:bg-[var(--mushaf-cream-2,#fffaf0)] active:bg-[var(--mushaf-cream-3,#fffdf8)] ${
                        item.isCurrent ? 'bg-[var(--mushaf-paper,#fffdf6)]' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--mushaf-rule,#d7c7a7)] bg-[var(--mushaf-cream-2,#fffaf0)] font-mono text-xs font-bold text-[var(--mushaf-brown,#665b48)] tabular-nums">
                          {item.juzNumber}
                        </span>
                        <div className="flex flex-col">
                          <span className="text-base font-bold text-[var(--mushaf-ink,#171717)]">
                            {STRINGS.juzTitle(item.juzNumber)}
                          </span>
                          <span className="text-xs text-[var(--mushaf-brown,#665b48)]">
                            {STRINGS.juzSubtitle(item.startSurahName, item.startAyah, item.startPage)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {item.isCurrent && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--app-progress,#1A7340)]/30 bg-[var(--app-progress,#1A7340)]/10 px-2.5 py-0.5 text-xs font-bold text-[var(--app-progress,#1A7340)]">
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                            {STRINGS.currentJuz}
                          </span>
                        )}
                        <span className="text-xs font-medium text-[var(--mushaf-muted,#8b7f6a)] tabular-nums">
                          {STRINGS.pageLabel(item.startPage)}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Tab 3: Bookmarks */}
          {activeTab === 'bookmarks' && (
            <div
              id={`${tabListId}-panel-bookmarks`}
              role="tabpanel"
              aria-labelledby={`${tabListId}-tab-bookmarks`}
              className="flex flex-col p-4"
            >
              {bookmarks.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center text-[var(--mushaf-brown,#665b48)]">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--mushaf-rule,#d7c7a7)] bg-[var(--mushaf-cream-2,#fffaf0)] text-[var(--mushaf-gold,#b99b51)]">
                    <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                  </div>
                  <h3 className="mb-1 text-base font-bold text-[var(--mushaf-ink,#171717)]">
                    {STRINGS.noBookmarksTitle}
                  </h3>
                  <p className="max-w-xs text-xs text-[var(--mushaf-brown,#665b48)]">
                    {STRINGS.noBookmarksDesc}
                  </p>
                </div>
              ) : (
                <ul className="space-y-2.5">
                  {bookmarks.map((b) => {
                    const surahOpt = getMushaf1441SurahOption(b.surah)
                    const surahName = surahOpt?.name ?? `سورة ${b.surah}`
                    return (
                      <li
                        key={b.id}
                        className="group flex items-center justify-between rounded-xl border border-[var(--mushaf-rule,#d7c7a7)] bg-[var(--qiraat-card-fill,#FFFEFA)] p-3.5 transition-all hover:border-[var(--mushaf-gold,#b99b51)]"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (onOpenBookmark) onOpenBookmark(b)
                            else onGoToPage(b.page)
                            onClose()
                          }}
                          className="flex min-h-[44px] flex-1 flex-col items-start text-right"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-base font-black text-[var(--mushaf-ink,#171717)]">
                              {surahName}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                b.type === 'ayah'
                                  ? 'bg-[var(--app-info,#1B5FC1)]/10 text-[var(--app-info,#1B5FC1)] border border-[var(--app-info,#1B5FC1)]/30'
                                  : 'bg-[var(--app-favorite,#8F6A00)]/10 text-[var(--app-favorite,#8F6A00)] border border-[var(--app-favorite,#8F6A00)]/30'
                              }`}
                            >
                              {b.type === 'ayah' ? STRINGS.ayahBookmark : STRINGS.pageBookmark}
                            </span>
                          </div>

                          <div className="mt-1 flex items-center gap-2 text-xs text-[var(--mushaf-brown,#665b48)]">
                            {b.type === 'ayah' && b.ayah && (
                              <span className="font-bold text-[var(--mushaf-gold-ink,#80662c)] tabular-nums">
                                آية {b.ayah}
                              </span>
                            )}
                            <span className="tabular-nums">{STRINGS.pageLabel(b.page)}</span>
                            {b.createdAt && (
                              <span className="text-[10px] text-[var(--mushaf-muted,#8b7f6a)]">
                                {new Date(b.createdAt).toLocaleDateString('ar-EG', {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                            )}
                          </div>

                          {b.note && (
                            <p className="mt-2 line-clamp-2 rounded-lg bg-[var(--mushaf-cream-2,#fffaf0)] p-2 text-xs text-[var(--mushaf-ink-2,#3a3326)] italic">
                              {b.note}
                            </p>
                          )}
                        </button>

                        {onDeleteBookmark && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onDeleteBookmark(b.id)
                            }}
                            aria-label={STRINGS.deleteBookmark}
                            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[var(--app-danger,#B4232A)] opacity-70 transition-opacity hover:opacity-100 hover:bg-[var(--app-danger,#B4232A)]/10"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Footer: Page Scrubber (1–604 with preview bubble) */}
        <footer
          data-testid="index-sheet-footer"
          className="relative shrink-0 border-t border-[var(--mushaf-rule,#d7c7a7)] bg-[var(--mushaf-cream-2,#fffaf0)] px-4 py-3"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
        >
          {/* Floating preview bubble while scrubbing */}
          {sliderPreview !== null && (
            <div
              className="pointer-events-none absolute -top-20 z-50 -translate-x-1/2 rounded-xl border border-[var(--mushaf-rule,#d7c7a7)] bg-[var(--mushaf-paper,#fffdf6)] px-4 py-2 text-center shadow-2xl"
              style={{ left: `clamp(75px, ${leftPct}%, calc(100% - 75px))` }}
            >
              <p className="text-base font-black tabular-nums text-[var(--mushaf-ink,#171717)]">
                ص {sliderValue}
              </p>
              <p className="text-[11px] font-bold text-[var(--mushaf-gold-ink,#80662c)]">
                {previewName}
              </p>
              <p className="text-[10px] font-bold text-[var(--mushaf-brown,#665b48)] tabular-nums">
                {STRINGS.juzHizbInfo(previewMeta?.juzNumber ?? '—', previewMeta?.hizbNumber ?? '—')}
              </p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <span className="w-24 shrink-0 truncate text-xs font-black text-[var(--mushaf-ink,#171717)]">
              <span className="tabular-nums">ص {sliderValue}</span> · {previewName}
            </span>

            <input
              type="range"
              min={1}
              max={MUSHAF_1441_PAGE_COUNT}
              step={1}
              value={sliderValue}
              aria-label={STRINGS.sliderAriaLabel}
              onPointerDown={() => setSliderPreview(currentPage)}
              onChange={(e) => setSliderPreview(Number(e.target.value))}
              onPointerUp={commitScrubber}
              onPointerCancel={() => setSliderPreview(null)}
              onKeyUp={commitScrubber}
              onBlur={() => setSliderPreview(null)}
              className="h-3 flex-1 cursor-pointer appearance-none rounded-full bg-[var(--mushaf-rule,#d7c7a7)]
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-6 [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:bg-[var(--mushaf-gold-ink,#80662c)] [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-[var(--mushaf-paper,#fffdf6)]
                [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer
                [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:size-6 [&::-moz-range-thumb]:rounded-full
                [&::-moz-range-thumb]:bg-[var(--mushaf-gold-ink,#80662c)] [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-[var(--mushaf-paper,#fffdf6)]
                [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-pointer"
            />
          </div>
        </footer>
      </section>
    </div>
  )
}
