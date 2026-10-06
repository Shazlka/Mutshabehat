# Memorization (حفظ القرآن): acceptance report

Date: 2026-10-06. Branch `ios/memorization` (not pushed, not merged). Spec:
`docs/specs/2026-10-06-memorization-design.md`. Each line says what proves it, or that it was **not verified here**.

Note on the checklist: the owner's original §50 list is not in the repository; the lines below follow the spec's
success criteria (§1) and the feature list of the owner's brief.

## Data and statistics

| Item | Verified by |
|---|---|
| Four ayah statuses, `isCurrentlyLearning` as a flag, review strength separate | `MemorizationModelsTests`, `MemorizationDatabaseTests` |
| Surah, page, juz and Quran figures derived from ayahs, never stored | `MemorizationStatisticsTests`, `MemorizationStoreTests` |
| Strict (متقن) and weighted percentages kept separate; weights 1 / 0.75 / 0.4 / 0 | `MemorizationStatisticsTests`, `MemorizationPolicy` |
| Page state = weakest ayah; page-equivalent by word count (604 total) | `MemorizationStatisticsTests`, `testMarkShowsTheWeakestLinkOfTheCurrentPage` |
| Brand-new install is all zeros, nothing crashes | `testEmptyInstallShowsZeros` |
| Hafs only: statistics depend on records and the Hafs index alone | `MemorizationIndependenceTests` (structural: no Qiraat input exists), `testMarkIsIdenticalWithTheQiraatLayerOn` |

## Updating

| Item | Verified by |
|---|---|
| Whole surah, ayah range, page range, juz, "from here to here" | `MemorizationSelectionTests`, `MemorizationPlannerTests`, `testRangeAcrossTwoAyatOpensTheUpdateSheetPreselected` |
| Typed target, Arabic-Indic digits, reversed and cross-surah ranges | `MemorizationSelectionTests`, `testTypedTargetPreselectsMode`, `testReversedRangeStillApplies` |
| Confirmation for a whole surah or more than 30 ayat; none for a small range | `testWholeSurahAsksConfirmation`, `testSmallRangeAppliesWithoutConfirmation` |
| Atomic apply, undo, refusal of a second undo, warning when a newer batch overlaps | `MemorizationApplyUndoTests`, `testHistoryWarnsWhenNewerBatchOverlaps` |
| Undo from the toast and from history | `testUndoFromToastRestores`, `testHistoryListsBatchAndUndoes` |
| Milestones (25 / 50 / 75 / 100 %, surah, juz, Quran) fire once | `MemorizationMilestoneTests`, `testMilestoneAppearsInTheToastWhenASurahIsFinished` |
| Completion state at 100 % keeps the data | `testCompleteSeedShowsTheCompletionState` |

## Screens

| Item | Verified by |
|---|---|
| Dashboard: two headline percentages, tiles, current position, status bar | `testDashboardShowsHeadlineAndTiles` |
| Surah list (search without diacritics, sort, filter) and surah detail with the ayah strip | `SurahListQueryTests`, `AyahRunTests`, `testSurahListFiltersAndSorts`, `testSurahDetailShowsRunsAndOpensMushaf` |
| Page grid with four shapes and legend; tap opens the Mushaf page | `testPageGridShowsStateShapesAndLegend`, `testTappingPageOpensMushafPage` |
| Ayah status list, due and learning filters | `AyahListQueryTests`, `testStatusRowOpensFilteredList`, `testDueForReviewListShowsMemorizedUnreviewedAyat` |
| History with undo | `MemorizationHistorySummaryTests`, `testHistoryListsBatchAndUndoes` |
| Progress chart for every range, gains for the week and month, streak, goals | `testChartRendersForEveryRange`, `testGainsGrowAfterAnUpdate`, `testStreakIsOneAfterAnUpdateAndZeroAfterUndo`, `testAddGoalShowsProgress`, `MemorizationGoalsTests`, `MemorizationHistoryTests` |

## Review

| Item | Verified by |
|---|---|
| Review ladder 1/3/7/14/30/60 days; a review never changes the status | `MemorizationReviewTests`, `testReviewDoesNotChangeTheStatus` |
| Due list, overdue surahs, start a review, undo a review | `DueReviewTests`, `testDueSectionListsMemorizedUnreviewedAyat`, `testReviewExcellentUpdatesTheDueCount`, `testReviewIsUndoable` |
| Suggestion «المقترح اليوم» | `testSuggestionShowsTheLearningRangeFirst` |

## Mushaf integration

