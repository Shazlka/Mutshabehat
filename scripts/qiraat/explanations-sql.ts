// Generates idempotent, additive explanation SQL from explanations.ts output.
// Usage: npx tsx scripts/qiraat/explanations-sql.ts <explanations.json> <out.sql> [--pages a-b]

import { readFileSync, writeFileSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import type { ExplanationOutput } from './explanations'

const ROOT = join(__dirname, '..', '..')
export const escapeSqlString = (value: string): string => value.replace(/'/g, "''")

export function parsePageRange(value: string | undefined): [number, number] | null {
  if (!value) return null
  const match = /^(\d+)-(\d+)$/.exec(value)
  if (!match) throw new Error(`Invalid --pages range: ${value}`)
  const first = Number(match[1]), last = Number(match[2])
  if (first < 1 || last > 604 || first > last) throw new Error(`Invalid --pages range: ${value}`)
  return [first, last]
}

export function generateExplanationsSql(
  explanations: Readonly<Record<string, ExplanationOutput>>,
  pages: [number, number] | null = null,
): string {
  const selected = Object.entries(explanations).filter(([id]) => {
    if (!pages) return true
    const match = /-p(\d{3})-/.exec(id)
    return Boolean(match && Number(match[1]) >= pages[0] && Number(match[1]) <= pages[1])
  }).sort(([a], [b]) => a.localeCompare(b))
  const rulingIds = selected.filter(([, value]) => value.field === 'ruling_text').map(([id]) => id)
  const variantIds = selected.filter(([, value]) => value.field === 'description_ar').map(([id]) => id)
  const lines = [
    '-- Qiraat Phase 2 additive explanations. Generated from JSON sources only.',
    'BEGIN;',
    "SELECT set_config('app.device_id', 'auto-review', true);",
    '',
  ]
  for (const [id, value] of selected) {
    const table = value.field === 'ruling_text' ? 'qiraat_ruling_details' : 'qiraat_variant_details'
    const column = value.field === 'ruling_text' ? 'text_ar' : 'description_ar'
    lines.push(`UPDATE ${table} SET ${column} = '${escapeSqlString(value.text)}' WHERE entry_id = '${escapeSqlString(id)}' AND btrim(coalesce(${column},'')) = '';`)
  }
  lines.push('', '-- Count rows that now contain the generated values (safe on a repeated run).')
  const clauses: string[] = []
  if (rulingIds.length > 0) clauses.push(`SELECT 'ruling_text' AS field, count(*) AS populated_count FROM qiraat_ruling_details WHERE entry_id IN (${rulingIds.map((id) => `'${escapeSqlString(id)}'`).join(', ')}) AND btrim(coalesce(text_ar,'')) <> ''`)
  if (variantIds.length > 0) clauses.push(`SELECT 'description_ar' AS field, count(*) AS populated_count FROM qiraat_variant_details WHERE entry_id IN (${variantIds.map((id) => `'${escapeSqlString(id)}'`).join(', ')}) AND btrim(coalesce(description_ar,'')) <> ''`)
  lines.push(clauses.length > 0 ? `${clauses.join('\nUNION ALL\n')};` : "SELECT 'none' AS field, 0 AS populated_count;")
  lines.push('', 'COMMIT;', '')
  return lines.join('\n')
}

export function main(argv = process.argv.slice(2)): void {
  const [inputArg, outputArg] = argv.filter((value) => value !== '--pages' && !/^\d+-\d+$/.test(value))
  const pagesAt = argv.indexOf('--pages')
  if (!inputArg || !outputArg) {
    console.error('Usage: npx tsx scripts/qiraat/explanations-sql.ts <explanations.json> <out.sql> [--pages a-b]')
    process.exitCode = 1
    return
  }
  const input = isAbsolute(inputArg) ? inputArg : join(ROOT, inputArg)
  const output = isAbsolute(outputArg) ? outputArg : join(ROOT, outputArg)
  const explanations = JSON.parse(readFileSync(input, 'utf8')) as Record<string, ExplanationOutput>
  writeFileSync(output, generateExplanationsSql(explanations, parsePageRange(pagesAt >= 0 ? argv[pagesAt + 1] : undefined)))
  console.log(`Wrote ${outputArg}.`)
}

if (process.argv[1]?.includes('explanations-sql.ts')) main()
