// Builds mutashabihat test questions from personal groups.
// A group needs at least two distinct ayah locations to be testable.

export type TestMode = 'mcq' | 'flash' | 'mixed'

export type TestPart = { type: string; text: string }
export type TestVerse = { surah: string; ayah: number; parts: TestPart[] }

export type TestQuestion = {
  id: string
  kind: 'mcq' | 'flash'
  groupId: string
  groupTitle: string
  verse: TestVerse
  /** All distinct locations of the group, in the group's own order (for the answer review). */
  siblings: TestVerse[]
  /** Shuffled answer choices (mcq only). */
  options: Array<{ surah: string; ayah: number }>
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

export const TEST_MODES: TestMode[] = ['mcq', 'flash', 'mixed']

export function locationKey(verse: { surah: string; ayah: number }) {
  return `${verse.surah}:${verse.ayah}`
}

export function verseText(verse: TestVerse) {
  return verse.parts.map((part) => part.text).join(' ').replace(/\s+/g, ' ').trim()
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
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

export function buildTestQuestions(groups: TestSourceGroup[], mode: TestMode, count: number): TestQuestion[] {
  const testable = groups
    .map((group) => ({ group, verses: toTestVerses(group) }))
    .filter(({ verses }) => verses.length >= 2)

  return shuffle(testable).slice(0, count).map(({ group, verses }, index) => {
    const verse = verses[Math.floor(Math.random() * verses.length)]
    const kind = mode === 'mixed' ? (index % 2 === 0 ? 'mcq' : 'flash') : mode
    return {
      id: `${group.id}:${locationKey(verse)}`,
      kind,
      groupId: group.id,
      groupTitle: group.title,
      verse,
      siblings: verses,
      options: kind === 'mcq' ? shuffle(verses.map(({ surah, ayah }) => ({ surah, ayah }))) : [],
    }
  })
}
