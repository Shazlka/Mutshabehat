import assert from 'node:assert/strict'
import test from 'node:test'
import {
  QIRAAT_HINT_AUTO_DISMISS_MS,
  QIRAAT_HINT_STORAGE_KEY,
  readQiraatHintSeen,
  resetMemoryHintSeenForTesting,
  resolveAppVersion,
  resolveQiraatHintTimer,
  shouldShowQiraatHint,
  writeQiraatHintSeen,
} from '../../src/app/mushaf-1441/_components/phone/qiraatHintHelper'

test('shouldShowQiraatHint displays only when qiraat is on and hint was never seen', () => {
  assert.equal(shouldShowQiraatHint({ qiraatEnabled: true, hintSeen: false }), true)
  assert.equal(shouldShowQiraatHint({ qiraatEnabled: false, hintSeen: false }), false)
  assert.equal(shouldShowQiraatHint({ qiraatEnabled: true, hintSeen: true }), false)
  assert.equal(shouldShowQiraatHint({ qiraatEnabled: false, hintSeen: true }), false)
})

test('readQiraatHintSeen and writeQiraatHintSeen persist using expected storage key', () => {
  resetMemoryHintSeenForTesting()
  const map = new Map<string, string>()
  const mockStorage = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value) },
  }

  assert.equal(readQiraatHintSeen(mockStorage), false)
  assert.equal(writeQiraatHintSeen(mockStorage), true)
  assert.equal(map.get(QIRAAT_HINT_STORAGE_KEY), 'true')
  assert.equal(readQiraatHintSeen(mockStorage), true)
})

test('storage helpers gracefully catch exceptions without throwing', () => {
  resetMemoryHintSeenForTesting()
  const faultyStorage = {
    getItem: () => { throw new Error('QuotaExceeded / SecurityError') },
    setItem: () => { throw new Error('QuotaExceeded / SecurityError') },
  }

  assert.equal(readQiraatHintSeen(faultyStorage), false)
  assert.equal(writeQiraatHintSeen(faultyStorage), true)
  // Once written in-memory, subsequent read reflects true even when storage fails
  assert.equal(readQiraatHintSeen(faultyStorage), true)
})

test('resolveQiraatHintTimer returns 8000ms only while visible', () => {
  assert.equal(resolveQiraatHintTimer(true), QIRAAT_HINT_AUTO_DISMISS_MS)
  assert.equal(resolveQiraatHintTimer(true, 8000), 8000)
  assert.equal(resolveQiraatHintTimer(false), null)
})

test('resolveAppVersion returns version string or fallback ويب', () => {
  assert.equal(resolveAppVersion('1.0.0 (42)'), '1.0.0 (42)')
  assert.equal(resolveAppVersion('v2.1.0'), 'v2.1.0')
  assert.equal(resolveAppVersion(''), 'ويب')
  assert.equal(resolveAppVersion(undefined), 'ويب')
  assert.equal(resolveAppVersion(null), 'ويب')
  assert.equal(resolveAppVersion('   '), 'ويب')
})
