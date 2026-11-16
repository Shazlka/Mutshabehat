'use client'

import { useSyncExternalStore } from 'react'
import type { BookmarkType, KhatmaRecord, QuranBookmark, ReadingDayRecord, ReadingStreakSummary } from '../../../packages/reading-core'
import {
  createMemoryReadingRepository,
  openReadingRepository,
  type DeletedReadingSession,
  type ReadAyahInput,
  type ReadingActivityEvent,
  type ReadingImportResult,
  type ReadingRepository,
  type RecordReadingOptions,
  type RecordReadingResult,
} from '../storage/reading-db'

export interface ReadingStoreSnapshot {
  loading: boolean
  persistent: boolean
  bookmarks: readonly QuranBookmark[]
  khatmas: readonly KhatmaRecord[]
  activeKhatma: KhatmaRecord | null
  readingDays: readonly ReadingDayRecord[]
  activityEvents: readonly ReadingActivityEvent[]
  streaks: ReadingStreakSummary
  error: string | null
  revision: number
}

export interface ReadingStoreActions {
  refresh(): Promise<void>
  addBookmark(input: Parameters<ReadingRepository['addBookmark']>[0]): Promise<QuranBookmark | null>
  removeBookmark(id: string): Promise<boolean>
  recordReadAyahs(items: readonly ReadAyahInput[], options?: RecordReadingOptions): Promise<RecordReadingResult>
  addManualSession(input: Parameters<ReadingRepository['addManualSession']>[0]): Promise<RecordReadingResult>
  deleteSession(id: string): Promise<DeletedReadingSession | null>
  undoDeleteSession(deleted: DeletedReadingSession): Promise<boolean>
  exportJSON(): Promise<string>
  importJSON(json: string, mode?: 'merge' | 'replace'): Promise<ReadingImportResult>
}

export interface ReadingStore extends ReadingStoreActions {
  subscribe(listener: () => void): () => void
  getSnapshot(): ReadingStoreSnapshot
  getServerSnapshot(): ReadingStoreSnapshot
  getRepository(): Promise<ReadingRepository>
}

const EMPTY_STREAK: ReadingStreakSummary = { currentStreak: 0, longestStreak: 0, totalReadingDays: 0 }
const SERVER_SNAPSHOT: ReadingStoreSnapshot = {
  loading: true, persistent: false, bookmarks: [], khatmas: [], activeKhatma: null,
  readingDays: [], activityEvents: [], streaks: EMPTY_STREAK, error: null, revision: 0,
}

export function createReadingStore(givenRepository?: ReadingRepository): ReadingStore {
  let repository = givenRepository ?? createMemoryReadingRepository()
  let initialized = Boolean(givenRepository)
  let initializePromise: Promise<void> | null = null
  let snapshot: ReadingStoreSnapshot = { ...SERVER_SNAPSHOT, loading: !givenRepository, persistent: repository.persistent }
  const listeners = new Set<() => void>()
  const emit = () => { for (const listener of listeners) listener() }
  const update = (patch: Partial<ReadingStoreSnapshot>) => {
    snapshot = { ...snapshot, ...patch, revision: snapshot.revision + 1 }
    emit()
  }

  const initialize = async () => {
    if (initialized) return
    if (!initializePromise) {
      initializePromise = (async () => {
        try {
          repository = await openReadingRepository()
          initialized = true
        } finally {
          if (!initialized) initializePromise = null
        }
      })()
    }
    await initializePromise
  }

  let refreshPromise: Promise<void> | null = null

  const doRefresh = async () => {
    try {
      await initialize()
      const [bookmarks, khatmas, activeKhatma, readingDays, activityEvents, streaks] = await Promise.all([
        repository.listBookmarks(), repository.listKhatmas(), repository.getOrCreateActiveKhatma(),
        repository.listReadingDays(), repository.listActivityEvents(), repository.getStreaks(),
      ])
      update({ loading: false, persistent: repository.persistent, bookmarks, khatmas,
        activeKhatma, readingDays, activityEvents, streaks, error: null })
    } catch { update({ loading: false, persistent: false, error: 'storage' }) }
  }

  const refresh = async () => {
    refreshPromise = (refreshPromise ?? Promise.resolve()).then(doRefresh)
    return refreshPromise
  }

  const mutate = async <T,>(operation: () => Promise<T>): Promise<T> => {
    await initialize()
    const result = await operation()
    await refresh()
    return result
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      if (snapshot.loading) void refresh()
      return () => listeners.delete(listener)
    },
    getSnapshot: () => snapshot,
    getServerSnapshot: () => SERVER_SNAPSHOT,
    async getRepository() { await initialize(); return repository },
    refresh,
    addBookmark: (input) => mutate(() => repository.addBookmark(input)),
    removeBookmark: (id) => mutate(() => repository.removeBookmark(id)),
    recordReadAyahs: (items, options) => mutate(() => repository.recordReadAyahs(items, options)),
    addManualSession: (input) => mutate(() => repository.addManualSession(input)),
    deleteSession: (id) => mutate(() => repository.deleteSession(id)),
    undoDeleteSession: (deleted) => mutate(() => repository.undoDeleteSession(deleted)),
    async exportJSON() { await initialize(); return repository.exportJSON() },
    importJSON: (json, mode) => mutate(() => repository.importJSON(json, mode)),
  }
}

export const defaultReadingStore = createReadingStore()

export function useReadingStore(store: ReadingStore = defaultReadingStore): ReadingStoreSnapshot & ReadingStoreActions {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)
  return {
    ...snapshot,
    refresh: store.refresh,
    addBookmark: store.addBookmark,
    removeBookmark: store.removeBookmark,
    recordReadAyahs: store.recordReadAyahs,
    addManualSession: store.addManualSession,
    deleteSession: store.deleteSession,
    undoDeleteSession: store.undoDeleteSession,
    exportJSON: store.exportJSON,
    importJSON: store.importJSON,
  }
}

export type { BookmarkType }

