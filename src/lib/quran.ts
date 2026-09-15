// Server-side Quran reference loader. Reads from /public/quran/*.json.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { normalizeArabic, rasmSkeleton } from '@/lib/arabic'

let _surahNames: Record<string, string> | null = null
let _ayahs: Record<string, Record<string, string>> | null = null

function publicPath(file: string) {
  return resolve(process.cwd(), 'public', 'quran', file)
}

export function getSurahNames(): Record<string, string> {
  if (!_surahNames) {
    _surahNames = JSON.parse(readFileSync(publicPath('surah-names.json'), 'utf-8'))
  }
  return _surahNames!
}

export function getAllAyahs(): Record<string, Record<string, string>> {
  if (!_ayahs) {
    _ayahs = JSON.parse(readFileSync(publicPath('ayahs.json'), 'utf-8'))
  }
  return _ayahs!
}

export function getAyah(surahNo: number | string, ayahNo: number | string): string | null {
  const ayahs = getAllAyahs()
  return ayahs[String(surahNo)]?.[String(ayahNo)] ?? null
}

export function getSurahAyahs(surahNo: number | string): Record<string, string> | null {
  const ayahs = getAllAyahs()
  return ayahs[String(surahNo)] ?? null
}

// ── Pre-normalized search index ──────────────────────────────────────────
// The old search re-ran normalizeArabic() over all 6,236 ayahs on every
// request. We build a flat, already-normalized index once per process so a
// search is a single linear scan over precomputed strings — no re-normalizing.
// Each row carries both the normalized text (exact tier) and the rasm skeleton
// (fuzzy tier — long alef removed) so a defective/plene Uthmani variant still hits.
type AyahRow = { surah: number; ayah: number; text: string; norm: string; skel: string }
let _searchIndex: AyahRow[] | null = null

function getSearchIndex(): AyahRow[] {
  if (!_searchIndex) {
    const ayahs = getAllAyahs()
    const idx: AyahRow[] = []
    for (const [surahNum, sAyahs] of Object.entries(ayahs)) {
      const s = parseInt(surahNum, 10)
      for (const [ayahNum, text] of Object.entries(sAyahs)) {
        idx.push({
          surah: s, ayah: parseInt(ayahNum, 10), text,
          norm: normalizeArabic(text),
          skel: rasmSkeleton(text),
        })
      }
    }
    _searchIndex = idx
  }
  return _searchIndex
}

type AyahHit = { surah: number; ayah: number; text: string; approximate?: boolean }

export function searchAyahs(query: string, limit = 50): AyahHit[] {
  const qNorm = normalizeArabic(query)
  if (!qNorm) return []
  const idx = getSearchIndex()

  // Tier 1 — exact (normalized) substring match.
  const results: AyahHit[] = []
  const seen = new Set<string>()
  for (const row of idx) {
    if (row.norm.includes(qNorm)) {
      results.push({ surah: row.surah, ayah: row.ayah, text: row.text })
      seen.add(`${row.surah}:${row.ayah}`)
      if (results.length >= limit) return results
    }
  }

  // Tier 2 — rasm skeleton fallback (approximate), only to fill remaining room.
  const qSkel = rasmSkeleton(query)
  if (qSkel.length >= 3) {
    for (const row of idx) {
      const key = `${row.surah}:${row.ayah}`
      if (seen.has(key)) continue
      if (row.skel.includes(qSkel)) {
        results.push({ surah: row.surah, ayah: row.ayah, text: row.text, approximate: true })
        if (results.length >= limit) break
      }
    }
  }

  return results
}

// Build a surah name → number map (e.g. "النمل" → 27)
let _nameToNumber: Record<string, number> | null = null
export function getSurahNumberByName(name: string): number | null {
  if (!_nameToNumber) {
    const names = getSurahNames()
    _nameToNumber = {}
    for (const [num, n] of Object.entries(names)) {
      _nameToNumber[n] = parseInt(num, 10)
    }
  }
  return _nameToNumber[name] ?? null
}
