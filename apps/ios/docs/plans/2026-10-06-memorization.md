# Memorization (حفظ القرآن) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Hafs-only memorization module to the Qiraat iOS app: ayah-level status, statistics by ayah/surah/page/juz, bulk update with confirmation and undo, review, goals, a dashboard, a four-state page mark in the reader's top banner, and backup of all app data to an iCloud Drive folder with JSON export/import.

**Architecture:** Pure logic (models, `QuranIndex`, statistics, planner, history analytics, review, merge, backup helpers) in the `MushafCore` Swift package, tested with Swift Testing against the real `Generated/mushaf.sqlite`. Persistence is a new raw-SQLite `MemorizationDatabase` (sparse ayah table + append-only change log) in the app target, wrapped by an observable `MemorizationStore`. SwiftUI screens in `Sources/Memorization/`, small additive reader edits in `Sources/Reader/`, backup/restore in `Sources/Backup/`.

**Tech Stack:** Swift 6, SwiftUI, Swift Charts, SQLite3 (raw, WAL), CryptoKit, Swift Testing (core), XCTest/XCUITest (app), XcodeGen. iOS 18 minimum.

**Spec:** `apps/ios/docs/specs/2026-10-06-memorization-design.md` (read it first; section numbers below, `§n`, refer to it).

## Global Constraints

- Work on branch `ios/memorization`; every file under `apps/ios/`; `scripts/check_isolation.sh` must print `isolation ok` before every commit; never push; never sign in or enter credentials.
- Commits: `GIT_AUTHOR_NAME=Shazlka GIT_AUTHOR_EMAIL=amr.eshazly@gmail.com GIT_COMMITTER_NAME=Shazlka GIT_COMMITTER_EMAIL=amr.eshazly@gmail.com git commit -m "iOS: …"`; no model names or attribution trailers in commits or code comments. Written `COMMIT "msg"` below. Every task's commit also updates the dated entry for this module at the top of `apps/ios/CHANGELOG.md` (newest first, never the root changelog).
- Hafs only: no Qiraat, reader or narrator field anywhere in memorization data, and no memorization code reads Qiraat data (§3.4). Memorization never touches `ReadingTracker` (§11.7).
- Status raw values (persisted, stable): `mastered = 1`, `memorizedWithErrors = 2`, `needsMushaf = 3`, `notMemorized = 4`. `ReviewStrength`: strong 1, good 2, needsReview 3, weak 4, notReviewed 5. An ayah with no stored row is `notMemorized` / `notReviewed`. `isCurrentlyLearning` is a flag, not a status.
- `MemorizationPolicy.standard` is the only home of numbers: weights mastered 1.0, withErrors 0.75, needsMushaf 0.4, notMemorized 0.0; interval ladder `[1,3,7,14,30,60]` days; failed review interval forgot 1 day, mistakes 2 days; confirmation threshold = a whole surah or `> 30` ayat; milestone percents `[25,50,75,100]`. No view contains a formula.
- Page status is weakest-link (§4.1): متقن › مع أخطاء › يحتاج المصحف › غير محفوظ. Page weight of an ayah = its `char_type='word'` count ÷ the page's word total (the 604 page totals sum to 604).
- **Dates are whole milliseconds everywhere they are stored or exported:** SQLite date columns are `INTEGER` epoch milliseconds (`Date.epochMilliseconds` / `Date(epochMilliseconds:)` in `MushafCore/Memorization/DatePrecision.swift`), JSON uses `BackupCoding` (ISO-8601 with milliseconds), and every `now` handed to a planner is first passed through `Date.normalizedToMilliseconds`, so a value compares equal after any round trip.
- All time-dependent functions take `now: Date` (and `calendar: Calendar` where days matter); nothing calls `Date()` inside core logic.
- UI copy is Arabic first with the app's existing `copy("ar", "en")` pattern (`language == .english`); every new screen has accessibility identifiers (named per task) and VoiceOver summaries; Dynamic Type; RTL.
- Swift 6 strict concurrency: raw-SQLite classes follow the existing `public final class … : @unchecked Sendable` + `NSLock` pattern of `QuranReadingDatabase`; UI-facing types are `@MainActor`.
- `make project` (xcodegen) regenerates the Xcode project; new files under `Sources/` and `MushafCore/Sources` are picked up automatically; `project.yml` changes only if a resource or setting is needed.
- Shorthand used below (run from `apps/ios`):
  - `CORETEST <Suite>` = `swift test --package-path MushafCore --filter <Suite>`
  - `APPTEST <Class>` = `xcodegen generate --quiet && xcodebuild -project Mutshabehat.xcodeproj -scheme Mutshabehat -derivedDataPath DerivedData -destination 'platform=iOS Simulator,name=iPhone 18 Pro Max' -collect-test-diagnostics never -only-testing:MutshabehatTests/<Class> test`
  - `UITEST <Class>` = the same with `-only-testing:MutshabehatUITests/<Class>`; add `-destination 'platform=iOS Simulator,name=iPad Pro 13-inch (M5)'` for iPad.
- Performance budgets (release, `swift test -c release --package-path MushafCore --filter PerformanceTests`): full snapshot ≤ 20 ms, 604 page progress ≤ 10 ms, whole-Quran update planning+apply ≤ 300 ms.

## Review Focus

Inputs the spec implies but its own tests would not exercise; each has a test in the named task.
1. **Brand-new install, zero records:** every percentage is 0, no divide-by-zero, the page mark reads غير محفوظ, no screen crashes (Task 4, Task 12).
2. **Reversed or cross-surah ranges, and Arabic-Indic digits in typed input** («البقرة ٢٥٥», from > to, a span across surahs) resolve in Mushaf order without error (Task 7).
3. **Undo after a later overlapping batch, and undoing an already-undone batch:** warns / refuses and never corrupts newer data (Task 9).
4. **Restoring a corrupt, truncated, newer-format or half-downloaded backup:** refused with a clear message, current data untouched; an unwritable or missing backup folder never blocks or fails a memorization update (Tasks 20, 21).
5. **Clock and calendar edges:** a streak across midnight and a DST change, two events with the same timestamp, and a device clock set backwards (Tasks 6, 10).

---

## Phase 0 — Baseline

### Task 0: Record the test baseline (no commit)

- [ ] **Step 1:** on `ios/memorization`, run `make test` and `make test-ipad` once and save the names of failing tests to `Reports/memorization-baseline.txt` (untracked; the four known pre-existing UI failures belong in it). Every later "no regression" check compares against this file.

---

## Phase 1 — Data foundation

### Task 1: Models and policy

**Files:**
- Create: `MushafCore/Sources/MushafCore/Memorization/MemorizationModels.swift`, `MemorizationPolicy.swift`
- Test: `MushafCore/Tests/MushafCoreTests/MemorizationModelsTests.swift`

**Interfaces:**
- Produces: `public enum MemorizationStatus: Int, Codable, CaseIterable, Sendable` and `ReviewStrength` and `ReviewResult` (`excellent = 1, good, mistakes, forgot`) with the raw values in Global Constraints; `public struct AyahMemorizationRecord: Codable, Equatable, Sendable` with `surah`, `ayah`, `status`, `reviewStrength`, `isCurrentlyLearning`, `firstMemorizedAt`, `lastStatusChangedAt`, `lastReviewedAt`, `nextReviewAt: Date?`, `reviewCount`, `successfulReviewCount`, `consecutiveSuccessfulReviews`, `errorCount: Int`, `updatedAt: Date`, `var key: AyahKey`, `static func blank(_ key: AyahKey, now: Date) -> Self`; `public enum BatchKind: String, Codable, Sendable { case update, review, undo, `import` }`; `public struct BatchRecord: Codable, Equatable, Sendable` (`id: UUID, createdAt: Date, kind: BatchKind, label: String, scopeJSON: String, ayahCount: Int, deviceID: String, countsForStreak: Bool, gainAyahs: Int, undoneAt: Date?, undoesBatchID: UUID?`); `public struct ChangeEvent: Codable, Equatable, Sendable` (`batchID: UUID, surah: Int, ayah: Int, at: Date, before: AyahMemorizationRecord?, after: AyahMemorizationRecord`, `var key: AyahKey`); `public struct MemorizationPolicy: Sendable` with `statusWeights: [MemorizationStatus: Double]`, `intervalLadderDays: [Int]`, `forgotIntervalDays: Int`, `mistakesIntervalDays: Int`, `confirmationAyahThreshold: Int`, `milestonePercents: [Int]`, `static let standard`, `func weight(_: MemorizationStatus) -> Double`.

- [ ] **Step 1: Write the failing tests** (`@Suite struct MemorizationModelsTests`): `statusRawValuesAreStable` (the four raw values 1…4, `ReviewStrength` 1…5); `blankRecordIsNotMemorized` (`blank(AyahKey(surah:1,ayah:1), now:)` has status `.notMemorized`, strength `.notReviewed`, learning false, all dates nil, counters 0); `recordCodableRoundTrip` (encode/decode with `JSONEncoder` using `.iso8601` equals the original); `changeEventCodableRoundTripWithNilBefore`; `policyStandardValues` (weights 1.0/0.75/0.4/0.0, ladder `[1,3,7,14,30,60]`, forgot 1, mistakes 2, threshold 30, milestones `[25,50,75,100]`).
- [ ] **Step 2: Run** `CORETEST MemorizationModelsTests` → FAIL (types undefined).
- [ ] **Step 3: Implement** the types above in the two files; `AyahMemorizationRecord` stores `surah`/`ayah` as ints (`AyahKey` is not `Codable`).
- [ ] **Step 4: Run** `CORETEST MemorizationModelsTests` → PASS.
- [ ] **Step 5: `COMMIT "memorization models and policy"`**

### Task 2: `QuranIndex`

**Files:**
- Create: `MushafCore/Sources/MushafCore/Memorization/QuranIndex.swift`
- Modify: `MushafCore/Sources/MushafCore/MushafDatabase.swift` (add the two query methods before the `// MARK: - Minimal statement helpers` line; `rows` is private so they must live in this file)
- Test: `MushafCore/Tests/MushafCoreTests/QuranIndexTests.swift`

