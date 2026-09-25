import assert from 'node:assert/strict'
import test from 'node:test'

import {
  mapReviewDatabaseError,
  validateGetQuery,
  validatePatchBody,
  validatePostBody,
} from '../../src/app/api/mushaf-1441/qiraat-review/review-http'

test('validateGetQuery accepts overview mode', () => {
  assert.deepEqual(validateGetQuery({ overview: '1' }), {
    ok: true,
    value: { mode: 'overview' },
  })
})

test('validateGetQuery accepts history mode with a valid page', () => {
  assert.deepEqual(validateGetQuery({ history: '1', page: '258' }), {
    ok: true,
    value: { mode: 'history', page: 258 },
  })
})

test('validateGetQuery accepts page mode and includeDeleted truthy values', () => {
  assert.deepEqual(validateGetQuery({ page: '258', includeDeleted: '1' }), {
    ok: true,
    value: { mode: 'page', page: 258, includeDeleted: true },
  })
  assert.deepEqual(validateGetQuery({ page: '258', includeDeleted: 'true' }), {
    ok: true,
    value: { mode: 'page', page: 258, includeDeleted: true },
  })
  assert.deepEqual(validateGetQuery({ page: '258', includeDeleted: 'yes' }), {
    ok: true,
    value: { mode: 'page', page: 258, includeDeleted: false },
  })
})

test('validateGetQuery rejects missing, non-numeric, fractional, and out-of-range pages', () => {
  for (const input of [
    {},
    { page: '' },
    { page: 'abc' },
    { page: '1.5' },
    { page: '0' },
    { page: '605' },
  ]) {
    const result = validateGetQuery(input)
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.status, 400)
  }
})

test('validatePatchBody validates common action, entryId, and version rules', () => {
  for (const payload of [
    null,
    {},
    { action: 'unknown', entryId: 'entry', version: 'v' },
    { action: 'restore', version: 'v' },
    { action: 'restore', entryId: 'entry', version: '' },
    { action: 'restore', entryId: ' ', version: 'v' },
    { action: 'restore', entryId: 'x'.repeat(201), version: 'v' },
  ]) {
    const result = validatePatchBody(payload)
    assert.equal(result.ok, false)
  }
})

test('validatePatchBody accepts status and validates status and optional note/deviceId', () => {
  const valid = validatePatchBody({
    action: 'status',
    entryId: 'entry-1',
    version: '2026-09-23T00:00:00.000Z',
    status: 'flagged',
    note: '',
    deviceId: 'device-1',
  })
  assert.deepEqual(valid, {
    ok: true,
    value: {
      action: 'status',
      entryId: 'entry-1',
      version: '2026-09-23T00:00:00.000Z',
      deviceId: 'device-1',
      status: 'flagged',
      note: '',
    },
  })

  for (const status of ['pending', '', null]) {
    assert.equal(validatePatchBody({
      action: 'status',
      entryId: 'entry-1',
      version: 'v',
      status,
    }).ok, false)
  }

  assert.equal(validatePatchBody({
    action: 'status',
    entryId: 'entry-1',
    version: 'v',
    note: 'x'.repeat(2001),
  }).ok, false)
  assert.equal(validatePatchBody({
    action: 'status',
    entryId: 'entry-1',
    version: 'v',
    deviceId: 123,
  }).ok, false)
})

test('validatePatchBody accepts update fields and validates every field rule', () => {
  const valid = validatePatchBody({
    action: 'update',
    entryId: 'entry-1',
    version: 'opaque-version',
    fields: {
      kind: 'farsh',
      notes: null,
      readingText: 'قراءة',
      uthmaniText: '',
      description: null,
      performanceNote: '',
      variantType: 'HAMZA',
      categoryCode: 'MADD',
      rulingText: '',
    },
  })
  assert.equal(valid.ok, true)

  const validUsul = validatePatchBody({
    action: 'update',
    entryId: 'entry-1',
    version: 'opaque-version',
    fields: {
      kind: 'usul',
      categoryCode: 'MADD',
    },
  })
  assert.equal(validUsul.ok, true)

  for (const fields of [
    null,
    [],
    {},
    { unknown: 'value' },
    { kind: 'invalid' },
    { kind: 123 },
    { notes: 1 },
    { readingText: null },
    { notes: 'x'.repeat(2001) },
    { variantType: '' },
    { variantType: 'x'.repeat(101) },
    { categoryCode: ' ' },
    { categoryCode: 'x'.repeat(101) },
  ]) {
    assert.equal(validatePatchBody({
      action: 'update',
      entryId: 'entry-1',
      version: 'v',
      fields,
    }).ok, false)
  }
})

test('validatePatchBody accepts narrator inputs and enforces narrator rules', () => {
  const valid = validatePatchBody({
    action: 'narrators',
    entryId: 'entry-1',
    version: 'v',
    narrators: [
      { id: 'Q01-R01', action: '', wajhOrder: 1, wajhNote: null },
      { id: 'Q01-R02', wajhOrder: 2, wajhNote: 'وجه ثان' },
    ],
  })
  assert.equal(valid.ok, true)

  for (const narrators of [[], new Array(21).fill({ id: 'Q01-R01' }), null, 'bad']) {
    assert.equal(validatePatchBody({
      action: 'narrators',
      entryId: 'entry-1',
      version: 'v',
      narrators,
    }).ok, false)
  }

  for (const narrator of [
    null,
    { id: '' },
    { id: 'x'.repeat(101) },
    { id: 'Q01-R01', action: 1 },
    { id: 'Q01-R01', action: 'x'.repeat(2001) },
    { id: 'Q01-R01', wajhOrder: 0 },
    { id: 'Q01-R01', wajhOrder: 1.5 },
    { id: 'Q01-R01', wajhOrder: '1' },
    { id: 'Q01-R01', wajhNote: 1 },
    { id: 'Q01-R01', wajhNote: 'x'.repeat(2001) },
  ]) {
    assert.equal(validatePatchBody({
      action: 'narrators',
      entryId: 'entry-1',
      version: 'v',
      narrators: [narrator],
    }).ok, false)
  }
})

