# Review editor (iOS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (the owner chose native, inline execution with one fresh review at the end). Steps use checkbox (`- [ ]`) syntax.

**Goal:** A developer-only review editor in the Qiraat iOS app with the same function as the web `/mushaf-1441/review`: tap a word, see recorded faces and the nquran and الشامل references, edit, save, approve; every write updates the live database through the web review API.

**Architecture:** A pure-Swift `MushafCore/Review` module (models, API client, draft rules, reference matching, save queue) tested with stub transports and golden outputs produced by running the web's own TypeScript. A SwiftUI/UIKit app layer in `Sources/ReviewEditor` (DEBUG only) with its own read-only page canvas on `PageLayout` and a four-step bottom sheet. Existing reader code is not changed.

**Tech Stack:** Swift 6 (strict concurrency), SwiftUI + UIKit, `@Observable`, Swift Testing (core), XCTest/XCUITest (app), XcodeGen, Python 3 stdlib scripts, `tsx` (Node, from the web checkout) for golden data.

**Spec:** `apps/ios/docs/specs/2026-10-05-review-editor-design.md`. Web sources being ported live in `src/app/mushaf-1441/review/{_lib,_components}` and `src/app/api/mushaf-1441/qiraat-review/review-http.ts` (merged into this branch).

## Global Constraints

- Every changed or added file is under `apps/ios/` (`make check-isolation`); `ios/main` never merges into `main`; no push without the owner's go-ahead.
- iOS 18.0 deployment target, Swift 6.0; iPhone and iPad; Arabic RTL, Dynamic Type, VoiceOver labels.
- The editor is DEBUG only: entry row inside the existing `#if DEBUG` «المطور» section of `ReaderView.swift`; every `Sources/ReviewEditor` file is wrapped in `#if DEBUG`; the reference JSON is copied into the app bundle by a build phase only when `$CONFIGURATION = Debug`.
- Only `/api/mushaf-1441/qiraat-review` on `QiraatLiveSync.baseURL` is called for editor data; shared `URLSession` cookie jar, 30 s timeout, header `User-Agent: Qiraat-iOS-Review`. No keys, no direct database access.
- Never commit data: `Generated/Review/**` is gitignored (`Generated` already is). Committed test fixtures are small and synthetic.
- Never write a bare «خلف» or «الدوري»: narrator names come from the catalog the API returns.
- Existing suites stay green: `swift test --package-path MushafCore` (100 tests before this work) and `MutshabehatTests` (37). The reader/Mutshabehat UI must not change.
- Commits: author `Shazlka <amr.eshazly@gmail.com>` (`GIT_AUTHOR_*`/`GIT_COMMITTER_*` env), no model names in commits or comments; one dated entry per change in `apps/ios/CHANGELOG.md` (newest first), added with the task that ships it.
- Commands run from `apps/ios`: `swift test --package-path MushafCore [--filter X]`; app tests via `make test` (full) or `xcodebuild test -project Mutshabehat.xcodeproj -scheme Mutshabehat -derivedDataPath DerivedData -destination 'platform=iOS Simulator,name=iPhone 18 Pro Max' -only-testing:MutshabehatTests/X -collect-test-diagnostics never` after `make project`.

## Review Focus

1. **Word-key mismatch:** a web `SSS:AAA:WWW` key attached to the wrong iOS word hangs a face on the wrong word. Pinned by a test comparing the keys computed from `mushaf.sqlite` for all 604 pages to the web page-word fixtures (Task 8).
2. **Two quick edits on one entry (stale `version`):** the second save must use the server's new version, not the old one (Task 7).
3. **Network drop mid-queue:** retrying a create whose first step already succeeded must not duplicate it, and a failed job must give the draft back (Task 7).
4. **Two-word and cross-ayah faces (`endAyah`/`endWord`):** a face spanning words shows on both words and selecting the second word edits the same face (Task 8).
5. **Unsaved edits lost silently:** switching word, page or leaving the editor with a dirty draft must ask first (Task 10).

---

## Milestone 1: API client and models

### Task 1: Review models

**Files:**
- Create: `apps/ios/MushafCore/Sources/MushafCore/Review/ReviewModels.swift`
- Test: `apps/ios/MushafCore/Tests/MushafCoreTests/ReviewModelsTests.swift`

