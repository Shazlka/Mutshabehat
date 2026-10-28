import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyIntent, findOrphans, mergeResults, snapshotOf, validateOps, type AssignmentRow, type Intent, type MarkRow, type Op, type OpResult, type VerseState } from '../../src/app/mushaf-1441/mutoon-editor/ops'
import { compileVerse } from '../../src/app/mushaf-1441/mutoon-editor/data'

const base = (): VerseState => ({
  work: 'shatibiyyah',
  verse: { number: 108, lines: ['رَاوِيهِ نَاصِرٌ حَلَا', 'صُحْبَةٌ حَقٌّ'], printedPage: '9', pageId: 15, version: 3 },
  marks: [],
  assignments: [],
})
const ref = (line: number, word: string, occurrence = 1) => ({ line, word, occurrence })
const word = { mode: 'word' as const }

test('the first reader on a word creates an assignment; a second adds to it; removing the last deletes it', () => {
  let state = base()
  const first = applyIntent(state, { k: 'authority', ref: ref(0, 'نَاصِرٌ'), scope: word, id: 'Q01' })
  assert.equal(first.error, undefined)
  assert.equal(first.ops.length, 1)
  const op = first.ops[0] as Extract<Op, { t: 'assign_set' }>
  assert.equal(op.id, undefined, 'a new assignment is an insert')
  assert.equal(op.vv, 3)
  assert.deepEqual(op.readingIds, ['Q01'])
  state = first.next

  // pretend the database confirmed it
  state = mergeResults(state, [{ entity: 'assignment', action: 'set', row: { ...(first.next.assignments[0] as AssignmentRow), id: 'real-1', version: 1 } }])
  const second = applyIntent(state, { k: 'authority', ref: ref(0, 'نَاصِرٌ'), scope: word, id: 'Q02-R01' })
  const op2 = second.ops[0] as Extract<Op, { t: 'assign_set' }>
  assert.equal(op2.id, 'real-1')
  assert.equal(op2.version, 1)
  assert.deepEqual(op2.readingIds, ['Q01', 'Q02-R01'])

  state = mergeResults(second.next, [{ entity: 'assignment', action: 'set', row: { ...(second.next.assignments[0] as AssignmentRow), id: 'real-1', version: 2 } }])
  const off1 = applyIntent(state, { k: 'authority', ref: ref(0, 'نَاصِرٌ'), scope: word, id: 'Q02-R01' })
  const off2 = applyIntent(mergeResults(off1.next, [{ entity: 'assignment', action: 'set', row: { ...(off1.next.assignments[0] as AssignmentRow), id: 'real-1', version: 3 } }]), { k: 'authority', ref: ref(0, 'نَاصِرٌ'), scope: word, id: 'Q01' })
  assert.deepEqual(off2.ops, [{ t: 'assign_del', id: 'real-1', version: 3 }])
  assert.equal(off2.next.assignments.length, 0)
})

test('a group toggles all of its readers at once, and partially assigned groups fill up first', () => {
  const first = applyIntent(base(), { k: 'group', ref: ref(1, 'صُحْبَةٌ'), scope: word, ids: ['Q06', 'Q07', 'Q05-R01'] })
  assert.deepEqual((first.next.assignments[0]).readingIds, ['Q06', 'Q07', 'Q05-R01'])
  const withOne: VerseState = { ...base(), assignments: [{ ...(first.next.assignments[0]), id: 'a', version: 1, readingIds: ['Q06'] }] }
  const fill = applyIntent(withOne, { k: 'group', ref: ref(1, 'صُحْبَةٌ'), scope: word, ids: ['Q06', 'Q07', 'Q05-R01'] })
  assert.deepEqual(fill.next.assignments[0].readingIds, ['Q06', 'Q07', 'Q05-R01'])
})

test('unknown readers, missing words and bad letter positions are refused without touching state', () => {
  assert.match(applyIntent(base(), { k: 'authority', ref: ref(0, 'غَيْرُ'), scope: word, id: 'Q01' }).error ?? '', /لم تعد موجودة/)
  assert.ok(applyIntent(base(), { k: 'authority', ref: ref(0, 'نَاصِرٌ'), scope: word, id: 'Q99' }).error)
  assert.ok(applyIntent(base(), { k: 'authority', ref: ref(0, 'نَاصِرٌ'), scope: { mode: 'letter', letterIndex: 40 }, id: 'Q01' }).error)
})

