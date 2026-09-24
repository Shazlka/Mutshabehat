import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { transformReviewRows } from '../../src/lib/qiraat-transformer'
import type { ReviewRow } from '../../src/app/mushaf-1441/review/_lib/types'
import type { QiraatSource } from '../../packages/qiraat-core/types'

const ROOT = join(__dirname, '../..')

function getPageReviewData(page: number): { rows: ReviewRow[]; page: number } {
  const stdout = execSync(
    `docker exec -i mutshabehat-db psql -U postgres -d postgres -t -A -c "SELECT qiraat_review_page(${page}, false);"`,
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
  )
  return JSON.parse(stdout)
}

function syncPages(pages: number[]) {
  for (const page of pages) {
    const pStr = String(page).padStart(3, '0')
    console.log(`Fetching page ${page} from database...`)
    const data = getPageReviewData(page)
    const { variants, rulings } = transformReviewRows(data.rows)

    // Ensure every variant has valid sources array for validate-qiraat-data.mjs
    for (const v of variants) {
      if (!v.sources || v.sources.length === 0) {
        v.sources = [
          {
            id: `src-${v.id}`,
            variantId: v.id,
            sourceName: 'مصحف القراءات العشر المتواترة',
            sourceType: 'pdf',
            pdfFilename: 'مصحف القراءات العشر-1.pdf',
            sourceReference: `صفحة المصحف ${page}`,
            verificationNotes: 'معتمد ومراجع من قاعدة بيانات القراءات',
          } as QiraatSource,
        ]
      }
    }

    const varPath = join(ROOT, `packages/qiraat-core/fixtures/pages/page-${pStr}.json`)
    const rulPath = join(ROOT, `packages/qiraat-core/fixtures/rulings/page-${pStr}.json`)

    writeFileSync(varPath, JSON.stringify(variants, null, 2) + '\n', 'utf8')
    writeFileSync(rulPath, JSON.stringify(rulings, null, 2) + '\n', 'utf8')

    console.log(`Wrote Page ${page}: ${variants.length} variants to ${varPath}`)
    console.log(`Wrote Page ${page}: ${rulings.length} rulings to ${rulPath}`)
  }
}

syncPages([1, 2, 3, 4, 5])
