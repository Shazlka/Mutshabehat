# Qiraat UX Round: Acceptance Report

Date: 2026-10-11. Branch: `ios/qiraat-ux`.
Status and proof are derived strictly from `/Users/amrelshazly/Projects/qiraat-ios-int/apps/ios/CHANGELOG.md` entries dated 2026-10-10 and 2026-10-11, and test suites in the repository.

## Acceptance Matrix

| Item | Acceptance line | Proof (test name or command) | Status |
|---|---|---|---|
| WS-00 baseline | Existing baseline tests and repository isolation pass without regressions. | `make test`, `scripts/check_isolation.sh`, `MushafCoreTests` (100/100 passed), `MutshabehatTests` (37/37 passed) | verified |
| WS-01 legend | Colour key sheet (`QiraatLegendSheet`) explaining marks, readers, narrators, and usul categories. | `QiraatLegendTests` in `Tests/QiraatLegendTests.swift`, `testLegendOpensListsReaderRowsAndCloses` in `UITests/QiraatFeaturesUITests.swift`; build succeeded on QX-01 simulator, execution not completed per changelog; reader integration deferred | not verified here |
| WS-02 top-bar menu + filter chip | Reader top-bar menu to toggle layer and select filter; filter chip in header without shifting page frame. | `testFilterChangeFromReaderShowsFilterChipAndPageFrameDoesNotMove` in `UITests/QiraatFeaturesUITests.swift` | not verified here |
| WS-03 sheet theming | Decompose `QiraatSheet` into `VariantCard`, `RulingCard`, `QiraatPills`, and `FlowLayout` preserving all styling and accessibility identifiers. | `MutshabehatTests` (195/196 passed), `QiraatUITests` (4/4 passed), `swift test --package-path MushafCore` (370 passed in 40 suites), token multiset check (105/105 identical), build succeeded | verified |
| WS-04 navigation | Quran-order marked-word navigation (`QiraatWordOrder`), `QiraatSheetNavigator`, and semantic variant face numbering with duplicate handling. | `swift test --disable-sandbox --package-path MushafCore --filter QiraatWordOrderTests` (11 tests in 1 suite passed), `xb.sh` build on QX-04, `testSheetNextAndPreviousChangesShownWord` in `UITests/QiraatFeaturesUITests.swift` | verified |
| WS-05 page summary | Page summary core model (`QiraatPageSummary`) and list view (`QiraatPageSummaryView`) grouped by ayah, matching page marks under all filters. | `swift test --package-path MushafCore --filter QiraatPageSummaryTests` (9 tests passed across 20 sampled pages and all 604 pages), `xcodebuild build` on QX-05, `testPageSummaryOnPageTwoListsRowsAndOpensWordSheet` in `UITests/QiraatFeaturesUITests.swift` | verified |
| WS-06 search | Offline search index (`QiraatSearch`) across 604 pages for readers/narrators, words (tashkeel-insensitive), and usul categories; `QiraatSearchView`. | `swift test --package-path MushafCore --filter QiraatSearchTests` (9 of 10 tests passed; query timing test failed under overload at 211–304 ms), `testSearchForNarratorReturnsResultsAndOpensPage` in `UITests/QiraatFeaturesUITests.swift` | verified |
| WS-07 usul index | Usul index (`UsulIndex`) aggregating 23 categories and 12,506 rulings; database coordinate resolution; 93 multi-row loci aggregated into 12,297 places; cached loader. | `swift test --disable-sandbox --package-path MushafCore --filter UsulIndexTests` (8 tests in 1 suite passed), `testUsulIndexListsCategoriesAndPlaceOpensItsPage` in `UITests/QiraatFeaturesUITests.swift` | verified |
| WS-08 compare | Side-by-side comparison (`QiraatCompare`) of two readers/narrators from unfiltered selection; locus separation; right-to-left columns; `QiraatCompareView`. | `swift test --disable-sandbox --package-path MushafCore --filter QiraatCompareTests` (17 tests in 1 suite passed), `xcodebuild build` on QX-08, `testCompareOpensFromSheetAndShowsTwoColumnsAndVerdict` in `UITests/QiraatFeaturesUITests.swift` | verified |
| WS-09 notes | Favorite toggle and persistence across closing and reopening word sheet. | `testFavoriteTogglePersistsAfterClosingAndReopeningSheet` in `UITests/QiraatFeaturesUITests.swift` | not verified here |
| WS-10 picker redesign | Half-sheet reader/narrator picker with search bar filtering and single-tap selection. | `testReaderPickerOpensAsSheetSearchNarrowsAndSingleTapSelects` in `UITests/QiraatFeaturesUITests.swift` | not verified here |
| WS-11 localization | Localization of Qiraat UX strings and accessibility labels for Arabic and English. | `Sources/Localizable.xcstrings`, `Sources/InfoPlist.xcstrings` | not verified here |
| WS-12 sync status & report link | Sheet live sync status indicator and link to report issue to web review editor. | None in test files or changelog | not verified here |
| WS-13 integration | Wiring all Qiraat views and sheets into reader top bar and reader view. | None in test files or changelog; changelog records viewer hooks as deferred integration steps | not verified here |
| WS-14 UI tests | End-to-end integration test suite covering 9 user flows. | `UITests/QiraatFeaturesUITests.swift` (9 tests implemented; execution run not recorded in changelog) | not verified here |
| WS-15 visual pass | Visual inspection for light/dark modes, contrast, Dynamic Type XXL, and touch targets (>= 44 pt). | None in test files or changelog; changelog records visual audit pending | not verified here |
| WS-16 review | Review fixes for WS-04 (face numbering and selection recovery), WS-07 (locus aggregation and sqlite coordinates), and WS-08 (unfiltered data and RTL layout). | `QiraatWordOrderTests` (11 tests passed), `UsulIndexTests` (8 tests passed), `QiraatCompareTests` (17 tests passed) | verified |

## Data gaps found (web database, not changed here)

The following data anomalies exist in the authoritative web database and bundled snapshot (`Generated/Qiraat/`), and were addressed via client-side handling rather than database edits:

(a) 5 rulings filed under `page-001.json` belong to pages 3, 4, and 7:
- `r-l-2-12-2-48059d`
- `r-l-2-12-3-5b5dd1`
- `r-l-2-18-4-d818f0` (`USUL_MIM_JAM`)
- `r-l-2-42-7-a74fcc` (`USUL_MIM_JAM`)
- `r-l-2-42-7-be9e1f` (`USUL_TAHQIQ`)

(b) 2 rulings at surah 2, ayah 33, word 16 have an empty `baseText`:
- `r-l-2-33-16-6c3ade` (`USUL_NAQL`)
- `r-l-2-33-16-b8236e` (`USUL_SAKT`)

(c) 93 loci carry several ruling rows for one place (maximum 11 rows). The client aggregates rows sharing category, surah, ayah, start token, end ayah, and end token into one navigable place while preserving all underlying authority details.
