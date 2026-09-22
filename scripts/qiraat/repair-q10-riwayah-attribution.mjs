/**
 * Idempotently expands source-backed Q10 (KHALAF10) rulings to both configured
 * narrators. The source tables explicitly name K10; this does not infer any
 * new recitation and intentionally excludes the conflicting page-322 record.
 * The guarded set is 14 records / 28 assignments; the fifteenth original
 * audit event is the page-322 conflict and is deliberately left unresolved.
 */
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const byPage = new Map([
  [319, ['r-p319-005-1']],
  [320, ['r-p320-013-1', 'r-p320-016-1']],
  [321, ['r-p321-001-1', 'r-p321-009-1', 'r-p321-013-1', 'r-p321-014-1', 'r-p321-019-1', 'r-p321-020-1', 'r-p321-022-1', 'r-p321-025-1', 'r-p321-031-1', 'r-p321-033-1', 'r-p321-036-1']],
])
const expected = new Set([...byPage.values()].flat())
let added = 0
let unchanged = 0

for (const [page, ids] of byPage) {
  const file = path.join(root, 'packages/qiraat-core/fixtures/rulings', `page-${String(page).padStart(3, '0')}.json`)
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'))
  for (const id of ids) {
    const row = rows.find((candidate) => candidate.id === id)
    if (!row) throw new Error(`Missing guarded Q10 fixture ${id}`)
    const attribution = row.attribution?.find((item) => item.authorityId === 'Q10')
    if (!attribution) throw new Error(`${id} lacks source Q10 attribution`)
    const action = attribution.action
    const existing = new Set((row.readings ?? []).filter((item) => item.readingId?.startsWith('Q10-')).map((item) => item.readingId))
    for (const readingId of ['Q10-R01', 'Q10-R02']) {
      if (existing.has(readingId)) {
        unchanged += 1
        continue
      }
      row.readings.push({ readingId, action, isDefault: true })
      added += 1
    }
  }
  fs.writeFileSync(file, `${JSON.stringify(rows, null, 2)}\n`)
}

if (expected.size !== 14 || added !== 28 && added !== 0) {
  throw new Error(`Guarded repair count mismatch: expected 14 records/28 assignments, added=${added}, unchanged=${unchanged}`)
}
console.log(JSON.stringify({ records: expected.size, added, unchanged, pages: [...byPage.keys()] }))
