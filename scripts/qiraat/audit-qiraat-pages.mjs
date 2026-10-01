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
function stringValues(source) {
  return [...source.matchAll(/'([^']+)'/g)].map((match) => match[1])
}
function registryRules() {
  const source = fs.readFileSync(registryPath, 'utf8')
  return [...source.matchAll(/\{ canonicalType: '([^']+)', rawCategories: \[([^\]]*)\], rawLabels: \[([^\]]*)\], family: '([^']+)', contextual: (true|false) \}/g)]
    .map((match) => ({ canonicalType: match[1], rawCategories: stringValues(match[2]), rawLabels: stringValues(match[3]), family: match[4], contextual: match[5] === 'true' }))
}
const registry = registryRules()
const registryByCategory = new Map(registry.flatMap((rule) => rule.rawCategories.map((raw) => [raw, rule])))
const knownReadings = new Set(Array.from({ length: 10 }, (_, reader) => ['R01', 'R02'].map((rawi) => `Q${String(reader + 1).padStart(2, '0')}-${rawi}`)).flat())
const knownReaders = new Set(Array.from({ length: 10 }, (_, reader) => `Q${String(reader + 1).padStart(2, '0')}`))
const knownAuthorities = new Set([...knownReaders, ...knownReadings])
const inventory = new Map()
const actions = new Map()
const totals = { pages: 604, fixturePages: 0, variants: 0, rulings: 0, missingFixtures: 0, unlinkedWords: 0, unknownRules: 0, unknownRuleLabels: 0, unknownReadings: 0, unknownAuthorities: 0, emptyActions: 0, attributionExpansionFailures: 0, actionDetailDifferences: 0, contextual: 0 }

function inventoryAction(action, ruling, page, authorityId) {
  const item = actions.get(action) ?? {
    raw_source_value: action,
    attribution_assignments: 0,
    recordIds: new Set(),
    pages: new Set(),
    categories: new Set(),
    authorities: new Set(),
    // Actions are intentionally free text: the detail panel groups and renders this exact value.
    rendering: 'SOURCE_PRESERVED_VERBATIM',
    classification: 'SUPPORTED_AS_SOURCE_PRESERVED_DETAIL',
  }
  item.attribution_assignments += 1
  item.recordIds.add(ruling.id)
  item.pages.add(page)
  item.categories.add(ruling.category)
  item.authorities.add(authorityId)
  actions.set(action, item)
}

