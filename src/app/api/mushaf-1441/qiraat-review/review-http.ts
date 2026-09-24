const MAX_ENTRY_ID_LENGTH = 200
const MAX_FREE_TEXT_LENGTH = 2000
const MAX_SHORT_CODE_LENGTH = 100

type ValidationFailure = {
  ok: false
  status: 400
  body: { error: string }
}

type ValidationSuccess<T> = {
  ok: true
  value: T
}

export type ValidationResult<T> = ValidationFailure | ValidationSuccess<T>

export type GetQueryInput = {
  overview?: unknown
  history?: unknown
  page?: unknown
  includeDeleted?: unknown
}

export type GetQuery =
  | { mode: 'overview' }
  | { mode: 'history'; page: number }
  | { mode: 'page'; page: number; includeDeleted: boolean }

export type ValidatedPatch =
  | {
      action: 'status'
      entryId: string
      version: string
      deviceId?: string | null
      status: 'unreviewed' | 'reviewed' | 'flagged'
      note?: string | null
    }
  | {
      action: 'update'
      entryId: string
      version: string
      deviceId?: string | null
      fields: Record<string, unknown>
    }
  | {
      action: 'narrators'
      entryId: string
      version: string
      deviceId?: string | null
      narrators: Array<{
        id: string
        action?: string | null
        wajhOrder?: number
        wajhNote?: string | null
      }>
    }
  | {
      action: 'delete'
      entryId: string
      version: string
      deviceId?: string | null
      note?: string | null
    }
  | {
      action: 'restore'
      entryId: string
      version: string
      deviceId?: string | null
    }

export type CreateEntryPayload = {
  surah: number
  ayah: number
  startWord: number
  endAyah?: number
  endWord?: number
  kind: 'farsh' | 'usul'
  readingText?: string
  uthmaniText?: string | null
  description?: string | null
  performanceNote?: string | null
  variantType?: string
  categoryCode?: string
  rulingText?: string | null
  notes?: string | null
  narrators: Array<{
    id: string
    action?: string | null
    wajhOrder?: number
    wajhNote?: string | null
  }>
}

export type ValidatedPost =
  | {
      action: 'undo'
      txid: number
      deviceId?: string | null
    }
  | {
      action: 'create'
      entry: CreateEntryPayload
      deviceId?: string | null
    }
  | {
      action: 'bulkDelete'
      items: Array<{ entryId: string; expectedVersion: string }>
      note?: string | null
      deviceId?: string | null
    }
  | {
      action: 'findSameWord'
      surah: number
      ayah: number
      word: number
      excludeLocusId?: string | null
    }
  | {
      action: 'copyEntry'
      sourceEntryId: string
      surah: number
      ayah: number
      startWord: number
      endAyah?: number
      endWord?: number
      deviceId?: string | null
    }
  | {
      action: 'findOccurrences'
      entryId: string
    }
  | {
      action: 'bulkApply'
      sourceEntryId: string
      targets: Array<{ surah: number; ayah: number; word: number }>
      deviceId?: string | null
    }

const PATCH_ACTIONS = ['status', 'update', 'narrators', 'delete', 'restore'] as const
const STATUSES = ['unreviewed', 'reviewed', 'flagged'] as const
const ENTRY_FIELD_KEYS = [
  'notes',
  'readingText',
  'uthmaniText',
  'description',
  'performanceNote',
  'variantType',
  'categoryCode',
  'rulingText',
  'appliesWasl',
  'appliesWaqf',
  'hamzahDetail',
] as const

function failure(error: string): ValidationFailure {
  return { ok: false, status: 400, body: { error } }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function validatePage(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 1 && value <= 604 ? value : null
  }

  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null
  const page = Number(value)
  return Number.isInteger(page) && page >= 1 && page <= 604 ? page : null
}

function validateNonEmptyString(
  value: unknown,
  field: string,
  maxLength?: number,
): string | ValidationFailure {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return failure(`${field} is required`)
  }
  if (maxLength !== undefined && value.length > maxLength) {
    return failure(`${field} is too long`)
  }
  return value
}

