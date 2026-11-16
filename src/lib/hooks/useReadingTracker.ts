'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { KhatmaRecord } from '../../../packages/reading-core'
import type { ReadAyahInput, ReadingRepository } from '../storage/reading-db'
import { ReadingTrackerCore, type ReadingDwellCredit } from '../storage/readingTrackerCore'
import { defaultReadingStore } from './useReadingStore'

export interface UseReadingTrackerOptions {
  page: number
  ayahs: readonly Omit<ReadAyahInput, 'page'>[]
  enabled?: boolean
  repository?: ReadingRepository
  now?: () => number
}

export interface ReadingTrackerHookValue {
  justCompletedKhatma: KhatmaRecord | null
  clearJustCompletedKhatma(): void
  flush(): Promise<void>
}

interface CompletionExternalStore {
  subscribe(listener: () => void): () => void
  getSnapshot(): KhatmaRecord | null
  clear(): void
  set(value: KhatmaRecord): void
}

function createCompletionStore(): CompletionExternalStore {
  let value: KhatmaRecord | null = null
  const listeners = new Set<() => void>()
  const emit = () => { for (const listener of listeners) listener() }
  return {
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    getSnapshot: () => value,
    clear() { if (value) { value = null; emit() } },
    set(next) { value = next; emit() },
  }
}

const GET_SERVER_SNAPSHOT_NULL = () => null

export function useReadingTracker(options: UseReadingTrackerOptions): ReadingTrackerHookValue {
  const [runtime] = useState(() => ({
    core: new ReadingTrackerCore(),
    completion: createCompletionStore(),
  }))

  const pending = useRef<Promise<void>>(Promise.resolve())
  const nowRef = useRef(options.now)
  const repoRef = useRef(options.repository)

  useEffect(() => {
    nowRef.current = options.now
    repoRef.current = options.repository
  }, [options.now, options.repository])

  const { page, ayahs, enabled = true } = options
  const items = useMemo<ReadAyahInput[]>(
    () => ayahs.map((ayah) => ({ ...ayah, page })),
    [ayahs, page],
  )

  const getNow = useCallback(() => (nowRef.current ? nowRef.current() : Date.now()), [])

  const persistCredit = useCallback((credit: ReadingDwellCredit | null) => {
    if (!credit) return pending.current
    pending.current = pending.current.then(async () => {
      const repository = repoRef.current ?? await defaultReadingStore.getRepository()
      const result = await repository.recordReadAyahs(credit.items, {
        pagesCount: credit.isFullPage ? 1 : 0,
        seconds: credit.isFullPage ? Math.max(30, Math.min(300, Math.trunc(credit.elapsedSeconds))) : 0,
      })
      runtime.core.creditApplied(credit)
      if (result.justCompletedKhatma) runtime.completion.set(result.justCompletedKhatma)
      if (!repoRef.current) await defaultReadingStore.refresh()
    }).catch(() => undefined)
    return pending.current
  }, [runtime])

  const flush = useCallback(async () => {
    await persistCredit(runtime.core.flush(getNow()))
  }, [getNow, persistCredit, runtime])

  useEffect(() => {
    if (!enabled) { void flush(); return }
    runtime.core.startPage(page, items, getNow())
    const timer = setInterval(() => { void persistCredit(runtime.core.creditAt(getNow())) }, 1000)
    return () => {
      clearInterval(timer)
      void persistCredit(runtime.core.flush(getNow()))
    }
  }, [enabled, flush, getNow, items, page, persistCredit, runtime])

  useEffect(() => {
    if (!enabled) return
    const visibility = () => {
      if (document.visibilityState === 'hidden') void flush()
      else runtime.core.resume(getNow())
    }
    const pageHide = () => { void flush() }
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('pagehide', pageHide)
    return () => {
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('pagehide', pageHide)
    }
  }, [enabled, flush, getNow, runtime])

  const justCompletedKhatma = useSyncExternalStore(
    runtime.completion.subscribe,
    runtime.completion.getSnapshot,
    GET_SERVER_SNAPSHOT_NULL,
  )

  const clearJustCompletedKhatma = useCallback(() => {
    runtime.completion.clear()
  }, [runtime])

  return {
    justCompletedKhatma,
    clearJustCompletedKhatma,
    flush,
  }
}
