# Drift report: Qiraat iOS app (`apps/ios`), 2026-11-08

Branch `ios/main` @ `033a3f65`. Method: each doc was read, then its named files, symbols, keys, Makefile targets and counts were checked against the working tree (grep, file reads, JSON inspection). Test counts come from `grep` of `@Test` / `func test`, so they are approximate.

**Covered:** every doc under `apps/ios/docs` and the iOS README, HANDOFF.md and the 2026-10-27 handoff, at these depths:
- Read in full and checked against the code: README, qiraat-layer plan, references format, UX acceptance, review-editor spec, sqlite-helpers spec, scholarly-references plan, phase-1-word-taps, QURAN_SEARCH, memorization spec, memorization acceptance.
- Headings, named files, symbols, strings and tests checked, body not read line by line: review-editor plan, memorization plan, sqlite-helpers plan, mushaf app plan (2,608 lines; Phase 1 sections A, Global Constraints, File Structure only), app-store-connect (checklist sections 2, 8), content-rights register (sections 1–2 summary), code review 2026-10-20 (spot checks), HANDOFF.md (first 60 lines), 2026-10-27 handoff (first 40 lines).
**Not analysed:** docs/release/accessibility-audit.md; the body of HANDOFF.md after line 60 and of the 2026-10-27 handoff after line 40.

Missing links in these docs that would make future detection cheaper: the qiraat-layer plan and the review-editor spec name types but no paths; the README layout table has no pointer to the Swift package that holds each feature.

## README.md

- Layout table omits `ReviewEditor/` (separate Swift package, in `project.yml`), `Generated/Qiraat`, `Generated/Review`, `Generated/QiraatMutoon`, `Generated/QiraatReferences` and `Generated/mutshabehat.sqlite`, all of which the build bundles.
- Feature list omits shipped areas: Memorization (`Sources/Memorization`, `MushafCore/Memorization`), Backup/Restore (`Sources/Backup`), App Intents / Shortcuts (`Sources/Intents`), the المتون library with symbol layer and شرح (`MatnLibrary`, `MatnSymbols`, `MatnSharh`, `MutoonView`), Qiraat compare, search, page summary and usul index.
- `make test` is described as "builds data + fonts + project, runs every test". The target is `check-isolation all data-test core-test release-guard` followed by the Xcode test run; isolation check and release guard are not mentioned.
- `Config.xcconfig` row says "local Supabase keys (Phase 2)"; `Signing.xcconfig` (used by `make device`) is not listed.
- Not verified: "Mutshabehat magazine view, full-page card expansion, custom group editor", tag `ios-v1.0`.

## docs/plans/2026-10-01-qiraat-layer.md

- Task Q1 file `QiraatMarkers.swift` does not exist. The code is `MushafCore/.../QiraatMarks.swift` (the test file is `QiraatMarkersTests.swift`).
- Planned names that do not exist: `WordQiraatMarks` (now `WordMarks`), free functions `matchesFilter` / `matchesRulingFilter` (now `QiraatMarks.matches(_:_:)` methods for variant and ruling).
- Planned functions that live elsewhere: `rulingTouchesToken` in `QiraatModels.swift`; `rollupAuthorityPills`, `distinctRulingText`, `isRedundantActionLabel` in `QiraatPresentation.swift`, not the markers file. `computeAttribution`, `comparisonMarkerForWord`, `rulingMarkerForWord`, `imalahTaqlilMarkerForWord` are in `QiraatMarks.swift` as planned.
- Task Q2 describes a «ق» toggle, a filter menu and a detail sheet only. The code also has `QiraatHub`, `QiraatCompareView`, `QiraatSearchView`, `QiraatPageSummaryView`, `UsulIndexView`, `QiraatNotesStore`, `QiraatLegendSheet`, `QiraatLiveSync`, `QiraatBulkSync`, `QiraatSyncStatusView`, `QiraatReferencesRow`, and preferences `qiraat-hide-usul:v1` and `qiraat-hidden-usul-categories:v1`. Only the UX acceptance report and the references format doc describe part of this; hide-usul and hub have no design doc.
- Plan says a new install starts on `qiraat` "until the متشابهات layer exists on iOS". Code (`QiraatPreferences`) still defaults to `qiraat` and supports only `qiraat` | `none`; consistent, but the condition in the plan is still open.
- AGENTS.md (the doc the plan points at) writes `Generated/qiraat/`; plan, Makefile and `project.yml` use `Generated/Qiraat/` (case only).
- Matches: `fetch_qiraat.py` and its test exist; `catalog.json` shape (10 readers, 20 narrators, three fixed colours, `pageCount` 604) matches the generated file; Makefile has `qiraat`, `qiraat-refresh`, `qiraat-offline`, `device`; `project.yml` bundles `Generated/Qiraat` and fails below 604 pages or without `catalog.json`; Swift 6 and iOS 18 match.
- Not verified: Task C1 retry/redirect behaviour, Task C2 fixes, review-focus items 1–5.

