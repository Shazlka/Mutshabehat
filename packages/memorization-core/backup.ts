import { createHash } from 'node:crypto'
import {
  type AyahMemorizationRecord,
  type BatchRecord,
  type ChangeEvent,
  epochMs,
  toNormalizedIsoString,
} from './types'

export interface BackupFileEntry {
  readonly name: string
  readonly sha256: string
  readonly size: number
  readonly rowCount?: number | null
}

export interface BackupManifest {
  readonly formatVersion: number
  readonly createdAt: string
  readonly deviceID: string
  readonly appVersion: string
  readonly files: readonly BackupFileEntry[]
}

export type GoalKind =
  | { readonly type: 'ayatPerDay'; readonly count: number }
  | { readonly type: 'pageEquivalentsPerWeek'; readonly target: number }
  | { readonly type: 'completeSurah'; readonly surah: number }
  | { readonly type: 'completeJuz'; readonly juz: number }
  | { readonly type: 'completeQuranBy'; readonly date: string }

export interface GoalDefinition {
  readonly id: string
  readonly kind: GoalKind
  readonly createdAt: string
}

export interface MemorizationExport {
  readonly formatVersion: number
  readonly exportedAt: string
  readonly deviceID: string
  readonly records: readonly AyahMemorizationRecord[]
  readonly batches: readonly BatchRecord[]
  readonly events: readonly ChangeEvent[]
  readonly goals: readonly GoalDefinition[]
  readonly meta: Readonly<Record<string, string>>
}

export const MEMORIZATION_EXPORT_CURRENT_VERSION = 1

export class MemorizationExportError extends Error {
  readonly code: 'newerFormat' | 'corrupt'
  readonly version?: number

  constructor(code: 'newerFormat' | 'corrupt', version?: number) {
    super(
      code === 'newerFormat'
        ? `الملف من إصدار أحدث من التطبيق (${version}). حدّث التطبيق ثم أعد المحاولة.`
        : 'الملف تالف أو غير مكتمل.',
    )
    this.name = 'MemorizationExportError'
    this.code = code
    this.version = version
  }
}

/**
 * Stable JSON encoder with recursively sorted keys.
 * Matches iOS `BackupCoding.encoder()` output.
 */
export function encodeStableJson(value: unknown): string {
  function sortKeys(obj: unknown): unknown {
    if (obj === null || typeof obj !== 'object') {
      return obj
    }
    if (obj instanceof Date) {
      return toNormalizedIsoString(obj)
    }
    if (Array.isArray(obj)) {
      return (obj as unknown[]).map(sortKeys)
    }
    const sortedObj: Record<string, unknown> = {}
    for (const key of Object.keys(obj).sort()) {
      sortedObj[key] = sortKeys((obj as Record<string, unknown>)[key])
    }
    return sortedObj
  }

  return JSON.stringify(sortKeys(value))
}

/**
 * SHA-256 hash in lowercase hex representation.
 */
export function sha256Hex(data: string | Uint8Array | Buffer): string {
  const hash = createHash('sha256')
  hash.update(typeof data === 'string' ? Buffer.from(data, 'utf8') : data)
  return hash.digest('hex')
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

function addCalendarDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const utc = new Date(Date.UTC(y, m - 1, d + days))
  const year = utc.getUTCFullYear()
  const month = String(utc.getUTCMonth() + 1).padStart(2, '0')
  const day = String(utc.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Of the backup sets in `existing`, returns those to delete:
 * only the newest set of each local day is kept, and only for the last `keepDays` days including today.
 */
export function planRetentionDatesToDelete(
  existing: readonly (Date | string | number)[],
  now: Date | string | number,
  keepDays = 14,
  timeZone = 'UTC',
): string[] {
  if (existing.length === 0) return []

  const todayStr = formatDateString(new Date(epochMs(now)), timeZone)
  const cutoffStr = addCalendarDays(todayStr, -(Math.max(keepDays, 1) - 1))

  const byDay = new Map<string, Array<{ originalIso: string; timeMs: number }>>()
  for (const item of existing) {
    const timeMs = epochMs(item)
    const originalIso = toNormalizedIsoString(timeMs)
    const dayStr = formatDateString(new Date(timeMs), timeZone)
    let list = byDay.get(dayStr)
    if (!list) {
      list = []
      byDay.set(dayStr, list)
    }
    list.push({ originalIso, timeMs })
  }

  const doomed: string[] = []
  for (const [dayStr, dates] of byDay.entries()) {
    // Newest first
    const newestFirst = [...dates].sort((a, b) => b.timeMs - a.timeMs)
    if (dayStr >= cutoffStr) {
      // Keep only the newest, delete all older ones on this day
      for (const older of newestFirst.slice(1)) {
        doomed.push(older.originalIso)
      }
    } else {
      // Outside retention window: delete all
      for (const item of newestFirst) {
        doomed.push(item.originalIso)
      }
    }
  }

  return doomed.sort((a, b) => epochMs(a) - epochMs(b))
}

export function decodeMemorizationExport(input: string | Uint8Array | Buffer): MemorizationExport {
  const text = typeof input === 'string' ? input : Buffer.from(input).toString('utf8')
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new MemorizationExportError('corrupt')
  }

  // Untrusted JSON: every field is checked below before it is used.
  const parsed = raw as Record<string, unknown> | null
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    typeof parsed.formatVersion !== 'number'
  ) {
    throw new MemorizationExportError('corrupt')
  }

  if (parsed.formatVersion > MEMORIZATION_EXPORT_CURRENT_VERSION) {
    throw new MemorizationExportError('newerFormat', parsed.formatVersion)
  }

  if (
    typeof parsed.exportedAt !== 'string' ||
    typeof parsed.deviceID !== 'string' ||
    !Array.isArray(parsed.records) ||
    !Array.isArray(parsed.batches) ||
    !Array.isArray(parsed.events) ||
    !Array.isArray(parsed.goals) ||
    typeof parsed.meta !== 'object' ||
    parsed.meta === null
  ) {
    throw new MemorizationExportError('corrupt')
  }

  return raw as MemorizationExport
}

