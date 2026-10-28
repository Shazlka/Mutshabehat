// Pure edit logic for the متون editor, shared by the browser (optimistic display, op planning) and the server (validation).
//
// The editor never sends "the document". It sends intents ("toggle نافع on this word") that are turned into a few
// row-level operations against ONE verse, each carrying the version of the row it was planned from. The database applies
// them atomically and refuses a stale version, so two devices can never silently overwrite each other.
import {
  AUTHORITIES,
  candidates,
  definitionFor,
  findWord,
  rowIsAboutWord,
  validateAssignment,
  validateMark,
  wordLetters,
  type Mark,
  type WordAssignment,
  type WorkId,
} from './data'

export type VerseRow = { number: number; lines: string[]; printedPage: string | null; pageId: number | null; version: number }
export type AssignmentRow = WordAssignment & { id: string; version: number }
export type MarkRow = Mark & { id: string; version: number }
/** The شرح of a verse: book text kept in the database, editable here. `version` 0 = none yet. */
export type SharhRow = { text: string; title: string; author: string; pages: string[]; version: number }
export type VerseState = { work: WorkId; chapter?: string; verse: VerseRow; marks: MarkRow[]; assignments: AssignmentRow[]; sharh?: SharhRow | null }

export type WordRef = { line: number; word: string; occurrence: number }
export type Scope = { mode: 'word' | 'letter'; letterIndex?: number }

export type Op =
  | { t: 'assign_set'; id?: string; version?: number; vv: number; work: WorkId; verse: number; line: number; word: string; occurrence: number; mode: 'word' | 'letter'; letterIndex: number | null; readingIds: string[]; note: string; source: string }
  | { t: 'assign_del'; id: string; version: number }
  | { t: 'mark_set'; id?: string; version?: number; vv: number; work: WorkId; verse: number; line: number; word: string; occurrence: number; mode: 'word' | 'letter'; symbol: string; kind: Mark['kind']; readingIds: string[]; note: string; source: string; status: Mark['status']; method: 'hand' | 'match' }
  | { t: 'mark_del'; id: string; version: number }
  | { t: 'verse_set'; work: WorkId; verse: number; version: number; lines: string[] }
  | { t: 'sharh_set'; work: WorkId; verse: number; version?: number; text: string; title?: string; author?: string; pages?: string[] }
  | { t: 'sharh_del'; work: WorkId; verse: number; version: number }

export type Intent =
  | { k: 'authority'; ref: WordRef; scope: Scope; id: string }
  | { k: 'group'; ref: WordRef; scope: Scope; ids: string[] }
  | { k: 'scope'; ref: WordRef; scope: Scope }
  | { k: 'details'; ref: WordRef; note?: string; source?: string }
  | { k: 'unassign'; ref: WordRef }
  | { k: 'mark'; ref: WordRef; symbol: string; note: string; source: string; verified: boolean }
  | { k: 'unmark'; ref: WordRef }
  | { k: 'lines'; lines: string[]; rename?: { ref: WordRef; to: string }; drop?: WordRef; dropOrphans?: boolean }
  | { k: 'sharh'; text: string; title?: string; author?: string }
  | { k: 'restore'; target: Snapshot }

/** What a verse looked like (for undo and redo): its text and every row without database identity. */
export type Snapshot = { lines: string[]; assignments: WordAssignment[]; marks: Mark[]; sharh: string | null }

export type Planned = { ops: Op[]; next: VerseState; error?: string; orphans?: number }

export const MAX_LINE_LENGTH = 400
export const MAX_SHARH_LENGTH = 40000
const isTmp = (id: string | undefined) => !id || id.startsWith('tmp:')
const slot = (r: { line: number; word: string; occurrence: number }) => `${r.line}:${r.word}:${r.occurrence}`

export function snapshotOf(state: VerseState): Snapshot {
  const strip = <T extends { id?: string; version?: number }>(row: T): Omit<T, 'id' | 'version'> => {
    const { id: _id, version: _version, ...rest } = row
    void _id; void _version
    return rest
  }
  return {
    lines: [...state.verse.lines],
    assignments: state.assignments.map(a => strip(a) as WordAssignment),
    marks: state.marks.map(m => strip(m) as Mark),
    sharh: state.sharh?.text ?? null,
  }
}

