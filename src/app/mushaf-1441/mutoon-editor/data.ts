export type WorkId = 'shatibiyyah' | 'durrah' | 'tayyibah'
export type Verse = { number: number; lines: string[]; printedPage: string | null; pageId: number | null }
export type Chapter = { title: string; farsh: boolean; verses: Verse[] }
export type Work = { work: WorkId; title: string; author: string; bookId: number | null; chapters: Chapter[] }
export type Mutoon = { schemaVersion: 1; works: Work[] }
export type Mark = { work: WorkId; verse: number; line: number; word: string; occurrence: number; mode: 'letter' | 'word'; symbol: string; kind: 'reader' | 'narrator' | 'group'; readingIds: string[]; note: string; source: string; status: 'verified' | 'extracted'; method?: 'hand' | 'match' }
export type Marks = { marks: Mark[] }
export type EditorData = { mutoon: Mutoon; marks: Marks }
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
export function validateDocuments(mutoon: unknown, marks: unknown): EditorData {
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
  return { mutoon: doc, marks: marks as Marks }
}
export function verseFor(doc: Mutoon, work: WorkId, number: number): Verse | undefined {
  return doc.works.find(w => w.work === work)?.chapters.flatMap(c => c.verses).find(v => v.number === number)
}
