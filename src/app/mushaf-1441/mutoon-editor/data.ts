export type WorkId = 'shatibiyyah' | 'durrah' | 'tayyibah'
export type Verse = { number: number; lines: string[]; printedPage: string | null; pageId: number | null }
export type Chapter = { title: string; farsh: boolean; verses: Verse[] }
export type Work = { work: WorkId; title: string; author: string; bookId: number | null; chapters: Chapter[] }
export type Mutoon = { schemaVersion: 1; works: Work[] }
export type Mark = { work: WorkId; verse: number; line: number; word: string; occurrence: number; mode: 'letter' | 'word'; symbol: string; kind: 'reader' | 'narrator' | 'group'; readingIds: string[]; note: string; source: string; status: 'verified' | 'extracted'; method?: 'hand' | 'match' }
export type Marks = { marks: Mark[] }
export type WordAssignment = { work: WorkId; verse: number; line: number; word: string; occurrence: number; mode?: 'letter' | 'word'; letterIndex?: number; readingIds: string[]; note: string; source: string }
export type Assignments = { schemaVersion: 1; assignments: WordAssignment[] }
export type EditorData = { mutoon: Mutoon; marks: Marks; assignments: Assignments }
export const WORK_IDS: WorkId[] = ['shatibiyyah', 'durrah', 'tayyibah']
export const READER_NAMES = [
  ['نافع', 'قالون', 'ورش'], ['ابن كثير', 'البزي', 'قنبل'], ['أبو عمرو', 'الدوري عن أبي عمرو', 'السوسي'],
  ['ابن عامر', 'هشام', 'ابن ذكوان'], ['عاصم', 'شعبة', 'حفص'], ['حمزة', 'خلف عن حمزة', 'خلاد'],
  ['الكسائي', 'أبو الحارث', 'الدوري عن الكسائي'], ['أبو جعفر', 'ابن وردان', 'ابن جماز'],
  ['يعقوب', 'رويس', 'روح'], ['خلف العاشر', 'إسحاق', 'إدريس'],
]
export const AUTHORITIES = READER_NAMES.flatMap(([reader, first, second], index) => {
  const id = `Q${String(index + 1).padStart(2, '0')}`
  return [{ id, name: reader }, { id: `${id}-R01`, name: first }, { id: `${id}-R02`, name: second }]
})

export type ClassicalGroup = {
  id: string
  name: string
  readingIds: string[]
  works?: WorkId[]
  description: string
}