function lineOf(state: VerseState, ref: WordRef): string | undefined {
  return state.verse.lines[ref.line]
}

function findAssignment(state: VerseState, ref: WordRef): AssignmentRow | undefined {
  const line = lineOf(state, ref)
  return line === undefined ? undefined : state.assignments.find(a => rowIsAboutWord(a, line, ref))
}

function findMark(state: VerseState, ref: WordRef): MarkRow | undefined {
  const line = lineOf(state, ref)
  return line === undefined ? undefined : state.marks.find(m => rowIsAboutWord(m, line, ref))
}

function wordExists(state: VerseState, ref: WordRef): boolean {
  const line = lineOf(state, ref)
  return line !== undefined && findWord(line, ref.word, ref.occurrence) === ref.word
}

function assignOp(state: VerseState, row: AssignmentRow): Op {
  return {
    t: 'assign_set', ...(isTmp(row.id) ? {} : { id: row.id, version: row.version }), vv: state.verse.version,
    work: row.work, verse: row.verse, line: row.line, word: row.word, occurrence: row.occurrence,
    mode: row.mode ?? 'word', letterIndex: (row.mode ?? 'word') === 'letter' ? (row.letterIndex ?? 0) : null,
    readingIds: row.readingIds, note: row.note, source: row.source,
  }
}

function markOp(state: VerseState, row: MarkRow): Op {
  return {
    t: 'mark_set', ...(isTmp(row.id) ? {} : { id: row.id, version: row.version }), vv: state.verse.version,
    work: row.work, verse: row.verse, line: row.line, word: row.word, occurrence: row.occurrence, mode: row.mode,
    symbol: row.symbol, kind: row.kind, readingIds: row.readingIds, note: row.note, source: row.source, status: row.status, method: row.method ?? 'hand',
  }
}

/** Puts an assignment in place (or removes it when it names nobody) and plans the operation. */
function saveAssignment(state: VerseState, row: AssignmentRow, existing: AssignmentRow | undefined): Planned {
  const assignments = state.assignments.filter(a => a !== existing)
  if (row.readingIds.length === 0) {
    const ops: Op[] = existing && !isTmp(existing.id) ? [{ t: 'assign_del', id: existing.id, version: existing.version }] : []
    return { ops, next: { ...state, assignments } }
  }
  const problem = validateAssignment(row, { number: state.verse.number, lines: state.verse.lines, printedPage: state.verse.printedPage, pageId: state.verse.pageId })
  if (problem) return { ops: [], next: state, error: problem }
  return { ops: [assignOp(state, row)], next: { ...state, assignments: [...assignments, row] } }
}

function newAssignment(state: VerseState, ref: WordRef, scope: Scope, readingIds: string[]): AssignmentRow {
  return {
    id: `tmp:${state.work}:${state.verse.number}:${slot(ref)}`, version: 0,
    work: state.work, verse: state.verse.number, line: ref.line, word: ref.word, occurrence: ref.occurrence,
    mode: scope.mode, ...(scope.mode === 'letter' ? { letterIndex: scope.letterIndex ?? 0 } : {}),
    readingIds, note: '', source: '',
  }
}

const unique = (ids: string[]) => Array.from(new Set(ids))

