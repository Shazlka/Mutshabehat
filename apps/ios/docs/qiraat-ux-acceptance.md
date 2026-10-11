# Qiraat UX round: acceptance report

Date: 2026-10-11. Branch: `ios/qiraat-ux`. Numbers come from the final gate run on this branch (logs in the session scratchpad); iPhone = iPhone 18 Pro class simulator, iPad = iPad Pro 13-inch class simulator.

## Gate results

| Check | Result |
|---|---|
| `scripts/check_isolation.sh` | ok: only `apps/ios` differs |
| Data tests (`scripts/*` python) | passed |
| `MushafCore` (`swift test`) | 433 tests in 45 suites passed |
| `MutshabehatTests` (unit) | 260 executed, 0 failures |
| Release build + `scripts/release_guard.py` | build succeeded, "release guard ok" |
| Full UI suite, iPhone | 105 tests, 4 iPad-only skipped; 1 failure (fixed, see below) |
| Full UI suite, iPad | 105 tests; 2 failures (see below) |

Failures in the full runs and what was done:
- `ReaderUITests.testQiraatReaderPickerOpensFullScreenWithColoredReaders`: the test still expected the old label «نافع (روايتاه)». The redesigned picker says «روايتا الإمام نافع». Test updated; passes alone on iPhone and iPad.
- `QiraatFeaturesUITests.testLegendOpensListsReaderRowsAndCloses` (iPad only): the reader rows were not reached while the machine was loaded. Passes alone on iPhone and iPad. Treated as timing-sensitive; it should be re-run alone if it fails again.

## Features and proof

| Feature | Core / unit proof | UI proof |
|---|---|---|
| Colour key | `QiraatLegendTests` | `QiraatFeaturesUITests` legend flow |
| Top-bar menu and filter chip | `QiraatSyncStatusTests`, `QiraatContrastTests` | `QiraatTopBarUITests` (8) |
| Word sheet split, navigation, face numbers | `QiraatWordOrderTests` (11) | sheet next/previous flow, `QiraatUITests` (4) |
| Page summary | `QiraatPageSummaryTests` (13) | page-summary flow |
| Search | `QiraatSearchTests` (12) | search flow |
| Usul index | `UsulIndexTests` (8) | usul-index flow |
| Compare | `QiraatCompareTests` (19) | compare flow |
| Notes, favourites, backup | `QiraatNotesTests` (14) | favourite flow |
| Sync status and report link | `QiraatSyncStatusTests` (17) | in the sheet flows |
| Reader picker | `QiraatReaderPickerTests` | `ReaderUITests` picker tests, picker flow |
| Localization | `AppLocalizedTests` (4), `QiraatLocalizationTests` (3) | `QiraatLocalizationUITests` (2) |
| Accessibility at largest text size | | `QiraatSheetAccessibilityUITests` (1) |

## Data gaps found (web database, not changed here)

1. 5 rulings filed under page 1 belong to pages 3, 4 and 7: `r-l-2-12-2-48059d`, `r-l-2-12-3-5b5dd1`, `r-l-2-18-4-d818f0`, `r-l-2-42-7-a74fcc`, `r-l-2-42-7-be9e1f`.
2. 2 rulings at 2:33 word 16 have an empty `baseText`: `r-l-2-33-16-6c3ade` (`USUL_NAQL`), `r-l-2-33-16-b8236e` (`USUL_SAKT`).
3. 93 loci carry several ruling rows for one place (up to 11). The app aggregates rows with the same category and span into one place and keeps every row's authority details.

## Not verified

VoiceOver by hand, real-device haptics, iCloud sync between devices, a person's review of the ~170 English strings.
