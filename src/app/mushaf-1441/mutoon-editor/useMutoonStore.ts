'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import type { WorkId } from './data'
import { applyIntent, mergeResults, snapshotOf, type Intent, type Op, type OpResult, type Snapshot, type VerseRow, type VerseState } from './ops'

const API = '/api/mushaf-1441/mutoon-editor'
const POLL_MS = 8000
const REQUEST_TIMEOUT_MS = 25000

export type VerseListItem = VerseRow & { marks: number; assignments: number; sharh?: boolean }
export type ChapterData = { index: number; title: string; farsh: boolean; verses: VerseListItem[] }
export type WorkData = { work: { work: WorkId; title: string; author: string }; chapters: ChapterData[] }
export type Phase = 'idle' | 'saving' | 'error'
export type SaveStatus = { phase: Phase; pending: number; lastSavedAt: number | null; message: string }
export type Notice = { id: number; text: string; tone: 'info' | 'warn' }
export type DispatchResult = { ok: true } | { ok: false; error: string; orphans?: number }

class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message) }
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, { ...init, cache: 'no-store', signal: controller.signal })
    let body: unknown = null
    try { body = await response.json() } catch { /* not JSON */ }
    if (!response.ok) throw new ApiError((body as { error?: string } | null)?.error ?? 'تعذر الاتصال بالخادم', response.status)
    return body as T
  } catch (e) {
    if (e instanceof ApiError) throw e
    throw new ApiError(controller.signal.aborted ? 'انتهت مهلة الاتصال' : 'لا يوجد اتصال بالخادم', 0)
  } finally {
    clearTimeout(timer)
  }
}

type VerseBundle = { work: WorkId; chapter?: string; verse: VerseRow; marks: VerseState['marks']; assignments: VerseState['assignments']; sharh?: VerseState['sharh'] }
type HistoryStep = { key: string; before: Snapshot; after: Snapshot }
const keyOf = (work: WorkId, verse: number) => `${work}:${verse}`
const toState = (b: VerseBundle): VerseState => ({ work: b.work, chapter: b.chapter, verse: b.verse, marks: b.marks, assignments: b.assignments, sharh: b.sharh ?? null })
const sameState = (a: VerseState, b: VerseState) => JSON.stringify([a.verse, a.marks, a.assignments, a.sharh ?? null]) === JSON.stringify([b.verse, b.marks, b.assignments, b.sharh ?? null])

function newClientId(): string {
  try {
    const existing = sessionStorage.getItem('mutoon-client')
    if (existing) return existing
    const fresh = `web-${Math.random().toString(36).slice(2, 8)}`
    sessionStorage.setItem('mutoon-client', fresh)
    return fresh
  } catch { return 'web' }
}

export type StoreSnapshot = {
  works: Partial<Record<WorkId, WorkData>>
  loading: Partial<Record<WorkId, boolean>>
  loadError: string | null
  status: SaveStatus
  notices: Notice[]
  online: boolean
  canUndo: boolean
  canRedo: boolean
}

/**
 * The editor's data layer, outside React. Confirmed rows per verse come from the database; edits are queued as intents
 * per verse, shown immediately (confirmed + queued intents) and sent one at a time, each planned against the latest
 * confirmed rows so it carries their versions. A stale version answers 409: the queue for that verse is dropped and the
 * verse reloaded, so nothing is ever overwritten silently.
 */
export class MutoonEngine {
  private listeners = new Set<() => void>()
  private confirmed = new Map<string, VerseState>()
  private queues = new Map<string, Intent[]>()
  private flushing = new Set<string>()
  private retryTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private failures = new Map<string, number>()
  private undoStack: HistoryStep[] = []
  private redoStack: HistoryStep[] = []
  private pollSeq: number | null = null
  private clientId = 'web'
  private noticeSeq = 0
  private workData: Partial<Record<WorkId, WorkData>> = {}
  private loadingFlags: Partial<Record<WorkId, boolean>> = {}
  private error: string | null = null
  private statusValue: SaveStatus = { phase: 'idle', pending: 0, lastSavedAt: null, message: '' }
  private noticeList: Notice[] = []
  private onlineValue = true
  private snap!: StoreSnapshot
  private timers: Array<() => void> = []

  constructor() { this.emit() }

  // ---- subscription ----
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  getSnapshot = () => this.snap
  getServerSnapshot = () => this.snap

