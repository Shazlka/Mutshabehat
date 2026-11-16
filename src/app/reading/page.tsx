'use client'

import { useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import type { KhatmaRecord } from '../../../packages/reading-core'
import { AddReadingSessionSheet } from '@/components/reading/AddReadingSessionSheet'
import { BookmarksView } from '@/components/reading/BookmarksView'
import { KhatmaCelebrationDialog } from '@/components/reading/KhatmaCelebrationDialog'
import { ReadingStatisticsView } from '@/components/reading/ReadingStatisticsView'

const STRINGS = {
  backToMushaf: 'المصحف',
  pageTitle: 'القراءة والختمة',
  tabStats: 'الإحصائيات',
  tabBookmarks: 'الفواصل',
  addSessionAction: 'أضف جلسة',
} as const

type AppearanceMode = 'system' | 'light' | 'dark' | 'whitePage' | 'blackPage'

const MUSHAF_APPEARANCE_STORAGE_KEY = 'mushaf1441:appearance:v1'

function isAppearanceMode(value: unknown): value is AppearanceMode {
  return (
    value === 'system' ||
    value === 'light' ||
    value === 'dark' ||
    value === 'whitePage' ||
    value === 'blackPage'
  )
}

function subscribeStorage(callback: () => void) {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('storage', callback)
  return () => window.removeEventListener('storage', callback)
}

function getAppearanceSnapshot(): AppearanceMode {
  if (typeof window === 'undefined') return 'system'
  try {
    const raw = window.localStorage.getItem(MUSHAF_APPEARANCE_STORAGE_KEY)
    if (isAppearanceMode(raw)) return raw
  } catch {
    // fallback
  }
  return 'system'
}

function getAppearanceServerSnapshot(): AppearanceMode {
  return 'system'
}

export default function ReadingPage() {
  const appearance = useSyncExternalStore(
    subscribeStorage,
    getAppearanceSnapshot,
    getAppearanceServerSnapshot,
  )

  const [activeTab, setActiveTab] = useState<'stats' | 'bookmarks'>('stats')
  const [isAddSessionOpen, setIsAddSessionOpen] = useState<boolean>(false)
  const [justCompletedKhatma, setJustCompletedKhatma] = useState<KhatmaRecord | null>(null)

  return (
    <div
      dir="rtl"
      data-mushaf-appearance={appearance}
      className="flex min-h-[100dvh] flex-col bg-[var(--mushaf-paper,#fcf8ed)] text-[var(--mushaf-ink,#171717)] select-none motion-reduce:transition-none"
    >
      {/* Desktop & appearance styling fallbacks */}
      <style>{`
        @media (min-width: 768px) {
          [data-mushaf-appearance="system"],
          [data-mushaf-appearance="light"] {
            --mushaf-paper: rgb(100% 99.2% 96.5%);
            --mushaf-desk: var(--mushaf-paper);
            --mushaf-ink: rgb(9% 9% 9%);
            --mushaf-brown: rgb(34.9% 27.5% 11.4%);
            --mushaf-gold: rgb(78% 62% 24%);
            --app-progress: #1A7340;
            --app-progress-fill: #1A7340;
            --app-caution: #A14D07;
            --app-caution-fill: #A14D07;
            --app-info: #1B5FC1;
            --app-insight: #6A3DB0;
            --app-favorite: #8F6A00;
            --app-danger: #B4232A;
            --qiraat-card-fill: #FFFEFA;
            --qiraat-card-stroke: #D9C99B;
          }
          [data-mushaf-appearance="dark"] {
            --mushaf-paper: rgb(11% 10.5% 9%);
            --mushaf-desk: var(--mushaf-paper);
            --mushaf-ink: rgb(92% 91% 86%);
            --mushaf-brown: rgb(82% 74% 55%);
            --mushaf-gold: rgb(88% 75% 42%);
            --app-progress: #5FD38D;
            --app-progress-fill: #23854D;
            --app-caution: #F7A65E;
            --app-caution-fill: #A8530C;
            --app-info: #80B4FF;
            --app-insight: #C3A5F7;
            --app-favorite: #F2C94C;
            --app-danger: #FF8A8A;
            --qiraat-card-fill: #27241E;
            --qiraat-card-stroke: #5A5036;
          }
          [data-mushaf-appearance="whitePage"] {
            --mushaf-paper: #FFFFFF;
            --mushaf-desk: #FFFFFF;
            --mushaf-ink: #000000;
            --mushaf-brown: #333333;
            --mushaf-gold: rgb(72% 55% 20%);
            --app-progress: #1A7340;
            --app-progress-fill: #1A7340;
            --app-caution: #A14D07;
            --app-caution-fill: #A14D07;
            --app-info: #1B5FC1;
            --app-insight: #6A3DB0;
            --app-favorite: #8F6A00;
            --app-danger: #B4232A;
            --qiraat-card-fill: #FFFEFA;
            --qiraat-card-stroke: #D9C99B;
          }
          [data-mushaf-appearance="blackPage"] {
            --mushaf-paper: #000000;
            --mushaf-desk: #000000;
            --mushaf-ink: #FFFFFF;
            --mushaf-brown: rgb(78% 78% 78%);
            --mushaf-gold: rgb(85% 72% 38%);
            --app-progress: #5FD38D;
            --app-progress-fill: #23854D;
            --app-caution: #F7A65E;
            --app-caution-fill: #A8530C;
            --app-info: #80B4FF;
            --app-insight: #C3A5F7;
            --app-favorite: #F2C94C;
            --app-danger: #FF8A8A;
            --qiraat-card-fill: #27241E;
            --qiraat-card-stroke: #5A5036;
          }
        }
        @media (prefers-color-scheme: dark) {
          [data-mushaf-appearance="system"] {
            --mushaf-paper: rgb(11% 10.5% 9%);
            --mushaf-desk: var(--mushaf-paper);
            --mushaf-ink: rgb(92% 91% 86%);
            --mushaf-brown: rgb(82% 74% 55%);
            --mushaf-gold: rgb(88% 75% 42%);
            --app-progress: #5FD38D;
            --app-progress-fill: #23854D;
            --app-caution: #F7A65E;
            --app-caution-fill: #A8530C;
            --app-info: #80B4FF;
            --app-insight: #C3A5F7;
            --app-favorite: #F2C94C;
            --app-danger: #FF8A8A;
            --qiraat-card-fill: #27241E;
            --qiraat-card-stroke: #5A5036;
          }
        }
      `}</style>

      {/* Sticky Top Bar */}
      <header className="sticky top-0 z-30 flex shrink-0 items-center justify-between border-b border-[var(--qiraat-card-stroke,#d7c7a7)] bg-[var(--mushaf-paper,#fcf8ed)] px-3 py-2.5 shadow-2xs sm:px-6 sm:py-3">
        {/* Back Link to Mushaf */}
        <Link
          href="/mushaf-1441"
          className="flex min-h-[44px] min-w-[44px] items-center gap-1.5 rounded-lg px-2 text-sm font-bold text-[var(--mushaf-brown,#665b48)] transition-colors hover:bg-black/5 active:scale-95"
        >
          <span aria-hidden="true" className="text-base font-bold">
            ›
          </span>
          <span>{STRINGS.backToMushaf}</span>
        </Link>

        {/* Screen Title */}
        <h1 className="text-base font-black sm:text-lg">
          {STRINGS.pageTitle}
        </h1>

        {/* Add Session Trigger Button */}
        <button
          type="button"
          onClick={() => setIsAddSessionOpen(true)}
          className="flex min-h-[44px] min-w-[44px] items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold text-[var(--app-progress,#1A7340)] transition-colors hover:bg-[var(--app-progress,#1A7340)]/10 active:scale-95 sm:text-sm"
        >
          <span aria-hidden="true" className="text-base font-bold">
            +
          </span>
          <span className="hidden xs:inline">{STRINGS.addSessionAction}</span>
        </button>
      </header>

      {/* Main Tab Switcher */}
      <div className="mx-auto w-full max-w-2xl px-4 pt-3 sm:px-6">
        <div
          role="tablist"
          aria-label={STRINGS.pageTitle}
          className="grid grid-cols-2 gap-1 rounded-xl border border-[var(--qiraat-card-stroke,#d7c7a7)] bg-black/5 p-1 text-center"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'stats'}
            onClick={() => setActiveTab('stats')}
            className={`min-h-[44px] rounded-lg text-sm font-bold transition-all ${
              activeTab === 'stats'
                ? 'bg-[var(--qiraat-card-fill,#ffffff)] text-[var(--mushaf-ink,#171717)] shadow-xs'
                : 'text-[var(--mushaf-brown,#665b48)] hover:text-[var(--mushaf-ink,#171717)]'
            }`}
          >
            {STRINGS.tabStats}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'bookmarks'}
            onClick={() => setActiveTab('bookmarks')}
            className={`min-h-[44px] rounded-lg text-sm font-bold transition-all ${
              activeTab === 'bookmarks'
                ? 'bg-[var(--qiraat-card-fill,#ffffff)] text-[var(--mushaf-ink,#171717)] shadow-xs'
                : 'text-[var(--mushaf-brown,#665b48)] hover:text-[var(--mushaf-ink,#171717)]'
            }`}
          >
            {STRINGS.tabBookmarks}
          </button>
        </div>
      </div>

      {/* Content Area */}
      <main className="mx-auto w-full max-w-2xl flex-1 pb-12">
        {activeTab === 'stats' ? (
          <ReadingStatisticsView onOpenAddSession={() => setIsAddSessionOpen(true)} />
        ) : (
          <BookmarksView />
        )}
      </main>

      {/* Add Reading Session Sheet */}
      <AddReadingSessionSheet
        isOpen={isAddSessionOpen}
        onClose={() => setIsAddSessionOpen(false)}
        onSaved={(result) => {
          if (result.justCompletedKhatma) {
            setJustCompletedKhatma(result.justCompletedKhatma)
          }
        }}
      />

      {/* Khatma Celebration Dialog */}
      <KhatmaCelebrationDialog
        khatma={justCompletedKhatma}
        isOpen={justCompletedKhatma !== null}
        onClose={() => setJustCompletedKhatma(null)}
        onStartNewKhatma={() => setJustCompletedKhatma(null)}
      />
    </div>
  )
}
