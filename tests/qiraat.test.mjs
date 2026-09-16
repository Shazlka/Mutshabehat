import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { NextRequest } from 'next/server.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

// 1. Data Integrity Tests
test('Qiraat Page 1 Verified Dataset - Schema and Structural Integrity', () => {
  const verifiedPath = path.join(ROOT, 'data', 'qiraat', 'verified', 'page-001.json')
  assert.ok(fs.existsSync(verifiedPath), 'verified page-001.json must exist')

  const data = JSON.parse(fs.readFileSync(verifiedPath, 'utf8'))

  // Verify source
  assert.equal(data.source.id, 'ten-qiraat-mushaf-1')
  assert.equal(data.source.title, 'مصحف القراءات العشر')

  // Verify loci count: exactly 4 loci on Page 1
  assert.equal(data.loci.length, 4, 'Must have exactly 4 loci on Page 1')

  // Verify markers 1, 2, 3, 4
  const markers = data.loci.map(l => l.source_marker)
  assert.deepEqual(markers, ['1', '2', '3', '4'])

  // Total targets across loci: exactly 5 targets (locus 4 has 2 targets)
  const totalTargets = data.loci.reduce((sum, l) => sum + l.targets.length, 0)
  assert.equal(totalTargets, 5, 'Must have exactly 5 targets (1:4:1, 1:6:2, 1:7:1, 1:7:4, 1:7:7)')

  // Total variants across loci: exactly 10 variants
  const totalVariants = data.loci.reduce((sum, l) => sum + l.variants.length, 0)
  assert.equal(totalVariants, 10, 'Must have exactly 10 variants across the 4 loci')

  // Total attributions across all variants: exactly 45
  const totalAttributions = data.loci.reduce(
    (sum, l) => sum + l.variants.reduce((vSum, v) => vSum + v.attributions.length, 0),
    0
  )
  assert.equal(totalAttributions, 45, 'Must have exactly 45 attributions')
})

test('Qiraat Page 1 - Marker 4 Dual Target Verification (عَلَيْهِمْ معًا)', () => {
  const verifiedPath = path.join(ROOT, 'data', 'qiraat', 'verified', 'page-001.json')
  const data = JSON.parse(fs.readFileSync(verifiedPath, 'utf8'))

  const locus4 = data.loci.find(l => l.source_marker === '4')
  assert.ok(locus4, 'Locus 4 must exist')
  assert.equal(locus4.targets.length, 2, 'Locus 4 must have exactly 2 targets for معًا')

  const target1 = locus4.targets[0]
  const target2 = locus4.targets[1]

  assert.equal(target1.surah, 1)
  assert.equal(target1.ayah, 7)
  assert.equal(target1.word_index, 4)
  assert.equal(target1.quran_word_id, 'qurancom-word-8414')
  assert.equal(target1.base_text_uthmani, 'عَلَيْهِمْ')
  assert.equal(target1.line_number, 7)
  assert.equal(target1.word_index_in_line, 1)

  assert.equal(target2.surah, 1)
  assert.equal(target2.ayah, 7)
  assert.equal(target2.word_index, 7)
  assert.equal(target2.quran_word_id, 'qurancom-word-8417')
  assert.equal(target2.base_text_uthmani, 'عَلَيْهِمْ')
  assert.equal(target2.line_number, 7)
  assert.equal(target2.word_index_in_line, 4)
})