export function applyIntent(state: VerseState, intent: Intent): Planned {
  switch (intent.k) {
    case 'authority': {
      if (!wordExists(state, intent.ref)) return { ops: [], next: state, error: 'الكلمة لم تعد موجودة في الشطر' }
      const existing = findAssignment(state, intent.ref)
      if (!existing) return saveAssignment(state, newAssignment(state, intent.ref, intent.scope, [intent.id]), undefined)
      const has = existing.readingIds.includes(intent.id)
      const readingIds = has ? existing.readingIds.filter(x => x !== intent.id) : [...existing.readingIds, intent.id]
      return saveAssignment(state, { ...existing, readingIds }, existing)
    }

    case 'group': {
      if (!wordExists(state, intent.ref)) return { ops: [], next: state, error: 'الكلمة لم تعد موجودة في الشطر' }
      const existing = findAssignment(state, intent.ref)
      if (!existing) return saveAssignment(state, newAssignment(state, intent.ref, intent.scope, unique(intent.ids)), undefined)
      const full = intent.ids.every(id => existing.readingIds.includes(id))
      const readingIds = full ? existing.readingIds.filter(id => !intent.ids.includes(id)) : unique([...existing.readingIds, ...intent.ids])
      return saveAssignment(state, { ...existing, readingIds }, existing)
    }

    case 'scope': {
      const existing = findAssignment(state, intent.ref)
      if (!existing) return { ops: [], next: state }
      const letters = wordLetters(existing.word).length
      const row: AssignmentRow = intent.scope.mode === 'letter'
        ? { ...existing, mode: 'letter', letterIndex: Math.min(intent.scope.letterIndex ?? existing.letterIndex ?? 0, Math.max(0, letters - 1)) }
        : (() => { const { letterIndex: _l, ...rest } = existing; void _l; return { ...rest, mode: 'word' as const } })()
      return saveAssignment(state, row, existing)
    }

    case 'details': {
      const existing = findAssignment(state, intent.ref)
      if (!existing) return { ops: [], next: state }
      const row = { ...existing, note: intent.note ?? existing.note, source: intent.source ?? existing.source }
      if (row.note === existing.note && row.source === existing.source) return { ops: [], next: state }
      if (row.note.length > 500 || row.source.length > 500) return { ops: [], next: state, error: 'النص أطول من ٥٠٠ حرف' }
      return saveAssignment(state, row, existing)
    }

    case 'unassign': {
      const existing = findAssignment(state, intent.ref)
      if (!existing) return { ops: [], next: state }
      return saveAssignment(state, { ...existing, readingIds: [] }, existing)
    }

    case 'mark': {
      if (!wordExists(state, intent.ref)) return { ops: [], next: state, error: 'الكلمة لم تعد موجودة في الشطر' }
      const definition = definitionFor(state.work, intent.symbol)
      if (!definition) return { ops: [], next: state, error: 'الرمز غير معرّف في هذا المتن' }
      const existing = findMark(state, intent.ref)
      const row: MarkRow = {
        id: existing?.id ?? `tmp:mark:${state.work}:${state.verse.number}:${slot(intent.ref)}`, version: existing?.version ?? 0,
        work: state.work, verse: state.verse.number, line: intent.ref.line, word: intent.ref.word, occurrence: intent.ref.occurrence,
        mode: definition.symbol.length === 1 ? 'letter' : 'word', symbol: definition.symbol, kind: definition.kind, readingIds: definition.readingIds,
        note: intent.note, source: intent.source, status: intent.verified ? 'verified' : 'extracted', method: 'hand',
      }
      const problem = validateMark(row, { number: state.verse.number, lines: state.verse.lines, printedPage: state.verse.printedPage, pageId: state.verse.pageId })
      if (problem) return { ops: [], next: state, error: problem }
      return { ops: [markOp(state, row)], next: { ...state, marks: [...state.marks.filter(m => m !== existing), row] } }
    }

    case 'unmark': {
      const existing = findMark(state, intent.ref)
      if (!existing) return { ops: [], next: state }
      const ops: Op[] = isTmp(existing.id) ? [] : [{ t: 'mark_del', id: existing.id, version: existing.version }]
      return { ops, next: { ...state, marks: state.marks.filter(m => m !== existing) } }
    }

    case 'sharh':
      return planSharh(state, intent.text, intent.title, intent.author)

    case 'lines':
      return planLines(state, intent)

    case 'restore':
      return planRestore(state, intent.target)
  }
}

/** Sets, replaces or (for empty text) removes the شرح of the verse. */
function planSharh(state: VerseState, raw: string, title?: string, author?: string): Planned {
  const text = raw.replace(/\r\n/g, '\n').trim()
  if (text.length > MAX_SHARH_LENGTH) return { ops: [], next: state, error: `الشرح أطول من ${MAX_SHARH_LENGTH} حرف` }
  const current = state.sharh && state.sharh.version > 0 ? state.sharh : null
  if (!text) {
    if (!current) return { ops: [], next: { ...state, sharh: null } }
    return { ops: [{ t: 'sharh_del', work: state.work, verse: state.verse.number, version: current.version }], next: { ...state, sharh: null } }
  }
  if (current && current.text === text && title === undefined && author === undefined) return { ops: [], next: state }
  const row: SharhRow = { text, title: title ?? current?.title ?? '', author: author ?? current?.author ?? '', pages: current?.pages ?? [], version: current?.version ?? 0 }
  const op: Op = { t: 'sharh_set', work: state.work, verse: state.verse.number, ...(current ? { version: current.version } : {}), text, title: row.title, author: row.author }
  return { ops: [op], next: { ...state, sharh: row } }
}

