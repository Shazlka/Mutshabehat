// Builds public/quran/ayah-layout.json: [surah, ayah, page, wordCount] for all 6,236 ayat plus page→juz.
// The browser (memorization UI) builds its QuranIndex from this file; tests check it equals the Node index.
// Run: npx tsx scripts/build-ayah-layout.ts
import { writeFileSync } from 'node:fs'
import { buildAyahLayoutFile } from '../packages/memorization-core/quranIndexNode'

const layout = buildAyahLayoutFile()
writeFileSync('public/quran/ayah-layout.json', JSON.stringify(layout))
console.log(`wrote ${layout.rows.length} rows, ${Object.keys(layout.pageJuz).length} pages`)
