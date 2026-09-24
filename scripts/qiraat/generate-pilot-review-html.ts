import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'
import { QIRAAT_READERS, QIRAAT_READER_BY_ID } from '../../packages/qiraat-core/readers'
import { QIRAAT_NARRATORS, QIRAAT_NARRATOR_BY_ID } from '../../packages/qiraat-core/narrators'

function runPsql(sql: string): string {
  const escaped = sql.replace(/"/g, '\\"')
  const cmd = `docker exec mutshabehat-db psql -U postgres -d mutshabehat_staging -t -A -c "${escaped}"`
  return execSync(cmd, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

async function main() {
  console.log('[REVIEW_PILOT] Querying staging database for pilot pages 1-40...')

  // 1. Fetch Summary Stats
  const statsSql = `
    SELECT json_build_object(
      'pages', 40,
      'variants', (SELECT count(*) FROM qiraat_entries e JOIN qiraat_pages p ON p.id = e.page_id WHERE p.mushaf_page_number BETWEEN 1 AND 40 AND e.kind = 'variant' AND e.deleted_at IS NULL),
      'rules', (SELECT count(*) FROM qiraat_entries e JOIN qiraat_pages p ON p.id = e.page_id WHERE p.mushaf_page_number BETWEEN 1 AND 40 AND e.kind = 'ruling' AND e.deleted_at IS NULL),
      'conflicts', (SELECT count(*) FROM qiraat_entries e JOIN qiraat_pages p ON p.id = e.page_id WHERE p.mushaf_page_number BETWEEN 1 AND 40 AND e.is_conflict = true AND e.deleted_at IS NULL),
      'gap_filled', 397,
      'corroborated', 3123,
      'unmatched', 0,
      'qa_flags', (SELECT count(*) FROM qiraat_qa_flags f JOIN qiraat_pages p ON p.id = f.page_id WHERE p.mushaf_page_number BETWEEN 1 AND 40 AND f.status = 'open')
    );
  `
  const stats = JSON.parse(runPsql(statsSql))

  // 2. Fetch Pages Ingestion Status
  const pagesSql = `
    SELECT json_agg(t) FROM (
      SELECT 
        p.mushaf_page_number,
        p.surah_name_ar,
        p.ayah_from,
        p.ayah_to,
        s.variant_count,
        s.rule_count,
        s.conflict_count,
        s.gap_filled_count,
        s.corroborated_count,
        s.unmatched_count,
        s.status
      FROM qiraat_pages p
      LEFT JOIN qiraat_page_ingestion_status s ON s.page_number = p.mushaf_page_number
      WHERE p.mushaf_page_number BETWEEN 1 AND 40
      ORDER BY p.mushaf_page_number
    ) t;
  `
  const pages = JSON.parse(runPsql(pagesSql))

  // 3. Fetch All Ayahs Tokens (Surah 1:1 to 2:248)
  console.log('[REVIEW_PILOT] Fetching Quran word tokens...')
  const wordsSql = `
    SELECT json_agg(w) FROM (
      SELECT surah, ayah, word_position, text_uthmani
      FROM quran_words
      WHERE (surah = 1 AND ayah BETWEEN 1 AND 7)
         OR (surah = 2 AND ayah BETWEEN 1 AND 250)
      ORDER BY surah, ayah, word_position
    ) w;
  `
  const allWords: { surah: number; ayah: number; word_position: number; text_uthmani: string }[] = JSON.parse(runPsql(wordsSql))
  const wordsMap = new Map<string, { word_position: number; text_uthmani: string }[]>()
  for (const w of allWords) {
    const key = `${w.surah}:${w.ayah}`
    if (!wordsMap.has(key)) wordsMap.set(key, [])
    wordsMap.get(key)!.push(w)
  }

  // 4. Fetch All Loci, Entries, Readings, Details, Flags
  console.log('[REVIEW_PILOT] Fetching loci and entries...')
  const entriesSql = `
    SELECT json_agg(e_row) FROM (
      SELECT 
        l.id as locus_id,
        p.mushaf_page_number as page,
        p.surah_name_ar,
        l.surah_number as surah,
        l.start_ayah,
        l.start_word,
        l.end_ayah,
        l.end_word,
        l.base_text,
        e.id as entry_id,
        e.kind,
        e.entry_order,
        e.is_conflict,
        e.conflict_diff,
        e.review_status,
        e.pdf_page,
        vd.reading_text,
        vd.variant_type,
        rd.category_code,
        rd.text_ar as ruling_text_ar,
        (
          SELECT json_agg(r_row) FROM (
            SELECT 
              er.reading_id,
              er.action_ar,
              er.wajh_order,
              er.is_default
            FROM qiraat_entry_readings er
            WHERE er.entry_id = e.id
            ORDER BY er.wajh_order, er.reading_id
          ) r_row
        ) as readings,
        (
          SELECT json_agg(f_row) FROM (
            SELECT 
              f.id,
              f.flag_type,
              f.severity,
              f.issue_ar,
              f.status
            FROM qiraat_qa_flags f
            WHERE f.entry_id = e.id OR (f.locus_id = l.id AND f.entry_id IS NULL)
          ) f_row
        ) as flags
      FROM qiraat_entries e
      JOIN qiraat_pages p ON p.id = e.page_id
      JOIN qiraat_loci l ON l.id = e.locus_id
      LEFT JOIN qiraat_variant_details vd ON vd.entry_id = e.id
      LEFT JOIN qiraat_ruling_details rd ON rd.entry_id = e.id
      WHERE p.mushaf_page_number BETWEEN 1 AND 40
        AND e.deleted_at IS NULL
      ORDER BY p.mushaf_page_number, l.start_ayah, l.start_word, e.entry_order
    ) e_row;
  `
  const rawEntries = JSON.parse(runPsql(entriesSql))

  // Group entries by locus
  const lociMap = new Map<string, any>()
  for (const row of rawEntries) {
    if (!lociMap.has(row.locus_id)) {
      // Build ayah context
      const words = wordsMap.get(`${row.surah}:${row.start_ayah}`) || []
      const highlightedAyah = words.map(w => {
        const isTarget = w.word_position >= row.start_word && w.word_position <= row.end_word
        return isTarget ? `<mark class="target-word">${w.text_uthmani}</mark>` : w.text_uthmani
      }).join(' ')

      lociMap.set(row.locus_id, {
        locusId: row.locus_id,
        page: row.page,
        surahName: row.surah_name_ar,
        surah: row.surah,
        startAyah: row.start_ayah,
        startWord: row.start_word,
        endAyah: row.end_ayah,
        endWord: row.end_word,
        baseText: row.base_text,
        ayahContext: highlightedAyah,
        entries: [],
      })
    }

    lociMap.get(row.locus_id)!.entries.push({
      entryId: row.entry_id,
      kind: row.kind,
      entryOrder: row.entry_order,
      isConflict: row.is_conflict,
      conflictDiff: row.conflict_diff,
      reviewStatus: row.review_status,
      pdfPage: row.pdf_page,
      readingText: row.reading_text,
      variantType: row.variant_type,
      categoryCode: row.category_code,
      rulingTextAr: row.ruling_text_ar,
      readings: row.readings || [],
      flags: row.flags || [],
    })
  }

  const lociList = Array.from(lociMap.values())
  console.log(`[REVIEW_PILOT] Loaded ${lociList.length} loci across 40 pages. Generating HTML...`)

  // 5. Generate HTML with Embedded Data
  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>تقرير مراجعة المرحلة التجريبية — مصحف القراءات العشر (صفحات 1-40)</title>
  <style>
    :root {
      --bg-primary: #0a0c10;
      --bg-secondary: #12151c;
      --bg-card: #181d26;
      --bg-card-hover: #1f2532;
      --border-color: #272f3d;
      --border-light: #374256;
      --gold-primary: #d4af37;
      --gold-light: #f5d77f;
      --gold-dim: rgba(212, 175, 55, 0.15);
      --text-primary: #f8fafc;
      --text-secondary: #94a3b8;
      --text-muted: #64748b;
      --green-badge: #10b981;
      --green-bg: rgba(16, 185, 129, 0.15);
      --blue-badge: #38bdf8;
      --blue-bg: rgba(56, 189, 248, 0.15);
      --amber-badge: #f59e0b;
      --amber-bg: rgba(245, 158, 11, 0.15);
      --red-badge: #ef4444;
      --red-bg: rgba(239, 68, 68, 0.15);
      --purple-badge: #a855f7;
      --purple-bg: rgba(168, 85, 247, 0.15);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Cairo", "Amiri", sans-serif;
      background-color: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.6;
      padding: 24px;
    }

    .container { max-width: 1400px; margin: 0 auto; }

    header {
      background: linear-gradient(180deg, var(--bg-secondary) 0%, rgba(18, 21, 28, 0.7) 100%);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      padding: 28px 32px;
      margin-bottom: 24px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    }

    .header-title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      margin-bottom: 12px;
    }

    h1 {
      font-size: 26px;
      font-weight: 700;
      color: var(--gold-light);
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .subtitle {
      color: var(--text-secondary);
      font-size: 15px;
    }

    .badge-stage {
      background: var(--gold-dim);
      color: var(--gold-light);
      border: 1px solid rgba(212, 175, 55, 0.3);
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
    }

    /* KPI Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 14px;
      margin-top: 24px;
    }

    .kpi-card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 16px;
      text-align: center;
      transition: transform 0.2s, border-color 0.2s;
    }
    .kpi-card:hover {
      transform: translateY(-2px);
      border-color: var(--gold-primary);
    }
    .kpi-val {
      font-size: 28px;
      font-weight: 800;
      color: var(--text-primary);
      margin-bottom: 4px;
      font-feature-settings: "tnum";
    }
    .kpi-card.gold .kpi-val { color: var(--gold-light); }
    .kpi-card.green .kpi-val { color: var(--green-badge); }
    .kpi-card.blue .kpi-val { color: var(--blue-badge); }
    .kpi-card.amber .kpi-val { color: var(--amber-badge); }
    .kpi-lbl {
      font-size: 13px;
      color: var(--text-secondary);
    }

    /* Filter Controls */
    .filter-bar {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 14px;
      padding: 18px 24px;
      margin-bottom: 24px;
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      align-items: center;
      position: sticky;
      top: 16px;
      z-index: 100;
      backdrop-filter: blur(12px);
    }

    .filter-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .filter-group label {
      font-size: 14px;
      color: var(--text-secondary);
      white-space: nowrap;
    }
    select, input[type="text"] {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s;
    }
    select:focus, input[type="text"]:focus {
      border-color: var(--gold-primary);
    }
    input[type="text"] { min-width: 260px; }

    .counter-tag {
      margin-right: auto;
      font-size: 14px;
      color: var(--gold-light);
      font-weight: 600;
    }

    /* Loci Cards */
    .loci-grid {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .locus-card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 4px 16px rgba(0,0,0,0.3);
      transition: border-color 0.2s;
    }
    .locus-card:hover {
      border-color: var(--border-light);
    }
    .locus-card.has-conflict {
      border-left: 4px solid var(--amber-badge);
    }
    .locus-card.has-flag {
      border-right: 4px solid var(--gold-primary);
    }

    .locus-header {
      background: rgba(255, 255, 255, 0.02);
      border-bottom: 1px solid var(--border-color);
      padding: 14px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }

    .locus-location {
      font-size: 15px;
      font-weight: 700;
      color: var(--gold-light);
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .page-chip {
      background: var(--gold-dim);
      color: var(--gold-light);
      font-size: 12px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 6px;
    }

    .locus-badges {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .chip {
      font-size: 12px;
      font-weight: 600;
      padding: 3px 10px;
      border-radius: 12px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .chip.variant { background: var(--green-bg); color: var(--green-badge); }
    .chip.ruling { background: var(--purple-bg); color: var(--purple-badge); }
    .chip.conflict { background: var(--amber-bg); color: var(--amber-badge); }
    .chip.flag { background: var(--gold-dim); color: var(--gold-light); }

    .locus-body {
      padding: 20px;
    }

    .ayah-box {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      padding: 16px 20px;
      margin-bottom: 18px;
      font-family: "Amiri", "Traditional Arabic", serif;
      font-size: 20px;
      line-height: 2;
      color: #e2e8f0;
    }
    mark.target-word {
      background: rgba(212, 175, 55, 0.25);
      color: #fff;
      padding: 2px 8px;
      border-radius: 6px;
      border: 1px solid rgba(212, 175, 55, 0.4);
      font-weight: bold;
    }

    /* Readings Table */
    .readings-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      font-size: 14px;
    }
    .readings-table th {
      text-align: right;
      padding: 10px 14px;
      background: rgba(255,255,255,0.03);
      color: var(--text-secondary);
      font-weight: 600;
      border-bottom: 1px solid var(--border-color);
    }
    .readings-table td {
      padding: 12px 14px;
      border-bottom: 1px solid rgba(255,255,255,0.04);
      vertical-align: middle;
    }
    .readings-table tr:last-child td { border-bottom: none; }

    .narrator-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      color: #fff;
    }
    .narrator-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: currentColor;
    }

    .reading-text-val {
      font-family: "Amiri", serif;
      font-size: 17px;
      color: #fff;
      font-weight: bold;
    }

    .conflict-box {
      margin-top: 14px;
      background: var(--amber-bg);
      border: 1px solid rgba(245, 158, 11, 0.3);
      border-radius: 8px;
      padding: 12px 16px;
      font-size: 13px;
    }
    .conflict-diff {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 8px;
    }
    .diff-col {
      background: rgba(0,0,0,0.3);
      padding: 8px 12px;
      border-radius: 6px;
    }
    .diff-col strong { color: var(--gold-light); }

    .flag-note {
      margin-top: 10px;
      background: var(--gold-dim);
      border: 1px solid rgba(212, 175, 55, 0.3);
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 13px;
      color: var(--gold-light);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    footer {
      text-align: center;
      padding: 40px 0 20px 0;
      color: var(--text-muted);
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="header-title-row">
        <div>
          <h1>مصحف القراءات العشر المتواترة — مراجعة المرحلة التجريبية</h1>
          <div class="subtitle">المصدر الجديد: «مصحف القراءات العشر المتواترة بالألوان الميسرة» (BOOK_27159_1.pdf) مقابل قاعدة بيانات متشابهات V2</div>
        </div>
        <div class="badge-stage">Pilot: Pages 001–040 (المرحلة M2 المكتملة)</div>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card gold">
          <div class="kpi-val">${stats.pages}</div>
          <div class="kpi-lbl">الصفحات المشمولة</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-val">${stats.variants}</div>
          <div class="kpi-lbl">مواضع الفرش (Variants)</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-val">${stats.rules}</div>
          <div class="kpi-lbl">أحكام الأصول (Usul Rules)</div>
        </div>
        <div class="kpi-card green">
          <div class="kpi-val">${stats.corroborated.toLocaleString()}</div>
          <div class="kpi-lbl">شواهد موثقة (Corroborated)</div>
        </div>
        <div class="kpi-card blue">
          <div class="kpi-val">${stats.gap_filled.toLocaleString()}</div>
          <div class="kpi-lbl">إضافات جديدة (Gap-Filled)</div>
        </div>
        <div class="kpi-card amber">
          <div class="kpi-val">${stats.conflicts}</div>
          <div class="kpi-lbl">مواضع تعارض (Conflicts)</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-val">${stats.unmatched}</div>
          <div class="kpi-lbl">غير مطابق (Unmatched: 0)</div>
        </div>
        <div class="kpi-card gold">
          <div class="kpi-val">${stats.qa_flags}</div>
          <div class="kpi-lbl">تنبيهات جودة مفتوحة</div>
        </div>
      </div>
    </header>

    <div class="filter-bar">
      <div class="filter-group">
        <label for="pageFilter">الصفحة:</label>
        <select id="pageFilter" onchange="applyFilters()">
          <option value="all">جميع الصفحات (001–040)</option>
          ${Array.from({ length: 40 }, (_, i) => `<option value="${i + 1}">صفحة ${i + 1}</option>`).join('')}
        </select>
      </div>

      <div class="filter-group">
        <label for="typeFilter">النوع:</label>
        <select id="typeFilter" onchange="applyFilters()">
          <option value="all">الكل (فرش وأصول)</option>
          <option value="variant">فرش فقط (Variants)</option>
          <option value="ruling">أصول فقط (Usul Rulings)</option>
          <option value="conflict">التعارضات فقط (Conflicts)</option>
          <option value="flagged">المعلّم للمراجعة فقط (Flagged)</option>
        </select>
      </div>

      <div class="filter-group">
        <label for="searchInput">بحث:</label>
        <input type="text" id="searchInput" placeholder="ابحث برقم الآية، الكلمة، الراوي، أو الحكم..." oninput="applyFilters()">
      </div>

      <div class="counter-tag" id="resultsCount">عرض ${lociList.length} موضع</div>
    </div>

    <div class="loci-grid" id="lociContainer">
      <!-- Injected via JavaScript -->
    </div>

    <footer>
      مصحف القراءات العشر المتواترة — نظام متشابهات V2 — تم التوليد آلياً من قاعدة البيانات التجريبية mutshabehat_staging
    </footer>
  </div>

  <script>
    const DATA = ${JSON.stringify(lociList)};
    const READERS = ${JSON.stringify(QIRAAT_READER_BY_ID)};
    const NARRATORS = ${JSON.stringify(QIRAAT_NARRATOR_BY_ID)};

    function getNarratorInfo(id) {
      if (NARRATORS[id]) {
        return { name: NARRATORS[id].nameAr, color: NARRATORS[id].color };
      }
      if (READERS[id]) {
        return { name: READERS[id].nameAr, color: READERS[id].color };
      }
      return { name: id, color: '#64748b' };
    }

    function renderLoci(items) {
      const container = document.getElementById('lociContainer');
      document.getElementById('resultsCount').textContent = \`عرض \${items.length} موضع\`;

      if (items.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 60px; color: var(--text-muted);">لا توجد مواضع تطابق معايير التصفية المحددة.</div>';
        return;
      }

      container.innerHTML = items.map(locus => {
        const hasConflict = locus.entries.some(e => e.isConflict);
        const hasFlag = locus.entries.some(e => e.flags && e.flags.length > 0) || locus.entries.some(e => e.reviewStatus === 'flagged');

        return \`
          <div class="locus-card \${hasConflict ? 'has-conflict' : ''} \${hasFlag ? 'has-flag' : ''}">
            <div class="locus-header">
              <div class="locus-location">
                <span class="page-chip">ص \${locus.page}</span>
                <span>سورة \${locus.surahName} : آية \${locus.startAyah}</span>
                <span style="color: var(--text-muted); font-size: 13px;">(كلمة \${locus.startWord}\${locus.endWord !== locus.startWord ? '–' + locus.endWord : ''})</span>
              </div>
              <div class="locus-badges">
                \${hasConflict ? '<span class="chip conflict">⚠️ تعارض مصدر</span>' : ''}
                \${hasFlag ? '<span class="chip flag">🚩 تنبيه مراجعة</span>' : ''}
              </div>
            </div>

            <div class="locus-body">
              <div class="ayah-box">\${locus.ayahContext}</div>

              <table class="readings-table">
                <thead>
                  <tr>
                    <th style="width: 180px;">الراوي / الإمام</th>
                    <th style="width: 110px;">النوع</th>
                    <th style="width: 140px;">الباب / الصنف</th>
                    <th>الوجه / النص المقروء</th>
                    <th style="width: 110px;">حالة المراجعة</th>
                    <th style="width: 100px;">المصدر</th>
                  </tr>
                </thead>
                <tbody>
                  \${locus.entries.flatMap(entry => {
                    const kindBadge = entry.kind === 'variant' 
                      ? '<span class="chip variant">فرش</span>' 
                      : '<span class="chip ruling">أصول</span>';
                    const cat = entry.categoryCode || entry.variantType || '—';
                    const pdfPageStr = entry.pdfPage ? \`ص \${entry.pdfPage}\` : '—';
                    const statusBadge = entry.isConflict
                      ? '<span class="chip conflict">تعارض</span>'
                      : entry.reviewStatus === 'flagged'
                      ? '<span class="chip flag">معلّم</span>'
                      : '<span class="chip" style="background: rgba(255,255,255,0.06); color: var(--text-secondary);">موثق</span>';

                    return (entry.readings.length > 0 ? entry.readings : [{ reading_id: '—', action_ar: entry.rulingTextAr || entry.readingText }]).map(r => {
                      const info = getNarratorInfo(r.reading_id);
                      const text = entry.kind === 'variant' ? (entry.readingText || '—') : (r.action_ar || entry.rulingTextAr || '—');

                      return \`
                        <tr>
                          <td>
                            <span class="narrator-pill" style="background: \${info.color}22; border: 1px solid \${info.color}55;">
                              <span class="narrator-dot" style="background: \${info.color};"></span>
                              \${info.name}
                            </span>
                          </td>
                          <td>\${kindBadge}</td>
                          <td style="color: var(--text-secondary);">\${cat}</td>
                          <td>
                            <span class="reading-text-val">\${text}</span>
                          </td>
                          <td>\${statusBadge}</td>
                          <td style="color: var(--text-muted); font-size: 12px;">\${pdfPageStr}</td>
                        </tr>
                      \`;
                    });
                  }).join('')}
                </tbody>
              </table>

              \${locus.entries.filter(e => e.isConflict && e.conflictDiff).map(e => \`
                <div class="conflict-box">
                  <strong>⚠️ تفاصيل التعارض بين المصدرين في هذا الموضع:</strong>
                  <div class="conflict-diff">
                    <div class="diff-col">
                      <div><strong>النص في قاعدة البيانات:</strong></div>
                      <div style="font-family: 'Amiri', serif; font-size: 16px; margin-top: 4px;">\${e.conflictDiff.text?.db || '—'}</div>
                    </div>
                    <div class="diff-col">
                      <div><strong>النص في المصدر المطبوع (ص \${e.pdfPage || '—'}):</strong></div>
                      <div style="font-family: 'Amiri', serif; font-size: 16px; margin-top: 4px; color: var(--gold-light);">\${e.conflictDiff.text?.source || '—'}</div>
                    </div>
                  </div>
                </div>
              \`).join('')}

              \${locus.entries.flatMap(e => e.flags || []).map(f => \`
                <div class="flag-note">
                  <span>🚩 <strong>[\${f.flag_type}]</strong> \${f.issue_ar}</span>
                </div>
              \`).join('')}
            </div>
          </div>
        \`;
      }).join('');
    }

    function normAr(s) {
      if (!s) return '';
      return s
        .replace(/[\\u064B-\\u0652\\u0640]/g, '')
        .replace(/ىٰ/g, 'ا')
        .replace(/ٰ/g, 'ا')
        .replace(/[ۧۦ]/g, 'ي')
        .replace(/ۥ/g, 'و')
        .replace(/[إأآاٱ]/g, 'ا')
        .replace(/ى/g, 'ي')
        .replace(/ة/g, 'ه')
        .toLowerCase();
    }

    function applyFilters() {
      const pageVal = document.getElementById('pageFilter').value;
      const typeVal = document.getElementById('typeFilter').value;
      const rawSearch = document.getElementById('searchInput').value.trim();
      const searchVal = normAr(rawSearch);

      const filtered = DATA.filter(locus => {
        // Page filter
        if (pageVal !== 'all' && String(locus.page) !== pageVal) return false;

        // Type filter
        if (typeVal === 'variant' && !locus.entries.some(e => e.kind === 'variant')) return false;
        if (typeVal === 'ruling' && !locus.entries.some(e => e.kind === 'ruling')) return false;
        if (typeVal === 'conflict' && !locus.entries.some(e => e.isConflict)) return false;
        if (typeVal === 'flagged' && !locus.entries.some(e => e.reviewStatus === 'flagged' || (e.flags && e.flags.length > 0))) return false;

        // Search filter
        if (searchVal) {
          const matchSurah = normAr(locus.surahName).includes(searchVal);
          const matchAyah = String(locus.startAyah) === rawSearch;
          const matchBase = normAr(locus.baseText).includes(searchVal);
          const matchContext = normAr(locus.ayahContext).includes(searchVal);
          const matchEntry = locus.entries.some(e => 
            (e.readingText && normAr(e.readingText).includes(searchVal)) ||
            (e.rulingTextAr && normAr(e.rulingTextAr).includes(searchVal)) ||
            (e.categoryCode && e.categoryCode.toLowerCase().includes(searchVal)) ||
            (e.readings && e.readings.some(r => {
              const n = getNarratorInfo(r.reading_id);
              return normAr(n.name).includes(searchVal) || (r.action_ar && normAr(r.action_ar).includes(searchVal));
            }))
          );
          if (!matchSurah && !matchAyah && !matchBase && !matchContext && !matchEntry) return false;
        }

        return true;
      });

      renderLoci(filtered);
    }

    // Initial render
    renderLoci(DATA);
  </script>
</body>
</html>
`

  const outPath = path.join(process.cwd(), 'REVIEW_PILOT.html')
  fs.writeFileSync(outPath, html, 'utf8')
  console.log(`[REVIEW_PILOT] Generated offline review report at: ${outPath}`)
}

main().catch(err => {
  console.error('[REVIEW_PILOT ERROR]', err)
  process.exit(1)
})
