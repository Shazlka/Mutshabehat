import ayahData from '../../../public/quran/ayahs.json'
import namesData from '../../../public/quran/surah-names.json'
import metadata from '../../../packages/quran-data/mushaf1441/fixtures/page-metadata.json'
import { normalizeArabic } from '../arabic'
import { JUZ_STARTS } from '../juz'
import type { GenerationContext, Scope, SourceSpan } from './types'

export type Token = { text: string; normalized: string; start: number; end: number }
export type CorpusAyah = { key: string; surahId: number; ayahNumber: number; surahName: string; text: string; normalized: string; tokens: Token[]; ordinal: number; page: number; juz: number; hizb: number }
export type PhraseOccurrence = { ayah: CorpusAyah; token: number; length: number }

// First-ayah metadata from the existing Mushaf fixture's upstream source:
// https://api.quran.com/api/v4/verses/by_hizb/{1..60}?per_page=1&fields=verse_key
// Retrieved 2026-09-17. Unlike a page's first hizb, these preserve intra-page boundaries.
export const HIZB_START_KEYS = '1:1 2:75 2:142 2:203 2:253 3:15 3:93 3:171 4:24 4:88 4:148 5:27 5:82 6:36 6:111 7:1 7:88 7:171 8:41 9:34 9:93 10:26 11:6 11:84 12:53 13:19 15:1 16:51 17:1 17:99 18:75 20:1 21:1 22:1 23:1 24:21 25:21 26:111 27:56 28:51 29:46 31:22 33:31 34:24 36:28 37:145 39:32 40:41 41:47 43:24 46:1 48:18 51:31 55:1 58:1 62:1 67:1 72:1 78:1 87:1'.split(' ')

const names = namesData as Record<string, string>
const pages = metadata.ayahToPage as Record<string, number>
let corpus: CorpusAyah[] | undefined
const byKey = new Map<string, CorpusAyah>()
const bySurah = new Map<number, CorpusAyah[]>()
const phrases = new Map<string, PhraseOccurrence[]>()
const identical = new Map<string, CorpusAyah[]>()

export function compareAyahKeys(a: string, b: string): number {
  const [as, aa] = a.split(':').map(Number)
  const [bs, ba] = b.split(':').map(Number)
  return as - bs || aa - ba
}

/** One immutable-by-convention cached corpus and phrase index per server process. */
export function getCorpus(): CorpusAyah[] {
  if (corpus) return corpus
  corpus = []
  let juz = 1
  let hizb = 1
  for (const [surah, ayahs] of Object.entries(ayahData as Record<string, Record<string, string>>)) {
    for (const [number, text] of Object.entries(ayahs)) {
      const key = `${surah}:${number}`
      while (juz < 30 && compareAyahKeys(key, `${JUZ_STARTS[juz].surah}:${JUZ_STARTS[juz].ayah}`) >= 0) juz++
      while (hizb < HIZB_START_KEYS.length && compareAyahKeys(key, HIZB_START_KEYS[hizb]) >= 0) hizb++
      const tokens: Token[] = Array.from(text.matchAll(/\S+/gu)).filter(m => /\p{L}/u.test(m[0])).map(m => ({ text: m[0], normalized: normalizeArabic(m[0]), start: m.index!, end: m.index! + m[0].length }))
      const ayah: CorpusAyah = { key, surahId: +surah, ayahNumber: +number, surahName: names[surah], text, normalized: normalizeArabic(text), tokens, ordinal: corpus.length, page: pages[key], juz, hizb }
      corpus.push(ayah)
      byKey.set(key, ayah)
      const surahAyahs = bySurah.get(+surah) ?? []
      surahAyahs.push(ayah)
      bySurah.set(+surah, surahAyahs)
      const matches = identical.get(ayah.normalized) ?? []
      matches.push(ayah)
      identical.set(ayah.normalized, matches)
      for (let i = 0; i < tokens.length; i++) for (const length of [1, 2, 3, 4, 5]) {
        if (i + length >= tokens.length) continue
        const phrase = tokens.slice(i, i + length).map(t => t.normalized).join(' ')
        const occurrences = phrases.get(phrase) ?? []
        occurrences.push({ ayah, token: i, length })
        phrases.set(phrase, occurrences)
      }
    }
  }
  return corpus
}

export function getAyah(key: string): CorpusAyah | undefined { getCorpus(); return byKey.get(key) }
export function getSurahAyahs(id: number): CorpusAyah[] { getCorpus(); return bySurah.get(id) ?? [] }
export function getIdenticalAyahs(ayah: CorpusAyah): CorpusAyah[] { getCorpus(); return identical.get(ayah.normalized) ?? [] }
export function getPhraseOccurrences(ayah: CorpusAyah, token: number, length: number): PhraseOccurrence[] {
  getCorpus()
  return phrases.get(ayah.tokens.slice(token, token + length).map(t => t.normalized).join(' ')) ?? []
}
export function spanForTokens(ayah: CorpusAyah, from: number, to: number): SourceSpan {
  if (from < 0 || to > ayah.tokens.length || from >= to) throw new Error('Invalid Quran token span')
  return { ayahKey: ayah.key, start: ayah.tokens[from].start, end: ayah.tokens[to - 1].end }
}
export function fullSpan(ayah: CorpusAyah): SourceSpan { return { ayahKey: ayah.key, start: 0, end: ayah.text.length } }
export function sourceText(span: SourceSpan): string { return getAyah(span.ayahKey)?.text.slice(span.start, span.end) ?? '' }

export function scopeAyahs(scope: Scope, context: GenerationContext): CorpusAyah[] {
  let allowed: Set<string> | undefined
  if (scope.type === 'group' || scope.type === 'studied' || scope.type === 'studied_mutashabihat') {
    const groups = context.groups.filter(g => scope.type === 'group' ? g.id === scope.groupId : g.studied)
    allowed = new Set(groups.flatMap(g => g.ayahKeys))
  }
  const from = scope.from ?? 1
  const to = scope.to ?? from
  return getCorpus().filter(a => {
    if (context.reviewAyahKeys?.length && !context.reviewAyahKeys.includes(a.key)) return false
    switch (scope.type) {
      case 'all': return true
      case 'surahs': return !!scope.surahIds?.includes(a.surahId)
      case 'juz': return a.juz >= from && a.juz <= to
      case 'hizb': return a.hizb >= from && a.hizb <= to
      case 'pages': return a.page >= from && a.page <= to
      case 'ayah_range': return !!scope.surahIds?.includes(a.surahId) && a.ayahNumber >= from && a.ayahNumber <= to
      default: return allowed?.has(a.key) ?? false
    }
  })
}