## docs/qiraat-references-format.md

- `make matn-symbols` default is documented as `symbols-sample.json`. The Makefile prefers `symbols-all.json` when it exists (it does) and falls back to the sample.
- Undocumented: the third bundled file `mutoon-sharh.json` (`make matn-sharh`, `build_matn_sharh.py`, `MatnSharh.swift`), copied by `project.yml` next to `mutoon.json` and `mutoon-symbols.json`.
- Launch argument `-qiraat-references-empty` is used by `QiraatReferencesUITests` but only `-qiraat-references-fixture` is documented.
- Matches: `references.json` fields and enums (`extracted|reviewed|verified`, `variant|complement`, scopes Q01–Q07 / Q08–Q10 / Q01–Q10), `schemaVersion` 1 handling, `mutoon:symbols:v1`, `make references`, `make mutoon` default source, `make clean` leaving `Generated/`. Symbol stats match `mutoon-symbols.json`: 3,693 marks, 1,358 verses, 1,482 / 2,092 / 119 per work, 77 by hand, all `verified`.
- Not verified: per-matn verse ranges of the dictionaries, the 300 added from the second copy, 594 / 679 / 85 verses per work.

## docs/qiraat-ux-acceptance.md

Point-in-time report (2026-10-11, branch `ios/qiraat-ux`), so numbers are stale rather than wrong:
- Totals: 433 core tests, 260 unit, 105 UI. Current tree: about 550 `@Test`, 409 unit `func test`, 133 UI.
- Per suite: `QiraatPageSummaryTests` 13 → 14, `QiraatSearchTests` 12 → 13, `UsulIndexTests` 8 → 10, `QiraatTopBarUITests` 8 → 13, `QiraatUITests` 4 → 9. Unchanged: WordOrder 11, Compare 19, Notes 14, SyncStatus 17, AppLocalized 4, QiraatLocalization 3.
- All named suites and the two failing test names exist.
- Not verifiable offline: the "data gaps" list against the web database.

## docs/specs/2026-10-05-review-editor-design.md

- App layer location: spec says `Sources/ReviewEditor`; code is the separate package `ReviewEditor/Sources/ReviewEditor` (AGENTS.md documents the package).
- Entry row: spec says it is added in `ReaderView.swift`; it is in `Sources/Reader/ReaderSettingsView.swift` (identifier `open-review-editor` matches).
- `HamzahBuilderView` and `ImalahBuilderView` do not exist; one `FaceBuilderView` serves both.
- `ReferenceMatching` is split into `NquranMatching`, `ShamilMatching`, `ReferenceData`, `ReferenceGroup`, `ReferenceApply`. `FacesSummary` is inside `ReviewDraft.swift`, not its own unit.
- Four steps: the sheet's step enum has three cases (الأوجه, المراجع, التحرير). اعتماد is a footer button («حفظ واعتماد» / «اعتماد», plus «اعتماد الكل (N)»), not a fourth step.
- Bottom bar: spec text «التالي غير المراجع» does not appear as a literal in the code (accessibility id `review-next-unreviewed` exists); flagged label is «المعلَّم», spec says «التالي المُعلَّم».
- Haptics: spec calls for `.sensoryFeedback`; no `sensoryFeedback` use exists in the app or the package.
- Spec §5 baseline "100 core, 37 app" tests is stale.
- Matches: DEBUG-only code, `release_guard.py` and `make release-guard`, golden files under `Generated/Review/golden` (nquran, shamil, decision, draft, apply, builders, narrators), `ReviewQueue`, history / same-word / apply-all / suggestions views, `review:reference-source:v1`, «تعديلات غير محفوظة», «تجاهل التعديلات؟».
- Not verified: cookie-jar auth, device-id header, `QiraatLiveSync.refresh` call after save, API method list.

