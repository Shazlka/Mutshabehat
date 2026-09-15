import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const loaderFile = resolve(root, 'packages/quran-data/mushaf1441/pageLoader.ts')
const readinessFile = resolve(root, 'packages/quran-data/mushaf1441/IPHONE_READINESS.md')
const viewerFile = resolve(root, 'src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx')
const pageFile = resolve(root, 'src/app/mushaf-1441/page.tsx')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function read(path) {
  assert(existsSync(path), `Missing file: ${path}`)
  return readFileSync(path, 'utf8')
}

const loaderSource = read(loaderFile)
const readinessSource = read(readinessFile)
const viewerSource = read(viewerFile)
const pageSource = read(pageFile)

assert(loaderSource.includes('MUSHAF_1441_PAGE_COUNT = 604'), 'Loader must define 604-page count')
assert(loaderSource.includes('MUSHAF_1441_LINES_PER_PAGE = 15'), 'Loader must define normal 15-line page count')
assert(loaderSource.includes('loadMushaf1441Page'), 'Loader must expose lazy page loading function')
assert(loaderSource.includes('isValidMushaf1441PageNumber'), 'Loader must validate page range')
assert(loaderSource.includes('per-page QCF V2 word fixtures'), 'Loader must document the current per-page QCF V2 fixture source')

assert(pageSource.includes('loadMushaf1441Page'), 'Route must use page loader instead of importing fixture directly')

assert(viewerSource.includes('loadMushaf1441Page'), 'Viewer must lazy-load page data through loader')
assert(viewerSource.includes('pageCache'), 'Viewer must cache loaded page data for performance')
assert(viewerSource.includes('isPageLoading'), 'Viewer must expose loading state for page fetches')
assert(viewerSource.includes('dir=\"rtl\"'), 'Viewer root must enforce RTL direction')
assert(viewerSource.includes('env(safe-area-inset-top)'), 'Viewer must account for iPhone top safe area')
assert(viewerSource.includes('env(safe-area-inset-bottom)'), 'Viewer must account for iPhone bottom safe area')
assert(!viewerSource.includes('min-h-10'), 'Interactive controls should use 44px-compatible min-h-11 or larger')
assert(!viewerSource.includes('vw'), 'Viewer typography must avoid viewport-width font sizing')
assert(
  viewerSource.includes("MUSHAF_QCF_FONT_SIZE = 'clamp(15px, 4.35cqw, 40px)'"),
  'Mushaf glyph sizing must be clamped to the page container, not the viewport'
)
assert(viewerSource.includes('MUSHAF_1441_NOTES_STORAGE_KEY'), 'Local notes storage must remain explicit')

for (const phrase of [
  'iPhone screen layout',
  'touch targets',
  'RTL behavior',
  'offline-first',
  'localStorage',
  'Capacitor',
  '604 pages',
  'lazy loading',
  'font loading',
  'safe area',
]) {
  assert(readinessSource.includes(phrase), `Readiness document missing: ${phrase}`)
}

console.log('Phase 6 iPhone readiness validation passed.')
