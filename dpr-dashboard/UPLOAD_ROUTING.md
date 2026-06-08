# DPR Upload Routing

This document is the authoritative reference for all daily upload file types accepted by the dashboard.
The machine-readable mirror is `api/upload-routing.js` — **update both files together** when adding new types.

---

## File Types

### 1. Construction Daily Progress Report (BAB & BUHASA)
**File ID:** `construction_dpr`
**Filename pattern:** `CONSTRUCTION DAILY PROGRESS REPORT-WAVE PROJECT C3B BAB BU HASA {DD-MM-YY}.xlsx`
**Example:** `CONSTRUCTION DAILY PROGRESS REPORT-WAVE PROJECT C3B BAB BU HASA 04-06-26.xlsx`
**Date format in filename:** `DD-MM-YY` or `DD-MM-YYYY`
**Implementation status:** ✅ Fully implemented

**Updates:**
- BAB Tab → Pipeline
- BAB Tab → Piping Progress
- BAB Tab → IVC Progress
- BUHASA Tab → Pipeline
- Project Overview Tab → BAB Finished Lines: Stringing
- Project Overview Tab → BAB Finished Lines: Welding
- Project Overview Tab → BAB Finished Lines: Final Hydrotest
- Project Overview Tab → All Today Progress Summary
- Project Overview Tab → All charts related

---

### 2. Overall Crossing in BAB
**File ID:** `crossing_dpr`
**Filename pattern:** `OVERALL CROSSING IN BAB - WAVE PROJECT C3B -{DD-Month YYYY}.xlsx`
**Example:** `OVERALL CROSSING IN BAB - WAVE PROJECT C3B -04-June 2026.xlsx`
**Date format in filename:** `DD-Month YYYY` or `DD Month YYYY` (e.g. `04-June 2026`, `03 Jun 2026`)
**Implementation status:** ✅ Implemented — reads the top "ACTIVITIES SUMMARY" block (Section Welding, NDT, Coating, Excavation, Lowering: Scope / Previous / Today / Cumulative / Balance). Overall completion is taken from *Lowering*.

**Updates:**
- BAB Tab → Crossings subtab
- Project Overview Tab → BAB Finished Lines: Crossings
- Project Overview Tab → All Today Progress Summary
- Project Overview Tab → All charts related

---

### 3. Overall Crossing in BU HASA  *(new)*
**File ID:** `buhasa_crossing_dpr`
**Filename pattern:** `OVERALL CROSSING IN BU HASA - WAVE PROJECT C3B- {DD Month YYYY}.xlsx`
**Example:** `OVERALL CROSSING IN BU HASA - WAVE PROJECT C3B-  03 Jun 2026.xlsx`
**Date format in filename:** `DD Month YYYY` or `DD-Month YYYY`
**Implementation status:** ✅ Implemented — same "ACTIVITIES SUMMARY" extractor as the BAB crossing (the BU HASA export has a leading blank column, which the extractor handles by locating the header dynamically).

**Updates:**
- BUHASA Tab → Crossings subtab
- Project Overview Tab → BUHASA Finished Lines: Crossings
- Project Overview Tab → All Today Progress Summary
- Project Overview Tab → All charts related

---

### 4. Wave Main Works BAB HDPE (CWP-02)
**File ID:** `hdpe_dpr`
**Filename pattern:** `Wave Main Works BAB(CWP-02)-{DPR|Progress report}-{DD-MM-YYYY}.xlsx`
**Example:** `Copy of Wave Main Works BAB(CWP-02)-Progress report-04-06-2026 (002).xlsx`
**Date format in filename:** `DD-MM-YYYY`
**Implementation status:** ⏳ Pending extraction logic
**Note:** The detection pattern no longer requires the literal `DPR` token — the real export is often named `…-Progress report-…`, which previously failed auto-detection.

**Updates:**
- BAB Tab → HDPE
- Project Overview Tab → BAB Finished Lines: HDPE Insertion
- Project Overview Tab → All Today Progress Summary
- Project Overview Tab → All charts related

---

### 5. Civil Works Master DPR (BAB)
**File ID:** `civil_master_dpr`
**Filename pattern:** `DPR- {DD.MM.YYYY} Master1.xlsx`
**Example:** `DPR- 02.06.2026 Master1.xlsx`
**Date format in filename:** `DD.MM.YYYY`
**Implementation status:** ⏳ Pending extraction logic

**Updates:**
- BAB Tab → Pipeline Earthwork
- BAB Tab → Pig Stations Civil Work
- BAB Tab → Wellhead Foundations
- Project Overview Tab → All Today Progress Summary

