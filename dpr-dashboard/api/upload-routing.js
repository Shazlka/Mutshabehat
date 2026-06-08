'use strict';

/**
 * DPR Upload Routing Config
 *
 * Single source of truth for all file types the upload system accepts.
 * Human-readable mirror: UPLOAD_ROUTING.md — keep both in sync.
 *
 * Fields per route:
 *   id               — internal key, stored in dpr_uploaded_files.file_type
 *   label            — display name shown in the upload modal dropdown
 *   namePattern      — RegExp matched against the uploaded filename for auto-detection
 *   datePattern      — RegExp to extract date components from filename (null = no date in name)
 *   dashboardSections — array of dot-notation section IDs this file is responsible for
 *   implemented      — true when the extraction + card-update logic is complete
 */
const ROUTES = [
  {
    id: 'construction_dpr',
    label: 'Construction Daily Progress Report (BAB & BUHASA)',
    namePattern: /CONSTRUCTION\s+DAILY\s+PROGRESS\s+REPORT.*WAVE\s+PROJECT\s+C3B/i,
    datePattern: /(\d{2})-(\d{2})-(\d{2,4})/,  // DD-MM-YY or DD-MM-YYYY
    dashboardSections: [
      'bab.pipeline',
      'bab.piping_progress',
      'bab.ivc_progress',
      'buhasa.pipeline',
      'overview.bab_finished_stringing',
      'overview.bab_finished_welding',
      'overview.bab_finished_hydrotest',
      'overview.today_summary',
      'overview.charts',
    ],
    implemented: true,
  },
  {
    id: 'crossing_dpr',
    label: 'Overall Crossing in BAB',
    namePattern: /OVERALL\s+CROSSING\s+IN\s+BAB.*WAVE\s+PROJECT\s+C3B/i,
    // "DD-Month YYYY" or "DD Month YYYY" (e.g. "04-June 2026", "03 Jun 2026")
    datePattern: /(\d{1,2})[-\s]+([A-Za-z]+)\s+(\d{4})/,
    dashboardSections: [
      'bab.crossings',
      'overview.bab_finished_crossings',
      'overview.today_summary',
      'overview.charts',
    ],
    implemented: true,
  },
  {
    id: 'buhasa_crossing_dpr',
    label: 'Overall Crossing in BU HASA',
    // Must be matched ahead of any looser pattern; "BU HASA" never contains "BAB".
    namePattern: /OVERALL\s+CROSSING\s+IN\s+BU\s*HASA.*WAVE\s+PROJECT\s+C3B/i,
    // "DD Month YYYY" or "DD-Month YYYY" (e.g. "03 Jun 2026")
    datePattern: /(\d{1,2})[-\s]+([A-Za-z]+)\s+(\d{4})/,
    dashboardSections: [
      'buhasa.crossings',
      'overview.buhasa_finished_crossings',
      'overview.today_summary',
      'overview.charts',
    ],
    implemented: true,
  },
  {
    id: 'hdpe_dpr',
    label: 'Wave Main Works BAB HDPE (CWP-02)',
    // The real export is sometimes named "...-Progress report-..." rather than "...-DPR-...",
    // so do not require the literal "DPR" token — match on the distinctive prefix instead.
    namePattern: /Wave\s+Main\s+Works\s+BAB.*CWP-0?2/i,
    datePattern: /(\d{2})-(\d{2})-(\d{4})/,  // DD-MM-YYYY
    dashboardSections: [
      'bab.hdpe',
      'overview.bab_finished_hdpe',
      'overview.today_summary',
      'overview.charts',
    ],
    implemented: false,
  },
  {
    id: 'civil_master_dpr',
    label: 'Civil Works Master DPR (BAB)',
    namePattern: /^DPR-?\s*\d{2}\.\d{2}\.\d{4}\s*Master/i,
    datePattern: /(\d{2})\.(\d{2})\.(\d{4})/,  // DD.MM.YYYY
    dashboardSections: [
      'bab.pipeline_earthwork',
      'bab.pig_stations_civil',
      'bab.wellhead_foundations',
      'overview.today_summary',
    ],
    implemented: false,
  },
  {
    id: 'desharing_wells',
    label: 'Desharing Wells (BAB & BUHASA)',
    namePattern: /DESHARING\s+WELLS\s+OF\s+BAB/i,
    datePattern: null,  // No date in filename — use upload date
    dashboardSections: [
      'bab.desharing_wells',
      'buhasa.desharing_wells',
    ],
    implemented: true,
  },
  {
    id: 'bab_wd_status',
    label: 'BAB WD Status with Punches',
    namePattern: /BAB\s+WD\s+Status\s+with\s+Punches/i,
    datePattern: /(\d{2})-(\d{2})-(\d{4})/,  // DD-MM-YYYY
    dashboardSections: [
      'commissioning.bab',
      'overview.commissioning_summary',
    ],
    implemented: false,
  },
  {
    id: 'buhasa_wd_status',
    label: 'BUHASA WD Status with Punches',
    namePattern: /BUHASA\s+WD\s+Status\s+with\s+[Pp]unches/i,
    datePattern: /(\d{2})-(\d{2})-(\d{4})/,  // DD-MM-YYYY
    dashboardSections: [
      'commissioning.buhasa',
      'overview.commissioning_summary',
    ],
    implemented: false,
  },
  {
    id: 'buhasa_civil_dpr',
    label: 'BUHASA Civil DPR',
    namePattern: /BUHASA_CIVIL_DPR/i,
    datePattern: /(\d{2})_(\d{2})_(\d{4})/,  // DD_MM_YYYY
    dashboardSections: [
      'buhasa.wellhead_foundations',
      'buhasa.pig_stations_civil',
      'buhasa.evaporation_pond',
      'buhasa.flowline_earthwork',
    ],
    implemented: false,
  },
];