export const CLASSICAL_GROUPS: ClassicalGroup[] = [
  { id: 'all10', name: 'العشرة', readingIds: ['Q01','Q02','Q03','Q04','Q05','Q06','Q07','Q08','Q09','Q10'], description: 'جميع القراء العشرة' },
  { id: 'all7', name: 'السبعة', readingIds: ['Q01','Q02','Q03','Q04','Q05','Q06','Q07'], description: 'أئمة الشاطبية' },
  { id: 'all3', name: 'الثلاثة', readingIds: ['Q08','Q09','Q10'], description: 'أئمة الدرة (أبو جعفر، يعقوب، خلف العاشر)' },
  { id: 'sama', name: 'سما', readingIds: ['Q01','Q02','Q03'], description: 'نافع، ابن كثير، أبو عمرو' },
  { id: 'suhbah', name: 'صحبة', readingIds: ['Q06','Q07','Q05-R01'], description: 'حمزة، الكسائي، شعبة' },
  { id: 'sihab', name: 'صحاب', readingIds: ['Q06','Q07','Q05-R02'], description: 'حمزة، الكسائي، حفص' },
  { id: 'am', name: 'عم', readingIds: ['Q01','Q04'], description: 'نافع، ابن عامر' },
  { id: 'harami', name: 'حرمي', readingIds: ['Q01','Q02'], description: 'نافع، ابن كثير' },
  { id: 'haqq', name: 'حق', readingIds: ['Q02','Q03'], description: 'ابن كثير، أبو عمرو' },
  { id: 'nafar', name: 'نفر', readingIds: ['Q02','Q03','Q04'], description: 'ابن كثير، أبو عمرو، ابن عامر' },
  { id: 'hisn', name: 'حصن', readingIds: ['Q01','Q05','Q06','Q07'], description: 'نافع، عاصم، حمزة، الكسائي' },
  { id: 'kufa', name: 'الكوفيون', readingIds: ['Q05','Q06','Q07'], description: 'عاصم، حمزة، الكسائي' },
  { id: 'basra', name: 'البصريان', readingIds: ['Q03','Q09'], description: 'أبو عمرو، يعقوب' },
  { id: 'kafa', name: 'كفى', readingIds: ['Q05','Q06','Q07','Q10'], description: 'عاصم، حمزة، الكسائي، خلف العاشر' },
  { id: 'shafa', name: 'شفا', readingIds: ['Q06','Q07','Q10'], description: 'حمزة، الكسائي، خلف العاشر' },
  { id: 'kanz', name: 'كنز', readingIds: ['Q05','Q06','Q07','Q10','Q04'], description: 'ابن عامر، عاصم، حمزة، الكسائي، خلف العاشر' },
]
export type Definition = { symbol: string; kind: Mark['kind']; readingIds: string[] }
const triples: Record<WorkId, Array<[number, string]>> = {
  shatibiyyah: [[1,'أبج'],[2,'دهز'],[3,'حطي'],[4,'كلم'],[5,'نصع'],[6,'فضق'],[7,'رست']],
  durrah: [[8,'أبج'],[9,'حطي'],[10,'فضق']],
  tayyibah: [[1,'أبج'],[2,'دهز'],[3,'حطي'],[4,'كلم'],[5,'نصع'],[6,'فضق'],[7,'رست'],[8,'ثخذ'],[9,'ظغش']],
}
const groups: Record<WorkId, Array<[string,string[]]>> = {
  shatibiyyah: [
    ['ث',['Q05','Q06','Q07']],['خ',['Q02','Q03','Q04','Q05','Q06','Q07']],
    ['ذ',['Q04','Q05','Q06','Q07']],['ظ',['Q02','Q05','Q06','Q07']],
    ['غ',['Q03','Q05','Q06','Q07']],['ش',['Q06','Q07']],
    ['صحبة',['Q06','Q07','Q05-R01']],['صحاب',['Q06','Q07','Q05-R02']],
    ['عم',['Q01','Q04']],['سما',['Q01','Q02','Q03']],['حق',['Q02','Q03']],
    ['نفر',['Q02','Q03','Q04']],['حرمي',['Q01','Q02']],['حصن',['Q01','Q05','Q06','Q07']],
  ],
  durrah: [],
  tayyibah: [
    ['كفى',['Q05','Q06','Q07','Q10']],['شفا',['Q06','Q07','Q10']],
    ['صحب',['Q06','Q07','Q10','Q05-R02']],['صحبة',['Q06','Q07','Q10','Q05-R01']],
    ['صفا',['Q10','Q05-R01']],['فتى',['Q06','Q10']],['رضى',['Q06','Q07']],
    ['روى',['Q07','Q10']],['ثوى',['Q08','Q09']],['مدا',['Q01','Q08']],
    ['حما',['Q03','Q09']],['سما',['Q01','Q08','Q02','Q03','Q09']],
    ['حق',['Q02','Q03','Q09']],['حرم',['Q01','Q08','Q02']],
    ['عم',['Q01','Q08','Q04']],['حبر',['Q02','Q03']],
    ['كنز',['Q05','Q06','Q07','Q10','Q04']],
  ],
}
export function definitions(work: WorkId): Definition[] {
  const letters = triples[work].flatMap(([reader, symbols]) => {
    const q = `Q${String(reader).padStart(2,'0')}`
    return [...symbols].map((symbol, index) => ({ symbol, kind: index === 0 ? 'reader' as const : 'narrator' as const, readingIds: [index === 0 ? q : `${q}-R0${index}`] }))
  })
  return [...letters, ...groups[work].map(([symbol, readingIds]) => ({ symbol, kind: 'group' as const, readingIds }))]
}
export function key(text: string): string {
  return text.normalize('NFC').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[\u0640\u064b-\u065f\u0670\u06d6-\u06ed\s]/g,'')
}
export function wordKey(text: string): string {
  let letters = key(text)
  if (letters.length > 2 && letters.endsWith('ا')) letters = letters.slice(0,-1)
  if (letters.length > 1 && letters.endsWith('ي')) letters = letters.slice(0,-1) + 'ا'
  if (letters.length > 2 && letters.endsWith('ا')) letters = letters.slice(0,-1)
  return letters
}
export function definitionFor(work: WorkId, symbol: string): Definition | undefined {
  return definitions(work).find(d => key(d.symbol) === key(symbol)) ?? definitions(work).find(d => key(d.symbol).length > 1 && wordKey(d.symbol) === wordKey(symbol))
}
export function findWord(line: string, word: string, occurrence: number): string | null {
  const words = line.split(/\s+/).filter(Boolean).map(w => w.replace(/[^\p{L}\p{M}\u0640]/gu, ''))
  const exact = words.filter(w => w === word)
  const matching = exact.length ? exact : words.filter(w => key(w) === key(word))
  return matching[occurrence - 1] ?? null
}
export function validateMark(mark: Mark, verse: Verse): string | null {
  if (!verse.lines[mark.line]) return 'الشطر غير موجود'
  if (!Number.isInteger(mark.occurrence) || mark.occurrence < 1 || !findWord(verse.lines[mark.line],mark.word,mark.occurrence)) return 'الكلمة غير موجودة في الشطر'
  const definition = definitionFor(mark.work,mark.symbol)
  if (!definition) return 'الرمز غير معرّف في هذا المتن'
  if (definition.kind !== mark.kind || definition.readingIds.slice().sort().join() !== mark.readingIds.slice().sort().join()) return 'القراء أو الرواة لا يوافقون تعريف الرمز'
  const word = findWord(verse.lines[mark.line],mark.word,mark.occurrence)!
  const letterSymbol = key(definition.symbol).length === 1
  if (letterSymbol && (mark.mode !== 'letter' || key(word)[0] !== key(mark.symbol))) return 'الحرف لا يبدأ الكلمة المحددة'
  if (!letterSymbol && (mark.mode !== 'word' || wordKey(word) !== wordKey(mark.symbol))) return 'الكلمة لا توافق الرمز'
  if (mark.status === 'verified' && !mark.source.trim()) return 'أضف مصدر التحقق قبل اعتماد الرمز'
  return null
}
export function wordLetters(word: string): string[] {
  return Array.from(new Intl.Segmenter('ar', { granularity: 'grapheme' }).segment(word), part => part.segment).filter(part => /\p{L}/u.test(part))
}
export function validateAssignment(assignment: WordAssignment, verse: Verse): string | null {
  if (!Number.isInteger(assignment.line) || !verse.lines[assignment.line]) return 'الشطر غير موجود'
  if (typeof assignment.word !== 'string' || !Number.isInteger(assignment.occurrence) || assignment.occurrence < 1 || !findWord(verse.lines[assignment.line], assignment.word, assignment.occurrence)) return 'الكلمة غير موجودة في الشطر'
  const mode = assignment.mode ?? 'word'
  if (mode !== 'word' && mode !== 'letter') return 'اختر الحرف أو الكلمة كاملة'
  if (mode === 'letter' && (!Number.isInteger(assignment.letterIndex) || assignment.letterIndex! < 0 || assignment.letterIndex! >= wordLetters(findWord(verse.lines[assignment.line], assignment.word, assignment.occurrence)!).length)) return 'الحرف المحدد غير موجود في الكلمة'
  if (!Array.isArray(assignment.readingIds) || assignment.readingIds.length === 0 || new Set(assignment.readingIds).size !== assignment.readingIds.length || assignment.readingIds.some(id => typeof id !== 'string' || !AUTHORITIES.some(a => a.id === id))) return 'اختر قارئًا أو راويًا معروفًا دون تكرار'
  if (typeof assignment.note !== 'string' || typeof assignment.source !== 'string') return 'الملاحظة أو المصدر غير صالح'
  return null
}
export function validateDocuments(mutoon: unknown, marks: unknown, assignments: unknown = { schemaVersion: 1, assignments: [] }): EditorData {
  if (!mutoon || typeof mutoon !== 'object' || (mutoon as Mutoon).schemaVersion !== 1 || !Array.isArray((mutoon as Mutoon).works)) throw new Error('ملف المتون غير صالح')
  if (!marks || typeof marks !== 'object' || !Array.isArray((marks as Marks).marks)) throw new Error('ملف الرموز غير صالح')
  const doc = mutoon as Mutoon
  const workSet = new Set(doc.works.map(w => w.work))
  if (WORK_IDS.some(id => !workSet.has(id))) throw new Error('يلزم وجود المتون الثلاثة')
  for (const work of doc.works) for (const chapter of work.chapters) for (const verse of chapter.verses) {
    if (!Number.isInteger(verse.number) || !Array.isArray(verse.lines) || verse.lines.length < 1 || verse.lines.length > 2 || verse.lines.some(line => typeof line !== 'string' || !line.trim())) throw new Error(`بيت غير صالح: ${work.work} ${verse.number}`)
  }
  for (const mark of (marks as Marks).marks) {
    if (!WORK_IDS.includes(mark.work) || !Number.isInteger(mark.verse) || !Number.isInteger(mark.line) || typeof mark.word !== 'string' || typeof mark.symbol !== 'string' || !Array.isArray(mark.readingIds) || !['letter','word'].includes(mark.mode) || !['verified','extracted'].includes(mark.status)) throw new Error('ملف الرموز يحتوي علامة غير صالحة')
  }
  if (!assignments || typeof assignments !== 'object' || (assignments as Assignments).schemaVersion !== 1 || !Array.isArray((assignments as Assignments).assignments)) throw new Error('ملف تعيينات الكلمات غير صالح')
  for (const assignment of (assignments as Assignments).assignments) {
    if (!WORK_IDS.includes(assignment.work) || !Number.isInteger(assignment.verse)) throw new Error('تعيين قارئ أو راوٍ غير صالح')
    const verse = verseFor(doc, assignment.work, assignment.verse)
    if (!verse) throw new Error(`بيت غير موجود: ${assignment.work} ${assignment.verse}`)
    const problem = validateAssignment(assignment, verse)
    if (problem) throw new Error(`${assignment.work} ${assignment.verse}: ${problem}`)
  }
  return { mutoon: doc, marks: marks as Marks, assignments: assignments as Assignments }
}
export function verseFor(doc: Mutoon, work: WorkId, number: number): Verse | undefined {
  return doc.works.find(w => w.work === work)?.chapters.flatMap(c => c.verses).find(v => v.number === number)
}