## docs/plans/2026-10-05-review-editor.md

- Task 10 `ApproveStepView` does not exist (see spec above); approval lives in `ReviewWordSheet.swift`.
- Task 12 builders are one `FaceBuilderView` rather than two.
- Plan lists `ReviewSaveStatusBar` / `ReviewStatsBar`: both exist, in `ReviewStatsBars.swift`.
- Not verified: per-task signatures after Task 1 (only `ReviewDraft`, `ReviewQueue`, `SaveJob`, `requestSelect`, `startNewDraft`, `saveDraft` found).

## docs/specs/2026-10-16-sqlite-file-helpers-design.md

- Line references are stale: `MutshabehatDatabase.importDatabase` is at `MutshabehatDatabase.swift:526` (export at 513), not 545-572; `syncReadingSnapshots` is at `ICloudDatabaseSyncService.swift:438`, not 284-321; the backup list is the private `sqliteSources` at `BackupService.swift:132`, not `BackupWorker.sqliteSources` at 131-137.
- Matches: `SQLiteFile` in `MushafCore/Storage` with the `SQLite format 3\0` header and 100-byte check and `PRAGMA quick_check`; `validateSqliteDatabase` deleted; `SQLiteSnapshot.copy` has a single owner for the destination handle; Mutshabehat export uses `SQLiteSnapshot.data(of:)`; `UserStores` exists; `QiraatNotesStore.importDatabase` is a row-level merge; backup covers memorization, reading, mutshabehat and qiraat notes; the three user databases are still separate files.
- Not verified: the 0.23 s / 1.9 ms Qiraat page-read figures, the "about 100 lines removed" claim.

## docs/plans/2026-10-16-sqlite-file-helpers.md

- Branch `ios/sqlite-file-helpers` exists neither locally nor on origin.
- Every named test and `SQLiteFile` entry point I looked up exists (`validate`, `checkpointTruncate`, `removeSidecars`, `replaceContents`, `enableWALAndForeignKeys`).
- Not verified: task-by-task signatures after Task 2.

## docs/plans/2026-10-26-scholarly-references.md

- The plan contradicts itself: Task 1 specifies `public final class QiraatReferenceStore: @unchecked Sendable`, Revision item 3 and the code use `public struct QiraatReferenceStore: Sendable`.
- Task 2 still says `project.yml` adds an optional folder resource and the environment key is set "once at the reader root"; the Revision replaces both (pre-build script; set inside `qiraatCard`). The Task text was not updated.
- Report contract: `docs/plans/2026-10-26-scholarly-references-report.md` and `...references.patch` do not exist.
- DEBUG-only launch argument `-qiraat-references-empty` exists in `ReaderView.swift` and is not in the plan.
- Makefile has no `REFERENCES_SRC ?=` default line (behaviour is the same: unset is empty).
- Matches: `QiraatMatn`, `labelAr`, `scope(in:)`, `key(for:)`, `consistency`, loading from the bundle folder `QiraatReferences`, `references` target in `.PHONY`, `QiraatReferencesRowTests`, the four accessibility identifiers, «المصادر: لم يُوثَّق بعد», the mismatch warning, «افتح في الشاملة», `-qiraat-references-fixture` behind `#if DEBUG`, format doc, HANDOFF paragraph.

## docs/phase-1-word-taps.md

- Work branch `ios/word-context-fixes` exists neither locally nor on origin.
- Test totals (48 Python, 439 core, 273 app, 373 passes) are stale; current tree has about 550 core and 409 app tests.
- Open items the doc itself marks UNVERIFIED are still open: owner's physical-device session, device checklist, and the proposed recovery of `Backups/latest` after the simulator wrote to the real iCloud folder (no evidence in the tree whether it was done).
- Matches: `qiraatDatabaseDidUpdate` is posted from `MushafLibrary.swift:210` and observed in `MushafPageView.swift:151`; the sync service only declares the name (no duplicate post); `MushafPageHitTestTests`, `scripts/test_existing_snapshot.py` with `--destination --result-bundle --skip-build`; `QIRAAT_TEST_ISOLATION` is DEBUG-gated in `MushafLibrary`, `QiraatLiveSync` and the iCloud service.