test('Qiraat Identity Separation - Khalaf Hamza vs Khalaf Ashir', () => {
  const verifiedPath = path.join(ROOT, 'data', 'qiraat', 'verified', 'page-001.json')
  const data = JSON.parse(fs.readFileSync(verifiedPath, 'utf8'))

  const persons = data.persons
  const khalafAshir = persons.find(p => p.id === 'KHALAF_ASHIR')
  const khalafHamza = persons.find(p => p.id === 'KHALAF_HAMZA')
  const khallad = persons.find(p => p.id === 'KHALLAD')
  const hamza = persons.find(p => p.id === 'HAMZA')

  assert.ok(khalafAshir, 'KHALAF_ASHIR entity must exist')
  assert.ok(khalafHamza, 'KHALAF_HAMZA entity must exist')
  assert.ok(khallad, 'KHALLAD entity must exist')
  assert.ok(hamza, 'HAMZA entity must exist')

  // Imam #10 (Khalaf al-Ashir)
  assert.equal(khalafAshir.person_type, 'imam', 'Khalaf al-Ashir must be an imam')
  assert.equal(khalafAshir.parent_person_id, null, 'Khalaf al-Ashir has no parent imam')
  assert.equal(khalafAshir.order_index, 10, 'Khalaf al-Ashir is 10th imam')

  // Rawi #1 for Hamza (Khalaf an Hamza)
  assert.equal(khalafHamza.person_type, 'rawi', 'Khalaf an Hamza must be a rawi')
  assert.equal(khalafHamza.parent_person_id, 'HAMZA', 'Khalaf an Hamza parent must be HAMZA')

  // Rawi #2 for Hamza (Khallad)
  assert.equal(khallad.person_type, 'rawi', 'Khallad must be a rawi')
  assert.equal(khallad.parent_person_id, 'HAMZA', 'Khallad parent must be HAMZA')

  // Verify Locus 1 variant 1 attributes to KHALAF_ASHIR (not KHALAF_HAMZA)
  const locus1 = data.loci.find(l => l.source_marker === '1')
  const v1 = locus1.variants.find(v => v.variant_index === 1)
  const v1Persons = v1.attributions.map(a => a.person_id)
  assert.ok(v1Persons.includes('KHALAF_ASHIR'), 'Locus 1 v1 must attribute to KHALAF_ASHIR')
  assert.ok(!v1Persons.includes('KHALAF_HAMZA'), 'Locus 1 v1 must NOT attribute to KHALAF_HAMZA')

  // Verify Locus 2 variant 1 attributes to KHALAF_ASHIR (as listed in source: "خلف")
  const locus2 = data.loci.find(l => l.source_marker === '2')
  const l2v1 = locus2.variants.find(v => v.variant_index === 1)
  const l2v1Persons = l2v1.attributions.map(a => a.person_id)
  assert.ok(l2v1Persons.includes('KHALAF_ASHIR'), 'Locus 2 v1 must attribute to KHALAF_ASHIR')
  assert.ok(!l2v1Persons.includes('KHALAF_HAMZA'), 'Locus 2 v1 must NOT attribute to KHALAF_HAMZA')
})

test('Base Quran Text Invariance - Page 1 words are 100% untouched', () => {
  const pageWordsPath = path.join(
    ROOT,
    'packages',
    'quran-data',
    'mushaf1441',
    'fixtures',
    'page-words',
    'page-001.json'
  )
  assert.ok(fs.existsSync(pageWordsPath), 'mushaf1441 page-words page-001.json must exist')

  const pageWordsData = JSON.parse(fs.readFileSync(pageWordsPath, 'utf8'))
  const words = pageWordsData.lines.flatMap(l => l.words)

  // Verify exact targets exist with exact Uthmani text in the base fixture
  const targetMap = {
    'qurancom-word-3252': 'مَـٰلِكِ',
    'qurancom-word-6845': 'ٱلصِّرَٰطَ',
    'qurancom-word-8411': 'صِرَٰطَ',
    'qurancom-word-8414': 'عَلَيْهِمْ',
    'qurancom-word-8417': 'عَلَيْهِمْ',
  }

  for (const [wordId, expectedText] of Object.entries(targetMap)) {
    const word = words.find(w => w.id === wordId)
    assert.ok(word, `Word ${wordId} must exist in page 1`)
    assert.equal(word.textUthmani, expectedText, `Word ${wordId} text must match exactly`)
  }
})

// 2. API & Service Tests
test('API Endpoint - GET /api/mushaf-1441/qiraat?page=1', async () => {
  const { GET } = await import('../src/app/api/mushaf-1441/qiraat/route.ts')

  const req = new NextRequest('http://localhost:3000/api/mushaf-1441/qiraat?page=1')
  const res = await GET(req)

  assert.equal(res.status, 200)
  assert.equal(res.headers.get('content-type'), 'application/json')
  assert.ok(res.headers.get('cache-control')?.includes('public'))

  const data = await res.json()
  assert.equal(data.mushaf_page, 1)
  assert.equal(data.loci.length, 4)

  // Check word targets map
  const targetMap = data.word_targets_map
  assert.ok(targetMap['qurancom-word-3252'])
  assert.ok(targetMap['qurancom-word-6845'])
  assert.ok(targetMap['qurancom-word-8411'])
  assert.ok(targetMap['qurancom-word-8414'])
  assert.ok(targetMap['qurancom-word-8417'])

  assert.equal(targetMap['qurancom-word-3252'].source_marker, '1')
  assert.equal(targetMap['qurancom-word-6845'].source_marker, '2')
  assert.equal(targetMap['qurancom-word-8411'].source_marker, '3')
  assert.equal(targetMap['qurancom-word-8414'].source_marker, '4')
  assert.equal(targetMap['qurancom-word-8417'].source_marker, '4')
})