**Interfaces:**
- Produces (all `public`, `Codable`, `Hashable`, `Sendable`, tolerant of absent optional keys): `ReviewStatus` (`unreviewed|reviewed|flagged`), `ReadingKind` (`farsh|usul`), `ReviewWord(key,surah,ayah,word,line,text)`, `ReviewNarrator(id,code?,nameAr,action?,wajhOrder,wajhNote?)`, `ReviewFlag`, `HamzahDetail` (enum with `single`, `kalima`, `kalimatayn`; encodes to the exact web JSON shape incl. `mode`), `ReviewRow` (every field of `types.ts` `ReviewRow`, `Identifiable` by `entryId`), `CatalogNarrator`, `ReviewCategory(code,nameAr)`, `PageStats`, `ReviewPage`, `PageProgress`, `ReviewOverview`, `HistoryChange`/`HistoryTransaction` (`old`/`new` as `JSONValue`), `NarratorInput`, `CreateEntryInput`, `EntryFields` (all optional; encodes only set keys; `hamzahDetail` distinguishes absent from explicit `null`), `ReviewSuggestion`, `OccurrenceCandidate`, `BulkApplyResult`, `JSONValue` (recursive enum).
- `ReviewRow` helpers: `spansWord(surah:ayah:word:) -> Bool`, `isActive` (not deleted).

