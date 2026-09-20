import assert from 'node:assert/strict'
import test from 'node:test'

import { QIRAAT_READERS } from './readers.ts'
import { QIRAAT_NARRATORS, narratorsOfReader } from './narrators.ts'
import { QIRAAT_READINGS, getReading } from './readings.ts'
import { readerColor, narratorColor, readerCssVar, narratorCssVar } from './colors.ts'
import { computeAttribution, gradientCss, readingsNotIn } from './attribution.ts'
import { resolveTokenForReading, renderToken, differsFromHafs, tokenKey, ayahKeyOf, variantsForToken } from './engine.ts'
import { BASE_READING } from './types.ts'
import { GROUP_SYMBOLS, AUTHORITY_SYMBOLS, readingsOfGroupSymbol, resolveAuthoritySymbol } from './symbols.ts'
import { FixtureQiraatRepository } from './repository.ts'
import { comparisonMarkerForWord, rulingMarkerForWord, markerPaintForWord, PERFORMANCE_MARKER_COLOR } from '../../src/app/mushaf-1441/_components/qiraat/qiraatWordMarker.ts'
import synthetic from './fixtures/synthetic/engine-fixtures.json' with { type: 'json' }
import page002Rulings from './fixtures/rulings/page-002.json' with { type: 'json' }
import page266Rulings from './fixtures/rulings/page-266.json' with { type: 'json' }

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

test('page 1: the مالك/ملك variant covers 6 readers / 12 narrators and never duplicates the readers who match Hafs', () => {
  const repo = new FixtureQiraatRepository()
  return repo.getVariantsForPage(1, { includeUnpublished: true }).then((variants) => {
    // Looked up by POSITION, never by a generated record id — ids change whenever the dataset is
    // rebuilt, positions do not.
    const malik = variants.find((v) => v.surah === 1 && v.ayah === 4 && v.startToken === 1)
    assert.ok(malik, 'page 1 must have the مالك/ملك variant')
    assert.equal(malik.verificationStatus, 'REVIEWED')
    assert.equal(malik.readingIds.length, 12)
    // عاصم / الكسائي / يعقوب / خلف العاشر read مالك exactly as the Mushaf prints it, so they must
    // never appear in the variant record.
    for (const excluded of ['Q05-R01', 'Q05-R02', 'Q07-R01', 'Q07-R02', 'Q09-R01', 'Q09-R02', 'Q10-R01', 'Q10-R02']) {
      assert.ok(!malik.readingIds.includes(excluded), `${excluded} reads مالك like Hafs and must not be in the variant`)
    }
    const attribution = computeAttribution(malik.readingIds)
    assert.equal(attribution.kind, 'multi-reader')
    assert.equal(attribution.segments.length, 6)
    assert.equal(readingsNotIn(malik.readingIds, ALL_READING_IDS).length, 8)
  })
})

test('page 1: REVIEWED variants are excluded from the public view and only appear in debug mode', () => {
  const repo = new FixtureQiraatRepository()
  return repo.getVariantsForPage(1).then(async (defaultVariants) => {
    assert.equal(defaultVariants.length, 0, 'nothing in this import has reached VERIFIED, so the public view must be empty')
    const debugVariants = await repo.getVariantsForPage(1, { includeUnpublished: true })
    assert.ok(debugVariants.length > 0, 'debug mode surfaces the REVIEWED records for review')
    const ishmam = debugVariants.find((v) => v.ayah === 6 && v.performanceNote?.includes('إشمام'))
    assert.ok(ishmam, 'the إشمام الصاد زايًا reading must be present at 1:6')
    const attribution = computeAttribution(ishmam.readingIds)
    assert.equal(attribution.kind, 'reader')
    assert.equal(attribution.readerId, 'Q06', 'حمزة (both narrators) reads الصراط with إشمام at 1:6')
  })
})

test('tokenKey/ayahKeyOf produce the canonical surah:ayah[:token] identity', () => {
  assert.equal(tokenKey(1, 4, 1), '1:4:1')
  assert.equal(ayahKeyOf(1, 4), '1:4')
})

