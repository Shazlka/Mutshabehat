'use client'

import { useState, useMemo, useCallback, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type {
  AyahKey,
  BatchPlan,
  BatchRecord,
} from '../../../packages/memorization-core/types'
import type { MemorizationSelection } from '../../../packages/memorization-core/selection'
import { resolveSelection } from '../../../packages/memorization-core/selection'
import { computeMilestones, type Milestone } from '../../../packages/memorization-core/planner'
import { computeMemorizationSnapshot } from '../../../packages/memorization-core/statistics'
import { useMemorizationStore } from '../../lib/hooks/useMemorizationStore'
import {
  getBrowserQuranIndex,
  getAllSurahNames,
  getAllSurahMetas,
} from '../../lib/memorization-view'
import { getMemorizationThemeStyles } from '../../components/memorization/theme'
import { DashboardView } from '../../components/memorization/DashboardView'
import { HistoryView } from '../../components/memorization/HistoryView'
import { UpdateSheet } from '../../components/memorization/UpdateSheet'
import { UndoToast, type ToastPayload } from '../../components/memorization/UndoToast'
import type { MushafAppearance } from '../mushaf-1441/_components/mushafTheme'

const STRINGS = {
  backToMushaf: 'المصحف',
  pageTitle: 'حفظ القرآن',
  tabDashboard: 'الرئيسية',
  tabHistory: 'السجل',
  updateButton: 'تحديث الحفظ',
  storageProblemTitle: 'تعذّر فتح بيانات الحفظ',
  storageProblemDescription:
    'قد لا تُحفظ التغييرات في هذا الوضع (التصفح الخاص أو التخزين معطل).',
}

interface StoredPosition {
  readonly from: AyahKey
  readonly to: AyahKey
}

const POSITION_STORAGE_KEY = 'memorization:currentPosition:v1'
const APPEARANCE_STORAGE_KEY = 'mushaf1441:appearance:v1'

function subscribeAppearance(callback: () => void) {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('storage', callback)
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', callback)
  return () => {
    window.removeEventListener('storage', callback)
    media.removeEventListener('change', callback)
  }
}

function getAppearanceSnapshot(): MushafAppearance {
  if (typeof window === 'undefined') return 'system'
  try {
    const val = window.localStorage.getItem(APPEARANCE_STORAGE_KEY)
    if (
      val === 'system' ||
      val === 'light' ||
      val === 'dark' ||
      val === 'whitePage' ||
      val === 'blackPage'
    ) {
      return val
    }
  } catch {}
  return 'system'
}

function subscribeCurrentPosition(callback: () => void) {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('storage', callback)
  window.addEventListener('memorization-position-changed', callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener('memorization-position-changed', callback)
  }
}

function getCurrentPositionSnapshot(): StoredPosition | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(POSITION_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as StoredPosition
      if (
        parsed &&
        typeof parsed.from?.surah === 'number' &&
        typeof parsed.from?.ayah === 'number' &&
        typeof parsed.to?.surah === 'number' &&
        typeof parsed.to?.ayah === 'number'
      ) {
        return parsed
      }
    }
  } catch {}
  return null
}

function saveCurrentPositionToStorage(pos: StoredPosition | null) {
  if (typeof window === 'undefined') return
  try {
    if (pos) {
      window.localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(pos))
    } else {
      window.localStorage.removeItem(POSITION_STORAGE_KEY)
    }
    window.dispatchEvent(new Event('memorization-position-changed'))
  } catch {}
}

