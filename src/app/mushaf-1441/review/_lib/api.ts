import type {
  BulkApplyResult,
  BulkDeleteItem,
  CreateEntryInput,
  EntryFields,
  HistoryTransaction,
  NarratorInput,
  OccurrenceCandidate,
  ReviewError,
  ReviewOverview,
  ReviewPage,
  ReviewResult,
  ReviewRow,
  ReviewStatus,
  SameWordMatch,
} from './types'

const API_PATH = '/api/mushaf-1441/qiraat-review'

const REVIEW_ERROR_CODES = new Set<ReviewError['code']>([
  'unauthorized',
  'forbidden',
  'VERSION_CONFLICT',
  'RULE_D8',
  'RULE_NARRATOR_TWICE',
  'RULE_EMPTY_LOCATION',
  'RULE_WASL_WAQF',
  'UNDO_CONFLICT',
  'UNDO_REFUSED',
  'not_found',
  'bad_request',
  'unavailable',
])

type ErrorPayload = {
  error?: unknown
  messageAr?: unknown
}

function getRandomId(): string {
  return globalThis.crypto.randomUUID()
}

function errorFromPayload(status: number, payload: unknown, fallback: string): ReviewError {
  const body = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? (payload as ErrorPayload)
    : {}
  const rawCode = typeof body.error === 'string' ? body.error : ''
  const code = REVIEW_ERROR_CODES.has(rawCode as ReviewError['code'])
    ? (rawCode as ReviewError['code'])
    : 'unavailable'

  return {
    code,
    status,
    message: rawCode || fallback,
    ...(typeof body.messageAr === 'string' ? { messageAr: body.messageAr } : {}),
  }
}

async function request<T>(input: RequestInfo | URL, init?: RequestInit): Promise<ReviewResult<T>> {
  try {
    const response = await fetch(input, init)
    const text = await response.text()
    let payload: unknown

    try {
      payload = text ? JSON.parse(text) : undefined
    } catch {
      return {
        ok: false,
        error: errorFromPayload(response.status, undefined, 'Invalid server response'),
      }
    }

    if (!response.ok) {
      return {
        ok: false,
        error: errorFromPayload(response.status, payload, 'Qiraat review request failed'),
      }
    }

    return { ok: true, data: payload as T }
  } catch {
    return {
      ok: false,
      error: errorFromPayload(0, undefined, 'Qiraat review request failed'),
    }
  }
}

function patch(
  action: string,
  row: ReviewRow,
  deviceId: string,
  extra?: Record<string, unknown>,
): Promise<ReviewResult<ReviewRow>> {
  return request<ReviewRow>(API_PATH, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action,
      entryId: row.entryId,
      version: row.version,
      deviceId,
      ...extra,
    }),
  })
}

export function getReviewPage(
  page: number,
  includeDeleted = false,
): Promise<ReviewResult<ReviewPage>> {
  const params = new URLSearchParams({ page: String(page) })
  if (includeDeleted) params.set('includeDeleted', '1')
  return request<ReviewPage>(`${API_PATH}?${params.toString()}`)
}

export function getReviewOverview(): Promise<ReviewResult<ReviewOverview>> {
  return request<ReviewOverview>(`${API_PATH}?overview=1`)
}

export function getReviewHistory(page: number): Promise<ReviewResult<HistoryTransaction[]>> {
  const params = new URLSearchParams({ history: '1', page: String(page) })
  return request<HistoryTransaction[]>(`${API_PATH}?${params.toString()}`)
}

export function setStatus(
  row: ReviewRow,
  status: ReviewStatus,
  note: string | null,
  deviceId: string,
): Promise<ReviewResult<ReviewRow>> {
  return patch('status', row, deviceId, { status, note })
}

export function updateEntry(
  row: ReviewRow,
  fields: EntryFields,
  deviceId: string,
): Promise<ReviewResult<ReviewRow>> {
  return patch('update', row, deviceId, { fields })
}

export function setNarrators(
  row: ReviewRow,
  narrators: NarratorInput[],
  deviceId: string,
): Promise<ReviewResult<ReviewRow>> {
  return patch('narrators', row, deviceId, { narrators })
}

export function deleteEntry(
  row: ReviewRow,
  note: string | null,
  deviceId: string,
): Promise<ReviewResult<ReviewRow>> {
  return patch('delete', row, deviceId, { note })
}

export function restoreEntry(
  row: ReviewRow,
  deviceId: string,
): Promise<ReviewResult<ReviewRow>> {
  return patch('restore', row, deviceId)
}

export function createEntry(
  entry: CreateEntryInput,
  deviceId: string,
): Promise<ReviewResult<ReviewRow>> {
  return request<ReviewRow>(API_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'create', entry, deviceId }),
  })
}

export function bulkDeleteEntries(
  items: BulkDeleteItem[],
  note: string | null,
  deviceId: string,
): Promise<ReviewResult<{ deleted: ReviewRow[] }>> {
  return request<{ deleted: ReviewRow[] }>(API_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'bulkDelete', items, note, deviceId }),
  })
}

export function findSameWord(
  target: { surah: number; ayah: number; word: number; excludeLocusId?: string | null },
): Promise<ReviewResult<SameWordMatch[]>> {
  return request<SameWordMatch[]>(API_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'findSameWord', ...target }),
  })
}

export function copyEntryToOccurrence(
  sourceEntryId: string,
  target: { surah: number; ayah: number; startWord: number },
  deviceId: string,
): Promise<ReviewResult<ReviewRow>> {
  return request<ReviewRow>(API_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'copyEntry', sourceEntryId, ...target, deviceId }),
  })
}

export function findOccurrences(entryId: string): Promise<ReviewResult<OccurrenceCandidate[]>> {
  return request<OccurrenceCandidate[]>(API_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'findOccurrences', entryId }),
  })
}

export function bulkApply(
  sourceEntryId: string,
  targets: { surah: number; ayah: number; word: number }[],
  deviceId: string,
): Promise<ReviewResult<BulkApplyResult>> {
  return request<BulkApplyResult>(API_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'bulkApply', sourceEntryId, targets, deviceId }),
  })
}

export function undoTransaction(
  txid: number,
  deviceId: string,
): Promise<ReviewResult<{ undone: number }>> {
  return request<{ undone: number }>(API_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'undo', txid, deviceId }),
  })
}

export function getDeviceId(): string {
  if (typeof window === 'undefined') return getRandomId()

  try {
    const storage = window.localStorage
    const existing = storage.getItem('qiraat-review-device-id')
    if (existing) return existing

    const deviceId = getRandomId()
    storage.setItem('qiraat-review-device-id', deviceId)
    return deviceId
  } catch {
    return getRandomId()
  }
}