| Item | Verified by |
|---|---|
| Page-status mark in the top banner, four states, hideable | `MemorizationReaderUITests` (`testBannerMarkShowsPageState`, `testNotMemorizedPageShowsNotMemorized`, `testMarkCanBeHidden`) |
| The mark never covers a control, with the controls hidden or shown | `testMarkIsVisibleWithChromeHiddenAndShownAndNeverCoversAControl` |
| iPad spread shows two marks | `testIPadSpreadShowsTwoMarks` (iPad run) |
| Page sheet: whole page or a checklist of ayat | `testPageSheetChangesTheWholePageAndTheMarkFollows`, `testPageSheetChecklistAppliesToChosenAyatOnly` |
| Ayah sheet keeps the bookmarks and adds memorization; range mode | `testLongPressOpensSheetWithBookmarkAndMemorization`, `testBookmarkStillWorksThroughTheSheet`, `testRangeModeShowsThePillAndCanBeCancelled` |
| Optional ayah marker, off by default | `testMarkerIsHiddenByDefaultAndShownWhenEnabled` |

## Backup and restore

| Item | Verified by |
|---|---|
| Backup set built in staging, verified, then moved; one set per day for 14 days; unchanged data skipped | `BackupCoreTests`, `BackupServiceTests` |
| Restore refuses corrupt, truncated, newer-format and half-downloaded sets and leaves the data untouched | `RestoreServiceTests` |
| Merge (default) and replace; safety copy before a restore | `MemorizationMergeTests`, `RestoreServiceTests` |
| A missing or unwritable folder never blocks an update | `testUpdateSucceedsWhenBackupFolderIsMissing` |
| Backup now, banner when no folder, backup then change then restore | `MemorizationBackupUITests` |
| JSON export and import | `RestoreServiceTests` (`testJSONExportImportRoundTrip`, `testJSONImportRefusesGarbageAndNewerFormats`), UI buttons exist; the share and file-picker sheets themselves were **not driven** |

## Performance (release, `swift test -c release`)

| Budget | Measured |
|---|---|
| Full snapshot of 3,000 records ≤ 20 ms | 1.6 ms |
| 604 page progresses ≤ 10 ms | 0.8 ms |
| Whole-Quran plan ≤ 300 ms | 0.7 ms |
| Whole-Quran SQLite apply ≤ 300 ms (debug build, simulator) | 134 ms (`testWholeQuranApplyIsFast`) |

## Regression

Full `make test` on the iPhone simulator, compared with the same tests on `ios/main`:

- `ios/main` alone already fails five UI tests: `QiraatUITests.testTheLayerToggleTurnsMarksOffAndIsRemembered`,
  `ReaderUITests.testLanguageSelectionChangesSettingsMenusToEnglish`,
  `ReaderUITests.testMutshabehatOpensAsAFullScreenReaderDestination`,
  `ReaderUITests.testQiraatReaderPickerOpensFullScreenWithColoredReaders`,
  `ReaderUITests.testSettingsOpensMutshabehatModule` (the brief said four; the baseline run found five).
- The first full run on this branch failed three more. They were real regressions caused by this work and are
  fixed: the banner mark covered the search icon, and the Memorization settings rows pushed the Developer rows
  off screen.

## Final runs (2026-10-06, branch `ios/memorization`)

- `make test` first run: unit tests all passed; UI failures were the five baseline ones plus three regressions this
  work caused (fixed, see above). After the fixes: all 50 memorization UI tests pass on the iPhone 18 Pro Max
  simulator (1 iPad-only test skipped there) and on the iPad Pro 13-inch (M5) simulator (one test, `testUpdateSucceedsWhenBackupFolderIsMissing`,
  passed on its own rerun after a first-launch timing flake in the full run).
- iPad-specific fixes found by that run: the update, ayah, page, review and restore sheets are now `presentationSizing(.page)`;
  the update sheet's count and Save button are pinned at the bottom; the two-page spread test rotates to landscape.
- A real bug found by the iPad run: `BackupController.needsAttention` wrote observed state while the dashboard was
  rendering, which kept the app busy and made every UI query wait 60 s. Fixed.
- `scripts/check_isolation.sh`: `isolation ok`. `make release-guard`: `release guard ok`.
- Not re-run after the last fixes: the full `make test-ipad` (every Reader/Qiraat UI test on iPad). Only the
  memorization suites were run on iPad.

## Not verified here

- Real iCloud Drive behaviour on the iPhone: evicted (not downloaded) files, a signed-out account, coordination
  with other devices. The simulator only exercises the host folder path.
- Real-device haptics (milestone feedback) and the optional ayah-marker glyph size on a device.
- VoiceOver was checked only through accessibility labels in UI tests, not with a screen reader.
- The page-state weakest-link rule is a judgement call: a page with one unmemorized ayah reads «غير محفوظ»;
  the ayah mix beside the mark is the mitigation (one function to change, `MemorizationStatisticsService.pageProgress`).
