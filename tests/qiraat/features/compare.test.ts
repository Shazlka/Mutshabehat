import assert from 'node:assert/strict'
import test from 'node:test'
import { compare, defaultLocus, defaultPair, loci, readingOf, usulGroups } from '../../../packages/qiraat-core/features/compare'
import type { QiraatRuling, QiraatVariant } from '../../../packages/qiraat-core/types'

function variant(id: string, readingIds: string[], over: Partial<QiraatVariant> = {}): QiraatVariant {
  return {
    id, surah: 2, ayah: 5, startToken: 3, endToken: 3, operation: 'REPLACE', hafsText: 'الأصل', variantText: 'البدل',
    differenceType: 'HARAKAH', verificationStatus: 'REVIEWED', createdAt: '', updatedAt: '', readingIds: readingIds as never, ...over,
  }
}
function ruling(id: string, category: string, attribution: { authorityId: string; action: string; wajhOrder?: number; condition?: string }[], over: Partial<QiraatRuling> = {}): QiraatRuling {
  return {
    id, pageNumber: 1, category, categoryAr: `باب ${category}`, color: '#123456', wordAnchored: true, surah: 2, ayah: 5,
    startToken: 3, endToken: 3, endAyah: 5, baseText: 'الأصل', verificationStatus: 'REVIEWED', attribution, readings: [],
    hasAlternate: false, createdAt: '', updatedAt: '', ...over,
  }
}
const sel = (variants: QiraatVariant[] = [], rulings: QiraatRuling[] = []) => ({ variants, rulings })
const WORD = 'الكلمة'

// Ported from apps/ios MushafCore QiraatCompareTests.swift.
test('loci separates exact spans and orders them by position', () => {
  const result = loci(sel(
    [variant('a', ['Q01-R01'], { startToken: 5, endToken: 5 }), variant('b', ['Q01-R01'], { startToken: 3, endToken: 4 })],
    [ruling('r', 'SAKT', [], { startToken: 3, endToken: 3 })],
  ))
  assert.deepEqual(result.map((l) => `${l.startToken}-${l.endToken}`), ['3-3', '3-4', '5-5'])
})

test('defaultLocus prefers the word itself with a variant, then any variant, then the word itself, then the first', () => {
  const a = variant('a', ['Q01-R01'], { startToken: 2, endToken: 3 })
  const b = variant('b', ['Q01-R01'], { startToken: 3, endToken: 3 })
  const r = ruling('r', 'SAKT', [], { startToken: 1, endToken: 3 })
  const all = loci(sel([a, b], [r]))
  assert.equal(defaultLocus(all, { surah: 2, ayah: 5, token: 3 })?.startToken, 3)
  assert.equal(defaultLocus(loci(sel([a], [r])), { surah: 2, ayah: 5, token: 3 })?.startToken, 2)
  const own = ruling('own', 'SAKT', [], { startToken: 3, endToken: 3 })
  assert.equal(defaultLocus(loci(sel([], [r, own])), { surah: 2, ayah: 5, token: 3 })?.endToken, 3)
  assert.equal(defaultLocus(loci(sel([], [r])), { surah: 2, ayah: 5, token: 9 })?.startToken, 1)
  assert.equal(defaultLocus([], { surah: 2, ayah: 5, token: 3 }), null)
})

test('a narrator named by a variant reads that variant; a narrator not named reads the Mushaf text', () => {
  const [locus] = loci(sel([variant('v', ['Q01-R02'])]))
  const warsh = readingOf('Q01-R02', locus, WORD)
  assert.equal(warsh.voices.length, 1)
  assert.deepEqual(warsh.voices[0].content.wajhs, [{ text: 'البدل', note: undefined, source: { kind: 'variant' } }])
  const qalun = readingOf('Q01-R01', locus, WORD)
  assert.deepEqual(qalun.voices[0].content.wajhs, [{ text: 'الأصل', note: undefined, source: { kind: 'base', sameAsHafs: true } }])
})

