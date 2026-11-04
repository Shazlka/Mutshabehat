// Port of apps/ios MushafCore QiraatCompare.swift: what two readers or narrators read at one tapped word, side by
// side. The data stores only what differs from Hafs, so a reading's text at a word is the variant that names it,
// or the Mushaf text when none does; an أصول ruling that does not name it leaves it on the base. Nothing is
// inferred beyond that rule. Pure.
import { QIRAAT_NARRATORS } from '../narrators'
import { QIRAAT_READERS, getReader } from '../readers'
import { narratorColor, readerColor } from '../colors'
import { BASE_READING, type QiraatRuling, type QiraatVariant } from '../types'
import { narratorLabel } from './readerPicker'

export interface CompareSelection {
  variants: readonly QiraatVariant[]
  rulings: readonly QiraatRuling[]
}

export type WajhSource = { kind: 'variant' } | { kind: 'base'; sameAsHafs: boolean }
export interface Wajh { text: string; note?: string; source: WajhSource }
export interface UsulEntry { action: string; condition?: string; wajhOrder?: number; wajhNote?: string }
export type UsulStatus = { kind: 'entries'; entries: UsulEntry[] } | { kind: 'base'; sameAsHafs: boolean }
export interface ComparedUsul { groupId: string; sourceRulingIds: string[]; categoryAr: string; color: string; status: UsulStatus }
export interface Content { wajhs: Wajh[]; usul: ComparedUsul[] }
export interface Voice {
  authorityId: string
  /** «الإمام حمزة» or «الراوي ورش عن نافع». */
  name: string
  color: string
  kind: 'reader' | 'narrator'
  narratorIds: string[]
  content: Content
}
/** One voice, or, for a reader whose narrators differ here, one per narrator. Empty for an unknown id. */
export interface ComparedReading { authorityId: string; voices: Voice[] }

export interface ComparisonLocus {
  surah: number
  ayah: number
  startToken: number
  endAyah: number
  endToken: number
  selection: CompareSelection
}

export interface UsulGroup {
  id: string
  category: string
  categoryAr: string
  color: string
  rulings: QiraatRuling[]
}

const HAFS_READER = QIRAAT_NARRATORS.find((n) => n.id === BASE_READING)!.readerId

const sameContent = (a: Content, b: Content) => JSON.stringify(a) === JSON.stringify(b)

/** Separates a word's unfiltered data into exact spans; overlapping spans stay separate loci. */
export function loci(selection: CompareSelection): ComparisonLocus[] {
  interface Key { surah: number; ayah: number; startToken: number; endAyah: number; endToken: number }
  const keys: Key[] = []
  const add = (key: Key) => {
    if (!keys.some((k) => k.surah === key.surah && k.ayah === key.ayah && k.startToken === key.startToken && k.endAyah === key.endAyah && k.endToken === key.endToken)) keys.push(key)
  }
  selection.variants.forEach((v) => add({ surah: v.surah, ayah: v.ayah, startToken: v.startToken, endAyah: v.ayah, endToken: v.endToken }))
  selection.rulings.forEach((r) => add({ surah: r.surah, ayah: r.ayah, startToken: r.startToken, endAyah: r.endAyah ?? r.ayah, endToken: r.endToken }))
  keys.sort((a, b) => a.surah - b.surah || a.ayah - b.ayah || a.startToken - b.startToken || a.endAyah - b.endAyah || a.endToken - b.endToken)
  return keys.map((key) => ({
    ...key,
    selection: {
      variants: selection.variants.filter((v) => v.surah === key.surah && v.ayah === key.ayah && v.startToken === key.startToken && v.endToken === key.endToken && key.endAyah === key.ayah),
      rulings: selection.rulings.filter((r) => r.surah === key.surah && r.ayah === key.ayah && r.startToken === key.startToken && (r.endAyah ?? r.ayah) === key.endAyah && r.endToken === key.endToken),
    },
  }))
}

/** The place to show first: the word's own single-word place with a text variant, then any place with a variant,
 * then the word's own place, then the first. */
export function defaultLocus(all: ComparisonLocus[], word: { surah: number; ayah: number; token: number }): ComparisonLocus | null {
  const isWord = (l: ComparisonLocus) => l.surah === word.surah && l.ayah === word.ayah && l.endAyah === l.ayah && l.startToken === word.token && l.endToken === word.token
  return all.find((l) => isWord(l) && l.selection.variants.length > 0)
    ?? all.find((l) => l.selection.variants.length > 0)
    ?? all.find(isWord)
    ?? all[0]
    ?? null
}

/** Raw أصول rows combined by category and complete locus. */
export function usulGroups(selection: CompareSelection): UsulGroup[] {
  const groups = new Map<string, UsulGroup>()
  for (const r of selection.rulings) {
    const id = `${r.category}|${r.surah}:${r.ayah}:${r.startToken}-${r.endAyah ?? r.ayah}:${r.endToken}`
    const group = groups.get(id) ?? { id, category: r.category, categoryAr: r.categoryAr, color: r.color, rulings: [] }
    group.rulings.push(r)
    groups.set(id, group)
  }
  return Array.from(groups.values())
}

function displayText(v: QiraatVariant): string {
  const performanceOnly = v.variantText === v.hafsText && Boolean(v.performanceNote)
  return v.uthmaniText ?? (performanceOnly ? v.hafsText : v.variantText)
}

function baseText(selection: CompareSelection, wordText: string): string {
  return selection.variants.map((v) => v.hafsText).find(Boolean) ?? selection.rulings.map((r) => r.baseText).find(Boolean) ?? wordText
}

