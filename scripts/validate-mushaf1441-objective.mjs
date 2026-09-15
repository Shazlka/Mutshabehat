import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()

const paths = {
  viewer: join(ROOT, 'src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx'),
  page: join(ROOT, 'src/app/mushaf-1441/page.tsx'),
  proxy: join(ROOT, 'src/proxy.ts'),
  pageMetadataApi: join(ROOT, 'src/app/api/mushaf-1441/page-metadata/route.ts'),
  pageWordsApi: join(ROOT, 'src/app/api/mushaf-1441/page-words/route.ts'),
  pageAyatApi: join(ROOT, 'src/app/api/mushaf-1441/page-ayat/route.ts'),
  annotationsApi: join(ROOT, 'src/app/api/mushaf-1441/annotations/route.ts'),
  mutshabehatApi: join(ROOT, 'src/app/api/mushaf-1441/mutshabehat/route.ts'),
  pageMetadata: join(ROOT, 'packages/quran-data/mushaf1441/pageMetadata.ts'),
  pageLoader: join(ROOT, 'packages/quran-data/mushaf1441/pageLoader.ts'),
  mutshabehatAdapter: join(ROOT, 'packages/mutshabehat-core/mushafLinkAdapter.ts'),
  migration: join(ROOT, 'supabase/migrations/20260628000000_mushaf_annotations_preview.sql'),
  crudVerifier: join(ROOT, 'scripts/verify-mushaf1441-supabase-crud.mjs'),
}

function fail(message) {
  console.error(`Mushaf 1441 objective validation failed: ${message}`)
  process.exit(1)
}

function read(path, label) {
  if (!existsSync(path)) fail(`missing ${label}: ${path}`)
  return readFileSync(path, 'utf8')
}

function mustInclude(source, token, label) {
  if (!source.includes(token)) fail(`${label} missing ${token}`)
}

function mustNotInclude(source, token, label) {
  if (source.includes(token)) fail(`${label} still contains ${token}`)
}

const viewer = read(paths.viewer, 'viewer')
const page = read(paths.page, 'route')
const proxy = read(paths.proxy, 'proxy')
const pageMetadataApi = read(paths.pageMetadataApi, 'page metadata API')
const pageWordsApi = read(paths.pageWordsApi, 'page words API')
const annotationsApi = read(paths.annotationsApi, 'annotations API')
const mutshabehatApi = read(paths.mutshabehatApi, 'Mutshabehat API')
const pageMetadata = read(paths.pageMetadata, 'page metadata helper')
const pageLoader = read(paths.pageLoader, 'page loader')
const mutshabehatAdapter = read(paths.mutshabehatAdapter, 'Mutshabehat adapter')
const migration = read(paths.migration, 'preview migration')
const crudVerifier = read(paths.crudVerifier, 'Supabase CRUD verifier')

for (const token of [
  'Mushaf1441Viewer',
  'loadMushaf1441Page(initialPageNumber)',
  'initialPageMetadata',
  'MUSHAF_1441_SURAH_OPTIONS',
]) {
  mustInclude(page, token, 'route')
}
mustInclude(proxy, 'export const config', 'proxy')
mustInclude(pageWordsApi, 'loadMushaf1441Page', 'page words API')
mustInclude(pageLoader, 'MUSHAF_1441_PAGE_COUNT = 604', 'page loader')
mustInclude(pageLoader, 'per-page QCF V2 word fixtures', 'page loader')

for (const token of [
  'submitAyahJump',
  'jumpToSelectedAyah',
  'selectedSurahNumber',
  'selectedSurahAyahCount',
  'renderNavControls',
]) {
  mustInclude(viewer, token, 'surah/ayah navigation')
}
mustInclude(pageMetadataApi, 'ayahKey', 'page metadata API')
mustInclude(pageMetadataApi, 'getMushaf1441PageForAyahKey', 'page metadata API')
mustInclude(pageMetadata, 'MUSHAF_1441_SURAH_OPTIONS', 'page metadata helper')

for (const token of [
  'real-page',
  'ayah-list',
  'getMushaf1441PageImageUrl',
  'الصفحة الحقيقية',
  'قائمة الآيات',
  'initialPageAyahs',
  'pageAyahCache',
  'renderPageAyahs',
  'page-ayat',
]) {
  mustNotInclude(viewer, token, 'viewer')
  mustNotInclude(page, token, 'route')
}
if (existsSync(paths.pageAyatApi)) fail('removed ayah list API route still exists')

