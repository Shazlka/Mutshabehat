// Builds mutashabihat test questions from personal groups.
// Whole-Quran questions are built server-side in test-questions-quran.ts.
// A group needs at least two distinct ayah locations to be testable.

import { normalizeArabic } from '@/lib/arabic'

export type TestMode = 'mcq' | 'words' | 'flash' | 'mixed'
export type TestKind = 'mcq' | 'words' | 'flash'
export type TestSource = 'personal' | 'quran'

export type TestPart = { type: string; text: string }
export type TestVerse = { surah: string; ayah: number; parts: TestPart[] }

export type TestQuestion = {
  id: string
  kind: TestKind
  source: TestSource
  groupId: string | null
  groupTitle: string | null
  verse: TestVerse
  /** All distinct locations of the group, in the group's own order (for the answer review). */
  siblings: TestVerse[]
  /** Shuffled answer choices (mcq only). */
  options: Array<{ surah: string; ayah: number }>
  /** mcq: every choice key that counts as correct; defaults to the verse's own location. */
  acceptedKeys?: string[]
  /** mcq: options name only the surah (whole-Quran questions). */
  surahOnly?: boolean
  /** words: index of the hidden part in verse.parts, its text, and the shuffled word choices. */
  blankIndex?: number
  answer?: string
  wordOptions?: string[]
  /** Where to review a missed question (group page or mushaf page). */
  reviewHref: string
}

export type TestSourceGroup = {
  id: string
  title: string
  verses: Array<{
    surah: string
    ayah: number
    sort_order: number | null
    parts: Array<{ type: string; text: string; sort_order: number | null }>
  }>
}

export const TEST_MODES: TestMode[] = ['mcq', 'words', 'flash', 'mixed']
export const TEST_SOURCES: TestSource[] = ['personal', 'quran']

const MIXED_KINDS: TestKind[] = ['mcq', 'words', 'flash']
// Part types that carry the wording that differs between similar ayat.
const DIFFERING_PART_TYPES = new Set(['diff', 'diff2', 'diff3', 'addition', 'unique'])

export function locationKey(verse: { surah: string; ayah: number }) {
  return `${verse.surah}:${verse.ayah}`
}

export function verseText(verse: TestVerse) {
  return verse.parts.map((part) => part.text).join(' ').replace(/\s+/g, ' ').trim()
}

export function sameWording(a: string, b: string) {
  return normalizeArabic(a).replace(/\s+/g, ' ') === normalizeArabic(b).replace(/\s+/g, ' ')
}

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function kindForIndex(mode: TestMode, index: number): TestKind {
  return mode === 'mixed' ? MIXED_KINDS[index % MIXED_KINDS.length] : mode
}

/** Distinct texts by normalized wording, keeping the first spelling seen. */
export function distinctWordings(texts: string[]) {
  const seen = new Set<string>()
  const out: string[] = []
  for (const text of texts) {
    const trimmed = text.trim()
    const key = normalizeArabic(trimmed).replace(/\s+/g, ' ')
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
  }
  return out
}

function toTestVerses(group: TestSourceGroup): TestVerse[] {
  const seen = new Set<string>()
  const verses: TestVerse[] = []
  for (const verse of [...group.verses].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))) {
    const key = locationKey(verse)
    // Skip incomplete rows (no parts, or ayah not set) — they can't be answered.
    if (seen.has(key) || verse.parts.length === 0 || !(verse.ayah >= 1)) continue
    seen.add(key)
    verses.push({
      surah: verse.surah,
      ayah: verse.ayah,
      parts: [...verse.parts]
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((part) => ({ type: part.type, text: part.text })),
    })
  }
  return verses
}

// Hide one differing part of a verse; the choices are the matching parts of its similar ayat.
function buildWordsBlank(verses: TestVerse[]) {
  for (const verse of shuffle(verses)) {
    const candidates = shuffle(
      verse.parts
        .map((part, index) => ({ part, index }))
        .filter(({ part }) => DIFFERING_PART_TYPES.has(part.type) && part.text.trim()),
    )
    for (const { part, index } of candidates) {
      const others = verses.filter((other) => other !== verse)
      const sameType = others.flatMap((other) => other.parts.filter((p) => p.type === part.type).map((p) => p.text))
      const anyDiffering = others.flatMap((other) => other.parts.filter((p) => DIFFERING_PART_TYPES.has(p.type)).map((p) => p.text))
      const options = distinctWordings([part.text, ...sameType, ...anyDiffering]).slice(0, 4)
      if (options.length >= 2) return { verse, blankIndex: index, answer: part.text.trim(), wordOptions: shuffle(options) }
    }
  }
  return null
}

export function buildTestQuestions(groups: TestSourceGroup[], mode: TestMode, count: number): TestQuestion[] {
  const testable = shuffle(
    groups
      .map((group) => ({ group, verses: toTestVerses(group) }))
      .filter(({ verses }) => verses.length >= 2),
  )

  const questions: TestQuestion[] = []
  for (const { group, verses } of testable) {
    if (questions.length >= count) break
    const kind = kindForIndex(mode, questions.length)
    const base = { kind, source: 'personal' as const, groupId: group.id, groupTitle: group.title, siblings: verses, reviewHref: `/groups/${group.id}` }
    if (kind === 'words') {
      const blank = buildWordsBlank(verses)
      // Groups without marked differing parts can't make a words question; a mixed test falls back to mcq.
      if (!blank) {
        if (mode !== 'mixed') continue
        const verse = verses[Math.floor(Math.random() * verses.length)]
        questions.push({ ...base, kind: 'mcq', id: `${group.id}:${locationKey(verse)}:mcq`, verse, options: shuffle(verses.map(({ surah, ayah }) => ({ surah, ayah }))) })
        continue
      }
      questions.push({ ...base, id: `${group.id}:${locationKey(blank.verse)}:words`, verse: blank.verse, options: [], blankIndex: blank.blankIndex, answer: blank.answer, wordOptions: blank.wordOptions })
      continue
    }
    const verse = verses[Math.floor(Math.random() * verses.length)]
    questions.push({
      ...base,
      id: `${group.id}:${locationKey(verse)}:${kind}`,
      verse,
      options: kind === 'mcq' ? shuffle(verses.map(({ surah, ayah }) => ({ surah, ayah }))) : [],
    })
  }
  return questions
}