function validateOptionalText(
  value: unknown,
  field: string,
  allowNull = true,
): string | null | undefined | ValidationFailure {
  if (value === undefined) return undefined
  if (value === null && allowNull) return null
  if (typeof value !== 'string') return failure(`${field} must be a string or null`)
  if (value.length > MAX_FREE_TEXT_LENGTH) return failure(`${field} is too long`)
  return value
}

function validateDeviceId(value: unknown): string | null | undefined | ValidationFailure {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') return failure('deviceId must be a string or null')
  if (value.length > MAX_FREE_TEXT_LENGTH) return failure('deviceId is too long')
  return value
}

function isFailure(value: unknown): value is ValidationFailure {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { ok?: unknown }).ok === false
  )
}

function validateEntryFields(fields: unknown): ValidationResult<Record<string, unknown>> {
  if (!isPlainObject(fields)) return failure('fields must be an object')
  const keys = Object.keys(fields)
  if (keys.length === 0) return failure('fields must not be empty')

  for (const key of keys) {
    if (!(ENTRY_FIELD_KEYS as readonly string[]).includes(key)) {
      return failure(`unknown field: ${key}`)
    }

    const value = fields[key]
    if (key === 'variantType' || key === 'categoryCode') {
      if (typeof value !== 'string' || value.trim().length === 0) {
        return failure(`${key} is required`)
      }
      if (value.length > MAX_SHORT_CODE_LENGTH) {
        return failure(`${key} is too long`)
      }
      continue
    }

    if (key === 'appliesWasl' || key === 'appliesWaqf') {
      if (typeof value !== 'boolean') {
        return failure(`${key} must be a boolean`)
      }
      continue
    }

    if (key === 'hamzahDetail') {
      if (value !== null && !isPlainObject(value)) {
        return failure('hamzahDetail must be an object or null')
      }
      continue
    }

    const allowsNull = key !== 'readingText'
    if (value === null && allowsNull) continue
    if (typeof value !== 'string') {
      return failure(`${key} must be a string${allowsNull ? ' or null' : ''}`)
    }
    if (value.length > MAX_FREE_TEXT_LENGTH) {
      return failure(`${key} is too long`)
    }
  }

  return { ok: true, value: fields }
}

export function validateGetQuery(input: GetQueryInput): ValidationResult<GetQuery> {
  if (input.overview === '1') return { ok: true, value: { mode: 'overview' } }

  if (input.history === '1') {
    const page = validatePage(input.page)
    if (page === null) return failure('valid page is required')
    return { ok: true, value: { mode: 'history', page } }
  }

  const page = validatePage(input.page)
  if (page === null) return failure('page is required')
  return {
    ok: true,
    value: {
      mode: 'page',
      page,
      includeDeleted: input.includeDeleted === '1' || input.includeDeleted === 'true',
    },
  }
}

function validateNarrators(
  rawNarrators: unknown,
): Array<{
  id: string
  action?: string | null
  wajhOrder?: number
  wajhNote?: string | null
}> | ValidationFailure {
  if (!Array.isArray(rawNarrators) || rawNarrators.length < 1 || rawNarrators.length > 20) {
    return failure('narrators must contain between 1 and 20 items')
  }

  const narrators: Array<{
    id: string
    action?: string | null
    wajhOrder?: number
    wajhNote?: string | null
  }> = []

  for (const narrator of rawNarrators) {
    if (!isPlainObject(narrator)) return failure('each narrator must be an object')

    const id = validateNonEmptyString(narrator.id, 'narrator id', MAX_SHORT_CODE_LENGTH)
    if (isFailure(id)) return id

    let narratorAction: string | null | undefined
    if (hasOwn(narrator, 'action')) {
      const actionText = validateOptionalText(narrator.action, 'narrator action')
      if (isFailure(actionText)) return actionText
      narratorAction = actionText
    }

    if (hasOwn(narrator, 'wajhOrder')) {
      if (
        typeof narrator.wajhOrder !== 'number' ||
        !Number.isInteger(narrator.wajhOrder) ||
        narrator.wajhOrder < 1
      ) {
        return failure('wajhOrder must be a positive integer')
      }
    }

    let wajhNote: string | null | undefined
    if (hasOwn(narrator, 'wajhNote')) {
      const wajhNoteResult = validateOptionalText(narrator.wajhNote, 'wajhNote')
      if (isFailure(wajhNoteResult)) return wajhNoteResult
      wajhNote = wajhNoteResult
    }

    narrators.push({
      id,
      ...(hasOwn(narrator, 'action') ? { action: narratorAction } : {}),
      ...(hasOwn(narrator, 'wajhOrder') ? { wajhOrder: narrator.wajhOrder as number } : {}),
      ...(hasOwn(narrator, 'wajhNote') ? { wajhNote } : {}),
    })
  }

  return narrators
}