**Interfaces:**
- Consumes: `MushafDatabase`, `AyahKey`, `openDatabase()` from `Support.swift`.
- Produces: `public struct AyahLayoutRow: Equatable, Sendable { key: AyahKey; page: Int; wordCount: Int }`; `MushafDatabase.ayahLayout() throws -> [AyahLayoutRow]` (SQL: `SELECT surah, ayah, MIN(page), SUM(char_type = 'word') FROM words GROUP BY surah, ayah ORDER BY surah, ayah`) and `MushafDatabase.pageJuzMap() throws -> [Int: Int]` (page → juz from `pages`); `public struct QuranIndex: Sendable` with `init(rows: [AyahLayoutRow], pageJuz: [Int: Int])`, `static func load(from: MushafDatabase) throws -> QuranIndex`, `totalAyahs: Int`, `ayahKeys: [AyahKey]` (Mushaf order), `ordinal(of: AyahKey) -> Int?`, `ayahCount(surah: Int) -> Int`, `page(of: AyahKey) -> Int?`, `ayat(onPage: Int) -> [AyahKey]`, `weight(of: AyahKey) -> Double` (word share of its page), `pages(ofSurah: Int) -> ClosedRange<Int>?`, `ayat(ofSurah: Int) -> [AyahKey]`, `juz(ofPage: Int) -> Int?`, `pages(ofJuz: Int) -> ClosedRange<Int>?`, `ayat(ofJuz: Int) -> [AyahKey]`, `ayat(inPages: ClosedRange<Int>) -> [AyahKey]`, `ayat(from: AyahKey, to: AyahKey) -> [AyahKey]` (inclusive, order-insensitive, crosses surahs).

- [ ] **Step 1: Write the failing tests** against the real DB: `totalIs6236`; `fatihaHasSevenAyatOnPageOne` (`ayahCount(surah:1) == 7`, `pages(ofSurah:1) == 1...1`); `ayatKursiIsOnPage42` (`page(of: AyahKey(surah:2, ayah:255)) == 42`); `pageWeightsSumTo604` (Σ over all keys of `weight(of:)` ≈ 604 within 1e-6, and for page 50 the weights of `ayat(onPage:50)` sum to 1); `everyAyahHasExactlyOnePage` (the union of `ayat(onPage:)` over 1…604 equals `ayahKeys`, no duplicates); `juzCoverAllPagesWithoutOverlap` (30 `pages(ofJuz:)` ranges, first starts at 1, each starts at previous end + 1, last ends 604); `ayat(ofJuz:30)` begins at 78:1; `spanCrossesSurahsInMushafOrder` (`ayat(from: 2:285, to: 3:2)` is `[2:285, 2:286, 3:1, 3:2]`) and `spanIsOrderInsensitive` (swapped arguments give the same result); `unknownKeyHasNoOrdinal` (`ordinal(of: AyahKey(surah:1, ayah:8)) == nil`).
- [ ] **Step 2: Run** `CORETEST QuranIndexTests` → FAIL.
- [ ] **Step 3: Implement** `ayahLayout`/`pageJuzMap` in `MushafDatabase.swift` and the struct; build dictionaries once in `init` (ordinal map, page → ayat, surah → ayat, juz → page range).
- [ ] **Step 4: Run** `CORETEST QuranIndexTests` → PASS; also `CORETEST MushafDatabaseTests` still PASS.
- [ ] **Step 5: `COMMIT "quran index for memorization"`**

### Task 3: `MemorizationDatabase` (schema, migrations, load)

**Files:**
- Create: `Sources/Memorization/MemorizationDatabase.swift`, `Sources/Memorization/MemorizationMigrations.swift`
- Test: `Tests/MemorizationDatabaseTests.swift`

**Interfaces:**
- Consumes: Task 1 types.
- Produces: `public final class MemorizationDatabase: @unchecked Sendable` with `init(url: URL? = nil, migrations: [MemorizationMigration] = MemorizationMigrations.all)` (default file `mushaf_memorization.sqlite` in Application Support, WAL, foreign keys on), `var fileURL: URL`, `var schemaVersion: Int`, `func loadRecords() -> [AyahKey: AyahMemorizationRecord]`, `func meta(_ key: String) -> String?`, `func setMeta(_ key: String, _ value: String)`, `var deviceID: String` (created once, stored in meta `device_id`); `struct MemorizationMigration { let version: Int; let apply: (OpaquePointer) throws -> Void }`; `enum MemorizationMigrations { static let all: [MemorizationMigration] }` where version 1 creates the tables of §8: `memorization_ayahs` (`PRIMARY KEY(surah, ayah)`, `status INTEGER CHECK(status BETWEEN 1 AND 4)`, `review_strength INTEGER CHECK(review_strength BETWEEN 1 AND 5)`, `is_learning`, four `INTEGER` epoch-millisecond date columns, four counters, `updated_at` INTEGER), `memorization_batches`, `memorization_events` (batch FK `ON DELETE CASCADE`, `surah`, `ayah`, `at`, `old_status`, `new_status`, `old_strength`, `new_strength`, `before_json`, `after_json`; indexes on `at`, `batch_id`, `(surah, ayah)`), `memorization_goals (id TEXT PRIMARY KEY, json TEXT)`, `memorization_meta (key PRIMARY KEY, value)`; `schema_version` kept in meta.

- [ ] **Step 1: Write the failing tests** (`MemorizationDatabaseTests: XCTestCase`, temp directory per test like `ReadingTests`): `freshDatabaseHasSchemaVersionOne`; `emptyDatabaseLoadsNoRecords`; `reopeningKeepsRows` (insert one row directly through a test-only `_insertRecordForTesting`, reopen with the same URL, `loadRecords()` returns it equal); `statusOutsideRangeIsRejectedByCheck` (inserting status 9 fails); `deviceIDIsStableAcrossReopen`; `olderFileIsMigrated` (create a DB with only migration 1 and one row, reopen passing `migrations: MemorizationMigrations.all + [MemorizationMigration(version: 2){ add column `note TEXT` }]` → `schemaVersion == 2` and the row is intact).
- [ ] **Step 2: Run** `APPTEST MemorizationDatabaseTests` → FAIL.
- [ ] **Step 3: Implement** with the existing raw-SQLite helpers' style (prepare/bind/step, one lock); run pending migrations in one transaction each, ascending, then write `schema_version`.
- [ ] **Step 4: Run** `APPTEST MemorizationDatabaseTests` → PASS.
- [ ] **Step 5: `COMMIT "memorization database and migrations"`** (changelog: phase 1 done).

---

## Phase 2 — Statistics

### Task 4: Statistics service: counts, percentages, surah, juz

**Files:**
- Create: `MushafCore/Sources/MushafCore/Memorization/MemorizationStatistics.swift`
- Test: `MushafCore/Tests/MushafCoreTests/MemorizationStatisticsTests.swift`

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces: `public enum SurahState: Sendable { case complete, partial, none }`; `public struct SurahProgress: Equatable, Sendable { surah, ayahCount, counts: [MemorizationStatus: Int], strictPercent: Double, learningPercent: Double, state: SurahState, isCompleteIncludingErrors: Bool }`; `public struct JuzProgress: Equatable, Sendable { juz, counts, strictPercent, learningPercent, isComplete: Bool }`; `public struct MemorizationSnapshot: Equatable, Sendable` with `totalAyahs`, `counts: [MemorizationStatus: Int]`, `strictPercent`, `learningPercent` (0…100), `canReciteCount`, `surahs: [SurahProgress]` (114), `juz: [JuzProgress]` (30), `completedSurahs`, `partialSurahs`, `completeIncludingErrorsSurahs`, `completedJuz`, and (Task 5) `pages`, `pagesFullyMastered`, `pageEquivalentMastered`; `public enum MemorizationStatisticsService { static func snapshot(records: [AyahKey: AyahMemorizationRecord], index: QuranIndex, policy: MemorizationPolicy = .standard) -> MemorizationSnapshot }`. Percent = value ÷ `totalAyahs` × 100; a missing record counts as `.notMemorized`.

- [ ] **Step 1: Write the failing tests** (real index; helper `records(_ keys: [AyahKey], _ status:)`): `emptyRecordsGiveZeroEverywhere` (**Review Focus 1**: strict 0, learning 0, `counts[.notMemorized] == 6236`, 114 surahs all `.none`, no NaN); `fatihaMasteredIsOneCompleteSurah` (7 mastered: `completedSurahs == 1`, surah 1 strict 100, `counts[.mastered] == 7`, `strictPercent ≈ 7/6236*100`); `oneErrorBreaksCompleteButNotIncludingErrors` (6 mastered + 1 withErrors: `state == .partial`, `isCompleteIncludingErrors == true`, `completedSurahs == 0`, surah strict ≈ 85.714, learning ≈ (6 + 0.75)/7*100); `weightedPercentUsesPolicy` (1 mastered, 1 withErrors, 1 needsMushaf, 1 notMemorized in al-Fatiha → learning = (1+0.75+0.4)/7*100; a custom `MemorizationPolicy` with other weights changes it); `canReciteCountsMasteredAndErrors`; `wholeJuzThirtyIsComplete` (all `ayat(ofJuz:30)` mastered → `completedJuz == 1`, juz 30 `isComplete`).
- [ ] **Step 2: Run** `CORETEST MemorizationStatisticsTests` → FAIL.
- [ ] **Step 3: Implement** in a single pass over `index.ayahKeys`, accumulating per surah and per juz via the index.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: `COMMIT "memorization statistics: counts, surah, juz"`**

### Task 5: Page progress: weakest-link state, ayah mix, page-equivalents

**Files:**
- Modify: `MemorizationStatistics.swift` (add the page types and fill the page fields of the snapshot)
- Test: extend `MemorizationStatisticsTests.swift`