- [ ] **Step 1: Write failing tests** in `ReviewModelsTests`: `decodesWebRowWithOptionalNulls` (inline JSON of one row with `categoryCode:null`, `hamzahDetail:{"mode":"kalima","first":"تحقيق","second":"تسهيل","idkhalAlif":true}`; assert fields and `hamzahDetail == .kalima(...)`), `hamzahDetailRoundTripsAllThreeModes`, `entryFieldsEncodesOnlySetKeys` (empty `EntryFields` encodes `{}`; `hamzahDetail: .some(nil)` encodes `"hamzahDetail":null`), `createEntryInputEncodesWebKeys` (keys `surah, ayah, startWord, kind, narrators[].id/action/wajhOrder/wajhNote`), `rowSpansTwoWordFace` (startWord 3 endWord 4 same ayah spans 3 and 4, not 5; cross-ayah `endAyah` spans the next ayah's first words up to `endWord`).
- [ ] **Step 2: Run** `swift test --package-path MushafCore --filter ReviewModelsTests`. Expected: FAIL (types missing).
- [ ] **Step 3: Implement** the models. Optional-update semantics for `EntryFields` use a small `Patch<T>` wrapper (`.unset | .set(T?)`) so `null` and absent differ. `HamzahDetail` custom `Codable` on the `mode` discriminator.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `iOS: review editor models`.

### Task 2: Review API client and error mapping

**Files:**
- Create: `…/Review/ReviewError.swift`, `…/Review/ReviewAPI.swift`
- Test: `…/Tests/MushafCoreTests/ReviewAPITests.swift`

**Interfaces:**
- Consumes: Task 1 models.
- Produces: `ReviewError(code: ReviewErrorCode, status: Int, messageAr: String)` with `ReviewErrorCode` = `unauthorized, forbidden, versionConflict, ruleD8, ruleNarratorTwice, ruleEmptyLocation, ruleWaslWaqf, undoConflict, undoRefused, notFound, badRequest, unavailable` (raw strings exactly the web codes, e.g. `"VERSION_CONFLICT"`); `protocol ReviewTransport: Sendable { func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) }`; `URLSessionReviewTransport` (shared session, 30 s); `final class ReviewAPI: Sendable { init(baseURL: URL, transport: any ReviewTransport, deviceId: String) }` with `async` methods returning `Result<T, ReviewError>`: `page(_:includeDeleted:)`, `overview()`, `history(page:)`, `setStatus(_ row:, _ status:, note:)`, `update(_ row:, _ fields: EntryFields)`, `setNarrators(_ row:, _ narrators: [NarratorInput])`, `create(_ entry: CreateEntryInput)`, `delete(_ row:, note:)`, `restore(_ row:)`, `undo(txid:)`, `bulkDelete(_ items: [(entryId: String, expectedVersion: String)], note:)`, `findSameWord(surah:ayah:word:excludeLocusId:)`, `suggestions(surah:ayah:word:)`, `copyEntry(sourceEntryId:surah:ayah:startWord:endAyah:endWord:)`, `findOccurrences(entryId:)`, `bulkApply(sourceEntryId:targets:)`. `ReviewError.messageAr` falls back to fixed Arabic texts for every code (connection failure: «تعذّر الاتصال بالخادم — تحقق من الاتصال ثم أعد المحاولة»; timeout: «انتهت مهلة الاتصال بالخادم — تحقق من الاتصال ثم أعد المحاولة»; version conflict: «عُدِّل هذا الوجه من مكان آخر — أُعيد تحميله»). `DeviceID.current()` returns a UUID persisted in `UserDefaults` key `qiraat-review-device-id`.

- [ ] **Step 1: Write failing tests** with a `StubTransport` recording requests: `pageRequestIsGetWithQuery` (`/api/mushaf-1441/qiraat-review?page=8`, `includeDeleted=1` only when true), `statusPatchBodyMatchesWeb` (PATCH body has `action:"status"`, `entryId`, `version`, `deviceId`, `status`, `note`), `createPostBodyWrapsEntry` (`{"action":"create","entry":{…},"deviceId":…}`), `bulkApplyBody`, `serverErrorMapsToCode` (409 `{"error":"VERSION_CONFLICT"}` → `.versionConflict`, 422 `RULE_D8` with `messageAr` keeps the server text), `invalidJSONIsUnavailable`, `transportThrowIsUnavailableWithConnectionMessage`, `timeoutUsesTimeoutMessage` (transport throws `URLError(.timedOut)`).
- [ ] **Step 2: Run** `--filter ReviewAPITests`. Expected: FAIL.
- [ ] **Step 3: Implement.** Mirror `api.ts` request shapes exactly (see that file); headers `Content-Type: application/json`, `Accept: application/json`.
- [ ] **Step 4: Run** `--filter Review`. Expected: PASS.
- [ ] **Step 5: Commit** `iOS: review editor API client`.

---

## Milestone 2: Reference engines (golden-tested)

### Task 3: Reference data generation and loaders

**Files:**
- Create: `apps/ios/scripts/build_review_reference.py`, `apps/ios/scripts/test_build_review_reference.py`, `…/Review/ReferenceData.swift`
- Modify: `apps/ios/Makefile` (targets `review-data`, wired into `core-test` and `test`), `apps/ios/project.yml` (Debug-only copy phase + `Generated/Review` not listed as resources), `apps/ios/.gitignore` if `Generated/Review` is not already covered
- Test: `…/Tests/MushafCoreTests/ReferenceDataTests.swift`

**Interfaces:**
- Produces: script copies `src/app/mushaf-1441/review/_lib/reference/{nquran,shamil}` to `Generated/Review/reference/{nquran,shamil}` and fails if `nquran` has not exactly 114 `surah-NNN.json` files or `shamil/index.json` is missing; `NquranAyahEntry` and `ShamilEntry` `Codable` models matching the JSON; `ReferenceLibrary(directory: URL)` with `nquran(surah: Int) throws -> [NquranAyahEntry]` and `shamil(surah: Int) throws -> [ShamilEntry]?` (nil when the surah has no الشامل data), per-surah cache, thread-safe.
- project.yml: a pre-build script phase named «Copy review reference (Debug only)» that does nothing unless `"$CONFIGURATION" = "Debug"`, otherwise `rsync -a --delete "$SRCROOT/Generated/Review/reference/" "$TARGET_BUILD_DIR/$UNLOCALIZED_RESOURCES_FOLDER_PATH/ReviewReference/"` and fails with an explicit message if the source is missing.

- [ ] **Step 1: Write failing tests:** `test_build_review_reference.py` (`copies_all_114_surahs`, `fails_when_a_surah_is_missing`, `fails_without_shamil_index`) using a temp tree; `ReferenceDataTests` (`loadsEverySurahOfNquran` reading all 114 and asserting 6,236 ayat in total, `shamilCoversSurah2`, `shamilMissingSurahReturnsNil`).
- [ ] **Step 2: Run** `python3 scripts/test_build_review_reference.py -v` and `make review-data && swift test --package-path MushafCore --filter ReferenceDataTests`. Expected: FAIL.
- [ ] **Step 3: Implement** the script, the loaders and the Makefile/project.yml edits. Add `test_build_review_reference.py` to `data-test`.
- [ ] **Step 4: Run** both commands again. Expected: PASS; `make project` still generates.
- [ ] **Step 5: Commit** `iOS: review reference data generation and loaders`.

### Task 4: Golden generator and nquran matching

**Files:**
- Create: `apps/ios/scripts/review_golden.mjs`, `…/Review/NquranMatching.swift`
- Test: `…/Tests/MushafCoreTests/NquranMatchingTests.swift`

**Interfaces:**
- `review_golden.mjs` (run as `npx tsx scripts/review_golden.mjs <repoRoot> <outDir>`, writes `Generated/Review/golden/nquran.json`): for a deterministic sample of ≥3,000 (surah, ayah, word) triples drawn from the page-word fixtures (all words of surahs 1, 2, 3, 36, 112–114 plus every 7th word elsewhere), the web's `findNquranDifferencesForWord(entries, ayahWords, wordText)` output (location, groups, resolved narrator ids), plus `resolveNquranReaderLabel` for every distinct label in the data.
- Swift: `NquranMatching.differences(for word: ReviewWord, ayahWords: [ReviewWord], entry: NquranAyahEntry?) -> [NquranDifference]`, `NquranReaderLabels.resolve(_ label: String) -> [String]` (narrator ids; «باقي الرواة» computed as the complement within the 20), `Arabic.normalize(_:)` matching `normalizeArabic` (fold `ٱ→ا`, strip tatweel and marks per `src/lib/arabic.ts`) and the hamza/alef/consonant-skeleton folds used in `nquranReference.ts`.

- [ ] **Step 1: Write failing tests:** `goldenParityOverSample` (skips with a clear failure message if `Generated/Review/golden/nquran.json` is absent: run `make review-data`), `meemJamSitsOnFirstWordOnly` (the «ميم الجمع» difference is returned for the first word of its phrase only), `shortLocationDoesNotMatchInsideLongerWord` (location «ال» does not match «البحر»), `remainderIsComplement` (label «باقي الرواة» with groups naming ورش عن نافع resolves to the other 19 ids), `normalizeFoldsAlefWasla`.
- [ ] **Step 2: Run** `node`/`npx tsx scripts/review_golden.mjs ../.. Generated/Review/golden` then `--filter NquranMatchingTests`. Expected: FAIL (Swift missing).
- [ ] **Step 3: Implement** the Swift port line by line from `nquranReference.ts`; the golden test is the arbiter. Add the golden step to `make review-data`.
- [ ] **Step 4: Run** the filter. Expected: PASS with 0 mismatches over the sample.
- [ ] **Step 5: Commit** `iOS: nquran reference matching with golden parity`.

### Task 5: الشامل matching, reconciliation decisions, apply to draft

**Files:**
- Create: `…/Review/ShamilMatching.swift`, `…/Review/ReferenceDecision.swift`, `…/Review/ReferenceApply.swift`
- Modify: `apps/ios/scripts/review_golden.mjs` (more outputs: `shamil.json`, `decision.json`, `apply.json`)
- Test: `…/Tests/MushafCoreTests/ReferenceDecisionTests.swift`

**Interfaces:**
- `ReferenceGroup(source: .nquran|.shamil, narratorIds: [String], unresolvedLabels: [String], description: String, readingText: String?, suggestedKind: ReadingKind?, suggestedCategory: String?, appliesWasl: Bool?, appliesWaqf: Bool?, isGeneralRule: Bool)`; `ShamilMatching.groups(for:ayahWords:entries:) -> [ReferenceGroup]` (whole-token match after normalisation and dropping «ء», contiguity around the clicked word for phrase entries) and `suggestShamilCategory(...) -> String?` (named categories direct, «النقل والسكت» and idgham by description, mixed bucket by keyword, else nil); `ReferenceDecision.propose(group:rows:) -> ReferenceStatus` (`matched, recordedUnreviewed, partial, missing, unresolved`) and `badgeVisibility(decision:inDraft:) -> BadgeVisibility` (a saved status always wins over «في المسودة»); `ReferenceApply.apply(group:to draft: inout ReviewDraftFields)` appending narrators with the description as «الأداء», filling reading text only if empty, setting kind/wasl-waqf/category only on a draft with no narrators, never overwriting an existing category.

- [ ] **Step 1: Write failing tests:** `shamilGoldenParity` and `decisionGoldenParity` (generated by the web's `proposeReferenceDecision`/`referenceBadgeVisibility`/`applyReferenceGroup` over real rows and groups), plus the web's own cases ported from `tests/qiraat/{reference-group,shamil-reference,reference-apply}.test.ts`: `savedStatusBeatsDraftBadge`, `phraseEntryNeedsContiguousAyahWords`, `categorySuggestionKeywordBucket`, `applyDoesNotOverwriteExistingCategory`, `applyFillsReadingTextOnlyWhenEmpty`.
- [ ] **Step 2: Run** the golden script then `--filter ReferenceDecisionTests`. Expected: FAIL.
- [ ] **Step 3: Implement** the three files as ports of `shamilReference.ts`, `referenceGroup.ts`, `referenceApply.ts`.
- [ ] **Step 4: Run** the filter. Expected: PASS.
- [ ] **Step 5: Commit** `iOS: الشامل matching, reconciliation and apply`.

### Task 6: Narrator display, draft rules, save plan

**Files:**
- Create: `…/Review/NarratorDisplay.swift`, `…/Review/ReviewDraft.swift`
- Modify: `apps/ios/scripts/review_golden.mjs` (`wajh.json`, `narrators.json`)
- Test: `…/Tests/MushafCoreTests/ReviewDraftTests.swift`

**Interfaces:**
- `NarratorDisplay.describe(_ narrators: [ReviewNarrator], catalog: [CatalogNarrator]) -> [NarratorChip]` (`NarratorChip(label: String, readerId: String, colorHex: String?)`; both narrators of a reader collapse to the reader's name; one narrator keeps its own name in the reader's colour); `FacesSummary.summarize(rows:catalog:) -> String`.
- `ReviewDraftFields` (kind, categoryCodes selection, variantType, readingText, uthmaniText, description, performanceNote, rulingText, notes, appliesWasl, appliesWaqf, hamzahDetail, narrators: [NarratorInput]); `ReviewDraft.nextWajhOrder(narrator:existing:) -> Int` (after the highest existing wajh; Hafs `Q05-R02` never below 2); `ReviewDraft.validate(_:isNew:) -> [DraftIssue]` (needs a narrator; farsh needs reading text; usul needs a category; Hafs with wajh ≥ 2 needs a note; at least one of وصل/وقف); `ReviewDraft.savePlan(draft:existingRow:locus:) -> [SaveStep]` (`SaveStep` = `.create(CreateEntryInput)`, `.update(entryId, EntryFields)`, `.setNarrators(entryId, [NarratorInput])`, `.setStatus(entryId, ReviewStatus)`; the primary category first, then one sibling `.create` per extra category; Hamzah/Imalah categories are single-choice: ticking one replaces the selection); `isDirty(original:current:)`.

- [ ] **Step 1: Write failing tests:** `wajhOrderGoldenParity` (web `nextWajhOrder`), `hafsNeverWajhOne`, `bothNarratorsCollapseToReader`, `singleNarratorKeepsNameWithReaderColour`, `validateRejectsFarshWithoutReadingText`, `validateRequiresHafsNoteOnSecondWajh`, `savePlanCreatesSiblingPerExtraCategory`, `hamzahCategoryReplacesSelection`, `unchangedDraftIsNotDirty`.
- [ ] **Step 2: Run** `--filter ReviewDraftTests`. Expected: FAIL.
- [ ] **Step 3: Implement** as ports of `narratorDisplay.ts`, `facesSummary.ts` and `useReviewEditorDraft.ts` (save plan and validation) plus `nextWajhOrder` from `ImalahDetailFields.tsx`.
- [ ] **Step 4: Run** `--filter Review`. Expected: PASS.
- [ ] **Step 5: Commit** `iOS: review draft rules and narrator display`.

### Task 7: Save queue

**Files:**
- Create: `…/Review/ReviewQueue.swift`
- Test: `…/Tests/MushafCoreTests/ReviewQueueTests.swift`

**Interfaces:**
- Consumes: `ReviewAPI`-like closures. Produces: `actor ReviewQueue` initialised with `executor: @Sendable (SaveJob) async -> Result<ReviewRow, ReviewError>`; `SaveJob(id: UUID, entryKey: String, steps: [SaveStep], placeholderId: String?)`; `enqueue(_:)`; `AsyncStream<QueueEvent>` of `.started, .rowUpdated(jobId, ReviewRow), .succeeded(jobId), .failed(jobId, ReviewError, resumeFrom: Int)`; `pending: Int`; `retry(jobId)`; `dismiss(jobId)`. Jobs with the same `entryKey` run in order; different keys run concurrently. Before each step the executor receives the latest known `version` for that entry (the row returned by the previous step). A failed job resumes from the failed step on retry (steps already done are never repeated, so a create is never duplicated).

- [ ] **Step 1: Write failing tests:** `sameEntryJobsRunInOrderWithFreshVersion` (second update sees the version returned by the first), `differentEntriesRunConcurrently`, `failureReportsResumeIndexAndRetryContinuesFromIt`, `retryDoesNotRepeatCompletedCreate`, `pendingCountsQueuedAndRunning`.
- [ ] **Step 2: Run** `--filter ReviewQueueTests`. Expected: FAIL.
- [ ] **Step 3: Implement** as an actor with per-key task chains.
- [ ] **Step 4: Run** `--filter Review`. Expected: PASS.
- [ ] **Step 5: Commit** `iOS: review save queue`.

---

## Milestone 3: Page canvas and review/approve

### Task 8: ReviewStore (page state, selection, quick actions)

**Files:**
- Create: `apps/ios/Sources/ReviewEditor/ReviewStore.swift`, `apps/ios/MushafCore/Sources/MushafCore/Review/ReviewWordKeys.swift`
- Test: `apps/ios/Tests/ReviewStoreTests.swift`, `…/MushafCoreTests/ReviewWordKeysTests.swift`

**Interfaces:**
- Core: `ReviewWordKeys.key(for word: MushafWord) -> String?` (`"SSS:AAA:WWW"` zero-padded; nil for non-word glyphs such as ayah markers) and `ReviewWordKeys.index(page: MushafPage) -> [String: MushafWord]`.
- App (`@MainActor @Observable final class ReviewStore`, wrapped in `#if DEBUG`): `init(api: ReviewAPI, library: MushafLibrary, queue: ReviewQueue)`; state `page: ReviewPage?`, `mushaf: MushafPage?`, `rows`, `selectedKey: String?`, `spanEndKey: String?`, `overview`, `loadError: ReviewError?`, `saveStatus` (`.idle, .saving(Int), .saved(Date), .failed(ReviewError)`); `load(page:)`, `select(key:extendSpan:)`, `rows(forKey:) -> [ReviewRow]` (active rows whose span contains the word, ordered by `entryOrder`), `status(forKey:) -> WordStatus` (`none, unreviewed, reviewed, flagged` with flagged > unreviewed > reviewed), `nextUnreviewedKey(after:)`, `nextFlaggedPage()`, `approve(row:)`, `flag(row:note:)`, `delete(row:)`/`restore`, optimistic row replacement from queue events, silent re-read when the queue empties, and a call to `QiraatLiveSync.shared.refresh(page:store:force:true)` after a successful save. `Locus`/span rules: a two-word or cross-ayah face is returned for every word it spans.

- [ ] **Step 1: Write failing tests:** core `everyWordKeyMatchesWebFixtures` (for all 604 pages compare `ReviewWordKeys` over `Generated/mushaf.sqlite` with the key set computed from `packages/quran-data/mushaf1441/fixtures/page-words/page-NNN.json` read at test time from `REPO_ROOT`; failing messages list the first mismatch), `markersAndPausesHaveNoKey`; app `twoWordFaceShowsOnBothWords`, `statusPriorityFlaggedWins`, `approveSendsStatusAndReplacesRowWithServerVersion`, `failedApproveRestoresRowAndSetsFailedStatus`, `nextUnreviewedSkipsReviewedAndWrapsToNextPage`, `successfulSaveRefreshesLiveOverlay` (injected refresh closure called once with `force: true`).
- [ ] **Step 2: Run** core filter then `make project` + `xcodebuild test … -only-testing:MutshabehatTests/ReviewStoreTests`. Expected: FAIL.
- [ ] **Step 3: Implement.** Page words come from the API's `words`; the Mushaf canvas uses the local database page; the two are joined by key.
- [ ] **Step 4: Run** both. Expected: PASS.
- [ ] **Step 5: Commit** `iOS: review store`.

### Task 9: Page canvas, page screen, home, entry row

**Files:**
- Create: `Sources/ReviewEditor/ReviewPageCanvas.swift`, `ReviewPageScreen.swift`, `ReviewHomeView.swift`, `ReviewEditorEntry.swift`, `ReviewStatsBars.swift`
- Modify: `Sources/Reader/ReaderView.swift` (one `NavigationLink` row inside the existing `#if DEBUG` Developer section, identifier `open-review-editor`)
- Test: `UITests/ReviewEditorUITests.swift`, `Tests/ReviewPageCanvasTests.swift`

**Interfaces:**
- `ReviewPageCanvas: UIViewRepresentable` taking `page: MushafPage`, `statusFor: (String) -> WordStatus`, `selectedKeys: Set<String>`, `onTap: (String) -> Void`; it draws with `PageLayout` and `QCFFontStore.line` (never another page's font), tints each word (reviewed green, unreviewed amber, flagged red, system colours with Dark Mode variants), a ring on selected words, hit-test via `PageLayout.word(at:)`. `ReviewPageScreen(store:)` shows the canvas, a top bar (surah, page, `‹ ›`, home), `ReviewStatsBar` (page and Mushaf totals from `stats`/`overview`) and `ReviewSaveStatusBar` («جارٍ الحفظ… (N)», «✓ تم الحفظ · HH:MM:SS», failure with «إعادة المحاولة»). `ReviewHomeView` has page stepper/`Picker`, surah list, overall progress, buttons «التالي غير المراجع» and «التالي المُعلَّم». `ReviewEditorEntry` creates the store and presents everything as a `fullScreenCover` from the Settings row.

- [ ] **Step 1: Write failing tests:** canvas unit `tintsAndSelectionAreComputedFromStatus`; UI test `reviewEditorRowOpensAndShowsPage` (launch with `-review-stub` argument that injects a stub transport serving a bundled synthetic page; assert row exists in Settings → المطور, cover opens, the page canvas and stats bar exist, tapping a word selects it) and `readerSettingsOtherRowsUnchanged` (the existing rows' identifiers all still exist).
- [ ] **Step 2: Run** the new tests. Expected: FAIL.
- [ ] **Step 3: Implement.** A `-review-stub` launch argument (DEBUG) swaps in `StubReviewTransport` serving fixtures from `Tests` resources copied into the app only for UI tests (a synthetic, hand-written page; no real data).
- [ ] **Step 4: Run** the tests and `make test` subset for the reader UI tests (`ReaderUITests`) to prove nothing moved. Expected: PASS.
- [ ] **Step 5: Commit** `iOS: review editor page screen and entry`; add the CHANGELOG entry.

### Task 10: Word sheet: faces, references, approve

**Files:**
- Create: `Sources/ReviewEditor/ReviewWordSheet.swift`, `FacesStepView.swift`, `ReferenceStepView.swift`, `ApproveStepView.swift`, `NarratorChipsView.swift`
- Test: `Tests/ReviewWordSheetTests.swift`, `UITests/ReviewEditorUITests.swift`

**Interfaces:**
- `ReviewWordSheet(store:)` is a `.sheet` with detents `.medium, .large`, a segmented step indicator «الأوجه · المراجع · التحرير · اعتماد», and a sticky bottom action area. `FacesStepView` lists faces with status chips and swipe/buttons for ✓ اعتماد, ⚑, 🗑 (with undo toast), plus «+ وجه جديد». `ReferenceStepView` has the nquran | الشامل segmented control (stored in `UserDefaults` key `review:reference-source:v1`), groups with the five badges, and «➕ إضافة» calling `ReferenceApply`. `ApproveStepView` shows «حفظ واعتماد» when `ReviewDraft.isDirty`, otherwise «اعتماد»; dirty state shows «تعديلات غير محفوظة — اضغط حفظ». `store.requestSelect(key:)` returns `.needsConfirmation` while the draft is dirty; the sheet then shows a confirmation dialog («تجاهل التعديلات؟» / «العودة») before switching word or page or closing.

- [ ] **Step 1: Write failing tests:** `dirtyDraftBlocksWordSwitchUntilConfirmed`, `approveWithDirtyDraftQueuesSaveThenApprove` (steps `.update…`, `.setStatus(reviewed)` in one job), `referenceAddFillsDraftNarratorsAndShowsInDraftBadge`; UI `tapWordOpensSheetWithFaces` and `approveClosesSheetAndOpensNextUnreviewedWord` against the stub transport.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** steps 1, 2, 4 (step 3 shows a placeholder editor until Task 11).
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `iOS: review word sheet (faces, references, approve)`.

---

## Milestone 4: Add and edit

### Task 11: Editor step (فرش، أصول، readers, وصل/وقف)

**Files:**
- Create: `Sources/ReviewEditor/EditStepView.swift`, `CategoryPickerView.swift`, `ReaderNarratorPickerView.swift`, `FarshFieldsView.swift`
- Modify: `ReviewStore.swift` (draft ownership, `saveDraft(approve:)`)
- Test: `Tests/ReviewDraftFlowTests.swift`

**Interfaces:**
- `ReviewStore.draft: ReviewDraftFields?`, `startNewDraft(for key:)`, `startEditing(row:)`, `saveDraft(approve: Bool)` which builds `ReviewDraft.savePlan` and enqueues one `SaveJob` (optimistic row, placeholder id `tmp-N`), closes the sheet and selects the next unreviewed word. The category list shows every category from `ReviewPage.categories` (multi-select, search through `Arabic.normalize`; Hamzah/Imalah categories single-choice and open their builder in Task 12); the reader grid shows the 10 readers coloured from the catalog with their two narrators, presets (الكل، السبعة، الثلاثة، الكوفيون، المدنيان، مسح), per-narrator «الأداء» and wajh number/note, and the Hafs rule note. `existingCategory` and `rulingText` are preserved untouched when not edited.

- [ ] **Step 1: Write failing tests:** `newFarshDraftCreatesEntryWithNarrators`, `multiCategorySaveCreatesSiblings`, `editingExistingRowSendsOnlyChangedFields`, `savePlanKeepsRulingTextAndHamzahDetailUntouched`, `hafsSecondWajhRequiresNoteBeforeSave`, `failedCreateGivesDraftBack`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** the views and store functions.
- [ ] **Step 4: Run** unit tests and the UI test `addFaceFromReferenceAndApprove` (stub transport asserts the PATCH/POST bodies). Expected: PASS.
- [ ] **Step 5: Commit** `iOS: review editor step`; CHANGELOG entry.

---

## Milestone 5: Hamzah and Imalah builders

### Task 12: Builders

**Files:**
- Create: `…/Review/HamzahBuilder.swift`, `…/Review/ImalahBuilder.swift`, `Sources/ReviewEditor/HamzahBuilderView.swift`, `ImalahBuilderView.swift`
- Modify: `apps/ios/scripts/review_golden.mjs` (`imalah.json`: `buildImalahRulingText`, `detectImalahType`, presets; `hamzah.json`: synthesized action text)
- Test: `…/Tests/MushafCoreTests/BuilderTests.swift`

**Interfaces:**
- Pure core ports of `ImalahDetailFields.tsx` (`ImalahBuilder.rulingText(...)`, `detectType(...)`, narrator presets with their actions) and `HamzahDetailFields.tsx` (`HamzahBuilder.actionText(detail:)`, treatments, الإدخال, performance conditions, بخلف/قولاً واحداً, preset groups, `wordKeys` assignment for `HAMZATAN_KALIMATAYN` with a two-word span). The views let the reviewer pick who (preset group, reader or narrator), how (إمالة/تقليل/فتح, treatments), وصل/وقف and add the face; faces list with edit, delete, «+ وجه آخر لنفس الراوي» using `ReviewDraft.nextWajhOrder`. Saving persists `narrators` and `hamzahDetail` through the normal save plan.

- [ ] **Step 1: Write failing tests:** golden parity for ruling/action text over all web combinations (the golden script enumerates them), `imalahPresetAssignsExpectedNarrators`, `kalimatainWordKeysRoundTrip`, `facesGetSequentialWajhOrder`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** core then views.
- [ ] **Step 4: Run** `--filter BuilderTests` and the UI test `imalahFaceIsAddedAndSaved`. Expected: PASS.
- [ ] **Step 5: Commit** `iOS: Hamzah and Imalah builders`.

---

## Milestone 6: History, suggestions, copy, apply to all

### Task 13: History and undo

**Files:**
- Create: `Sources/ReviewEditor/ReviewHistoryView.swift`; modify `ReviewStore.swift` (`loadHistory()`, `undo(txid:)`)
- Test: `Tests/ReviewHistoryTests.swift`

**Interfaces:** `ReviewHistoryView` lists transactions of the page (time, device, changes summarised as «تعديل الحالة» etc., `undone` flag) with «تراجع» calling `ReviewAPI.undo`; `UNDO_CONFLICT`/`UNDO_REFUSED` show their Arabic messages; page re-read after undo.

- [ ] **Step 1: Write failing tests:** `undoCallsApiThenReloadsPage`, `undoConflictShowsMessageAndKeepsList`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `iOS: review history and undo`.

### Task 14: Suggestions, same-word copy, apply to all occurrences

**Files:**
- Create: `Sources/ReviewEditor/SuggestionsView.swift`, `SameWordView.swift`, `ApplyAllView.swift`; modify `FacesStepView.swift`, `ReviewStore.swift`
- Test: `Tests/ReviewBulkTests.swift`

**Interfaces:** suggestions load on word selection (debounced 250 ms, hidden while a span is selected) and «➕ إضافة» creates an ordinary unreviewed entry through the queue (disabled when a farsh narrator is already on another farsh wajh of the word); same-word panel «نسخ الوجه» and «✓ تحقق من بيانات معتمدة» (filter to approved same-category) with a preview and «تأكيد النسخ» before `copyEntry`; apply-to-all lists `findOccurrences` candidates (`exists`/`add`), select, then `bulkApply`, showing added/skipped/errors.

- [ ] **Step 1: Write failing tests:** `suggestionAddCreatesUnreviewedEntry`, `suggestionDisabledWhenNarratorAlreadyOnFarshWajh`, `copyRequiresPreviewConfirmation`, `verifiedSameCategoryFilter`, `applyAllSendsOnlySelectedAddTargets`, `applyAllReportsSkippedAndErrors`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `iOS: review suggestions, copy and apply to all`; CHANGELOG entry.

---

## Milestone 7: Polish, release guard, docs

### Task 15: iPad, accessibility, Release guard

**Files:**
- Modify: `Sources/ReviewEditor/*` (iPad layout: page canvas left, sheet content in a side column at regular width; VoiceOver labels and traits; Dynamic Type), `apps/ios/Makefile` (`release-guard` target: `xcodebuild … -configuration Release build` then `strings` over the binary asserting none of `qiraat-review`, `ReviewStore`, `ReviewEditorEntry`; and that the `.app` contains no `ReviewReference` folder), `apps/ios/scripts/test_release_guard.py`
- Test: `UITests/ReviewEditorUITests.swift` (iPad run `make test-ipad`)

- [ ] **Step 1: Write failing tests:** `reviewEditorOnIPadShowsSideBySide`, `everyReviewControlHasAccessibilityLabel` (walks the sheet's buttons), script test `release_guard_detects_leaked_symbol` with a fake binary.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** layout, labels and the guard (the guard is added to `make test`).
- [ ] **Step 4: Run** `make test`, `make test-ipad`, `make release-guard`. Expected: all PASS; `make check-isolation` clean.
- [ ] **Step 5: Commit** `iOS: review editor iPad layout, accessibility and release guard`.

### Task 16: Docs, decision record, final review

**Files:**
- Modify: `apps/ios/AGENTS.md` (§1: the developer editor may write through the web review API; §2 commands `review-data`, `release-guard`; §3 table row `Generated/Review/**`), `apps/ios/README.md`, `apps/ios/HANDOFF.md`, `apps/ios/CHANGELOG.md`

- [ ] **Step 1: Update** the docs; record the 2026-10-05 decision and how to open the editor (Settings → المطور → محرر القراءات, DEBUG builds only).
- [ ] **Step 2: Run** `make test`, `make test-ipad`, `make release-guard`, `make check-isolation`, `make device` is NOT run without the owner. Expected: PASS.
- [ ] **Step 3: One fresh whole-branch review** by a separate reviewer focused on the diff against `ios/main` and the spec; fix what it finds.
- [ ] **Step 4: Merge** `ios/review-editor` into `ios/main` (no push). **Commit** `iOS: review editor docs and decision record`.
