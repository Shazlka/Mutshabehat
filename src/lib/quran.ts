// Server-side Quran reference loader. Reads from /public/quran/*.json.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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
