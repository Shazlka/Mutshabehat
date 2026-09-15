import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const fixtureFile = resolve(root, 'packages/quran-data/mushaf1441/fixtures/page-ayahs.json')
const helperFile = resolve(root, 'packages/quran-data/mushaf1441/pageAyahs.ts')
const viewerFile = resolve(root, 'src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx')
const pageFile = resolve(root, 'src/app/mushaf-1441/page.tsx')
const pageAyatApiFile = resolve(root, 'src/app/api/mushaf-1441/page-ayat/route.ts')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function read(path) {
  assert(existsSync(path), `Missing file: ${path}`)
  return readFileSync(path, 'utf8')
}

const fixture = JSON.parse(read(fixtureFile))
const helperSource = read(helperFile)
const viewerSource = read(viewerFile)
const pageSource = read(pageFile)

assert(fixture.source?.name === 'Quran.com API v4 verses by page', 'Fixture must document Quran.com API source')
assert(Array.isArray(fixture.pages), 'Fixture must expose pages array')
assert(fixture.pages.length === 604, 'Fixture must include 604 pages')

const seenAyahKeys = new Set()
for (const [index, page] of fixture.pages.entries()) {
  const expectedPageNumber = index + 1
  assert(page.pageNumber === expectedPageNumber, `Page index ${index} must be page ${expectedPageNumber}`)
  assert(Array.isArray(page.ayahs), `Page ${page.pageNumber} must include ayahs array`)
  assert(page.ayahs.length > 0, `Page ${page.pageNumber} must include at least one ayah`)

  for (const ayah of page.ayahs) {
    assert(ayah.pageNumber === page.pageNumber, `Ayah ${ayah.ayahKey} pageNumber must match parent page`)
    assert(Number.isInteger(ayah.surahNumber), `Ayah ${ayah.ayahKey} must include surahNumber`)
    assert(Number.isInteger(ayah.ayahNumber), `Ayah ${ayah.ayahKey} must include ayahNumber`)
    assert(ayah.ayahKey === `${ayah.surahNumber}:${ayah.ayahNumber}`, `Invalid ayahKey ${ayah.ayahKey}`)
    assert(typeof ayah.textUthmani === 'string' && ayah.textUthmani.length > 0, `Ayah ${ayah.ayahKey} must include textUthmani`)
    assert(!seenAyahKeys.has(ayah.ayahKey), `Duplicate ayahKey ${ayah.ayahKey}`)
    seenAyahKeys.add(ayah.ayahKey)
  }
}

assert(seenAyahKeys.size === 6236, `Expected 6236 unique ayat, got ${seenAyahKeys.size}`)
assert(fixture.pages[0].ayahs.map((ayah) => ayah.ayahKey).join(',') === '1:1,1:2,1:3,1:4,1:5,1:6,1:7', 'Page 1 must contain Al-Fatihah ayat')
assert(fixture.pages[1].ayahs.map((ayah) => ayah.ayahKey).join(',') === '2:1,2:2,2:3,2:4,2:5', 'Page 2 must contain Al-Baqarah 1-5')
assert(fixture.pages[603].ayahs[0].ayahKey === '112:1', 'Page 604 must start at Al-Ikhlas')
assert(fixture.pages[603].ayahs.at(-1).ayahKey === '114:6', 'Page 604 must end at An-Nas')

assert(helperSource.includes('getMushaf1441PageAyahs'), 'Helper must export getMushaf1441PageAyahs')
assert(!pageSource.includes('getMushaf1441PageAyahs(1)'), 'Route must not load the removed ayah list view')
assert(!viewerSource.includes('initialPageAyahs'), 'Viewer must not accept initial page ayahs for a removed ayah list')
assert(!viewerSource.includes('pageAyahCache'), 'Viewer must not cache removed page ayah list data')
assert(!viewerSource.includes('renderPageAyahs'), 'Viewer must not render the removed page ayah list')
assert(!viewerSource.includes('page-ayat'), 'Viewer must not fetch removed page ayah list API')
assert(!viewerSource.includes('آيات هذه الصفحة'), 'Viewer must not label a removed page ayah list')
assert(!existsSync(pageAyatApiFile), 'Removed page ayah list API route must not exist')

console.log('Mushaf 1441 page ayat data validation passed; ayah list view remains removed.')
