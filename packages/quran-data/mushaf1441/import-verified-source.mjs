import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const sourceArg = process.argv[2]

if (!sourceArg) {
  console.error('Usage: node packages/quran-data/mushaf1441/import-verified-source.mjs <verified-source-file>')
  console.error('No import was run. A verified Mushaf Al-Madinah 1441 page/line/word source is required.')
  process.exit(1)
}

const sourcePath = resolve(process.cwd(), sourceArg)

if (!existsSync(sourcePath)) {
  console.error(`Source file not found: ${sourcePath}`)
  process.exit(1)
}

console.error('Import placeholder only. No data was imported.')
console.error('Before enabling import, document the source license, verification method, page/line/word format, and review owner.')
process.exit(1)
