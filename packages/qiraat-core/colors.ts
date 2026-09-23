import { QIRAAT_READERS } from './readers'
import { QIRAAT_NARRATORS } from './narrators'
import type { NarratorId, ReaderId } from './types'

// Reader/narrator identity colors and the shared-reader word token live here, never in difference
// types or UI-local literals. `src/app/globals.css` mirrors identity hex values as `--q0N-*` vars.

export const READER_COLOR: Readonly<Record<ReaderId, string>> = Object.fromEntries(
  QIRAAT_READERS.map((reader) => [reader.id, reader.color])
) as Record<ReaderId, string>

/** Shared by multiple readers; kept outside the single-reader palette. */
export const QIRAAT_MULTI_READER_COLOR = '#3F6212'

export const NARRATOR_COLOR: Readonly<Record<NarratorId, string>> = Object.fromEntries(
  QIRAAT_NARRATORS.map((narrator) => [narrator.id, narrator.color])
) as Record<NarratorId, string>

export function readerColor(readerId: ReaderId): string {
  return READER_COLOR[readerId]
}

export function narratorColor(narratorId: NarratorId): string {
  return NARRATOR_COLOR[narratorId]
}

/** CSS custom-property name for a reader's own color token, e.g. "--q05-asim". */
export function readerCssVar(readerId: ReaderId): string {
  const slug = READER_SLUG[readerId]
  return `--${readerId.toLowerCase()}-${slug}`
}

/** CSS custom-property name for a narrator's own color token, e.g. "--q05-hafs". */
export function narratorCssVar(narratorId: NarratorId): string {
  const readerId = narratorId.split('-')[0] as ReaderId
  const slug = NARRATOR_SLUG[narratorId]
  return `--${readerId.toLowerCase()}-${slug}`
}

const READER_SLUG: Record<ReaderId, string> = {
  Q01: 'nafi', Q02: 'ibn-kathir', Q03: 'abu-amr', Q04: 'ibn-amir', Q05: 'asim',
  Q06: 'hamzah', Q07: 'kisai', Q08: 'abu-jafar', Q09: 'yaqub', Q10: 'khalaf-ashir',
}

const NARRATOR_SLUG: Record<NarratorId, string> = {
  'Q01-R01': 'qalun', 'Q01-R02': 'warsh',
  'Q02-R01': 'bazzi', 'Q02-R02': 'qunbul',
  'Q03-R01': 'duri', 'Q03-R02': 'susi',
  'Q04-R01': 'hisham', 'Q04-R02': 'ibn-dhakwan',
  'Q05-R01': 'shubah', 'Q05-R02': 'hafs',
  'Q06-R01': 'khalaf', 'Q06-R02': 'khallad',
  'Q07-R01': 'abul-harith', 'Q07-R02': 'duri',
  'Q08-R01': 'ibn-wardan', 'Q08-R02': 'ibn-jammaz',
  'Q09-R01': 'ruways', 'Q09-R02': 'rawh',
  'Q10-R01': 'ishaq', 'Q10-R02': 'idris',
}
