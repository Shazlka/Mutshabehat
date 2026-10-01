/** Narrow five source-backed reader attributions to Hisham (Q04-R01).
 * The source notes explicitly say «وكذا هشام»; they do not authorize Ibn Dhakwan.
 */
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const targets = new Map([
  [226, ['r-p226-024-1']],
  [228, ['r-p228-027-1']],
  [242, ['r-p242-026-1', 'r-p242-027-1']],
  [244, ['r-p244-023-1']],
])
let changed = 0
let unchanged = 0
for (const [page, ids] of targets) {
  const file = path.join(root, 'packages/qiraat-core/fixtures/rulings', `page-${String(page).padStart(3, '0')}.json`)
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'))
  for (const id of ids) {
    const row = rows.find((candidate) => candidate.id === id)
    if (!row) throw new Error(`Missing guarded Q04 fixture ${id}`)
    if (!row.notes?.includes('هشام')) throw new Error(`${id} has no explicit Hisham source note`)
    if (!row.readings?.some((item) => item.readingId === 'Q04-R01')) throw new Error(`${id} lacks Q04-R01 reading`)
    const q04 = row.attribution?.find((item) => item.authorityId === 'Q04')
    if (q04) {
      q04.authorityId = 'Q04-R01'
      changed += 1
    } else if (row.attribution?.some((item) => item.authorityId === 'Q04-R01')) {
      unchanged += 1
    } else {
      throw new Error(`${id} lacks Q04/Q04-R01 attribution`)
    }
  }
  fs.writeFileSync(file, `${JSON.stringify(rows, null, 2)}\n`)
}
if (changed !== 5 && !(changed === 0 && unchanged === 5)) throw new Error(`Expected exactly 5 source-backed Q04 repairs, changed=${changed}, unchanged=${unchanged}`)
console.log(JSON.stringify({ records: 5, changed, unchanged, pages: [...targets.keys()] }))
