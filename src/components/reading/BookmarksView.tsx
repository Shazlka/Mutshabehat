'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { BookmarkType, QuranBookmark } from '../../../packages/reading-core'
import { getMushaf1441SurahOption } from '../../../packages/quran-data/mushaf1441/pageMetadata'
import { useReadingStore } from '../../lib/hooks/useReadingStore'
import {
  fetchAyahPreviewText,
  filterBookmarks,
  formatArabicDate,
  toArabicDigits,
  truncateAyahWords,
} from '../../lib/reading-view'

const STRINGS = {
  title: 'الفواصل',
  filterAll: 'الكل',
  filterAyahs: 'الآيات',
  filterPages: 'الصفحات',
  searchPlaceholder: 'بحث في الفواصل...',
  clearSearch: 'مسح البحث',
  emptyTitle: 'لا توجد فواصل محفوظة',
  emptyDesc: 'لحفظ فاصل، اضغط مطولاً على رقم الآية في المصحف',
  ayahPrefix: 'آية',
  pagePrefix: 'صفحة',
  badgeAyah: 'آية',
  badgePage: 'صفحة',
  deleteLabel: 'حذف الفاصل',
  deletedToast: 'تم حذف الفاصل',
  undoAction: 'تراجع',
} as const

export interface BookmarksViewProps {
  readonly onSelectPage?: (page: number) => void
}