export function replaceWordInLine(line: string, oldWord: string, occurrence: number, newWord: string): string {
  const parts = line.split(/(\s+)/)
  let count = 0
  for (let i = 0; i < parts.length; i++) {
    const token = parts[i]
    if (!token.trim()) continue
    const plain = token.replace(/[^\p{L}\p{M}\u0640]/gu, '')
    if (plain === oldWord || key(plain) === key(oldWord)) {
      count++
      if (count === occurrence) {
        parts[i] = token.replace(plain, newWord)
        return parts.join('')
      }
    }
  }
  return line
}

export function insertWordInLine(line: string, wordIndex: number, newWord: string, position: 'before' | 'after' = 'after'): string {
  const tokens = line.split(/\s+/).filter(Boolean)
  if (wordIndex < 0 || wordIndex > tokens.length) {
    return `${line} ${newWord}`.trim()
  }
  const insertAt = position === 'before' ? wordIndex : wordIndex + 1
  tokens.splice(insertAt, 0, newWord)
  return tokens.join(' ')
}

export function deleteWordInLine(line: string, wordIndex: number): string {
  const tokens = line.split(/\s+/).filter(Boolean)
  if (wordIndex >= 0 && wordIndex < tokens.length) {
    tokens.splice(wordIndex, 1)
  }
  return tokens.join(' ')
}

