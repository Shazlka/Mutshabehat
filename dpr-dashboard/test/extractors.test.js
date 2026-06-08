'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('xlsx');

const {
  detectFileType,
  extractDateFromFilename,
  getRoute,
  listRoutes,
} = require('../api/upload-routing');
const { __extractors } = require('../api/process-dpr');

const { extractCrossingActivities, extractDesharingWells } = __extractors;

// Build a one-sheet workbook from an array-of-arrays.
function wbFrom(sheets) {
  const wb = XLSX.utils.book_new();
  for (const [name, aoa] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name);
  }
  return wb;
}

// ── Routing: filename → file type ────────────────────────────────────────────
test('detectFileType maps the real filenames to the right routes', () => {
  const cases = [
    ['CONSTRUCTION DAILY PROGRESS REPORT-WAVE PROJECT C3B BAB BU HASA 04-06-26.xlsx', 'construction_dpr'],
    ['OVERALL CROSSING IN BAB - WAVE PROJECT C3B -04-June 2026.xlsx', 'crossing_dpr'],
    ['OVERALL CROSSING IN BU HASA - WAVE PROJECT C3B-  03 Jun 2026.xlsx', 'buhasa_crossing_dpr'],
    ['Copy of Wave Main Works BAB(CWP-02)-Progress report-04-06-2026 (002).xlsx', 'hdpe_dpr'],
    ['DPR- 01.06.2026 Master1.xlsx', 'civil_master_dpr'],
    ['DESHARING WELLS OF BAB  BU HASA - WAVE PROJECT C3B.xlsx', 'desharing_wells'],
    ['BAB WD Status with Punches  04-06-2026.xlsx', 'bab_wd_status'],
    ['BUHASA WD Status with punches 04-06-2026.xlsx', 'buhasa_wd_status'],
    ['BUHASA_CIVIL_DPR_02_06_2026.xlsx', 'buhasa_civil_dpr'],
  ];
  for (const [name, expected] of cases) {
    const route = detectFileType(name);
    assert.ok(route, `no route for ${name}`);
    assert.equal(route.id, expected, `${name} → ${route.id} (expected ${expected})`);
  }
});

test('BU HASA crossing is not misclassified as the BAB crossing', () => {
  const r = detectFileType('OVERALL CROSSING IN BU HASA - WAVE PROJECT C3B-  03 Jun 2026.xlsx');
  assert.equal(r.id, 'buhasa_crossing_dpr');
});

test('HDPE "Progress report" filename (no literal DPR token) is detected', () => {
  const r = detectFileType('Copy of Wave Main Works BAB(CWP-02)-Progress report-04-06-2026 (002).xlsx');
  assert.equal(r.id, 'hdpe_dpr');
});

// ── Routing: filename → report date ──────────────────────────────────────────
test('extractDateFromFilename parses every date format', () => {
  const d = (name) => extractDateFromFilename(name, detectFileType(name));
  assert.equal(d('CONSTRUCTION DAILY PROGRESS REPORT-WAVE PROJECT C3B BAB BU HASA 04-06-26.xlsx'), '2026-06-04');
  assert.equal(d('OVERALL CROSSING IN BAB - WAVE PROJECT C3B -04-June 2026.xlsx'), '2026-06-04');
  assert.equal(d('OVERALL CROSSING IN BU HASA - WAVE PROJECT C3B-  03 Jun 2026.xlsx'), '2026-06-03');
  assert.equal(d('Copy of Wave Main Works BAB(CWP-02)-Progress report-04-06-2026 (002).xlsx'), '2026-06-04');
  assert.equal(d('DPR- 01.06.2026 Master1.xlsx'), '2026-06-01');
  assert.equal(d('BUHASA_CIVIL_DPR_02_06_2026.xlsx'), '2026-06-02');
  // Desharing wells has no date in the filename
  assert.equal(d('DESHARING WELLS OF BAB  BU HASA - WAVE PROJECT C3B.xlsx'), null);
});

test('listRoutes mirrors implemented flags', () => {
  const byId = Object.fromEntries(listRoutes().map(r => [r.id, r]));
  assert.equal(byId.construction_dpr.implemented, true);
  assert.equal(byId.crossing_dpr.implemented, true);
  assert.equal(byId.buhasa_crossing_dpr.implemented, true);
  assert.equal(byId.desharing_wells.implemented, true);
  assert.equal(byId.hdpe_dpr.implemented, false);
});

test('getRoute resolves the legacy alias', () => {
  assert.equal(getRoute('construction_daily_progress_report').id, 'construction_dpr');
});

