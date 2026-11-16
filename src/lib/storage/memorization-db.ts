import {
  MEMORIZATION_EXPORT_CURRENT_VERSION,
  decodeMemorizationExport,
  encodeStableJson,
  mergeMemorizationExports,
  type GoalDefinition,
  type MemorizationExport,
} from '../../../packages/memorization-core/backup'
import {
  applyBatchPlan,
  planReview,
  undoBatchPlan,
} from '../../../packages/memorization-core/planner'
import { getDueAyat } from '../../../packages/memorization-core/reviewEngine'
import { computeMemorizationSnapshot, type MemorizationSnapshot } from '../../../packages/memorization-core/statistics'
import { calculateStreakSummary, type StreakSummary } from '../../../packages/memorization-core/streak'
import {
  createBlankRecord,
  toNormalizedIsoString,
  type AyahKey,
  type AyahMemorizationRecord,
  type BatchPlan,
  type BatchRecord,
  type ChangeEvent,
  type ReviewResult,
} from '../../../packages/memorization-core/types'
import type { MemorizationSelection } from '../../../packages/memorization-core/selection'
import type { QuranIndex } from '../../../packages/memorization-core/quranIndex'
import {
  MemoryKVDatabase,
  openKVDatabase,
  type KVDatabase,
  type KVDatabaseDefinition,
  type KVTransaction,
} from './kv'

export const MEMORIZATION_DB_VERSION = 1
export const MEMORIZATION_DB_NAME = 'mushaf_memorization'

export const MEMORIZATION_STORES = {
  ayahs: 'memorization_ayahs',
  batches: 'memorization_batches',
  events: 'memorization_events',
  goals: 'memorization_goals',
  meta: 'memorization_meta',
} as const

export const MEMORIZATION_DB_DEFINITION: KVDatabaseDefinition = {
  name: MEMORIZATION_DB_NAME,
  version: MEMORIZATION_DB_VERSION,
  stores: [
    {
      name: MEMORIZATION_STORES.ayahs,
      keyPath: ['surah', 'ayah'],
      indexes: [
        { name: 'by_next_review', keyPath: 'nextReviewAt' },
        { name: 'by_status', keyPath: 'status' },
      ],
    },
    {
      name: MEMORIZATION_STORES.batches,
      keyPath: 'id',
      indexes: [
        { name: 'by_created_at', keyPath: 'createdAt' },
        { name: 'by_kind', keyPath: 'kind' },
      ],
    },
    {
      name: MEMORIZATION_STORES.events,
      keyPath: 'id',
      indexes: [
        { name: 'by_batch', keyPath: 'batchID' },
        { name: 'by_at', keyPath: 'at' },
        { name: 'by_ayah', keyPath: ['surah', 'ayah'] },
      ],
    },
    { name: MEMORIZATION_STORES.goals, keyPath: 'id' },
    { name: MEMORIZATION_STORES.meta, keyPath: 'key' },
  ],
}

interface StoredChangeEvent extends ChangeEvent {
  id: string
}

interface MetaRow { key: string; value: string }

export interface UndoBatchResult {
  ok: boolean
  batch?: BatchRecord
  reason?: 'notFound' | 'alreadyUndone' | 'notUndoable' | 'incompleteHistory' | 'overlap' | 'storage'
  conflicts?: BatchRecord[]
}

export interface MemorizationImportResult {
  ok: boolean
  imported: number
  error?: 'invalid' | 'storage'
}

const ALL_STORES = Object.values(MEMORIZATION_STORES)

function randomID(): string {
  try { return crypto.randomUUID() } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  }
}

function eventID(event: ChangeEvent): string {
  return `${event.batchID}|${event.surah}:${event.ayah}`
}

function recordsObject(records: readonly AyahMemorizationRecord[]): Record<string, AyahMemorizationRecord> {
  return Object.fromEntries(records.map((record) => [`${record.surah}:${record.ayah}`, record]))
}

async function deviceID(transaction: KVTransaction): Promise<string> {
  const stored = await transaction.get<MetaRow>(MEMORIZATION_STORES.meta, 'device_id')
  if (stored?.value) return stored.value
  const value = randomID()
  await transaction.put(MEMORIZATION_STORES.meta, { key: 'device_id', value } satisfies MetaRow)
  return value
}