export function validatePatchBody(input: unknown): ValidationResult<ValidatedPatch> {
  if (!isPlainObject(input)) return failure('request body must be an object')

  const action = input.action
  if (!(PATCH_ACTIONS as readonly string[]).includes(String(action))) {
    return failure('valid action is required')
  }

  const entryId = validateNonEmptyString(input.entryId, 'entryId', MAX_ENTRY_ID_LENGTH)
  if (isFailure(entryId)) return entryId

  const version = validateNonEmptyString(input.version, 'version')
  if (isFailure(version)) return version

  const deviceId = validateDeviceId(input.deviceId)
  if (isFailure(deviceId)) return deviceId

  if (action === 'status') {
    if (!(STATUSES as readonly unknown[]).includes(input.status)) {
      return failure('valid status is required')
    }
    const note = validateOptionalText(input.note, 'note')
    if (isFailure(note)) return note
    return {
      ok: true,
      value: {
        action,
        entryId,
        version,
        deviceId,
        status: input.status as 'unreviewed' | 'reviewed' | 'flagged',
        note,
      },
    }
  }

  if (action === 'update') {
    const fields = validateEntryFields(input.fields)
    if (!fields.ok) return fields
    return { ok: true, value: { action, entryId, version, deviceId, fields: fields.value } }
  }

  if (action === 'narrators') {
    const narrators = validateNarrators(input.narrators)
    if (isFailure(narrators)) return narrators

    return { ok: true, value: { action, entryId, version, deviceId, narrators } }
  }

  if (action === 'delete') {
    const note = validateOptionalText(input.note, 'note')
    if (isFailure(note)) return note
    return { ok: true, value: { action, entryId, version, deviceId, note } }
  }

  return { ok: true, value: { action: 'restore', entryId, version, deviceId } }
}

const POST_ACTIONS = ['undo', 'create', 'bulkDelete', 'findSameWord', 'copyEntry', 'findOccurrences', 'bulkApply'] as const

function validatePositiveInt(value: unknown, field: string, min = 1): number | ValidationFailure {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isInteger(n) || n < min) return failure(`${field} must be an integer >= ${min}`)
  return n
}