// ── Crossing extractor (BAB layout: label in column A) ───────────────────────
test('extractCrossingActivities reads the BAB activities summary', () => {
  const wb = wbFrom({
    'BAB Crossings': [
      ['ACTIVITIES SUMMARY CROSSINGS DAILY PROGRESS REPORT IN BAB - WAVE PROJECT C3B', '', '', '', '', '', '04 Jun 26'],
      ['ACTIVITIES', 'TOTAL SCOPE', 'PREVIOUS', 'TODAY', 'CUMM.', 'BALANCE', 'REMARKS'],
      ['SECTION WELDING', 1133, 974, 2, 976, 157, ''],
      ['NDT', 1133, 932, 3, 935, 198, ''],
      ['COATING', 1133, 923, 3, 926, 207, ''],
      ['EXCAVATION', 1133, 922, 3, 925, 208, ''],
      ['LOWERING', 1133, 922, 3, 925, 208, ''],
    ],
  });
  const out = extractCrossingActivities(wb);
  assert.ok(out);
  assert.equal(Object.keys(out.activities).length, 5);
  assert.deepEqual(out.activities.section_welding, {
    scope: 1133, previous: 974, today: 2, cumulative: 976, balance: 157, pct: 86.1,
  });
  // Overall = lowering
  assert.equal(out.crossings_total, 1133);
  assert.equal(out.crossings_done, 925);
  assert.equal(out.today, 3);
  assert.equal(out.pct, 81.6);
});

// ── Crossing extractor (BU HASA layout: leading blank column) ─────────────────
test('extractCrossingActivities handles the BU HASA column offset + blank "today"', () => {
  const wb = wbFrom({
    'BUHASA': [
      ['DPR SUMMARY', 'WAVE C3B-BUHASA CROSSINGS DAILY PROGRESS REPORT', '', '', '', '', '', '03 Jun 26'],
      ['', 'ACTIVITIES', 'TOTAL SCOPE', 'PREVIOUS', 'TODAY', 'CUMM.', 'BALANCE', 'REMARKS'],
      ['', 'SECTION WELDING', 781, 781, '', 781, 0, ''],
      ['', 'NDT', 781, 781, '', 781, 0, ''],
      ['', 'COATING', 781, 781, '', 781, 0, ''],
      ['', 'EXCAVATION', 781, 781, '', 781, 0, ''],
      ['', 'LOWERING', 781, 781, '', 781, 0, ''],
    ],
  });
  const out = extractCrossingActivities(wb);
  assert.ok(out);
  assert.deepEqual(out.activities.lowering, {
    scope: 781, previous: 781, today: 0, cumulative: 781, balance: 0, pct: 100,
  });
  assert.equal(out.pct, 100);
});

// ── Desharing wells extractor (two regions + stray rows guarded) ──────────────
test('extractDesharingWells counts BAB and BU HASA wells separately', () => {
  const wb = wbFrom({
    'BAB': [
      ['BAB - DESHARING', 'DESHARING WELLS SCOPE STATUS IN BAB AREA - WAVE PROJECT C3B'],
      ['Sr. No.', 'Well No.', 'Grouping', 'C3A Tie In Tag', 'C3A Tie In Location', 'Size',
       'Easting', 'Northing', 'System/Subsystem', 'Alignment Sheet',
       'Piping Fab. Completed', 'Pipeline Completed', 'MC WD Status', 'RFC WD Status'],
      [1, 'BB-1463', '', 'TP-1601', 'HP North', '16"', 1, 2, 'SYS-BAB-N-H01', 'P30280B-1633', 'Yes', '51%', '', ''],
      [3, 'BB-1028', '', 'TP-1603', 'HP North', '16"', 1, 2, 'SYS-BAB-N-H03', 'P30280B-1728', 'Yes', '100%', '1-Apr-26', ''],
      [12, 'BB-1102', '', 'TP-1606', 'HP North', '16"', 1, 2, 'SYS-BAB-N-H06', 'P30280B-1694', 'No', '100%', '11-Jan-26', ''],
      // Stray alignment-sheet list row (no pipeline %) must be ignored:
      ['P30280B-1679', 'BB-2027', '100.00%'],
    ],
    'BUHASA': [
      ['BU HASA - DESHARING', 'READINESS STATUS OF DESHARING WELLS OF BU HASA - WAVE PROJECT C3B'],
      ['Sr. No.', 'Well No.', 'System/SubSystem', 'Alignment Sheet', 'Piping Fab. Completed',
       'ROTO/ BARE Avl at Site', 'Pipeline Completed', 'Balance Works', 'Date of RFC'],
      [1, 'BU-798', 'SYS-BUH-N-H01', 'P30280B-1601', 'Yes', 'Yes', 'Yes', 'UV Coating, TIE-IN', 'Complete'],
      [2, 'BU-841', 'SYS-BUH-N-H02', 'P30280B-1638', 'Yes', 'Yes', 'Yes', 'UV Coating, TIE-IN', 'Complete'],
    ],
  });
  const out = extractDesharingWells(wb);
  assert.ok(out);
  assert.equal(out.bab.total, 3);              // stray row excluded
  assert.equal(out.bab.pipeline_complete, 2);  // two at 100%
  assert.equal(out.bab.mc_done, 2);            // two have an MC WD date
  assert.equal(out.buhasa.total, 2);
  assert.equal(out.buhasa.rfc_complete, 2);
  assert.equal(out.total_wells, 5);
});
