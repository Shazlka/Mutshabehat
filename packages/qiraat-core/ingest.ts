#!/usr/bin/env node
import * as path from 'path'
import * as fs from 'fs'
import { IngestionPipeline, type PageProcessResult } from './ingest/pipeline'

function parseArgs() {
  const args = process.argv.slice(2)
  let pagesArg = '1-40'
  let targetArg: 'staging' | 'prod' = 'staging'
  let dryRun = false
  let inboxDir = path.join(process.env.HOME || '', 'qiraat-inbox/fixtures')

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--pages' && args[i + 1]) {
      pagesArg = args[++i]
    } else if (args[i] === '--target' && args[i + 1]) {
      targetArg = args[++i] as 'staging' | 'prod'
    } else if (args[i] === '--dry-run') {
      dryRun = true
    } else if (args[i] === '--inbox' && args[i + 1]) {
      inboxDir = args[++i]
    }
  }

  const pages: number[] = []
  if (pagesArg.includes('-')) {
    const [start, end] = pagesArg.split('-').map(Number)
    for (let p = start; p <= end; p++) pages.push(p)
  } else if (pagesArg.includes(',')) {
    pages.push(...pagesArg.split(',').map(Number))
  } else {
    pages.push(Number(pagesArg))
  }

  return { pages, target: targetArg, dryRun, inboxDir }
}

async function main() {
  const { pages, target, dryRun, inboxDir } = parseArgs()
  const repoFixturesDir = path.join(__dirname, 'fixtures')

  console.log(`[INGEST] Target: ${target} | DryRun: ${dryRun} | Pages: ${pages[0]}..${pages[pages.length - 1]} | Inbox: ${inboxDir}`)

  const pipeline = new IngestionPipeline({
    pages,
    target,
    dryRun,
    inboxDir,
    repoFixturesDir,
  })

  const results: PageProcessResult[] = []

  let totalVariants = 0
  let totalRules = 0
  let totalCorroborated = 0
  let totalGapFilled = 0
  let totalConflicts = 0
  let totalUnmatched = 0
  let totalDoneEmpty = 0
  let totalMissing = 0

  for (const page of pages) {
    const res = await pipeline.processPage(page)
    results.push(res)

    totalVariants += res.variantCount
    totalRules += res.ruleCount
    totalCorroborated += res.corroboratedCount
    totalGapFilled += res.gapFilledCount
    totalConflicts += res.conflictCount
    totalUnmatched += res.unmatchedCount

    if (res.status === 'done-empty') totalDoneEmpty++
    if (res.status === 'missing') totalMissing++

    console.log(
      `P${String(page).padStart(3, '0')}: ${res.status.toUpperCase()} | variants=${res.variantCount} rules=${res.ruleCount} corr=${res.corroboratedCount} gap=${res.gapFilledCount} conf=${res.conflictCount} unmatch=${res.unmatchedCount}`
    )
  }

  console.log('\n--- TOTALS ---')
  console.log(`Pages Processed: ${pages.length}`)
  console.log(`Variants: ${totalVariants} | Rules: ${totalRules}`)
  console.log(`Corroborated: ${totalCorroborated} | Gap-Filled: ${totalGapFilled}`)
  console.log(`Conflicts: ${totalConflicts} | Unmatched: ${totalUnmatched}`)
  console.log(`Done-Empty: ${totalDoneEmpty} | Missing: ${totalMissing}`)

  // Write reports
  const validationReport = [
    `# Validation Report (Pages ${pages[0]}–${pages[pages.length - 1]})`,
    `**Target:** ${target} | **DryRun:** ${dryRun} | **Date:** ${new Date().toISOString()}`,
    '',
    '## Summary Stats',
    `- Pages Checked: ${pages.length}`,
    `- Farsh Variants: ${totalVariants}`,
    `- Usul Rules: ${totalRules}`,
    `- Corroborated: ${totalCorroborated}`,
    `- Gap Filled: ${totalGapFilled}`,
    `- Conflicts: ${totalConflicts}`,
    `- Unmatched Tokens: ${totalUnmatched}`,
    `- Done-Empty Pages: ${totalDoneEmpty}`,
    `- Missing Pages: ${totalMissing}`,
    '',
    '## Findings & Flags',
    ...results.flatMap((r) => r.flags.map((f) => `- [P${String(r.pageNumber).padStart(3, '0')}] ${f}`)),
  ].join('\n')

  fs.writeFileSync('docs/qiraat/VALIDATION_REPORT.md', validationReport)

  const mergePlanReport = [
    `# Merge Plan (Pages ${pages[0]}–${pages[pages.length - 1]})`,
    `**Target:** ${target} | **DryRun:** ${dryRun} | **Date:** ${new Date().toISOString()}`,
    '',
    '| Page | Status | Variants | Rules | Corroborated | Gap-Filled | Conflicts | Unmatched |',
    '| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |',
    ...results.map(
      (r) =>
        `| ${r.pageNumber} | ${r.status} | ${r.variantCount} | ${r.ruleCount} | ${r.corroboratedCount} | ${r.gapFilledCount} | ${r.conflictCount} | ${r.unmatchedCount} |`
    ),
  ].join('\n')

  fs.writeFileSync('docs/qiraat/MERGE_PLAN.md', mergePlanReport)

  console.log('[INGEST] Generated docs/qiraat/VALIDATION_REPORT.md and docs/qiraat/MERGE_PLAN.md')
}

main().catch((err) => {
  console.error('[INGEST ERROR]', err)
  process.exit(1)
})
