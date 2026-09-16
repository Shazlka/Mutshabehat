import assert from 'node:assert/strict'
import test from 'node:test'

import { QIRAAT_READERS } from './readers.ts'
import { QIRAAT_NARRATORS, narratorsOfReader } from './narrators.ts'
import { QIRAAT_READINGS, getReading } from './readings.ts'
import { readerColor, narratorColor, readerCssVar, narratorCssVar } from './colors.ts'
import { computeAttribution, gradientCss, readingsNotIn } from './attribution.ts'
import { resolveTokenForReading, renderToken, differsFromHafs, tokenKey, ayahKeyOf } from './engine.ts'
import { BASE_READING } from './types.ts'
import { FixtureQiraatRepository } from './repository.ts'
import synthetic from './fixtures/synthetic/engine-fixtures.json' with { type: 'json' }

const ALL_READING_IDS = QIRAAT_READINGS.map((reading) => reading.id)
const VARIANTS = synthetic.variants

function findVariant(id) {
  const variant = VARIANTS.find((v) => v.id === id)
  assert.ok(variant, `fixture must contain ${id}`)
  return variant
}

test('exactly 10 readers and 20 narrators/readings, each with its own color', () => {
  assert.equal(QIRAAT_READERS.length, 10)
  assert.equal(QIRAAT_NARRATORS.length, 20)
  assert.equal(QIRAAT_READINGS.length, 20)
  const colors = new Set(QIRAAT_READERS.map((r) => r.color).concat(QIRAAT_NARRATORS.map((n) => n.color)))
  assert.equal(colors.size, 30, 'all 30 reader+narrator colors must be distinct')
})

test('reader/narrator color + css-var mapping is stable and reader-scoped', () => {
  assert.equal(readerColor('Q05'), '#EA580C')
  assert.equal(narratorColor('Q05-R02'), '#C2410C')
  assert.equal(readerCssVar('Q05'), '--q05-asim')
  assert.equal(narratorCssVar('Q05-R02'), '--q05-hafs')
  for (const reader of QIRAAT_READERS) {
    assert.equal(narratorsOfReader(reader.id).length, 2, `${reader.id} must have exactly 2 narrators`)
  }
})

test('baseline is Hafs (Q05-R02) and is never duplicated', () => {
  assert.equal(BASE_READING, 'Q05-R02')
  assert.equal(getReading(BASE_READING).displayNameAr, 'حفص عن عاصم الكوفي')
  assert.equal(QIRAAT_READINGS.filter((r) => r.isBaseline).length, 1)
})

test('the two "الدوري" narrators are distinct people, never conflated', () => {
  const abuAmrDuri = getReading('Q03-R01')
  const kisaiDuri = getReading('Q07-R02')
  assert.notEqual(abuAmrDuri.readerId, kisaiDuri.readerId)
  assert.match(abuAmrDuri.displayNameAr, /أبي عمرو/)
  assert.match(kisaiDuri.displayNameAr, /الكسائي/)

  const forAbuAmr = resolveTokenForReading(VARIANTS, 999, 2, 1, 'SYN-BASE-DURI', 'Q03-R01')
  const forKisai = resolveTokenForReading(VARIANTS, 999, 2, 1, 'SYN-BASE-DURI', 'Q07-R02')
  assert.equal(forAbuAmr.kind, 'variant')
  assert.equal(forKisai.kind, 'variant')
  assert.equal(forAbuAmr.text, 'SYN-DURI-ABI-AMR')
  assert.equal(forKisai.text, 'SYN-DURI-KISAI')
  assert.notEqual(forAbuAmr.text, forKisai.text)
})

test('query priority: exact reading > nothing; never falls back across narrators of the same reader', () => {
  // Warsh (Q01-R02) has the INSERT variant; Qalun (Q01-R01, same reader) must NOT inherit it.
  const warsh = resolveTokenForReading(VARIANTS, 999, 1, 1, 'SYN-BASE', 'Q01-R02')
  const qalun = resolveTokenForReading(VARIANTS, 999, 1, 1, 'SYN-BASE', 'Q01-R01')
  assert.equal(warsh.kind, 'variant')
  assert.equal(qalun.kind, 'base')
  assert.equal(qalun.text, 'SYN-BASE')
})

test('baseline reading (Hafs) never applies a variant even if a record wrongly lists it', () => {
  const resolution = resolveTokenForReading(VARIANTS, 999, 4, 1, 'SYN-BASE4', BASE_READING)
  assert.equal(resolution.kind, 'base')
  assert.equal(resolution.text, 'SYN-BASE4')
})

test('verification-status filtering: EXTRACTED never appears to ordinary users, only in debug mode', () => {
  const forOrdinaryUser = resolveTokenForReading(VARIANTS, 999, 3, 1, 'SYN-BASE3', 'Q01-R01')
  assert.equal(forOrdinaryUser.kind, 'base', 'EXTRACTED must be invisible without includeUnpublished')

  const forDebug = resolveTokenForReading(VARIANTS, 999, 3, 1, 'SYN-BASE3', 'Q01-R01', { includeUnpublished: true })
  assert.equal(forDebug.kind, 'variant')
  assert.equal(forDebug.text, 'SYN-SHOULD-NOT-APPEAR')
})