---

### 6. Desharing Wells (BAB & BUHASA)
**File ID:** `desharing_wells`
**Filename pattern:** `DESHARING WELLS OF BAB BU HASA - WAVE PROJECT C3B.xlsx`
**Example:** `DESHARING WELLS OF BAB  BU HASA - WAVE PROJECT C3B.xlsx`
**Date format in filename:** None — upload date used as report date
**Implementation status:** ✅ Implemented — counts wells per area. BAB: total / Pipeline-Completed (100%) / MC-WD-dated. BU HASA: total / RFC-complete.

**Updates:**
- BAB Tab → De-sharing Wells
- BUHASA Tab → De-sharing Wells

---

### 7. BAB WD Status with Punches
**File ID:** `bab_wd_status`
**Filename pattern:** `BAB WD Status with Punches {DD-MM-YYYY}.xlsx`
**Example:** `BAB WD Status with Punches 04-05-2026.xlsx`
**Date format in filename:** `DD-MM-YYYY`
**Implementation status:** ⏳ Pending extraction logic

**Updates:**
- Commissioning Tab → BAB Commissioning
- Project Overview Tab → Summary cards for commissioning

---

### 8. BUHASA WD Status with Punches
**File ID:** `buhasa_wd_status`
**Filename pattern:** `BUHASA WD Status with punches {DD-MM-YYYY}.xlsx`
**Example:** `BUHASA WD Status with punches 04-05-2026.xlsx`
**Date format in filename:** `DD-MM-YYYY`
**Implementation status:** ⏳ Pending extraction logic

**Updates:**
- Commissioning Tab → BUHASA Commissioning
- Project Overview Tab → Summary cards for commissioning

---

### 9. BUHASA Civil DPR
**File ID:** `buhasa_civil_dpr`
**Filename pattern:** `BUHASA_CIVIL_DPR_{DD_MM_YYYY}.xlsx`
**Example:** `BUHASA_CIVIL_DPR_02_06_2026.xlsx`
**Date format in filename:** `DD_MM_YYYY`
**Implementation status:** ⏳ Pending extraction logic

**Updates:**
- BUHASA Tab → Wellhead Foundations
- BUHASA Tab → Pig Stations Civil
- BUHASA Tab → Evaporation Pond
- BUHASA Tab → Flowline Earthwork

---

## Implementation Status Summary

| # | File ID | Extraction | Dashboard Cards |
|---|---------|-----------|----------------|
| 1 | `construction_dpr` | ✅ Full | ✅ Stringing, Welding, HDPE, Hydrotest, Wells, Systems |
| 2 | `crossing_dpr` | ✅ Full | ✅ BAB Crossings activities + overall |
| 3 | `buhasa_crossing_dpr` | ✅ Full | ✅ BUHASA Crossings activities + overall |
| 4 | `hdpe_dpr` | ⏳ Pending | ⏳ Pending |
| 5 | `civil_master_dpr` | ⏳ Pending | ⏳ Pending |
| 6 | `desharing_wells` | ✅ Full | ✅ BAB & BUHASA well counts |
| 7 | `bab_wd_status` | ⏳ Pending | ⏳ Pending |
| 8 | `buhasa_wd_status` | ⏳ Pending | ⏳ Pending |
| 9 | `buhasa_civil_dpr` | ⏳ Pending | ⏳ Pending |

---

## Upload & Validation Behaviour

- **Auto-detection** — send `file_type=auto` (or omit it) and the filename is matched against each route's `namePattern`. More specific patterns (e.g. BU HASA crossing) are declared before looser ones so they win.
- **Mismatch guard** — if a caller explicitly selects a `file_type` but the filename clearly indicates a different one, the upload is rejected with HTTP `409` to prevent mis-typed data.
- **Empty-file guard** — 0-byte uploads are rejected with HTTP `400`.
- **Re-uploads supersede** — processing a file deactivates any prior active snapshot for the same `file_type` + `report_date`, so the dashboard always reads the latest figures.

---

## Adding a New File Type

1. Add an entry to `api/upload-routing.js` (follow the existing pattern; set `implemented: false` until the processor is done).
2. Add an entry to this file under "File Types" and the status table.
3. Implement the extraction function in `api/process-dpr.js` and wire it into `runProcessor()`.
4. Add a unit test in `test/extractors.test.js` (build a small fixture mirroring the real sheet) and run `npm test`.
5. Flip `implemented: true` in `api/upload-routing.js` and update the status table here.
6. Wire up the dashboard card updates in the client-side snapshot loader in `index.html`.
