'use client'

import { useEffect, useSyncExternalStore } from 'react'
import type { GoalDefinition } from '../../../packages/memorization-core/backup'
import type { QuranIndex } from '../../../packages/memorization-core/quranIndex'
import type { MemorizationSelection } from '../../../packages/memorization-core/selection'
import type { StreakSummary } from '../../../packages/memorization-core/streak'
import type { MemorizationSnapshot } from '../../../packages/memorization-core/statistics'
import type { AyahKey, AyahMemorizationRecord, BatchPlan, BatchRecord, ChangeEvent, ReviewResult } from '../../../packages/memorization-core/types'
import {
  createMemoryMemorizationRepository,
  openMemorizationRepository,
  type MemorizationImportResult,
  type MemorizationRepository,
  type UndoBatchResult,
} from '../storage/memorization-db'

export interface MemorizationStoreSnapshot {
  loading: boolean
  persistent: boolean
  records: Readonly<Record<string, AyahMemorizationRecord>>
  batches: readonly BatchRecord[]
  events: readonly ChangeEvent[]
  goals: readonly GoalDefinition[]
  dueAyat: readonly AyahKey[]
  streak: StreakSummary
  statistics: MemorizationSnapshot | null
  error: string | null
  revision: number
}

export interface MemorizationStoreActions {
  refresh(index?: QuranIndex): Promise<void>
  applyPlan(plan: BatchPlan, now?: Date | string | number): Promise<BatchRecord | null>
  undoBatch(batchId: string, options?: { force?: boolean; now?: Date | string | number }): Promise<UndoBatchResult>
  recordReview(input: { selection: MemorizationSelection; label: string; result: ReviewResult; index: QuranIndex; now?: Date | string | number }): Promise<BatchRecord | null>
  saveGoal(goal: GoalDefinition): Promise<boolean>
  deleteGoal(id: string): Promise<boolean>
  exportJSON(): Promise<string>
  importJSON(json: string, mode?: 'merge' | 'replace'): Promise<MemorizationImportResult>
}

export interface MemorizationStore extends MemorizationStoreActions {
  subscribe(listener: () => void): () => void
  getSnapshot(): MemorizationStoreSnapshot
  getServerSnapshot(): MemorizationStoreSnapshot
  getRepository(): Promise<MemorizationRepository>
}

const SERVER_SNAPSHOT: MemorizationStoreSnapshot = {
  loading: true, persistent: false, records: {}, batches: [], events: [], goals: [], dueAyat: [],
  streak: { current: 0, longest: 0 }, statistics: null, error: null, revision: 0,
}

export function createMemorizationStore(givenRepository?: MemorizationRepository): MemorizationStore {
  let repository = givenRepository ?? createMemoryMemorizationRepository()
  let initialized = Boolean(givenRepository)
  let initializePromise: Promise<void> | null = null
  let latestIndex: QuranIndex | undefined
  let snapshot: MemorizationStoreSnapshot = { ...SERVER_SNAPSHOT, loading: !givenRepository, persistent: repository.persistent }
  const listeners = new Set<() => void>()
  const emit = () => { for (const listener of listeners) listener() }
  const update = (patch: Partial<MemorizationStoreSnapshot>) => {
    snapshot = { ...snapshot, ...patch, revision: snapshot.revision + 1 }
    emit()
  }
  const initialize = async () => {
    if (initialized) return
    if (!initializePromise) {
      initializePromise = (async () => {
        try {
          repository = await openMemorizationRepository()
          initialized = true
        } finally {
          if (!initialized) initializePromise = null
        }
      })()
    }
    await initializePromise
  }
  let refreshPromise: Promise<void> | null = null

  const doRefresh = async (index?: QuranIndex) => {
    if (index) latestIndex = index
    try {
      await initialize()
      const [records, batches, events, goals, dueAyat, streak, statistics] = await Promise.all([
        repository.loadRecords(), repository.listBatches(), repository.events(), repository.listGoals(),
        repository.listDueAyat(), repository.streak(), latestIndex ? repository.statisticsSnapshot(latestIndex) : null,
      ])
      update({ loading: false, persistent: repository.persistent, records, batches, events, goals,
        dueAyat, streak, statistics, error: null })
    } catch { update({ loading: false, persistent: false, error: 'storage' }) }
  }

  const refresh = async (index?: QuranIndex) => {
    refreshPromise = (refreshPromise ?? Promise.resolve()).then(() => doRefresh(index))
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
    applyPlan: (plan, now) => mutate(() => repository.applyPlan(plan, now)),
    undoBatch: (batchId, options) => mutate(() => repository.undoBatch(batchId, options)),
    recordReview: (input) => mutate(() => repository.recordReview(input)),
    saveGoal: (goal) => mutate(() => repository.saveGoal(goal)),
    deleteGoal: (id) => mutate(() => repository.deleteGoal(id)),
    async exportJSON() { await initialize(); return repository.exportJSON() },
    importJSON: (json, mode) => mutate(() => repository.importJSON(json, mode)),
  }
}

export const defaultMemorizationStore = createMemorizationStore()

export function useMemorizationStore(
  index?: QuranIndex,
  store: MemorizationStore = defaultMemorizationStore,
): MemorizationStoreSnapshot & MemorizationStoreActions {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)
  useEffect(() => {
    if (index) void store.refresh(index)
  }, [index, store])
  return {
    ...snapshot,
    refresh: store.refresh,
    applyPlan: store.applyPlan,
    undoBatch: store.undoBatch,
    recordReview: store.recordReview,
    saveGoal: store.saveGoal,
    deleteGoal: store.deleteGoal,
    exportJSON: store.exportJSON,
    importJSON: store.importJSON,
  }
}

