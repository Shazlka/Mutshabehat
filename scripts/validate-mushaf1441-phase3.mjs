import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const viewerFile = resolve(root, 'src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx')
const proposalFile = resolve(root, 'packages/quran-data/mushaf1441/supabase-notes-schema-proposal.sql')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function read(path) {
  assert(existsSync(path), `Missing file: ${path}`)
  return readFileSync(path, 'utf8')
}

const viewerSource = read(viewerFile)
const proposalSource = read(proposalFile)

assert(viewerSource.includes('localStorage'), 'Viewer must store notes in localStorage only for Phase 3')
assert(viewerSource.includes('MUSHAF_1441_NOTES_STORAGE_KEY'), 'Viewer must use a named localStorage key')
assert(viewerSource.includes('AyahNote'), 'Viewer must use the AyahNote type')
assert(viewerSource.includes('saveNote'), 'Viewer must provide add/edit note behavior')
assert(viewerSource.includes('editNote'), 'Viewer must provide edit note behavior')
assert(viewerSource.includes('deleteNote'), 'Viewer must provide delete note behavior')
assert(viewerSource.includes('selectedAyahKey'), 'Notes must be scoped to selected ayahKey')
assert(viewerSource.includes('lg:block'), 'Desktop notes panel must be available as a side panel')
assert(viewerSource.includes('lg:hidden'), 'Mobile notes panel must be available as a bottom sheet')
assert(viewerSource.includes('fixed inset-x-0 bottom-0'), 'Mobile notes panel must be anchored as a bottom sheet')
assert(viewerSource.includes('env(safe-area-inset-bottom)'), 'Mobile bottom sheet must account for iPhone safe area')

assert(proposalSource.includes('PROPOSAL ONLY'), 'Supabase schema file must be marked proposal only')
assert(proposalSource.includes('DO NOT RUN'), 'Supabase schema file must explicitly say not to run it')
assert(proposalSource.includes('mushaf_ayah_notes'), 'Schema proposal must define future ayah notes table')
assert(proposalSource.includes('ayah_key'), 'Schema proposal must use ayah_key')
assert(!proposalSource.includes('create table public.groups'), 'Schema proposal must not modify existing Mutshabehat tables')

console.log('Phase 3 Mushaf notes validation passed.')
