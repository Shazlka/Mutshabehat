import assert from 'node:assert/strict'
import test from 'node:test'
import { agoText, errorReportText, syncStatus } from '../../../packages/qiraat-core/features/syncStatus'

const NOW = Date.parse('2026-11-04T12:00:00Z')
const ago = (seconds: number) => NOW - seconds * 1000

// Ported from apps/ios QiraatSyncStatusTests.swift.
test('an answer from the web app confirmed a moment ago reads «محدّث الآن»', () => {
  const s = syncStatus({ outcome: 'unchanged', lastSuccess: ago(10), now: NOW, offline: false })
  assert.deepEqual([s.kind, s.title], ['current', 'محدّث الآن'])
})

test('an answer with no recorded time counts as now', () => {
  assert.equal(syncStatus({ outcome: 'updated', lastSuccess: null, now: NOW, offline: false }).kind, 'current')
})

test('after a minute the time is shown', () => {
  const s = syncStatus({ outcome: 'unchanged', lastSuccess: ago(5 * 60), now: NOW, offline: false })
  assert.deepEqual([s.kind, s.title], ['confirmed', 'محدّث قبل ٥ دقائق'])
})

test('the window is exactly 60 seconds', () => {
  assert.equal(syncStatus({ outcome: 'updated', lastSuccess: ago(59), now: NOW, offline: false }).kind, 'current')
  assert.equal(syncStatus({ outcome: 'updated', lastSuccess: ago(60), now: NOW, offline: false }).kind, 'confirmed')
})

test('a failed or skipped check keeps the last confirmed time', () => {
  for (const outcome of ['failed', 'skipped', null] as const) {
    const s = syncStatus({ outcome, lastSuccess: ago(2 * 3600), now: NOW, offline: false })
    assert.deepEqual([s.kind, s.title], ['confirmed', 'محدّث قبل ساعتين'])
  }
})

test('a page never confirmed on this device is the bundled copy', () => {
  for (const outcome of ['failed', 'skipped', null] as const) {
    const s = syncStatus({ outcome, lastSuccess: null, now: NOW, offline: false })
    assert.deepEqual([s.kind, s.title], ['localCopy', 'نسخة محلية'])
  }
})

test('a confirmation in the future (clock skew) never gives a negative time', () => {
  const s = syncStatus({ outcome: 'unchanged', lastSuccess: NOW + 5000, now: NOW, offline: false })
  assert.equal(s.kind, 'current')
})

test('offline is carried and changes the symbol but not the words', () => {
  const online = syncStatus({ outcome: 'unchanged', lastSuccess: ago(5), now: NOW, offline: false })
  const offline = syncStatus({ outcome: 'failed', lastSuccess: ago(5), now: NOW, offline: true })
  assert.equal(offline.offline, true)
  assert.equal(offline.title, online.title)
  assert.notEqual(offline.symbol, online.symbol)
})

test('each state has its own symbol, so colour is never the only cue', () => {
  const symbols = [
    syncStatus({ outcome: 'updated', lastSuccess: ago(1), now: NOW, offline: false }).symbol,
    syncStatus({ outcome: 'updated', lastSuccess: ago(600), now: NOW, offline: false }).symbol,
    syncStatus({ outcome: null, lastSuccess: null, now: NOW, offline: false }).symbol,
  ]
  assert.equal(new Set(symbols).size, 3)
})

test('agoText uses Arabic plurals for minutes, hours and days', () => {
  const m = (n: number) => agoText(n * 60)
  assert.equal(m(1), 'قبل دقيقة')
  assert.equal(m(2), 'قبل دقيقتين')
  assert.equal(m(5), 'قبل ٥ دقائق')
  assert.equal(m(15), 'قبل ١٥ دقيقة')
  assert.equal(m(60), 'قبل ساعة')
  assert.equal(m(120), 'قبل ساعتين')
  assert.equal(m(3 * 60), 'قبل ٣ ساعات')
  assert.equal(m(12 * 60), 'قبل ١٢ ساعة')
  assert.equal(m(24 * 60), 'قبل يوم')
  assert.equal(m(48 * 60), 'قبل يومين')
  assert.equal(m(5 * 24 * 60), 'قبل ٥ أيام')
  assert.equal(m(15 * 24 * 60), 'قبل ١٥ يومًا')
})

test('the error report carries only facts the page holds', () => {
  const text = errorReportText({ page: 17, surah: 2, ayah: 112, token: 13, word: 'خَوْفٌ', variantIds: ['v1', 'v2'], rulingIds: ['r1'] })
  assert.equal(text, ['بلاغ عن خطأ في القراءات', 'الصفحة: 17', 'الموضع: 2:112:13', 'الكلمة: خَوْفٌ', 'الوجوه: v1، v2', 'الأحكام: r1'].join('\n'))
})

test('the report leaves out the lists that are empty', () => {
  const text = errorReportText({ page: 1, surah: 1, ayah: 1, token: 1, word: 'ب', variantIds: [], rulingIds: [] })
  assert.equal(text.split('\n').length, 4)
})

test('agoText at the edges of each unit', () => {
  assert.equal(agoText(59 * 60), 'قبل ٥٩ دقيقة')
  assert.equal(agoText(10 * 60), 'قبل ١٠ دقائق')
  assert.equal(agoText(11 * 60), 'قبل ١١ دقيقة')
  assert.equal(agoText(23 * 3600), 'قبل ٢٣ ساعة')
  assert.equal(agoText(10 * 24 * 3600), 'قبل ١٠ أيام')
})

test('updated and unchanged read the same', () => {
  const a = syncStatus({ outcome: 'updated', lastSuccess: ago(30), now: NOW, offline: false })
  const b = syncStatus({ outcome: 'unchanged', lastSuccess: ago(30), now: NOW, offline: false })
  assert.deepEqual(a, b)
})

test('offline with no confirmation is still the bundled copy', () => {
  const s = syncStatus({ outcome: null, lastSuccess: null, now: NOW, offline: true })
  assert.deepEqual([s.kind, s.offline], ['localCopy', true])
})

test('the report lists several ids with the Arabic comma', () => {
  const text = errorReportText({ page: 2, surah: 2, ayah: 1, token: 1, word: 'ا', variantIds: ['a', 'b', 'c'], rulingIds: ['x', 'y'] })
  assert.ok(text.includes('الوجوه: a، b، c'))
  assert.ok(text.includes('الأحكام: x، y'))
})

test('a long outage reads in days', () => {
  assert.equal(syncStatus({ outcome: 'failed', lastSuccess: ago(3 * 24 * 3600), now: NOW, offline: false }).title, 'محدّث قبل ٣ أيام')
})