function wajhsOf(readingId: string, selection: CompareSelection, wordText: string): Wajh[] {
  const result: Wajh[] = []
  for (const v of selection.variants) {
    if (!v.readingIds.includes(readingId as never)) continue
    const wajh: Wajh = { text: displayText(v), note: v.performanceNote, source: { kind: 'variant' } }
    if (!result.some((w) => JSON.stringify(w) === JSON.stringify(wajh))) result.push(wajh)
  }
  if (result.length > 0) return result
  const hafsRecorded = selection.variants.some((v) => v.readingIds.includes(BASE_READING))
  return [{ text: baseText(selection, wordText), note: undefined, source: { kind: 'base', sameAsHafs: !hafsRecorded } }]
}

const names = (authorityId: string, narrator: { id: string; readerId: string }) => authorityId === narrator.id || authorityId === narrator.readerId

function entriesOf(group: UsulGroup, narrator: { id: string; readerId: string }): UsulEntry[] {
  const found: UsulEntry[] = []
  for (const r of group.rulings) {
    const attributed = r.attribution.filter((a) => names(a.authorityId, narrator))
    if (attributed.length > 0) {
      found.push(...attributed.map((a) => ({ action: a.action || r.categoryAr, condition: a.condition ?? r.condition, wajhOrder: a.wajhOrder, wajhNote: a.wajhNote })))
    } else {
      found.push(...r.readings.filter((x) => names(x.readingId, narrator)).map((x) => ({ action: x.action || r.categoryAr, condition: r.condition, wajhOrder: undefined, wajhNote: undefined })))
    }
  }
  const unique: UsulEntry[] = []
  for (const e of found) if (!unique.some((u) => JSON.stringify(u) === JSON.stringify(e))) unique.push(e)
  // Stable: entries without a wajh number keep their place after the numbered ones.
  return unique.map((e, i) => ({ e, i })).sort((a, b) => (a.e.wajhOrder ?? Infinity) - (b.e.wajhOrder ?? Infinity) || a.i - b.i).map((x) => x.e)
}

function usulOf(narrator: { id: string; readerId: string }, selection: CompareSelection): ComparedUsul[] {
  return usulGroups(selection).map((group) => {
    const found = entriesOf(group, narrator)
    let status: UsulStatus
    if (found.length === 0) {
      const hafsNamed = group.rulings.some((r) => r.attribution.some((a) => a.authorityId === BASE_READING || a.authorityId === HAFS_READER) || r.readings.some((x) => x.readingId === BASE_READING))
      status = { kind: 'base', sameAsHafs: !hafsNamed }
    } else status = { kind: 'entries', entries: found }
    return { groupId: group.id, sourceRulingIds: group.rulings.map((r) => r.id), categoryAr: group.categoryAr, color: group.color, status }
  })
}

function voiceOf(narrator: { id: string; readerId: string }, selection: CompareSelection, wordText: string): Voice {
  return {
    authorityId: narrator.id,
    name: `الراوي ${narratorLabel(narrator.id as never)}`,
    color: narratorColor(narrator.id as never),
    kind: 'narrator',
    narratorIds: [narrator.id],
    content: { wajhs: wajhsOf(narrator.id, selection, wordText), usul: usulOf(narrator, selection) },
  }
}

/** What `readingId` (a narrator id, or a reader id) reads at one exact `locus`. */
export function readingOf(readingId: string, locus: ComparisonLocus, wordText: string): ComparedReading {
  const narrator = QIRAAT_NARRATORS.find((n) => n.id === readingId)
  if (narrator) return { authorityId: readingId, voices: [voiceOf(narrator, locus.selection, wordText)] }
  const reader = QIRAAT_READERS.find((r) => r.id === readingId)
  if (!reader) return { authorityId: readingId, voices: [] }
  const narrators = QIRAAT_NARRATORS.filter((n) => n.readerId === reader.id)
  const voices = narrators.map((n) => voiceOf(n, locus.selection, wordText))
  // A reader stands for his narrators only when they read alike here; otherwise both are shown.
  if (voices.length > 0 && voices.every((v) => sameContent(v.content, voices[0].content))) {
    return {
      authorityId: readingId,
      voices: [{ authorityId: reader.id, name: `الإمام ${getReader(reader.id).nameArShort}`, color: readerColor(reader.id), kind: 'reader', narratorIds: narrators.map((n) => n.id), content: voices[0].content }],
    }
  }
  return { authorityId: readingId, voices }
}

/** Both readings, and whether they read the word the same way. */
export function compare(a: string, b: string, locus: ComparisonLocus, wordText: string): { first: ComparedReading; second: ComparedReading; isSame: boolean } {
  const first = readingOf(a, locus, wordText)
  const second = readingOf(b, locus, wordText)
  const isSame = first.voices.length > 0 && first.voices.length === second.voices.length && first.voices.every((v, i) => sameContent(v.content, second.voices[i].content))
  return { first, second, isSame }
}

/** A sensible first pair: Hafs, and the first other narrator or reader the data names. */
export function defaultPair(selection: CompareSelection): [string, string] | null {
  const named = [
    ...selection.variants.flatMap((v) => v.readingIds as string[]),
    ...selection.rulings.flatMap((r) => [...r.attribution.map((a) => a.authorityId), ...r.readings.map((x) => x.readingId as string)]),
  ]
  const known = (id: string) => QIRAAT_NARRATORS.some((n) => n.id === id) || QIRAAT_READERS.some((r) => r.id === id)
  const other = named.find((id) => id !== BASE_READING && id !== HAFS_READER && known(id))
  return other ? [BASE_READING, other] : null
}