/**
 * Merges `incoming` into `local`:
 * - per ayah, newer `updatedAt` wins (tie keeps local)
 * - batches, events and goals are unioned by id
 * - a batch undone on either side stays undone
 * - earliest completion date and union of seen milestones are kept
 * - every other local setting wins
 */
export function mergeMemorizationExports(
  local: MemorizationExport,
  incoming: MemorizationExport,
): MemorizationExport {
  const records = new Map<string, AyahMemorizationRecord>()
  for (const r of local.records) {
    records.set(`${r.surah}:${r.ayah}`, { ...r })
  }
  for (const r of incoming.records) {
    const k = `${r.surah}:${r.ayah}`
    const existing = records.get(k)
    if (existing && epochMs(existing.updatedAt) >= epochMs(r.updatedAt)) {
      continue
    }
    records.set(k, { ...r })
  }

  const batches = new Map<string, BatchRecord>()
  for (const b of local.batches) {
    batches.set(b.id, { ...b })
  }
  for (const b of incoming.batches) {
    const existing = batches.get(b.id)
    if (existing) {
      if (!existing.undoneAt && b.undoneAt) {
        batches.set(b.id, { ...b })
      }
    } else {
      batches.set(b.id, { ...b })
    }
  }

  function eventKey(e: ChangeEvent): string {
    return `${e.batchID}|${e.surah}|${e.ayah}`
  }

  const events = new Map<string, ChangeEvent>()
  for (const e of local.events) {
    events.set(eventKey(e), { ...e })
  }
  for (const e of incoming.events) {
    const k = eventKey(e)
    if (!events.has(k)) {
      events.set(k, { ...e })
    }
  }

  const goals = new Map<string, GoalDefinition>()
  for (const g of local.goals) {
    goals.set(g.id, { ...g })
  }
  for (const g of incoming.goals) {
    if (!goals.has(g.id)) {
      goals.set(g.id, { ...g })
    }
  }

  const meta: Record<string, string> = { ...local.meta }
  for (const [key, value] of Object.entries(incoming.meta)) {
    switch (key) {
      case 'device_id':
        continue
      case 'quran_completed_at': {
        const existing = meta[key]
        if (existing) {
          meta[key] = epochMs(value) < epochMs(existing) ? value : existing
        } else {
          meta[key] = value
        }
        break
      }
      case 'milestones_seen': {
        const localSet = new Set((meta[key] ?? '').split(',').filter(Boolean))
        const incomingSet = new Set(value.split(',').filter(Boolean))
        const union = new Set([...localSet, ...incomingSet])
        meta[key] = Array.from(union).sort().join(',')
        break
      }
      default:
        if (meta[key] === undefined) {
          meta[key] = value
        }
    }
  }

  const sortedRecords = Array.from(records.values()).sort((a, b) => {
    if (a.surah !== b.surah) return a.surah - b.surah
    return a.ayah - b.ayah
  })

  const sortedBatches = Array.from(batches.values()).sort((a, b) => {
    const tA = epochMs(a.createdAt)
    const tB = epochMs(b.createdAt)
    if (tA !== tB) return tA - tB
    return a.id.localeCompare(b.id)
  })

  const sortedEvents = Array.from(events.values()).sort((a, b) => {
    const tA = epochMs(a.at)
    const tB = epochMs(b.at)
    if (tA !== tB) return tA - tB
    const bCmp = a.batchID.localeCompare(b.batchID)
    if (bCmp !== 0) return bCmp
    if (a.surah !== b.surah) return a.surah - b.surah
    return a.ayah - b.ayah
  })

  const sortedGoals = Array.from(goals.values()).sort((a, b) => {
    const tA = epochMs(a.createdAt)
    const tB = epochMs(b.createdAt)
    if (tA !== tB) return tA - tB
    return a.id.localeCompare(b.id)
  })

  const maxExported = Math.max(epochMs(local.exportedAt), epochMs(incoming.exportedAt))

  return {
    formatVersion: MEMORIZATION_EXPORT_CURRENT_VERSION,
    exportedAt: toNormalizedIsoString(maxExported),
    deviceID: local.deviceID,
    records: sortedRecords,
    batches: sortedBatches,
    events: sortedEvents,
    goals: sortedGoals,
    meta,
  }
}
