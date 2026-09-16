import assert from 'node:assert/strict'
import test from 'node:test'

import { QIRAAT_READERS } from './readers.ts'
import { QIRAAT_NARRATORS, narratorsOfReader } from './narrators.ts'
import { QIRAAT_READINGS, getReading } from './readings.ts'
import { readerColor, narratorColor, readerCssVar, narratorCssVar } from './colors.ts'
import { computeAttribution, gradientCss, readingsNotIn } from './attribution.ts'
import { resolveTokenForReading, renderToken, differsFromHafs, tokenKey, ayahKeyOf, variantsForToken } from './engine.ts'
import { BASE_READING } from './types.ts'
import { FixtureQiraatRepository } from './repository.ts'
import { comparisonMarkerForWord, PERFORMANCE_MARKER_COLOR } from '../../src/app/mushaf-1441/_components/qiraat/qiraatWordMarker.ts'
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

test('the page-1 (Al-Fatihah) prototype: multi-reader مالك/ملك variant covers 6 readers, 12 narrators, and never Hafs/Ibn-Amir/Kisai/Khalaf-al-Ashir', () => {
  const repo = new FixtureQiraatRepository()
  // REVIEWED (not VERIFIED) since the pages-1-10 batch (2026-09-16): only reachable via debug mode.
  return repo.getVariantsForPage(1, { includeUnpublished: true }).then((variants) => {
    const malik = variants.find((v) => v.id === 'v-p001-l001-malik-melik')
    assert.ok(malik, 'page 1 must have the مالك/ملك variant')
    // Pages-1-10 batch (2026-09-16): REVIEWED, not VERIFIED — this attribution came from the task
    // prompt's typed data, not an independent PDF check (docs/qiraat/pages-001-010-existing-architecture.md).
    assert.equal(malik.verificationStatus, 'REVIEWED')
    assert.equal(malik.readingIds.length, 12)
    for (const excluded of ['Q05-R01', 'Q05-R02', 'Q07-R01', 'Q07-R02']) {
      assert.ok(!malik.readingIds.includes(excluded), `${excluded} (reads مالك, same as Hafs) must not be duplicated into the variant`)
    }
    const attribution = computeAttribution(malik.readingIds)
    assert.equal(attribution.kind, 'multi-reader')
    assert.equal(attribution.segments.length, 6)

    const remaining = readingsNotIn(malik.readingIds, ALL_READING_IDS)
    assert.equal(remaining.length, 8)
  })
})

test('the page-1 REVIEWED variants (سين/إشمام الصراط) are excluded by default and only appear in debug mode', () => {
  const repo = new FixtureQiraatRepository()
  return repo.getVariantsForPage(1).then(async (defaultVariants) => {
    assert.ok(!defaultVariants.some((v) => v.id.includes('sirat-sin')), 'REVIEWED records must not reach the default (public) view')
    const debugVariants = await repo.getVariantsForPage(1, { includeUnpublished: true })
    assert.ok(debugVariants.some((v) => v.id === 'v-p001-l002-sirat-ishmam'))
    const attribution = computeAttribution(debugVariants.find((v) => v.id === 'v-p001-l002-sirat-ishmam').readingIds)
    assert.equal(attribution.kind, 'reader')
    assert.equal(attribution.readerId, 'Q06')
  })
})

test('tokenKey/ayahKeyOf produce the canonical surah:ayah[:token] identity', () => {
  assert.equal(tokenKey(1, 4, 1), '1:4:1')
  assert.equal(ayahKeyOf(1, 4), '1:4')
})

