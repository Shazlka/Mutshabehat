import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const adapterFile = resolve(root, 'packages/mutshabehat-core/mushafLinkAdapter.ts')
const proposalFile = resolve(root, 'packages/mutshabehat-core/ayah-key-migration-proposal.sql')
const readmeFile = resolve(root, 'packages/mutshabehat-core/README.md')
const viewerFile = resolve(root, 'src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function read(path) {
  assert(existsSync(path), `Missing file: ${path}`)
  return readFileSync(path, 'utf8')
}

const adapterSource = read(adapterFile)
const proposalSource = read(proposalFile)
const readmeSource = read(readmeFile)
const viewerSource = read(viewerFile)

assert(adapterSource.includes('NEXT_PUBLIC_ENABLE_MUSHAF_MUTSHABEHAT_LINK'), 'Adapter must use the required feature flag')
assert(adapterSource.includes('false'), 'Adapter must default the feature flag to false')
assert(adapterSource.includes('getMutshabehatByAyahKey'), 'Adapter must export getMutshabehatByAyahKey')
assert(adapterSource.includes('getHighlightsForPage'), 'Adapter must export getHighlightsForPage')
assert(adapterSource.includes('navigateToAyah'), 'Adapter must export navigateToAyah')
assert(adapterSource.includes('ayahKey'), 'Adapter must use ayahKey mapping')
assert(!adapterSource.includes('normalizeArabic('), 'Adapter must not match by Arabic text')
assert(!adapterSource.includes('.includes(word.textUthmani'), 'Adapter must not match by word text')
assert(!adapterSource.includes('createServerSupabaseClient'), 'Adapter must not directly create a Supabase client in Phase 4')

assert(proposalSource.includes('PROPOSAL ONLY'), 'Migration proposal must be marked proposal only')
assert(proposalSource.includes('DO NOT RUN'), 'Migration proposal must explicitly say not to run it')
assert(proposalSource.includes('ayah_key'), 'Migration proposal must add or backfill ayah_key')
assert(proposalSource.includes('public.verses'), 'Migration proposal must target verses as the current ayah table')

assert(viewerSource.includes('getHighlightsForPage'), 'Viewer must ask adapter for page highlights')
assert(viewerSource.includes('getMutshabehatByAyahKey'), 'Viewer must ask adapter for selected ayah data')
assert(viewerSource.includes('navigateToAyah'), 'Viewer must expose adapter navigation behavior')
assert(viewerSource.includes('mutshabehatPanelAyahKey'), 'Viewer must include a Mutshabehat panel selection state')
assert(
  viewerSource.includes("setActiveDetailTab(hasMutshabehatHighlight ? 'mutshabehat' : 'notes')"),
  'Clicking a highlighted ayah must open the Mutshabehat panel',
)
assert(viewerSource.includes('similarAyat'), 'Viewer panel must account for similar ayat')
assert(viewerSource.includes('groupId'), 'Viewer panel must show or account for groupId')
assert(viewerSource.includes('link.tags'), 'Viewer panel must show Mutshabehat tags when available')

assert(readmeSource.includes('NEXT_PUBLIC_ENABLE_MUSHAF_MUTSHABEHAT_LINK'), 'Mutshabehat core README must document the feature flag')
assert(readmeSource.includes('false'), 'Mutshabehat core README must document disabled default behavior')

console.log('Phase 4 Mushaf Mutshabehat link validation passed.')