test('2:37 آدم/كلمات: one conceptual locus spanning two disjoint words shares a locusId but resolves independently', () => {
  const repo = new FixtureQiraatRepository()
  return repo.getVariantsForPage(6, { includeUnpublished: true }).then((variants) => {
    const group = variants.filter((v) => v.locusId === 'L006-ADAM-KALIMAT')
    assert.equal(group.length, 2, 'both halves of the 2:37 locus must be present')
    const [adam, kalimat] = group.sort((a, b) => a.startToken - b.startToken)
    assert.equal(adam.ayah, 37)
    assert.equal(kalimat.ayah, 37)
    assert.equal(adam.locusType, 'multi_word_variant')
    assert.notEqual(adam.startToken, kalimat.startToken, 'the two targets are different tokens in the same ayah')
    // ابن كثير is the one reader who differs, and he differs at BOTH tokens — that is not a
    // double-claim, it is one grammatical swap (رفع آدم/نصب كلمات becomes نصب آدم/رفع كلمات).
    assert.deepEqual(adam.readingIds, kalimat.readingIds)
    const options = { includeUnpublished: true }
    assert.ok(variantsForToken(variants, 2, 37, adam.startToken, options).some((v) => v.id === adam.id))
    assert.ok(variantsForToken(variants, 2, 37, kalimat.startToken, options).some((v) => v.id === kalimat.id))
  })
})