export type MatnSymbolAnnotation = {
  work: WorkId
  verse: number
  line: number
  start: number
  end: number
  text: string
  symbol: string
  kind: 'reader' | 'narrator' | 'group'
  readingIds: string[]
  note: string
  source: string
  status: 'verified' | 'extracted'
  method: 'hand' | 'match'
  /** 'symbol' = a poem's own reader/narrator symbol (checked against its dictionary); 'assignment' = a reader or narrator
   *  assigned to a word by hand in the editor (no dictionary: the iOS app checks only that the text is where it says). */
  origin: 'symbol' | 'assignment'
}

export function lineGraphemes(line: string): string[] {
  const segmenter = new Intl.Segmenter('ar', { granularity: 'grapheme' })
  return Array.from(segmenter.segment(line), s => s.segment)
}

export function locateWordGraphemes(line: string, targetWord: string, occurrence = 1): { start: number; end: number } | null {
  const chars = lineGraphemes(line)
  const spans: Array<{ start: number; end: number }> = []
  let start: number | null = null

  for (let i = 0; i <= chars.length; i++) {
    const c = chars[i] ?? ' '
    if (/\s/.test(c)) {
      if (start !== null) {
        let end = i
        while (end > start && !/\p{L}/u.test(chars[end - 1])) {
          end--
        }
        spans.push({ start, end })
        start = null
      }
    } else if (start === null) {
      start = i
    }
  }

  const exact = spans.filter(s => chars.slice(s.start, s.end).join('') === targetWord)
  const matched = exact.length > 0 ? exact : spans.filter(s => key(chars.slice(s.start, s.end).join('')) === key(targetWord))
  return matched[occurrence - 1] ?? null
}

