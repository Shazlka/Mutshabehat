import {
  MUSHAF_TOTAL_AYAHS,
  calculateKhatmaPercent,
  calculateReadingStreaks,
  type BookmarkType,
  type KhatmaRecord,
  type QuranBookmark,
  type ReadingDayRecord,
  type ReadingStreakSummary,
} from '../../../packages/reading-core'
import {
  MemoryKVDatabase,
  openKVDatabase,
  type KVDatabase,
  type KVDatabaseDefinition,
  type KVTransaction,
} from './kv'

export const READING_DB_VERSION = 1
export const READING_DB_NAME = 'mushaf_reading'

export const READING_STORES = {
  bookmarks: 'bookmarks',
  khatmas: 'khatmas',
  readAyahs: 'khatma_read_ayahs',
  days: 'reading_days',
  events: 'reading_activity_events',
  metadata: 'reading_metadata',
} as const

export const READING_DB_DEFINITION: KVDatabaseDefinition = {
  name: READING_DB_NAME,
  version: READING_DB_VERSION,
  stores: [
    {
      name: READING_STORES.bookmarks,
      keyPath: 'id',
      indexes: [
        { name: 'by_identity', keyPath: ['type', 'surah', 'ayah', 'page'], unique: true },
        { name: 'by_type', keyPath: 'type' },
        { name: 'by_page', keyPath: 'page' },
      ],
    },
    {
      name: READING_STORES.khatmas,
      keyPath: 'id',
      indexes: [
        { name: 'by_status', keyPath: 'status' },
        { name: 'by_number', keyPath: 'khatmaNumber' },
      ],
    },
    {
      name: READING_STORES.readAyahs,
      keyPath: ['khatmaId', 'surah', 'ayah'],
      indexes: [
        { name: 'by_khatma', keyPath: 'khatmaId' },
        { name: 'by_khatma_surah', keyPath: ['khatmaId', 'surah'] },
        { name: 'by_khatma_page', keyPath: ['khatmaId', 'page'] },
      ],
    },
    { name: READING_STORES.days, keyPath: 'dateString' },
    {
      name: READING_STORES.events,
      keyPath: 'id',
      indexes: [
        { name: 'by_date', keyPath: 'dateString' },
        { name: 'by_recorded_at', keyPath: 'recordedAt' },
      ],
    },
    { name: READING_STORES.metadata, keyPath: 'key' },
  ],
}

export interface KhatmaReadAyah {
  khatmaId: string
  surah: number
  ayah: number
  page: number
  readAt: string
}

export interface ReadingActivityEvent {
  id: string
  dateString: string
  ayahsRead: number
  pagesRead: number
  secondsRead: number
  recordedAt: string
}

export interface ReadingMetadata {
  key: string
  value: string
}

export interface ReadAyahInput {
  surah: number
  ayah: number
  page: number
}

export interface RecordReadingOptions {
  at?: Date | string | number
  pagesCount?: number
  seconds?: number
  /** Defaults to the number of newly credited ayat. */
  activityAyahs?: number | ((newAyahs: number) => number)
  timeZone?: string
  dateString?: string
}

export interface RecordReadingResult {
  newAyahs: number
  activeKhatma: KhatmaRecord
  justCompletedKhatma: KhatmaRecord | null
}

export interface DeletedReadingSession {
  event: ReadingActivityEvent
}

export interface ReadingExport {
  formatVersion: 1
  exportedAt: string
  stores: {
    bookmarks: QuranBookmark[]
    khatmas: KhatmaRecord[]
    khatmaReadAyahs: KhatmaReadAyah[]
    readingDays: ReadingDayRecord[]
    activityEvents: ReadingActivityEvent[]
    metadata: ReadingMetadata[]
  }
}

export interface ReadingImportResult {
  ok: boolean
  imported: number
  error?: string
}

const ALL_READING_STORES = Object.values(READING_STORES)

function randomID(): string {
  try { return crypto.randomUUID() } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  }
}