test('validatePatchBody accepts delete and restore actions', () => {
  assert.deepEqual(validatePatchBody({
    action: 'delete',
    entryId: 'entry-1',
    version: 'v',
    note: null,
  }), {
    ok: true,
    value: {
      action: 'delete',
      entryId: 'entry-1',
      version: 'v',
      deviceId: undefined,
      note: null,
    },
  })

  assert.deepEqual(validatePatchBody({
    action: 'restore',
    entryId: 'entry-1',
    version: 'v',
  }), {
    ok: true,
    value: {
      action: 'restore',
      entryId: 'entry-1',
      version: 'v',
      deviceId: undefined,
    },
  })

  assert.equal(validatePatchBody({
    action: 'delete',
    entryId: 'entry-1',
    version: 'v',
    note: 1,
  }).ok, false)
})

test('validatePostBody accepts undo and validates action, txid, and deviceId', () => {
  assert.deepEqual(validatePostBody({
    action: 'undo',
    txid: '42',
    deviceId: 'device-1',
  }), {
    ok: true,
    value: { action: 'undo', txid: 42, deviceId: 'device-1' },
  })

  for (const txid of [undefined, null, '', 'abc', '1.5', 0, -1, 1.5]) {
    assert.equal(validatePostBody({ action: 'undo', txid }).ok, false)
  }

  assert.equal(validatePostBody({ action: 'redo', txid: 1 }).ok, false)
  assert.equal(validatePostBody({ action: 'undo', txid: 1, deviceId: 1 }).ok, false)
})

test('validatePostBody accepts create action and validates all entry fields', () => {
  const valid = validatePostBody({
    action: 'create',
    deviceId: 'device-1',
    entry: {
      surah: 2,
      ayah: 6,
      startWord: 1,
      kind: 'farsh',
      readingText: 'أَنَّ',
      narrators: [{ id: 'Q01-R01', wajhOrder: 1 }],
    },
  })
  assert.equal(valid.ok, true)
  if (valid.ok && valid.value.action === 'create') {
    assert.equal(valid.value.entry.readingText, 'أَنَّ')
  }

  // Missing readingText for farsh
  assert.equal(validatePostBody({
    action: 'create',
    entry: {
      surah: 2,
      ayah: 6,
      startWord: 1,
      kind: 'farsh',
      narrators: [{ id: 'Q01-R01' }],
    },
  }).ok, false)

  // Missing categoryCode for usul
  assert.equal(validatePostBody({
    action: 'create',
    entry: {
      surah: 2,
      ayah: 6,
      startWord: 1,
      kind: 'usul',
      narrators: [{ id: 'Q01-R01' }],
    },
  }).ok, false)
})

test('mapReviewDatabaseError maps every defined database error row', () => {
  const cases: Array<[string, number, Record<string, unknown>]> = [
    ['unauthorized editor', 403, { error: 'forbidden' }],
    ['VERSION_CONFLICT entry abc', 409, { error: 'VERSION_CONFLICT' }],
    ['QIRAAT_D8 extra detail', 422, { error: 'RULE_D8', messageAr: 'حفص هو الأصل: لا يُذكر إلا وجهًا ثانيًا مع ملاحظة' }],
    ['QIRAAT_NARRATOR_TWICE extra detail', 422, { error: 'RULE_NARRATOR_TWICE', messageAr: 'راوٍ مكرر في هذا الموضع دون وجه مستقل' }],
    ['QIRAAT_EMPTY_LOCUS extra detail', 422, { error: 'RULE_EMPTY_LOCATION', messageAr: 'لا بد من قراءة واحدة على الأقل في الموضع' }],
    ['UNDO_CONFLICT transaction 1', 409, { error: 'UNDO_CONFLICT' }],
    ['UNDO_REFUSED transaction 1', 403, { error: 'UNDO_REFUSED' }],
    ['NOT_FOUND entry abc', 404, { error: 'not_found' }],
    ['DELETED entry abc', 400, { error: 'DELETED entry abc' }],
    ['invalid category', 400, { error: 'invalid category' }],
    ['readingText is required', 400, { error: 'readingText is required' }],
    ['duplicate narrator', 400, { error: 'duplicate narrator' }],
  ]

  for (const [message, status, body] of cases) {
    assert.deepEqual(mapReviewDatabaseError(message), { status, body })
  }
})

test('mapReviewDatabaseError is case-insensitive for prefixes and hides unknown diagnostics', () => {
  assert.deepEqual(mapReviewDatabaseError('version_conflict details'), {
    status: 409,
    body: { error: 'VERSION_CONFLICT' },
  })
  assert.deepEqual(mapReviewDatabaseError('unexpected postgres detail'), {
    status: 503,
    body: { error: 'Qiraat review data is unavailable' },
  })
})