**Interfaces:**
- Produces: `public struct PageMix: Equatable, Sendable { counts: [MemorizationStatus: Int]; fractions: [MemorizationStatus: Double] /* by word-share, sum 1 */; ayahCount: Int; masteredAyahs: Int }`; `public struct PageProgress: Equatable, Sendable { page: Int; state: MemorizationStatus; mix: PageMix }`; `MemorizationStatisticsService.pageProgress(page: Int, records:, index:) -> PageProgress`; snapshot fields `pages: [PageProgress]` (604), `pagesFullyMastered: Int` (pages with `state == .mastered`), `pageEquivalentMastered: Double` (Σ over mastered ayat of `index.weight(of:)`).

- [ ] **Step 1: Write the failing tests:** `weakestLinkStates` (page 50: all ayat mastered → `.mastered`; one withErrors → `.memorizedWithErrors`; plus one needsMushaf → `.needsMushaf`; plus one notMemorized → `.notMemorized`; no records → `.notMemorized`); `mixFractionsSumToOneAndMatchWeights`; `pagesFullyMasteredAgreesWithStates` (random-ish deterministic fill: `snapshot.pagesFullyMastered == snapshot.pages.filter{$0.state == .mastered}.count`); `pageEquivalentOfWholeQuranIs604` (all mastered → ≈ 604, `pagesFullyMastered == 604`); `pageWithTwoSurahsCountsBoth` (page 604 holds 112:1…114:6: mastering only 112 gives a `.notMemorized` page whose `mix.masteredAyahs == 4`; mastering all of it gives `.mastered`); `snapshotBudget` is added in Task 24.
- [ ] **Step 2: Run** `CORETEST MemorizationStatisticsTests` → FAIL on the new tests.
- [ ] **Step 3: Implement** the page pass in the same loop (accumulate per page weights); state = the maximum `rawValue` among the page's ayat statuses (4 is weakest).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: `COMMIT "memorization page progress and weakest-link state"`**

### Task 6: History analytics (past state, gains, series)

**Files:**
- Create: `MushafCore/Sources/MushafCore/Memorization/MemorizationHistory.swift`
- Test: `MushafCore/Tests/MushafCoreTests/MemorizationHistoryTests.swift`