fs.mkdirSync(pagesOutput, { recursive: true })
for (let page = 1; page <= 604; page += 1) {
  const variants = fixture(pageFile('pages', page))
  const rulings = fixture(pageFile('rulings', page))
  const words = wordsForPage(page)
  const report = { page, status: 'PASS', source: variants && rulings ? 'fixture' : 'NO_FIXTURE', records: 0, variants: 0, rulings: 0, supported: 0, unsupported: 0, unknownRules: [], unknownRuleLabels: [], missingWordLinks: [], unknownReadings: [], unknownAuthorities: [], emptyActions: [], attributionExpansionFailures: [], actionDetailDifferences: [], contextualRules: [] }
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
      const definition = registryByCategory.get(ruling.category)
      const item = inventory.get(ruling.category) ?? { raw_database_value: ruling.category, raw_labels: new Set(), count: 0, pages: new Set(), readers: new Set(), rawis: new Set(), mapped: Boolean(definition), canonical_type: definition?.canonicalType ?? null, family: definition?.family ?? null, contextual: definition?.contextual ?? null }
      item.count += 1; item.pages.add(page); item.raw_labels.add(ruling.categoryAr)
      if (!definition?.rawLabels.includes(ruling.categoryAr)) { report.unknownRuleLabels.push({ id: ruling.id, category: ruling.category, categoryAr: ruling.categoryAr }); totals.unknownRuleLabels += 1 }
      const expectedReadings = new Set()
      const expectedActions = new Map()
      for (const attribution of ruling.attribution ?? []) {
        if (!attribution.action?.trim()) { report.emptyActions.push(ruling.id); totals.emptyActions += 1; continue }
        inventoryAction(attribution.action, ruling, page, attribution.authorityId)
        if (!knownAuthorities.has(attribution.authorityId)) { report.unknownAuthorities.push({ id: ruling.id, authorityId: attribution.authorityId }); totals.unknownAuthorities += 1; continue }
        const expanded = attribution.authorityId.includes('-')
          ? [attribution.authorityId]
          : [...knownReadings].filter((readingId) => readingId.startsWith(`${attribution.authorityId}-`))
        for (const readingId of expanded) {
          expectedReadings.add(readingId)
          const actionsForReading = expectedActions.get(readingId) ?? new Set()
          actionsForReading.add(attribution.action)
          expectedActions.set(readingId, actionsForReading)
        }
      }
      for (const reading of ruling.readings ?? []) { const id = reading.readingId; if (id) { item.rawis.add(id); item.readers.add(id.slice(0, 3)); if (!knownReadings.has(id)) { report.unknownReadings.push({ id: ruling.id, reading: id }); totals.unknownReadings += 1 } } }
      const actualReadings = new Set((ruling.readings ?? []).map((reading) => reading.readingId))
      for (const expected of expectedReadings) if (!actualReadings.has(expected)) { report.attributionExpansionFailures.push({ id: ruling.id, expected }); totals.attributionExpansionFailures += 1 }
      for (const [readingId, expectedActionsForReading] of expectedActions) {
        const actualActions = new Set((ruling.readings ?? []).filter((reading) => reading.readingId === readingId).map((reading) => reading.action))
        if (![...expectedActionsForReading].some((action) => actualActions.has(action))) { report.actionDetailDifferences.push({ id: ruling.id, readingId, attributionActions: [...expectedActionsForReading], readingActions: [...actualActions] }); totals.actionDetailDifferences += 1 }
      }
      inventory.set(ruling.category, item)
      const valid = isSpanValid(ruling, words)
      if (valid && item.mapped) report.supported += 1
      else { report.unsupported += 1; if (!valid) { report.missingWordLinks.push(ruling.id); totals.unlinkedWords += 1 } if (!item.mapped) { report.unknownRules.push(ruling.category); totals.unknownRules += 1 } }
      if ((ruling.endAyah ?? ruling.ayah) !== ruling.ayah || ruling.startToken !== ruling.endToken) { report.contextualRules.push(ruling.id); totals.contextual += 1 }
    }
  }
  if (report.unsupported || report.unknownRuleLabels.length || report.unknownAuthorities.length || report.emptyActions.length || report.attributionExpansionFailures.length) report.status = 'FAIL'
  fs.writeFileSync(path.join(pagesOutput, `page-${String(page).padStart(3, '0')}.json`), `${JSON.stringify(report, null, 2)}\n`)
}
const distinctUsul = [...inventory.values()].sort((a, b) => b.count - a.count).map((item) => ({ ...item, raw_labels: [...item.raw_labels].sort(), pages: [...item.pages].sort((a, b) => a - b), readers: [...item.readers].sort(), rawis: [...item.rawis].sort() }))
const distinctActions = [...actions.values()].sort((a, b) => b.attribution_assignments - a.attribution_assignments || a.raw_source_value.localeCompare(b.raw_source_value, 'ar')).map((item) => ({ ...item, record_count: item.recordIds.size, pages: [...item.pages].sort((a, b) => a - b), categories: [...item.categories].sort(), authorities: [...item.authorities].sort(), recordIds: undefined }))
fs.writeFileSync(path.join(output, 'qiraat-usul-inventory.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), totals, registry, rules: distinctUsul, actionValues: distinctActions }, null, 2)}\n`)
console.log(JSON.stringify({ ...totals, distinctUsul: distinctUsul.length }, null, 2))
if (totals.unlinkedWords || totals.unknownRules || totals.unknownRuleLabels || totals.unknownReadings || totals.unknownAuthorities || totals.emptyActions || totals.attributionExpansionFailures) process.exitCode = 1