export function validatePostBody(input: unknown): ValidationResult<ValidatedPost> {
  if (!isPlainObject(input)) {
    return failure('body must be an object')
  }

  const action = input.action
  if (!(POST_ACTIONS as readonly string[]).includes(String(action))) {
    return failure('valid action is required')
  }

  const deviceId = validateDeviceId(input.deviceId)
  if (isFailure(deviceId)) return deviceId

  if (action === 'findOccurrences') {
    const entryId = validateNonEmptyString(input.entryId, 'entryId', MAX_ENTRY_ID_LENGTH)
    if (isFailure(entryId)) return entryId
    return { ok: true, value: { action, entryId } }
  }

  if (action === 'findSameWord') {
    const surah = validatePositiveInt(input.surah, 'surah')
    if (isFailure(surah)) return surah
    const ayah = validatePositiveInt(input.ayah, 'ayah')
    if (isFailure(ayah)) return ayah
    const word = validatePositiveInt(input.word, 'word')
    if (isFailure(word)) return word
    let excludeLocusId: string | null | undefined
    if (hasOwn(input, 'excludeLocusId')) {
      const v = validateOptionalText(input.excludeLocusId, 'excludeLocusId')
      if (isFailure(v)) return v
      excludeLocusId = v
    }
    return { ok: true, value: { action, surah, ayah, word, excludeLocusId } }
  }

  if (action === 'bulkDelete') {
    const rawItems = input.items
    if (!Array.isArray(rawItems) || rawItems.length < 1 || rawItems.length > 200) {
      return failure('items must contain between 1 and 200 entries')
    }
    const items: Array<{ entryId: string; expectedVersion: string }> = []
    for (const raw of rawItems) {
      if (!isPlainObject(raw)) return failure('each item must be an object')
      const entryId = validateNonEmptyString(raw.entryId, 'entryId', MAX_ENTRY_ID_LENGTH)
      if (isFailure(entryId)) return entryId
      const expectedVersion = validateNonEmptyString(raw.expectedVersion, 'expectedVersion')
      if (isFailure(expectedVersion)) return expectedVersion
      items.push({ entryId, expectedVersion })
    }
    const note = validateOptionalText(input.note, 'note')
    if (isFailure(note)) return note
    return { ok: true, value: { action, items, note, deviceId } }
  }

  if (action === 'copyEntry') {
    const sourceEntryId = validateNonEmptyString(input.sourceEntryId, 'sourceEntryId', MAX_ENTRY_ID_LENGTH)
    if (isFailure(sourceEntryId)) return sourceEntryId
    const surah = validatePositiveInt(input.surah, 'surah')
    if (isFailure(surah)) return surah
    const ayah = validatePositiveInt(input.ayah, 'ayah')
    if (isFailure(ayah)) return ayah
    const startWord = validatePositiveInt(input.startWord, 'startWord')
    if (isFailure(startWord)) return startWord
    return { ok: true, value: { action, sourceEntryId, surah, ayah, startWord, deviceId } }
  }

  if (action === 'bulkApply') {
    const sourceEntryId = validateNonEmptyString(input.sourceEntryId, 'sourceEntryId', MAX_ENTRY_ID_LENGTH)
    if (isFailure(sourceEntryId)) return sourceEntryId
    const rawTargets = input.targets
    if (!Array.isArray(rawTargets) || rawTargets.length < 1 || rawTargets.length > 500) {
      return failure('targets must contain between 1 and 500 entries')
    }
    const targets: Array<{ surah: number; ayah: number; word: number }> = []
    for (const raw of rawTargets) {
      if (!isPlainObject(raw)) return failure('each target must be an object')
      const surah = validatePositiveInt(raw.surah, 'target surah')
      if (isFailure(surah)) return surah
      const ayah = validatePositiveInt(raw.ayah, 'target ayah')
      if (isFailure(ayah)) return ayah
      const word = validatePositiveInt(raw.word, 'target word')
      if (isFailure(word)) return word
      targets.push({ surah, ayah, word })
    }
    return { ok: true, value: { action, sourceEntryId, targets, deviceId } }
  }

  if (action === 'undo') {
    const rawTxid = input.txid
    const txid =
      typeof rawTxid === 'number'
        ? rawTxid
        : typeof rawTxid === 'string' && rawTxid.trim() !== ''
          ? Number(rawTxid)
          : NaN

    if (!Number.isSafeInteger(txid) || txid < 1) {
      return failure('txid must be a positive integer')
    }

    return { ok: true, value: { action: 'undo', txid, deviceId } }
  }

  // action === 'create'
  const entry = input.entry
  if (!isPlainObject(entry)) {
    return failure('entry must be an object')
  }

  const surah = Number(entry.surah)
  if (!Number.isInteger(surah) || surah < 1 || surah > 114) {
    return failure('surah must be an integer between 1 and 114')
  }

  const ayah = Number(entry.ayah)
  if (!Number.isInteger(ayah) || ayah < 1) {
    return failure('ayah must be a positive integer')
  }

  const startWord = Number(entry.startWord)
  if (!Number.isInteger(startWord) || startWord < 1) {
    return failure('startWord must be a positive integer')
  }

  const endAyah = entry.endAyah !== undefined ? Number(entry.endAyah) : ayah
  if (!Number.isInteger(endAyah) || endAyah < ayah) {
    return failure('endAyah must be an integer >= ayah')
  }

  const endWord = entry.endWord !== undefined ? Number(entry.endWord) : startWord
  if (!Number.isInteger(endWord) || endWord < 1) {
    return failure('endWord must be a positive integer')
  }

  const kind = entry.kind
  if (kind !== 'farsh' && kind !== 'usul') {
    return failure('kind must be farsh or usul')
  }

  let readingText: string | undefined
  if (kind === 'farsh') {
    const validatedReading = validateNonEmptyString(entry.readingText, 'readingText', MAX_FREE_TEXT_LENGTH)
    if (isFailure(validatedReading)) return validatedReading
    readingText = validatedReading
  }

  let categoryCode: string | undefined
  if (kind === 'usul') {
    const validatedCategory = validateNonEmptyString(entry.categoryCode, 'categoryCode', MAX_SHORT_CODE_LENGTH)
    if (isFailure(validatedCategory)) return validatedCategory
    categoryCode = validatedCategory
  }

  const validatedNarrators = validateNarrators(entry.narrators)
  if (isFailure(validatedNarrators)) return validatedNarrators

  const uthmaniText = validateOptionalText(entry.uthmaniText, 'uthmaniText')
  if (isFailure(uthmaniText)) return uthmaniText

  const description = validateOptionalText(entry.description, 'description')
  if (isFailure(description)) return description

  const performanceNote = validateOptionalText(entry.performanceNote, 'performanceNote')
  if (isFailure(performanceNote)) return performanceNote

  const variantType = entry.variantType !== undefined ? validateOptionalText(entry.variantType, 'variantType') : undefined
  if (isFailure(variantType)) return variantType

  const rulingText = validateOptionalText(entry.rulingText, 'rulingText')
  if (isFailure(rulingText)) return rulingText

  const notes = validateOptionalText(entry.notes, 'notes')
  if (isFailure(notes)) return notes

  return {
    ok: true,
    value: {
      action: 'create',
      deviceId,
      entry: {
        surah,
        ayah,
        startWord,
        endAyah,
        endWord,
        kind,
        readingText,
        categoryCode,
        narrators: validatedNarrators,
        uthmaniText,
        description,
        performanceNote,
        variantType: variantType ?? undefined,
        rulingText,
        notes,
      },
    },
  }
}