test('API Endpoint - Page 2 returns empty loci gracefully', async () => {
  const { GET } = await import('../src/app/api/mushaf-1441/qiraat/route.ts')

  const req = new NextRequest('http://localhost:3000/api/mushaf-1441/qiraat?page=2')
  const res = await GET(req)

  assert.equal(res.status, 200)
  const data = await res.json()
  assert.equal(data.mushaf_page, 2)
  assert.equal(data.loci.length, 0)
  assert.deepEqual(data.word_targets_map, {})
})

test('API Endpoint - Out of range page (page=999) returns 400 validation error', async () => {
  const { GET } = await import('../src/app/api/mushaf-1441/qiraat/route.ts')

  const req = new NextRequest('http://localhost:3000/api/mushaf-1441/qiraat?page=999')
  const res = await GET(req)

  assert.equal(res.status, 400)
  const data = await res.json()
  assert.ok(data.error.includes('Expected 1-604'))
})

test('API Endpoint - Source Image Stream GET /api/mushaf-1441/qiraat/source-image?page=1', async () => {
  const { GET } = await import('../src/app/api/mushaf-1441/qiraat/source-image/route.ts')

  const req = new NextRequest('http://localhost:3000/api/mushaf-1441/qiraat/source-image?page=1')
  const res = await GET(req)

  assert.equal(res.status, 200)
  assert.equal(res.headers.get('content-type'), 'image/png')

  // Page 2 should return 404 in Phase 1
  const req2 = new NextRequest('http://localhost:3000/api/mushaf-1441/qiraat/source-image?page=2')
  const res2 = await GET(req2)
  assert.equal(res2.status, 404)
})

test('Qiraat Service - Lookup Functions', async () => {
  const { getQiraatByPage, getQiraatByWordId, getQiraatByAyahWord } = await import('../src/lib/qiraat-service.ts')

  // Test getQiraatByPage(1)
  const p1 = await getQiraatByPage(1)
  assert.equal(p1.mushaf_page, 1)
  assert.equal(p1.loci.length, 4)

  // Test getQiraatByWordId
  const l1 = await getQiraatByWordId('qurancom-word-3252')
  assert.ok(l1)
  assert.equal(l1.source_marker, '1')
  assert.equal(l1.mushaf_base_word, 'مَـٰلِكِ')

  const l4_1 = await getQiraatByWordId('qurancom-word-8414')
  assert.ok(l4_1)
  assert.equal(l4_1.source_marker, '4')

  const l4_2 = await getQiraatByWordId('qurancom-word-8417')
  assert.ok(l4_2)
  assert.equal(l4_2.source_marker, '4')
  assert.equal(l4_1.id, l4_2.id, 'Both words in 1:7 must resolve to the exact same locus')

  // Test getQiraatByAyahWord
  const lAyah = await getQiraatByAyahWord(1, 4, 1)
  assert.ok(lAyah)
  assert.equal(lAyah.source_marker, '1')

  const lNone = await getQiraatByAyahWord(1, 1, 1)
  assert.equal(lNone, null, '1:1:1 has no Qiraat variation')
})

