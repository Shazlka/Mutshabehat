import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const moduleDir = dirname(fileURLToPath(import.meta.url))
const schemaPath = resolve(moduleDir, 'schema.json')
const fixturePath = resolve(moduleDir, 'fixtures/sample-page-1.json')
const reportPath = resolve(moduleDir, 'validation-report.json')

function issue(level, code, message, path) {
  return { level, code, message, path }
}

function readJson(path) {
  if (!existsSync(path)) {
    throw new Error(`Missing required file: ${path}`)
  }
  return JSON.parse(readFileSync(path, 'utf8'))
}

function validatePage(page) {
  const issues = []
  const wordIds = new Set()

  if (!Number.isInteger(page.pageNumber) || page.pageNumber < 1 || page.pageNumber > 604) {
    issues.push(issue('error', 'page.range', 'Page number must be an integer from 1 to 604.', 'pageNumber'))
  }

  if (!Array.isArray(page.lines)) {
    issues.push(issue('error', 'lines.required', 'Page must contain a lines array.', 'lines'))
    return { issues, stats: { lineCount: 0, wordCount: 0 } }
  }

  if (page.lines.length !== 15) {
    issues.push(issue('error', 'lines.count', 'Mushaf Al-Madinah pages should contain 15 lines.', 'lines'))
  }

  let wordCount = 0
  let previousLineNumber = 0
  for (const [lineIndex, line] of page.lines.entries()) {
    const linePath = `lines[${lineIndex}]`
    if (line.pageNumber !== page.pageNumber) {
      issues.push(issue('error', 'line.pageNumber', 'Line pageNumber must match parent pageNumber.', `${linePath}.pageNumber`))
    }
    if (!Number.isInteger(line.lineNumber) || line.lineNumber <= 0) {
      issues.push(issue('error', 'line.lineNumber', 'Line number must be a positive integer.', `${linePath}.lineNumber`))
    }
    if (Number.isInteger(line.lineNumber) && line.lineNumber <= previousLineNumber) {
      issues.push(issue('error', 'line.order', 'Line numbers must be strictly increasing.', `${linePath}.lineNumber`))
    }
    previousLineNumber = Number.isInteger(line.lineNumber) ? line.lineNumber : previousLineNumber

    if (!Array.isArray(line.words)) {
      issues.push(issue('error', 'words.required', 'Line must contain a words array.', `${linePath}.words`))
      continue
    }

    let previousWordIndex = 0
    for (const [wordIndex, word] of line.words.entries()) {
      const wordPath = `${linePath}.words[${wordIndex}]`
      wordCount += 1

      if (typeof word.id !== 'string' || word.id.length === 0) {
        issues.push(issue('error', 'word.id', 'Every word must have a non-empty id.', `${wordPath}.id`))
      } else if (wordIds.has(word.id)) {
        issues.push(issue('error', 'word.id.duplicate', `Duplicate word id: ${word.id}`, `${wordPath}.id`))
      } else {
        wordIds.add(word.id)
      }

      if (word.pageNumber !== page.pageNumber) {
        issues.push(issue('error', 'word.pageNumber', 'Word pageNumber must match parent pageNumber.', `${wordPath}.pageNumber`))
      }
      if (word.lineNumber !== line.lineNumber) {
        issues.push(issue('error', 'word.lineNumber', 'Word lineNumber must match parent lineNumber.', `${wordPath}.lineNumber`))
      }
      if (!Number.isInteger(word.wordIndexInLine) || word.wordIndexInLine <= 0) {
        issues.push(issue('error', 'word.index.line', 'Word order in line must be a positive integer.', `${wordPath}.wordIndexInLine`))
      }
      if (Number.isInteger(word.wordIndexInLine) && word.wordIndexInLine <= previousWordIndex) {
        issues.push(issue('error', 'word.order', 'Word order must be stable and strictly increasing inside each line.', `${wordPath}.wordIndexInLine`))
      }
      previousWordIndex = Number.isInteger(word.wordIndexInLine) ? word.wordIndexInLine : previousWordIndex

      if (!Number.isInteger(word.surahNumber) || word.surahNumber <= 0) {
        issues.push(issue('error', 'word.surahNumber', 'Every word must have surahNumber.', `${wordPath}.surahNumber`))
      }
      if (!Number.isInteger(word.ayahNumber) || word.ayahNumber <= 0) {
        issues.push(issue('error', 'word.ayahNumber', 'Every word must have ayahNumber.', `${wordPath}.ayahNumber`))
      }
      if (typeof word.ayahKey !== 'string' || word.ayahKey.length === 0) {
        issues.push(issue('error', 'word.ayahKey', 'Every word must have ayahKey.', `${wordPath}.ayahKey`))
      } else if (word.ayahKey !== `${word.surahNumber}:${word.ayahNumber}`) {
        issues.push(issue('error', 'word.ayahKey.format', 'ayahKey must use surah:ayah format.', `${wordPath}.ayahKey`))
      }
      if (!Number.isInteger(word.wordIndexInAyah) || word.wordIndexInAyah <= 0) {
        issues.push(issue('error', 'word.index.ayah', 'Every word must have wordIndexInAyah.', `${wordPath}.wordIndexInAyah`))
      }
      if (typeof word.textUthmani !== 'string' || word.textUthmani.length === 0) {
        issues.push(issue('error', 'word.textUthmani', 'Every word must have textUthmani.', `${wordPath}.textUthmani`))
      }
    }
  }

  return { issues, stats: { lineCount: page.lines.length, wordCount } }
}

const schema = readJson(schemaPath)
const page = readJson(fixturePath)
const { issues, stats } = validatePage(page)
const errors = issues.filter((item) => item.level === 'error')
const report = {
  generatedAt: new Date().toISOString(),
  module: 'mushaf1441',
  schemaTitle: schema.title ?? null,
  source: 'sample fixture only; not verified Mushaf Al-Madinah 1441 data',
  fixture: 'fixtures/sample-page-1.json',
  passed: errors.length === 0,
  stats,
  issues,
}

writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)

if (errors.length > 0) {
  console.error(`Mushaf 1441 validation failed with ${errors.length} error(s). Report: ${reportPath}`)
  for (const item of errors) console.error(`- ${item.path}: ${item.message}`)
  process.exit(1)
}

console.log(`Mushaf 1441 validation passed. Report: ${reportPath}`)
console.log(`${stats.lineCount} lines, ${stats.wordCount} words checked.`)
