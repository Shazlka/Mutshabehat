# القراءات العشر in the iOS app — implementation plan

**Goal:** the iOS reader shows the web app's Qiraat layer: coloured words, the variant underline, the
أصول colours and dots, a reader/narrator filter, and a tap-to-open detail sheet, using the live data
the web app serves.

**Architecture:** the web app and its database stay the only source. A generator snapshots the live
API `GET /api/mushaf-1441/qiraat?page=N` (DB first, fixtures as its own fallback) into
`apps/ios/Generated/Qiraat/page-NNN.json` plus `catalog.json`, which are bundled. `MushafCore` decodes a
page, computes word markers with a Swift port of `qiraatWordMarker.ts` + `attribution.ts`, and the app
draws them with CoreText and shows a SwiftUI detail sheet.

**Branch:** `ios/main` (worktree `~/Projects/qiraat-ios`); see `apps/ios/AGENTS.md`.

## Global constraints

- Everything under `apps/ios`; `make check-isolation` must pass.
- Python: stdlib only. Swift 6 strict concurrency, iOS 18+, 0 warnings.
- Never write the session cookie the web app's proxy sets to disk or to a log.
- Colours, names and rules come from `packages/qiraat-core` (web). Never a bare «خلف» / «الدوري».
- Visibility matches the web default: REVIEWED and NEEDS_MANUAL_REVIEW records are shown (the web's
  "include reviewed" is on by default); NEEDS_MANUAL_REVIEW is labelled «تحتاج مراجعة يدوية».
- Tests first. Commits by `Shazlka <amr.eshazly@gmail.com>`, no model names.

## Data contract (shared by every task)

`Generated/Qiraat/page-NNN.json` (NNN zero-padded to 3) is the API response object, unchanged:

```json
{ "pageNumber": 50,
  "variants": [ { "id", "surah", "ayah", "startToken", "endToken", "operation", "hafsText", "variantText",
                  "uthmaniText?", "description?", "performanceNote?", "differenceType", "verificationStatus",
                  "readingIds": ["Q03-R02"], "locusId?", "locusType?", "notes?", "wajhIndex?" } ],
  "rulings":  [ { "id", "pageNumber", "category", "categoryAr", "color", "wordAnchored", "surah", "ayah",
                  "startToken", "endToken", "endAyah?", "baseText", "verificationStatus", "hasAlternate",
                  "attribution": [ { "authorityId", "action", "condition?", "wajhOrder?", "wajhNote?" } ],
                  "readings": [ { "readingId", "action", "isDefault" } ],
                  "text?", "condition?", "countSchools?", "notes?", "sourceNotes?" } ],
  "rules": [ ... page-level rules, shown as-is ... ] }
```

`Generated/Qiraat/catalog.json`:

```json
{ "schemaVersion": 1, "source": "api" | "fixtures", "sourceUrl": "https://…" | null,
  "fetchedAt": "2026-10-01T03:00:00Z", "pageCount": 604,
  "counts": { "variants": 0, "rulings": 0, "rules": 0 },
  "readers":   [ { "id": "Q01", "nameAr": "نافع المدني", "nameArShort": "نافع", "color": "#2563EB", "sortOrder": 1 } ],
  "narrators": [ { "id": "Q01-R01", "readerId": "Q01", "nameAr": "قالون", "color": "#60A5FA", "sortOrder": 1 } ],
  "multiReaderColor": "#3F6212", "performanceColor": "#4F46E5", "unresolvedColor": "#8a8a8a" }
```

Readers and narrators are parsed from `packages/qiraat-core/readers.ts` and `narrators.ts`; the three
fixed colours from `colors.ts` (`QIRAAT_MULTI_READER_COLOR`) and
`src/app/mushaf-1441/_components/qiraat/qiraatWordMarker.ts` (`PERFORMANCE_MARKER_COLOR`,
`UNRESOLVED_MARKER_COLOR`). A missing value is an error, never a guess.

## Task C1 (Codex): `apps/ios/scripts/fetch_qiraat.py` + tests

Usage: `python3 apps/ios/scripts/fetch_qiraat.py <repo_root> <out_dir> [--source api|fixtures]
[--base URL] [--refresh] [--workers N] [--page-count N]` (`--page-count` defaults to 604, for tests).

- `api` (default; base `QIRAAT_API_BASE` env or `https://mutshabehat-v2.vercel.app`): GET
  `{base}/api/mushaf-1441/qiraat?page=N`. The web app's proxy answers a cookie-less first request with
  a 307 to the same URL plus `Set-Cookie`; use `urllib` with an in-memory `http.cookiejar.CookieJar`
  and follow up to 5 redirects. Never save or print cookies. Timeout 60 s; 3 attempts with backoff on
  network errors and 5xx. Thread pool (`--workers`, default 6), one opener per thread.
- `fixtures`: assemble the same object from `packages/qiraat-core/fixtures/pages/page-NNN.json`
  (variants), `rulings/page-NNN.json`, and `rules/page-NNN.json` (missing file → `[]`).
- Validate before writing: an object whose `pageNumber == N`; `variants`, `rulings`, `rules` are
  lists; every variant has `id, surah, ayah, startToken, endToken, readingIds(list)`; every ruling has
  `id, category, categoryAr, color, wordAnchored, surah, ayah, startToken, endToken, readings(list),
  attribution(list)`. Invalid → that page fails, nothing written.
- Write atomically (`.part` + `os.replace`), UTF-8, `ensure_ascii=False`, compact separators. Never
  leave a `.part` behind.
