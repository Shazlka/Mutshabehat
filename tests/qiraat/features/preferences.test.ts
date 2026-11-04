import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_USUL_PREFS,
  filterRulingsByPrefs,
  isRulingVisible,
  loadUsulPrefs,
  QIRAAT_USUL_PREFS_KEY,
  saveUsulPrefs,
  toggleUsulCategory,
  usulCategoryOptions,
} from '../../../packages/qiraat-core/features/preferences'
import type { QiraatRuling } from '../../../packages/qiraat-core/types'

function ruling(category: string, id = category): QiraatRuling {
  return {
    id, pageNumber: 1, category, categoryAr: `باب ${category}`, color: '#123456', wordAnchored: true, surah: 1, ayah: 1,
    startToken: 1, endToken: 1, endAyah: 1, baseText: 'x', verificationStatus: 'REVIEWED', attribution: [], readings: [],
    hasAlternate: false, createdAt: '', updatedAt: '',
  }
}

const memory = (initial?: string) => {
  let value = initial ?? null
  return {
    getItem: (k: string) => (k === QIRAAT_USUL_PREFS_KEY ? value : null),
    setItem: (k: string, v: string) => { if (k === QIRAAT_USUL_PREFS_KEY) value = v },
  }
}

test('defaults when storage is empty, throws, or holds corrupt JSON', () => {
  assert.deepEqual(loadUsulPrefs(memory()), DEFAULT_USUL_PREFS)
  assert.deepEqual(loadUsulPrefs({ getItem: () => { throw new Error('blocked') } }), DEFAULT_USUL_PREFS)
  assert.deepEqual(loadUsulPrefs(memory('{not json')), DEFAULT_USUL_PREFS)
  assert.deepEqual(loadUsulPrefs(memory('{"farshOnly":"yes","disabledCategories":[1,"A"]}')), { farshOnly: false, disabledCategories: ['A'] })
})

test('a save then a load gives the same preferences, and a blocked save does not throw', () => {
  const store = memory()
  const prefs = { farshOnly: true, disabledCategories: ['IKHFA', 'SAKT'] }
  saveUsulPrefs(store, prefs)
  assert.deepEqual(loadUsulPrefs(store), prefs)
  assert.doesNotThrow(() => saveUsulPrefs({ setItem: () => { throw new Error('full') } }, prefs))
})

test('farsh-only hides every ruling', () => {
  assert.equal(isRulingVisible(ruling('IKHFA'), { farshOnly: true, disabledCategories: [] }), false)
})

test('a disabled category hides only its own rulings', () => {
  const prefs = { farshOnly: false, disabledCategories: ['IKHFA'] }
  assert.equal(isRulingVisible(ruling('IKHFA'), prefs), false)
  assert.equal(isRulingVisible(ruling('SAKT'), prefs), true)
  assert.deepEqual(filterRulingsByPrefs([ruling('IKHFA'), ruling('SAKT')], prefs).map((r) => r.category), ['SAKT'])
})

test('filterRulingsByPrefs keeps the same array when nothing is hidden', () => {
  const list = [ruling('IKHFA')]
  assert.equal(filterRulingsByPrefs(list, DEFAULT_USUL_PREFS), list)
})

test('toggleUsulCategory switches one باب off and on without touching the others', () => {
  const off = toggleUsulCategory(DEFAULT_USUL_PREFS, 'IKHFA', false)
  assert.deepEqual(off.disabledCategories, ['IKHFA'])
  assert.deepEqual(toggleUsulCategory(off, 'SAKT', false).disabledCategories, ['IKHFA', 'SAKT'])
  assert.deepEqual(toggleUsulCategory(off, 'IKHFA', true).disabledCategories, [])
})

test('usulCategoryOptions lists the registry and any category only the data carries, with its colour', () => {
  const options = usulCategoryOptions([ruling('USUL_MIM_JAM')])
  const codes = options.map((o) => o.code)
  assert.ok(codes.includes('IKHFA'))
  assert.ok(codes.includes('USUL_MIM_JAM'))
  assert.equal(options.find((o) => o.code === 'USUL_MIM_JAM')?.color, '#123456')
  assert.equal(new Set(codes).size, codes.length)
})