test('pages-1-10 batch: 2:37 آدم/كلمات multi-word locus resolves as two independent single-token variants sharing one locusId', () => {
  const repo = new FixtureQiraatRepository()
  return repo.getVariantsForPage(6, { includeUnpublished: true }).then((variants) => {
    const adam = variants.find((v) => v.id === 'v-p006-l003-adam-1')
    const kalimat = variants.find((v) => v.id === 'v-p006-l003-kalimat-1')
    assert.ok(adam && kalimat, 'both halves of the 2:37 locus must be present')
    assert.equal(adam.locusId, kalimat.locusId, 'disjoint words of one conceptual locus share a locusId')
    assert.equal(adam.locusType, 'multi_word_variant')
    assert.notEqual(adam.startToken, kalimat.startToken, 'the two targets are different tokens in the same ayah')
    // Each half still resolves independently through the ordinary single-token engine — no special
    // multi-target code path needed in resolveTokenForReading.
    const options = { includeUnpublished: true }
    assert.ok(variantsForToken(variants, 2, 37, adam.startToken, options).some((v) => v.id === adam.id))
    assert.ok(variantsForToken(variants, 2, 37, kalimat.startToken, options).some((v) => v.id === kalimat.id))
  })
})

test('pages-1-10 batch: a performance-only variant keeps variantText === hafsText and carries a performanceNote', () => {
  const repo = new FixtureQiraatRepository()
  return repo.getVariantsForPage(1, { includeUnpublished: true }).then((variants) => {
    const ishmam = variants.find((v) => v.id === 'v-p001-l002-sirat-ishmam')
    assert.ok(ishmam, 'the إشمام performance variant must be present')
    assert.equal(ishmam.variantText, ishmam.hafsText, 'a performance-only difference must not fake a text/spelling change')
    assert.ok(ishmam.performanceNote && ishmam.performanceNote.length > 0, 'performance-only variants must describe the phonetic difference')
  })
})

test('comparison marker: a performance-only variant (no text change) gets the fixed performance color, never a guessed reader/narrator identity color', () => {
  const repo = new FixtureQiraatRepository()
  return repo.getVariantsForPage(1, { includeUnpublished: true }).then((variants) => {
    // 1:6:2 has two competing variants at the same token: a textual one (سين) and a
    // performance-only one (إشمام) — comparisonMarkerForWord with filter 'all' matches both, so
    // scope the check to a reader filter that isolates just the performance-only one (Q06 حمزة).
    const marker = comparisonMarkerForWord(variants, 1, 6, 2, { kind: 'reader', readerId: 'Q06' }, { includeUnpublished: true })
    assert.ok(marker, 'the إشمام performance marker must be present')
    assert.equal(marker.isPerformanceOnly, true)
    assert.equal(marker.color, PERFORMANCE_MARKER_COLOR)
    assert.equal(marker.isGradient, false)

    // A genuine textual variant (مالك/ملك, 1:4:1) must keep the existing reader/narrator identity
    // color scheme — the performance color must never leak into an ordinary spelling difference.
    const textualMarker = comparisonMarkerForWord(variants, 1, 4, 1, { kind: 'all' }, { includeUnpublished: true })
    assert.ok(textualMarker)
    assert.notEqual(textualMarker.color, PERFORMANCE_MARKER_COLOR)
    assert.ok(!textualMarker.isPerformanceOnly)
  })
})

test('pages-1-10 batch: a NEEDS_MANUAL_REVIEW placeholder with no confident attribution never crashes computeAttribution', () => {
  const repo = new FixtureQiraatRepository()
  return repo.getVariantsForPage(4, { includeUnpublished: true }).then((variants) => {
    const shaaAllah = variants.find((v) => v.id === 'v-p004-l001-shaa-allah')
    assert.ok(shaaAllah, 'the 2:20 شاء الله critical-review item must be present')
    assert.equal(shaaAllah.verificationStatus, 'NEEDS_MANUAL_REVIEW')
    assert.equal(shaaAllah.readingIds.length, 0, 'no reader/narrator may be guessed for an unresolved critical item')

    // Never gate visibility on verification status alone: computeAttribution([]) throws, so the
    // view-layer marker builder must special-case the empty-readingIds case (Part 29 placeholders).
    const marker = comparisonMarkerForWord(variants, shaaAllah.surah, shaaAllah.ayah, shaaAllah.startToken, { kind: 'all' }, { includeUnpublished: true })
    assert.ok(marker, 'the placeholder is still surfaced in debug mode so a reviewer can find it')
    assert.equal(marker.unresolved, true)
    assert.notEqual(marker.color, undefined)
  })
})