export function BookmarksView({ onSelectPage }: BookmarksViewProps) {
  const { bookmarks, removeBookmark, addBookmark } = useReadingStore()
  const [filter, setFilter] = useState<'all' | 'ayah' | 'page'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [deletedBookmark, setDeletedBookmark] = useState<QuranBookmark | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const filtered = filterBookmarks(bookmarks, filter, searchQuery)

  const handleDelete = async (b: QuranBookmark) => {
    setDeletedBookmark(b)
    setToastMessage(STRINGS.deletedToast)
    await removeBookmark(b.id)
  }

  const handleUndo = async () => {
    if (!deletedBookmark) return
    const b = deletedBookmark
    setDeletedBookmark(null)
    setToastMessage(null)
    await addBookmark({
      type: b.type,
      surah: b.surah,
      ayah: b.ayah,
      page: b.page,
      note: b.note,
      createdAt: b.createdAt,
    })
  }

  return (
    <div className="flex w-full flex-col space-y-4 p-4 sm:p-6" dir="rtl">
      {/* Filter Segmented Control & Search Bar */}
      <div className="space-y-3">
        {/* Segmented Filter */}
        <div
          role="tablist"
          aria-label={STRINGS.title}
          className="grid grid-cols-3 gap-1 rounded-xl border border-[var(--qiraat-card-stroke,#d7c7a7)] bg-black/5 p-1 text-center"
        >
          {(['all', 'ayah', 'page'] as const).map((tabKey) => {
            const active = filter === tabKey
            const label =
              tabKey === 'all'
                ? STRINGS.filterAll
                : tabKey === 'ayah'
                  ? STRINGS.filterAyahs
                  : STRINGS.filterPages
            const count =
              tabKey === 'all'
                ? bookmarks.length
                : bookmarks.filter((b) => b.type === tabKey).length

            return (
              <button
                key={tabKey}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(tabKey)}
                className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition-all sm:text-sm ${
                  active
                    ? 'bg-[var(--qiraat-card-fill,#ffffff)] text-[var(--mushaf-ink,#171717)] shadow-xs'
                    : 'text-[var(--mushaf-brown,#665b48)] hover:text-[var(--mushaf-ink,#171717)]'
                }`}
              >
                <span>{label}</span>
                <span className="text-[11px] opacity-70">({toArabicDigits(count)})</span>
              </button>
            )
          })}
        </div>

        {/* Search Field */}
        <div className="relative flex items-center">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-3 text-sm text-[var(--mushaf-brown,#665b48)] opacity-60"
          >
            🔍
          </span>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={STRINGS.searchPlaceholder}
            className="min-h-[44px] w-full rounded-xl border border-[var(--qiraat-card-stroke,#d7c7a7)] bg-[var(--qiraat-card-fill,#ffffff)] pr-9 pl-10 text-sm font-semibold text-[var(--mushaf-ink,#171717)] placeholder:text-[var(--mushaf-brown,#665b48)]/60 focus:outline-hidden focus:ring-2 focus:ring-[var(--app-progress,#1A7340)]"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute left-1 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-xs text-[var(--mushaf-brown,#665b48)] hover:bg-black/5"
              aria-label={STRINGS.clearSearch}
            >
              ✕
            </button>
          ) : null}
        </div>
      </div>

      {/* Bookmarks List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div
            aria-hidden="true"
            className="flex size-16 items-center justify-center rounded-full bg-black/5 text-2xl text-[var(--mushaf-brown,#665b48)]"
          >
            🔖
          </div>
          <h3 className="mt-4 text-base font-bold text-[var(--mushaf-ink,#171717)]">
            {STRINGS.emptyTitle}
          </h3>
          <p className="mt-1 text-xs text-[var(--mushaf-brown,#665b48)]">
            {STRINGS.emptyDesc}
          </p>
        </div>
      ) : (
        <ul className="space-y-3" role="list">
          {filtered.map((b) => (
            <BookmarkCard
              key={b.id}
              bookmark={b}
              onSelectPage={onSelectPage}
              onDelete={() => void handleDelete(b)}
            />
          ))}
        </ul>
      )}

      {/* Undo Toast */}
      {toastMessage ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-[var(--qiraat-card-stroke,#d7c7a7)] bg-[var(--qiraat-card-fill,#ffffff)] px-4 py-2.5 shadow-lg"
        >
          <span className="text-xs font-bold text-[var(--mushaf-ink,#171717)]">
            {toastMessage}
          </span>
          <button
            type="button"
            onClick={() => void handleUndo()}
            className="flex min-h-[44px] items-center justify-center rounded-full bg-[var(--app-progress,#1A7340)] px-4 text-xs font-bold text-white transition-opacity hover:opacity-90 active:scale-95"
          >
            {STRINGS.undoAction}
          </button>
        </div>
      ) : null}
    </div>
  )
}

interface BookmarkCardProps {
  readonly bookmark: QuranBookmark
  readonly onSelectPage?: (page: number) => void
  readonly onDelete: () => void
}

function BookmarkCard({ bookmark, onSelectPage, onDelete }: BookmarkCardProps) {
  const surahOption = getMushaf1441SurahOption(bookmark.surah)
  const surahName = surahOption ? `سورة ${surahOption.name}` : `سورة ${bookmark.surah}`

  return (
    <li className="relative rounded-2xl border border-[var(--qiraat-card-stroke,#d7c7a7)] bg-[var(--qiraat-card-fill,#ffffff)] p-4 shadow-xs transition-colors hover:border-[var(--mushaf-gold,#b99b51)]/40">
      <div className="flex items-start justify-between gap-3">
        {/* Main Content Link */}
        <Link
          href={`/mushaf-1441?page=${bookmark.page}`}
          onClick={() => {
            if (onSelectPage) onSelectPage(bookmark.page)
          }}
          className="min-w-0 flex-1 space-y-1.5 focus:outline-hidden"
        >
          {/* Header Row */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-[var(--mushaf-ink,#171717)] sm:text-base">
              {surahName}
            </span>
            <span className="text-xs text-[var(--mushaf-brown,#665b48)]">•</span>
            {bookmark.type === 'ayah' ? (
              <>
                <span className="text-xs font-bold text-[var(--app-info,#1B5FC1)] sm:text-sm">
                  {STRINGS.ayahPrefix} {toArabicDigits(bookmark.ayah)}
                </span>
                <span className="text-xs text-[var(--mushaf-brown,#665b48)]">•</span>
              </>
            ) : null}
            <span className="text-xs font-semibold text-[var(--mushaf-brown,#665b48)] sm:text-sm">
              {STRINGS.pagePrefix} {toArabicDigits(bookmark.page)}
            </span>
          </div>

          {/* Ayah Preview */}
          {bookmark.type === 'ayah' ? (
            <AyahPreview surah={bookmark.surah} ayah={bookmark.ayah} />
          ) : null}

          {/* User Note */}
          {bookmark.note ? (
            <p className="text-xs font-medium text-[var(--mushaf-brown,#665b48)]">
              {bookmark.note}
            </p>
          ) : null}

          {/* Date */}
          <p className="text-[11px] text-[var(--mushaf-brown,#665b48)] opacity-70">
            {formatArabicDate(bookmark.createdAt, { short: true })}
          </p>
        </Link>

        {/* Right Column: Badge & Delete */}
        <div className="flex shrink-0 flex-col items-end gap-3">
          <TypeBadge type={bookmark.type} />
          <button
            type="button"
            onClick={onDelete}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-sm text-[var(--app-danger,#B4232A)] transition-colors hover:bg-[var(--app-danger,#B4232A)]/10 active:scale-95"
            aria-label={STRINGS.deleteLabel}
          >
            🗑
          </button>
        </div>
      </div>
    </li>
  )
}

function TypeBadge({ type }: { readonly type: BookmarkType }) {
  const isAyah = type === 'ayah'
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
        isAyah
          ? 'bg-[var(--app-info,#1B5FC1)]/12 text-[var(--app-info,#1B5FC1)]'
          : 'bg-[var(--app-caution,#A14D07)]/12 text-[var(--app-caution,#A14D07)]'
      }`}
    >
      {isAyah ? STRINGS.badgeAyah : STRINGS.badgePage}
    </span>
  )
}

function AyahPreview({
  surah,
  ayah,
}: {
  readonly surah: number
  readonly ayah: number
}) {
  const [text, setText] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void fetchAyahPreviewText(surah, ayah).then((res) => {
      if (active) setText(res)
    })
    return () => {
      active = false
    }
  }, [surah, ayah])

  if (!text) return null

  return (
    <p
      className="font-serif text-sm font-semibold leading-relaxed text-[var(--mushaf-ink,#171717)] sm:text-base"
      dir="rtl"
    >
      {truncateAyahWords(text, 10)}
    </p>
  )
}