**Interfaces:**
- Produces: `public struct PeriodGains: Equatable, Sendable { newAyat: Int; pageEquivalents: Double; surahsCompleted: Int }`; `public enum ProgressRange: Sendable { case days7, days30, months3, months6, year, all }`; `public struct ProgressPoint: Equatable, Sendable { date: Date; strictPercent: Double; learningPercent: Double }`; `public enum HistoryAnalytics { static func records(asOf: Date, current: [AyahKey: AyahMemorizationRecord], events: [ChangeEvent]) -> [AyahKey: AyahMemorizationRecord]; static func gains(from: Date, to: Date, current:, events:, index: QuranIndex, policy: MemorizationPolicy = .standard) -> PeriodGains; static func series(range: ProgressRange, now: Date, current:, events:, index:, policy: = .standard, calendar: Calendar) -> [ProgressPoint] }`. Rule: the state at `date` is `current` with every event whose `at > date` rolled back (per key, the earliest such event's `before`; `nil` removes the record); events are accepted in any order and ties on `at` keep input order. `newAyat` = ayat whose status was `notMemorized`/`needsMushaf` at `from` and `mastered`/`withErrors` at `to` (net). Series steps: daily for 7/30 days, weekly for 3/6 months, monthly for year, and from the first event month for `all`; computed in one backwards pass.

- [ ] **Step 1: Write the failing tests:** `rollbackRestoresPriorRows`; `removesRecordCreatedAfterDate` (before nil); `twoEventsSameTimestampKeepInputOrder` (**Review Focus 5**); `deviceClockBackwardsEventsStillRollBack` (an event with `at` earlier than the preceding one is handled by sorting, not by trusting order); `gainsAreNet` (an ayah that goes notMemorized → mastered → notMemorized inside the period counts 0); `gainsCountSurahsCompletedInPeriod` (al-Fatiha mastered inside the period → 1, already complete before → 0); `pageEquivalentsOfGains` (mastering all ayat on page 50 → ≈ 1.0); `seriesEqualsRecomputation` (for 10 points, `series` strict % equals `MemorizationStatisticsService.snapshot(records: records(asOf:…)).strictPercent`); `seriesOnEmptyHistoryIsFlatZero`.
- [ ] **Step 2: Run** `CORETEST MemorizationHistoryTests` → FAIL.
- [ ] **Step 3: Implement** (sort events descending by `at`, walk backwards over the sample dates keeping a mutable record dictionary and running mastered/weighted sums).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: `COMMIT "memorization history analytics"`** (changelog: phase 2 done).

---

## Phase 3 — Update engine

### Task 7: Selections and the text parser

**Files:**
- Create: `MushafCore/Sources/MushafCore/Memorization/MemorizationSelection.swift`
- Test: `MushafCore/Tests/MushafCoreTests/MemorizationSelectionTests.swift`

**Interfaces:**
- Consumes: `QuranIndex`; the Arabic normaliser used by `QuranSearch.swift` (find it with `grep -n "normaliz\|folded" MushafCore/Sources/MushafCore/QuranSearch.swift MushafCore/Sources/MushafCore/QiraatPresentation.swift`; reuse it, do not write a second one).
- Produces: `public enum MemorizationSelection: Equatable, Sendable { case surah(Int), ayahRange(surah: Int, from: Int, to: Int), pageRange(ClosedRange<Int>), juz(Int), ayat(Set<AyahKey>), span(from: AyahKey, to: AyahKey) }` with `func resolve(in: QuranIndex) -> [AyahKey]` (Mushaf order, de-duplicated, clamped to valid values, empty if nothing valid) and `func isWholeSurah(in: QuranIndex) -> Bool`; `public enum SelectionTarget: Equatable, Sendable { case selection(MemorizationSelection), surahDetail(Int), page(Int), ayah(AyahKey), juz(Int) }`; `public enum SelectionParser { static func parse(_ text: String, surahNames: [Int: String], index: QuranIndex) -> SelectionTarget? }` (the index validates ayah numbers); `SelectionTarget.asSelection: MemorizationSelection` converts a target into the selection an update sheet preselects accepting «يس», «سورة يس», «البقرة 255», «البقرة ٢٥٥», «صفحة 42», «ص 42», «الجزء 30», with Arabic-Indic and Latin digits, diacritics and alef variants ignored.

- [ ] **Step 1: Write the failing tests:** `surahResolvesAllAyat` (`.surah(36)` → 83); `ayahRangeIsInclusive` (2:1…20 → 20); `reversedRangeIsOrderInsensitive` (**Review Focus 2**: from 20 to 1 equals 1…20); `rangeBeyondSurahIsClamped` (`.ayahRange(1, 1, 99)` → 7); `pageRangeResolvesAyatOnThosePages` (pages 582…589 equals `ayat(inPages:)`; matches `index.ayat(inPages:)` count); `juzThirtyIsPageRange` ; `spanAcrossSurahs`; `invalidSurahResolvesEmpty` (`.surah(0)`, `.surah(115)`); `wholeSurahDetection` (`.ayahRange(1,1,7)` is whole, `.ayahRange(1,1,6)` is not); parser: `parsesNameAndAyah` («البقرة 255» → `.ayah(2:255)`), `parsesArabicIndicDigits` («البقرة ٢٥٥» same), `parsesBareSurahName` («يس» → `.surahDetail(36)`), `parsesPageAndJuz` («صفحة 42» → `.page(42)`, «الجزء 30» → `.juz(30)`), `ignoresDiacriticsAndAlefVariants` («ٱلبَقَرَة 255»), `rejectsNonsense` («xyz», «صفحة 700», «البقرة 300» → nil).
- [ ] **Step 2: Run** `CORETEST MemorizationSelectionTests` → FAIL.
- [ ] **Step 3: Implement.** Match surah names by normalised exact match on the app's surah names (`surahNames`), then prefix.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: `COMMIT "memorization selections and parser"`**

### Task 8: Planner, confirmation rule, milestones

**Files:**
- Create: `MushafCore/Sources/MushafCore/Memorization/MemorizationPlanner.swift`
- Test: `MushafCore/Tests/MushafCoreTests/MemorizationPlannerTests.swift`

**Interfaces:**
- Consumes: Tasks 1, 2, 4, 7.
- Produces: `public struct AyahChange: Equatable, Sendable { key: AyahKey; before: AyahMemorizationRecord?; after: AyahMemorizationRecord }`; `public struct BatchPlan: Equatable, Sendable { kind: BatchKind; label: String; scopeJSON: String; selectionCount: Int; changes: [AyahChange]; var unchangedCount: Int { selectionCount - changes.count }; countsForStreak: Bool; gainAyahs: Int }`; `public enum Milestone: Hashable, Sendable { case surahCompleted(Int), juzCompleted(Int), percent(Int), quranCompleted }`; `public enum MemorizationPlanner { static func planUpdate(selection:, label: String, status: MemorizationStatus, learning: Bool?, records:, index:, now: Date) -> BatchPlan; static func needsConfirmation(selection:, plan: BatchPlan, index:, policy: = .standard) -> Bool; static func milestones(before: MemorizationSnapshot, after: MemorizationSnapshot, policy: = .standard) -> [Milestone] }`. Rules (§5.2): no-ops (same status and same learning flag) are dropped; `firstMemorizedAt` set the first time status reaches `.mastered`/`.memorizedWithErrors` (never cleared); `lastStatusChangedAt` and `updatedAt` = `now` only when status changes; becoming `.mastered` clears the learning flag unless `learning` is explicitly `true`; `learning == nil` leaves the flag unchanged; `countsForStreak` and `gainAyahs` = ayat that moved up into mastered/with-errors (from needsMushaf/notMemorized); `needsConfirmation` = whole surah, or `selectionCount > policy.confirmationAyahThreshold`; milestones fire when a surah/juz goes incomplete → complete, when strict % crosses 25/50/75/100, and `.quranCompleted` at 100.

- [ ] **Step 1: Write the failing tests:** `plansOnlyChangedAyat` (whole of al-Fatiha, 2 already mastered → `changes.count == 5`, `unchangedCount == 2`, `selectionCount == 7`); `sameStatusIsNoOpEvenWithLearningNil`; `firstMemorizedAtIsSetOnceAndKept` (notMemorized → withErrors sets it; → mastered keeps the original; → notMemorized keeps it); `masteredClearsLearningFlag` and `explicitLearningTrueKeepsIt`; `downgradeDoesNotCountForStreakOrGain` (`countsForStreak == false`, `gainAyahs == 0`); `upgradeCountsForStreakAndGain`; `confirmationRule` (whole surah → true; 30 ayat → false; 31 → true; 5 ayat of a surah → false); `milestonesFireOnceOnCompletion` (Fatiha complete → `[.surahCompleted(1)]`; applying the same snapshot twice → `[]`); `percentMilestonesAtThresholds` (snapshot strict 24.9 → 25.1 gives `.percent(25)`); `wholeQuranGivesQuranCompleted`; `perfPlanWholeQuran` (planning the whole Quran runs and returns 6236 changes).
- [ ] **Step 2: Run** `CORETEST MemorizationPlannerTests` → FAIL.
- [ ] **Step 3: Implement** as pure functions. `scopeJSON` is a small JSON of the selection (used by history and backup).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: `COMMIT "memorization planner, confirmation and milestones"`**

### Task 9: Apply and undo in the database

**Files:**
- Modify: `Sources/Memorization/MemorizationDatabase.swift` (add the methods; keep it under ~600 lines, else split `MemorizationDatabase+History.swift`)
- Test: `Tests/MemorizationApplyUndoTests.swift`

**Interfaces:**
- Produces on `MemorizationDatabase`: `func apply(_ plan: BatchPlan) throws -> BatchRecord` (one `BEGIN IMMEDIATE` transaction writing the ayah rows, the batch row, and one event per change with `before_json`/`after_json`/status/strength columns; rolls back entirely on any error); `func batches(limit: Int, offset: Int) -> [BatchRecord]` (newest first); `func events(since: Date?) -> [ChangeEvent]`; `func events(batchID: UUID) -> [ChangeEvent]`; `func undoConflicts(batchID: UUID) -> [BatchRecord]` (later, non-undone batches that touched any of the same ayat); `func undo(batchID: UUID, force: Bool, now: Date) throws -> BatchRecord` — restores each event's `before` (deleting the row when `before == nil`), marks the batch `undone_at = now`, records an `undo` batch referencing it; throws `MemorizationError.alreadyUndone`, `.hasNewerChanges([BatchRecord])` (when conflicts exist and `force == false`), `.notFound`; `enum MemorizationError: LocalizedError` with Arabic descriptions.

- [ ] **Step 1: Write the failing tests** (XCTest, real `QuranIndex` via `MushafLibrary` is not needed: build plans with `MemorizationPlanner` over a small hand-made `QuranIndex(rows:pageJuz:)`): `applyWritesStateBatchAndEvents` (counts match, `loadRecords()` equals the plan's `after`s); `applyIsAtomic` (a plan whose last change has an invalid status 9 → throws; `loadRecords()` empty and no batch row); `wholeQuranApplyIsOneTransaction` (6236 changes apply and `batches(limit: 10).count == 1`); `undoRestoresExactPriorRows` (including `firstMemorizedAt`, counters, and removing rows that did not exist before); `undoTwiceIsRefused` (**Review Focus 3**: second call throws `.alreadyUndone`, data unchanged); `undoWithNewerOverlappingBatchWarns` (apply A on 1:1…7, then B on 1:3…4; `undo(A, force: false)` throws `.hasNewerChanges([B])` and nothing changes; `force: true` proceeds); `undoWithNewerBatchOnOtherAyatDoesNotWarn`; `undoIsRecordedAsABatchAndStaysVisible` (the original batch is listed with `undoneAt != nil`, an `undo` batch exists with `undoesBatchID`); `undoneBatchNoLongerCountsForStreak` (the batch's streak credit is excluded by Task 10's query, asserted there).
- [ ] **Step 2: Run** `APPTEST MemorizationApplyUndoTests` → FAIL.
- [ ] **Step 3: Implement** with prepared statements reused inside the transaction; JSON via `JSONEncoder` (`.iso8601`).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: `COMMIT "memorization apply and undo"`**

### Task 10: Review engine, streak, suggestion

**Files:**
- Create: `MushafCore/Sources/MushafCore/Memorization/MemorizationReview.swift`, `MemorizationStreak.swift`, `MemorizationSuggestion.swift`
- Modify: `MemorizationPlanner.swift` (add `planReview`), `Sources/Memorization/MemorizationDatabase.swift` (add `qualifyingDays`)
- Test: `MushafCore/Tests/MushafCoreTests/MemorizationReviewTests.swift`; `Tests/MemorizationStreakDatabaseTests.swift`

**Interfaces:**
- Produces: `public enum ReviewEngine { static func apply(_ result: ReviewResult, to: AyahMemorizationRecord, now: Date, policy: = .standard) -> AyahMemorizationRecord; static func displayedStrength(of: AyahMemorizationRecord, now: Date) -> ReviewStrength; static func isDue(_: AyahMemorizationRecord, now: Date) -> Bool }`; `MemorizationPlanner.planReview(selection:, label:, result: ReviewResult, records:, index:, now:, policy: = .standard) -> BatchPlan` (kind `.review`, skips ayat with status `.notMemorized`, `countsForStreak = true` when it changed anything); `public struct StreakSummary: Equatable, Sendable { current: Int; longest: Int }`; `public enum StreakCalculator { static func summary(qualifyingDays: Set<Date> /* startOfDay */, now: Date, calendar: Calendar) -> StreakSummary }` (current counts consecutive days ending today, or yesterday if today has none); `public enum Suggestion: Equatable, Sendable { case continueLearning(surah: Int, remaining: Int), review(surah: Int, daysSinceReview: Int?) }`; `public enum SuggestionEngine { static func suggest(records:, index:, now:, calendar:) -> Suggestion? }`; on the database `func qualifyingDays(calendar: Calendar) -> Set<Date>` (local start-of-day of every non-undone batch with `counts_for_streak = 1`).
- Rules: strength mapping excellent→strong, good→good, mistakes→needsReview, forgot→weak; `reviewCount` +1; excellent/good: `successfulReviewCount` +1, `consecutiveSuccessfulReviews` +1; else consecutive = 0 and `errorCount` +1; `lastReviewedAt = now`; `nextReviewAt = now + ladder[min(consecutive, 6) − 1] days` after success, `+1 day` (forgot) or `+2 days` (mistakes) after failure; status never changes. Displayed strength: never reviewed & memorized → `.notReviewed`; not past `nextReviewAt` → stored; past it → at least `.needsReview`; past by more than twice its last interval → `.weak`. Due = memorized (mastered/withErrors) and (`nextReviewAt == nil` or `≤ now`). Suggestion: first a currently-learning range with ayat remaining (smallest surah number first), else the memorized surah with the largest average overdue days (ties → Mushaf order), else nil.

- [ ] **Step 1: Write the failing tests:** ladder (`consecutive` 1…7 → next review +1,+3,+7,+14,+30,+60,+60 days from a fixed `now`); `failureResetsConsecutiveAndSetsShortInterval` (forgot → +1 day, mistakes → +2); `reviewNeverChangesStatus`; `agedStrengthStaysMasteredButShowsWeak` (status `.mastered`, last review 40 days ago with interval 7 → `.weak`); `neverReviewedMemorizedIsDueAndNotReviewed`; `notMemorizedIsNotDue`; `planReviewSkipsUnmemorized`; streak: `consecutiveDaysCount`, `yesterdayKeepsStreakAlive`, `gapBreaksStreak`, `longestIsTracked`, `streakAcrossMidnightAndDST` (**Review Focus 5**: days built with `Calendar(identifier: .gregorian)` in `America/New_York` across the March DST change count as consecutive); `suggestionPrefersLearningRange`, `suggestionFallsBackToMostOverdueSurah`, `suggestionNilWhenNothingMemorized`; database: `undoneBatchesDoNotQualify`, `downgradesAndImportsDoNotQualify`, `openingModuleCreatesNoBatch`.
- [ ] **Step 2: Run** `CORETEST MemorizationReviewTests` and `APPTEST MemorizationStreakDatabaseTests` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** both → PASS.
- [ ] **Step 5: `COMMIT "memorization review, streak and suggestion"`**

### Task 11: `MemorizationStore`

**Files:**
- Create: `Sources/Memorization/MemorizationStore.swift`
- Test: `Tests/MemorizationStoreTests.swift`

**Interfaces:**
- Consumes: Tasks 3, 4, 5, 8, 9, 10.
- Produces: `@MainActor @Observable final class MemorizationStore` with `init(database: MemorizationDatabase, index: QuranIndex, clock: @escaping () -> Date = Date.init, calendar: Calendar = .current, defaults: UserDefaults = .standard)`; `private(set) var version: Int` (bumped after every successful write); `var snapshot: MemorizationSnapshot` (cached, recomputed lazily when `version` changed); `func status(of: AyahKey) -> MemorizationStatus`; `func pageProgress(_ page: Int) -> PageProgress`; `func plan(_ selection: MemorizationSelection, label: String, status: MemorizationStatus, learning: Bool?) -> BatchPlan`; `func needsConfirmation(selection:, plan:) -> Bool`; `struct ApplyResult { let batch: BatchRecord; let milestones: [Milestone] }`; `func apply(_ plan: BatchPlan) throws -> ApplyResult` (also sets `quran_completed_at` once and records milestones in `milestones_seen`, returning only unseen ones); `func undo(batchID: UUID, force: Bool) throws`; `func review(_ selection: MemorizationSelection, label: String, result: ReviewResult) throws -> ApplyResult`; `var currentPosition: (from: AyahKey, to: AyahKey)?` get/set (meta); `var streak: StreakSummary`; `var suggestion: Suggestion?`; `var showsBannerMark: Bool` (default `true`, key `memorization:show-banner-mark:v1`) and `var showsAyahMarker: Bool` (default `false`, key `memorization:show-ayah-marker:v1`); `var quranCompletedAt: Date?`.

- [ ] **Step 1: Write the failing tests:** `versionBumpsOnApplyAndUndo`; `snapshotRefreshesAfterApply` (strict % changes); `pageProgressReflectsStatuses` (page 1 after mastering al-Fatiha is `.mastered`); `newInstallPageMarkIsNotMemorized` (**Review Focus 1**: `pageProgress(1).state == .notMemorized`, snapshot all zero); `milestoneReportedOnlyOnce` (apply Fatiha → `[.surahCompleted(1)]`; undo and re-apply → `[]`); `quranCompletedAtIsSetOnceAndNeverCleared` (index of two ayat for the test; mastered → set; downgrade → still set; re-master keeps the first date); `streakIgnoresUndoneBatch`; `settingsDefaults` (banner mark true, ayah marker false); `currentPositionPersistsAcrossStores`.
- [ ] **Step 2: Run** `APPTEST MemorizationStoreTests` → FAIL.
- [ ] **Step 3: Implement** (load records once at init into a dictionary; mutate it from the plan's `after` rows after a successful database write).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: `COMMIT "memorization store"`** (changelog: phase 3 done).

---

## Phase 4 — Dashboard and update sheet

### Task 12: Entry point, dashboard, seed for UI tests

**Files:**
- Create: `Sources/Memorization/MemorizationView.swift` (root `NavigationStack` + dashboard), `Sources/Memorization/DashboardSections.swift`, `Sources/Memorization/MemorizationSeed.swift` (`#if DEBUG`), `Sources/Memorization/MemorizationTheme.swift` (palette, shapes ✓✓ ! ◐ ○, status labels), `UITests/MemorizationUITests.swift`
- Modify: `Sources/Reader/ReaderTopBar.swift` (new `openMemorization` closure and a `TopBarIconButton(systemImage: "book.closed", label: "الحفظ", identifier: "memorization-button", …)` placed before the settings button), `Sources/Reader/ReaderView.swift` (`@State showingMemorization = CommandLine.arguments.contains("-open-memorization")`, a `.fullScreenCover` presenting `MemorizationView`, passing `onOpenInMushaf`), `Sources/MushafLibrary.swift` (add `lazy var quranIndex: QuranIndex?`)
- Consumes: Task 11. Produces: `MemorizationView(library: MushafLibrary, store: MemorizationStore, onOpenInMushaf: (Int, AyahKey?) -> Void)`; `MemorizationTheme.color(_ status)`, `.shape(_ status) -> String` (✓✓, !, ◐, ○), `.label(_ status)` (متقن, محفوظ مع أخطاء, يحتاج المصحف, غير محفوظ); the app-level store is created once in `MutshabehatApp`/`ReaderView` from `MemorizationDatabase()` and `library.quranIndex`; launch arguments `-memorization-seed demo` (DEBUG: an in-memory temp database seeded with al-Fatiha mastered, 2:1…20 mastered, 2:21…35 with errors, 2:36…50 needs Mushaf, 36:1…83 learning) so UI tests are deterministic.

Dashboard (§10 order): headline (strict % large with identifier `memo-strict`, «تقدم الحفظ» `memo-learning`, thin "can recite" line); three tiles `memo-tile-surahs` (x/114), `memo-tile-pages` (pages fully mastered /604, page-equivalent beneath), `memo-tile-ayat` (x/6,236); status segmented bar `memo-status-bar` (tap a segment pushes the filtered ayah list placeholder to be filled in Task 15); «الحفظ الحالي» card `memo-current`; search field `memo-search` using `SelectionParser`; a bottom button «تحديث الحفظ» `memo-update-button` (sheet implemented in Task 13); sections for التقدم, يحتاج مراجعة, آخر النشاط, الأهداف, المقترح اليوم render empty states now and are filled by Tasks 15, 18, 22, 23.

- [ ] **Step 1: Write the failing UI tests** (`MemorizationUITests`, launch `["-open-memorization", "-memorization-seed", "demo", "-app:language:v1", "ar"]`): `dashboardShowsHeadlineAndTiles` (identifiers exist; `memo-tile-surahs` label contains «١ / ١١٤» or `1 / 114` per the app language; `memo-strict` exists); `topBarButtonOpensTheModule` (launch without `-open-memorization` and `-show-chrome`, tap `memorization-button`, `memo-strict` appears); `emptyInstallShowsZeros` (launch with `-memorization-seed empty`: `memo-strict` reads 0, no crash — **Review Focus 1**); `searchJumpsToSurah` (type «يس» → surah detail screen id `memo-surah-detail` appears once Task 14 exists; until then assert the parser-driven navigation callback via a visible `memo-search-result` label).
- [ ] **Step 2: Run** `UITEST MemorizationUITests` → FAIL.
- [ ] **Step 3: Implement** the files above. After adding the button, take iPhone and iPad screenshots (`xcrun simctl io booted screenshot`) with `-show-chrome` to confirm the banner still fits (spec §15); fix spacing if not.
- [ ] **Step 4: Run** `UITEST MemorizationUITests` → PASS; run `UITEST ReaderUITests` to confirm no existing reader test regressed (compare to the baseline recorded in Task 0).
- [ ] **Step 5: `COMMIT "memorization dashboard and entry point"`**

### Task 13: Update sheet, confirmation, undo toast

**Files:**
- Create: `Sources/Memorization/UpdateSheet.swift`, `Sources/Memorization/UndoToast.swift`
- Modify: `MemorizationView.swift` (present the sheet, host the toast)
- Test: add to `UITests/MemorizationUITests.swift`

**Interfaces:**
- Produces: `UpdateSheet(store:, library:, initial: MemorizationSelection?, onApplied: (MemorizationStore.ApplyResult) -> Void)`; picker `memo-update-mode` with `سورة | آيات | صفحات | جزء`; surah list search `memo-update-surah-search`; ayah fields `memo-update-from`, `memo-update-to`; page fields `memo-update-page-from`, `memo-update-page-to`; juz chips `memo-update-juz-N`; four status buttons `memo-status-1` … `memo-status-4`; learning toggle `memo-update-learning`; live count line `memo-update-count` («٨٣ آية · سورة يس»); apply button `memo-update-apply`; confirmation alert for `needsConfirmation` («سيتم تحديث N آية من … إلى "…"», and "M منها بالفعل" when `unchangedCount > 0`) with `memo-confirm-apply`; toast `memo-undo-toast` («تم تحديث N آية») with `memo-undo-button` for ~8 s calling `store.undo(batchID:, force: false)`; milestone line shown quietly in the toast; a light haptic (`UINotificationFeedbackGenerator .success`) only when `milestones` is non-empty or the batch finished a surah/juz. The search text parser pre-fills mode and selection. A toggle `memo-update-set-current` («اجعله موضع الحفظ الحالي») stores the selection's first and last ayah through `store.currentPosition`; the dashboard's «الحفظ الحالي» card (`memo-current`, from Task 12) shows that range with «N / M آيات» mastered and «فتح في المصحف».

- [ ] **Step 1: Write the failing UI tests:** `smallRangeAppliesWithoutConfirmation` (آيات mode, البقرة 1–5 → status 1 → apply → toast appears, no alert); `wholeSurahAsksConfirmation` (سورة يس → status 1 → alert text contains «٨٣»; cancel changes nothing; confirm applies); `undoFromToastRestores` (apply then `memo-undo-button` → `memo-strict` returns to its prior value); `typedTargetPreselectsMode` (type «صفحة 582» in the sheet's search → mode becomes صفحات with 582); `reversedRangeStillApplies` (**Review Focus 2**: from 20 to 1). `settingCurrentPositionShowsOnDashboard` (apply with the toggle on for 3:42…51 → `memo-current` text contains «آل عمران» and «٤٢»).
- [ ] **Step 2: Run** `UITEST MemorizationUITests` → FAIL.
- [ ] **Step 3: Implement.** All state changes go through `MemorizationStore.plan/apply`; the sheet never computes numbers itself.
- [ ] **Step 4: Run** → PASS (iPhone), then `UITEST MemorizationUITests` on the iPad destination.
- [ ] **Step 5: `COMMIT "memorization update sheet, confirmation and undo toast"`** (changelog: phase 4 done).

---

## Phase 5 — Detail screens and history

### Task 14: Surah list and surah detail

**Files:**
- Create: `Sources/Memorization/SurahListView.swift`, `Sources/Memorization/SurahDetailView.swift`, `Sources/Memorization/AyahStrip.swift`
- Modify: `MemorizationView.swift` (tile → list), `MushafCore/Sources/MushafCore/Memorization/MemorizationStatistics.swift` (add `AyahRun` and `static func runs(for surah: Int, records:, index:) -> [AyahRun]`)
- Test: `MushafCore/Tests/MushafCoreTests/AyahRunTests.swift`; extend `UITests/MemorizationUITests.swift`

**Interfaces:**
- Produces: `public struct AyahRun: Equatable, Sendable { status: MemorizationStatus; from: Int; to: Int }` (maximal consecutive same-status runs, ayah numbers); `SurahListView(store:, library:, onOpenInMushaf:)` (identifier `memo-surah-list`, rows `memo-surah-row-N` showing %, «متقن: 180 / 286», a segmented bar; search `memo-surah-search` using the Arabic normaliser; sort menu `memo-surah-sort` (ترتيب المصحف / الأكثر حفظاً / الأقل حفظاً); filter menu `memo-surah-filter` (الكل / المكتمل / غير المكتمل / قيد الحفظ / يحتاج مراجعة)); `SurahDetailView(surah: Int, …)` id `memo-surah-detail` with strict and weighted %, the four counts, pages occupied, last review date, displayed review strength (the weakest displayed strength among memorized ayat), current position, last memorized ayah, the `AyahStrip` (segments `memo-strip-seg-N`, width proportional to run length, tap → `onOpenInMushaf(page, ayah)`), and buttons «تحديث» (opens `UpdateSheet(initial: .surah(n))`) and «فتح في المصحف».

- [ ] **Step 1: Write the failing tests:** core `runsSplitOnStatusChanges` (2:1…20 mastered, 21…35 errors, 36…50 needs, 51…286 not → four runs with those bounds), `runsOfEmptySurahIsOneNotMemorizedRun`; UI `surahListFiltersAndSorts` (seeded: filter المكتمل shows only al-Fatiha; sort الأكثر حفظاً puts it first), `surahSearchMatchesArabicNameWithoutDiacritics` («البقره»), `surahDetailShowsRunsAndOpensMushaf` (tap segment → the reader shows the page: `mushaf-page-N` exists after the cover closes).
- [ ] **Step 2: Run** `CORETEST AyahRunTests`, `UITEST MemorizationUITests` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: `COMMIT "memorization surah list and detail"`**

### Task 15: Page grid, ayah status list, history screen

**Files:**
- Create: `Sources/Memorization/PageGridView.swift`, `Sources/Memorization/AyahStatusListView.swift`, `Sources/Memorization/HistoryView.swift`, `Sources/Memorization/PageSheet.swift` (stub filled in Task 16)
- Modify: `MemorizationView.swift` (tiles, status-bar segments, «آخر النشاط» section)
- Test: extend `UITests/MemorizationUITests.swift`

**Interfaces:**
- Produces: `PageGridView(store:, onOpenInMushaf:)` id `memo-page-grid`, 604 cells `memo-page-cell-N` (LazyVGrid, adaptive columns: ≥ 6 on iPhone, more on iPad) each drawing the page's state shape and a mini stacked fill of `PageProgress.mix.fractions`, legend of the four states `memo-page-legend`; tap → `onOpenInMushaf(page, nil)`; long-press → `PageSheet`; `AyahStatusListView(filter: AyahFilter, …)` with `enum AyahFilter { case status(MemorizationStatus), dueForReview, currentlyLearning }`, grouped by surah then page, rows open the Mushaf; `HistoryView` listing batches by day (label, count, status change summary «متقن → …») with an «تراجع» button on each non-undone batch calling `store.undo(batchID:, force: false)` and, on `.hasNewerChanges`, an alert naming the newer batches with a «تراجع على أي حال» action (`force: true`); id `memo-history`.

- [ ] **Step 1: Write the failing tests:** `pageGridShowsStateShapes` (seeded: page 1 cell label contains «متقن», page 600 «غير محفوظ»); `pageGridLegendHasFourStates`; `tappingPageOpensMushafPage`; `statusBarSegmentOpensFilteredList` (tap the withErrors segment → list shows 2:21…35, nothing else); `historyListsBatchAndUndoes` (apply a batch, open history, undo → `memo-strict` returns); `historyWarnsWhenNewerBatchOverlaps` (**Review Focus 3**: two overlapping batches, undo the older → alert with «تراجع على أي حال»; cancel leaves data); `dueForReviewFilterListsMemorizedUnreviewedAyat`.
- [ ] **Step 2: Run** `UITEST MemorizationUITests` → FAIL.
- [ ] **Step 3: Implement.** The page grid reads `store.snapshot.pages` (computed once per version), not per-cell queries.
- [ ] **Step 4: Run** → PASS (iPhone and iPad destinations).
- [ ] **Step 5: `COMMIT "memorization page grid, ayah lists and history"`** (changelog: phase 5 done).

---

## Phase 6 — Reader integration

### Task 16: Banner page mark and page sheet

**Files:**
- Create: `Sources/Memorization/PageStatusMark.swift`, complete `Sources/Memorization/PageSheet.swift`
- Modify: `Sources/Reader/ReaderTopBar.swift` (mark overlaid on the banner, visible in both header modes; closure `openPageSheet: (Int) -> Void`; page numbers to mark passed in as `markedPages: [Int]`), `Sources/Reader/ReaderView.swift` (compute `markedPages` = the banner's page, or both pages of a spread via `Spread.rightPage/leftPage`; present `PageSheet`)
- Test: extend `UITests/MemorizationUITests.swift`; add `UITests/MemorizationReaderUITests.swift`

**Interfaces:**
- Consumes: `store.pageProgress(_:)`, `store.showsBannerMark`.
- Produces: `PageStatusMark(progress: PageProgress, showsPageNumber: Bool)` (shape + short word + a 2 pt hairline bar of the mix; identifier `memo-banner-mark-N`; VoiceOver label «صفحة N: متقن، ٧ من ١٠ آيات متقنة»); `PageSheet(page: Int, store:, library:)` with the mix summary, four status buttons applying to the whole page through the same planner/confirmation/undo-toast path (`memo-page-status-1…4`), and «تحديد آيات فقط» (`memo-page-pick`): the page's ayat as a checklist (`memo-page-ayah-row-N`) then a status applied to the ticked ayat; settings toggle «إظهار حالة الحفظ في الشريط العلوي» in `SettingsView` (id `memo-setting-banner-mark`, default on) bound to `store.showsBannerMark`.

- [ ] **Step 1: Write the failing UI tests** (seeded demo, `-mushaf1441:last-page:v1 1`, `-mushaf1441:reader-layer:v1 none`): `bannerMarkShowsPageState` (page 1 → `memo-banner-mark-1` label contains «متقن»); `markVisibleWithChromeHiddenAndShown` (exists with and without `-show-chrome`, and its frame does not move between the two); `markFollowsPageTurn` (turn to a not-memorized page → label contains «غير محفوظ»); `markUpdatesAfterSheetChange` (open sheet via the mark, mastered whole page → mark changes); `tappingHeaderElsewhereStillTogglesChrome`; `markCanBeHidden` (turn off the setting → mark absent); `iPadSpreadShowsTwoMarks` (iPad destination, landscape: two marks `memo-banner-mark-1` and `-2`); `markIdenticalWithQiraatOn` (launch with `-mushaf1441:reader-layer:v1 qiraat`: same label — Hafs only).
- [ ] **Step 2: Run** `UITEST MemorizationReaderUITests` → FAIL.
- [ ] **Step 3: Implement.** Keep the mark outside the header/controls cross-fade so it never animates with the chrome. Verify placement on screenshots at iPhone and iPad width and in Arabic.
- [ ] **Step 4: Run** → PASS (both destinations); `UITEST ReaderUITests` matches the baseline.
- [ ] **Step 5: `COMMIT "memorization banner page mark and page sheet"`**

### Task 17: Ayah sheet, range mode, optional ayah marker

**Files:**
- Create: `Sources/Memorization/AyahSheet.swift`, `Sources/Memorization/RangePill.swift`
- Modify: `Sources/Reader/ReaderView.swift` (replace the bookmark `confirmationDialog` target with `AyahSheet`; keep the two bookmark actions and their behaviour), `Sources/Reader/MushafPager.swift` and `PageController.swift` (a closure `memorizationStatuses: (Int) -> [AyahKey: MemorizationStatus]?`, nil when the marker is off), `Sources/Reader/MushafPageView.swift` (draw the marker under the end marker: disc / ring+dot / ring / nothing, ink at 55 % opacity, size from `frame.height`), settings toggle `memo-setting-ayah-marker`
- Test: extend `UITests/MemorizationReaderUITests.swift`; keep `UITests/ReaderUITests.swift` and any bookmark tests passing

**Interfaces:**
- Produces: `AyahSheet(page: MushafPage, ayah: AyahKey, store:, bookmarkActions: …)` with the existing two bookmark buttons (same identifiers as today's dialog buttons — find them with `grep -rn "bookmark" UITests`), «حالة الحفظ» four buttons `memo-ayah-status-1…4` marking the current one, `memo-ayah-learning`, «تحديد من هنا» `memo-range-start`; `RangePill` («من البقرة ١٢ — اختر آية النهاية», cancel `memo-range-cancel`) shown while a start ayah is stored; a second long-press on any ayah (any surah, any order) completes the span and opens `UpdateSheet(initial: .span(from:to:))`; when the marker setting is off the pager closure returns nil and nothing is queried.

- [ ] **Step 1: Write the failing UI tests:** `longPressOpensSheetWithBookmarkAndMemorization` (both groups present); `bookmarkActionsStillWork` (toggle ayah bookmark through the sheet → `BookmarksView` lists it); `statusButtonUpdatesAyahAndBanner` (long-press an ayah on page 1, tap `memo-ayah-status-1` → page mark in the banner changes after all page-1 ayat are mastered via the sheet); `rangeAcrossPagesAndSurahs` (start at 2:5, turn pages, long-press another ayah → update sheet pre-filled with that span; apply → both ends changed); `rangeCancel`; `markerHiddenByDefault` and `markerShownWhenEnabled` (enable the setting → page 1's end markers show a marker element `memo-ayah-marker-1-1`); `wordTapsUnchanged` (with Qiraat layer on, tapping a marked word still opens the Qiraat card).
- [ ] **Step 2: Run** `UITEST MemorizationReaderUITests` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS; `UITEST ReaderUITests` and the bookmark UI tests match the baseline.
- [ ] **Step 5: `COMMIT "memorization ayah sheet, range mode and ayah marker"`** (changelog: phase 6 done).

---

## Phase 7 — Review UI

### Task 18: Review flow, due list, suggestion card

**Files:**
- Create: `Sources/Memorization/ReviewView.swift`, `Sources/Memorization/SuggestionCard.swift`
- Modify: `MemorizationView.swift` (يحتاج مراجعة section and المقترح اليوم card), `SurahDetailView.swift` (review button)
- Test: extend `UITests/MemorizationUITests.swift`

**Interfaces:**
- Produces: `ReviewView(selection: MemorizationSelection, label: String, store:)` with four result buttons `memo-review-excellent|good|mistakes|forgot` (ممتاز, جيد, أخطاء, لم أتذكر) applying `store.review(…)` and showing the same toast/undo; the dashboard section lists the due count and the three most overdue surahs (`memo-due-row-N`) with «ابدأ المراجعة» (`memo-review-start`); `SuggestionCard` renders `store.suggestion` («أكمل سورة النبأ، متبقٍ ٨ آيات» / «راجع سورة الملك، آخر مراجعة منذ ٨ أيام») with `memo-suggestion` and opens the Mushaf or review.

- [ ] **Step 1: Write the failing UI tests:** `dueSectionListsMemorizedUnreviewed` (seeded); `reviewExcellentUpdatesDueList` (review al-Fatiha → it leaves the due list); `reviewDoesNotChangeStatus` (`memo-strict` unchanged after a «لم أتذكر» review); `weakStrengthShownOnSurahDetailAfterForgot`; `suggestionShowsLearningRangeFirst` (seeded 36:1…83 learning → text contains «يس»); `reviewIsUndoable`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: `COMMIT "memorization review flow and suggestion"`** (changelog: phase 7 done).

---

## Phase 8 — Backup and restore

### Task 19: Backup core (manifest, hashing, retention, SQLite snapshot, export and merge)

**Files:**
- Create: `MushafCore/Sources/MushafCore/Backup/BackupManifest.swift`, `BackupHash.swift`, `RetentionPlanner.swift`, `SQLiteSnapshot.swift`, `MushafCore/Sources/MushafCore/Memorization/MemorizationExport.swift`
- Test: `MushafCore/Tests/MushafCoreTests/BackupCoreTests.swift`, `MemorizationMergeTests.swift`

**Interfaces:**
- Produces: `BackupFileEntry { name, sha256, size, rowCount: Int? }`, `BackupManifest { formatVersion = 1, createdAt, deviceID, appVersion, files }` (Codable, ISO-8601); `enum BackupHash { sha256Hex(_ data: Data) -> String; sha256Hex(ofFileAt: URL) throws -> String }` (CryptoKit); `enum RetentionPlanner { static func datesToDelete(existing: [Date], now: Date, keepDays: Int = 14, calendar: Calendar) -> [Date] }` (keeps the newest set per local day for the last `keepDays` days including today; everything older or a same-day duplicate is returned); `enum SQLiteSnapshot { static func copy(from: URL, to: URL) throws; static func integrityCheck(at: URL) -> Bool }` (SQLite online backup API through a separate read connection, so it is consistent with an open WAL database); `public struct MemorizationExport: Codable, Equatable, Sendable { formatVersion: Int /* = 1 */; exportedAt: Date; deviceID: String; records: [AyahMemorizationRecord]; batches: [BatchRecord]; events: [ChangeEvent]; goals: [GoalDefinition]; meta: [String: String] }` with `static func decode(_ data: Data) throws -> MemorizationExport` throwing `MemorizationExportError.newerFormat(Int)`, `.corrupt`; `enum MemorizationMerge { static func merge(local: MemorizationExport, incoming: MemorizationExport) -> MemorizationExport }` (per ayah the newer `updatedAt` wins, tie → local; batches and events unioned by batch id; a batch with `undoneAt` on either side stays undone; goals unioned by id; meta keeps the later `quran_completed_at`-style earliest completion and unions `milestones_seen`). `GoalDefinition` is a `Codable, Equatable, Sendable` struct defined here as `{ id: UUID; kind: GoalKind; createdAt: Date }` with `enum GoalKind: Codable, Equatable, Sendable { case ayatPerDay(Int), pageEquivalentsPerWeek(Double), completeSurah(Int), completeJuz(Int), completeQuranBy(Date) }` (used by Task 22).

- [ ] **Step 1: Write the failing tests:** `sha256KnownVector` (`"abc"` → `ba7816bf…`); `manifestRoundTrip`; `retentionKeepsOnePerDayFor14Days` (fixed calendar: 20 daily sets plus two on one day → the 6 oldest days and the older duplicate are returned); `retentionNeverDeletesLatestOfToday`; `snapshotCopiesWhileSourceIsOpenInWAL` (create a WAL DB with rows, keep a writer open, `copy` → the copy opens, `integrityCheck` true, rows present); `integrityCheckFailsOnTruncatedFile` (**Review Focus 4**); `exportDecodeRejectsNewerFormat` (`formatVersion: 99` → `.newerFormat(99)`); `exportDecodeRejectsTruncatedJSON` (→ `.corrupt`); `mergeKeepsNewerAyahRow`; `mergeKeepsLocalOnTie`; `mergeUnionsBatchesAndEventsById`; `mergeKeepsUndoneFromEitherSide`; `mergeIsIdempotent` (merge(a, merge(a, b)) == merge(a, b)).
- [ ] **Step 2: Run** `CORETEST BackupCoreTests` and `CORETEST MemorizationMergeTests` → FAIL.
- [ ] **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: `COMMIT "backup core and memorization merge"`**

### Task 20: Backup service (build, verify, place, rotate)

**Files:**
- Create: `Sources/Backup/BackupService.swift`, `Sources/Backup/BackupFolder.swift`
- Modify: `Sources/Reading/QuranReadingDatabase.swift` (add `var fileURL: URL`, `func exportDatabase() throws -> Data`, `func importDatabase(_ data: Data) throws` with the validate-swap-reopen-rollback pattern of `MutshabehatDatabase.importDatabase`, required tables `bookmarks, khatmas, khatma_read_ayahs, reading_days, reading_metadata`), `Sources/Mutshabehat/MutshabehatDatabase.swift` (add `var fileURL: URL`), `Sources/Memorization/MemorizationDatabase.swift` (`func exportAll() -> MemorizationExport`, `func replaceAll(with: MemorizationExport) throws`, `func merge(_ incoming: MemorizationExport) throws` using `MemorizationMerge`)
- Test: `Tests/BackupServiceTests.swift`, `Tests/ReadingDatabaseTransferTests.swift`

**Interfaces:**
- Consumes: Task 19, `QiraatBackupService.export(from:)`, `ICloudDatabaseSyncService.shared.resolveSyncFolder()`.
- Produces: `enum BackupReason { case manual, debounced, background, launch }`; `struct BackupResult { createdAt: Date; skipped: Bool; files: [BackupFileEntry] }`; `enum BackupError: LocalizedError { folderUnavailable, verificationFailed(String), writeFailed(String) }` (Arabic descriptions); `final class BackupFolder { init(provider: @escaping () -> URL?) ; func backupsRoot() -> URL? /* <folder>/Backups, created */ }`; `@MainActor @Observable final class BackupService` with `init(folder: BackupFolder, memorization: MemorizationDatabase, reading: QuranReadingDatabase, mutshabehat: MutshabehatDatabase, library: MushafLibrary?, now: @escaping () -> Date = Date.init, calendar: Calendar = .current)`, `var lastSuccess: Date?`, `var lastError: String?`, `var isRunning: Bool`, `func runBackup(reason: BackupReason) async throws -> BackupResult`, `func listSnapshots() -> [SnapshotInfo]`. Behaviour (§9): build the set in `Backups/.staging-<uuid>/` (`memorization.json`, `memorization.sqlite`, `reading.sqlite`, `mutshabehat.sqlite`, `manifest.json`), verify (hashes, `integrityCheck` for each sqlite, re-decode the JSON), then move to `Backups/history/<yyyyMMdd-HHmmss>/` and copy to `Backups/latest/` (previous `latest` removed only after the new one is verified); the Qiraat archive goes to `Backups/shared/qiraat.qiraatdata` only when its hash differs from the manifest's last value; apply `RetentionPlanner`; skip (`skipped: true`) when no file hash changed since the last manifest; write with `NSFileCoordinator` (`.forReplacing`); folder nil → throw `.folderUnavailable` without touching anything. A DEBUG launch argument `-backup-folder none|temp` replaces `BackupFolder`'s provider (no folder, or a fresh temp directory) for UI tests.

- [ ] **Step 1: Write the failing tests** (temp directory as the "iCloud folder", real small databases): `backupWritesCompleteVerifiedSet` (all five files present, manifest hashes match); `secondRunWithoutChangesIsSkipped`; `changeInMemorizationProducesNewHistorySet`; `qiraatArchiveWrittenOnlyWhenChanged`; `retentionRemovesOldDays` (run with an injected clock over 20 days → 14 `history` folders remain); `failedVerificationLeavesPreviousLatestIntact` (inject a corrupt snapshot step → throws `.verificationFailed`; `latest` unchanged, no `history` folder created, staging removed); `missingFolderThrowsAndTouchesNothing` (**Review Focus 4**) and `memorizationApplyUnaffectedByBackupFailure` (a failing `BackupService` does not prevent `MemorizationStore.apply`); `readingDatabaseExportImportRoundTrip` and `readingImportRejectsWrongDatabase` (a mutshabehat file → invalid, current data intact); `exportAllThenReplaceAllRoundTrip` and `mergeFromBackupKeepsNewerRows` for the memorization database.
- [ ] **Step 2: Run** `APPTEST BackupServiceTests` and `APPTEST ReadingDatabaseTransferTests` → FAIL.
- [ ] **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: `COMMIT "backup service and database transfer"`**

### Task 21: Restore, JSON export/import, triggers, Backup screen, banner

**Files:**
- Create: `Sources/Backup/RestoreService.swift`, `Sources/Backup/BackupTriggers.swift`, `Sources/Backup/BackupSettingsView.swift`, `Sources/Backup/RestoreView.swift`
- Modify: `MemorizationView.swift` (backup banner), `Sources/Memorization/MemorizationStore.swift` (post `.memorizationDidChange`), `Sources/Reader/ReaderView.swift` (Settings row opening `BackupSettingsView`)
- Test: `Tests/RestoreServiceTests.swift`, `UITests/MemorizationBackupUITests.swift`

**Interfaces:**
- Produces: `enum BackupStore: CaseIterable { memorization, reading, mutshabehat, qiraat }`; `enum MemorizationRestoreMode { case merge, replace }`; `struct RestorePreview { info: SnapshotInfo; ayahRecords: Int; batches: Int; groups: Int?; qiraatAvailable: Bool }`; `@MainActor final class RestoreService { init(…same stores as BackupService, safetyDirectory: URL); func preview(_ snapshot: SnapshotInfo) throws -> RestorePreview; func restore(_ snapshot: SnapshotInfo, stores: Set<BackupStore>, memorizationMode: MemorizationRestoreMode) throws; func importJSON(_ data: Data, mode: MemorizationRestoreMode) throws; func exportJSON() throws -> Data }` — before any change copy current data to `safetyDirectory/<stamp>/` (keep the last 3); each store restores atomically (memorization through `merge`/`replaceAll` from `memorization.json`; reading and mutshabehat through their `importDatabase`; Qiraat through `library.installQiraatBackup`), a failure in one store rolls that store back and reports it while others keep their result; all inputs verified against the manifest hashes first and refused (clear Arabic message, data untouched) when corrupt, truncated, hash-mismatched, from a newer `formatVersion`, or still an iCloud placeholder (`.icloud`, trigger `startDownloadingUbiquitousItem`). `BackupTriggers`: 30 s debounce after `.memorizationDidChange`; backgrounding with unbacked changes (wrap in `UIApplication.beginBackgroundTask`); launch if `lastSuccess` older than 24 h; never blocks UI. Screens: `BackupSettingsView` (folder status, «اختيار مجلد iCloud» using `fileImporter` for a directory and `ICloudDatabaseSyncService.setCustomFolder`, «نسخ احتياطي الآن» `backup-now`, last success/error, snapshot list, JSON export `backup-export-json` via `fileExporter` and import `backup-import-json` via `fileImporter`), `RestoreView` (per-store checkboxes `restore-store-*`, merge/replace picker `restore-mode`, preview, confirm `restore-confirm`); dashboard banner `memo-backup-banner` when no folder is set or `lastSuccess` is older than 7 days.

- [ ] **Step 1: Write the failing tests:** `restoreMergeKeepsNewerAndAddsMissing`; `restoreReplaceMatchesBackup`; `restoreMakesSafetyCopyAndKeepsLastThree`; `restoreFailureRollsBackThatStoreOnly` (inject a failing reading import → memorization restored, reading unchanged, error reported); `corruptBackupIsRefused`, `truncatedJSONIsRefused`, `hashMismatchIsRefused`, `newerFormatIsRefusedWithMessage`, `placeholderFileIsNotRestored` (**Review Focus 4**; data unchanged in all five); `jsonExportImportRoundTripMerge`; `debounceCollapsesRapidChanges` (3 changes within 30 s → one backup, injected clock/scheduler); `launchBacksUpWhenOlderThan24h`; UI: `bannerShowsWhenNoFolder` (`-backup-folder none`), `backupNowWritesSnapshot` (`-backup-folder temp`: tap `backup-now` → snapshot listed), `restoreFlowPreviewsAndRestores`; `updateSucceedsWhenBackupFolderMissing` (**Review Focus 4**, `-backup-folder none`: apply a batch from the update sheet → toast, no error alert).
- [ ] **Step 2: Run** `APPTEST RestoreServiceTests`, `UITEST MemorizationBackupUITests` → FAIL.
- [ ] **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: `COMMIT "restore, json transfer, backup triggers and screens"`** (changelog: phase 8 done; note that real iCloud behaviour is unverified).

---

## Phase 9 — Goals, progress and milestones

### Task 22: Goals

**Files:**
- Create: `MushafCore/Sources/MushafCore/Memorization/MemorizationGoals.swift`, `Sources/Memorization/GoalsView.swift`
- Modify: `MemorizationDatabase.swift` (`goals() -> [GoalDefinition]`, `saveGoal(_:)`, `deleteGoal(id:)`), `MemorizationStore.swift` (`goals`, `goalProgress(_:)`), `MemorizationView.swift` (الأهداف section)
- Test: `MushafCore/Tests/MushafCoreTests/MemorizationGoalsTests.swift`, `Tests/MemorizationGoalsDatabaseTests.swift`, UI test

**Interfaces:**
- Consumes: `GoalDefinition`/`GoalKind` from Task 19, `HistoryAnalytics.gains`.
- Produces: `public struct GoalProgress: Equatable, Sendable { fraction: Double /* 0…1 */; remainingAyat: Int; remainingPageEquivalents: Double; remainingDays: Int?; isReached: Bool }`; `public enum GoalEngine { static func progress(_ goal: GoalDefinition, snapshot: MemorizationSnapshot, records:, events: [ChangeEvent], index: QuranIndex, now: Date, calendar: Calendar) -> GoalProgress }`. Definitions: ayatPerDay → today's net gains ÷ target; pageEquivalentsPerWeek → this calendar week's gains ÷ target; completeSurah/Juz → mastered share of that surah/juz; completeQuranBy(date) → strict % with `remainingDays = days until date` (clamped at 0) and the remaining ayat/page-equivalents. Goals are optional; none → section hidden except an «إضافة هدف» row.

- [ ] **Step 1: Write the failing tests:** `ayatPerDayFraction` (target 10, 4 gained today → 0.4); `weeklyPageEquivalents` (1 page mastered, target 4 → 0.25); `completeSurahProgress` (Fatiha 3 of 7 mastered → 3/7); `completeJuzReached` (all of juz 30 → `isReached`); `completeQuranByDateRemainingDays` (date in the past → 0 days, not negative); `goalsPersistInDatabase` and `goalsSurviveExportImport`; UI `addGoalShowsProgress` (create «حفظ جزء عم» goal, section shows a fraction).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: `COMMIT "memorization goals"`**

### Task 23: Progress charts, gains, streak, milestone celebrations

**Files:**
- Create: `Sources/Memorization/ProgressSection.swift` (Swift Charts line, range picker `memo-chart-range` with 7 أيام / 30 يوم / 3 أشهر / 6 أشهر / سنة / الكل, strict line plus optional learning line toggle, `.accessibilityChartDescriptor`), `Sources/Memorization/MilestoneBanner.swift`
- Modify: `MemorizationView.swift` (التقدم section: gains «+٣٤ آية · ٣ صفحات تقريباً · ١ سورة مكتملة» for week and month `memo-gains-week`, `memo-gains-month`; streak «سلسلة الحفظ» `memo-streak`), `UpdateSheet.swift` (show `MilestoneBanner` for `ApplyResult.milestones`, haptics only for finished surah/juz/goal/quran)
- Test: UI tests; core coverage already in Task 6

**Interfaces:**
- Consumes: `HistoryAnalytics.series/gains`, `store.streak`, milestones, `quranCompletedAt`.
- Produces: `MemorizationStore.gains(week:)`/`gains(month:)` → `PeriodGains` using the calendar's current week/month; `MemorizationStore.series(_ range: ProgressRange) -> [ProgressPoint]`. At 100 % strict the dashboard headline becomes «تم حفظ القرآن كاملًا» with the stored completion date and the review/maintenance sections move first (§5.4); no data is reset.

- [ ] **Step 1: Write the failing tests:** UI `chartRendersForEveryRange` (cycle the six ranges, `memo-chart` exists each time); `gainsShowWeekAndMonth` (apply a batch with the seed clock → `memo-gains-week` text contains the count); `streakShowsOneAfterUpdateAndZeroAfterUndo` (`memo-streak`); `milestoneBannerOnFinishingSurah`; `completionStateAtOneHundredPercent` (launch with `-memorization-seed complete`: headline reads «تم حفظ القرآن كاملًا», data still present, downgrading an ayah returns to the normal headline while `quran_completed_at` stays); store unit test `gainsUseCalendarWeek` (week starting Saturday for the Arabic locale and Sunday for a US calendar, injected).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: `COMMIT "memorization progress charts, streak and milestones"`** (changelog: phase 9 done).

---

## Phase 10 — Regression and acceptance

### Task 24: Performance, accessibility, full regression, acceptance report

**Files:**
- Modify: `MushafCore/Tests/MushafCoreTests/PerformanceTests.swift` (add the budgets below), `CHANGELOG.md`, `HANDOFF.md` (add a Memorization section: what exists, where, how to run its tests, open items), `docs/specs/2026-10-06-memorization-design.md` (status line → implemented)
- Create: `docs/memorization-acceptance.md` (the owner's §50 checklist, each item marked verified-by (test name or screenshot) or **not verified here**)

- [ ] **Step 1: Add the failing/budget tests:** `snapshotBudget` (full snapshot over 3,000 random records ≤ 20 ms release), `pageProgressBudget` (all 604 ≤ 10 ms), `wholeQuranPlanBudget` (plan 6,236 changes ≤ 300 ms; the SQLite apply of the same plan ≤ 300 ms in `MemorizationApplyUndoTests`), `statisticsIdenticalWithoutQiraatData` (build the snapshot with and without any Qiraat files present → equal).
- [ ] **Step 2: Run** `swift test -c release --package-path MushafCore --filter PerformanceTests` → record numbers; fix any over budget.
- [ ] **Step 3: Accessibility pass:** run the dashboard, page grid and the banner mark with Dynamic Type at the largest accessibility size and VoiceOver labels checked through `XCUIElement.label` assertions (every status shape has a spoken word; charts have descriptors); fix truncation.
- [ ] **Step 4: Full regression:** `scripts/check_isolation.sh`; `make test`, `make test-ipad`, `make release-guard`; compare failures with `Reports/memorization-baseline.txt` — any new failure blocks; confirm `ReadingTests`, Qiraat and bookmark tests are unchanged.
- [ ] **Step 5: Screenshots** of dashboard, update sheet, surah detail, page grid, the banner mark in all four states (iPhone and iPad, Arabic) for the report; send them to the owner.
- [ ] **Step 6: Acceptance report:** write `docs/memorization-acceptance.md` against the owner's §50 list. State plainly what was **not** verified here: real iCloud Drive behaviour on the iPhone (evicted files, signed-out account), the optional ayah-marker glyph size on a device, and real-device haptics.
- [ ] **Step 7: `COMMIT "memorization regression, performance and acceptance report"`**; then stop and report; do not push or merge (`ios/memorization` merges into `ios/main` only on the owner's go-ahead).