  private emit() {
    const works: Partial<Record<WorkId, WorkData>> = {}
    for (const [work, data] of Object.entries(this.workData) as Array<[WorkId, WorkData]>) {
      works[work] = {
        ...data,
        chapters: data.chapters.map(ch => ({
          ...ch,
          verses: ch.verses.map(v => {
            const state = this.displayOf(keyOf(work, v.number))
            return state ? { ...v, lines: state.verse.lines, version: state.verse.version, marks: state.marks.length, assignments: state.assignments.length, sharh: !!state.sharh } : v
          }),
        })),
      }
    }
    this.snap = {
      works, loading: { ...this.loadingFlags }, loadError: this.error, status: this.statusValue, notices: this.noticeList, online: this.onlineValue,
      canUndo: this.undoStack.length > 0, canRedo: this.redoStack.length > 0,
    }
    for (const l of this.listeners) l()
  }

  private pending() { let n = 0; for (const q of this.queues.values()) n += q.length; return n }
  private setStatus(patch: Partial<SaveStatus>) { this.statusValue = { ...this.statusValue, pending: this.pending(), ...patch } }

  notify = (text: string, tone: Notice['tone'] = 'info') => {
    const id = ++this.noticeSeq
    this.noticeList = [...this.noticeList.slice(-2), { id, text, tone }]
    this.emit()
    setTimeout(() => this.dismissNotice(id), tone === 'warn' ? 7000 : 4000)
  }
  dismissNotice = (id: number) => { this.noticeList = this.noticeList.filter(n => n.id !== id); this.emit() }