test('QIRAAT_COLORS Taxonomy and getQiraatPersonColor Resolution', async () => {
  const { QIRAAT_COLORS, getQiraatPersonColor } = await import('../src/lib/qiraat-colors.ts')

  // Verify all 10 Imams exist in QIRAAT_COLORS
  const expectedImams = [
    'nafi', 'ibnKathir', 'abuAmr', 'ibnAmir', 'asim',
    'hamzah', 'alKisai', 'abuJafar', 'yaqub', 'khalafAlAshir'
  ]
  for (const imamKey of expectedImams) {
    assert.ok(QIRAAT_COLORS[imamKey], `Imam ${imamKey} must exist in QIRAAT_COLORS`)
    assert.ok(QIRAAT_COLORS[imamKey].color, `Imam ${imamKey} must have a color`)
    assert.ok(QIRAAT_COLORS[imamKey].name, `Imam ${imamKey} must have an Arabic name`)
    assert.equal(Object.keys(QIRAAT_COLORS[imamKey].narrators).length, 2, `Imam ${imamKey} must have exactly 2 narrators`)
  }

  // Exact color assertions
  assert.equal(QIRAAT_COLORS.nafi.color, '#2563EB')
  assert.equal(QIRAAT_COLORS.nafi.narrators.qalun.color, '#60A5FA')
  assert.equal(QIRAAT_COLORS.nafi.narrators.warsh.color, '#1D4ED8')

  assert.equal(QIRAAT_COLORS.ibnKathir.color, '#16A34A')
  assert.equal(QIRAAT_COLORS.ibnKathir.narrators.alBazzi.color, '#4ADE80')
  assert.equal(QIRAAT_COLORS.ibnKathir.narrators.qunbul.color, '#15803D')

  assert.equal(QIRAAT_COLORS.abuAmr.color, '#0891B2')
  assert.equal(QIRAAT_COLORS.abuAmr.narrators.alDuri.color, '#67E8F9')
  assert.equal(QIRAAT_COLORS.abuAmr.narrators.alSusi.color, '#0E7490')

  assert.equal(QIRAAT_COLORS.ibnAmir.color, '#7C3AED')
  assert.equal(QIRAAT_COLORS.ibnAmir.narrators.hisham.color, '#A78BFA')
  assert.equal(QIRAAT_COLORS.ibnAmir.narrators.ibnDhakwan.color, '#6D28D9')

  assert.equal(QIRAAT_COLORS.asim.color, '#EA580C')
  assert.equal(QIRAAT_COLORS.asim.narrators.shubah.color, '#FB923C')
  assert.equal(QIRAAT_COLORS.asim.narrators.hafs.color, '#C2410C')

  assert.equal(QIRAAT_COLORS.hamzah.color, '#DC2626')
  assert.equal(QIRAAT_COLORS.hamzah.narrators.khalaf.color, '#F87171')
  assert.equal(QIRAAT_COLORS.hamzah.narrators.khallad.color, '#B91C1C')

  assert.equal(QIRAAT_COLORS.alKisai.color, '#DB2777')
  assert.equal(QIRAAT_COLORS.alKisai.narrators.abuAlHarith.color, '#F472B6')
  assert.equal(QIRAAT_COLORS.alKisai.narrators.alDuri.color, '#BE185D')

  assert.equal(QIRAAT_COLORS.abuJafar.color, '#CA8A04')
  assert.equal(QIRAAT_COLORS.abuJafar.narrators.ibnWardan.color, '#FACC15')
  assert.equal(QIRAAT_COLORS.abuJafar.narrators.ibnJammaz.color, '#A16207')

  assert.equal(QIRAAT_COLORS.yaqub.color, '#B45309')
  assert.equal(QIRAAT_COLORS.yaqub.narrators.ruways.color, '#F59E0B')
  assert.equal(QIRAAT_COLORS.yaqub.narrators.rawh.color, '#92400E')

  assert.equal(QIRAAT_COLORS.khalafAlAshir.color, '#475569')
  assert.equal(QIRAAT_COLORS.khalafAlAshir.narrators.ishaq.color, '#94A3B8')
  assert.equal(QIRAAT_COLORS.khalafAlAshir.narrators.idris.color, '#334155')

  // Disambiguation tests for getQiraatPersonColor
  // 1. Khalaf as rawi vs imam
  const kHamza = getQiraatPersonColor('خلف', 'rawi', 'rawi', 'HAMZA')
  assert.equal(kHamza.color, '#F87171', 'Khalaf an Hamza must have color #F87171')

  const kAshir = getQiraatPersonColor('خلف', 'imam', 'imam', null)
  assert.equal(kAshir.color, '#475569', 'Khalaf al-Ashir must have color #475569')

  // 2. Al-Duri under Abu Amr vs Al-Kisai
  const duriAbuAmr = getQiraatPersonColor('الدوري', 'rawi', 'rawi', 'ABU_AMR')
  assert.equal(duriAbuAmr.color, '#67E8F9', 'Al-Duri under Abu Amr must have color #67E8F9')

  const duriKisai = getQiraatPersonColor('الدوري', 'rawi', 'rawi', 'AL_KISAI')
  assert.equal(duriKisai.color, '#BE185D', 'Al-Duri under Al-Kisai must have color #BE185D')

  // 3. Database IDs resolution
  assert.equal(getQiraatPersonColor('NAFI').color, '#2563EB')
  assert.equal(getQiraatPersonColor('AL_BAZZI').color, '#4ADE80')
  assert.equal(getQiraatPersonColor('QUNBUL').color, '#15803D')
  assert.equal(getQiraatPersonColor('KHALLAD').color, '#B91C1C')
  assert.equal(getQiraatPersonColor('RUWAYS').color, '#F59E0B')
  assert.equal(getQiraatPersonColor('RAWH').color, '#92400E')
})
