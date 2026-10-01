# Qiraat iOS app — changelog

> Newest first. One dated entry per change. iOS changes are logged here, never in the root
> `CHANGELOG.md`, which belongs to the web app (see `AGENTS.md` §1).

## 2026-10-01
- **Feature — القراءات العشر in the iOS reader, from the web app's live data:** `scripts/fetch_qiraat.py` (`make qiraat`) snapshots the web API `GET /api/mushaf-1441/qiraat?page=N` for all 604 pages. That API reads the database first and falls back to its fixtures, so the app gets exactly what the web shows: 3,819 variants, 12,391 أصول rulings and 8 page rules on 2026-10-01. They go to `Generated/Qiraat/` (13 MB, gitignored, bundled), with a `catalog.json` whose readers, narrators and fixed colours are parsed from `packages/qiraat-core`. The web proxy's auto-login cookie stays in memory and never reaches disk or logs. `make qiraat-offline` builds the same snapshot from the repo fixtures instead. `MushafCore` decodes a page and ports the web's marker rules (`qiraatWordMarker.ts`, `attribution.ts`):
  - reader or narrator colour (a reader takes his own colour when both his narrators read the word);
  - one equal segment per reader when several readers share a variant;
  - the performance-only colour;
  - a neutral grey when no reading id is known;
  - أصول family colours, with a dot at the top-left when a word has more than one family;
  - a dotted underline for ذو وجهين;
  - a filled or ring dot for إمالة or تقليل;
  - rulings that cross an ayah end, such as page 1's إدغام كبير ﴿ٱلرَّحِيمِ ۝ مَـٰلِكِ﴾, mark both words.
  
  In the reader, 16,045 words take these marks. A «ق» button toggles the layer, and a filter narrows it to all readers, one reader, or one narrator. Both choices are kept per device under the web's keys `mushaf1441:reader-layer:v1` and `mushaf1441:qiraat-filter:v1`; a new install starts with Qiraat on. A tap on a marked word opens a card like the web's: the word in its own page font; one card per variant with who reads it; and one card per ruling, grouped by action, with وجه numbers, conditions, «ذو وجهين» and «تحتاج مراجعة يدوية».
  
  Marked words are accessibility elements (`qiraat-word-<surah>:<ayah>:<token>`). Their tap waits on nothing else, but the page curl's tap waits for it: the first build let the curl claim the tap and turn the page back, which the simulator showed and a recognizer that begins only on marked words fixed. The build refuses an incomplete snapshot.
  
  `make device` builds, installs and launches on the user's iPhone once their Apple ID is in Xcode. It reads the team Xcode has and the paired iPhone, writes the gitignored `Signing.xcconfig` (optionally included by `Base.xcconfig`), and never guesses between several teams or several iPhones: a Codex review caught both cases.
  
  Codex also wrote `fetch_qiraat.py` with its 19 tests, and the Phase 1 deferred fixes:
  - `MushafDatabase` throws instead of force-unwrapping a malformed page and closes a failed handle once;
  - the index marks the current surah and juz and shows Western digits on every locale;
  - VoiceOver can move the page slider.
  
  Verification:
  - 8 + 19 + 12 script tests;
  - 65 `MushafCore` tests, including every snapshot page decoding and marking against the real page database;
  - UI tests: 12 passed and 2 iPad-only skipped on the iPhone 18 Pro Max, and 14/14 on the iPad Pro 13-inch.
  
  The paging tests now run with the layer off, because a tap on a marked word opens its card.

- **Change — the iOS app is now a separate, isolated app on its own branch and folder:** the long-lived branch `ios/main` lives in its own worktree, `~/Projects/qiraat-ios`; the web folder `~/Projects/mutshabehat-v2` is back on `main`. `ios/main` is never merged into `main`; data flows one way, from the web app and its database into the app. Everything iOS moved under `apps/ios`: the generator scripts (`scripts/ios` → `apps/ios/scripts`), the Phase 1 plan (`apps/ios/docs/plans/`), and the docs that had been added to the root `CHANGELOG.md`, `CLAUDE.md`, `HANDOFF.md` and `PROJECT_MASTER.md`. Those root files are restored to the web app's own versions; the iOS rules are now in `apps/ios/AGENTS.md`, with `apps/ios/CLAUDE.md` pointing to it, and this changelog. `.vercelignore` was removed, because it was the only root file the branch still added. New `scripts/check_isolation.sh` (`make check-isolation`, part of `make test`) fails if the branch differs from `origin/main` outside `apps/ios`.

## 2026-09-30
- **Feature — iOS app, Phase 1: offline Mushaf 1441 reader (`apps/ios`, app name «Qiraat»):** a native SwiftUI + UIKit app for iPhone and iPad, built with XcodeGen on the MacBook Air and tested in the iOS 27 Simulator. All 604 pages are drawn with CoreText in the exact QCF V2 page fonts, laid out by a Swift port of the web reader's page geometry (15 rows, right-to-left justification, centred surah endings, the centred pages 1–2, and surah-header/basmala slots computed exactly as `pageDecorations.ts`, 0 differences across 604 pages). Pages turn with UIKit's page curl in the Arabic direction (left edge → next page, verified with the app running RTL in an Arabic locale too), iPad landscape shows a two-page spread with the odd page on the right, the reader reopens on the last page (`mushaf1441:last-page:v1`, clamped to 1–604), and a tap shows a top bar, a page slider (page 1 at the right end) and a surah/juz index. Everything is offline: `scripts/ios/build_mushaf_db.py` turns the committed fixtures into a 9.6 MB SQLite file and `scripts/ios/fetch_qcf_fonts.sh` fetches the 604 woff2 fonts (93.2 MB), both into a gitignored `apps/ios/Generated/`, and the build fails with a readable error if either is missing. Real defects caught while verifying: **198 tokens are two glyphs joined by a space** (rub al-hizb ۞ + word, e.g. 2:26) that a strict glyph lookup rejects because the QCF fonts have no space glyph, so every token is measured and drawn as a CoreText line; QCF glyphs have no bidi class, so **CoreText draws a whole line left to right** and the layout engine places each word itself; the Makefile never regenerated the Xcode project when a new `.swift` file appeared (it now always regenerates); Xcode 27 ships no `Simulator.app` (`make run` no longer opens it); the UI tests had 11 Swift 6 actor-isolation warnings (the class is now `@MainActor`, 0 warnings on a clean build); the performance test was flaky on a loaded laptop (it now takes each page's fastest of 3 passes and asserts mean and p99); and a whole-branch review found three more, all fixed test-first: the font script accepted a truncated download (a blank page at runtime — it now checks each woff2 against the length in its own header, and a page whose font still fails shows its margins and «تعذّر تحميل خط الصفحة N» instead of nothing), spread pages were centred in their halves so on an iPad Air 11" they stood 52 pt apart at the spine (they now meet like a book), and in a spread the strip next to the spine ignored taps. Verification: 8 generator/script tests, 30 `MushafCore` tests (including every one of the 83,665 tokens rendering in its own page's font), 8 UI tests on iPhone 18 Pro Max (the two iPad-only ones skip) and 10 on iPad Air 11-inch and iPad Pro 13-inch, and a release-mode budget of warm page load + layout ~0.8 ms mean / p99 ~1.2 ms (a cold font decode is ~2.2 ms, so neighbour fonts are pre-warmed off the main thread). Files: `apps/ios/**`, `scripts/ios/… (now apps/ios/scripts)`, `.vercelignore`, `PROJECT_MASTER.md` §14, `HANDOFF.md`, `docs/superpowers/plans/2026-09-30-ios-mushaf-1441-app.md`. No web code or DB change.