- Skip a page whose existing file is valid, unless `--refresh`.
- `catalog.json` is written (atomically) only when all pages 1…page-count are present and valid;
  otherwise exit 1 and list the failed pages on stderr.

Tests `apps/ios/scripts/test_fetch_qiraat.py` (unittest, stdlib, no internet; an in-process
`ThreadingHTTPServer` on 127.0.0.1 fakes the API including the 307 + cookie dance):
1. api source fetches every page through the redirect and writes valid files + catalog;
2. a page answered with the wrong `pageNumber` or truncated JSON fails the run, is not written, and
   no `.part` remains; catalog not written;
3. an existing valid page is not requested again; `--refresh` requests it again;
4. fixtures source assembles the same shape from a temporary fake repo (missing rules file → `[]`);
5. the catalog from the REAL repo has 10 readers and 20 narrators, `Q10.nameArShort == "خلف العاشر"`,
   `Q03-R01.nameAr == "الدوري عن أبي عمرو"`, `Q07-R02.nameAr == "الدوري عن الكسائي"`, and the three fixed
   colours above;
6. cookies are never written into `out_dir`.

Verify: `python3 apps/ios/scripts/test_fetch_qiraat.py -v` → OK.

## Task C2 (Codex): Phase 1 deferred fixes (no Qiraat, no page drawing)

Files: `MushafCore/Sources/MushafCore/MushafDatabase.swift`, its tests, `Sources/Reader/IndexSheet.swift`,
`Sources/Reader/ReaderView.swift`, `Sources/MushafLibrary.swift`. Do NOT edit `MushafPageView.swift`,
`QCFFontStore.swift`, `PageLayout.swift`, `PageController.swift`, `MushafPager.swift`.
1. `MushafDatabase.init`: an open failure closes the handle twice (init, then deinit). Set it to nil.
2. `MushafDatabase.page`: replace the force-unwraps (`AyahKey(...)!`, `.first!`) with
   `MushafDatabaseError.queryFailed` (tests with a temporary SQLite that has a malformed key / missing
   page row).
3. `IndexSheet`: mark the surah and juz containing `currentPage` (and scroll to it); show numbers in
   Western digits on every locale, like the page margins.
4. `ReaderView` page slider: VoiceOver increment/decrement moves one page (page 1 at the right end).
5. Remove the stale `MushafRepository` comment; fix the prewarm-range comment if wrong.

Verify: `swift test --package-path apps/ios/MushafCore` → all pass (the integration tests need
`apps/ios/Generated`, which is a symlink in the task folder).

## Task Q1 (Claude): Swift model, store and markers (`MushafCore`)

- `QiraatModels.swift`: `Codable` page, variant, ruling, attribution, reading, catalog types.
- `QiraatStore.swift`: reads `page-NNN.json` from a directory URL, small thread-safe cache, catalog.
- `QiraatMarkers.swift`: ports of `comparisonMarkerForWord`, `rulingMarkerForWord`,
  `imalahTaqlilMarkerForWord`, `rulingTouchesToken`, `matchesFilter`, `matchesRulingFilter`,
  `computeAttribution`, `rollupAuthorityPills`, `distinctRulingText`, `isRedundantActionLabel`;
  `QiraatFilter { all, reader(id), reading(id) }`; `WordQiraatMarks` per word (text colour, underline
  segments, alternate underline, family dot, إمالة/تقليل dot).
- Tests: decoding a real page; every one of the 604 snapshot pages decodes; markers agree with the
  web on hand-checked words (1:4 مالك, an إمالة/تقليل word, a multi-reader word, a ذو وجهين word,
  a multi-ayah إدغام كبير span); filters; pills roll up a reader with both narrators.

## Task Q2 (Claude): drawing and interaction (app)

- `QCFFontStore.line` gains a colour; `MushafPageView` draws word colour, the variant underline
  (multi-reader: equal segments in reader order), the dotted ذو وجهين underline, the family dot and the
  إمالة/تقليل dot (filled / ring), only while the Qiraat layer is on.
- Top bar: «ق» toggle (persisted `mushaf1441:reader-layer:v1` = `qiraat` | `none`; a new install
  starts on `qiraat` until the متشابهات layer exists on iOS) and a filter menu (الكل, each reader,
  each narrator).
- Tap on a word that has Qiraat data → detail sheet (word, variant cards, ruling cards grouped by
  action with reader pills, wajh numbers, conditions, «ذو وجهين», «تحتاج مراجعة يدوية»). A tap
  elsewhere still toggles the chrome.
- UI tests: the layer toggle persists; tapping a known word opens the sheet and shows its reader pills;
  the filter narrows the sheet.

## Task Q3 (Claude): Xcode, simulator and the user's iPhone

- `project.yml`: bundle `Generated/Qiraat` as a folder; the pre-build check also requires
  `catalog.json`. Makefile: `qiraat`, `qiraat-refresh`, `qiraat-offline`, and `device`
  (finds the personal team after the user signs in to Xcode, writes the gitignored
  `Signing.xcconfig`, builds with `-allowProvisioningUpdates`, installs with `devicectl`).

## Review focus

1. A word with both a variant and أصول rulings: the variant colour wins, the sheet lists both.
2. A multi-ayah ruling span (page 1 ﴿ٱلرَّحِيمِ ۝ مَٰلِكِ﴾): both words marked.
3. Unknown reading id in live data: ignored, never a crash.
4. Filter set to a narrator: no other reader's colour on the page.
5. Snapshot missing or stale: build fails readably; a single undecodable page shows no marks, not a crash.
