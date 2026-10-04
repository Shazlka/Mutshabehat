import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { isGroupInDraft, proposeReferenceDecision } from '../../src/app/mushaf-1441/review/_lib/referenceGroup'
import { ALL_NARRATOR_IDS, nquranGroupsForDifference, type NquranAyahEntry } from '../../src/app/mushaf-1441/review/_lib/nquranReference'
import { row } from './_helpers/review-row'

const ids = (...list: string[]) => list.map((id) => ({ id }))

test('proposeReferenceDecision: matched needs a reviewed row covering every id', () => {
  const d = proposeReferenceDecision({ narratorIds: ['Q01-R01', 'Q01-R02'] }, [
    row({ narrators: ids('Q01-R01', 'Q01-R02', 'Q02-R01'), reviewStatus: 'reviewed' }),
  ])
  assert.equal(d.status, 'matched')
  assert.ok(d.matchedRow)
})

test('proposeReferenceDecision: an unreviewed covering row is recorded_unreviewed', () => {
  const d = proposeReferenceDecision({ narratorIds: ['Q01-R01'] }, [row({ narrators: ids('Q01-R01'), reviewStatus: 'unreviewed' })])
  assert.equal(d.status, 'recorded_unreviewed')
})

test('proposeReferenceDecision: shared but not all narrators is partial', () => {
  const d = proposeReferenceDecision({ narratorIds: ['Q01-R01', 'Q03-R02'] }, [row({ narrators: ids('Q01-R01') })])
  assert.equal(d.status, 'partial')
})

test('proposeReferenceDecision: no shared narrator (or only deleted rows) is missing', () => {
  assert.equal(proposeReferenceDecision({ narratorIds: ['Q01-R01'] }, [row({ narrators: ids('Q02-R01') })]).status, 'missing')
  assert.equal(proposeReferenceDecision({ narratorIds: ['Q01-R01'] }, [row({ narrators: ids('Q01-R01'), deleted: true })]).status, 'missing')
  assert.equal(proposeReferenceDecision({ narratorIds: ['Q01-R01'] }, []).status, 'missing')
})

test('proposeReferenceDecision: empty narratorIds is unresolved', () => {
  const d = proposeReferenceDecision({ narratorIds: [] }, [row({ narrators: ids('Q01-R01') })])
  assert.deepEqual(d, { status: 'unresolved', matchedRow: null })
})

test('nquranGroupsForDifference: 2:2 «فيه هدى» gives three disjoint groups covering all 20 narrators', () => {
  const entries: NquranAyahEntry[] = JSON.parse(
    readFileSync(new URL('../../src/app/mushaf-1441/review/_lib/reference/nquran/surah-002.json', import.meta.url), 'utf8'),
  )
  const difference = entries.find((e) => e.ayah === 2)!.differences.find((d) => d.location === 'فيه هدى')!
  const groups = nquranGroupsForDifference(difference)
  assert.equal(groups.length, 3)
  assert.deepEqual(groups.map((g) => g.narratorIds.length), [2, 1, 17])
  assert.deepEqual(groups[1].narratorIds, ['Q03-R02'])
  const all = groups.flatMap((g) => g.narratorIds)
  assert.equal(new Set(all).size, all.length, 'groups overlap')
  assert.deepEqual([...all].sort(), [...ALL_NARRATOR_IDS].sort())
  assert.equal(groups[0].readersLabel, 'ابن كثير')
  assert.equal(groups[0].performanceText, difference.groups[0].reading)
  assert.equal(new Set(groups.map((g) => g.key)).size, 3)
})

test('isGroupInDraft: true only when every narrator of a non-empty group is already in the open draft', () => {
  assert.equal(isGroupInDraft({ narratorIds: ['Q01-R01', 'Q01-R02'] }, ['Q01-R02', 'Q01-R01', 'Q02-R01']), true)
  assert.equal(isGroupInDraft({ narratorIds: ['Q01-R01', 'Q01-R02'] }, ['Q01-R01']), false)
  assert.equal(isGroupInDraft({ narratorIds: ['Q01-R01'] }, []), false)
  assert.equal(isGroupInDraft({ narratorIds: [] }, ['Q01-R01']), false)
})