export default function MemorizationPage() {
  const router = useRouter()
  const index = useMemo(() => getBrowserQuranIndex(), [])
  const surahNames = useMemo(() => getAllSurahNames(), [])
  const surahs = useMemo(() => getAllSurahMetas(), [])

  const store = useMemorizationStore(index)
  const appearance = useSyncExternalStore(
    subscribeAppearance,
    getAppearanceSnapshot,
    () => 'system' as MushafAppearance,
  )

  const currentPosition = useSyncExternalStore(
    subscribeCurrentPosition,
    getCurrentPositionSnapshot,
    () => null,
  )

  const [activeTab, setActiveTab] = useState<'dashboard' | 'history'>('dashboard')
  const [isUpdateSheetOpen, setIsUpdateSheetOpen] = useState(false)
  const [sheetInitialSelection, setSheetInitialSelection] =
    useState<MemorizationSelection | null>(null)
  const [toast, setToast] = useState<ToastPayload | null>(null)

  const handleOpenUpdate = useCallback((selection?: MemorizationSelection) => {
    setSheetInitialSelection(selection ?? null)
    setIsUpdateSheetOpen(true)
  }, [])

  const handleCloseUpdate = useCallback(() => {
    setIsUpdateSheetOpen(false)
    setSheetInitialSelection(null)
  }, [])

  const handleOpenInMushaf = useCallback(
    (page: number, _ayah?: AyahKey) => {
      router.push(`/mushaf-1441?page=${page}`)
    },
    [router],
  )

  const handleApplyPlan = useCallback(
    async (
      plan: BatchPlan,
      makeCurrentPosition: boolean,
      selection: MemorizationSelection,
    ): Promise<BatchRecord | null> => {
      const batch = await store.applyPlan(plan)
      if (batch && makeCurrentPosition) {
        const keys = resolveSelection(selection, index)
        if (keys.length > 0) {
          saveCurrentPositionToStorage({
            from: keys[0],
            to: keys[keys.length - 1],
          })
        }
      }
      return batch
    },
    [store, index],
  )

  const handleApplied = useCallback(
    (plan: BatchPlan, batch: BatchRecord, _makeCurrentPosition: boolean) => {
      const beforeSnapshot = store.statistics
      let milestones: readonly Milestone[] = []

      if (beforeSnapshot) {
        const updatedRecords = { ...store.records }
        for (const change of plan.changes) {
          updatedRecords[`${change.key.surah}:${change.key.ayah}`] = change.after
        }
        const afterSnapshot = computeMemorizationSnapshot(updatedRecords, index)
        milestones = computeMilestones(beforeSnapshot, afterSnapshot)
      }

      setToast({
        batchId: batch.id,
        changedAyatCount: plan.changes.length,
        milestones,
      })
    },
    [store.statistics, store.records, index],
  )

  const handleUndoToast = useCallback(
    async (batchId: string) => {
      await store.undoBatch(batchId)
      setToast(null)
    },
    [store],
  )

  const handleDismissToast = useCallback(() => {
    setToast(null)
  }, [])

  return (
    <div
      dir="rtl"
      data-mushaf-appearance={appearance}
      className="mushaf-reader-root relative flex min-h-screen w-full flex-col bg-[var(--mushaf-paper,#faf8f3)] dark:bg-[var(--mushaf-paper,#18191d)] text-[var(--mushaf-ink,#1c1b18)] dark:text-[var(--mushaf-ink,#e6e4df)]"
    >
      {/* Injected Theme Styles */}
      <style
        id="memorization-theme-styles"
        dangerouslySetInnerHTML={{ __html: getMemorizationThemeStyles() }}
      />

      {/* Top Bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200/80 dark:border-neutral-800/80 bg-white/80 dark:bg-neutral-900/80 px-4 py-2.5 backdrop-blur-md">
        <Link
          href="/mushaf-1441"
          className="flex items-center gap-1 text-sm font-semibold text-emerald-800 dark:text-emerald-400 hover:opacity-80 min-h-[44px]"
        >
          <span className="text-base">‹</span>
          <span>{STRINGS.backToMushaf}</span>
        </Link>

        <h1 className="text-base font-bold text-gray-900 dark:text-neutral-100">
          {STRINGS.pageTitle}
        </h1>

        <div className="w-16" />
      </header>

      {/* Storage Warning if offline storage failed */}
      {store.error === 'storage' && (
        <div className="mx-4 mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="font-bold">{STRINGS.storageProblemTitle}</p>
          <p className="mt-0.5">{STRINGS.storageProblemDescription}</p>
        </div>
      )}

      {/* Tab Switcher: الرئيسية | السجل */}
      <nav
        aria-label="أقسام الحفظ"
        className="mx-auto mt-3 w-full max-w-md px-4"
      >
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-200/70 dark:bg-neutral-800 p-1">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`rounded-lg py-2 text-xs font-bold transition min-h-[44px] flex items-center justify-center ${
              activeTab === 'dashboard'
                ? 'bg-white dark:bg-neutral-900 text-gray-900 dark:text-neutral-100 shadow-xs'
                : 'text-gray-500 hover:text-gray-900 dark:text-neutral-400 dark:hover:text-neutral-100'
            }`}
          >
            {STRINGS.tabDashboard}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`rounded-lg py-2 text-xs font-bold transition min-h-[44px] flex items-center justify-center ${
              activeTab === 'history'
                ? 'bg-white dark:bg-neutral-900 text-gray-900 dark:text-neutral-100 shadow-xs'
                : 'text-gray-500 hover:text-gray-900 dark:text-neutral-400 dark:hover:text-neutral-100'
            }`}
          >
            {STRINGS.tabHistory}
          </button>
        </div>
      </nav>

      {/* Tab Content Body */}
      <main className="mx-auto w-full max-w-xl flex-1 pb-16">
        {activeTab === 'dashboard' ? (
          <DashboardView
            snapshot={store.statistics}
            records={store.records}
            batches={store.batches}
            events={store.events}
            goals={store.goals}
            dueAyat={store.dueAyat}
            streak={store.streak}
            index={index}
            surahNames={surahNames}
            currentPosition={currentPosition}
            onNavigateToHistory={() => setActiveTab('history')}
            onOpenUpdate={handleOpenUpdate}
            onOpenInMushaf={handleOpenInMushaf}
            onSaveGoal={store.saveGoal}
            onDeleteGoal={store.deleteGoal}
            onStartReview={handleOpenUpdate}
          />
        ) : (
          <HistoryView
            batches={store.batches}
            events={store.events}
            onUndoBatch={store.undoBatch}
          />
        )}
      </main>

      {/* Persistent Bottom Action Bar (Update Sheet Opener) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200/80 dark:border-neutral-800/80 bg-white/95 dark:bg-neutral-900/95 px-4 py-2.5 backdrop-blur-md pb-[calc(0.625rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-md">
          <button
            type="button"
            onClick={() => handleOpenUpdate()}
            data-testid="memo-update-button"
            className="flex w-full items-center justify-center rounded-2xl bg-[var(--memo-mastered,#1A6B4A)] px-5 py-3 text-sm font-bold text-white shadow-md transition hover:opacity-95 active:scale-[0.99] min-h-[44px]"
          >
            {STRINGS.updateButton}
          </button>
        </div>
      </div>

      {/* Update Bottom Sheet */}
      <UpdateSheet
        isOpen={isUpdateSheetOpen}
        initialSelection={sheetInitialSelection}
        records={store.records}
        index={index}
        surahNames={surahNames}
        surahs={surahs}
        onClose={handleCloseUpdate}
        onApplyPlan={handleApplyPlan}
        onApplied={handleApplied}
      />

      {/* Undo Toast */}
      {toast && (
        <UndoToast
          toast={toast}
          surahNames={surahNames}
          onUndo={handleUndoToast}
          onDismiss={handleDismissToast}
          durationMs={8000}
        />
      )}
    </div>
  )
}
