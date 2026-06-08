# Wave C3B DPR Dashboard — API + Routing

Backend for the **Wave C3B DPR dashboard**: a daily Excel-upload pipeline that
parses construction Daily Progress Reports and stores dashboard snapshots in
Supabase. Designed to deploy as **Vercel serverless functions**.

> Source of truth for the live app currently lives in Google Drive
> (`Wave C3B DPR` folder + `api/` scripts + `index.html`). These files mirror and
> improve that backend so changes are reviewable in git and deployable to Vercel.

## Layout

```
dpr-dashboard/
├── api/
│   ├── upload-routing.js   # single source of truth: file types, filename/date detection
│   ├── upload-dpr.js       # POST: multipart upload → Supabase storage + metadata
│   ├── process-dpr.js      # POST: download → parse xlsx → extract metrics → snapshot
│   └── _auth.js            # admin guard (x-admin-token, fail-closed)
├── test/
│   └── extractors.test.js  # unit tests for routing + extractors (no Supabase needed)
├── UPLOAD_ROUTING.md       # human-readable mirror of upload-routing.js
├── vercel.json
└── package.json
```

## Flow

1. **`POST /api/upload-dpr`** (multipart): validates the file, auto-detects the
   type from the filename (or accepts an explicit `file_type`), uploads to the
   `dpr-uploads` Supabase bucket, and records a batch + file row. Returns a
   `batchId`.
2. **`POST /api/process-dpr`** (`{ "batchId": "…" }`): downloads the stored
   workbook, runs the matching extractor, and writes a row to
   `dashboard_snapshots` (deactivating any earlier snapshot for the same
   type + date).

## What's implemented

| File type | Status |
|-----------|--------|
| `construction_dpr` | ✅ Full (pipeline + dashboard summary) |
| `crossing_dpr` (BAB) | ✅ Full (activities summary) |
| `buhasa_crossing_dpr` (**new**) | ✅ Full (activities summary) |
| `desharing_wells` | ✅ Full (BAB + BU HASA well counts) |
| `hdpe_dpr`, `civil_master_dpr`, `bab_wd_status`, `buhasa_wd_status`, `buhasa_civil_dpr` | ⏳ Stubbed (stores sheet names, not blocked) |

See `UPLOAD_ROUTING.md` for the full routing table and the recent
validation/detection improvements.

## Tests

```bash
cd dpr-dashboard
npm install          # or: npm install xlsx
npm test             # node --test test/
```

The tests use small in-memory fixtures that reproduce the exact sheet layouts of
the real uploads, so they run without any Supabase connection.

## Deploy (Vercel)

- Point the Vercel project **Root Directory** at `dpr-dashboard/`.
- Set environment variables: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `ADMIN_TOKEN`.
- The static dashboard (`index.html`, ~2.7 MB) is **not** included here yet — it
  still lives in Drive. To wire the new cards (BAB/BUHASA Crossings, Desharing
  Wells) into the UI, drop `index.html` alongside this folder and the client
  snapshot loader can read the new `snapshot_json` fields:
  - `crossings.activities.*` and `crossings.{crossings_total,crossings_done,today,pct}`
  - `wells.{bab,buhasa}.*`

## Environment variables

| Name | Used by | Purpose |
|------|---------|---------|
| `SUPABASE_URL` | both | Supabase project URL |
| `SUPABASE_SECRET_KEY` | both | server-side secret key (never exposed to the browser) |
| `ADMIN_TOKEN` | both | shared secret required in the `x-admin-token` header |
