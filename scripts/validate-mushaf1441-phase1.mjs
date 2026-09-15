import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const routeFile = resolve(root, 'src/app/mushaf-1441/page.tsx')
const viewerFile = resolve(root, 'src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx')
const fixtureFile = resolve(root, 'packages/quran-data/mushaf1441/fixtures/sample-page-1.json')
const proxyFile = resolve(root, 'src/proxy.ts')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function read(path) {
  assert(existsSync(path), `Missing file: ${path}`)
  return readFileSync(path, 'utf8')
}

const routeSource = read(routeFile)
const viewerSource = read(viewerFile)
const proxySource = read(proxyFile)
const fixture = JSON.parse(read(fixtureFile))

assert(routeSource.includes('Mushaf1441Viewer'), 'Route must render Mushaf1441Viewer')
assert(routeSource.includes('packages/quran-data/mushaf1441'), 'Route must consume package fixture/types')
assert(viewerSource.includes("'use client'"), 'Viewer must be a client component')
assert(viewerSource.includes('selectedAyahKey'), 'Viewer must support ayah selection/highlighting')
assert(viewerSource.includes('selectedWord'), 'Viewer must support word metadata selection')
assert(viewerSource.includes('wordIndexInLine'), 'Viewer must render word-level mapping metadata')
assert(proxySource.includes('/mushaf-1441'), 'Preview route must be reachable without redirecting to login')

assert(fixture.pageNumber === 1, 'Sample fixture must represent page 1')
assert(Array.isArray(fixture.lines), 'Sample fixture must contain lines')
assert(fixture.lines.length > 0, 'Sample fixture must include at least one line')

const wordIds = new Set()
let wordCount = 0
for (const line of fixture.lines) {
  assert(line.pageNumber === fixture.pageNumber, 'Line pageNumber must match page pageNumber')
  assert(Number.isInteger(line.lineNumber), 'Line must have an integer lineNumber')
  assert(Array.isArray(line.words), 'Line must contain words')
  for (const word of line.words) {
    wordCount += 1
    assert(!wordIds.has(word.id), `Duplicate word id: ${word.id}`)
    wordIds.add(word.id)
    assert(word.pageNumber === fixture.pageNumber, `Word ${word.id} pageNumber mismatch`)
    assert(word.lineNumber === line.lineNumber, `Word ${word.id} lineNumber mismatch`)
    assert(Number.isInteger(word.wordIndexInLine), `Word ${word.id} missing wordIndexInLine`)
    assert(Number.isInteger(word.surahNumber), `Word ${word.id} missing surahNumber`)
    assert(Number.isInteger(word.ayahNumber), `Word ${word.id} missing ayahNumber`)
    assert(Number.isInteger(word.wordIndexInAyah), `Word ${word.id} missing wordIndexInAyah`)
    assert(word.ayahKey === `${word.surahNumber}:${word.ayahNumber}`, `Word ${word.id} has invalid ayahKey`)
    assert(typeof word.textUthmani === 'string' && word.textUthmani.length > 0, `Word ${word.id} missing textUthmani`)
  }
}

assert(wordCount >= 5, 'Sample fixture should include enough words to exercise line rendering')

console.log(`Phase 1 Mushaf preview validation passed (${fixture.lines.length} lines, ${wordCount} words).`)