test('the base is «كحفص» only when Hafs has no recorded variant here', () => {
  const [locus] = loci(sel([variant('v', ['Q01-R02', 'Q05-R02'])]))
  const base = readingOf('Q02-R01', locus, WORD).voices[0].content.wajhs[0]
  assert.deepEqual(base.source, { kind: 'base', sameAsHafs: false })
})

test('a performance-only variant shows the Mushaf text with its note; uthmaniText wins when present', () => {
  const perf = variant('p', ['Q01-R02'], { variantText: 'الأصل', performanceNote: 'إشمام' })
  const [l1] = loci(sel([perf]))
  assert.deepEqual(readingOf('Q01-R02', l1, WORD).voices[0].content.wajhs[0], { text: 'الأصل', note: 'إشمام', source: { kind: 'variant' } })
  const [l2] = loci(sel([variant('u', ['Q01-R02'], { uthmaniText: 'عُثْمانِي' })]))
  assert.equal(readingOf('Q01-R02', l2, WORD).voices[0].content.wajhs[0].text, 'عُثْمانِي')
})

test('the same reading recorded twice is one wajh', () => {
  const [locus] = loci(sel([variant('a', ['Q01-R02']), variant('b', ['Q01-R02'])]))
  assert.equal(readingOf('Q01-R02', locus, WORD).voices[0].content.wajhs.length, 1)
})

test('a reader stands for his narrators when they read alike, and shows both when they differ', () => {
  const [alike] = loci(sel([variant('v', ['Q01-R01', 'Q01-R02'])]))
  const merged = readingOf('Q01', alike, WORD)
  assert.equal(merged.voices.length, 1)
  assert.equal(merged.voices[0].name, 'الإمام نافع')
  assert.equal(merged.voices[0].kind, 'reader')
  assert.deepEqual(merged.voices[0].narratorIds, ['Q01-R01', 'Q01-R02'])
  const [differ] = loci(sel([variant('v', ['Q01-R02'])]))
  const split = readingOf('Q01', differ, WORD)
  assert.deepEqual(split.voices.map((v) => v.authorityId), ['Q01-R01', 'Q01-R02'])
  assert.ok(split.voices.every((v) => v.kind === 'narrator'))
})

test('an id the catalogue does not know has no voices', () => {
  const [locus] = loci(sel([variant('v', ['Q01-R02'])]))
  assert.deepEqual(readingOf('nobody', locus, WORD).voices, [])
})

test('two «الدوري» narrators and «خلف» never get the same name or a bare one', () => {
  const [locus] = loci(sel([variant('v', ['Q03-R01', 'Q07-R02', 'Q06-R01'])]))
  const names = ['Q03-R01', 'Q07-R02', 'Q06-R01'].map((id) => readingOf(id, locus, WORD).voices[0].name)
  assert.equal(new Set(names).size, 3)
  assert.ok(names.every((n) => !['الراوي الدوري', 'الراوي خلف'].includes(n)))
  assert.equal(readingOf('Q10', locus, WORD).voices[0].name, 'الإمام خلف العاشر')
})

test('rulings of one category and locus combine into one group that keeps every row id', () => {
  const groups = usulGroups(sel([], [ruling('a', 'SAKT', []), ruling('b', 'SAKT', []), ruling('c', 'IKHFA', [])]))
  assert.deepEqual(groups.map((g) => [g.category, g.rulings.map((r) => r.id)]), [['SAKT', ['a', 'b']], ['IKHFA', ['c']]])
})

test('usul: recorded entries are ordered by wajh, de-duplicated, and a reader row applies to its narrators', () => {
  const [locus] = loci(sel([], [
    ruling('a', 'IMALAH', [
      { authorityId: 'Q01', action: 'تقليل', wajhOrder: 2 },
      { authorityId: 'Q01-R02', action: 'فتح', wajhOrder: 1 },
      { authorityId: 'Q01', action: 'تقليل', wajhOrder: 2 },
    ]),
  ]))
  const warsh = readingOf('Q01-R02', locus, WORD).voices[0].content.usul[0]
  assert.equal(warsh.status.kind, 'entries')
  if (warsh.status.kind === 'entries') assert.deepEqual(warsh.status.entries.map((e) => e.action), ['فتح', 'تقليل'])
  const qalun = readingOf('Q01-R01', locus, WORD).voices[0].content.usul[0]
  if (qalun.status.kind === 'entries') assert.deepEqual(qalun.status.entries.map((e) => e.action), ['تقليل'])
  else assert.fail('qalun should be named through the reader row')
})

