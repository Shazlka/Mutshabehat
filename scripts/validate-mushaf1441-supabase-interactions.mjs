import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const SCHEMA_PATH = join(ROOT, 'packages/quran-data/mushaf1441/supabase-interactions-schema-proposal.sql')
const PREVIEW_MIGRATION_PATH = join(ROOT, 'supabase/migrations/20260628000000_mushaf_annotations_preview.sql')
const ANNOTATIONS_API_PATH = join(ROOT, 'src/app/api/mushaf-1441/annotations/route.ts')
const MUTSHABEHAT_API_PATH = join(ROOT, 'src/app/api/mushaf-1441/mutshabehat/route.ts')
const TYPES_PATH = join(ROOT, 'packages/quran-data/mushaf1441/types.ts')
const CRUD_VERIFIER_PATH = join(ROOT, 'scripts/verify-mushaf1441-supabase-crud.mjs')

function fail(message) {
  console.error(`Mushaf 1441 Supabase interaction validation failed: ${message}`)
  process.exit(1)
}

const schema = readFileSync(SCHEMA_PATH, 'utf8')
const previewMigration = readFileSync(PREVIEW_MIGRATION_PATH, 'utf8')
const annotationsApi = readFileSync(ANNOTATIONS_API_PATH, 'utf8')
const mutshabehatApi = readFileSync(MUTSHABEHAT_API_PATH, 'utf8') + readFileSync(join(ROOT, 'src/lib/mushaf-mutshabehat.ts'), 'utf8')
const types = readFileSync(TYPES_PATH, 'utf8')
const crudVerifier = readFileSync(CRUD_VERIFIER_PATH, 'utf8')

for (const required of [
  'create table if not exists public.mushaf_annotations',
  "annotation_type in ('note', 'highlight', 'bookmark', 'favorite')",
  "target_type in ('ayah', 'word', 'word-range')",
  'ayah_key text not null',
  'text_color text',
  'background_color text',
  'mushaf_annotations_target_shape_check',
  "target_type <> 'word'",
  'word_id is not null',
  'line_number is not null',
  'word_index_in_line is not null',
  "target_type <> 'word-range'",
  'word_range_start_id is not null',
  'word_range_end_id is not null',
  'grant select, insert, update, delete on public.mushaf_annotations to authenticated',
  'enable row level security',
  'to authenticated',
  '(select auth.uid()) = user_id',
]) {
  if (!schema.includes(required)) fail(`schema missing ${required}`)
}

for (const required of [
  'Preview migration for Mushaf 1441 annotations',
  'apply only to a Supabase preview/development branch',
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
  'enable row level security',
  'to authenticated',
  '(select auth.uid()) = user_id',
]) {
  if (!previewMigration.includes(required)) fail(`preview migration missing ${required}`)
}

for (const required of [
  "const TABLE = 'mushaf_annotations'",
  'createServerSupabaseClient',
  'mushaf_annotations table is not installed yet',
  'annotationType',
  'targetType',
  'pageNumber',
  'toAnnotation',
  'annotation_type',
  'background_color',
  'permission denied',
  'Supabase authentication is unavailable for the Mushaf 1441 preview',
  'Supabase configuration is unavailable for the Mushaf 1441 preview',
  'validateAnnotationTarget',
  'word target requires wordId',
  'word-range target requires wordRangeStartId and wordRangeEndId',
  'lineNumber must be 1-15',
  'wordIndexInLine must be a positive integer',
  'DELETE',
]) {
  if (!annotationsApi.includes(required)) fail(`annotations API missing ${required}`)
}

for (const required of [
  "from('groups')",
  'verses(surah, ayah, label), group_tags(tags(name))',
  'toAyahKey',
  'getTagNames',
  'ayahKeys',
  'tags',
  'getSessionUser',
  'Supabase configuration is unavailable for the Mushaf 1441 preview',
  'similarAyat',
]) {
  if (!mutshabehatApi.includes(required)) fail(`Mutshabehat API missing ${required}`)
}

for (const required of [
  'MushafAnnotationType',
  "'note' | 'highlight' | 'bookmark' | 'favorite'",
  'MushafAnnotationTargetType',
  'MushafAnnotation',
  'word-range',
]) {
  if (!types.includes(required)) fail(`types missing ${required}`)
}

for (const required of [
  'MUSHAF_1441_TEST_ACCESS_TOKEN',
  '/rest/v1/mushaf_annotations',
  "annotation_type: 'note'",
  "annotation_type: 'highlight'",
  "annotation_type: 'bookmark'",
  "annotation_type: 'favorite'",
  "target_type: 'word-range'",
  'return=representation',
  'expectRequestFailure',
  'invalid word target without word_id',
  'invalid word-range target without end id',
  'mushaf_annotations_target_shape_check',
  'inserted, read, updated, and deleted',
]) {
  if (!crudVerifier.includes(required)) fail(`CRUD verifier missing ${required}`)
}

for (const required of [
  'ayahHighlightAnnotation',
  'wordHighlightAnnotation',
  'rangeHighlightAnnotation',
  'isWordInsideAnnotationRange',
  'wordRangeStartId',
  "annotation.targetType === 'ayah'",
  'async function deleteAnnotation',
  'تحتاج إلى تسجيل الدخول لحذف التعديلات من Supabase.',
  'const deleted = await deleteAnnotation',
]) {
  if (!readFileSync(join(ROOT, 'src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx'), 'utf8').includes(required)) {
    fail(`viewer missing persisted ayah highlight behavior: ${required}`)
  }
}

console.log('Mushaf 1441 Supabase interaction validation passed.')
