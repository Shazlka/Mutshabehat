#!/usr/bin/env node
/** Deterministic, fixture-first Qiraat audit.  Never mutates data. */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const output = path.join(root, 'artifacts')
const pagesOutput = path.join(root, 'audit')
const registryPath = path.join(root, 'packages/qiraat-core/usulRegistry.ts')

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')) }
function fixture(file) { return fs.existsSync(file) ? readJson(file) : null }
function pageFile(kind, page) { return path.join(root, 'packages/qiraat-core/fixtures', kind, `page-${String(page).padStart(3, '0')}.json`) }
function wordsForPage(page) {
  const payload = fixture(path.join(root, 'packages/quran-data/mushaf1441/fixtures/page-words', `page-${String(page).padStart(3, '0')}.json`))
  return payload ? payload.lines.flatMap((line) => line.words ?? []) : []
}
function isSpanValid(record, words) {
  if (!record.wordAnchored) return true
  const endAyah = record.endAyah ?? record.ayah
  if (endAyah < record.ayah) return false
  return words.some((word) => word.surahNumber === record.surah && word.ayahNumber === record.ayah && word.wordIndexInAyah === record.startToken)
    && words.some((word) => word.surahNumber === record.surah && word.ayahNumber === endAyah && word.wordIndexInAyah === record.endToken)
}
const registryCategories = new Set([...fs.readFileSync(registryPath, 'utf8').matchAll(/rawCategories: \['([^']+)'\]/g)].map((match) => match[1]))
const knownReadings = new Set(Array.from({ length: 10 }, (_, reader) => ['R01', 'R02'].map((rawi) => `Q${String(reader + 1).padStart(2, '0')}-${rawi}`)).flat())
const inventory = new Map()
const totals = { pages: 604, fixturePages: 0, variants: 0, rulings: 0, missingFixtures: 0, unlinkedWords: 0, unknownRules: 0, unknownReadings: 0, contextual: 0 }

fs.mkdirSync(pagesOutput, { recursive: true })
for (let page = 1; page <= 604; page += 1) {
  const variants = fixture(pageFile('pages', page))
  const rulings = fixture(pageFile('rulings', page))
  const words = wordsForPage(page)
  const report = { page, status: 'PASS', source: variants && rulings ? 'fixture' : 'NO_FIXTURE', records: 0, variants: 0, rulings: 0, supported: 0, unsupported: 0, unknownRules: [], missingWordLinks: [], unknownReadings: [], contextualRules: [] }
  if (!variants || !rulings) {
    totals.missingFixtures += 1
    report.status = 'WARNING'
  } else {
    totals.fixturePages += 1
    for (const variant of variants) {
      report.records += 1; report.variants += 1; totals.variants += 1
      const valid = words.some((word) => word.surahNumber === variant.surah && word.ayahNumber === variant.ayah && word.wordIndexInAyah === variant.startToken)
      if (valid) report.supported += 1
      else { report.unsupported += 1; report.missingWordLinks.push(variant.id); totals.unlinkedWords += 1 }
      for (const reading of variant.readingIds ?? []) if (!knownReadings.has(reading)) { report.unknownReadings.push({ id: variant.id, reading }); totals.unknownReadings += 1 }
    }
    for (const ruling of rulings) {
      report.records += 1; report.rulings += 1; totals.rulings += 1
      const item = inventory.get(ruling.category) ?? { raw_database_value: ruling.category, raw_labels: new Set(), count: 0, pages: new Set(), readers: new Set(), rawis: new Set(), mapped: registryCategories.has(ruling.category), canonical_type: ruling.category }
      item.count += 1; item.pages.add(page); item.raw_labels.add(ruling.categoryAr)
      for (const reading of ruling.readings ?? []) { const id = reading.readingId; if (id) { item.rawis.add(id); item.readers.add(id.slice(0, 3)); if (!knownReadings.has(id)) { report.unknownReadings.push({ id: ruling.id, reading: id }); totals.unknownReadings += 1 } } }
      inventory.set(ruling.category, item)
      const valid = isSpanValid(ruling, words)
      if (valid && item.mapped) report.supported += 1
      else { report.unsupported += 1; if (!valid) { report.missingWordLinks.push(ruling.id); totals.unlinkedWords += 1 } if (!item.mapped) { report.unknownRules.push(ruling.category); totals.unknownRules += 1 } }
      if ((ruling.endAyah ?? ruling.ayah) !== ruling.ayah || ruling.startToken !== ruling.endToken) { report.contextualRules.push(ruling.id); totals.contextual += 1 }
    }
  }
  if (report.unsupported) report.status = 'FAIL'
  fs.writeFileSync(path.join(pagesOutput, `page-${String(page).padStart(3, '0')}.json`), `${JSON.stringify(report, null, 2)}\n`)
}
const distinctUsul = [...inventory.values()].sort((a, b) => b.count - a.count).map((item) => ({ ...item, raw_labels: [...item.raw_labels].sort(), pages: [...item.pages].sort((a, b) => a - b), readers: [...item.readers].sort(), rawis: [...item.rawis].sort() }))
fs.writeFileSync(path.join(output, 'qiraat-usul-inventory.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), totals, rules: distinctUsul }, null, 2)}\n`)
console.log(JSON.stringify({ ...totals, distinctUsul: distinctUsul.length }, null, 2))
if (totals.unlinkedWords || totals.unknownRules || totals.unknownReadings) process.exitCode = 1
