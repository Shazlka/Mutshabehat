/**
 * Emits idempotent SQL for the semantic Quran-word registry from committed Mushaf fixtures.
 * It deliberately reads only charTypeName=word: ayah-end and page furniture never receive a
 * canonical word identity. Pipe the default output to psql; use --check in CI.
 */
import { loadMushaf1441Page } from '../../packages/quran-data/mushaf1441/pageLoader'

type CanonicalWord = {
  id: string
  surah: number
  ayah: number
  position: number
  page: number
  line: number
  text: string
}

function key(word: Pick<CanonicalWord, 'surah' | 'ayah' | 'position'>) {
  return `${String(word.surah).padStart(3, '0')}:${String(word.ayah).padStart(3, '0')}:${String(word.position).padStart(3, '0')}`
}

function sql(value: string) {
  return `'${value.replaceAll("'", "''")}'`
}

async function collectWords(): Promise<CanonicalWord[]> {
  const words: CanonicalWord[] = []
  const semanticKeys = new Set<string>()
  const renderIds = new Set<string>()
  for (let pageNumber = 1; pageNumber <= 604; pageNumber += 1) {
    const page = await loadMushaf1441Page(pageNumber)
    if (!page) throw new Error(`Missing Mushaf page fixture ${pageNumber}`)
    for (const line of page.lines) for (const word of line.words) {
      if (word.charTypeName !== undefined && word.charTypeName !== 'word') continue
      const record: CanonicalWord = {
        id: word.id,
        surah: word.surahNumber,
        ayah: word.ayahNumber,
        position: word.wordIndexInAyah,
        page: word.pageNumber,
        line: word.lineNumber,
        text: word.textUthmani,
      }
      const semanticKey = key(record)
      if (semanticKeys.has(semanticKey)) throw new Error(`Duplicate canonical word key ${semanticKey}`)
      if (renderIds.has(record.id)) throw new Error(`Duplicate current Mushaf word ID ${record.id}`)
      semanticKeys.add(semanticKey)
      renderIds.add(record.id)
      words.push(record)
    }
  }
  return words
}

async function main() {
  const words = await collectWords()
  if (process.argv.includes('--check')) {
    console.log(`Canonical-word fixture validation passed (${words.length} real Quran words, ${words.length} unique semantic keys).`)
    return
  }

  for (let offset = 0; offset < words.length; offset += 500) {
    const chunk = words.slice(offset, offset + 500)
    const values = chunk.map((word) => `(${word.surah},${word.ayah},${word.position},${sql(word.id)},${word.page},${word.line},${sql(word.text)})`).join(',\n')
    process.stdout.write(`INSERT INTO quran_words (surah, ayah, word_position, current_mushaf_word_id, page_number, line_number, text_uthmani) VALUES\n${values}\nON CONFLICT (surah, ayah, word_position) DO NOTHING;\n`)
  }
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
