import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const moduleDir = dirname(fileURLToPath(import.meta.url))

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function read(relativePath) {
  const path = resolve(moduleDir, relativePath)
  assert(existsSync(path), `Missing required file: ${path}`)
  return readFileSync(path, 'utf8')
}

const typesSource = read('types.ts')
const readersSource = read('readers.ts')
const narratorsSource = read('narrators.ts')
const readingsSource = read('readings.ts')
const engineSource = read('engine.ts')
const attributionSource = read('attribution.ts')
const repositorySource = read('repository.ts')

for (let i = 1; i <= 10; i += 1) {
  const id = `Q${String(i).padStart(2, '0')}`
  assert(typesSource.includes(`'${id}'`), `Missing reader id: ${id}`)
  assert(readersSource.includes(`id: '${id}'`), `readers.ts missing ${id}`)
  for (const n of [1, 2]) {
    const narratorId = `${id}-R0${n}`
    assert(typesSource.includes(`'${narratorId}'`), `Missing narrator id: ${narratorId}`)
    assert(narratorsSource.includes(`id: '${narratorId}'`), `narrators.ts missing ${narratorId}`)
  }
}

assert(readingsSource.includes('QIRAAT_NARRATORS.map'), 'readings.ts must derive readings from narrators, never duplicate them')
assert(typesSource.includes("BASE_READING: ReadingId = 'Q05-R02'"), 'Baseline must be Hafs (Q05-R02), defined once')

for (const op of ['KEEP', 'REPLACE', 'INSERT', 'DELETE', 'MERGE', 'SPLIT', 'DIACRITIC_CHANGE', 'ORTHOGRAPHIC_CHANGE']) {
  assert(typesSource.includes(`'${op}'`), `Missing variant operation: ${op}`)
}

for (const status of ['EXTRACTED', 'MAPPED', 'REVIEWED', 'VERIFIED', 'PUBLISHED']) {
  assert(typesSource.includes(`'${status}'`), `Missing verification status: ${status}`)
}

// The two narrators both named "الدوري" must stay disambiguated by canonical ID.
assert(narratorsSource.includes("id: 'Q03-R01'") && narratorsSource.includes('الدوري عن أبي عمرو'), 'Q03-R01 must be disambiguated as "الدوري عن أبي عمرو"')
assert(narratorsSource.includes("id: 'Q07-R02'") && narratorsSource.includes('الدوري عن الكسائي'), 'Q07-R02 must be disambiguated as "الدوري عن الكسائي"')

assert(engineSource.includes('function renderToken'), 'engine.ts must expose renderToken')
assert(engineSource.includes('function resolveTokenForReading'), 'engine.ts must expose resolveTokenForReading')
assert(engineSource.includes('readingId === BASE_READING'), 'engine.ts must never apply a variant to the baseline reading')
assert(attributionSource.includes('function computeAttribution'), 'attribution.ts must expose computeAttribution')
assert(repositorySource.includes('interface QiraatRepository'), 'repository.ts must define the QiraatRepository interface')

console.log('Qiraat core validation passed: 10 readers, 20 narrators/readings, engine + attribution + repository present, baseline = Hafs, duplicate-al-Duri disambiguation intact.')
