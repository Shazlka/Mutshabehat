// Whole-Quran test questions (server only): any ayah, not just the personal groups.
// Distractors come from the Quran itself so they look like real mutashabihat:
//  - location: other surahs where an ayah opens with the same words
//  - words: other words that follow the same word elsewhere in the Quran

import { getAllAyahs, getSurahNames } from '@/lib/quran'
import { normalizeArabic } from '@/lib/arabic'
import { getMushaf1441PageForAyahKey } from '../../packages/quran-data/mushaf1441/pageMetadata'
import { distinctWordings, kindForIndex, locationKey, shuffle, type TestMode, type TestQuestion, type TestVerse } from '@/lib/test-questions'

type QuranAyah = { surahNo: number; surah: string; ayah: number; text: string; words: string[]; norms: string[] }

type QuranIndex = {
  ayahs: QuranAyah[]
  /** normalized preceding word (and preceding two words) → spellings of the words that follow anywhere in the Quran */
  followers: Map<string, Map<string, string>>
  /** normalized first three words → ayat opening that way */
  openings: Map<string, QuranAyah[]>
  /** normalized full text → surahs containing an ayah with that exact wording */
  wordingSurahs: Map<string, Set<string>>
}

let cachedIndex: QuranIndex | null = null

// Pause/sajda marks on a word would hint at the answer when shown as a choice.
const WAQF_MARKS = /[\u06D6-\u06DC\u06DE\u06E9]/g

function addFollower(followers: QuranIndex['followers'], key: string, norm: string, spelling: string) {
  let next = followers.get(key)
  if (!next) followers.set(key, (next = new Map()))
  if (!next.has(norm)) next.set(norm, spelling.replace(WAQF_MARKS, ''))
}

const HAS_ARABIC_LETTER = /[ء-يٱ-ۓ]/

function getIndex(): QuranIndex {
  if (cachedIndex) return cachedIndex
  const names = getSurahNames()
  const ayahs: QuranAyah[] = []
  const followers = new Map<string, Map<string, string>>()
  const openings = new Map<string, QuranAyah[]>()
  const wordingSurahs = new Map<string, Set<string>>()

  for (const [surahKey, surahAyahs] of Object.entries(getAllAyahs())) {
    const surahNo = Number(surahKey)
    const surah = names[surahKey]
    if (!surah) continue
    for (const [ayahKey, text] of Object.entries(surahAyahs)) {
      const words = text.split(/\s+/).filter((word) => HAS_ARABIC_LETTER.test(word))
      const norms = words.map((word) => normalizeArabic(word))
      const entry: QuranAyah = { surahNo, surah, ayah: Number(ayahKey), text, words, norms }
      ayahs.push(entry)

      for (let i = 1; i < words.length; i += 1) {
        addFollower(followers, norms[i - 1], norms[i], words[i])
        if (i >= 2) addFollower(followers, `${norms[i - 2]} ${norms[i - 1]}`, norms[i], words[i])
      }
      if (words.length >= 3) {
        const opening = norms.slice(0, 3).join(' ')
        openings.set(opening, [...(openings.get(opening) ?? []), entry])
      }
      const wording = norms.join(' ')
      wordingSurahs.set(wording, (wordingSurahs.get(wording) ?? new Set()).add(surah))
    }
  }
  cachedIndex = { ayahs, followers, openings, wordingSurahs }
  return cachedIndex
}

function toVerse(ayah: QuranAyah): TestVerse {
  return { surah: ayah.surah, ayah: ayah.ayah, parts: [{ type: 'normal', text: ayah.text }] }
}

function reviewHref(ayah: QuranAyah) {
  const page = getMushaf1441PageForAyahKey(`${ayah.surahNo}:${ayah.ayah}`)
  return page ? `/mushaf-1441?page=${page}` : '/mushaf-1441'
}

