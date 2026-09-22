#!/usr/bin/env tsx
/**
 * Corpus-wide frontend contract audit for fixture-backed Qira'at.
 *
 * This is deliberately read-only. It runs every available page fixture through
 * the exact view-layer marker functions used by Mushaf1441Viewer, checking that
 * each documented variant/ruling is visible to its reader and narrator, hidden
 * from unrelated narrators, and retained at every contextual-span endpoint.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { QIRAAT_READINGS } from '../../packages/qiraat-core/readings'
import type { QiraatRuling, QiraatVariant, ReadingId } from '../../packages/qiraat-core/types'
import {
  comparisonMarkerForWord,
  rulingMarkerForWord,
} from '../../src/app/mushaf-1441/_components/qiraat/qiraatWordMarker'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const fixtureDir = path.join(root, 'packages/qiraat-core/fixtures')
const readingIds = QIRAAT_READINGS.map((reading) => reading.id)

function pageNumbers(kind: 'pages' | 'rulings'): number[] {
  return fs.readdirSync(path.join(fixtureDir, kind))
    .flatMap((file) => {
      const match = /^page-(\d{3})\.json$/.exec(file)
      return match ? [Number(match[1])] : []
    })
    .sort((a, b) => a - b)
}

function fixture<T>(kind: 'pages' | 'rulings', page: number): T[] {
  const filename = path.join(fixtureDir, kind, `page-${String(page).padStart(3, '0')}.json`)
  return JSON.parse(fs.readFileSync(filename, 'utf8')) as T[]
}

interface MushafWordFixture {
  surahNumber: number
  ayahNumber: number
  wordIndexInAyah: number
  charTypeName?: string
}

function wordsForPage(page: number): MushafWordFixture[] {
  const filename = path.join(root, 'packages/quran-data/mushaf1441/fixtures/page-words', `page-${String(page).padStart(3, '0')}.json`)
  const payload = JSON.parse(fs.readFileSync(filename, 'utf8')) as { lines: Array<{ words: MushafWordFixture[] }> }
  return payload.lines.flatMap((line) => line.words).filter((word) => !word.charTypeName || word.charTypeName === 'word')
}

function rulingTouchesFixtureWord(ruling: QiraatRuling, word: MushafWordFixture): boolean {
  if (!ruling.wordAnchored || ruling.surah !== word.surahNumber) return false
  if (word.ayahNumber < ruling.ayah || word.ayahNumber > ruling.endAyah) return false
  if (ruling.ayah === ruling.endAyah) {
    return word.ayahNumber === ruling.ayah
      && word.wordIndexInAyah >= ruling.startToken
      && word.wordIndexInAyah <= ruling.endToken
  }
  if (word.ayahNumber === ruling.ayah) return word.wordIndexInAyah >= ruling.startToken
  if (word.ayahNumber === ruling.endAyah) return word.wordIndexInAyah <= ruling.endToken
  return true
}

const variantPages = pageNumbers('pages')
const rulingPages = pageNumbers('rulings')
assert.deepEqual(variantPages, rulingPages, 'variant/ruling fixtures must be published page-for-page')

const totals = {
  fixturePages: variantPages.length,
  variants: 0,
  rulings: 0,
  variantReaderChecks: 0,
  rulingReaderChecks: 0,
  contextualRulings: 0,
  contextualTokenChecks: 0,
  multipleRuleTokenPositions: 0,
}
const categories = new Map<string, { records: number; pages: Set<number>; contextual: number }>()

for (const page of variantPages) {
  const variants = fixture<QiraatVariant>('pages', page)
  const rulings = fixture<QiraatRuling>('rulings', page)
  const words = wordsForPage(page)
  totals.variants += variants.length
  totals.rulings += rulings.length

  for (const variant of variants) {
    for (let token = variant.startToken; token <= variant.endToken; token += 1) {
      for (const readingId of variant.readingIds) {
        const narratorMarker = comparisonMarkerForWord([variant], variant.surah, variant.ayah, token, { kind: 'reading', readingId }, { includeUnpublished: true })
        assert.ok(narratorMarker?.variants.some((item) => item.id === variant.id), `${variant.id}: ${readingId} must see variant at ${variant.surah}:${variant.ayah}:${token}`)
        const readerId = readingId.slice(0, 3) as 'Q01' | 'Q02' | 'Q03' | 'Q04' | 'Q05' | 'Q06' | 'Q07' | 'Q08' | 'Q09' | 'Q10'
        const readerMarker = comparisonMarkerForWord([variant], variant.surah, variant.ayah, token, { kind: 'reader', readerId }, { includeUnpublished: true })
        assert.ok(readerMarker?.variants.some((item) => item.id === variant.id), `${variant.id}: ${readerId} must see variant at ${variant.surah}:${variant.ayah}:${token}`)
        totals.variantReaderChecks += 2
      }
      const unrelated = readingIds.find((id) => !variant.readingIds.includes(id))
      if (unrelated) {
        assert.equal(comparisonMarkerForWord([variant], variant.surah, variant.ayah, token, { kind: 'reading', readingId: unrelated }, { includeUnpublished: true }), null, `${variant.id}: unrelated ${unrelated} must not see variant`)
      }
    }
  }

  const positions = new Set<string>()
  for (const ruling of rulings) {
    const item = categories.get(ruling.category) ?? { records: 0, pages: new Set<number>(), contextual: 0 }
    item.records += 1
    item.pages.add(page)
    const isContextual = ruling.ayah !== ruling.endAyah || ruling.startToken !== ruling.endToken
    if (isContextual) { item.contextual += 1; totals.contextualRulings += 1 }
    categories.set(ruling.category, item)

    // Page-level conventions such as عد الآي are deliberately not painted on
    // Quran tokens. They are rendered in the rule panel, not through the word
    // marker contract this validator exercises.
    if (!ruling.wordAnchored) continue

    const touchedWords = words.filter((word) => rulingTouchesFixtureWord(ruling, word))
    assert.ok(touchedWords.length > 0, `${ruling.id}: word-anchored ruling must touch a real Mushaf word`)
    for (const word of touchedWords) {
      const ayah = word.ayahNumber
      const token = word.wordIndexInAyah
      positions.add(`${ruling.surah}:${ayah}:${token}`)
      const allMarker = rulingMarkerForWord([ruling], ruling.surah, ayah, token, { kind: 'all' })
      assert.ok(allMarker?.rulings.some((item) => item.id === ruling.id), `${ruling.id}: all comparison must render ${ruling.surah}:${ayah}:${token}`)
      if (isContextual) totals.contextualTokenChecks += 1

      for (const reading of ruling.readings) {
        const narratorMarker = rulingMarkerForWord([ruling], ruling.surah, ayah, token, { kind: 'reading', readingId: reading.readingId })
        assert.ok(narratorMarker?.rulings.some((item) => item.id === ruling.id), `${ruling.id}: ${reading.readingId} must see ruling at ${ruling.surah}:${ayah}:${token}`)
        const readerId = reading.readingId.slice(0, 3) as 'Q01' | 'Q02' | 'Q03' | 'Q04' | 'Q05' | 'Q06' | 'Q07' | 'Q08' | 'Q09' | 'Q10'
        const readerMarker = rulingMarkerForWord([ruling], ruling.surah, ayah, token, { kind: 'reader', readerId })
        assert.ok(readerMarker?.rulings.some((item) => item.id === ruling.id), `${ruling.id}: ${readerId} must see ruling at ${ruling.surah}:${ayah}:${token}`)
        totals.rulingReaderChecks += 2
      }
      const applicable = new Set(ruling.readings.map((reading) => reading.readingId))
      const unrelated = readingIds.find((id) => !applicable.has(id))
      if (unrelated && ruling.readings.length > 0) {
        assert.equal(rulingMarkerForWord([ruling], ruling.surah, ayah, token, { kind: 'reading', readingId: unrelated }), null, `${ruling.id}: unrelated ${unrelated} must not see ruling`)
      }
    }
  }

  for (const position of positions) {
    const [surah, ayah, token] = position.split(':').map(Number)
    const marker = rulingMarkerForWord(rulings, surah, ayah, token, { kind: 'all' })
    if (!marker) continue
    const distinctFamilies = new Set(marker.rulings.map((ruling) => ruling.color)).size
    assert.equal(marker.multiple, distinctFamilies > 1, `page ${page} ${position}: multi-rule indicator must match visible families`)
    if (marker.multiple) totals.multipleRuleTokenPositions += 1
  }
}

const report = {
  ...totals,
  categories: [...categories.entries()]
    .map(([category, item]) => ({ category, records: item.records, pages: item.pages.size, contextual: item.contextual }))
    .sort((a, b) => b.records - a.records || a.category.localeCompare(b.category)),
}
console.log(JSON.stringify(report, null, 2))