async function clearStore(transaction: KVTransaction, store: string, keyPath: string | string[]): Promise<void> {
  for (const row of await transaction.getAll<Record<string, unknown>>(store)) {
    const key = Array.isArray(keyPath) ? keyPath.map((part) => row[part]) : row[keyPath]
    await transaction.delete(store, key as IDBValidKey)
  }
}

export class MemorizationRepository {
  constructor(readonly database: KVDatabase) {}

  get persistent(): boolean { return this.database.persistent }

  async loadRecords(): Promise<Record<string, AyahMemorizationRecord>> {
    try { return recordsObject(await this.database.getAll<AyahMemorizationRecord>(MEMORIZATION_STORES.ayahs)) }
    catch { return {} }
  }

  async record(key: AyahKey): Promise<AyahMemorizationRecord | undefined> {
    try { return await this.database.get<AyahMemorizationRecord>(MEMORIZATION_STORES.ayahs, [key.surah, key.ayah]) }
    catch { return undefined }
  }

  async listBatches(limit = Number.MAX_SAFE_INTEGER, offset = 0): Promise<BatchRecord[]> {
    try {
      return (await this.database.getAll<BatchRecord>(MEMORIZATION_STORES.batches))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
        .slice(offset, offset + limit)
    } catch { return [] }
  }

