'use strict';

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = require('ws');
}

const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const { randomUUID } = require('crypto');
const { getRoute, detectFileType, extractDateFromFilename } = require('./upload-routing');
const { requireAdmin } = require('./_auth');

function supabase() {
  const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) throw new Error('Missing Supabase env vars');
  return createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);
}

// ── SheetJS helpers ──────────────────────────────────────────────────────────
function cellVal(sheet, row, col) {
  const cell = sheet[XLSX.utils.encode_cell({ r: row - 1, c: col - 1 })];
  return cell ? cell.v : null;
}
function safeNum(v, fallback = 0) {
  if (v === null || v === undefined || v === '') return fallback;
  const n = parseFloat(String(v).replace(/[, ]/g, ''));
  return isNaN(n) ? fallback : n;
}
function pct(done, scope) {
  if (!scope) return 0;
  return Math.round((done / scope) * 1000) / 10;
}
// Parse a value like "100%", "51%", 0.51, "85" into a 0–100 number (NaN if empty/non-numeric).
function parsePct(v) {
  if (v === null || v === undefined || String(v).trim() === '') return NaN;
  const s = String(v).trim();
  if (s.includes('%')) return parseFloat(s.replace('%', ''));
  const n = parseFloat(s);
  if (isNaN(n)) return NaN;
  return n <= 1 ? n * 100 : n;   // treat fractions (0.51) as percentages
}
// Array-of-arrays view of a sheet (1-based access handled by callers via 0-based rows).
function rowsOf(wb, sheetName) {
  return XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, blankrows: false, defval: '' });
}

// ═════════════════════════════════════════════════════════════════════════════
// PROCESSOR: construction_dpr
// Reads "PIPELINE PROGRESS DPR - BAB" + "Dashboard" sheets
// ═════════════════════════════════════════════════════════════════════════════
function extractBabPipeline(wb) {
  const ws = wb.Sheets['PIPELINE PROGRESS DPR - BAB'];
  if (!ws) return null;

  const ref = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : null;
  if (!ref) return null;

  // Find the TOTAL SCOPE row
  let totalRow = null;
  for (let r = ref.s.r; r <= ref.e.r; r++) {
    if (String(cellVal(ws, r + 1, 1) || '').toUpperCase().includes('TOTAL SCOPE')) {
      totalRow = r + 1;
      break;
    }
  }
  if (!totalRow) return null;

  // Column mapping (1-based):
  // STR:  scope=14, prev=16, today=17, cum=18, pct_col=19
  // WLD:  scope=21, prev=23, today=24, cum=25, pct_col=26
  // HDPE: scope=99, prev=101,today=102,cum=103,pct_col=104
  // HYDRO:scope=106,prev=108,today=109
  const g = (col) => safeNum(cellVal(ws, totalRow, col));

  let totalLines = 0, strDone = 0, wldDone = 0, hdpeDone = 0;
  for (let r = 7; r < totalRow; r++) {
    if (safeNum(cellVal(ws, r, 12), -1) <= 0) continue;
    totalLines++;
    if (safeNum(cellVal(ws, r, 19)) >= 1) strDone++;
    if (safeNum(cellVal(ws, r, 26)) >= 1) wldDone++;
    if (safeNum(cellVal(ws, r, 104)) >= 1) hdpeDone++;
  }

  const hydroPrev  = g(108);
  const hydroToday = g(109);
  const hydroScope = g(106);
  const hydroDone  = Math.floor(hydroPrev);

  return {
    lines_total: totalLines,
    stringing:       { lines_done: strDone,  pct: pct(strDone,  totalLines), scope_m: Math.round(g(14)), done_m: Math.round(g(18) * 10) / 10, today_m: g(17) },
    welding:         { lines_done: wldDone,  pct: pct(wldDone,  totalLines), scope_m: Math.round(g(21)), done_m: Math.round(g(25) * 10) / 10, today_m: g(24) },
    hdpe_insertion:  { lines_done: hdpeDone, pct: pct(hdpeDone, totalLines), scope_m: Math.round(g(99)), done_m: Math.round(g(103) * 10) / 10, today_m: g(102) },
    final_hydrotest: {
      lines_total: Math.round(hydroScope) || totalLines,
      lines_done:  hydroDone,
      pct:         pct(hydroDone, Math.round(hydroScope) || totalLines),
      scope_m:     Math.round(hydroScope),
      done_m:      Math.round((hydroPrev + hydroToday) * 10) / 10,
      today_m:     hydroToday,
    },
  };
}

