// Generates SQL to automatically approve Qiraat entries for tiers A1 and A2.
// Usage:
//   npx tsx scripts/qiraat/auto-review-apply.ts <verdicts.json> <out.sql> [--include-s2]

import { readFileSync, writeFileSync } from 'node:fs'
import { join, isAbsolute } from 'node:path'

const ROOT = join(__dirname, '..', '..')

export interface Verdict {
  id: string
  kind: string
  page: number
  ref: string
  word: string
  tier: 'A2' | 'A1' | 'A-S2' | 'B' | 'C' | 'skip'
  reason: string
  category: string
  subCategory: string
  subCategoryAgreesWithDb: boolean | null
  storedVariantType?: string | null
  narrators: string[]
  s1Groups?: string[]
  s2Confirmed?: string[]
  s2Missing?: string[]
}

export const SUB_CATEGORY_TO_VARIANT_TYPE: Record<string, string> = {
  'تشكيل': 'vowel',
  'إبدال حرف': 'consonant',
  'زيادة': 'addition',
  'حذف': 'omission',
  'تقديم وتأخير': 'word_form',
  'أخرى': 'other',
}

export function mapSubCategoryToVariantType(subCategory: string): string {
  return SUB_CATEGORY_TO_VARIANT_TYPE[subCategory] || subCategory
}

