import { normalizeArabic } from '../arabic'
import { getAyah, getCorpus, getPhraseOccurrences, getSurahAyahs, sourceText, spanForTokens } from './corpus'
import type { CorpusAyah } from './corpus'
import type { Choice, Difficulty, SimilarGroup, SourceSpan } from './types'

export function stableHash(value: string): string {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619)
  return (hash >>> 0).toString(36)
}
export function stableUuid(value: string): string {
  const hex = [0, 1, 2, 3].map(i => parseInt(stableHash(`${i}:${value}`), 36).toString(16).padStart(8, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`
}
export function seededRandom(seed: string): () => number {
  let state = parseInt(stableHash(seed), 36)
  return () => {
    state += 0x6D2B79F5
    let value = state
    value = Math.imul(value ^ value >>> 15, value | 1)
    value ^= value + Math.imul(value ^ value >>> 7, value | 61)
    return ((value ^ value >>> 14) >>> 0) / 4294967296
  }
}
export function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}
export function textSimilarity(a: string, b: string): number {
  const an = normalizeArabic(a)
  const bn = normalizeArabic(b)
  const left = new Set(an.split(/\s+/))
  const right = new Set(bn.split(/\s+/))
  const shared = [...left].filter(t => right.has(t)).length
  const grams = (text: string) => new Set(Array.from({ length: Math.max(0, text.length - 1) }, (_, i) => text.slice(i, i + 2)))
  const ag = grams(an)
  const bg = grams(bn)
  const sharedGrams = [...ag].filter(g => bg.has(g)).length
  return 0.75 * shared / Math.max(1, left.size + right.size - shared) + 0.25 * 2 * sharedGrams / Math.max(1, ag.size + bg.size)
}

/** Seeded, bounded sampling; no full-Quran scan per generated question. */
export function candidateAyahs(ayah: CorpusAyah, groups: SimilarGroup[], random: () => number): CorpusAyah[] {
  const related = groups.filter(g => g.ayahKeys.includes(ayah.key)).flatMap(g => g.ayahKeys).map(getAyah).filter((a): a is CorpusAyah => !!a)
  const matches = getPhraseOccurrences(ayah, 0, Math.min(2, ayah.tokens.length)).slice(0, 150).map(o => o.ayah)
  const all = getCorpus()
  const sample = Array.from({ length: 80 }, () => all[Math.floor(random() * all.length)])
  return [...new Map([...related, ...matches, ...shuffled(getSurahAyahs(ayah.surahId), random).slice(0, 80), ...sample].map(a => [a.key, a])).values()]
}

export function chooseTextChoices(correct: SourceSpan, candidates: SourceSpan[], difficulty: Difficulty, random: () => number, salt: string, preferredKeys: Set<string> = new Set()): { choices: Choice[]; correctChoiceId: string } | null {
  const text = sourceText(correct)
  const normalized = normalizeArabic(text)
  const seen = new Set([normalized])
  const candidatesUnique = shuffled(candidates, random).filter(span => {
    const n = normalizeArabic(sourceText(span))
    if (!n || seen.has(n)) return false
    seen.add(n)
    return true
  })
  if (difficulty >= 3) candidatesUnique.sort((a, b) =>
    Number(preferredKeys.has(b.ayahKey)) - Number(preferredKeys.has(a.ayahKey)) || textSimilarity(text, sourceText(b)) - textSimilarity(text, sourceText(a)))
  if (candidatesUnique.length < 3) return null
  const spans = [correct, ...candidatesUnique.slice(0, 3)]
  const choices = spans.map(span => ({ id: `c_${stableHash(`${salt}:${span.ayahKey}:${span.start}:${span.end}`)}`, text: sourceText(span), source: span }))
  return { choices: shuffled(choices, random), correctChoiceId: choices[0].id }
}

/** Continuations of the same real Quran phrase, preserving exact source offsets. */
export function phraseContinuations(ayah: CorpusAyah, cut: number, length: number, anchorLength: number): SourceSpan[] {
  if (cut < anchorLength) return []
  return getPhraseOccurrences(ayah, cut - anchorLength, anchorLength)
    .filter(o => o.token + anchorLength + length <= o.ayah.tokens.length)
    .map(o => spanForTokens(o.ayah, o.token + anchorLength, o.token + anchorLength + length))
}