// Backwards-compat alias: old uploads stored 'construction_daily_progress_report'
const ALIASES = {
  construction_daily_progress_report: 'construction_dpr',
};

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * Match a filename to a route. Returns the matched route or null.
 *
 * Routes are tested in declaration order; more specific patterns (e.g. the
 * BU HASA crossing) are declared before looser ones so they win.
 */
function detectFileType(filename) {
  if (!filename) return null;
  for (const route of ROUTES) {
    if (route.namePattern.test(filename)) return route;
  }
  return null;
}

/**
 * Get a route by its ID (or alias).
 */
function getRoute(id) {
  if (!id) return null;
  const canonical = ALIASES[id] || id;
  return ROUTES.find(r => r.id === canonical) || null;
}

/**
 * Extract report date from filename using the route's datePattern.
 * Returns a YYYY-MM-DD string or null.
 */
function extractDateFromFilename(filename, route) {
  if (!filename || !route || !route.datePattern) return null;
  const m = filename.match(route.datePattern);
  if (!m) return null;

  // Handle month-name patterns ("DD-Month YYYY" / "DD Month YYYY")
  if (isNaN(parseInt(m[2], 10))) {
    const mo = MONTHS[m[2].toLowerCase().slice(0, 3)];
    if (!mo) return null;
    return `${m[3]}-${String(mo).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }

  // Numeric: DD-MM-YY / DD-MM-YYYY / DD.MM.YYYY / DD_MM_YYYY
  const day = m[1].padStart(2, '0');
  const month = m[2].padStart(2, '0');
  let year = m[3];
  if (year.length === 2) year = '20' + year;
  return `${year}-${month}-${day}`;
}

/**
 * Set of all valid file_type IDs (for fast validation).
 */
const ALLOWED_IDS = new Set([...ROUTES.map(r => r.id), ...Object.keys(ALIASES)]);

/**
 * Lightweight metadata list for building UI dropdowns / status views without
 * exposing the RegExp internals. Mirrors the UPLOAD_ROUTING.md table.
 */
function listRoutes() {
  return ROUTES.map(r => ({
    id: r.id,
    label: r.label,
    implemented: r.implemented,
    dashboardSections: r.dashboardSections,
    hasDateInName: r.datePattern !== null,
  }));
}

module.exports = {
  ROUTES,
  ALIASES,
  ALLOWED_IDS,
  detectFileType,
  getRoute,
  extractDateFromFilename,
  listRoutes,
};