function extractDashboard(wb) {
  const ws = wb.Sheets['Dashboard'];
  if (!ws) return null;

  const g = (r, c) => safeNum(cellVal(ws, r, c));

  const babWMcScope = g(9, 2),  babWMcDone  = g(9, 3);
  const babWRfcScope= g(9, 5),  babWRfcDone = g(9, 7);
  const buhWMcScope = g(9, 13), buhWMcBal   = g(9, 15);
  const buhWMcDone  = buhWMcScope - buhWMcBal;
  const buhWRfcScope= g(9, 16), buhWRfcDone = g(9, 18);

  const babSysTotal = g(13, 1), babSysMc = g(13, 2), babSysRfc = g(13, 6);
  const buhSysTotal = g(13,12), buhSysMc = g(13,13), buhSysRfc = g(13,17);

  const totalSys = babSysTotal + buhSysTotal;

  return {
    wells: {
      mc:  { scope: babWMcScope + buhWMcScope,  done: babWMcDone + buhWMcDone,   bab_scope: babWMcScope,  bab_done: babWMcDone,  buh_scope: buhWMcScope,  buh_done: buhWMcDone  },
      rfc: { scope: babWRfcScope + buhWRfcScope, done: babWRfcDone + buhWRfcDone, bab_scope: babWRfcScope, bab_done: babWRfcDone, buh_scope: buhWRfcScope, buh_done: buhWRfcDone },
    },
    systems: {
      mc:  { scope: totalSys, done: babSysMc + buhSysMc,  bab_scope: babSysTotal, bab_done: babSysMc,  buh_scope: buhSysTotal, buh_done: buhSysMc  },
      rfc: { scope: totalSys, done: babSysRfc + buhSysRfc, bab_scope: babSysTotal, bab_done: babSysRfc, buh_scope: buhSysTotal, buh_done: buhSysRfc },
    },
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// PROCESSOR: crossing_dpr / buhasa_crossing_dpr
// Reads the top-of-sheet "ACTIVITIES SUMMARY" block. Same layout in both the
// BAB and BU HASA crossing exports (label column offset can differ), so the
// extractor locates the header row dynamically rather than hard-coding columns.
// ═════════════════════════════════════════════════════════════════════════════
const CROSSING_ACTIVITIES = ['SECTION WELDING', 'NDT', 'COATING', 'EXCAVATION', 'LOWERING'];

function extractCrossingActivities(wb) {
  for (const name of wb.SheetNames) {
    const rows = rowsOf(wb, name);

    // Locate the header row that has both "ACTIVITIES" and "TOTAL SCOPE".
    let hdr = -1, labelCol = -1, scopeCol = -1;
    for (let i = 0; i < rows.length; i++) {
      const up = rows[i].map(c => String(c).trim().toUpperCase());
      const a = up.findIndex(c => c === 'ACTIVITIES');
      const s = up.findIndex(c => c.includes('TOTAL SCOPE'));
      if (a !== -1 && s !== -1) { hdr = i; labelCol = a; scopeCol = s; break; }
    }
    if (hdr === -1) continue;

    const activities = {};
    for (let i = hdr + 1; i < rows.length && i <= hdr + 12; i++) {
      const row = rows[i];
      const label = String(row[labelCol] ?? '').trim().toUpperCase();
      if (!CROSSING_ACTIVITIES.includes(label)) continue;

      const scope = safeNum(row[scopeCol]);
      const cum   = safeNum(row[scopeCol + 3]);
      const key   = label.toLowerCase().replace(/\s+/g, '_');
      activities[key] = {
        scope,
        previous:   safeNum(row[scopeCol + 1]),
        today:      safeNum(row[scopeCol + 2]),
        cumulative: cum,
        balance:    safeNum(row[scopeCol + 4]),
        pct:        pct(cum, scope),
      };
    }

    if (Object.keys(activities).length) {
      // "Lowering" is the terminal activity — use it as the overall completion figure.
      const overall = activities.lowering || activities.section_welding;
      return {
        activities,
        crossings_total: overall ? overall.scope : 0,
        crossings_done:  overall ? overall.cumulative : 0,
        today:           overall ? overall.today : 0,
        pct:             overall ? overall.pct : 0,
        source_sheet:    name,
      };
    }
  }
  return null;
}

// ═════════════════════════════════════════════════════════════════════════════
// PROCESSOR: desharing_wells
// Two regions (BAB / BU HASA), each a per-well table. Counts total wells and
// completion. BAB uses "Pipeline Completed" % + "MC WD Status" date; BU HASA
// uses the "Date of RFC" column (value "Complete").
// ═════════════════════════════════════════════════════════════════════════════
function extractDesharingWells(wb) {
  const bab = { total: 0, pipeline_complete: 0, mc_done: 0 };
  const buhasa = { total: 0, rfc_complete: 0 };

  for (const name of wb.SheetNames) {
    const rows = rowsOf(wb, name);
    let region = null;
    let cols = {};

    for (const row of rows) {
      const cells = row.map(c => String(c ?? '').trim());
      const up = cells.map(c => c.toUpperCase());
      const joined = up.join(' ');

      // Region markers
      if (joined.includes('DESHARING')) {
        if (joined.includes('BU HASA') || joined.includes('BUHASA')) { region = 'buhasa'; continue; }
        if (joined.includes('BAB')) { region = 'bab'; continue; }
      }

      // Column-header row
      const wellIdx = up.findIndex(c => c === 'WELL NO.' || c === 'WELL NO');
      if (wellIdx !== -1) {
        cols = {
          well:     wellIdx,
          pipeline: up.findIndex(c => c.includes('PIPELINE COMPLETED')),
          mc:       up.findIndex(c => c.includes('MC WD')),
          rfcDate:  up.findIndex(c => c.includes('DATE OF RFC')),
          rfcWd:    up.findIndex(c => c.includes('RFC WD')),
        };
        continue;
      }

      if (!region || cols.well === undefined) continue;
      const well = cells[cols.well] || '';
      if (!/^B[BU]/i.test(well)) continue;   // BB-#### (BAB) or BU-### (BU HASA)

      if (region === 'bab') {
        const plPct = parsePct(cells[cols.pipeline]);
        if (isNaN(plPct)) continue;          // skip stray rows (e.g. alignment-sheet lists)
        bab.total++;
        if (plPct >= 100) bab.pipeline_complete++;
        if (cols.mc >= 0 && cells[cols.mc]) bab.mc_done++;
      } else {
        buhasa.total++;
        const rfc = String(cells[cols.rfcDate] ?? cells[cols.rfcWd] ?? '').toLowerCase();
        if (rfc.includes('complete') || (rfc.trim() && rfc !== '0')) buhasa.rfc_complete++;
      }
    }
  }

  if (!bab.total && !buhasa.total) return null;
  return {
    bab: {
      ...bab,
      pipeline_pct: pct(bab.pipeline_complete, bab.total),
      mc_pct:       pct(bab.mc_done, bab.total),
    },
    buhasa: {
      ...buhasa,
      rfc_pct: pct(buhasa.rfc_complete, buhasa.total),
    },
    total_wells: bab.total + buhasa.total,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// STUB PROCESSORS — extraction logic pending for these types.
// Each returns { status: 'pending_implementation', dashboardSections }
// so the snapshot record is created and the upload is not blocked.
// ═════════════════════════════════════════════════════════════════════════════
function stubProcessor(route, wb) {
  return {
    status: 'pending_implementation',
    file_type: route.id,
    dashboardSections: route.dashboardSections,
    availableSheets: wb.SheetNames,
    note: 'Extraction logic not yet implemented for this file type. File is stored in Supabase and can be re-processed once implemented.',
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// ROUTING TABLE — maps file_type id → processor function
// ═════════════════════════════════════════════════════════════════════════════
function runProcessor(route, wb) {
  switch (route.id) {
    case 'construction_dpr':
      return { bab_pipeline: extractBabPipeline(wb), summary: extractDashboard(wb) };

    case 'crossing_dpr':
      return { area: 'bab', crossings: extractCrossingActivities(wb) };

    case 'buhasa_crossing_dpr':
      return { area: 'buhasa', crossings: extractCrossingActivities(wb) };

    case 'desharing_wells':
      return { wells: extractDesharingWells(wb) };

    // Pending types get a stub that stores sheet names for future reference
    case 'hdpe_dpr':
    case 'civil_master_dpr':
    case 'bab_wd_status':
    case 'buhasa_wd_status':
    case 'buhasa_civil_dpr':
      return stubProcessor(route, wb);

    default:
      return { status: 'unknown_file_type', file_type: route.id };
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAdmin(req, res)) return;

  let body = '';
  await new Promise((resolve) => { req.on('data', c => (body += c)); req.on('end', resolve); });
  let batchId;
  try { batchId = JSON.parse(body).batchId; }
  catch { return res.status(400).json({ error: 'Invalid JSON body' }); }
  if (!batchId) return res.status(400).json({ error: 'batchId required' });

  const sb = supabase();

  // Look up file record
  const { data: fileRow, error: fileErr } = await sb
    .from('dpr_uploaded_files')
    .select('storage_path, original_filename, file_type')
    .eq('batch_id', batchId)
    .single();
  if (fileErr || !fileRow)
    return res.status(404).json({ error: 'Batch file not found', detail: fileErr?.message });

  const { storage_path, original_filename, file_type } = fileRow;

  // Resolve route — use stored file_type first, fall back to filename detection
  const route = getRoute(file_type) || detectFileType(original_filename);
  if (!route)
    return res.status(422).json({ error: `Cannot determine file type for "${original_filename}"` });

  // Download Excel from storage
  const { data: fileData, error: dlErr } = await sb.storage.from('dpr-uploads').download(storage_path);
  if (dlErr || !fileData)
    return res.status(500).json({ error: 'Failed to download file', detail: dlErr?.message });

  // Parse Excel
  let wb;
  try {
    wb = XLSX.read(Buffer.from(await fileData.arrayBuffer()), { type: 'buffer' });
  } catch (e) {
    return res.status(422).json({ error: 'Failed to parse Excel file', detail: e.message });
  }

  // Derive report_date from filename
  const reportDate = extractDateFromFilename(original_filename, route)
    || new Date().toISOString().slice(0, 10);

  // Run the appropriate processor
  const extracted = runProcessor(route, wb);
  const metrics = { report_date: reportDate, file_type: route.id, ...extracted };

  // Re-uploads supersede: deactivate any prior active snapshot for the same
  // file type + report date so the dashboard always reads the latest.
  await sb.from('dashboard_snapshots')
    .update({ is_active: false })
    .eq('report_date', reportDate)
    .eq('snapshot_json->>file_type', route.id)
    .eq('is_active', true);

  // Save snapshot
  const snapshotId = randomUUID();
  const { error: snapErr } = await sb.from('dashboard_snapshots').insert({
    id: snapshotId,
    batch_id: batchId,
    report_date: reportDate,
    snapshot_json: metrics,
    is_active: true,
  });
  if (snapErr)
    return res.status(500).json({ error: 'Failed to save snapshot', detail: snapErr.message, metrics });

  return res.status(200).json({
    success: true,
    snapshotId,
    file_type: route.id,
    implemented: route.implemented,
    metrics,
  });
};

// Exported for unit testing without a Supabase connection.
// (Attached after the handler assignment so it isn't overwritten.)
module.exports.__extractors = {
  extractBabPipeline,
  extractDashboard,
  extractCrossingActivities,
  extractDesharingWells,
  runProcessor,
};
