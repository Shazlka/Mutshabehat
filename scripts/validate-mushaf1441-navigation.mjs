import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const METADATA_PATH = join(ROOT, 'packages/quran-data/mushaf1441/fixtures/page-metadata.json')
const VIEWER_PATH = join(ROOT, 'src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx')
const PAGE_PATH = join(ROOT, 'src/app/mushaf-1441/page.tsx')
const API_PATH = join(ROOT, 'src/app/api/mushaf-1441/page-metadata/route.ts')

function fail(message) {
  console.error(`Mushaf 1441 navigation validation failed: ${message}`)
  process.exit(1)
}

const metadata = JSON.parse(readFileSync(METADATA_PATH, 'utf8'))
const viewer = readFileSync(VIEWER_PATH, 'utf8')
const page = readFileSync(PAGE_PATH, 'utf8')
const api = readFileSync(API_PATH, 'utf8')

if (metadata?.source?.name !== 'Quran.com API v4 verses by page metadata') {
  fail('metadata fixture has the wrong source')
}
if (!Array.isArray(metadata.pages) || metadata.pages.length !== 604) {
  fail(`expected 604 metadata pages, found ${metadata.pages?.length ?? 'none'}`)
}
if (!Array.isArray(metadata.surahs) || metadata.surahs.length !== 114) {
  fail(`expected 114 surah options, found ${metadata.surahs?.length ?? 'none'}`)
}
if (metadata.ayahToPage?.['2:255'] !== 42) {
  fail('expected ayah 2:255 to map to page 42')
}
if (metadata.pages[0]?.surahNames?.[0] !== 'الفاتحة') {
  fail('page 1 should show Surah Al-Fatihah')
}
if (metadata.pages[603]?.lastAyahKey !== '114:6') {
  fail('page 604 should end at 114:6')
}

for (const required of [
  'submitAyahJump',
  'selectedSurahNumber',
  'selectedAyahNumber',
  'visiblePageMetadata?.surahNames',
  'visiblePageMetadata?.juzNumber',
  'visiblePageMetadata.rubInJuz',
  'ص {pageNumber}',
]) {
  if (!viewer.includes(required)) fail(`viewer missing ${required}`)
}

for (const forbidden of [
  'previewMode',
  'real-page',
  'ayah-list',
  'getMushaf1441PageImageUrl',
  'الصفحة الحقيقية',
  'قائمة الآيات',
  'Archive leaf',
]) {
  if (viewer.includes(forbidden)) fail(`viewer still contains removed view mode: ${forbidden}`)
}

if (!page.includes('initialPageMetadata') || !page.includes('MUSHAF_1441_SURAH_OPTIONS')) {
  fail('page component must pass metadata and surah options')
}
if (!api.includes('ayahKey') || !api.includes('getMushaf1441PageForAyahKey')) {
  fail('metadata API must support ayahKey lookup')
}

console.log('Mushaf 1441 navigation validation passed.')