export function validLines(lines: string[]): string | null {
  if (!Array.isArray(lines) || lines.length < 1 || lines.length > 2) return 'للبيت شطر أو شطران'
  if (lines.some(l => typeof l !== 'string' || !l.trim())) return 'لا يجوز ترك شطر فارغًا'
  if (lines.some(l => l.length > MAX_LINE_LENGTH)) return `الشطر أطول من ${MAX_LINE_LENGTH} حرفًا`
  return null
}

/** Marks and assignments whose word is no longer in the new text. */
export function findOrphans(state: VerseState, lines: string[], keep: (r: { line: number; word: string; occurrence: number }) => boolean = () => false) {
  const gone = (r: { line: number; word: string; occurrence: number }) => lines[r.line] === undefined || findWord(lines[r.line], r.word, r.occurrence) === null
  return {
    assignments: state.assignments.filter(a => gone(a) && !keep(a)),
    marks: state.marks.filter(m => gone(m) && !keep(m)),
  }
}

function planLines(state: VerseState, intent: Extract<Intent, { k: 'lines' }>): Planned {
  const lines = intent.lines.map(l => l.replace(/\s+/g, ' ').trim())
  const bad = validLines(lines)
  if (bad) return { ops: [], next: state, error: bad }
  if (lines.length === state.verse.lines.length && lines.every((l, i) => l === state.verse.lines[i])) return { ops: [], next: state }

  const newVersion = state.verse.version + 1
  const nextState: VerseState = { ...state, verse: { ...state.verse, lines, version: newVersion } }
  const ops: Op[] = [{ t: 'verse_set', work: state.work, verse: state.verse.number, version: state.verse.version, lines }]
  let assignments: AssignmentRow[] = []
  let marks: MarkRow[] = []
  let orphans = 0

  const renamed = (r: { line: number; word: string; occurrence: number }) =>
    intent.rename && rowIsAboutWord(r, state.verse.lines[r.line] ?? '', intent.rename.ref)
  const dropped = (r: { line: number; word: string; occurrence: number }) =>
    intent.drop && rowIsAboutWord(r, state.verse.lines[r.line] ?? '', intent.drop)
  const to = intent.rename ? intent.rename.to.replace(/[^\p{L}\p{M}ـ]/gu, '') : ''

  for (const a of state.assignments) {
    if (dropped(a)) { if (!isTmp(a.id)) ops.push({ t: 'assign_del', id: a.id, version: a.version }); continue }
    const row = renamed(a) && to ? { ...a, word: to } : a
    if (lines[row.line] !== undefined && findWord(lines[row.line], row.word, row.occurrence) !== null) {
      assignments.push(row)
      if (row !== a) ops.push(assignOp(nextState, row))
    } else {
      orphans++
      if (intent.dropOrphans && !isTmp(a.id)) ops.push({ t: 'assign_del', id: a.id, version: a.version })
      else if (!intent.dropOrphans) assignments.push(a)
    }
  }
  for (const m of state.marks) {
    if (dropped(m)) { if (!isTmp(m.id)) ops.push({ t: 'mark_del', id: m.id, version: m.version }); continue }
    const row = renamed(m) && to ? { ...m, word: to } : m
    if (lines[row.line] !== undefined && findWord(lines[row.line], row.word, row.occurrence) !== null) {
      marks.push(row)
      if (row !== m) ops.push(markOp(nextState, row))
    } else {
      orphans++
      if (intent.dropOrphans && !isTmp(m.id)) ops.push({ t: 'mark_del', id: m.id, version: m.version })
      else if (!intent.dropOrphans) marks.push(m)
    }
  }
  if (orphans > 0 && !intent.dropOrphans) return { ops: [], next: state, error: 'ORPHANS', orphans }
  assignments = assignments.filter(a => lines[a.line] !== undefined)
  marks = marks.filter(m => lines[m.line] !== undefined)
  return { ops, next: { ...nextState, assignments, marks } }
}