export function escapeSqlString(str: string): string {
  return str.replace(/'/g, "''")
}

export function narratorToBookName(narratorId: string): string {
  if (narratorId === 'Q01-R01') return 'قالون'
  if (narratorId === 'Q01-R02') return 'ورش'
  if (narratorId === 'Q02-R01' || narratorId === 'Q02-R02') return 'ابن كثير'
  if (narratorId === 'Q06-R01' || narratorId === 'Q06-R02') return 'حمزة'
  return narratorId
}

export function buildReviewNote(tier: string, s2Confirmed: string[] = []): string {
  const books = [...new Set((s2Confirmed || []).map(narratorToBookName))].filter(Boolean)
  const booksStr = books.length > 0 ? books.join('، ') : ''

  if (tier === 'A2') {
    return booksStr
      ? `طابق nquran.com وكتاب القراءة المعتمد (${booksStr})`
      : 'طابق nquran.com وكتاب القراءة المعتمد'
  }
  if (tier === 'A1') {
    return 'طابق nquran.com'
  }
  if (tier === 'A-S2') {
    return booksStr
      ? `طابق كتاب القراءة المعتمد (${booksStr})`
      : 'طابق كتاب القراءة المعتمد'
  }
  return ''
}

export function getReviewSource(tier: string): string | null {
  if (tier === 'A1') return 'auto:nquran'
  if (tier === 'A2') return 'auto:nquran+book'
  if (tier === 'A-S2') return 'auto:book'
  return null
}

export interface GenerateSqlOptions {
  includeS2?: boolean
}

export function generateApplySql(verdicts: Verdict[], options: GenerateSqlOptions = {}): string {
  const allowedTiers = new Set(options.includeS2 ? ['A2', 'A1', 'A-S2'] : ['A2', 'A1'])

  // 1. Identify farsh entries queued for human:
  // stored variant_type is non-'other' AND differs from derived sub-category
  const queuedForHuman: { id: string; ref: string; word: string; stored: string; derived: string }[] = []

  for (const v of verdicts) {
    if (v.kind === 'variant') {
      const derived = mapSubCategoryToVariantType(v.subCategory)
      const stored = v.storedVariantType
      if (stored && stored !== 'other' && stored !== derived) {
        queuedForHuman.push({
          id: v.id,
          ref: v.ref,
          word: v.word,
          stored,
          derived,
        })
      }
    }
  }

  // 2. Filter verdicts to approve
  const approvedVerdicts = verdicts.filter((v) => allowedTiers.has(v.tier))

  const lines: string[] = []

  // Comment block header
  lines.push('-- ============================================================================')
  lines.push('-- Qiraat Automatic Review Approval SQL («معتمد آليًا»)')
  lines.push(`-- Generated: ${new Date().toISOString()}`)
  lines.push(`-- Total verdicts: ${verdicts.length}, Approved in this script: ${approvedVerdicts.length}`)
  lines.push('-- ============================================================================')

  if (queuedForHuman.length > 0) {
    lines.push('--')
    lines.push('-- Queued for human review:')
    lines.push('-- Farsh entries whose derived sub-category differs from stored non-other variant_type')
    lines.push('-- (These are NOT modified by this script)')
    for (const q of queuedForHuman) {
      lines.push(`--   ${q.id} (ref: ${q.ref}, word: ${q.word}): stored='${q.stored}' != derived='${q.derived}'`)
    }
    lines.push('--')
  }

  lines.push('BEGIN;\n')
  lines.push("SELECT set_config('app.device_id', 'auto-review', true);\n")

  // Entry approval updates
  lines.push('-- 1. Approve entries (tiers A1, A2)')
  for (const v of approvedVerdicts) {
    const source = getReviewSource(v.tier)
    const note = buildReviewNote(v.tier, v.s2Confirmed)
    lines.push(
      `UPDATE qiraat_entries SET review_status = 'reviewed', review_source = '${escapeSqlString(source ?? '')}', review_note = '${escapeSqlString(note)}' WHERE id = '${escapeSqlString(v.id)}' AND review_status = 'unreviewed' AND deleted_at IS NULL;`
    )
  }

  // Farsh variant_type updates: only for entries whose stored variant_type is 'other'
  lines.push('\n-- 2. Update farsh variant_type (for stored variant_type = other ONLY)')
  for (const v of approvedVerdicts) {
    if (v.kind === 'variant') {
      const derived = mapSubCategoryToVariantType(v.subCategory)
      const stored = v.storedVariantType ?? (v.subCategoryAgreesWithDb === false ? 'other' : null)
      if (stored === 'other' && derived && derived !== 'other') {
        lines.push(
          `UPDATE qiraat_variant_details SET variant_type = '${escapeSqlString(derived)}' WHERE entry_id = '${escapeSqlString(v.id)}' AND variant_type = 'other';`
        )
      }
    }
  }

  // Final SELECT to report counts per tier
  lines.push('\n-- 3. Print count of approved entries per tier')
  if (approvedVerdicts.length > 0) {
    const idsList = approvedVerdicts.map((v) => `'${escapeSqlString(v.id)}'`).join(',\n    ')
    lines.push('SELECT review_source, count(*) AS approved_count')
    lines.push('FROM qiraat_entries')
    lines.push('WHERE id IN (')
    lines.push(`    ${idsList}`)
    lines.push('  )')
    lines.push("  AND review_status = 'reviewed'")
    lines.push('GROUP BY review_source')
    lines.push('ORDER BY review_source;\n')
  } else {
    lines.push("SELECT 'none' AS review_source, 0 AS approved_count;\n")
  }

  lines.push('COMMIT;\n')

  return lines.join('\n')
}

export function main() {
  const args = process.argv.slice(2)
  const includeS2 = args.includes('--include-s2')
  const positional = args.filter((a) => !a.startsWith('--'))
  const [verdictsPath, outSqlPath] = positional

  if (!verdictsPath || !outSqlPath) {
    console.error('Usage: npx tsx scripts/qiraat/auto-review-apply.ts <verdicts.json> <out.sql> [--include-s2]')
    process.exit(1)
  }

  const inFullPath = isAbsolute(verdictsPath) ? verdictsPath : join(ROOT, verdictsPath)
  const outFullPath = isAbsolute(outSqlPath) ? outSqlPath : join(ROOT, outSqlPath)

  const raw = JSON.parse(readFileSync(inFullPath, 'utf8'))
  const verdicts: Verdict[] = Array.isArray(raw) ? raw : (raw.verdicts ?? [])

  const sql = generateApplySql(verdicts, { includeS2 })
  writeFileSync(outFullPath, sql, 'utf8')
  console.log(`Wrote ${outSqlPath} (${verdicts.length} verdicts processed).`)
}

if (process.argv[1] && process.argv[1].includes('auto-review-apply')) {
  main()
}