test('operations: REPLACE/INSERT/DELETE/MERGE/SPLIT/DIACRITIC_CHANGE all resolve as specified', () => {
  assert.equal(resolveTokenForReading(VARIANTS, 999, 1, 1, 'SYN-BASE', 'Q01-R02').text, 'SYN-BASE SYN-EXTRA') // INSERT appends
  assert.equal(resolveTokenForReading(VARIANTS, 999, 1, 2, 'SYN-GONE', 'Q02-R01').text, '') // DELETE
  assert.equal(resolveTokenForReading(VARIANTS, 999, 1, 3, 'SYN-A', 'Q03-R02').text, 'SYN-MERGED') // MERGE at start token
  assert.equal(resolveTokenForReading(VARIANTS, 999, 1, 4, 'SYN-B', 'Q03-R02').kind, 'suppressed') // MERGE tail token
  assert.equal(resolveTokenForReading(VARIANTS, 999, 1, 5, 'SYN-WHOLE', 'Q04-R01').text, 'SYN-PART1 SYN-PART2') // SPLIT
  assert.equal(resolveTokenForReading(VARIANTS, 999, 1, 6, 'SYN-WORD', 'Q05-R01').text, 'SYN-WORD (diacritic)') // DIACRITIC_CHANGE
})

test('renderToken() token-object wrapper matches resolveTokenForReading()', () => {
  const result = renderToken({ surah: 999, ayah: 1, wordIndexInAyah: 1, text: 'SYN-BASE' }, 'Q01-R02', VARIANTS)
  assert.equal(result.kind, 'variant')
  assert.equal(result.text, 'SYN-BASE SYN-EXTRA')
})

test('differsFromHafs: true only when the resolved text actually changed', () => {
  const changed = resolveTokenForReading(VARIANTS, 999, 1, 6, 'SYN-WORD', 'Q05-R01')
  const unchanged = resolveTokenForReading(VARIANTS, 999, 1, 6, 'SYN-WORD', 'Q01-R01')
  assert.equal(differsFromHafs(changed, 'SYN-WORD'), true)
  assert.equal(differsFromHafs(unchanged, 'SYN-WORD'), false)
})

test('attribution: single narrator (Case A) uses the narrator color', () => {
  const attribution = computeAttribution(['Q01-R02'])
  assert.equal(attribution.kind, 'single-narrator')
  assert.equal(attribution.color, narratorColor('Q01-R02'))
})

test('attribution: both narrators of one reader (Case B) uses the parent reader color', () => {
  const attribution = computeAttribution(['Q06-R01', 'Q06-R02'])
  assert.equal(attribution.kind, 'reader')
  assert.equal(attribution.readerId, 'Q06')
  assert.equal(attribution.color, readerColor('Q06'))
})

test('attribution: multiple readers (Case C) builds one segmented marker, one slice per reader', () => {
  const tenReaderVariant = findVariant('syn-ten-reader-segment')
  const attribution = computeAttribution(tenReaderVariant.readingIds)
  assert.equal(attribution.kind, 'multi-reader')
  assert.equal(attribution.segments.length, 10, 'one segment per reader, never per narrator/reading')
  assert.equal(attribution.segments[0].percentFrom, 0)
  assert.equal(attribution.segments[9].percentTo, 100)
  const css = gradientCss(attribution.segments)
  assert.match(css, /^linear-gradient\(to right, /)
})

test('the page-1 (Al-Fatihah) prototype: multi-reader مالك/ملك variant covers 8 readers, 16 narrators, and never Hafs/Shubah/Kisai', () => {
  const repo = new FixtureQiraatRepository()
  return repo.getVariantsForPage(1).then((variants) => {
    const malik = variants.find((v) => v.id === 'v-1-4-1-malik-melik')
    assert.ok(malik, 'page 1 must have the مالك/ملك variant')
    assert.equal(malik.verificationStatus, 'VERIFIED')
    assert.equal(malik.readingIds.length, 16)
    for (const excluded of ['Q05-R01', 'Q05-R02', 'Q07-R01', 'Q07-R02']) {
      assert.ok(!malik.readingIds.includes(excluded), `${excluded} (reads مالك, same as Hafs) must not be duplicated into the variant`)
    }
    const attribution = computeAttribution(malik.readingIds)
    assert.equal(attribution.kind, 'multi-reader')
    assert.equal(attribution.segments.length, 8)

    const remaining = readingsNotIn(malik.readingIds, ALL_READING_IDS)
    assert.equal(remaining.length, 4)
  })
})

test('the page-1 REVIEWED variants (سين حمزة) are excluded by default and only appear in debug mode', () => {
  const repo = new FixtureQiraatRepository()
  return repo.getVariantsForPage(1).then(async (defaultVariants) => {
    assert.ok(!defaultVariants.some((v) => v.id.includes('sirat-hamzah-sin')), 'REVIEWED records must not reach the default (public) view')
    const debugVariants = await repo.getVariantsForPage(1, { includeUnpublished: true })
    assert.ok(debugVariants.some((v) => v.id === 'v-1-6-2-sirat-hamzah-sin'))
    const attribution = computeAttribution(debugVariants.find((v) => v.id === 'v-1-6-2-sirat-hamzah-sin').readingIds)
    assert.equal(attribution.kind, 'reader')
    assert.equal(attribution.readerId, 'Q06')
  })
})

test('tokenKey/ayahKeyOf produce the canonical surah:ayah[:token] identity', () => {
  assert.equal(tokenKey(1, 4, 1), '1:4:1')
  assert.equal(ayahKeyOf(1, 4), '1:4')
})
