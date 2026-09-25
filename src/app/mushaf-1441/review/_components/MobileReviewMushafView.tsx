'use client'

import { useState, type FormEvent } from 'react'
import type { ReviewOverview, ReviewPage, ReviewRow } from '../_lib/types'
import { getMushaf1441PageMetadata } from '../../../../../packages/quran-data/mushaf1441/pageMetadata'
import ReviewMushafPane, { type WordMeta } from './ReviewMushafPane'
import { cn } from '@/lib/cn'

const MIN_PAGE = 1
const MAX_PAGE = 604

type Props = {
  page: ReviewPage
  pageNumber: number
  overview: ReviewOverview | null
  selectedWordKey: string | null
  selectedRow: ReviewRow | null
  hoveredRowId: string | null
  onSelectWord(key: string, wordMeta: WordMeta): void
  onHoverWord(rowIds: string[] | null): void
  onGoToPage(page: number): void
  onToggleHistory(): void
  zoom: number
  onChangeZoom(zoom: number): void
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void
}

function findNextPageWith(
  overview: ReviewOverview | null,
  current: number,
  key: 'flagged' | 'unreviewed'
): number | null {
  if (!overview) return null
  const sorted = [...overview.pages].sort((a, b) => a.page - b.page)
  const ahead = sorted.find((entry) => entry.page > current && entry[key] > 0)
  if (ahead) return ahead.page
  const wrapped = sorted.find((entry) => entry[key] > 0)
  return wrapped ? wrapped.page : null
}