  // ---- lifecycle ----
  start() {
    this.clientId = newClientId()
    const poll = setInterval(() => void this.poll(), POLL_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') void this.poll() }
    const onUnload = (event: BeforeUnloadEvent) => { if (this.pending() > 0) event.preventDefault() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('beforeunload', onUnload)
    this.timers.push(() => clearInterval(poll), () => document.removeEventListener('visibilitychange', onVisible), () => window.removeEventListener('beforeunload', onUnload))
  }
  stop() { for (const t of this.timers) t(); this.timers = []; for (const t of this.retryTimers.values()) clearTimeout(t) }

  // ---- reading ----
  displayOf = (key: string): VerseState | undefined => {
    const base = this.confirmed.get(key)
    if (!base) return undefined
    let state = base
    for (const intent of this.queues.get(key) ?? []) state = applyIntent(state, intent).next
    return state
  }
  verse = (work: WorkId, verse: number) => this.displayOf(keyOf(work, verse))

  loadWork = async (work: WorkId, force = false) => {
    if (!force && (this.workData[work] || this.loadingFlags[work])) return
    this.loadingFlags[work] = true
    this.emit()
    try {
      const data = await api<WorkData & { seq: number }>(`${API}?work=${work}`)
      this.workData[work] = { work: data.work, chapters: data.chapters }
      if (this.pollSeq === null) this.pollSeq = data.seq
      this.error = null
      this.onlineValue = true
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'تعذر التحميل'
      this.onlineValue = false
    } finally {
      this.loadingFlags[work] = false
      this.emit()
    }
  }

  loadVerse = async (work: WorkId, verse: number, force = false): Promise<VerseState | undefined> => {
    const key = keyOf(work, verse)
    if (!force && this.confirmed.has(key)) return this.confirmed.get(key)
    try {
      const state = toState(await api<VerseBundle>(`${API}?work=${work}&verse=${verse}`))
      this.confirmed.set(key, state)
      this.onlineValue = true
      this.emit()
      return state
    } catch (e) {
      this.notify(e instanceof Error ? e.message : 'تعذر تحميل البيت', 'warn')
      return undefined
    }
  }

  // ---- writing ----
  dispatch = (work: WorkId, verse: number, intent: Intent, record = true): DispatchResult => {
    const key = keyOf(work, verse)
    const current = this.displayOf(key)
    if (!current) return { ok: false, error: 'البيت لم يُحمَّل بعد' }
    const planned = applyIntent(current, intent)
    if (planned.error) return { ok: false, error: planned.error, orphans: planned.orphans }
    if (planned.ops.length === 0) return { ok: true }
    if (record && intent.k !== 'restore') {
      this.undoStack = [...this.undoStack.slice(-49), { key, before: snapshotOf(current), after: snapshotOf(planned.next) }]
      this.redoStack = []
    }
    const queue = this.queues.get(key) ?? []
    queue.push(intent)
    this.queues.set(key, queue)
    this.failures.set(key, 0)
    this.setStatus({ phase: 'saving' })
    this.emit()
    void this.flush(key)
    return { ok: true }
  }

  undo = () => {
    const step = this.undoStack.pop()
    if (!step) return
    this.redoStack.push(step)
    const [work, verse] = step.key.split(':')
    this.dispatch(work as WorkId, Number(verse), { k: 'restore', target: step.before }, false)
    this.emit()
  }
  redo = () => {
    const step = this.redoStack.pop()
    if (!step) return
    this.undoStack.push(step)
    const [work, verse] = step.key.split(':')
    this.dispatch(work as WorkId, Number(verse), { k: 'restore', target: step.after }, false)
    this.emit()
  }
  retry = () => {
    for (const key of this.queues.keys()) { this.failures.set(key, 0); void this.flush(key) }
    if (this.queues.size === 0) { this.setStatus({ phase: 'idle', message: '' }); this.emit() }
  }

  private async flush(key: string): Promise<void> {
    if (this.flushing.has(key)) return
    this.flushing.add(key)
    const queue = this.queues.get(key) ?? []
    this.setStatus({ phase: 'saving' })
    try {
      while (queue.length > 0) {
        const base = this.confirmed.get(key)
        if (!base) { queue.length = 0; break }
        const planned = applyIntent(base, queue[0])
        if (planned.error || planned.ops.length === 0) { queue.shift(); continue }
        const ops: Op[] = planned.ops
        try {
          const result = await api<{ seq: number; results: OpResult[] }>(API, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ops, lines: { [key]: planned.next.verse.lines }, client: this.clientId }),
          })
          this.confirmed.set(key, mergeResults(base, result.results))
          queue.shift()
          this.failures.set(key, 0)
          this.onlineValue = true
          this.setStatus({ phase: queue.length > 0 ? 'saving' : 'idle', lastSavedAt: Date.now(), message: '' })
          this.emit()
        } catch (e) {
          const err = e instanceof ApiError ? e : new ApiError('لا يوجد اتصال بالخادم', 0)
          if (err.status === 0 || err.status >= 500) {
            this.onlineValue = false
            this.setStatus({ phase: 'error', message: err.message })
            this.scheduleRetry(key)
            return
          }
          // 4xx: the verse changed elsewhere, or the edit is invalid. Drop what was queued and show the truth.
          queue.length = 0
          this.queues.delete(key)
          const [work, verse] = key.split(':')
          await this.loadVerse(work as WorkId, Number(verse), true)
          this.notify(err.status === 409 ? 'تغيّر هذا البيت من مكان آخر؛ حُدّث بأحدث نسخة ولم يُحفظ آخر تعديل' : err.message, 'warn')
          this.setStatus({ phase: 'idle', message: '' })
          return
        }
      }
    } finally {
      this.flushing.delete(key)
      if (queue.length === 0) this.queues.delete(key)
      this.emit()
    }
  }

  private scheduleRetry(key: string) {
    const attempts = (this.failures.get(key) ?? 0) + 1
    this.failures.set(key, attempts)
    if (attempts > 5) return
    clearTimeout(this.retryTimers.get(key))
    this.retryTimers.set(key, setTimeout(() => void this.flush(key), Math.min(2000 * 2 ** (attempts - 1), 20000)))
  }

  // ---- live: pick up what other devices changed ----
  private async poll() {
    if (this.pollSeq === null || document.visibilityState === 'hidden') return
    try {
      const data = await api<{ seq: number; full: boolean; verses: VerseBundle[] }>(`${API}?since=${this.pollSeq}`)
      this.onlineValue = true
      if (data.full) {
        this.confirmed.clear()
        this.pollSeq = data.seq
        this.workData = {}
        this.notify('تغيّرت المتون كثيرًا من مكان آخر؛ أُعيد تحميلها')
        return
      }
      this.pollSeq = data.seq
      for (const bundle of data.verses) {
        const key = keyOf(bundle.work, bundle.verse.number)
        if (this.queues.get(key)?.length || this.flushing.has(key)) continue // our own write is on its way
        const incoming = toState(bundle)
        const had = this.confirmed.get(key)
        if (had && !sameState(had, incoming)) this.notify(`حُدّث البيت ${bundle.verse.number} من جهاز آخر`)
        this.confirmed.set(key, incoming)
        const wd = this.workData[bundle.work]
        if (wd) {
          this.workData[bundle.work] = {
            ...wd,
            chapters: wd.chapters.map(ch => ({
              ...ch,
              verses: ch.verses.map(v => v.number === bundle.verse.number ? { ...v, ...bundle.verse, marks: bundle.marks.length, assignments: bundle.assignments.length, sharh: !!bundle.sharh } : v),
            })),
          }
        }
      }
      this.emit()
    } catch {
      this.onlineValue = false
      this.emit()
    }
  }
}

export function useMutoonStore() {
  const [engine] = useState(() => new MutoonEngine())
  useEffect(() => { engine.start(); return () => engine.stop() }, [engine])
  const snap = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getServerSnapshot)
  return { ...snap, engine, verse: engine.verse, loadWork: engine.loadWork, loadVerse: engine.loadVerse, dispatch: engine.dispatch, undo: engine.undo, redo: engine.redo, retry: engine.retry, notify: engine.notify, dismissNotice: engine.dismissNotice }
}