function planRestore(state: VerseState, target: Snapshot): Planned {
  const ops: Op[] = []
  const linesChanged = target.lines.length !== state.verse.lines.length || target.lines.some((l, i) => l !== state.verse.lines[i])
  const verse = linesChanged ? { ...state.verse, lines: target.lines, version: state.verse.version + 1 } : state.verse
  if (linesChanged) ops.push({ t: 'verse_set', work: state.work, verse: state.verse.number, version: state.verse.version, lines: target.lines })
  const working: VerseState = { ...state, verse }
  const sharhPlan = (target.sharh ?? null) === (state.sharh?.text ?? null) ? null : planSharh(state, target.sharh ?? '')
  if (sharhPlan) ops.push(...sharhPlan.ops)

  const currentA = new Map(state.assignments.map(a => [slot(a), a]))
  const nextA: AssignmentRow[] = []
  for (const want of target.assignments) {
    const have = currentA.get(slot(want))
    currentA.delete(slot(want))
    const row: AssignmentRow = { ...want, id: have?.id ?? `tmp:${state.work}:${state.verse.number}:${slot(want)}`, version: have?.version ?? 0 }
    const same = have && have.mode === want.mode && (have.letterIndex ?? null) === (want.letterIndex ?? null) && have.note === want.note && have.source === want.source
      && have.readingIds.length === want.readingIds.length && have.readingIds.every(x => want.readingIds.includes(x))
    nextA.push(row)
    if (!same || linesChanged) ops.push(assignOp(working, row))
  }
  for (const gone of currentA.values()) if (!isTmp(gone.id)) ops.push({ t: 'assign_del', id: gone.id, version: gone.version })

  const currentM = new Map(state.marks.map(m => [slot(m), m]))
  const nextM: MarkRow[] = []
  for (const want of target.marks) {
    const have = currentM.get(slot(want))
    currentM.delete(slot(want))
    const row: MarkRow = { ...want, id: have?.id ?? `tmp:mark:${state.work}:${state.verse.number}:${slot(want)}`, version: have?.version ?? 0 }
    const same = have && have.symbol === want.symbol && have.status === want.status && have.note === want.note && have.source === want.source && have.mode === want.mode
    nextM.push(row)
    if (!same || linesChanged) ops.push(markOp(working, row))
  }
  for (const gone of currentM.values()) if (!isTmp(gone.id)) ops.push({ t: 'mark_del', id: gone.id, version: gone.version })

  // Deletions first so a restored row never collides with the one it replaces.
  ops.sort((a, b) => Number(a.t.endsWith('_del') ? 0 : a.t === 'verse_set' ? -1 : 1) - Number(b.t.endsWith('_del') ? 0 : b.t === 'verse_set' ? -1 : 1))
  return { ops, next: { ...working, assignments: nextA, marks: nextM, ...(sharhPlan ? { sharh: sharhPlan.next.sharh } : {}) } }
}

/** Folds the database's answer to `ops` into the confirmed state the ops were planned from. */
export type OpResult =
  | { entity: 'assignment'; action: 'set'; row: AssignmentRow }
  | { entity: 'assignment'; action: 'delete'; id: string }
  | { entity: 'mark'; action: 'set'; row: MarkRow }
  | { entity: 'mark'; action: 'delete'; id: string }
  | { entity: 'verse'; action: 'set'; row: VerseRow }
  | { entity: 'sharh'; action: 'set'; row: SharhRow }
  | { entity: 'sharh'; action: 'delete' }

export function mergeResults(state: VerseState, results: OpResult[]): VerseState {
  let next = state
  for (const r of results) {
    if (r.entity === 'verse') next = { ...next, verse: { ...next.verse, ...r.row } }
    else if (r.entity === 'sharh') next = { ...next, sharh: r.action === 'set' ? r.row : null }
    else if (r.entity === 'assignment' && r.action === 'set') {
      next = { ...next, assignments: [...next.assignments.filter(a => a.id !== r.row.id && slot(a) !== slot(r.row)), r.row] }
    } else if (r.entity === 'assignment') next = { ...next, assignments: next.assignments.filter(a => a.id !== r.id) }
    else if (r.entity === 'mark' && r.action === 'set') {
      next = { ...next, marks: [...next.marks.filter(m => m.id !== r.row.id && slot(m) !== slot(r.row)), r.row] }
    } else if (r.entity === 'mark') next = { ...next, marks: next.marks.filter(m => m.id !== r.id) }
  }
  return next
}