export default function MobileReviewMushafView({
  page,
  pageNumber,
  overview,
  selectedWordKey,
  selectedRow,
  hoveredRowId,
  onSelectWord,
  onHoverWord,
  onGoToPage,
  onToggleHistory,
  zoom,
  onChangeZoom,
  scrollContainerRef,
  onScroll,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [jumpDialogOpen, setJumpDialogOpen] = useState(false)
  const [jumpValue, setJumpValue] = useState(String(pageNumber))

  const metadata = getMushaf1441PageMetadata(pageNumber)
  const surahTitle =
    metadata?.surahNames && metadata.surahNames.length > 0
      ? `سورة ${metadata.surahNames.join('، ')}`
      : ''

  const nextFlagged = findNextPageWith(overview, pageNumber, 'flagged')
  const nextUnreviewed = findNextPageWith(overview, pageNumber, 'unreviewed')

  function handleJumpSubmit(e: FormEvent) {
    e.preventDefault()
    const parsed = Number.parseInt(jumpValue, 10)
    if (Number.isFinite(parsed) && parsed >= MIN_PAGE && parsed <= MAX_PAGE) {
      onGoToPage(parsed)
      setJumpDialogOpen(false)
      setMenuOpen(false)
    }
  }

  function cycleZoom() {
    if (zoom < 1.2) onChangeZoom(1.25)
    else if (zoom < 1.4) onChangeZoom(1.5)
    else onChangeZoom(1)
  }

  return (
    <div dir="rtl" lang="ar" data-mobile-mushaf-view="true" className="flex h-dvh flex-col bg-[var(--color-paper)] select-none">
      {/* 1. Mobile Minimal Top Header */}
      <header
        className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]"
        role="banner"
      >
        {/* Right side (start of RTL): Menu button */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="خيارات الصفحة والقائمة"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:bg-[var(--color-surface-2)] active:scale-95 transition-transform"
          >
            <span className="text-lg leading-none" aria-hidden="true">
              ☰
            </span>
          </button>

          <button
            type="button"
            onClick={cycleZoom}
            aria-label={`تغيير التكبير (الحالي: ${Math.round(zoom * 100)}%)`}
            className="flex h-9 items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-xs font-bold text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-2)] active:scale-95 transition-transform"
          >
            <span>{Math.round(zoom * 100)}%</span>
            <span className="text-[10px] text-[var(--color-ink-muted)]">🔍</span>
          </button>
        </div>

        {/* Center: Surah & Page info */}
        <div className="flex flex-col items-center justify-center text-center">
          <span className="text-xs font-bold text-[var(--color-ink)]">
            {surahTitle || `صفحة ${pageNumber}`}
          </span>
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-ink-muted)]">
            <span className="tabular-nums font-semibold">
              {pageNumber} / {MAX_PAGE}
            </span>
            {page.stats.unreviewed > 0 ? (
              <span className="rounded-full bg-[#fef3c7] px-1.5 py-0.2 text-[10px] font-bold text-[#92400e]">
                {page.stats.unreviewed} غير مراجع
              </span>
            ) : (
              <span className="rounded-full bg-[#dcfce7] px-1.5 py-0.2 text-[10px] font-bold text-[#166534]">
                مكتمل ✓
              </span>
            )}
          </div>
        </div>

        {/* Left side (end of RTL): Quick jump to unreviewed or page jump */}
        <div className="flex items-center gap-1.5">
          {nextUnreviewed !== null ? (
            <button
              type="button"
              onClick={() => onGoToPage(nextUnreviewed)}
              aria-label="الانتقال إلى الصفحة التالية غير المراجعة"
              title="الصفحة التالية غير المراجعة"
              className="flex h-9 items-center rounded-lg border border-amber-300 bg-amber-50 px-2.5 text-xs font-bold text-amber-900 active:scale-95 transition-transform"
            >
              <span>غير مراجع</span>
              <span className="ms-1 text-[11px]">←</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setJumpValue(String(pageNumber))
                setJumpDialogOpen(true)
              }}
              aria-label="انتقال سريع إلى صفحة"
              className="flex h-9 items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-xs font-bold text-[var(--color-ink)] active:scale-95 transition-transform"
            >
              <span>انتقال</span>
            </button>
          )}
        </div>
      </header>

      {/* 2. Main Mushaf Page Reading Surface */}
      <main className="relative flex flex-1 min-h-0 flex-col overflow-hidden bg-[var(--color-paper)]">
        <ReviewMushafPane
          page={page}
          selectedWordKey={selectedWordKey}
          selectedRow={selectedRow}
          hoveredRowId={hoveredRowId}
          onSelectWord={onSelectWord}
          onHoverWord={onHoverWord}
          isMobile={true}
          zoom={zoom}
          scrollContainerRef={scrollContainerRef}
          onScroll={onScroll}
        />
      </main>

      {/* 3. Mobile Minimal Page Navigation Bar (Bottom) */}
      <footer
        className="flex shrink-0 items-center justify-between border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        role="navigation"
        aria-label="شريط التنقل بين صفحات المصحف"
      >
        {/* Right Button (RTL): Previous Page (السابق ›) */}
        <button
          type="button"
          onClick={() => onGoToPage(pageNumber - 1)}
          disabled={pageNumber <= MIN_PAGE}
          aria-label="الصفحة السابقة"
          className={cn(
            'flex min-h-11 items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs font-bold text-[var(--color-ink)] transition-all active:scale-95',
            pageNumber <= MIN_PAGE ? 'opacity-30 cursor-not-allowed' : 'hover:bg-[var(--color-surface-2)]'
          )}
        >
          <span className="text-base leading-none">›</span>
          <span>السابق</span>
        </button>

        {/* Center: Current Page indicator & quick tap to jump */}
        <button
          type="button"
          onClick={() => {
            setJumpValue(String(pageNumber))
            setJumpDialogOpen(true)
          }}
          aria-label={`الصفحة ${pageNumber} من ${MAX_PAGE} — اضغط للانتقال`}
          className="flex flex-col items-center justify-center rounded-lg px-3 py-1 hover:bg-[var(--color-surface-2)] active:scale-95 transition-transform"
        >
          <span className="text-sm font-black tabular-nums text-[var(--color-ink)]">
            {pageNumber} / {MAX_PAGE}
          </span>
          <span className="text-[10px] text-[var(--color-ink-muted)]">اضغط للانتقال</span>
        </button>

        {/* Left Button (RTL): Next Page (‹ التالي) */}
        <button
          type="button"
          onClick={() => onGoToPage(pageNumber + 1)}
          disabled={pageNumber >= MAX_PAGE}
          aria-label="الصفحة التالية"
          className={cn(
            'flex min-h-11 items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs font-bold text-[var(--color-ink)] transition-all active:scale-95',
            pageNumber >= MAX_PAGE ? 'opacity-30 cursor-not-allowed' : 'hover:bg-[var(--color-surface-2)]'
          )}
        >
          <span>التالي</span>
          <span className="text-base leading-none">‹</span>
        </button>
      </footer>

      {/* 4. Page Jump Modal */}
      {jumpDialogOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="الانتقال إلى صفحة"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-xs rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-xl text-center">
            <h3 className="text-sm font-bold text-[var(--color-ink)]">الانتقال إلى صفحة</h3>
            <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
              أدخل رقم الصفحة بين ١ و ٦٠٤
            </p>

            <form onSubmit={handleJumpSubmit} className="mt-4 space-y-3">
              <div className="flex items-center justify-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min={MIN_PAGE}
                  max={MAX_PAGE}
                  autoFocus
                  value={jumpValue}
                  onChange={(e) => setJumpValue(e.target.value)}
                  className="h-12 w-24 rounded-xl border-2 border-[var(--color-primary)] bg-[var(--color-surface)] text-center text-xl font-bold tabular-nums text-[var(--color-ink)] focus:outline-none"
                />
                <span className="text-sm font-bold text-[var(--color-ink-muted)]">/ ٦٠٤</span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-[var(--color-primary)] py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[var(--color-primary-hover)] active:scale-95 transition-transform"
                >
                  انتقال
                </button>
                <button
                  type="button"
                  onClick={() => setJumpDialogOpen(false)}
                  className="rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-xs font-bold text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-2)] active:scale-95 transition-transform"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* 5. Menu Drawer / Bottom Sheet */}
      {menuOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="قائمة الخيارات والتنقل"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs"
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl border-t border-[var(--color-border)] bg-[var(--color-surface)] p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[var(--color-border)]" />

            <div className="mb-4 flex items-center justify-between border-b border-[var(--color-border-soft)] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[var(--color-ink)]">
                  {surahTitle || `مصحف المدينة ١٤٤١`}
                </h3>
                <p className="text-xs text-[var(--color-ink-muted)]">
                  صفحة {pageNumber} · إجمالي المواضع: {page.stats.total}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="rounded-full bg-[var(--color-surface-2)] p-1.5 text-xs font-bold text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5">
              {/* Zoom Selection Row */}
              <div className="flex items-center justify-between rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-2)]/30 p-2.5">
                <span className="text-xs font-bold text-[var(--color-ink)]">تكبير المصحف:</span>
                <div className="flex items-center gap-1.5">
                  {[1, 1.25, 1.5].map((z) => (
                    <button
                      key={z}
                      type="button"
                      onClick={() => onChangeZoom(z)}
                      className={cn(
                        'min-w-10 rounded-lg px-2.5 py-1 text-xs font-bold transition-all',
                        zoom === z
                          ? 'bg-[var(--color-primary)] text-white shadow-xs'
                          : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-soft)]'
                      )}
                    >
                      {Math.round(z * 100)}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Next Unreviewed Page */}
              <button
                type="button"
                disabled={nextUnreviewed === null}
                onClick={() => {
                  if (nextUnreviewed !== null) {
                    onGoToPage(nextUnreviewed)
                    setMenuOpen(false)
                  }
                }}
                className="flex w-full min-h-12 items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-xs font-bold text-[var(--color-ink)] hover:bg-[var(--color-surface-2)] disabled:opacity-40"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">📄</span>
                  <span>الصفحة التالية غير المراجَعة</span>
                </div>
                {nextUnreviewed !== null ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-900">
                    صفحة {nextUnreviewed}
                  </span>
                ) : (
                  <span className="text-[11px] text-[var(--color-ink-muted)]">لا يوجد</span>
                )}
              </button>

              {/* Next Flagged Page */}
              <button
                type="button"
                disabled={nextFlagged === null}
                onClick={() => {
                  if (nextFlagged !== null) {
                    onGoToPage(nextFlagged)
                    setMenuOpen(false)
                  }
                }}
                className="flex w-full min-h-12 items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-xs font-bold text-[var(--color-ink)] hover:bg-[var(--color-surface-2)] disabled:opacity-40"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base text-red-600">⚑</span>
                  <span>الصفحة التالية المعلَّمة للمراجعة</span>
                </div>
                {nextFlagged !== null ? (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] text-red-900">
                    صفحة {nextFlagged}
                  </span>
                ) : (
                  <span className="text-[11px] text-[var(--color-ink-muted)]">لا يوجد</span>
                )}
              </button>

              {/* Open History Drawer */}
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  onToggleHistory()
                }}
                className="flex w-full min-h-12 items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-xs font-bold text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">🕒</span>
                  <span>سجل التعديلات والتراجع</span>
                </div>
                <span className="text-[11px] text-[var(--color-ink-muted)]">عرض ←</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
