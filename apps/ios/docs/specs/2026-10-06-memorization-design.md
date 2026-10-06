# حفظ القرآن (Memorization) in the Qiraat iOS app: design

Date: 2026-10-06. Status: implemented on `ios/memorization` (not merged); see `docs/memorization-acceptance.md`. Design approved by the owner in chat, section by section. Revised the same day after
the owner's review of the written spec: memorization is **Hafs only** and unrelated to Qiraat (§3.4); the page
status is shown as a **mark in the reader's top banner** with **four states** (§4.1, §11).
Branch: `ios/memorization` from `ios/main`. Everything lives under `apps/ios` (isolation rule, `AGENTS.md` §1).

## 1. Goal

A long-term memorization companion inside the Mushaf reader. The owner records, measures, visualizes and
reviews Quran memorization, ayah by ayah, and can update it in seconds from the module or from the Mushaf.

Success criteria (the owner's §50 acceptance list is the definition of done; this is its summary):

1. **Ayah-level truth.** The ayah status is the only stored fact. Surah, page, juz and Quran figures are
   always derived from it, never stored, so they cannot disagree.
2. **Four questions answered separately.** How much is truly memorized (strict, `متقن`); how much can I
   recite even with mistakes (`متقن` + `محفوظ مع أخطاء`); how much have I started (weighted progress); what
   should I review next (review strength + dates). Two headline percentages are never merged into one.
3. **Fast entry.** Whole surah, ayah range, page range, juz, or "from here to here" in the reader, each in a
   few taps, always with a confirmation for large changes and an undo afterwards.
4. **No loss.** Local-first, atomic bulk updates, migration-safe schema, plus backup of all app data to an
   iCloud Drive folder and JSON export/import (§9).
5. **Nothing existing breaks.** Reader, Qiraat colours and layer rules, bookmarks, reading statistics and
   streaks, Mutshabehat, search, settings and sync behave as before. Memorization never recolours Quran text.

Non-goals: any relation to the Qiraat feature (memorization is Hafs only, §3.4); hizb and quarter-hizb
selection (§2); cloud sync between devices (the model is merge-ready, no network feature is built);
audio; changes to the web app or its database.

## 2. Findings that shape the design

Verified against the repository on 2026-10-06:

- **Ayah → page is a function.** All 6,236 ayat sit on exactly one page (`words` rows, `char_type = 'end'`,
  zero ayat span two pages). A page can hold ayat of two surahs; each ayah still belongs to one page.
- **Juz is page-aligned; hizb and rub are not reliable.** `pages` holds 30 juz that change only at page
  starts. Hizb and rub are one value per page, while real boundaries fall mid-page, and the ۞ marker occurs
  199 times against 240 rubs. Whole-juz selection is supported; hizb and quarter-hizb are not.
- **Persistence is raw SQLite, one file per module** (`QuranReadingDatabase`, `MutshabehatDatabase`: `sqlite3`,
  WAL, an `NSLock`, `@unchecked Sendable`). There is no SwiftData or Core Data. Memorization follows this.
- **Pure logic lives in the `MushafCore` Swift package** (no UIKit, Swift Testing); UI in `Sources/`.
- **No tab bar.** The reader is the root; modules open as full-screen covers from `ReaderTopBar`
  (Mutshabehat does). Settings, bookmarks and statistics are sheets.
- **No iCloud entitlement exists** (a free personal team cannot have one). The existing sync is one-way,
  from a Mac-made `Mushaf_Qiraat` folder into the app, using a user-picked folder bookmark
  (`ICloudDatabaseSyncService.setCustomFolder`). Backups reuse that mechanism (§9).
- **Existing reading stats and streaks are for reading only** (`ReadingTracker`, `mushaf_reading.sqlite`).
  Memorization keeps its own data and its own streak.
- **Swift Charts is available** (iOS 18 minimum) and unused so far.
- The ayah long-press (0.45 s, haptic) currently opens a bookmark confirmation dialog; bookmarks draw a
  crimson ribbon above the ayah-end marker; Qiraat marks sit on words. The space below the end marker is free.

## 3. Domain model (`MushafCore/Memorization/`)

### 3.1 Records and enums

```swift
enum MemorizationStatus: Int { case mastered = 1, memorizedWithErrors = 2, needsMushaf = 3, notMemorized = 4 }
enum ReviewStrength: Int { case strong = 1, good = 2, needsReview = 3, weak = 4, notReviewed = 5 }

struct AyahMemorizationRecord {
    var surah: Int; var ayah: Int
    var status: MemorizationStatus          // default notMemorized
    var reviewStrength: ReviewStrength       // stored = result of the last review; default notReviewed
    var isCurrentlyLearning: Bool            // independent flag, not a fifth status
    var firstMemorizedAt, lastStatusChangedAt, lastReviewedAt, nextReviewAt: Date?
    var reviewCount, successfulReviewCount, consecutiveSuccessfulReviews, errorCount: Int
    var updatedAt: Date
}
```

Raw values are stable and persisted. An ayah with no stored row means "not memorized, not reviewed"; rows
exist only for ayat that have been touched, so the table is sparse. Quran text is never stored.

### 3.2 `QuranIndex`

Built once at launch from `mushaf.sqlite` (no new Quran metadata): per-surah ayah counts, the ayah list in
Mushaf order with a global ordinal (0…6235), ayah → page, page → ayah list, per-page word counts per ayah,
juz → page range, surah → pages occupied. All selection resolution (§5.1) goes through it.

### 3.3 Policy

`MemorizationPolicy` is the single place for tunable numbers: status weights (1.0 / 0.75 / 0.4 / 0.0), the
review interval ladder (§6), the strength-aging thresholds, the big-update confirmation threshold (a full
surah or more than 30 ayat), and milestone percentages (25 / 50 / 75 / 100). No view contains a formula.

### 3.4 Hafs only, no Qiraat

Memorization is measured **only on Hafs**, the Mushaf 1441 text the reader prints. A record is keyed by the
Hafs ayah `(surah, ayah)` and has no Qiraat, reader or narrator field; nothing in the module reads or writes
Qiraat data, and the Qiraat layer, its colours, its modes (including القراءة برواية) and its rules never
influence a memorization figure or marker. Memorization marks are drawn independently of Qiraat marks.
(Backing up the Qiraat snapshot with the other app data, §9, is a separate matter and is not part of the
memorization data or its JSON.)

Not modelled: hizb and quarter-hizb (§2).

## 4. Statistics (`MemorizationStatisticsService`)

A pure function of `[ayah → record]` and `QuranIndex`. Every screen reads from it.

- **Counts** per status over all 6,236 ayat; **strict %** = mastered ÷ total; **learning %** = Σ weight ÷
  total; **can recite** = mastered + with-errors.
- **Surah.** Complete = every ayah mastered (the only thing counted as "completed"); partial = any ayah
  above not-memorized; a secondary "complete including minor errors" count is shown but never mixed into
  the strict one. Per-surah strict and learning %.
- **Page.** Mastered = every ayah on the page mastered. Page-equivalent = Σ over mastered ayat of
  (ayah word count ÷ page word count), so the 604 pages sum to exactly 604; surah header lines are ignored
  (documented approximation). Dashboard tile: "pages fully mastered / 604" with the page-equivalent and its
  percentage beneath. A per-page mix (mastered / errors / needs / none fractions) feeds the page grid, computed
  in one pass for all 604 pages.
- **Page status (§4.1)** gives every page one of four states.
- **Juz.** Whole-juz progress from page ranges; completed juz count.
- **Review backlog.** Memorized (mastered or with-errors) ayat that are due: `nextReviewAt ≤ now`, or never
  reviewed. Per-surah overdue average for suggestions.
- **Time-based figures from the change log.** The state at any past instant is the current state with later
  events rolled back (the earliest later event of each ayah holds its prior row). One backwards pass over
  the log gives exact weekly and monthly gains (new ayat = net ayat that moved into mastered or
  with-errors; page-equivalents of those ayat; surahs completed in the period) and the points of the
  progress-over-time series (strict, optionally learning) for 7 days / 30 days / 3 / 6 months / year / all.
- **Budgets (release mode):** full snapshot ≤ 20 ms, page-mix for 604 pages ≤ 10 ms.

### 4.1 Page status: four states

Every page has exactly one of four states, the same four as the ayah statuses, so the banner mark, the page
grid and the "pages fully mastered" count always agree. The rule is **weakest link**: the page takes the
status of its weakest ayah, in the order متقن › محفوظ مع أخطاء › يحتاج المصحف › غير محفوظ. So a page is:

- **متقن** only when every ayah on it is mastered (this is also the "page fully mastered" rule of §4);
- **محفوظ مع أخطاء** when every ayah is memorized (mastered or with errors) and at least one has errors;
- **يحتاج المصحف** when no ayah is unmemorized but at least one needs the Mushaf;
- **غير محفوظ** when at least one ayah is not memorized.

Because weakest-link is strict, a partly memorized page reads «غير محفوظ»; to keep that honest, every place
that shows a page state also shows its **ayah mix** (the four fractions by ayah share and the count of
mastered ayat, e.g. «٧ من ١٠ متقنة»), so progress inside a page is never hidden. The service returns, per
page, the state and the mix, computed in one pass for all 604 pages.

## 5. Updating

### 5.1 Selection

`MemorizationSelection`: surah, ayah range (surah + from/to), page range, juz, explicit ayah set, or a
reader range (from ayah A to ayah B, possibly across surahs, in Mushaf order). `QuranIndex` resolves any
selection to ayah keys. A text parser accepts «البقرة 255», «يس», «صفحة 42», «الجزء 30» (using the app's
Arabic normalizer) and returns a selection or a navigation target.

### 5.2 Planner and apply

A pure planner takes a selection, the new status (and optionally the learning flag), the current records and
`now`, and returns a `BatchPlan`: exactly which ayat change (no-ops dropped) and their before/after rows. The
confirmation text uses it («سيتم تحديث 83 آية من سورة يس إلى "متقن"»; if some already have the status it says
so). A full surah or more than 30 ayat requires confirmation; smaller updates apply at once. Applying is one
SQLite transaction writing the ayah rows, the batch and the change-log rows together.

Side effects: `first_memorized_at` is set the first time an ayah reaches mastered or with-errors (never
cleared); `last_status_changed_at` and `updated_at` are set; the learning flag clears automatically when an
ayah becomes mastered and otherwise changes only through its own toggle. Setting not-memorized is an ordinary
update (nothing is deleted).

### 5.3 Undo

Undoing a batch writes each ayah's saved prior row back, in one transaction, and marks the batch undone; it
stays visible in history. If a later non-undone batch touched any of the same ayat, undo first asks, since it
would overwrite newer work. An undo is itself recorded (kind `undo`, referencing the batch).

### 5.4 Milestones and completion

Applying a batch returns the milestones it crossed, found by comparing the before and after snapshots: a
surah finished, a juz finished, 25 / 50 / 75 / 100 % strict. Each is reported once (`milestones_seen` in
meta). At 100 % strict the first completion date is stored (`quran_completed_at`) and never erased; progress
is never reset; the dashboard moves to maintenance and review wording («تم حفظ القرآن كاملًا»).

## 6. Review

Four results: ممتاز → strong, جيد → good, أخطاء → needs review, لم أتذكر → weak. A review of a selection:
`review_count` +1; success (strong or good): `successful_review_count` +1 and `consecutive_successful` +1;
otherwise `consecutive_successful` = 0 and `error_count` +1; `last_reviewed_at` = now; `next_review_at` from
the ladder: after 1, 2, 3, 4, 5, 6+ consecutive successes the gap is 1, 3, 7, 14, 30, 60 days; after a failed
review 1 day (لم أتذكر) or 2 days (أخطاء). **A review never changes the memorization status.**

Displayed strength ages with time: a memorized ayah past `next_review_at` shows at most "needs review", and
well past it (more than twice its last interval) "weak"; never-reviewed memorized ayat show «لم تتم المراجعة»
and count as due. The stored value is the last review result; the displayed value is computed, so an ayah can
stay `متقن` while its strength shows weak.

**Smart suggestion** (no network): first the current-learning range with ayat remaining («أكمل سورة النبأ،
متبقٍ ٨ آيات»), then the memorized surah with the largest average overdue («راجع سورة الملك، آخر مراجعة منذ
٨ أيام»); ties broken in Mushaf order.

## 7. Streak and goals

**Streak (memorization only).** Each batch stores whether it counts: a status change that moves an ayah up
into mastered or with-errors, or a review. Opening the module, downgrades, undos and imports do not count.
The streak is derived from non-undone qualifying batches grouped by local day, so undoing a batch also takes
back its credit.

**Goals (optional):** X ayat per day; X page-equivalents per week; complete a surah; complete a juz; complete
the Quran by a date. Progress and remaining amount (days, page-equivalents) are derived from the statistics
service; goals store only their definition.

## 8. Storage (`mushaf_memorization.sqlite`, `Sources/Memorization/MemorizationDatabase`)

Raw `sqlite3`, WAL, foreign keys, one lock, in Application Support, like `QuranReadingDatabase`.

| Table | Content |
|---|---|
| `memorization_ayahs` | `(surah, ayah)` PK, status, review strength, `is_learning`, the four timestamps, four counters, `updated_at` |
| `memorization_batches` | `id` (UUID), `created_at`, `kind` (update / review / undo / import), `label`, `scope` (JSON), `ayah_count`, `device_id`, `counts_for_streak`, `gain_ayahs`, `undone_at`, `undoes_batch_id` |
| `memorization_events` | one row per changed ayah: batch, ayah, old/new status, old/new strength, `before` (full prior row as JSON, null if none), `at` |
| `memorization_goals` | goal definitions |
| `memorization_meta` | `schema_version`, current position (surah/ayah), `quran_completed_at`, `milestones_seen`, display settings, device id |

Indexes on events (`at`, `batch_id`, ayah) and batches (`created_at`). Migrations are ordered steps keyed by
`schema_version`; a v1 file is opened by newer code in tests. Rows are never deleted. Every write path is a
transaction, so a kill mid-update leaves either the old or the new state, never a partial one. Records carry
`updated_at` and batches a device id so a later sync or merge needs no model change.

In memory: all statuses are loaded at launch (a few KB) into the store; the UI reads the store, and a version
counter notifies observers.

## 9. Backup and restore

**Destination.** A `Backups/` subfolder of the iCloud Drive folder the owner picks once (the existing
`Mushaf_Qiraat` bookmark mechanism). Writes use `NSFileCoordinator`. Backups never touch the Mac-made sync
files at the folder root, and the existing import never reads `Backups/`.

**A backup set** (everything, per the owner's decision):
- `memorization.json`: canonical, versioned, human-readable: ayah records, full history (batches and events),
  goals, meta. This is also the manual export file.
- A SQLite snapshot of each store (`memorization`, `reading`, `mutshabehat`), taken with SQLite's online
  backup API so it is consistent while the app runs.
- `qiraat.qiraatdata`: the existing archive format, written to `Backups/shared/` only when its content hash
  changes, not repeated per version.
- `manifest.json`: format version, device id, app version, and size, hash and row counts for every file.

**Layout and retention.** `Backups/latest/` holds the newest complete set; `Backups/history/<date-time>/`
keeps one set per day for 14 days. A set is built in a staging folder, verified (hashes, SQLite
`integrity_check`, JSON re-read) and only then moved into place; the previous `latest` is never removed before
the new one is verified.

**Triggers.** 30 s after the last memorization change; when the app backgrounds with unsaved changes (background
task); at launch if the last backup is older than 24 h; manual «نسخ احتياطي الآن». A run is skipped if nothing
changed since the last manifest. Backup never blocks the UI and a failed backup never affects the write path.
The Backup screen shows the last success and last error (folder missing, iCloud signed out, file not
downloaded). If nothing is backed up for 7 days, or no folder is set, the dashboard shows a quiet banner (a
free-team install expires after 7 days).

**Restore.** The owner picks a snapshot, sees a per-store preview, chooses stores. Before anything changes, the
current data is copied to a local safety folder (last 3 kept). Memorization: **Merge** (default; newer
`updated_at` wins per ayah; history unioned by batch id; a batch undone on either side stays undone) or
**Replace**. Reading, Mutshabehat and Qiraat: replace only, using the validate, swap, reopen,
roll-back-on-failure pattern (`MutshabehatDatabase.importDatabase`, `installQiraatBackup`; the reading store
gets the same importer). Each store restores atomically. Manual JSON import/export use the same merge or
replace logic; a newer format version is refused with a clear message, an older one is migrated.

## 10. Screens (`Sources/Memorization/`)

**Entry.** A «الحفظ» button in `ReaderTopBar` opens `MemorizationView` as a full-screen cover; a
`NavigationStack` inside. Launch argument `-open-memorization` for UI tests. A persistent «تحديث الحفظ» button
sits at the bottom of the dashboard.

**Dashboard**, in order: a headline (strict % large, «تقدم الحفظ» weighted beside it, a thin "can recite" line);
three tiles (السور x/114, الصفحات x/604 with page-equivalent beneath, الآيات x/6,236), each opening its detail;
«الحفظ الحالي» with «فتح في المصحف» and «تحديث الحفظ», current position settable; one segmented status bar
(tap a segment to filter); التقدم (week and month gains, the Swift Charts progress line with its range picker,
the memorization streak); يحتاج مراجعة; آخر النشاط (latest 3, link to history); الأهداف; المقترح اليوم; the
backup banner when relevant. A search field parses «البقرة 255» / «صفحة 42» / «الجزء 30» and navigates.

**Update sheet.** Bottom sheet, picker سورة | آيات | صفحات | جزء (searchable surah list; surah + from/to; page
from/to; 30-chip juz grid), four large status buttons, a «قيد الحفظ» toggle, a live count line, the §5.2
confirmation, then a toast «تم تحديث N آية — تراجع» for about 8 s; milestones shown quietly.

**Detail screens.** Surah list (114 rows, search by Arabic name; sort by Mushaf order / most / least memorized;
filter complete / incomplete / currently learning / needs review; row = percentage, «متقن: 180 / 286»,
segmented bar). Surah detail (strict and weighted %, four counts, pages occupied, last review, review
strength, current position, last memorized ayah, the ayah strip of same-status runs as proportional segments,
tap → Mushaf, update and open buttons). Page grid (604 cells; each shows the page's four-state shape and a mini stacked fill of its ayah mix; tap
opens the Mushaf page, long-press the page actions; legend of the four states). Ayah status list (filter by status, due,
currently learning; grouped by surah and page; tap opens the Mushaf). History (batches by day with the
status change summary; undo). Goals. Review. Backup and restore.

**Visual language.** Restrained palette (deep green, amber, slate, hairline grey) over the existing Mushaf
appearances' ink and linen; no gradients, no rainbow charts. Each status also has a shape (✓✓, !, ◐, ○) so
nothing depends on colour. Follows the app language and RTL; Dynamic Type; every chart has a VoiceOver summary
(«متقن ١٨٠ من ٢٨٦»); iPad uses two columns. Haptics only for milestones, a finished surah or juz, a reached
goal, and marking an ayah mastered; ordinary taps give none.

## 11. Reader integration

1. **Ayah long-press** (same gesture and 0.45 s as today) opens one compact sheet: the two bookmark actions
   (behaviour unchanged; the existing UI tests that use the dialog are checked and kept passing), «حالة
   الحفظ» with the four statuses and the current one marked, a «قيد الحفظ» toggle, and «تحديد من هنا».
2. **Range mode.** «تحديد من هنا» stores a start ayah; a bottom pill reads «من البقرة ١٢ — اختر آية النهاية»
   with a cancel button; pages can be turned; long-pressing another ayah (across surahs too) completes the
   range and opens a sheet with the count and four statuses, using the same planner, confirmation and undo.
3. **Page mark in the top banner** (the owner's request). The banner (`ReaderTopBar`) is one 52 pt slot that
   swaps between the reading header and the controls bar. A small page-status mark sits in that slot and is
   **visible in both modes**, so it never jumps (the existing single-slot rule). It shows the page's one of
   four states (§4.1) as a shape plus a short word, with a hairline bar of the ayah mix beneath:
   - ✓✓ **متقن** · ! **محفوظ مع أخطاء** · ◐ **يحتاج المصحف** · ○ **غير محفوظ**, each also in its own colour
     from the module's restrained palette (shape and word carry the meaning, so colour is never alone).
   The mark follows the page the banner describes; in the iPad spread, where two pages are visible, it shows
   one mark per page, labelled with the page number. It has its own tap target (tapping the header elsewhere
   still toggles the chrome): tapping it opens the **page sheet** «تحديث حفظ الصفحة» with the page's ayah mix,
   the four statuses applied to the whole page, and «تحديد آيات فقط» (the page's ayat as a checklist, then
   apply a status). «الصفحة كلها» is also offered in the ayah sheet. A setting «إظهار حالة الحفظ في الشريط
   العلوي» turns the mark off; it is **on by default**. Placement and width are verified on screenshots at
   iPhone and iPad widths.
4. **Optional ayah marker** (setting «إظهار حالة الحفظ على المصحف», off by default): a tiny monochrome shape
   under each ayah-end marker, ink at reduced opacity, no hue, no change to Quran text: filled disc = mastered,
   ring with a centre dot = with errors, plain ring = needs Mushaf, nothing = not memorized. The dashboard
   uses matching shapes. Final glyph sizes are tuned on a device. It cannot be confused with the Qiraat marks
   (different place, no hue) or the bookmark ribbon (above the marker).
5. **Wiring.** The store answers `pageState(page)` (state + mix) from the in-memory statuses for the banner
   mark, and one page's ayah statuses for the optional ayah marker (like `bookmarkedAyahs`); nothing is queried
   for a mark that is switched off; a change bumps a version counter and only the banner and the visible pages
   redraw.
6. **Open in Mushaf.** Every module screen calls one `openInMushaf(page, ayah)`: close the cover, set the page,
   highlight the ayah's words (the mechanism search results use).
7. **Boundaries.** Memorization never touches `ReadingTracker` or its streak, and has no relation to the Qiraat
   layer (§3.4): the layer's rules, colours, modes and word taps are unchanged, and the memorization marks
   look the same whatever Qiraat mode is on; resume-last-page is unchanged.

## 12. Code layout

| Path | Content |
|---|---|
| `MushafCore/Sources/MushafCore/Memorization/` | models, `QuranIndex`, `MemorizationPolicy`, statistics service, selection and parser, planner, undo, review, streak, milestones, suggestion, goals math |
| `MushafCore/Sources/MushafCore/Backup/` | manifest, hashing, retention planner, merge rules |
| `MushafCore/Tests/MushafCoreTests/` | Swift Testing suites for all of the above, against the real `mushaf.sqlite` |
| `Sources/Memorization/` | `MemorizationDatabase`, `MemorizationStore` (observable), dashboard and detail views, update sheet, charts |
| `Sources/Backup/` | folder resolution (reusing the sync bookmark), file coordination, backup service, restore views |
| `Sources/Reader/` | ayah sheet, range pill, page action, marker drawing and the pager hook (small, additive edits) |
| `Tests/`, `UITests/` | XCTest for the store and backup; XCUITest with a stub for dashboard, update, reader sheet, range mode |

`project.yml` changes only to add sources; `docs`, `CHANGELOG.md` entries are dated, newest first.

## 13. Testing

- **Core (Swift Testing, real `mushaf.sqlite`):** al-Fatiha 7 ayat all mastered → complete, one downgraded to
  errors → strict 6/7 and the weighted figure; a surah spanning several pages; a page holding two surahs; the
  page-equivalent shares summing to 604; juz and page-range boundaries; ayah-range edges and cross-surah
  ranges; the text parser; planner no-op handling; undo restores the exact prior rows and warns on overlap;
  streak ignores downgrades, undos and imports; the review ladder and aged strength; milestones fire once;
  rollback-by-events equals a recomputed past state; all percentages and counts; the four page states by the
  weakest-link rule (all-mastered, one with errors, one needs Mushaf, one unmemorized, empty page record), and
  the page-state count agreeing with "pages fully mastered"; memorization figures identical with and without
  Qiraat data present.
- **Persistence:** reopen keeps data; migration from a v1 file; a transaction that fails halfway leaves the old
  state.
- **Backup (temp folders):** set verification, retention, merge rules, restore rollback on injected failure.
- **App/UI:** XCTest for the store; XCUITest (stub) for the dashboard, the update flow with confirmation and
  undo, the reader sheet, range mode, on iPhone and iPad (`make test`, `make test-ipad`).
- **Performance (release):** statistics snapshot ≤ 20 ms, page mix ≤ 10 ms, a whole-Quran update ≤ 300 ms.
- **Baseline first:** the existing suite is run before any change, so pre-existing failures (four older UI
  tests) are recorded and not mistaken for regressions. `scripts/check_isolation.sh` runs at every phase.

## 14. Phases (each ends with build, tests, a dated `CHANGELOG.md` entry and a commit)

1. Data foundation: models, `QuranIndex`, database, migrations. 2. Statistics service. 3. Update engine
(parser, planner, apply, undo, review, streak, milestones). 4. Dashboard, top-bar entry, update sheet.
5. Surah / page / ayah screens, history, undo toast. 6. Reader integration. 7. Review UI and suggestion.
8. Backup, restore, JSON export/import. 9. Goals, progress charts, milestone celebrations.
10. Full regression (`make test`, `make test-ipad`, isolation check, performance pass, §50 acceptance review).

## 15. Risks and what cannot be proven here

- The top banner is a tight 52 pt slot: the page mark and the new «الحفظ» button are checked on screenshots at
  iPhone and iPad widths, in both header modes and in the iPad spread (two marks).
- Weakest-link makes a partly memorized page read «غير محفوظ»; the ayah mix shown beside every page state is
  the mitigation. If this reads wrongly in use, the rule is a single function to change.
- The ayah-sheet change must keep the existing bookmark UI tests passing.
- Real iCloud behaviour (evicted files, signed-out account, coordination) can only be confirmed on the owner's
  iPhone; the simulator exercises the host iCloud Drive path like the existing sync. The final report states
  exactly what was and was not verified.
- Page-equivalent by word count is an approximation (header lines ignored), documented in code.
- Hizb and quarter-hizb are excluded because the data is page-level only.
- Swift 6 strict concurrency with raw SQLite: follow the existing `@unchecked Sendable` + lock pattern.
- Memorization data is personal and local; nothing is sent to the web, and no data or keys are committed.