export function mapReviewDatabaseError(message: string): {
  status: number
  body: Record<string, unknown>
} {
  const rawMessage = typeof message === 'string' ? message : String(message)
  const upperMessage = rawMessage.toUpperCase()

  if (upperMessage.startsWith('UNAUTHORIZED')) {
    return { status: 403, body: { error: 'forbidden' } }
  }
  if (upperMessage.startsWith('VERSION_CONFLICT')) {
    return { status: 409, body: { error: 'VERSION_CONFLICT' } }
  }
  if (upperMessage.startsWith('QIRAAT_D8')) {
    return {
      status: 422,
      body: {
        error: 'RULE_D8',
        messageAr: 'حفص هو الأصل: لا يُذكر إلا وجهًا ثانيًا مع ملاحظة',
      },
    }
  }
  if (upperMessage.startsWith('QIRAAT_NARRATOR_TWICE')) {
    return {
      status: 422,
      body: {
        error: 'RULE_NARRATOR_TWICE',
        messageAr: 'راوٍ مكرر في هذا الموضع دون وجه مستقل',
      },
    }
  }
  if (/WASL_WAQF/i.test(rawMessage)) {
    return {
      status: 422,
      body: {
        error: 'RULE_WASL_WAQF',
        messageAr: 'لا بد أن ينطبق الموضع على الوصل أو الوقف على الأقل',
      },
    }
  }
  if (upperMessage.startsWith('QIRAAT_EMPTY_LOCUS')) {
    return {
      status: 422,
      body: {
        error: 'RULE_EMPTY_LOCATION',
        messageAr: 'لا بد من قراءة واحدة على الأقل في الموضع',
      },
    }
  }
  if (upperMessage.startsWith('UNDO_CONFLICT')) {
    return { status: 409, body: { error: 'UNDO_CONFLICT' } }
  }
  if (upperMessage.startsWith('UNDO_REFUSED')) {
    return { status: 403, body: { error: 'UNDO_REFUSED' } }
  }
  if (upperMessage.startsWith('NOT_FOUND')) {
    return { status: 404, body: { error: 'not_found' } }
  }
  if (
    /DELETED/i.test(rawMessage) ||
    /invalid /i.test(rawMessage) ||
    / is required/i.test(rawMessage) ||
    /duplicate narrator/i.test(rawMessage)
  ) {
    return { status: 400, body: { error: rawMessage } }
  }

  console.error('[qiraat-review] database failure', rawMessage)
  return { status: 503, body: { error: 'Qiraat review data is unavailable' } }
}