test('a performance-only variant keeps variantText === hafsText and carries a performanceNote', () => {
  const repo = new FixtureQiraatRepository()
  return repo.getVariantsForPage(1, { includeUnpublished: true }).then((variants) => {
    const ishmam = variants.find((v) => v.performanceNote?.includes('إشمام'))
    assert.ok(ishmam, 'the إشمام performance variant must be present')
    assert.equal(ishmam.variantText, ishmam.hafsText, 'a performance-only difference must never fake a spelling change')
    assert.equal(ishmam.locusType, 'performance_variant')
    assert.ok(ishmam.performanceNote.length > 0)
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

test('multi-reader marker paint preserves its gradient for Mushaf text instead of falling back to ink', () => {
  const marker = comparisonMarkerForWord(
    [{
      id: 'synthetic-multi-reader', surah: 999, ayah: 11, startToken: 1, endToken: 1,
      operation: 'REPLACE', hafsText: 'SYN-BASE', variantText: 'SYN-VARIANT', differenceType: 'LETTER',
      verificationStatus: 'REVIEWED', createdAt: '', updatedAt: '',
      readingIds: ['Q01-R01', 'Q02-R01'],
    }],
    999, 11, 1, { kind: 'all' }, { includeUnpublished: true },
  )
  assert.ok(marker?.isGradient, 'two readers must produce a segmented gradient marker')
  const paint = markerPaintForWord(marker)
  assert.match(paint.backgroundImage ?? '', /^linear-gradient\(/)
  assert.equal(paint.WebkitBackgroundClip, 'text')
  assert.equal(paint.WebkitTextFillColor, 'transparent')
})

test('a record with no confident attribution never crashes the marker builder (computeAttribution([]) throws)', () => {
  // Constructed, not read from the fixtures: the guard must hold for ANY such record, including
  // ones a future import introduces. computeAttribution([]) throws by design, so the view layer
  // has to special-case it rather than guessing a reader colour.
  const placeholder = {
    id: 'synthetic-unresolved', surah: 2, ayah: 20, startToken: 1, endToken: 1,
    operation: 'REPLACE', hafsText: 'شَآءَ', variantText: 'شَآءَ', differenceType: 'OTHER',
    verificationStatus: 'NEEDS_MANUAL_REVIEW', createdAt: '', updatedAt: '', readingIds: [],
  }
  assert.throws(() => computeAttribution([]), 'computeAttribution must still reject an empty set')
  const marker = comparisonMarkerForWord([placeholder], 2, 20, 1, { kind: 'all' }, { includeUnpublished: true })
  assert.ok(marker, 'the placeholder is still surfaced in debug mode so a reviewer can find it')
  assert.equal(marker.unresolved, true)
  assert.notEqual(marker.color, undefined)
})

test('pages 1-20: every record is REVIEWED, or NEEDS_MANUAL_REVIEW with the defect documented in notes', () => {
  const repo = new FixtureQiraatRepository()
  const pages = Array.from({ length: 20 }, (_, i) => i + 1)
  return Promise.all(pages.map((page) => repo.getVariantsForPage(page, { includeUnpublished: true }))).then((loaded) => {
    const all = loaded.flat()
    assert.ok(all.length > 0, 'pages 1-20 must actually be wired into the repository')
    let flagged = 0
    for (const variant of all) {
      assert.ok(
        variant.verificationStatus === 'REVIEWED' || variant.verificationStatus === 'NEEDS_MANUAL_REVIEW',
        `${variant.id}: nothing in this import may claim VERIFIED — it has not been checked against the paper original`,
      )
      if (variant.verificationStatus === 'NEEDS_MANUAL_REVIEW') {
        flagged++
        continue
      }
      assert.ok(variant.readingIds.length > 0, `${variant.id} is REVIEWED, so it must carry a real attribution`)
      assert.ok(variant.sources?.length > 0, `${variant.id} must cite its source page`)
    }
    // The three loci where the supplied extraction contradicts itself or drops a reader
    // (2:83 تعبدون, 2:93 قلوبهم العجل, 2:105 ينزل) must stay flagged, never silently promoted.
    assert.ok(flagged >= 3, 'the known source defects must remain flagged')
  })
})

test('2:97-98 جبريل: both occurrences share one display locus and keep their real (different) prefixes', () => {
  const repo = new FixtureQiraatRepository()
  return repo.getVariantsForPage(15, { includeUnpublished: true }).then((variants) => {
    const group = variants.filter((v) => v.locusId === 'L015-JIBRIL')
    const at97 = group.filter((v) => v.ayah === 97)
    const at98 = group.filter((v) => v.ayah === 98)
    assert.ok(at97.length > 0 && at98.length > 0, 'both ayah occurrences of جبريل must be present')
    assert.equal(at97.length, at98.length, 'the same three non-baseline أوجه apply at both occurrences')
    // hafsText comes VERBATIM from the Mushaf fixture, so the two occurrences keep their real and
    // different prefixes (لِّ... vs وَ...) instead of a hand-typed stem.
    // Compare the BASE LETTER only. The fixture stores shadda before kasra; typing "لِّ" here by
    // hand produces the opposite combining order and would fail against identical text — the exact
    // diacritic-ordering trap this dataset is built to avoid.
    assert.equal(at97[0].hafsText[0], 'ل', 'the 2:97 occurrence keeps its لِّ prefix from the fixture')
    assert.equal(at98[0].hafsText[0], 'و', 'the 2:98 occurrence keeps its وَ prefix from the fixture')
    assert.notEqual(at97[0].hafsText, at98[0].hafsText)

    const mikal = variants.find((v) => v.ayah === 98 && v.hafsText.includes('مِيكَىٰلَ'))
    assert.ok(mikal, 'ميكال must be anchored to the real fixture token')
    const hamzaSpelling = variants.filter((v) => v.ayah === 98 && v.variantText.includes('ئِيلَ'))
    assert.ok(hamzaSpelling.length > 0, 'the همز+ياء spelling must be present')
  })
})

test('page-1 rules (عد الآي/الإدغام الكبير/أوجه الوصل بين السورتين/مد قبل الإدغام) are a separate domain from QiraatVariant and never guess reader attribution for an ayah-counting-school rule', () => {
  const repo = new FixtureQiraatRepository()
  return repo.getRulesForPage(1, { includeUnpublished: true }).then((rules) => {
    assert.equal(rules.length, 8, 'all 8 page-1 RULES_TABLE_REGION entries must be present')
    for (const rule of rules) assert.equal(rule.verificationStatus, 'REVIEWED')

    const ayatCount = rules.find((r) => r.id === 'r-p001-r001-ayat-count-basmalah')
    assert.ok(ayatCount, 'the عد الآي بسملة rule must be present')
    assert.equal(ayatCount.readingIds, undefined, 'an ayah-counting-school rule (المكي/الكوفي) must never be force-fit into the 20-reading readingIds taxonomy')
    assert.ok(ayatCount.attributionLabel && ayatCount.attributionLabel.includes('المكي'), 'its attribution must be free text naming the counting school instead')

    const idghamKabir = rules.find((r) => r.id === 'r-p001-r003-idgham-kabir')
    assert.ok(idghamKabir)
    assert.deepEqual(idghamKabir.readingIds, ['Q03-R02'], 'السوسي عن أبي عمرو resolves onto the real reading taxonomy, unlike the عد الآي rules above')

    // The four أوجه بين السورتين rules (بسملة / وصل / سكت أو وصل / سكت أو وصل أو بسملة) must
    // partition the full 20-reading set exactly once — this is what confirms bare "خلف" in the
    // وصل rule means the reader خلف العاشر (Q10), not the narrator خلف عن حمزة (Q06-R01): any other
    // resolution would over- or under-count instead of summing to exactly 20 with no overlap.
    const waslRules = rules.filter((r) => r.category === 'الأوجه بين السورتين')
    assert.equal(waslRules.length, 4)
    const allWaslIds = waslRules.flatMap((r) => r.readingIds ?? [])
    assert.equal(allWaslIds.length, 20)
    assert.equal(new Set(allWaslIds).size, 20, 'no reading may be attributed to more than one of the four أوجه بين السورتين rules')

    const maddOptions = rules.find((r) => r.id === 'r-p001-r008-madd-before-idgham')
    assert.ok(maddOptions)
    assert.deepEqual(maddOptions.options, ['القصر', 'التوسط', 'الإشباع'])
    assert.equal(maddOptions.readingIds, undefined, 'an unattributed enumerated-options rule must carry no reader attribution at all')
  })
})

test('when filtering by reader or narrator, comparisonMarkerForWord only marks what belongs to him with his color', async () => {
  const repo = new FixtureQiraatRepository()
  const variants = await repo.getVariantsForPage(1, { includeUnpublished: true })

  // 1:4:1 (مالك/ملك): 6 readers read ملك (Nafi Q01, Ibn Kathir Q02, Abu Amr Q03, Ibn Amir Q04, Abu Ja'far Q08, Ya'qub Q09).
  // When filter is 'all', it produces a multi-reader gradient:
  const allMarker = comparisonMarkerForWord(variants, 1, 4, 1, { kind: 'all' }, { includeUnpublished: true })
  assert.ok(allMarker)
  assert.equal(allMarker.isGradient, true)

  // When filtered by Reader Nafi (Q01), it MUST return Nafi's solid reader color, never a multi-reader gradient:
  const nafiMarker = comparisonMarkerForWord(variants, 1, 4, 1, { kind: 'reader', readerId: 'Q01' }, { includeUnpublished: true })
  assert.ok(nafiMarker)
  assert.equal(nafiMarker.isGradient, false)
  assert.equal(nafiMarker.color, readerColor('Q01'))

  // When filtered by Narrator Warsh (Q01-R02), it MUST return Warsh's solid narrator color:
  const warshMarker = comparisonMarkerForWord(variants, 1, 4, 1, { kind: 'reading', readingId: 'Q01-R02' }, { includeUnpublished: true })
  assert.ok(warshMarker)
  assert.equal(warshMarker.isGradient, false)
  assert.equal(warshMarker.color, narratorColor('Q01-R02'))

  // When filtered by Reader Asim (Q05), who reads the baseline (مالك) and does not differ:
  // It MUST return null — nothing colored or marked for Asim!
  const asimMarker = comparisonMarkerForWord(variants, 1, 4, 1, { kind: 'reader', readerId: 'Q05' }, { includeUnpublished: true })
  assert.equal(asimMarker, null, 'word must not be marked or colored when it does not differ for this reader')

  // When filtered by Narrator Hafs (Q05-R02):
  const hafsMarker = comparisonMarkerForWord(variants, 1, 4, 1, { kind: 'reading', readingId: 'Q05-R02' }, { includeUnpublished: true })
  assert.equal(hafsMarker, null, 'word must not be marked or colored for Hafs baseline')
})

test('when filtering by reader or narrator, rulingMarkerForWord only marks and colors usul rulings related to him', () => {
  // On Page 2, 2:2:5 (فيه): صلة هاء الكناية belongs exclusively to Ibn Kathir (Q02, Al-Bazzi Q02-R01 & Qunbul Q02-R02).
  const allSilat = rulingMarkerForWord(page002Rulings, 2, 2, 5, { kind: 'all' })
  assert.ok(allSilat)

  // Reader filter Ibn Kathir matches:
  const ibnKathirSilat = rulingMarkerForWord(page002Rulings, 2, 2, 5, { kind: 'reader', readerId: 'Q02' })
  assert.ok(ibnKathirSilat)
  assert.equal(ibnKathirSilat.color, '#0D9488')

  // Reader filter Nafi (Q01) must return null:
  const nafiSilat = rulingMarkerForWord(page002Rulings, 2, 2, 5, { kind: 'reader', readerId: 'Q01' })
  assert.equal(nafiSilat, null, 'Nafi must not see or color Ibn Kathir usul ruling')

  // Narrator filter Warsh (Q01-R02) must return null:
  const warshSilat = rulingMarkerForWord(page002Rulings, 2, 2, 5, { kind: 'reading', readingId: 'Q01-R02' })
  assert.equal(warshSilat, null, 'Warsh must not see or color Ibn Kathir usul ruling')

  // On Page 2, 2:4:10 (وبالآخرة): ترقيق الراءات belongs exclusively to Warsh (Q01-R02).
  // Reader filter Nafi (Q01) matches (Warsh is a narrator of Nafi):
  const nafiTarqiq = rulingMarkerForWord(page002Rulings, 2, 4, 10, { kind: 'reader', readerId: 'Q01' })
  assert.ok(nafiTarqiq)

  // Narrator filter Warsh (Q01-R02) matches:
  const warshTarqiq = rulingMarkerForWord(page002Rulings, 2, 4, 10, { kind: 'reading', readingId: 'Q01-R02' })
  assert.ok(warshTarqiq)

  // Narrator filter Qalun (Q01-R01) must return null:
  const qalunTarqiq = rulingMarkerForWord(page002Rulings, 2, 4, 10, { kind: 'reading', readingId: 'Q01-R01' })
  assert.equal(qalunTarqiq, null, 'Qalun must not see or color Warsh-only tarqiq ruling')

  // Reader filter Asim (Q05) must return null:
  const asimTarqiq = rulingMarkerForWord(page002Rulings, 2, 4, 10, { kind: 'reader', readerId: 'Q05' })
  assert.equal(asimTarqiq, null, 'Asim must not see or color Warsh tarqiq ruling')
})

test('page 266 carries the supplied Al-Hijr colour coverage for 15:82 and 15:87', async () => {
  const repo = new FixtureQiraatRepository()
  const variants = await repo.getVariantsForPage(266, { includeUnpublished: true })

  assert.ok(
    variants.some((variant) => variant.ayah === 82 && variant.hafsText.includes('بُيُوتًا')),
    '15:82 بُيُوتًا must be a loadable reader-specific comparison locus',
  )
  assert.ok(
    variants.some((variant) => variant.ayah === 87 && variant.hafsText.includes('ٱلْقُرْءَانَ')),
    '15:87 ٱلْقُرْءَانَ must be a loadable reader-specific comparison locus',
  )
  assert.ok(
    page266Rulings.some((rule) => rule.ayah === 82 && rule.category === 'MADD_BADAL'),
    '15:82 آمِنِينَ must retain its Warsh-specific colour marker alongside the comparison locus',
  )
})


// ── رموز الشاطبية والدرة ──────────────────────────────────────────────────────
// The reference prints its own عدد الروايات for every group symbol. These tests treat that column
// as a checksum against the app's authority model: if a group was mis-transcribed, the count and
// the expansion disagree and the build fails rather than teaching the reader wrongly.
test('every group symbol expands to exactly the reading count its source prints', () => {
  for (const symbol of GROUP_SYMBOLS) {
    const readings = readingsOfGroupSymbol(symbol)
    assert.equal(readings.length, symbol.readingCountInSource,
      `${symbol.symbol}: expanded to ${readings.length} riwayat but the source says ${symbol.readingCountInSource}`)
    assert.equal(new Set(readings).size, readings.length, `${symbol.symbol}: duplicate riwayah in the expansion`)
    for (const r of readings) assert.ok(ALL_READING_IDS.includes(r), `${symbol.symbol}: unknown reading ${r}`)
  }
})

test('page 303 imports only token-backed, explicitly attributable source variants', async () => {
  const repo = new FixtureQiraatRepository()
  const variants = await repo.getVariantsForPage(303, { includeUnpublished: true })
  assert.equal(variants.length, 5)
  assert.deepEqual(
    variants.map(({ surah, ayah, variantText }) => `${surah}:${ayah}:${variantText}`),
    [
      '18:86:حَامِيَةٍ',
      '18:88:يُسُرًا',
      '18:95:مَكَّنَنِي',
      '18:96:ائْتُونِي',
      '18:97:اسْطَّاعُوا',
    ],
  )
  assert.equal((await repo.getVariantsForPage(303)).length, 0, 'REVIEWED records remain hidden from the ordinary view')

  const hamiah = variants.find((variant) => variant.ayah === 86)
  assert.ok(hamiah)
  assert.equal(hamiah.hafsText, 'حَمِئَةٍۢ')
  assert.deepEqual(hamiah.readingIds, ['Q04-R01', 'Q04-R02', 'Q05-R01', 'Q06-R01', 'Q06-R02', 'Q07-R01', 'Q07-R02', 'Q08-R01', 'Q08-R02', 'Q10-R01', 'Q10-R02'])
  assert.ok(hamiah.sources?.[0]?.sourceText?.includes('حَامِيَةٍ'), 'keep the exact source row with the token-backed variant')
  assert.deepEqual(
    resolveTokenForReading(variants, 18, 86, 10, hamiah.hafsText, 'Q06-R01', { includeUnpublished: true }),
    { kind: 'variant', text: 'حَامِيَةٍ', variant: hamiah },
  )

  const ituni = variants.find((variant) => variant.ayah === 96)
  assert.ok(ituni)
  assert.deepEqual(ituni.readingIds, ['Q05-R01', 'Q06-R01', 'Q06-R02'])
  assert.ok(ituni.sources?.some((source) => source.sourceName.startsWith('Quranpedia official Qiraat dump')))
  for (const readingId of ['Q06-R01', 'Q06-R02']) {
    assert.deepEqual(
      resolveTokenForReading(variants, 18, 96, 1, ituni.hafsText, readingId, { includeUnpublished: true }),
      { kind: 'variant', text: 'ائْتُونِي', variant: ituni },
    )
  }
})

test('صحبة carries شعبة and صحاب carries حفص — never the other way round', () => {
  const sohba = readingsOfGroupSymbol(GROUP_SYMBOLS.find((s) => s.symbol === 'صَحْبَة'))
  const sihab = readingsOfGroupSymbol(GROUP_SYMBOLS.find((s) => s.symbol === 'صِحَاب'))
  assert.ok(sohba.includes('Q05-R01') && !sohba.includes('Q05-R02'))
  assert.ok(sihab.includes('Q05-R02') && !sihab.includes('Q05-R01'))
  // Both share الأخوان, and neither may quietly acquire خلف العاشر (a Durrah reader).
  for (const group of [sohba, sihab]) {
    for (const r of ['Q06-R01', 'Q06-R02', 'Q07-R01', 'Q07-R02']) assert.ok(group.includes(r))
    assert.ok(!group.includes('Q10-R01') && !group.includes('Q10-R02'))
  }
})

test('خ is the seven minus نافع, so it never contains a Nafi riwayah', () => {
  const kha = readingsOfGroupSymbol(GROUP_SYMBOLS.find((s) => s.symbol === 'خ'))
  assert.equal(kha.length, 12)
  assert.ok(!kha.includes('Q01-R01') && !kha.includes('Q01-R02'))
})

test('the same letter resolves to different people in each matn, and never without one', () => {
  // أ: نافع in the Shatibiyyah, أبو جعفر in the Durrah.
  assert.equal(resolveAuthoritySymbol('shatibiyyah', 'أ').readerId, 'Q01')
  assert.equal(resolveAuthoritySymbol('durrah', 'أ').readerId, 'Q08')
  // ض: the narrator خلف عن حمزة there, إسحاق عن خلف العاشر here — the exact collision the
  // project's Q-ID space exists to keep apart.
  assert.equal(resolveAuthoritySymbol('shatibiyyah', 'ض').narratorId, 'Q06-R01')
  assert.equal(resolveAuthoritySymbol('durrah', 'ض').narratorId, 'Q10-R01')
  // A letter that belongs to the other matn does not resolve.
  assert.equal(resolveAuthoritySymbol('durrah', 'ن'), undefined)
})

test('the symbol tables cover every reader and narrator the app knows', () => {
  const covered = new Set(AUTHORITY_SYMBOLS.flatMap((a) => [a.readerId, a.narratorId].filter(Boolean)))
  for (const reader of QIRAAT_READERS) assert.ok(covered.has(reader.id), `no symbol for ${reader.id}`)
  for (const narrator of QIRAAT_NARRATORS) assert.ok(covered.has(narrator.id), `no symbol for ${narrator.id}`)
  // 10 readers + 20 narrators, each once.
  assert.equal(AUTHORITY_SYMBOLS.length, 30)
})