function iso(value: Date | string | number = Date.now()): string {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

function formatDateString(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(date)
}

function localDateString(value: Date | string | number): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = value instanceof Date ? value : new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function validBookmarkType(value: unknown): value is BookmarkType {
  return value === 'ayah' || value === 'page'
}

function uniqueAyahs(items: readonly ReadAyahInput[]): ReadAyahInput[] {
  const result = new Map<string, ReadAyahInput>()
  for (const item of items) {
    if (item.surah > 0 && item.ayah > 0 && item.page > 0) {
      result.set(`${item.surah}:${item.ayah}`, { ...item })
    }
  }
  return Array.from(result.values())
}

function newestFirst<T extends { createdAt?: string; recordedAt?: string }>(rows: T[]): T[] {
  return rows.sort((a, b) => (b.createdAt ?? b.recordedAt ?? '').localeCompare(a.createdAt ?? a.recordedAt ?? ''))
}

async function activeKhatmaIn(transaction: KVTransaction, now: string): Promise<KhatmaRecord> {
  const active = await transaction.queryIndex<KhatmaRecord>(READING_STORES.khatmas, 'by_status', 'active')
  if (active.length > 0) {
    return active.sort((a, b) => b.khatmaNumber - a.khatmaNumber)[0]
  }
  const all = await transaction.getAll<KhatmaRecord>(READING_STORES.khatmas)
  const record: KhatmaRecord = {
    id: randomID(),
    khatmaNumber: Math.max(0, ...all.map((item) => item.khatmaNumber)) + 1,
    startedAt: now,
    completedAt: null,
    status: 'active',
    percentComplete: 0,
  }
  await transaction.put(READING_STORES.khatmas, record)
  return record
}

async function recalculateDay(transaction: KVTransaction, dateString: string): Promise<void> {
  const events = await transaction.queryIndex<ReadingActivityEvent>(READING_STORES.events, 'by_date', dateString)
  if (events.length === 0) {
    await transaction.delete(READING_STORES.days, dateString)
    return
  }
  const record: ReadingDayRecord = {
    dateString,
    ayahsRead: events.reduce((sum, event) => sum + event.ayahsRead, 0),
    pagesRead: events.reduce((sum, event) => sum + event.pagesRead, 0),
    secondsRead: events.reduce((sum, event) => sum + event.secondsRead, 0),
    lastReadAt: events.reduce((latest, event) => event.recordedAt > latest ? event.recordedAt : latest, ''),
  }
  await transaction.put(READING_STORES.days, record)
}

async function addActivity(
  transaction: KVTransaction,
  values: Omit<ReadingActivityEvent, 'id'> & { id?: string },
): Promise<ReadingActivityEvent> {
  const event: ReadingActivityEvent = { ...values, id: values.id ?? randomID() }
  await transaction.put(READING_STORES.events, event)
  await recalculateDay(transaction, event.dateString)
  return event
}

export class ReadingRepository {
  constructor(readonly database: KVDatabase) {}

  get persistent(): boolean { return this.database.persistent }

  async addBookmark(input: {
    type: BookmarkType
    surah: number
    ayah: number
    page: number
    note?: string | null
    createdAt?: Date | string | number
  }): Promise<QuranBookmark | null> {
    try {
      if (!validBookmarkType(input.type)) return null
      const identity = [input.type, input.surah, input.ayah, input.page]
      return await this.database.transaction([READING_STORES.bookmarks], 'readwrite', async (transaction) => {
        const existing = (await transaction.queryIndex<QuranBookmark>(READING_STORES.bookmarks, 'by_identity', identity))[0]
        const bookmark: QuranBookmark = {
          id: existing?.id ?? randomID(),
          type: input.type,
          surah: input.surah,
          ayah: input.ayah,
          page: input.page,
          note: input.note ?? null,
          createdAt: iso(input.createdAt),
        }
        await transaction.put(READING_STORES.bookmarks, bookmark)
        return bookmark
      })
    } catch { return null }
  }

  async removeBookmark(id: string): Promise<boolean> {
    try {
      const existing = await this.database.get<QuranBookmark>(READING_STORES.bookmarks, id)
      if (!existing) return false
      await this.database.delete(READING_STORES.bookmarks, id)
      return true
    } catch { return false }
  }

  async listBookmarks(type?: BookmarkType): Promise<QuranBookmark[]> {
    try {
      const rows = type
        ? await this.database.queryIndex<QuranBookmark>(READING_STORES.bookmarks, 'by_type', type)
        : await this.database.getAll<QuranBookmark>(READING_STORES.bookmarks)
      return newestFirst(rows)
    } catch { return [] }
  }

  async getOrCreateActiveKhatma(at: Date | string | number = Date.now()): Promise<KhatmaRecord> {
    const fallback: KhatmaRecord = {
      id: 'session-khatma-1', khatmaNumber: 1, startedAt: iso(at), completedAt: null,
      status: 'active', percentComplete: 0,
    }
    try {
      return await this.database.transaction([READING_STORES.khatmas], 'readwrite', (transaction) =>
        activeKhatmaIn(transaction, iso(at)))
    } catch { return fallback }
  }

  async listKhatmas(): Promise<KhatmaRecord[]> {
    try {
      return (await this.database.getAll<KhatmaRecord>(READING_STORES.khatmas))
        .sort((a, b) => a.khatmaNumber - b.khatmaNumber)
    } catch { return [] }
  }

  async listReadAyahs(khatmaId: string): Promise<KhatmaReadAyah[]> {
    try {
      return await this.database.queryIndex<KhatmaReadAyah>(READING_STORES.readAyahs, 'by_khatma', khatmaId)
    } catch { return [] }
  }

  async readAyahsOnPage(khatmaId: string, page: number): Promise<KhatmaReadAyah[]> {
    try {
      return await this.database.queryIndex<KhatmaReadAyah>(READING_STORES.readAyahs, 'by_khatma_page', [khatmaId, page])
    } catch { return [] }
  }

  async recordReadAyahs(
    items: readonly ReadAyahInput[],
    options: RecordReadingOptions & { khatmaId?: string } = {},
  ): Promise<RecordReadingResult> {
    const at = iso(options.at)
    const cleanItems = uniqueAyahs(items)
    let fallback = await this.getOrCreateActiveKhatma(at)
    if (cleanItems.length === 0) return { newAyahs: 0, activeKhatma: fallback, justCompletedKhatma: null }
    try {
      return await this.database.transaction(
        [READING_STORES.khatmas, READING_STORES.readAyahs, READING_STORES.events, READING_STORES.days, READING_STORES.metadata],
        'readwrite',
        async (transaction) => {
          let active = await activeKhatmaIn(transaction, at)
          if (options.khatmaId && options.khatmaId !== active.id) {
            active = (await transaction.get<KhatmaRecord>(READING_STORES.khatmas, options.khatmaId)) ?? active
          }
          fallback = active
          let newAyahs = 0
          for (const item of cleanItems) {
            const key = [active.id, item.surah, item.ayah]
            if (await transaction.get<KhatmaReadAyah>(READING_STORES.readAyahs, key)) continue
            await transaction.put(READING_STORES.readAyahs, {
              khatmaId: active.id, ...item, readAt: at,
            } satisfies KhatmaReadAyah)
            newAyahs += 1
          }

          const allRead = await transaction.queryIndex<KhatmaReadAyah>(READING_STORES.readAyahs, 'by_khatma', active.id)
          const pagesRead = new Set(allRead.map((row) => row.page)).size
          const complete = allRead.length >= MUSHAF_TOTAL_AYAHS
          const progress: KhatmaRecord = {
            ...active,
            status: complete ? 'completed' : 'active',
            completedAt: complete ? at : null,
            percentComplete: calculateKhatmaPercent(pagesRead, complete),
          }
          await transaction.put(READING_STORES.khatmas, progress)

          const activityAyahs = typeof options.activityAyahs === 'function'
            ? options.activityAyahs(newAyahs)
            : options.activityAyahs ?? newAyahs
          if (activityAyahs > 0 || (options.seconds ?? 0) > 0 || (options.pagesCount ?? 0) > 0) {
            const dateStr = options.dateString ?? (options.timeZone ? formatDateString(new Date(at), options.timeZone) : localDateString(at))
            await addActivity(transaction, {
              dateString: dateStr,
              ayahsRead: Math.max(0, activityAyahs),
              pagesRead: Math.max(0, options.pagesCount ?? 0),
              secondsRead: Math.max(0, Math.trunc(options.seconds ?? 0)),
              recordedAt: at,
            })
          }

          if (!complete) return { newAyahs, activeKhatma: progress, justCompletedKhatma: null }

          await transaction.put(READING_STORES.metadata, {
            key: 'completed_khatmas',
            value: String((await transaction.getAll<KhatmaRecord>(READING_STORES.khatmas))
              .filter((row) => row.status === 'completed').length),
          } satisfies ReadingMetadata)
          const next = await activeKhatmaIn(transaction, at)
          return { newAyahs, activeKhatma: next, justCompletedKhatma: progress }
        },
      )
    } catch {
      return { newAyahs: 0, activeKhatma: fallback, justCompletedKhatma: null }
    }
  }

  async addManualSession(input: {
    items: readonly ReadAyahInput[]
    sessionDate?: Date | string | number
    durationMinutes: number
    pagesCount?: number
    fromMemory?: boolean
    timeZone?: string
    dateString?: string
  }): Promise<RecordReadingResult> {
    const items = uniqueAyahs(input.items)
    const pages = input.pagesCount ?? new Set(items.map((item) => item.page)).size
    return this.recordReadAyahs(items, {
      at: input.sessionDate,
      seconds: Math.max(60, Math.trunc(input.durationMinutes * 60)),
      pagesCount: pages,
      activityAyahs: (newCount) => Math.max(1, newCount > 0 ? newCount : items.length),
      timeZone: input.timeZone,
      dateString: input.dateString,
    })
  }

  async listReadingDays(): Promise<ReadingDayRecord[]> {
    try {
      return (await this.database.getAll<ReadingDayRecord>(READING_STORES.days))
        .sort((a, b) => b.dateString.localeCompare(a.dateString))
    } catch { return [] }
  }

  async listActivityEvents(): Promise<ReadingActivityEvent[]> {
    try {
      return newestFirst(await this.database.getAll<ReadingActivityEvent>(READING_STORES.events))
    } catch { return [] }
  }

  async getStreaks(
    asOf: Date | string = new Date(),
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  ): Promise<ReadingStreakSummary> {
    try { return calculateReadingStreaks(await this.listReadingDays(), asOf, timeZone) }
    catch { return { currentStreak: 0, longestStreak: 0, totalReadingDays: 0 } }
  }

  async deleteSession(eventId: string): Promise<DeletedReadingSession | null> {
    try {
      return await this.database.transaction([READING_STORES.events, READING_STORES.days], 'readwrite', async (transaction) => {
        const event = await transaction.get<ReadingActivityEvent>(READING_STORES.events, eventId)
        if (!event) return null
        await transaction.delete(READING_STORES.events, event.id)
        await recalculateDay(transaction, event.dateString)
        return { event }
      })
    } catch { return null }
  }

  async undoDeleteSession(deleted: DeletedReadingSession): Promise<boolean> {
    try {
      await this.database.transaction([READING_STORES.events, READING_STORES.days], 'readwrite', async (transaction) => {
        await transaction.put(READING_STORES.events, deleted.event)
        await recalculateDay(transaction, deleted.event.dateString)
      })
      return true
    } catch { return false }
  }

  async exportAll(at: Date | string | number = Date.now()): Promise<ReadingExport> {
    try {
      return {
        formatVersion: 1,
        exportedAt: iso(at),
        stores: {
          bookmarks: await this.database.getAll<QuranBookmark>(READING_STORES.bookmarks),
          khatmas: await this.database.getAll<KhatmaRecord>(READING_STORES.khatmas),
          khatmaReadAyahs: await this.database.getAll<KhatmaReadAyah>(READING_STORES.readAyahs),
          readingDays: await this.database.getAll<ReadingDayRecord>(READING_STORES.days),
          activityEvents: await this.database.getAll<ReadingActivityEvent>(READING_STORES.events),
          metadata: await this.database.getAll<ReadingMetadata>(READING_STORES.metadata),
        },
      }
    } catch {
      return {
        formatVersion: 1, exportedAt: iso(at),
        stores: { bookmarks: [], khatmas: [], khatmaReadAyahs: [], readingDays: [], activityEvents: [], metadata: [] },
      }
    }
  }

  async exportJSON(at: Date | string | number = Date.now()): Promise<string> {
    return JSON.stringify(await this.exportAll(at))
  }

  async importJSON(json: string, mode: 'merge' | 'replace' = 'merge'): Promise<ReadingImportResult> {
    let incoming: ReadingExport
    try {
      incoming = JSON.parse(json) as ReadingExport
      if (incoming?.formatVersion !== 1 || !incoming.stores
        || !Array.isArray(incoming.stores.bookmarks) || !Array.isArray(incoming.stores.khatmas)
        || !Array.isArray(incoming.stores.khatmaReadAyahs) || !Array.isArray(incoming.stores.activityEvents)) {
        return { ok: false, imported: 0, error: 'invalid' }
      }
    } catch { return { ok: false, imported: 0, error: 'invalid' } }

    try {
      let imported = 0
      await this.database.transaction(ALL_READING_STORES, 'readwrite', async (transaction) => {
        if (mode === 'replace') {
          for (const store of ALL_READING_STORES) {
            for (const row of await transaction.getAll<Record<string, unknown>>(store)) {
              const definition = READING_DB_DEFINITION.stores.find((item) => item.name === store)!
              const path = definition.keyPath!
              const key = Array.isArray(path) ? path.map((part) => row[part]) : row[path]
              await transaction.delete(store, key as IDBValidKey)
            }
          }
        }

        const khatmaIDMap = new Map<string, string>()
        const localKhatmas = await transaction.getAll<KhatmaRecord>(READING_STORES.khatmas)
        for (const candidate of incoming.stores.khatmas) {
          const local = localKhatmas.find((row) => row.khatmaNumber === candidate.khatmaNumber)
          if (!local) {
            await transaction.put(READING_STORES.khatmas, candidate)
            khatmaIDMap.set(candidate.id, candidate.id)
            imported += 1
          } else {
            khatmaIDMap.set(candidate.id, local.id)
            if (candidate.status === 'completed' && local.status !== 'completed') {
              await transaction.put(READING_STORES.khatmas, { ...local, status: 'completed', percentComplete: 100,
                completedAt: candidate.completedAt ?? local.completedAt })
              imported += 1
            }
          }
        }

        for (const candidate of incoming.stores.bookmarks) {
          const identity = [candidate.type, candidate.surah, candidate.ayah, candidate.page]
          const local = (await transaction.queryIndex<QuranBookmark>(READING_STORES.bookmarks, 'by_identity', identity))[0]
          if (!local) {
            await transaction.put(READING_STORES.bookmarks, candidate); imported += 1
          } else if (candidate.createdAt > local.createdAt) {
            await transaction.put(READING_STORES.bookmarks, { ...candidate, id: local.id }); imported += 1
          }
        }
        for (const candidate of incoming.stores.khatmaReadAyahs) {
          const mapped = { ...candidate, khatmaId: khatmaIDMap.get(candidate.khatmaId) ?? candidate.khatmaId }
          const key = [mapped.khatmaId, mapped.surah, mapped.ayah]
          const local = await transaction.get<KhatmaReadAyah>(READING_STORES.readAyahs, key)
          if (!local || mapped.readAt > local.readAt) {
            await transaction.put(READING_STORES.readAyahs, mapped); imported += 1
          }
        }
        for (const candidate of incoming.stores.activityEvents) {
          if (!await transaction.get(READING_STORES.events, candidate.id)) {
            await transaction.put(READING_STORES.events, candidate); imported += 1
          }
        }
        for (const candidate of incoming.stores.metadata ?? []) {
          if (!await transaction.get(READING_STORES.metadata, candidate.key)) {
            await transaction.put(READING_STORES.metadata, candidate)
          }
        }
        const dates = new Set((await transaction.getAll<ReadingActivityEvent>(READING_STORES.events)).map((event) => event.dateString))
        for (const date of dates) await recalculateDay(transaction, date)
      })
      return { ok: true, imported }
    } catch { return { ok: false, imported: 0, error: 'storage' } }
  }
}

export function createMemoryReadingRepository(): ReadingRepository {
  return new ReadingRepository(new MemoryKVDatabase(READING_DB_DEFINITION))
}

export async function openReadingRepository(factory?: IDBFactory | null): Promise<ReadingRepository> {
  return new ReadingRepository(await openKVDatabase(READING_DB_DEFINITION, factory))
}