for (const token of [
  'fetch(`/api/mushaf-1441/mutshabehat',
  'mutshabehatHighlightByAyahKey',
  'isMutshabehatHighlighted',
  'PERSONAL_AYAH_HIGHLIGHT',
  "setActiveDetailTab(hasMutshabehatHighlight ? 'mutshabehat' : 'notes')",
]) {
  mustInclude(viewer, token, 'Mutshabehat viewer link')
}
for (const token of [
  "from('groups')",
  'verses(surah, ayah, label), group_tags(tags(name))',
  'toAyahKey',
  'similarAyat',
]) {
  mustInclude(mutshabehatApi, token, 'Mutshabehat API')
}
mustInclude(mutshabehatAdapter, 'NEXT_PUBLIC_ENABLE_MUSHAF_MUTSHABEHAT_LINK', 'Mutshabehat adapter')

for (const token of [
  'onContextMenu={(event) => openWordContextMenu(event, word)}',
  'onContextMenu={(event) => openAyahContextMenu(event, word.ayahKey)}',
  'async function persistAnnotation',
  'async function deleteAnnotation',
  "buildAnnotationPayload(target, 'note'",
  "annotationType: row.annotation_type",
  'validateAnnotationTarget',
  'word target requires wordId',
  'word-range target requires wordRangeStartId and wordRangeEndId',
  'lineNumber must be 1-15',
  'wordIndexInLine must be a positive integer',
]) {
  mustInclude(viewer + annotationsApi, token, 'annotation flow')
}
for (const token of [
  "const TABLE = 'mushaf_annotations'",
  'createServerSupabaseClient',
  'sanitizeNote',
  'export async function GET',
  'export async function POST',
  'export async function PATCH',
  'export async function DELETE',
]) {
  mustInclude(annotationsApi, token, 'annotations API')
}

for (const token of [
  'HIGHLIGHT_COLOR_PRESETS',
  'createWordRangeTarget',
  'rangeHighlightAnnotation',
  'ayahHighlightAnnotation',
  'wordHighlightAnnotation',
  'textColor: annotationDraft.textColor',
  'backgroundColor: annotationDraft.backgroundColor',
]) {
  mustInclude(viewer, token, 'highlight flow')
}

for (const token of [
  'toggleBookmark',
  'toggleFavorite',
  "buildAnnotationPayload(target, 'bookmark'",
  "buildAnnotationPayload(target, 'favorite'",
  'hasAyahBookmark',
  'hasAyahFavorite',
]) {
  mustInclude(viewer, token, 'bookmark/favorite flow')
}

for (const token of [
  'visiblePageMetadata?.surahNames',
  'visiblePageMetadata?.juzNumber',
  'visiblePageMetadata.rubInJuz',
  'ص {pageNumber}',
]) {
  mustInclude(viewer, token, 'page header/footer')
}

for (const token of [
  'create table if not exists public.mushaf_annotations',
  "annotation_type in ('note', 'highlight', 'bookmark', 'favorite')",
  "target_type in ('ayah', 'word', 'word-range')",
  'mushaf_annotations_target_shape_check',
  "target_type <> 'word'",
  'word_id is not null',
  'line_number is not null',
  'word_index_in_line is not null',
  "target_type <> 'word-range'",
  'word_range_start_id is not null',
  'word_range_end_id is not null',
  'grant select, insert, update, delete on public.mushaf_annotations to authenticated',
  'alter table public.mushaf_annotations enable row level security',
  'to authenticated',
  '(select auth.uid()) = user_id',
]) {
  mustInclude(migration, token, 'preview migration')
}

for (const token of [
  'MUSHAF_1441_TEST_ACCESS_TOKEN',
  '/rest/v1/mushaf_annotations',
  "annotation_type: 'note'",
  "annotation_type: 'highlight'",
  "annotation_type: 'bookmark'",
  "annotation_type: 'favorite'",
  'expectRequestFailure',
  'invalid word target without word_id',
  'invalid word-range target without end id',
  'mushaf_annotations_target_shape_check',
  'inserted, read, updated, and deleted',
]) {
  mustInclude(crudVerifier, token, 'Supabase CRUD verifier')
}

console.log('Mushaf 1441 objective source validation passed.')
