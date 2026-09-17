import { normalizeArabic } from '../arabic'
import { getAyah, getIdenticalAyahs, sourceText } from './corpus'
import type { PrivateQuestion, SourceSpan } from './types'

/** False for any malformed provenance, duplicate choice, ambiguous location or invalid
 * answer relation. Does not mutate the question or normalize displayed Quran text. */
export function validateQuestion(q: PrivateQuestion): boolean {
  if (!Number.isInteger(q.difficulty) || q.difficulty < 1 || q.difficulty > 5 || !q.id || !q.fingerprint || !q.prompt.trim()) return false
  const ayah = getAyah(q.ayahKey)
  if (!ayah || q.surahId !== ayah.surahId || q.ayahNumber !== ayah.ayahNumber || q.surahName !== ayah.surahName || q.page !== ayah.page) return false
  if (q.choices.length !== 4 || new Set(q.choices.map(c => c.id)).size !== 4 || new Set(q.choices.map(c => normalizeArabic(c.text))).size !== 4) return false
  const correct = q.choices.find(c => c.id === q.correctChoiceId)
  if (!correct || q.choices.some(c => !c.text.trim()) || !q.contextSpans.length) return false
  const validSpan = (s: SourceSpan) => {
    const a = getAyah(s.ayahKey)
    return !!a && Number.isInteger(s.start) && Number.isInteger(s.end) && s.start >= 0 && s.end > s.start && s.end <= a.text.length
      && (s.start === 0 || a.tokens.some(t => t.start === s.start)) && (s.end === a.text.length || a.tokens.some(t => t.end === s.end))
  }
  if (q.contextSpans.some(s => !validSpan(s) || s.ayahKey !== ayah.key)) return false
  if (q.blank) {
    if (q.context !== '' || q.blank.before !== sourceText(q.contextSpans[0]) || q.blank.after !== (q.contextSpans[1] ? sourceText(q.contextSpans[1]) : '')) return false
  } else if (q.context !== q.contextSpans.map(sourceText).join('\n')) return false
  if (['missing_word', 'difference'].includes(q.type) && !q.blank) return false
  if (q.choices.some(c => c.source && (!validSpan(c.source) || c.text !== sourceText(c.source)))) return false
  for (const comparison of q.comparisons) {
    const source = getAyah(comparison.ayahKey)
    if (!source || source.surahName !== comparison.surahName || !source.text.includes(comparison.text)) return false
  }
  if (['surah', 'ayah_number', 'location'].includes(q.type)) {
    if (q.choices.some(c => c.source) || q.context !== ayah.text) return false
    const identical = getIdenticalAyahs(ayah)
    if (q.type === 'surah') {
      if (identical.some(a => a.surahId !== ayah.surahId)) return false
      return q.choices.every(c => getAyah(`${c.reference}:1`)?.surahName === c.text) && correct.reference === String(ayah.surahId)
    }
    if (q.type === 'ayah_number') {
      if (identical.some(a => a.surahId === ayah.surahId && a.key !== ayah.key)) return false
      return q.choices.every(c => { const a = getAyah(c.reference ?? ''); return a?.surahId === ayah.surahId && c.text === String(a.ayahNumber) }) && correct.reference === ayah.key
    }
    if (identical.length > 1) return false
    return q.choices.every(c => { const a = getAyah(c.reference ?? ''); return !!a && c.text === `${a.surahName} · ${a.ayahNumber}` }) && correct.reference === ayah.key
  }
  if (q.choices.some(c => !c.source) || !correct.source) return false
  const target = getAyah(correct.source.ayahKey)!
  if (['next_ayah', 'previous_ayah', 'transition'].includes(q.type)) {
    const step = q.type === 'previous_ayah' ? -1 : 1
    return target.surahId === ayah.surahId && target.ayahNumber === ayah.ayahNumber + step && correct.source.start === target.tokens[0].start
  }
  if (target.key !== ayah.key || q.contextSpans.some(s => s.start < correct.source!.end && s.end > correct.source!.start)) return false
  const start = ayah.tokens.findIndex(t => t.start === correct.source!.start)
  const end = ayah.tokens.findIndex(t => t.end === correct.source!.end)
  if (start < 0 || end < start) return false
  if (q.type === 'ayah_beginning') return start === 0 && q.contextSpans[0].start === ayah.tokens[end + 1]?.start
  if (q.type === 'ayah_ending' || q.type === 'complete_ayah') return end === ayah.tokens.length - 1 && q.contextSpans[0].end === ayah.tokens[start - 1]?.end
  if (q.contextSpans[0].end !== ayah.tokens[start - 1]?.end) return false
  if (q.blank && q.contextSpans[1] && q.contextSpans[1].start !== ayah.tokens[end + 1]?.start) return false
  if (q.type === 'mutashabihat' || q.type === 'difference') {
    if (start < 3 || (q.type === 'difference' && start !== end)) return false
    const anchor = ayah.tokens.slice(start - 3, start).map(t => t.normalized).join(' ')
    return q.choices.every(c => {
      const a = getAyah(c.source!.ayahKey)!
      const i = a.tokens.findIndex(t => t.start === c.source!.start)
      return i >= 3 && a.tokens.slice(i - 3, i).map(t => t.normalized).join(' ') === anchor
    })
  }
  return ['missing_word', 'next_word'].includes(q.type) && start === end
}