test('switching an assignment to one letter keeps its readers and stays inside the word', () => {
  const state: VerseState = { ...base(), assignments: [{ id: 'a', version: 1, work: 'shatibiyyah', verse: 108, line: 0, word: 'رَاوِيهِ', occurrence: 1, mode: 'word', readingIds: ['Q07'], note: '', source: '' }] }
  const letter = applyIntent(state, { k: 'scope', ref: ref(0, 'رَاوِيهِ'), scope: { mode: 'letter', letterIndex: 99 } })
  assert.equal(letter.next.assignments[0].mode, 'letter')
  assert.equal(letter.next.assignments[0].letterIndex, 4)
  const back = applyIntent(letter.next, { k: 'scope', ref: ref(0, 'رَاوِيهِ'), scope: { mode: 'word' } })
  assert.equal(back.next.assignments[0].letterIndex, undefined)
  assert.equal((back.ops[0] as Extract<Op, { t: 'assign_set' }>).letterIndex, null)
})

test('details are only sent when they change', () => {
  const state: VerseState = { ...base(), assignments: [{ id: 'a', version: 1, work: 'shatibiyyah', verse: 108, line: 0, word: 'رَاوِيهِ', occurrence: 1, readingIds: ['Q07'], note: 'x', source: '' }] }
  assert.deepEqual(applyIntent(state, { k: 'details', ref: ref(0, 'رَاوِيهِ'), note: 'x' }).ops, [])
  const changed = applyIntent(state, { k: 'details', ref: ref(0, 'رَاوِيهِ'), source: 'الوافي ص ٥' })
  assert.equal((changed.ops[0] as Extract<Op, { t: 'assign_set' }>).source, 'الوافي ص ٥')
})

test('a poem symbol is validated against its dictionary and replaces an earlier mark on the same word', () => {
  const bad = applyIntent(base(), { k: 'mark', ref: ref(0, 'رَاوِيهِ'), symbol: 'ز', note: '', source: 'x', verified: true })
  assert.ok(bad.error)
  const ok = applyIntent(base(), { k: 'mark', ref: ref(0, 'رَاوِيهِ'), symbol: 'ر', note: '', source: 'الوافي', verified: true })
  assert.equal(ok.error, undefined)
  assert.equal(ok.next.marks[0].kind, 'reader')
  const unverifiedNoSource = applyIntent(base(), { k: 'mark', ref: ref(0, 'رَاوِيهِ'), symbol: 'ر', note: '', source: '', verified: true })
  assert.equal(unverifiedNoSource.error, 'أضف مصدر التحقق قبل اعتماد الرمز')
})

test('editing the text keeps rows on words that survive and asks before dropping orphans', () => {
  const mark: MarkRow = { id: 'm', version: 1, work: 'shatibiyyah', verse: 108, line: 0, word: 'رَاوِيهِ', occurrence: 1, mode: 'letter', symbol: 'ر', kind: 'reader', readingIds: ['Q07'], note: '', source: 'x', status: 'verified', method: 'hand' }
  const assignment: AssignmentRow = { id: 'a', version: 2, work: 'shatibiyyah', verse: 108, line: 0, word: 'نَاصِرٌ', occurrence: 1, mode: 'word', readingIds: ['Q01'], note: '', source: '' }
  const state: VerseState = { ...base(), marks: [mark], assignments: [assignment] }

  const keep = applyIntent(state, { k: 'lines', lines: ['رَاوِيهِ نَاصِرٌ حَلَا يَا', 'صُحْبَةٌ حَقٌّ'] })
  assert.equal(keep.error, undefined)
  assert.deepEqual(keep.ops, [{ t: 'verse_set', work: 'shatibiyyah', verse: 108, version: 3, lines: ['رَاوِيهِ نَاصِرٌ حَلَا يَا', 'صُحْبَةٌ حَقٌّ'] }])
  assert.equal(keep.next.verse.version, 4)

  const ask = applyIntent(state, { k: 'lines', lines: ['رَاوِيهِ حَلَا', 'صُحْبَةٌ حَقٌّ'] })
  assert.equal(ask.error, 'ORPHANS')
  assert.equal(ask.orphans, 1)
  assert.equal(findOrphans(state, ['رَاوِيهِ حَلَا', 'صُحْبَةٌ حَقٌّ']).assignments.length, 1)

  const drop = applyIntent(state, { k: 'lines', lines: ['رَاوِيهِ حَلَا', 'صُحْبَةٌ حَقٌّ'], dropOrphans: true })
  assert.deepEqual(drop.ops.map(o => o.t), ['verse_set', 'assign_del'])
  assert.equal(drop.next.assignments.length, 0)
  assert.equal(drop.next.marks.length, 1)
})

