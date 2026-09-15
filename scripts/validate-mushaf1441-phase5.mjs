import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const qiraatTypesFile = resolve(root, 'packages/qiraat-core/types.ts')
const qiraatAdapterFile = resolve(root, 'packages/qiraat-core/qiraatAdapter.ts')
const qiraatFixtureFile = resolve(root, 'packages/qiraat-core/fixtures/sample-empty-variants.json')
const qiraatSourceFile = resolve(root, 'packages/qiraat-core/sampleQiraatSource.ts')
const qiraatValidateFile = resolve(root, 'packages/qiraat-core/validate.mjs')
const viewerFile = resolve(root, 'src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function read(path) {
  assert(existsSync(path), `Missing file: ${path}`)
  return readFileSync(path, 'utf8')
}

const qiraatTypesSource = read(qiraatTypesFile)
const qiraatAdapterSource = read(qiraatAdapterFile)
const qiraatFixture = JSON.parse(read(qiraatFixtureFile))
const qiraatSource = read(qiraatSourceFile)
const qiraatValidateSource = read(qiraatValidateFile)
const viewerSource = read(viewerFile)

for (const reading of ['hafs', 'warsh', 'abu-amr', 'hamza']) {
  assert(qiraatTypesSource.includes(`'${reading}'`), `Qiraat types must support ${reading}`)
}

assert(qiraatTypesSource.includes('QiraatVariant'), 'Qiraat package must define QiraatVariant')
assert(qiraatTypesSource.includes('wordIndexInAyah?'), 'QiraatVariant must support optional wordIndexInAyah')
assert(qiraatAdapterSource.includes('getQiraatVariantsByAyahKey'), 'Qiraat adapter must expose ayahKey lookup')
assert(qiraatAdapterSource.includes('ayahKey'), 'Qiraat adapter must use ayahKey')
assert(!qiraatAdapterSource.includes('textUthmani'), 'Qiraat adapter must not depend on base Mushaf word text')
assert(!qiraatAdapterSource.includes('Mutshabehat'), 'Qiraat adapter must not depend on Mutshabehat')

assert(Array.isArray(qiraatFixture.variants), 'Qiraat fixture must expose variants array')
assert(qiraatFixture.variants.length === 0, 'Qiraat fixture must be empty until verified source data exists')
assert(qiraatSource.includes('SAMPLE_QIRAAT_SOURCE'), 'Qiraat sample source must be exported')
assert(qiraatValidateSource.includes('No verified qiraat data is bundled'), 'Qiraat validator must document empty verified-data state')

assert(viewerSource.includes('getQiraatVariantsByAyahKey'), 'Viewer must use qiraat-core adapter')
assert(viewerSource.includes('SAMPLE_QIRAAT_SOURCE'), 'Viewer must use qiraat sample source')
assert(viewerSource.includes("'qiraat'"), 'Viewer must include a qiraat tab state')
assert(viewerSource.includes('Qiraat'), 'Viewer must render a Qiraat tab label')
assert(viewerSource.includes('No qiraat data loaded yet.'), 'Viewer must show required empty qiraat message')
assert(!viewerSource.includes('text: "') && !viewerSource.includes("text: '"), 'Viewer must not hard-code qiraat text')

console.log('Phase 5 Qiraat validation passed.')