// ---------------------------------------------------------------------------------------------------------------
// Server-side validation of a batch, against the verse text the client edited (a stale text is refused by the
// database through each operation's verse version).
// ---------------------------------------------------------------------------------------------------------------
const WORKS: WorkId[] = ['shatibiyyah', 'durrah', 'tayyibah']
const isInt = (v: unknown): v is number => Number.isSafeInteger(v)

export function validateOps(ops: unknown, lines: Record<string, unknown>): string | null {
  if (!Array.isArray(ops) || ops.length === 0 || ops.length > 200) return 'قائمة العمليات غير صالحة'
  for (const raw of ops) {
    if (!raw || typeof raw !== 'object') return 'عملية غير صالحة'
    const op = raw as Record<string, unknown>
    if (op.t === 'assign_del' || op.t === 'mark_del') {
      if (typeof op.id !== 'string' || !isInt(op.version)) return 'عملية حذف غير صالحة'
      continue
    }
    if (!WORKS.includes(op.work as WorkId) || !isInt(op.verse)) return 'المتن أو رقم البيت غير صالح'
    if (op.t === 'sharh_del') {
      if (!isInt(op.version)) return 'نسخة الشرح غير صالحة'
      continue
    }
    if (op.t === 'sharh_set') {
      if (op.version !== undefined && !isInt(op.version)) return 'نسخة الشرح غير صالحة'
      if (typeof op.text !== 'string' || !op.text.trim() || op.text.length > MAX_SHARH_LENGTH) return 'نص الشرح غير صالح'
      for (const f of [op.title, op.author]) if (f !== undefined && (typeof f !== 'string' || f.length > 200)) return 'عنوان الشرح أو مؤلفه غير صالح'
      continue
    }
    if (op.t === 'verse_set') {
      if (!isInt(op.version)) return 'نسخة البيت غير صالحة'
      const bad = validLines(op.lines as string[])
      if (bad) return bad
      continue
    }
    const verseLines = lines[`${op.work}:${op.verse}`]
    if (!Array.isArray(verseLines) || verseLines.some(l => typeof l !== 'string')) return 'نص البيت مطلوب للتحقق'
    if (!isInt(op.vv)) return 'نسخة البيت مطلوبة'
    if ((op.id === undefined) !== (op.version === undefined) || (op.id !== undefined && (typeof op.id !== 'string' || !isInt(op.version)))) return 'معرّف الصف أو نسخته غير صالح'
    const verse = { number: op.verse as number, lines: verseLines as string[], printedPage: null, pageId: null }
    if (op.t === 'assign_set') {
      const problem = validateAssignment({
        work: op.work as WorkId, verse: op.verse as number, line: op.line as number, word: op.word as string, occurrence: op.occurrence as number,
        mode: op.mode as 'word' | 'letter', letterIndex: (op.letterIndex ?? undefined) as number | undefined, readingIds: op.readingIds as string[],
        note: op.note as string, source: op.source as string,
      }, verse)
      if (problem) return problem
      if ((op.note as string).length > 500 || (op.source as string).length > 500) return 'النص أطول من ٥٠٠ حرف'
    } else if (op.t === 'mark_set') {
      if (!['verified', 'extracted'].includes(op.status as string) || !['letter', 'word'].includes(op.mode as string) || !Array.isArray(op.readingIds)
        || typeof op.note !== 'string' || typeof op.source !== 'string' || typeof op.symbol !== 'string' || typeof op.word !== 'string') return 'رمز غير صالح'
      const problem = validateMark(op as unknown as Mark, verse)
      if (problem) return problem
    } else return 'عملية غير معروفة'
  }
  return null
}

export function authorityName(id: string): string { return AUTHORITIES.find(a => a.id === id)?.name ?? id }
export { candidates }