test('usul: an authority the ruling does not name stays on the base; «كحفص» only when Hafs is not named', () => {
  const [locus] = loci(sel([], [ruling('a', 'SAKT', [{ authorityId: 'Q02', action: 'سكت' }])]))
  const other = readingOf('Q03-R02', locus, WORD).voices[0].content.usul[0]
  assert.deepEqual(other.status, { kind: 'base', sameAsHafs: true })
  const [withHafs] = loci(sel([], [ruling('a', 'SAKT', [{ authorityId: 'Q02', action: 'سكت' }, { authorityId: 'Q05-R02', action: 'سكت' }])]))
  assert.deepEqual(readingOf('Q03-R02', withHafs, WORD).voices[0].content.usul[0].status, { kind: 'base', sameAsHafs: false })
})

test('a ruling with no attribution rows falls back to its readings', () => {
  const r = ruling('a', 'SAKT', [])
  r.readings = [{ readingId: 'Q02-R01' as never, action: 'سكت', isDefault: true }]
  const [locus] = loci(sel([], [r]))
  assert.equal(readingOf('Q02-R01', locus, WORD).voices[0].content.usul[0].status.kind, 'entries')
})

test('compare: equal contents are the same, different contents are not, an unknown id is never the same', () => {
  const [locus] = loci(sel([variant('v', ['Q01-R02'])]))
  assert.equal(compare('Q01-R01', 'Q02-R01', locus, WORD).isSame, true)
  assert.equal(compare('Q01-R01', 'Q01-R02', locus, WORD).isSame, false)
  assert.equal(compare('nobody', 'nobody', locus, WORD).isSame, false)
})

test('defaultPair is Hafs and the first other authority the data names, or null', () => {
  assert.deepEqual(defaultPair(sel([variant('v', ['Q05-R02', 'Q01-R02'])])), ['Q05-R02', 'Q01-R02'])
  assert.deepEqual(defaultPair(sel([], [ruling('r', 'SAKT', [{ authorityId: 'Q05', action: 'x' }, { authorityId: 'Q02', action: 'x' }])])), ['Q05-R02', 'Q02'])
  assert.equal(defaultPair(sel([variant('v', ['Q05-R02'])])), null)
  assert.equal(defaultPair(sel()), null)
})

test('a ruling that starts in an earlier ayah is its own locus', () => {
  const across = ruling('x', 'IDGHAM_KABIR', [{ authorityId: 'Q03', action: 'إدغام' }], { ayah: 4, startToken: 9, endAyah: 5, endToken: 1 })
  const all = loci(sel([variant('v', ['Q01-R02'])], [across]))
  assert.deepEqual(all.map((l) => `${l.ayah}:${l.startToken}-${l.endAyah}:${l.endToken}`), ['4:9-5:1', '5:3-5:3'])
})

test('a reader-level ruling row reads the same for both narrators, so the reader is one column', () => {
  const [locus] = loci(sel([], [ruling('a', 'SAKT', [{ authorityId: 'Q02', action: 'سكت' }])]))
  const reading = readingOf('Q02', locus, WORD)
  assert.equal(reading.voices.length, 1)
  assert.equal(reading.voices[0].kind, 'reader')
})

test('an entry without its own condition takes the ruling\'s condition', () => {
  const [locus] = loci(sel([], [ruling('a', 'SAKT', [{ authorityId: 'Q01-R02', action: 'سكت' }], { condition: 'وقفًا' })]))
  const status = readingOf('Q01-R02', locus, WORD).voices[0].content.usul[0].status
  assert.equal(status.kind === 'entries' && status.entries[0].condition, 'وقفًا')
})

test('comparing a reading with itself is the same', () => {
  const [locus] = loci(sel([variant('v', ['Q01-R02'])]))
  assert.equal(compare('Q01-R02', 'Q01-R02', locus, WORD).isSame, true)
})
