import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const moduleDir = dirname(fileURLToPath(import.meta.url))
const typesPath = resolve(moduleDir, 'types.ts')
const adapterPath = resolve(moduleDir, 'qiraatAdapter.ts')
const fixturePath = resolve(moduleDir, 'fixtures/sample-empty-variants.json')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function read(path) {
  assert(existsSync(path), `Missing required file: ${path}`)
  return readFileSync(path, 'utf8')
}

const typesSource = read(typesPath)
const adapterSource = read(adapterPath)
const fixture = JSON.parse(read(fixturePath))

for (const reading of ['hafs', 'warsh', 'abu-amr', 'hamza']) {
  assert(typesSource.includes(`'${reading}'`), `Missing reading: ${reading}`)
}

assert(typesSource.includes('QiraatVariant'), 'Missing QiraatVariant interface')
assert(typesSource.includes('wordIndexInAyah?'), 'wordIndexInAyah must be optional')
assert(adapterSource.includes('getQiraatVariantsByAyahKey'), 'Missing ayahKey lookup adapter')
assert(adapterSource.includes('variant.ayahKey === normalizedAyahKey'), 'Adapter must use ayahKey mapping')
assert(Array.isArray(fixture.variants), 'Fixture must contain variants array')
assert(fixture.variants.length === 0, 'No verified qiraat data is bundled; fixture must stay empty')

console.log('Qiraat core validation passed. No verified qiraat data is bundled.')