## docs/QURAN_SEARCH.md

- The doc covers only the first-generation indexed search. The README's "AST query engine with boolean logic, morphology lexicon" (`AdvancedQuranQueryParser`, `AdvancedQuranSearchEngine`, `AdvancedQuranMorphology`, `AdvancedQuranSearchData`, `AdvancedSearchGuideView`) has no design doc.
- Matches: `quran_word_search`, `quran_ayah_search`, `quran_search_aliases`, `quran_search_orthography_rules`, `plain/canonical/imlai/rasm` keys with B-tree indexes, `Reports/quran-search-collisions.json`, smart/broad modes and match types in `QuranSearch.swift`, token counts (83,665 tokens, 77,429 words, 21,295 distinct Uthmani strings in the built `mushaf.sqlite`), `make data`.
- Not re-run: the required result counts (الصلاة 65 …), the 55-case corpus, the 41 ms budget.

## docs/specs/2026-10-06-memorization-design.md

- Status line says "implemented on `ios/memorization` (not merged)"; the code is in `ios/main`, and `ios/memorization` survives only as `origin/ios/memorization`.
- §10 puts a «الحفظ» button in `ReaderTopBar`. The code has no such button there; «الحفظ» is a menu row in `ReaderActionRail.swift:44` and `ReaderBottomBar.swift:214` (`-open-memorization` is handled in `ReaderView.swift`).
- §12 code layout: ayah sheet, range pill, page action and marker drawing are said to live in `Sources/Reader/`; they are in `Sources/Memorization/` (`AyahSheet`, `PageSheet`, `PageStatusMark`). `MushafCore/Backup/` is said to hold the merge rules; merge logic is in `MushafCore/Memorization/MemorizationExport.swift`.
- Matches: enums and raw values, record fields, `MemorizationPolicy` (weights 1/0.75/0.4/0, ladder 1,3,7,14,30,60, failed 1 and 2 days, threshold 30, milestones 25/50/75/100), the five tables and four indexes, `mushaf_memorization.sqlite`, `schema_version`, `QuranIndex`, `MemorizationStatisticsService`, 30 s debounce, launch and background triggers (`beginBackgroundTask`), 7-day stale banner, 14-day retention, `shared/qiraat-<hash>` archive, `NSFileCoordinator`, Swift Charts, both display settings.
- Not verified: statistics budgets, page-state weakest-link rule beyond the acceptance tests, VoiceOver summaries.

## docs/memorization-acceptance.md

- Header says branch "not pushed, not merged"; it is pushed (`origin/ios/memorization`) and its code is in `ios/main`.
- "All 50 memorization UI tests": current `Memorization*UITests` have 52 test functions (27 + 16 + 5 + 4).
- Every test named in the tables exists. Timings and the five-failure baseline are historical and were not re-run.

## docs/plans/2026-10-06-memorization.md

- `Sources/Backup/BackupTriggers.swift` and `RestoreView.swift` (Task 21) do not exist; trigger logic is in `BackupController.swift`.
- The notification `.memorizationDidChange` (Task 21) is not defined anywhere.
- Found as planned: `MemorizationModels/Policy`, `QuranIndex` and the `ayahLayout`/`pageJuzMap` queries, `MemorizationDatabase` and migrations, `MemorizationStore`, `BackupFolder`, `BackupReason`, `BackupResult`, `BackupError`, `BackupStore`, `RestoreService`, `MemorizationRestoreMode`, `RestorePreview`, `exportAll`, `BackupSettingsView`.
- Not verified: remaining per-task signatures.

## docs/plans/2026-09-30-ios-mushaf-1441-app.md

