import assert from 'node:assert/strict'
import test from 'node:test'
import { planApplyReferenceGroup, type ApplyContext } from '../../src/app/mushaf-1441/review/_lib/referenceApply'
import type { ReferenceGroup } from '../../src/app/mushaf-1441/review/_lib/referenceGroup'

const HAFS = 'Q05-R02'

function ctx(over: Partial<ApplyContext> = {}): ApplyContext {
  return { narrators: [], readingText: '', kind: 'farsh', categoryCode: null, isFreshDraft: false, otherFarshNarrators: [], ...over }
}

function group(over: Partial<ReferenceGroup> = {}): ReferenceGroup {
  return { key: 'g', readersLabel: 'ورش', narratorIds: ['Q01-R02'], performanceText: 'قرأ بالتقليل', ...over }
}

test('an nquran-style group (no optional fields) only appends narrators with the reading as «الأداء»', () => {
  const plan = planApplyReferenceGroup('nquran', group({ narratorIds: ['Q01-R01', 'Q01-R02'] }), ctx())
  assert.deepEqual(plan.narrators, [
    { id: 'Q01-R01', action: 'قرأ بالتقليل', wajhOrder: 1, wajhNote: null },
    { id: 'Q01-R02', action: 'قرأ بالتقليل', wajhOrder: 1, wajhNote: null },
  ])
  assert.equal(plan.readingText, undefined)
  assert.equal(plan.kind, undefined)
  assert.equal(plan.appliesWasl, undefined)
  assert.equal(plan.appliesWaqf, undefined)
  assert.equal(plan.categoryCode, undefined)
  assert.equal(plan.pendingSuggestion, null)
})

test('Hafs is floored at wajh 2 and gets a source-specific note when the text is empty', () => {
  const g = group({ narratorIds: [HAFS], performanceText: '' })
  assert.deepEqual(planApplyReferenceGroup('nquran', g, ctx()).narrators, [
    { id: HAFS, action: null, wajhOrder: 2, wajhNote: 'مستورد من مرجع nquran.com' },
  ])
  assert.equal(planApplyReferenceGroup('shamil', g, ctx()).narrators[0].wajhNote, 'مستورد من مرجع الشامل')
  const withText = planApplyReferenceGroup('shamil', group({ narratorIds: [HAFS], performanceText: 'الفتح' }), ctx())
  assert.equal(withText.narrators[0].wajhNote, 'الفتح')
})

test('applying the same group twice is idempotent', () => {
  const g = group()
  const once = planApplyReferenceGroup('shamil', g, ctx())
  const twice = planApplyReferenceGroup('shamil', g, ctx({ narrators: once.narrators }))
  assert.deepEqual(twice.narrators, once.narrators)
})

test('the same narrator with a different action takes the next wajh order, counting other farsh rows', () => {
  const first = planApplyReferenceGroup('nquran', group({ performanceText: 'أ' }), ctx({ otherFarshNarrators: [{ id: 'Q01-R02', wajhOrder: 1 }] }))
  assert.equal(first.narrators[0].wajhOrder, 2)
  const second = planApplyReferenceGroup('shamil', group({ performanceText: 'ب' }), ctx({ narrators: first.narrators, otherFarshNarrators: [{ id: 'Q01-R02', wajhOrder: 1 }] }))
  assert.deepEqual(second.narrators.map((n) => [n.action, n.wajhOrder]), [['أ', 2], ['ب', 3]])
})

test('reading text is filled only when the field is empty', () => {
  const g = group({ readingText: 'يُخَادِعُونَ' })
  assert.equal(planApplyReferenceGroup('shamil', g, ctx()).readingText, 'يُخَادِعُونَ')
  assert.equal(planApplyReferenceGroup('shamil', g, ctx({ readingText: '  ' })).readingText, 'يُخَادِعُونَ')
  assert.equal(planApplyReferenceGroup('shamil', g, ctx({ readingText: 'كتبه المراجع' })).readingText, undefined)
  assert.equal(planApplyReferenceGroup('shamil', group({ readingText: null }), ctx()).readingText, undefined)
})

test('a fresh draft takes kind, wasl/waqf and category from the group', () => {
  const g = group({ condition: 'waqf', suggestion: { kind: 'usul', categoryCode: 'IMALAH_TAQLIL' } })
  const plan = planApplyReferenceGroup('shamil', g, ctx({ isFreshDraft: true }))
  assert.equal(plan.kind, 'usul')
  assert.equal(plan.appliesWasl, false)
  assert.equal(plan.appliesWaqf, true)
  assert.equal(plan.categoryCode, 'IMALAH_TAQLIL')
  assert.equal(plan.pendingSuggestion, null)
  const wasl = planApplyReferenceGroup('shamil', group({ condition: 'wasl' }), ctx({ isFreshDraft: true }))
  assert.deepEqual([wasl.appliesWasl, wasl.appliesWaqf], [true, false])
  const both = planApplyReferenceGroup('shamil', group({ condition: 'both' }), ctx({ isFreshDraft: true }))
  assert.deepEqual([both.appliesWasl, both.appliesWaqf], [true, true])
})

test('a draft that is not fresh keeps kind and wasl/waqf and offers the suggestion as a chip', () => {
  const g = group({ condition: 'waqf', suggestion: { kind: 'usul', categoryCode: 'IMALAH_TAQLIL' } })
  const plan = planApplyReferenceGroup('shamil', g, ctx({ kind: 'farsh', isFreshDraft: false }))
  assert.equal(plan.kind, undefined)
  assert.equal(plan.appliesWasl, undefined)
  assert.equal(plan.appliesWaqf, undefined)
  assert.equal(plan.categoryCode, undefined)
  assert.deepEqual(plan.pendingSuggestion, { kind: 'usul', categoryCode: 'IMALAH_TAQLIL' })
})

test('an existing category is never overwritten, even on a usul draft', () => {
  const g = group({ suggestion: { kind: 'usul', categoryCode: 'IMALAH_TAQLIL' } })
  const plan = planApplyReferenceGroup('shamil', g, ctx({ kind: 'usul', categoryCode: 'USUL_MADD', isFreshDraft: false }))
  assert.equal(plan.categoryCode, undefined)
  assert.deepEqual(plan.pendingSuggestion, { kind: 'usul', categoryCode: 'IMALAH_TAQLIL' })
})

test('on a usul draft with no category yet, the suggested category is applied without changing kind', () => {
  const g = group({ suggestion: { kind: 'usul', categoryCode: 'MADD_BADAL' } })
  const plan = planApplyReferenceGroup('shamil', g, ctx({ kind: 'usul', categoryCode: null, isFreshDraft: false }))
  assert.equal(plan.categoryCode, 'MADD_BADAL')
  assert.equal(plan.kind, undefined)
  assert.equal(plan.pendingSuggestion, null)
})

test('a farsh suggestion never sets a category', () => {
  const plan = planApplyReferenceGroup('shamil', group({ suggestion: { kind: 'farsh', categoryCode: null } }), ctx({ isFreshDraft: true }))
  assert.equal(plan.kind, 'farsh')
  assert.equal(plan.categoryCode, undefined)
  assert.equal(plan.pendingSuggestion, null)
})

test('the plan never mutates its context', () => {
  const narrators = [{ id: 'Q01-R01', action: 'x', wajhOrder: 1, wajhNote: null }]
  const context = ctx({ narrators })
  const before = JSON.stringify(context)
  planApplyReferenceGroup('shamil', group(), context)
  assert.equal(JSON.stringify(context), before)
})