test('renaming a word moves its rows with it, in the same batch, against the new verse version', () => {
  const assignment: AssignmentRow = { id: 'a', version: 2, work: 'shatibiyyah', verse: 108, line: 0, word: 'نَاصِرٌ', occurrence: 1, mode: 'word', readingIds: ['Q01'], note: '', source: '' }
  const state: VerseState = { ...base(), assignments: [assignment] }
  const planned = applyIntent(state, { k: 'lines', lines: ['رَاوِيهِ غَيْثٌ حَلَا', 'صُحْبَةٌ حَقٌّ'], rename: { ref: ref(0, 'نَاصِرٌ'), to: 'غَيْثٌ' } })
  assert.equal(planned.error, undefined)
  const set = planned.ops[1] as Extract<Op, { t: 'assign_set' }>
  assert.equal(set.word, 'غَيْثٌ')
  assert.equal(set.vv, 4)
  assert.equal(set.id, 'a')
})

test('an empty or three-line text is refused', () => {
  assert.ok(applyIntent(base(), { k: 'lines', lines: ['', 'x'] }).error)
  assert.ok(applyIntent(base(), { k: 'lines', lines: ['a', 'b', 'c'] }).error)
})

test('undo restores a verse by diffing it against the snapshot', () => {
  const before = base()
  const added = applyIntent(before, { k: 'authority', ref: ref(0, 'نَاصِرٌ'), scope: word, id: 'Q01' })
  // confirmed with real identity
  const confirmed = mergeResults(added.next, [{ entity: 'assignment', action: 'set', row: { ...(added.next.assignments[0]), id: 'real', version: 1 } }])
  const undo = applyIntent(confirmed, { k: 'restore', target: snapshotOf(before) })
  assert.deepEqual(undo.ops, [{ t: 'assign_del', id: 'real', version: 1 }])
  assert.equal(undo.next.assignments.length, 0)
  // and redo puts it back as an insert
  const redo = applyIntent(undo.next, { k: 'restore', target: snapshotOf(confirmed) })
  assert.equal((redo.ops[0] as Extract<Op, { t: 'assign_set' }>).id, undefined)
  assert.deepEqual((redo.ops[0] as Extract<Op, { t: 'assign_set' }>).readingIds, ['Q01'])
})

test('merging a delete result removes the row', () => {
  const state: VerseState = { ...base(), assignments: [{ id: 'a', version: 1, work: 'shatibiyyah', verse: 108, line: 0, word: 'رَاوِيهِ', occurrence: 1, readingIds: ['Q07'], note: '', source: '' }] }
  const merged = mergeResults(state, [{ entity: 'assignment', action: 'delete', id: 'a' } as OpResult])
  assert.equal(merged.assignments.length, 0)
})

test('the server refuses malformed batches and bad readers, and accepts what the planner produces', () => {
  const planned = applyIntent(base(), { k: 'authority', ref: ref(0, 'نَاصِرٌ'), scope: word, id: 'Q01' })
  const lines = { 'shatibiyyah:108': base().verse.lines }
  assert.equal(validateOps(planned.ops, lines), null)
  assert.ok(validateOps([], lines))
  assert.ok(validateOps([{ t: 'nope' }], lines))
  assert.ok(validateOps([{ ...planned.ops[0], readingIds: ['Q99'] }], lines))
  assert.ok(validateOps([{ ...planned.ops[0], word: 'غَيْرُ' }], lines))
  assert.ok(validateOps(planned.ops, {}), 'the verse text is required')
  assert.ok(validateOps([{ ...planned.ops[0], vv: 'x' }], lines))
})

test('compileVerse marks assignments as such so the app can show them without a dictionary symbol', () => {
  const annotations = compileVerse('shatibiyyah', 108, base().verse.lines, [], [
    { work: 'shatibiyyah', verse: 108, line: 1, word: 'صُحْبَةٌ', occurrence: 1, readingIds: ['Q06', 'Q07'], note: 'ن', source: '' },
    { work: 'shatibiyyah', verse: 108, line: 0, word: 'رَاوِيهِ', occurrence: 1, mode: 'letter', letterIndex: 1, readingIds: ['Q03-R01'], note: '', source: '' },
  ])
  assert.equal(annotations.length, 2)
  assert.ok(annotations.every(a => a.origin === 'assignment' && a.status === 'verified'))
  assert.equal(annotations[0].line, 0)
  assert.equal(annotations[0].text, 'ا')
  assert.equal(annotations[0].kind, 'narrator')
  assert.equal(annotations[1].kind, 'group')
})

const _unused: Intent | undefined = undefined
void _unused