- Scripts are placed in `scripts/ios/` at the repo root; they live in `apps/ios/scripts/`. `.vercelignore` at the repo root is not in the tree.
- Bundle id `com.shazlka.mutshabehat` and README title «متشابهات — iOS»; actual id `com.shazlka.qiraat`, display name «Qiraat».
- Branch `ios/phase1-reader` does not exist locally or on origin.
- "Every change ends with an entry in both `CHANGELOG.md` and the `# Changelog` of `CLAUDE.md`": iOS work uses only `apps/ios/CHANGELOG.md` (AGENTS.md §5).
- Phase table and appendices: Phase 2 (Supabase sign-in, notes, highlights, متشابهات layers) is not implemented as described; `Sources` has no auth or Supabase code, and `Config.xcconfig` still carries a `SUPABASE_ANON_KEY` nothing reads. Phase 3 says "fixtures, pages 1–20"; the app bundles a 604-page live snapshot. Out-of-scope items for Phase 1 (ornamental surah banner, network) now exist (`SurahBannerStyle`, live sync).
- Baseline "4 generator tests + 29 core tests + 7 UI tests" is stale.
- Matches: iOS 18, Swift 6, XcodeGen, `UIPageViewController` with the spine rule, resume key, the `MushafCore` and `Reader` files in the File Structure tree.
- Not verified: Tasks 2–11 code blocks and Appendix questions.

## docs/code-review-2026-10-20.md

Point-in-time review; only spot checks were run:
- P1-4 (hard-coded `/Users/amrelshazly` paths in app, core and tests): none remain.
- P0-3 (`sqlite3_bind_text(..., nil)`, 106 calls): one matching call remains.
- P1-6 (`try?`, 146 uses): now 158 in `Sources` and `MushafCore/Sources`.
- P2-3 sizes: `ReaderView` 757 → 831 lines (growing), `MushafPageView` 1087 → 1046.
- Test status (316 app unit tests, 9 + 3 failing) is stale.
- Not re-verified: P0-1, P0-2, P0-4, P1-1…P1-3, P1-5, P2-1, P2-2, P2-4…P2-6, P3.

## docs/handoff-2026-10-27-mutoon-and-symbols.md

- Commit `b0e2012f` exists and is contained in `origin/ios/main`; `ios/main` has moved on since.
- Not verified: dictionary sizes (35 / 9 / 44 symbols), commit table below `b0e2012f`.

## HANDOFF.md

- Header "Last updated: 2026-10-05" while the file carries sections dated up to 2026-10-27.
- "iOS v1.0 baseline: 100 core tests, 37 app tests": current tree has about 550 and 409. Tag `ios-v1.0` exists.
- "Qiraat UX round … not merged into `ios/main`": its features (`QiraatHub`, compare, search, page summary, usul index, notes) are in the `ios/main` tree.
- Not read: everything after line 60.

## docs/release/app-store-connect.md

Section 8 statuses no longer match the code:
- F1 (live sync hands out the owner's session cookie via `URLSession.shared`): `QiraatLiveSync.swift:114` now routes `/api/public/...` paths through `PublicLiveSyncSession`, and `AppEndpoints.swift` lists `api/public/v1/qiraat` and `api/public/v1/mutoon`. Non-public paths still use `URLSession.shared`. Re-assess F1 and the web-side `qiraat_is_editor()` claim.
- F3 (iCloud row in Release): the row is now behind a flag, `AppFeatures.iCloudSyncEnabled`, but `ICloudDatabaseSyncService.swift:78` sets it to `true`, so the row still ships. The doc's FAIL stands until the flag is off or the entitlement exists.
- F4 (direct web fetch): the trigger in `ICloudSyncSettingsView` is `#if DEBUG`.
- F6 (privacy manifest untracked): `Sources/PrivacyInfo.xcprivacy` is tracked.
- F7 (`ITSAppUsesNonExemptEncryption` missing): `project.yml` sets it to `false`.
- F5 is still accurate: `project.yml` copies `mutoon-sharh.json` unconditionally.
- The quoted `release_check.sh` result (4 FAIL, 3 WARN, 2026-10-28) predates these changes.
- Not verified: F2, F8, F9, owner items O1–O9, the 238 MB size, App Review notes steps 1–5.

## docs/release/content-rights-register.md

- Matches: snapshot totals (3,836 variants, 31,751 rulings, 8 rules), 4,406 references, 3,693 symbol marks, and the statement that the two "optional" copy steps include the commentary when the files exist.
- Not verified: upstream URLs, licence findings, bundle file sizes, the Release-product contents list.

## docs/release/accessibility-audit.md

- Not analysed.
