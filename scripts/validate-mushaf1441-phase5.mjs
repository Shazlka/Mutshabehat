// Phase 5 (superseded 2026-09-16): originally asserted the qiraat-core scaffold stayed an empty
// stub. That milestone is done — this now validates the real Qiraat Ashr integration described in
// docs/qiraat/. Not part of `npm run mushaf:validate` (kept standalone, like the original).
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const viewerFile = resolve(root, 'src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function read(path) {
  assert(existsSync(path), `Missing file: ${path}`)
  return readFileSync(path, 'utf8')
}

const viewerSource = read(viewerFile)

assert(viewerSource.includes("from '../../../../packages/qiraat-core"), 'Viewer must import from qiraat-core')
assert(viewerSource.includes('QiraatMode') || viewerSource.includes("'normal' | 'comparison' | 'riwayah'"), 'Viewer must model the three Qiraat modes (normal/comparison/riwayah)')
assert(viewerSource.includes('BASE_READING'), 'Viewer must reference the Hafs baseline constant, never hard-code "Q05-R02" ad hoc')
assert(viewerSource.includes('comparisonMarkerForWord') && viewerSource.includes('riwayahResolutionForWord'), 'Viewer must render markers through the shared qiraat-core engine/attribution logic, not invent its own')
assert(!viewerSource.includes('لا توجد بيانات قراءات موثقة محملة بعد'), 'Viewer must no longer show the old "no qiraat data" placeholder — real page-1 data is loaded')

console.log('Phase 5 Qiraat validation passed (post-scaffold): viewer wired to the real qiraat-core engine.')