// Returns shuffled choices plus every choice that is also correct (identical wording elsewhere).
function buildLocation(ayah: QuranAyah, index: QuranIndex, surahFilter: string | null): { options: TestQuestion['options']; acceptedKeys: string[] } | null {
  if (surahFilter) {
    // Within one surah, ask for the ayah number among nearby ayat.
    const count = index.ayahs.filter((a) => a.surah === ayah.surah).length
    if (count < 4) return null
    const numbers = new Set([ayah.ayah])
    while (numbers.size < 4) {
      const offset = Math.floor(Math.random() * 13) - 6
      const candidate = ayah.ayah + offset
      if (candidate >= 1 && candidate <= count) numbers.add(candidate)
    }
    const wording = ayah.norms.join(' ')
    const options = shuffle([...numbers].map((n) => ({ surah: ayah.surah, ayah: n })))
    const acceptedKeys = options
      .filter((option) => index.ayahs.some((a) => a.surah === option.surah && a.ayah === option.ayah && a.norms.join(' ') === wording))
      .map(locationKey)
    return { options, acceptedKeys }
  }
  const similar = (index.openings.get(ayah.norms.slice(0, 3).join(' ')) ?? []).map((a) => a.surah)
  const sameWording = index.wordingSurahs.get(ayah.norms.join(' ')) ?? new Set([ayah.surah])
  const allSurahs = Object.values(getSurahNames())
  const distractors = [...new Set([...shuffle(similar), ...shuffle(allSurahs)])].filter((s) => !sameWording.has(s))
  const options = shuffle([ayah.surah, ...distractors.slice(0, 3)].map((surah) => ({ surah, ayah: ayah.ayah })))
  return { options, acceptedKeys: [locationKey(ayah)] }
}

function alternativesAfter(index: QuranIndex, key: string, answerNorm: string) {
  return [...(index.followers.get(key)?.entries() ?? [])].filter(([norm]) => norm !== answerNorm).map(([, spelling]) => spelling)
}

// Prefer a word whose two preceding words continue differently elsewhere (a true mutashabih spot).
function buildWords(ayah: QuranAyah, index: QuranIndex) {
  const candidates = Array.from({ length: Math.max(0, ayah.words.length - 1) }, (_, i) => i + 1).map((position) => {
    const answerNorm = ayah.norms[position]
    const strong = position >= 2 ? alternativesAfter(index, `${ayah.norms[position - 2]} ${ayah.norms[position - 1]}`, answerNorm) : []
    const weak = alternativesAfter(index, ayah.norms[position - 1], answerNorm)
    return { position, strong, weak }
  })
  const ordered = [...shuffle(candidates.filter((c) => c.strong.length > 0)), ...shuffle(candidates.filter((c) => c.strong.length === 0))]
  for (const { position, strong, weak } of ordered) {
    const options = distinctWordings([ayah.words[position].replace(WAQF_MARKS, ''), ...shuffle(strong), ...shuffle(weak)]).slice(0, 4)
    if (options.length < 2) continue
    return {
      parts: [
        { type: 'normal', text: ayah.words.slice(0, position).join(' ') },
        { type: 'normal', text: ayah.words[position] },
        ...(position + 1 < ayah.words.length ? [{ type: 'normal', text: ayah.words.slice(position + 1).join(' ') }] : []),
      ],
      answer: ayah.words[position],
      wordOptions: shuffle(options),
    }
  }
  return null
}

export function buildQuranTestQuestions(mode: TestMode, count: number, surahFilter: string | null): TestQuestion[] {
  const index = getIndex()
  const pool = shuffle(index.ayahs.filter((a) => a.words.length >= 3 && (!surahFilter || a.surah === surahFilter)))
  const questions: TestQuestion[] = []
  for (const ayah of pool) {
    if (questions.length >= count) break
    const kind = kindForIndex(mode, questions.length)
    const verse = toVerse(ayah)
    const base = { kind, source: 'quran' as const, groupId: null, groupTitle: null, siblings: [verse], reviewHref: reviewHref(ayah) }
    const id = `quran:${locationKey(ayah)}:${kind}`
    if (kind === 'mcq') {
      const location = buildLocation(ayah, index, surahFilter)
      if (!location) continue
      questions.push({ ...base, id, verse, options: location.options, acceptedKeys: location.acceptedKeys, surahOnly: !surahFilter })
    } else if (kind === 'words') {
      const blank = buildWords(ayah, index)
      if (!blank) continue
      questions.push({ ...base, id, verse: { ...verse, parts: blank.parts }, options: [], blankIndex: 1, answer: blank.answer, wordOptions: blank.wordOptions })
    } else {
      questions.push({ ...base, id, verse, options: [] })
    }
  }
  return questions
}