  async events(batchId?: string): Promise<ChangeEvent[]> {
    try {
      const rows = batchId
        ? await this.database.queryIndex<StoredChangeEvent>(MEMORIZATION_STORES.events, 'by_batch', batchId)
        : await this.database.getAll<StoredChangeEvent>(MEMORIZATION_STORES.events)
      return rows
        .sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id))
        .map((event) => ({
          batchID: event.batchID,
          surah: event.surah,
          ayah: event.ayah,
          at: event.at,
          before: event.before,
          after: event.after,
        }))
    } catch { return [] }
  }

  /** Applies the core plan, batch row and exact before/after snapshots atomically. */
  async applyPlan(plan: BatchPlan, now: Date | string | number = Date.now()): Promise<BatchRecord | null> {
    if (plan.changes.length === 0) return null
    const at = toNormalizedIsoString(now)
    try {
      return await this.database.transaction(
        [MEMORIZATION_STORES.ayahs, MEMORIZATION_STORES.batches, MEMORIZATION_STORES.events, MEMORIZATION_STORES.meta],
        'readwrite',
        async (transaction) => {
          const current = recordsObject(await transaction.getAll<AyahMemorizationRecord>(MEMORIZATION_STORES.ayahs))
          const applied = applyBatchPlan(current, plan)
          const batch: BatchRecord = {
            id: randomID(), createdAt: at, kind: plan.kind, label: plan.label,
            scopeJSON: plan.scopeJSON, ayahCount: plan.changes.length,
            deviceID: await deviceID(transaction), countsForStreak: plan.countsForStreak,
            gainAyahs: plan.gainAyahs, undoneAt: null, undoesBatchID: null,
          }
          await transaction.put(MEMORIZATION_STORES.batches, batch)
          for (const change of plan.changes) {
            const after = applied[`${change.key.surah}:${change.key.ayah}`]
            await transaction.put(MEMORIZATION_STORES.ayahs, after)
            const event: ChangeEvent = {
              batchID: batch.id, surah: change.key.surah, ayah: change.key.ayah,
              at, before: change.before ? { ...change.before } : null, after: { ...after },
            }
            await transaction.put(MEMORIZATION_STORES.events, { ...event, id: eventID(event) })
          }
          return batch
        },
      )
    } catch { return null }
  }

  async undoConflicts(batchId: string): Promise<BatchRecord[]> {
    try {
      const batches = await this.database.getAll<BatchRecord>(MEMORIZATION_STORES.batches)
      const original = batches.find((batch) => batch.id === batchId)
      if (!original) return []
      const touched = new Set((await this.events(batchId)).map((event) => `${event.surah}:${event.ayah}`))
      const candidates = batches.filter((batch) => batch.id !== batchId && !batch.undoneAt
        && (batch.createdAt > original.createdAt || (batch.createdAt === original.createdAt && batch.id > original.id)))
      const result: BatchRecord[] = []
      for (const candidate of candidates) {
        const overlaps = (await this.events(candidate.id)).some((event) => touched.has(`${event.surah}:${event.ayah}`))
        if (overlaps) result.push(candidate)
      }
      return result.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    } catch { return [] }
  }

  /** Restores the exact snapshots via core undo, writes an undo batch, and revokes original streak credit. */
  async undoBatch(batchId: string, options: { force?: boolean; now?: Date | string | number } = {}): Promise<UndoBatchResult> {
    const now = toNormalizedIsoString(options.now ?? Date.now())
    try {
      const original = await this.database.get<BatchRecord>(MEMORIZATION_STORES.batches, batchId)
      if (!original) return { ok: false, reason: 'notFound' }
      if (original.undoneAt) return { ok: false, reason: 'alreadyUndone' }
      if (original.kind === 'undo') return { ok: false, reason: 'notUndoable' }
      const conflicts = await this.undoConflicts(batchId)
      if (conflicts.length > 0 && !options.force) return { ok: false, reason: 'overlap', conflicts }

      return await this.database.transaction(
        [MEMORIZATION_STORES.ayahs, MEMORIZATION_STORES.batches, MEMORIZATION_STORES.events, MEMORIZATION_STORES.meta],
        'readwrite',
        async (transaction) => {
          const storedEvents = await transaction.queryIndex<StoredChangeEvent>(MEMORIZATION_STORES.events, 'by_batch', batchId)
          if (storedEvents.length !== original.ayahCount) return { ok: false, reason: 'incompleteHistory' }
          const current = recordsObject(await transaction.getAll<AyahMemorizationRecord>(MEMORIZATION_STORES.ayahs))
          const undoPlan: BatchPlan = {
            kind: original.kind, label: original.label, scopeJSON: original.scopeJSON,
            selectionCount: storedEvents.length,
            changes: storedEvents.map((event) => ({
              key: { surah: event.surah, ayah: event.ayah }, before: event.before, after: event.after,
            })),
            countsForStreak: false, gainAyahs: 0, unchangedCount: 0,
          }
          const restored = undoBatchPlan(current, undoPlan)
          const undoBatch: BatchRecord = {
            id: randomID(), createdAt: now, kind: 'undo', label: `تراجع: ${original.label}`,
            scopeJSON: original.scopeJSON, ayahCount: storedEvents.length,
            deviceID: await deviceID(transaction), countsForStreak: false, gainAyahs: 0,
            undoneAt: null, undoesBatchID: original.id,
          }
          await transaction.put(MEMORIZATION_STORES.batches, undoBatch)
          await transaction.put(MEMORIZATION_STORES.batches, { ...original, undoneAt: now, countsForStreak: false })
          for (const event of storedEvents) {
            const keyString = `${event.surah}:${event.ayah}`
            const beforeUndo = current[keyString] ?? null
            const restoredRecord = restored[keyString]
            if (restoredRecord) await transaction.put(MEMORIZATION_STORES.ayahs, restoredRecord)
            else await transaction.delete(MEMORIZATION_STORES.ayahs, [event.surah, event.ayah])
            const after = restoredRecord ?? createBlankRecord({ surah: event.surah, ayah: event.ayah }, now)
            const undoEvent: ChangeEvent = {
              batchID: undoBatch.id, surah: event.surah, ayah: event.ayah,
              at: now, before: beforeUndo, after,
            }
            await transaction.put(MEMORIZATION_STORES.events, { ...undoEvent, id: eventID(undoEvent) })
          }
          return { ok: true, batch: undoBatch }
        },
      )
    } catch { return { ok: false, reason: 'storage' } }
  }

  async recordReview(input: {
    selection: MemorizationSelection
    label: string
    result: ReviewResult
    index: QuranIndex
    now?: Date | string | number
  }): Promise<BatchRecord | null> {
    try {
      const records = await this.loadRecords()
      const plan = planReview({ ...input, records, now: input.now ?? Date.now() })
      return this.applyPlan(plan, input.now)
    } catch { return null }
  }

  async listDueAyat(now: Date | string | number = Date.now()): Promise<AyahKey[]> {
    try { return getDueAyat(await this.loadRecords(), now) }
    catch { return [] }
  }

  async statisticsSnapshot(index: QuranIndex): Promise<MemorizationSnapshot> {
    return computeMemorizationSnapshot(await this.loadRecords(), index)
  }

  async streak(now: Date | string | number = Date.now(), timeZone = 'UTC'): Promise<StreakSummary> {
    try {
      const batches = await this.database.getAll<BatchRecord>(MEMORIZATION_STORES.batches)
      return calculateStreakSummary(
        batches.filter((batch) => batch.countsForStreak && !batch.undoneAt).map((batch) => batch.createdAt),
        now,
        timeZone,
      )
    } catch { return { current: 0, longest: 0 } }
  }

  async listGoals(): Promise<GoalDefinition[]> {
    try { return await this.database.getAll<GoalDefinition>(MEMORIZATION_STORES.goals) }
    catch { return [] }
  }

  async saveGoal(goal: GoalDefinition): Promise<boolean> {
    try { await this.database.put(MEMORIZATION_STORES.goals, goal); return true }
    catch { return false }
  }

  async deleteGoal(id: string): Promise<boolean> {
    try { await this.database.delete(MEMORIZATION_STORES.goals, id); return true }
    catch { return false }
  }

  async getMeta(key: string): Promise<string | undefined> {
    try { return (await this.database.get<MetaRow>(MEMORIZATION_STORES.meta, key))?.value }
    catch { return undefined }
  }

  async setMeta(key: string, value: string): Promise<boolean> {
    try { await this.database.put(MEMORIZATION_STORES.meta, { key, value }); return true }
    catch { return false }
  }

  async exportAll(now: Date | string | number = Date.now()): Promise<MemorizationExport> {
    try {
      const metaRows = await this.database.getAll<MetaRow>(MEMORIZATION_STORES.meta)
      return {
        formatVersion: MEMORIZATION_EXPORT_CURRENT_VERSION,
        exportedAt: toNormalizedIsoString(now),
        deviceID: metaRows.find((row) => row.key === 'device_id')?.value ?? 'session',
        records: await this.database.getAll<AyahMemorizationRecord>(MEMORIZATION_STORES.ayahs),
        batches: await this.database.getAll<BatchRecord>(MEMORIZATION_STORES.batches),
        events: await this.events(),
        goals: await this.database.getAll<GoalDefinition>(MEMORIZATION_STORES.goals),
        meta: Object.fromEntries(metaRows.map((row) => [row.key, row.value])),
      }
    } catch {
      return { formatVersion: 1, exportedAt: toNormalizedIsoString(now), deviceID: 'session',
        records: [], batches: [], events: [], goals: [], meta: {} }
    }
  }

  async exportJSON(now: Date | string | number = Date.now()): Promise<string> {
    return encodeStableJson(await this.exportAll(now))
  }

  async importJSON(json: string, mode: 'merge' | 'replace' = 'merge'): Promise<MemorizationImportResult> {
    let incoming: MemorizationExport
    try { incoming = decodeMemorizationExport(json) }
    catch { return { ok: false, imported: 0, error: 'invalid' } }
    try {
      const local = await this.exportAll()
      const merged = mode === 'merge' ? mergeMemorizationExports(local, incoming) : incoming
      await this.database.transaction(ALL_STORES, 'readwrite', async (transaction) => {
        for (const definition of MEMORIZATION_DB_DEFINITION.stores) {
          await clearStore(transaction, definition.name, definition.keyPath!)
        }
        for (const record of merged.records) await transaction.put(MEMORIZATION_STORES.ayahs, record)
        for (const batch of merged.batches) await transaction.put(MEMORIZATION_STORES.batches, batch)
        for (const event of merged.events) {
          await transaction.put(MEMORIZATION_STORES.events, { ...event, id: eventID(event) })
        }
        for (const goal of merged.goals) await transaction.put(MEMORIZATION_STORES.goals, goal)
        for (const [key, value] of Object.entries(merged.meta)) {
          await transaction.put(MEMORIZATION_STORES.meta, { key, value } satisfies MetaRow)
        }
        if (!merged.meta.device_id) {
          await transaction.put(MEMORIZATION_STORES.meta, { key: 'device_id', value: local.deviceID })
        }
      })
      return {
        ok: true,
        imported: merged.records.length + merged.batches.length + merged.events.length + merged.goals.length,
      }
    } catch { return { ok: false, imported: 0, error: 'storage' } }
  }
}

export function createMemoryMemorizationRepository(): MemorizationRepository {
  return new MemorizationRepository(new MemoryKVDatabase(MEMORIZATION_DB_DEFINITION))
}

export async function openMemorizationRepository(factory?: IDBFactory | null): Promise<MemorizationRepository> {
  return new MemorizationRepository(await openKVDatabase(MEMORIZATION_DB_DEFINITION, factory))
}