export function compileVerse(work: WorkId, verseNumber: number, lines: string[], marks: Mark[], assignments: WordAssignment[]): MatnSymbolAnnotation[] {
  const annotations: MatnSymbolAnnotation[] = []
  const seenSlots = new Set<string>()

  // 1. Hand assignments first: they take precedence over a poem symbol on the same letter.
  for (const a of assignments) {
    const line = lines[a.line]
    if (line === undefined) continue
    const span = locateWordGraphemes(line, a.word, a.occurrence)
    if (!span) continue

    const chars = lineGraphemes(line)
    let start = span.start
    let end = span.end

    if (a.mode === 'letter') {
      const wordChars = chars.slice(span.start, span.end)
      const letterIdx = Math.min(a.letterIndex ?? 0, Math.max(0, wordChars.length - 1))
      start = span.start + letterIdx
      end = start + 1
    }

    const text = chars.slice(start, end).join('')
    const isSingleReader = a.readingIds.length === 1 && !a.readingIds[0].includes('-')
    const isSingleNarrator = a.readingIds.length === 1 && a.readingIds[0].includes('-')
    const kind: 'reader' | 'narrator' | 'group' = isSingleReader ? 'reader' : isSingleNarrator ? 'narrator' : 'group'

    seenSlots.add(`${work}:${verseNumber}:${a.line}:${start}`)

    annotations.push({
      work, verse: verseNumber, line: a.line, start, end, text, symbol: text, kind,
      readingIds: a.readingIds, note: a.note || '', source: a.source || '',
      status: 'verified', method: 'hand', origin: 'assignment',
    })
  }

  // 2. Poem symbols.
  for (const m of marks) {
    const line = lines[m.line]
    if (line === undefined) continue
    const span = locateWordGraphemes(line, m.word, m.occurrence)
    if (!span) continue

    const chars = lineGraphemes(line)
    const start = span.start
    const end = m.mode === 'letter' ? start + 1 : span.end

    const slotKey = `${work}:${verseNumber}:${m.line}:${start}`
    if (seenSlots.has(slotKey)) continue // an assignment on the same spot wins
    seenSlots.add(slotKey)

    annotations.push({
      work, verse: verseNumber, line: m.line, start, end, text: chars.slice(start, end).join(''), symbol: m.symbol,
      kind: m.kind, readingIds: m.readingIds, note: m.note || '', source: m.source || '',
      status: m.status, method: m.method ?? 'hand', origin: 'symbol',
    })
  }

  return annotations.sort((a, b) => a.line - b.line || a.start - b.start)
}

export function compileAnnotations(doc: EditorData): MatnSymbolAnnotation[] {
  const marksByVerse = new Map<string, Mark[]>()
  for (const m of doc.marks.marks) {
    const k = `${m.work}:${m.verse}`
    marksByVerse.set(k, [...(marksByVerse.get(k) ?? []), m])
  }
  const assignmentsByVerse = new Map<string, WordAssignment[]>()
  for (const a of doc.assignments.assignments) {
    const k = `${a.work}:${a.verse}`
    assignmentsByVerse.set(k, [...(assignmentsByVerse.get(k) ?? []), a])
  }
  const all: MatnSymbolAnnotation[] = []
  for (const w of doc.mutoon.works) {
    for (const c of w.chapters) {
      for (const v of c.verses) {
        const k = `${w.work}:${v.number}`
        if (!marksByVerse.has(k) && !assignmentsByVerse.has(k)) continue
        all.push(...compileVerse(w.work, v.number, v.lines, marksByVerse.get(k) ?? [], assignmentsByVerse.get(k) ?? []))
      }
    }
  }
  return all.sort((a, b) => a.work.localeCompare(b.work) || a.verse - b.verse || a.line - b.line || a.start - b.start)
}

/** The words of a hemistich as the editor offers them: letters only, with how many times the same word came before. */
export function candidates(line: string): Array<{ text: string; occurrence: number; indexInLine: number }> {
  const counts = new Map<string, number>()
  return line.split(/\s+/).filter(Boolean).map((text, indexInLine) => {
    const plain = text.replace(/[^\p{L}\p{M}\u0640]/gu, '')
    const occurrence = (counts.get(plain) ?? 0) + 1
    counts.set(plain, occurrence)
    return { text: plain, occurrence, indexInLine }
  }).filter(c => c.text)
}

/** Whether a stored mark or assignment is about this word of this hemistich. */
export function rowIsAboutWord(row: { line: number; word: string; occurrence: number }, lineText: string, ref: { line: number; word: string; occurrence: number }): boolean {
  return row.line === ref.line && row.occurrence === ref.occurrence && findWord(lineText, row.word, row.occurrence) === ref.word
}
