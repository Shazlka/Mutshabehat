# Comprehensive Parity Matrix: Native iOS App ("Qiraat") vs. Web App (Phone-Width View)

---

## 1. NAVIGATION & SHELL

### iOS Root Structure & Entry Points
* **Root Architecture (`MutshabehatApp.swift:18-35`):** The native iOS app does not start in a group catalog; its root is always `ReaderView(library:)` presenting the full-screen Mushaf 1441 page canvas.
* **Top Navigation Slot (`ReaderTopBar.swift:8-32, 59-86, 116-120`):** A fixed 52pt single slot above the Mushaf page that remains visible during reading. It hosts:
  1. *Surah Title Button (`ReaderTopBar.swift:62`):* Tapping opens `IndexSheet` (Surah and Page index).
  2. *Section Information (`ReaderTopBar.swift:64, 94-108`):* Current Juz and Hizb text with a `RubDisc` quarter-hizb indicator glyph.
  3. *Page Memorization Status Mark (`ReaderTopBar.swift:68-79`):* A compact `PageStatusMark` showing the weakest-link status of the page (✓✓, !, ◐, ○) and its ayah mix bar; tapping opens `PageSheet`.
  4. *Qiraat Filter Chip (`ReaderTopBar.swift:80`):* Appears when a reader or narrator is selected; tapping opens `QiraatFilterGrid`.
  5. *Khatma Progress Bar (`ReaderTopBar.swift:83, 116-120`):* Shows active Khatma percentage (e.g. «ختمة ٤٥٪»); tapping opens `ReadingStatisticsView`.
* **Bottom Navigation Bar (`ReaderBottomBar.swift:8-12, 111-122, 205-224`):** A floating Liquid Glass capsule tab bar floating above the home indicator (`safeBottom`) with 6 primary touch slots:
  1. **الفهرس (`open-index`, `list.bullet`):** Opens `IndexSheet` (Surah search & page jump).
  2. **بحث (`search-button`, `magnifyingglass`):** Opens `AyahSearchView` (smart AST-based Quran search).
  3. **الفواصل (`bookmarks-button`, `bookmark.fill`):** Opens `BookmarksView` (Ayah & page bookmark lists with swipe-delete).
  4. **القراءات (`qiraat-button`, `character.book.closed`):** Opens `QiraatHubContent` floating glass menu (mode, riwayah, diff, filters).
  5. **المزيد (`more-button`, `ellipsis.circle`):** Opens a 3-row floating glass menu:
     - **المتشابهات (`square.stack.3d.up.fill`):** Opens `MutshabehatView` as a `.fullScreenCover` (`ReaderView.swift:359-361`).
     - **الحفظ (`book.closed.fill`):** Opens `MemorizationView` as a `.fullScreenCover` (`ReaderView.swift:365-374`).
     - **المتون (`books.vertical.fill`):** Opens `MutoonView` as a `.fullScreenCover` (`ReaderView.swift:362-364`).
  6. **الإعدادات (`settings-button`, `gearshape.fill`):** Opens `SettingsView` sheet (`ReaderView.swift:259-277`).
* **Settings Screen Contents (`ReaderSettingsView.swift:34-287`):**
  - *Quran Reading & Khatma (`:35-73`):* Navigation links to `ReadingStatisticsView` and `BookmarksView`, plus toggles for `keepScreenAwake` and `autoHidesFooter` (after 10s).
  - *Ten Qira'at (`:76-129`):* Qiraat enable toggle, Reader/Narrator picker, Farsh-only toggle, Subcategory toggle, and Usul categories view.
  - *Cloud Synchronization (`:130-148`):* iCloud Sync (`Mushaf_Qiraat`) status with connection indicator.
  - *Preferences (`:150-172`):* `ThemeSettingsView` (5 themes), `SurahBannerSettingsView`, and `LanguageSettingsView` (Arabic / English).
  - *Page Turn (`:173-186`):* Picker for `Curl` vs `Slide`.
  - *Landscape View (`:187-202`):* iPad-only picker for `Reading` (spread) vs `Learning` (sidebar).
  - *Developer (`:203-240`, DEBUG only):* Databases manager, Review Editor entry, and Card Review toggle.
  - *Memorization (`:242-253`):* Toggles for banner mark visibility and on-page Mushaf markers.
  - *Privacy & Support (`:255-277`):* Safari links to Privacy Policy (`LegalLinks.privacyPolicy`), Support, and in-app `AcknowledgementsView` (`:270-276`).
  - *Version (`:279-286`):* Displays app version string.

### Web App at Phone Width (< 768px)
* **Root Architecture (`src/app/(app)/layout.tsx:31-46`, `page.tsx:55-65`):** The web app root (`/`) is the Mutshabehat personal groups list, wrapped in an application shell (`AppLayout`) with a top mobile navigation header.
* **Top Header & Drawer (`src/components/MobileTopbar.tsx:49-165`):**
  - Sticky header (`:49-76`) with title, group count pill, and a burger button.
  - Slide-out drawer panel (`:89-165`) containing 9 navigation links:
    `المتشابهات (/)`, `الآلية (/automated)`, `السور (/surahs)`, `اختبر حفظك (/test)`, `المصحف (/mushaf-1441)`, `شبكة السور (/network)`, `إحصائيات (/stats)`, `أدوات (/tools)`, `إعدادات (/settings)`.
* **Mushaf Reader Route (`src/app/mushaf-1441/page.tsx:37-65`, `Mushaf1441Viewer.tsx:4855-5154`):**
  - Completely detached from `(app)/layout.tsx`.
  - Top bar (`:4855-4983`): Burger button (opens reader drawer), Surah picker dropdown, fixed page frame pill (`ص N`), Home button (`/`), and 3 layer toggles: «ن» (notes/annotations), «م» (mutshabehat), «ق» (qiraat).
  - Bottom chrome (`:5097-5154`): Quick page slider (input range 1–604 with preview bubble). No tab bar.
  - Drawer menu (`:5158-5310`): Theme settings modal trigger (3 themes only), account status, Qiraat toolbar/hub, and scholarly references sheet.
* **Settings Page (`src/app/(app)/settings/page.tsx:14-91`):**
  - Account info (email, Supabase user id).
  - Data persistence note (Supabase cloud).
  - Swipe navigation toggle (`SwipeNavigationSetting.tsx`).
  - Tag Manager & Tag import/export (`TagManager.tsx`, `TagToolbox.tsx`).
  - Database export (`DatabaseExport.tsx`: XLSX, JSON, CSV, SQL).
  - Cache clear & Sign out.

### Parity Evaluation & Changes Needed
| Area | Status | Gap & Required Change |
|---|---|---|
| **App Root** | **MISSING** | iOS boots directly into the Mushaf reader (`ReaderView`). Web boots to `/` (Mutshabehat list). If web is to mirror iOS, `/mushaf-1441` must be accessible as the default view or have immediate 1-tap switching. |
| **Reader Chrome** | **PARTIAL** | Web has a top burger bar and bottom slider (`Mushaf1441Viewer.tsx:4855, 5097`), but lacks the persistent 6-slot floating glass bottom bar (`ReaderBottomBar.swift:111-122`) giving direct access to Index, Search, Bookmarks, Qiraat, More, and Settings. |
| **Top Bar Metrics** | **PARTIAL** | iOS displays active Khatma percentage and memorization status mark directly in the header (`ReaderTopBar.swift:68, 83`). Web header only displays Surah name, Ayah range, and layer toggles («ن», «م», «ق»). |
| **Settings Scope** | **MISSING** | Web `/settings` only manages account, tags, swipe, and database export. It completely lacks Reading Stats, Bookmarks list, Keep Screen Awake, Auto-hide footer, Memorization settings, and Language selection. |

---

## 2. MUTSHABEHAT

### iOS Screens & Controls (`Sources/Mutshabehat/*`)
* **Entry (`ReaderView.swift:359-361`):** Opened from Reader footer → المزيد → «المتشابهات» as a `.fullScreenCover`.
* **Group List Screen (`MutshabehatView.swift:58-150, 252-300`):**
  - Mode selector (`:61-70`): Segmented control for «الشخصية» (Personal) vs «الآلية» (Automated; DEBUG only).
  - Search & Filters (`:72-137`): Text search field (`:78`), Surah filter dropdown menu (`:95-118`), and Favorites-only star filter button (`:121-134`).
  - Color Legend (`:142`): `MutshabehatColorLegendView` displaying standard diff styles.
  - Editorial Magazine Feed (`:284-298`): `PersonalMagazineFeed` partition cards into `.hero`, `.tall`, and `.compact` cards based on group ID hash, featuring jewel-tone cards (`MutshabehatMagazineTheme`), animated flip-card gestures, verse tags, favorite toggles, and edit shortcuts.
  - Group Creation (`:160-171`): Top toolbar «+ إضافة» button opens `MutshabehatGroupEditorView` in a sheet.
* **Group Detail View (`PersonalGroupDetailView.swift` / `MutshabehatView.swift:200-210`):**
  - Displays all verses in the group with `ArabicDiffView` inline word highlights.
  - Actions for Edit, Toggle Favorite, and verse navigation.
* **Group Editor (`MutshabehatGroupEditorView.swift:29-100, 63-100`):**
  - Title input field (`:70`).
  - Color palette (`:29-32`): 10 canonical color swatches (`#55b94f`, `#4b63e6`, `#c9a84c`, `#7c3aed`, `#15803d`, `#2563eb`, `#d92323`, `#0f766e`, `#9a5d00`, `#1A4A6E`).
  - Status switches: Favorite toggle, Completed toggle, and Status picker (`draft` / `published` / `locked`).
  - Verse addition: Multi-verse search sheet via `MutshabehatQuranSearchView`.
  - Automatic diff & coloring: `AutoColorPickerView` backed by `ArabicDiffAlgorithm.swift`.
  - Interactive token painter: `WordLinkerView` with 7 brush types (مشترك, اختلاف, اختلاف ٢, اختلاف ٣, زيادة, فريد, عادي).
  - Local atomic SQLite persistence (`MutshabehatDatabase.swift`).

### Web App at Phone Width (< 768px)
* **Group List Route (`src/app/(app)/page.tsx:55-103, 284-367`):**
  - Header with total count and active filters (`:287-297`).
  - `FilterBar.tsx`: Search input with ⌘K shortcut and filter pills (الكل, مفضّلة, مكتملة, مسودات, مقفلة) plus `+ مجموعة جديدة` link (`FilterBar.tsx:8-14, 108-130`).
  - `SortBar.tsx`: Dropdown for 5 sorts (created, updated, mushaf, most-verses, title) and 5 views (flat, group-surah, titles-only, collapsed, magazine).
  - `SurahFilter.tsx`: Dropdown selector with per-surah group counts.
  - `ColorLegend.tsx`: Displaying part colors.
  - **Phone-width View Limitation (`src/app/(app)/page.tsx:349-355`):** While desktop (`hidden lg:block`) displays `GroupCardGrid` in collapsed or magazine modes, phone-width (`lg:hidden`) forces `MainGroupSwipePager mode="full"`, rendering standard vertical rows (`GroupRow.tsx`) with swipe-priority navigation.
* **Group Detail (`src/app/(app)/groups/[id]/page.tsx:96-133`):**
  - Renders `GroupDetail.tsx` with full diff tokens.
  - Phone Bottom Bar (`GroupMobileBottomBar.tsx:100-190`): 5 equal cells for الرجوع, السابقة (RTL prev), التالية (RTL next), حذف (with in-place alert confirmation `:53-95`), and تعديل.
  - `SwipeNavWrapper.tsx`: Horizontal touch swipe between previous and next groups.
* **Group Editor (`src/app/(app)/groups/[id]/edit/page.tsx:17-60`, `src/components/EditForm.tsx:25-39`):**
  - Uses the exact same 10 color swatches (`EditForm.tsx:25-28`) and 7 part types (`:30-38`).
  - Features `QuranSearch.tsx`, `AutoColorPicker.tsx`, `WordLinker.tsx`, and `RichEditor.tsx` (for public and private notes).
  - Also includes `TagEditor.tsx` for multi-tag assignment (saved to Supabase `group_tags`).

### Parity Evaluation & Changes Needed
| Area | Status | Gap & Required Change |
|---|---|---|
| **Data & Diff Tooling** | **MATCH** | Identical 10 color swatches, 7 semantic part brushes, diff algorithms (`diff.ts` vs `ArabicDiffAlgorithm.swift`), and interactive word linker. |
| **Phone-width Feed UI** | **PARTIAL** | On iOS, phone-width users experience the dynamic `PersonalMagazineFeed` with flip cards and jewel tone styling. On web, phone-width explicitly disables magazine view (`page.tsx:349`) and falls back to a flat vertical list (`MainGroupSwipePager`). Web should support mobile magazine layout. |
| **Group Navigation** | **PARTIAL** | Web has a 5-cell bottom bar (`GroupMobileBottomBar`) with previous/next group links. iOS presents groups via standard navigation stack. |
| **Tags Support** | **PARTIAL** | Web has a full tagging subsystem (`tags`, `group_tags`, `TagManager`). iOS Mutshabehat module has no group tags. |

---

## 3. READING STATS / BOOKMARKS / KHATMA

### iOS Data Model & Calculations
* **Database (`QuranReadingDatabase.swift:152-217`):**
  - File: `mushaf_reading.sqlite` (WAL mode, SQLite).
  - `bookmarks (id TEXT PK, type TEXT ['ayah'|'page'], surah INT, ayah INT, page INT, note TEXT, created_at TEXT, UNIQUE(type, surah, ayah, page))`
  - `khatmas (id TEXT PK, khatma_number INT, started_at TEXT, completed_at TEXT, status TEXT ['active'|'completed'], percent_complete REAL)`
  - `khatma_read_ayahs (khatma_id TEXT, surah INT, ayah INT, page INT, read_at TEXT, PK(khatma_id, surah, ayah), FK->khatmas)`
  - `reading_days (date_string TEXT PK [YYYY-MM-DD], ayahs_read INT, pages_read INT, seconds_read INT, last_read_at TEXT)`
  - `reading_activity_events (id TEXT PK, date_string TEXT, ayahs_read INT, pages_read INT, seconds_read INT, recorded_at TEXT)`
  - `reading_metadata (key TEXT PK, value TEXT)`
  - `reading_deletions (kind TEXT, khatma_number INT, surah INT, ayah INT, page INT, deleted_at TEXT)`
* **Engines & Calculations (`ReadingTracker.swift:73-243, 308-436, 517-570`):**
  - *Proportional Dwell Time (`:73-200`):* Dwell timer ticks every 1.0s. Target is 30 seconds for a full page. If the user stays < 30s, ayahs are credited proportionally:
    $$\text{targetCount} = \text{totalPageAyahs} \times \min\left(1.0, \frac{\text{elapsed}}{30.0}\right)$$
    Dwell is automatically flushed upon page turn or when the app moves to background.
  - *Khatma Page-based Percentage (`QuranReadingModels.swift:243-267`):*
    $$\text{percent} = \min\left(\frac{\text{pagesRead}}{604} \times 100, 99\right)$$
    Reaches 100% only when all 6,236 ayahs have been marked read.
  - *Streaks Calculation (`QuranReadingDatabase.swift`, `ReadingTracker.swift:526-529`):*
    Calculates `currentStreak`, `longestStreak`, and `totalReadingDays` grouped by local calendar day (`startOfDay(for:)`).
  - *Automatic Khatma Completion (`ReadingTracker.swift:236-240`):* When `totalAyahsRead >= 6236`, opens `KhatmaCelebrationView`, marks current Khatma `completed`, records `completedAt`, increments lifetime counter, and automatically creates Khatma #N+1 at 0%.
  - *Swipe-to-Complete Surahs (`ReadingTracker.swift:251-280`):* Swiping right on a Surah row instantly credits 100% of its ayahs to the active Khatma.
  - *Manual Reading Sessions (`ReadingTracker.swift:308-393`):* `AddReadingSessionView` records manual sessions by Surah range or Page range with duration and from-memory toggle.
* **Screens & Visuals (`ReadingStatisticsView.swift:70-224`, `BookmarksView.swift:36-100`):**
  - `KhatmaSummaryCard`: Progress ring, current Khatma number, days elapsed, pages read / 604, ayahs read / 6236, lifetime hours and minutes read.
  - `ContinueReadingBanner`: Surah, ayah, and page resume jump.
  - `WeeklyStreakTrackerCard`: 7-day visual pill tracker (Arabic day names, numbers, checkmark badges, daily duration).
  - `DailyReadingProgressChartCard`: Bar chart of daily volume (Ayahs, Pages, Juz).
  - `DailyReadingHistoryCard`: Detailed duration log (hours and minutes per day).
  - `BookmarksView`: Segmented filter (الكل, الآيات, الصفحات), search bar, ayah text preview card, swipe-to-delete.

### Web App State
* **Current Web State (`src/app/(app)/stats/page.tsx:21-71`, `Mushaf1441Viewer.tsx:2415-2440`):**
  - **MISSING:** The web app has **0%** of the reading tracking, dwell timing, Khatma progression, reading streaks, daily volume charts, or manual session logs.
  - Web `/stats` is strictly an analytics dashboard for Mutshabehat groups (counts, tag donut, parts breakdown, group edit activity, test quiz answer stats).
  - Web reader bookmarks: Stored in the generic `mushaf_annotations` table in Supabase (`annotation_type = 'bookmark'`). There is no dedicated bookmarks management screen, no filter by type, and no page bookmarking.

### Storage Architecture Recommendation for Web
1. **Primary Recommendation: Client-Side IndexedDB (`mushaf_reading` db):**
   - **Rationale:** Reading dwell ticks occur every 1.0s and page turns happen frequently. In iOS, this is written locally to SQLite. Writing these frequent micro-ticks over the network to the self-hosted Supabase behind Tailscale Funnel would cause latency, network chatter, and failure when offline.
   - **Schema in IndexedDB (using Dexie or raw IDB):**
     - `bookmarks`: `&id, type, page, [surah+ayah], created_at`
     - `khatmas`: `&id, khatma_number, status, started_at`
     - `khatma_read_ayahs`: `&[khatma_id+surah+ayah], khatma_id, surah, ayah, page, read_at`
     - `reading_days`: `&date_string, ayahs_read, pages_read, seconds_read, last_read_at`
     - `reading_metadata`: `&key, value`
2. **Database Migration Warning:**
   - Storing reading progress in Supabase would require a migration creating 4 new tables (`reading_bookmarks`, `khatmas`, `khatma_read_ayahs`, `reading_days`). Per `HANDOFF.md §2`, **production DB DDL requires explicit owner approval and a `pg_dump` backup first**.
   - Therefore, implement the feature with client-side IndexedDB first. Sync to Supabase can be added later if the owner approves the schema migration.

---

## 4. MEMORIZATION (حفظ القرآن)

### iOS Domain Model & Architecture (`MushafCore/Memorization/*`, `Sources/Memorization/*`)
* **Core Enums & Records (`MemorizationModels.swift:4-73`):**
  - Persisted in `mushaf_memorization.sqlite` (`MemorizationMigrations.swift:21-55`).
  - `MemorizationStatus` (1: `mastered` متقن, 2: `memorizedWithErrors` محفوظ مع أخطاء, 3: `needsMushaf` يحتاج المصحف, 4: `notMemorized` غير محفوظ).
  - `ReviewStrength` (1: `strong` ممتاز, 2: `good` جيد, 3: `needsReview` يحتاج مراجعة, 4: `weak` ضعيف, 5: `notReviewed` لم تتم المراجعة).
  - `ReviewResult` (1: `excellent` ممتاز, 2: `good` جيد, 3: `mistakes` أخطاء, 4: `forgot` لم أتذكر).
  - `AyahMemorizationRecord`: Sparse table (untouched ayahs have no row and evaluate to `blank` `:69-72`). Stores status, reviewStrength, `isCurrentlyLearning` flag, 4 timestamps (`firstMemorizedAt`, `lastStatusChangedAt`, `lastReviewedAt`, `nextReviewAt`), 4 counters (`reviewCount`, `successfulReviewCount`, `consecutiveSuccessfulReviews`, `errorCount`), and `updatedAt`.
  - **Hafs Only (`docs/specs/2026-10-06-memorization-design.md:88-97`):** Memorization applies strictly to the Hafs text. It never reads, writes, or alters Qiraat data or reader variants.
* **Interval Ladder & Review Engine (`MemorizationPolicy.swift:4-28`, `MemorizationReview.swift:12-60`):**
  - Ladder intervals: `[1, 3, 7, 14, 30, 60]` days based on `consecutiveSuccessfulReviews`.
  - Failure intervals: 1 day for `forgot` (لم أتذكر); 2 days for `mistakes` (أخطاء); consecutive count resets to 0.
  - Review strength aging (`ReviewEngine.swift:45-52`): A memorized ayah past `nextReviewAt` is displayed as `needsReview`; if past `2 * interval`, it displays as `weak`.
  - **Invariant:** A review updates review counters and strength, but **never changes memorization status**.
* **Planner, Batches, and Undo (`MemorizationPlanner.swift:18-124`, `MemorizationDatabase+History.swift:18-100`):**
  - `MemorizationSelection`: `surah`, `ayahRange`, `pageRange`, `juz`, `ayat` (explicit keys), `span` (cross-surah range).
  - `SelectionParser.swift`: Natural language text parser recognizing «البقرة 255», «يس», «صفحة 42», «الجزء 30».
  - `BatchPlan`: Pure calculation comparing current state to target status. Drops no-op ayahs. Computes `gainAyahs` and `countsForStreak`.
  - Confirmation guard (`MemorizationPlanner.swift:120-123`): Triggered if selection is a whole surah or exceeds 30 ayahs (`policy.confirmationAyahThreshold`).
  - Transactional Undo (`MemorizationDatabase+History.swift:85-100`): Every batch writes `memorization_events` saving the exact `before_json` snapshot. Undo restores each ayah's prior row, records a batch of kind `.undo`, and detects if newer non-undone batches overlap the same ayahs. Undoing revokes streak credit.
* **Weakest-Link Page State (`MemorizationStatistics.swift:150-195`):**
  - Every page receives exactly one of four states based on the weakest ayah on that page:
    1. **متقن (`mastered`):** Every ayah on the page is mastered.
    2. **محفوظ مع أخطاء (`memorizedWithErrors`):** Every ayah is memorized, at least one has minor errors.
    3. **يحتاج المصحف (`needsMushaf`):** Every ayah is memorized or needs mushaf, at least one needs mushaf.
    4. **غير محفوظ (`notMemorized`):** At least one ayah is unmemorized.
  - Accompanied by `PageMix`: Exact fractions of the 4 statuses and count of mastered ayahs (e.g. «٧ من ١٠ متقنة»).
  - Page-equivalent: $\sum_{\text{mastered}} \frac{\text{ayahWordCount}}{\text{pageWordCount}}$, summing to exactly 604.0 across the Quran.
* **Reader Integration (`PageStatusMark.swift:6-88`, `AyahSheet.swift:12-100`, `ReaderTopBar.swift:68`):**
  - Reader header displays `PageStatusMark` (shape: ✓✓, !, ◐, ○ + short label + hairline mix bar). Tapping opens `PageSheet`.
  - Ayah long-press opens `AyahSheet` offering status buttons (1–4), "قيد الحفظ" toggle, "تحديد من هنا" (range selection mode displaying bottom `RangePill`), and "تحديث حفظ الصفحة كلها".
  - Optional monochrome shape marker drawn beneath ayah-end numbers.
* **Screens (`DashboardView.swift`, `UpdateSheet.swift`, `SurahListView.swift`, `PageGridView.swift`):**
  - `DashboardView`: Strict % headline, weighted learning %, can-recite %, 3 scorecard tiles (Surahs, Pages, Ayat), current position card with Mushaf jump, segmented status distribution bar, daily smart suggestion card, streak tracker, review due backlog, recent activity.
  - `UpdateSheet`: Bottom sheet with Surah/Ayat/Pages/Juz tabs, status selection, confirmation dialog, and 8-second undo toast.

### Web Gaps & Storage Design
* **Current Web State:** **MISSING (0%)**. No memorization models, logic, database tables, or reader hooks exist on web.
* **Pure Logic to Port to TypeScript:**
  1. `MemorizationModels.ts` (records, statuses, change events).
  2. `MemorizationPolicy.ts` (weights, ladder intervals, thresholds).
  3. `QuranIndex.ts` (word counts per ayah/page, ayah-to-page lookups).
  4. `SelectionParser.ts` & `MemorizationSelection.ts` (AST parser for Arabic range queries).
  5. `MemorizationPlanner.ts` (batch plan calculation, no-op filtering, gain math).
  6. `ReviewEngine.ts` (interval ladder calculations, aged strength, due queries).
  7. `MemorizationStatistics.ts` (strict %, learning %, page mix, weakest-link page status, 604 page-equivalents).
  8. `StreakCalculator.ts` (calendar-day streak calculation with daylight-saving safety).
* **Swift Tests to Port to Vitest:**
  - `MemorizationCoreTests.swift` (Fatiha 7/7 mastered vs 6/7, page-equivalents summing to 604.0, juz boundaries).
  - `MemorizationParserTests.swift` (text query parsing).
  - `MemorizationPlannerTests.swift` (no-op dropping, confirmation guards).
  - `ReviewEngineTests.swift` (ladder intervals, consecutive increments, strength decay).
  - `StreakCalculatorTests.swift` (streak continuation, missed days, undo rollback).
* **Web Storage Design:** Client-side IndexedDB (`mushaf_memorization` db) mirroring `memorization_ayahs`, `memorization_batches`, `memorization_events`, `memorization_goals`, and `memorization_meta`. Zero server database migrations required.

---

## 5. BACKUP & EXPORT

### iOS Backup & Export Architecture (`Sources/Backup/*`, `MushafCore/Backup/*`)
* **Backup Destination (`BackupService.swift:37-43`, `docs/specs/.../memorization-design.md:225-249`):**
  - Targets a user-selected folder in Files / iCloud Drive (`Mushaf_Qiraat/Backups/`).
  - Dual layout: `Backups/latest/` (most recent complete snapshot) and `Backups/history/<YYYY-MM-DD_HH-mm-ss>/` (daily retention up to 14 days).
* **Backup Set Formats (`BackupWorker.swift:145-150`):**
  1. `memorization.json`: Canonical versioned human-readable JSON export (ayah records, full batch/event history, goals, metadata). Also used for manual export when no backup folder is configured (`BackupService.swift:110-112`).
  2. `memorization.sqlite`: SQLite online backup API snapshot of `mushaf_memorization.sqlite`.
  3. `reading.sqlite`: SQLite snapshot of `mushaf_reading.sqlite` (bookmarks, khatmas, reading days, read ayahs).
  4. `mutshabehat.sqlite`: SQLite snapshot of `mutshabehat.sqlite`.
  5. `qiraat-notes.sqlite`: SQLite snapshot of personal notes/favourites.
  6. `shared/qiraat-<hash>.qiraatdata`: Content-hashed snapshot of Qiraat archive.
  7. `manifest.json`: Contains backup format version, device ID, app version, timestamp, and an array of file entries with file names, sizes, SHA-256 hashes, and row counts.
* **Triggers & Lifecycle (`BackupService.swift:83-108`):**
  - Automatic triggers: Debounced 30s after any change; upon app moving to background; at launch if the last backup is > 24 hours old; or via manual "نسخ احتياطي الآن".
  - Safety guarantee: Built in a staging folder, verified (SQLite `integrity_check`, SHA-256 verification, JSON re-read), and moved atomically. The previous `latest/` is never removed until the new set is verified.
* **Restore Engine (`docs/specs/.../memorization-design.md:250-257`):**
  - Before restoring, copies existing local stores to a local safety folder (keeping last 3).
  - **Memorization Restore:** Supports **Merge** (newer `updated_at` wins per ayah, history batches unioned by ID, undone state preserved) or **Replace**.
  - **Reading, Mutshabehat & Qiraat Restore:** Atomic Replace with rollback on failure.

### Web App Equivalent
* **Current Web Capabilities (`src/components/DatabaseExport.tsx:5-100`, `src/app/(app)/settings/page.tsx:60-72`):**
  - `DatabaseExport.tsx` provides manual downloads for Mutshabehat groups via `/api/groups/export?format=xlsx|json|csv|sql`.
  - `TagToolbox.tsx` provides JSON export and import for tags via `/api/tags/export` and `/api/tags/import`.
* **Gaps on Web:**
  - **MISSING:** No backup/export of reading stats, dwell time, reading days, or active khatmas.
  - **MISSING:** No backup/export of reader bookmarks or notes (`mushaf_annotations`).
  - **MISSING:** No memorization backup/export.
  - **MISSING:** No automated periodic snapshot scheduler, no 14-day history retention, and no SHA-256 manifest integrity verification.
  - **MISSING:** No merge-restore capability (only SQL execute in Supabase or complete JSON overwrite).

---

## 6. THEMES & SEMANTIC COLOR TOKENS

### Semantic Tokens on iOS (`AppColors.swift`, `MushafAppearance.swift`, `MemorizationTheme.swift`)
All text/surface pairs enforce WCAG AA (minimum 4.5:1 contrast):
* **App Chrome Palette (`AppColors.swift:93-102`):**
  - `progress`: Light `#1A7340`, Dark `#5FD38D`
  - `progressFill`: Light `#1A7340`, Dark `#23854D`
  - `caution`: Light `#A14D07`, Dark `#F7A65E`
  - `cautionFill`: Light `#A14D07`, Dark `#A8530C`
  - `info`: Light `#1B5FC1`, Dark `#80B4FF`
  - `insight`: Light `#6A3DB0`, Dark `#C3A5F7`
  - `favorite`: Light `#8F6A00`, Dark `#F2C94C`
  - `danger`: Light `#B4232A`, Dark `#FF8A8A`
  - `switchOn`: System green
* **Memorization Palette (`MemorizationTheme.swift:8-22`):**
  - `mastered` (متقن): Light `#1A6B4A` (`rgb(0.10, 0.42, 0.29)`), Dark `#6BBD8F` (`rgb(0.42, 0.74, 0.56)`)
  - `memorizedWithErrors` (مع أخطاء): Light `#804F05` (`rgb(0.50, 0.31, 0.02)`), Dark `#E0B359` (`rgb(0.88, 0.70, 0.35)`)
  - `needsMushaf` (يحتاج المصحف): Light `#54697A` (`rgb(0.33, 0.41, 0.48)`), Dark `#9EB0C2` (`rgb(0.62, 0.69, 0.76)`)
  - `notMemorized` (غير محفوظ): Light `#5C5C5C` (`rgb(0.36, 0.36, 0.36)`), Dark `#9E9E9E` (`rgb(0.62, 0.62, 0.62)`)
* **Mushaf Appearances (`Sources/Shared/MushafAppearance.swift:9-13, 104-112`):**
  - Offers **5 appearances**: `system`, `light`, `dark`, `whitePage`, `blackPage`.
  - `lightPaper`: `#FFFEF6` (`rgb(1, 0.992, 0.965)`), `lightInk`: `#171717` (`rgb(0.09, 0.09, 0.09)`)
  - `darkPaper`: `#1C1B17` (`rgb(0.11, 0.105, 0.09)`), `darkInk`: `#EBE8DC` (`rgb(0.92, 0.91, 0.86)`)
  - `lightBrown`: `#59461D`, `darkBrown`: `#D1BD8C`
  - `lightGold`: `#C79E3D`, `darkGold`: `#E0BF6B`
  - `bookmarkRibbon`: `#C2382E` (`rgb(0.76, 0.22, 0.18)`)
  - `whitePage`: Pure white paper (`#FFFFFF`), black ink (`#000000`).
  - `blackPage`: Pure black paper (`#000000`), white ink (`#FFFFFF`).

### Web Tokens Diff (`src/app/globals.css`, `mushafTheme.ts`)
* **Web App Tokens (`src/app/globals.css:12-54`):**
  - Defined in OKLCH: `--color-paper` (`oklch(0.972 0.006 80)`), `--color-surface` (`oklch(0.997 0.003 80)`), `--color-ink` (`oklch(0.22 0.015 60)`), `--color-primary` (`oklch(0.36 0.140 265)`).
  - Mutshabehat parts: `--color-shared` (green), `--color-diff` (ochre), `--color-diff2` (purple), `--color-diff3` (teal), `--color-addition` (blue), `--color-unique` (terracotta).
* **Web Reader Themes (`src/app/mushaf-1441/_components/mushafTheme.ts:1-4, 99-120`):**
  - Web only supports **3 themes**: `sepia` (paper `#fffdf6`), `dark` (paper `#18191d`), `white` (paper `#ffffff`).
* **Key Visual Differences:**
  1. *Missing Appearances:* Web lacks iOS's `system` appearance (automatically following device system appearance) and `blackPage` (pure black `#000000` paper with white ink).
  2. *Color Schemes:* iOS provides explicit Light and Dark hex pairs for every chrome indicator (`progress`, `caution`, `info`, `insight`, `favorite`, `danger`), whereas the web app shell is light-only (dark mode on web is confined to `/mushaf-1441`).
  3. *Memorization Tokens:* Web lacks the 4 semantic status tokens (`mastered`, `withErrors`, `needsMushaf`, `notMemorized`).

---

## 7. TASK SPLIT (Implementation Roadmap)

Tasks are ordered by dependency. No server-side migrations are required for the initial implementation (client-side IndexedDB is utilized).

```
Task 1: Core Domain Models (Pure TypeScript)
   │
   ▼
Task 2: IndexedDB Repositories (Reading & Memorization)
   ├───► Task 3: Reader Dwell & Ayah Interaction
   ├───► Task 5: Reading Statistics & Bookmarks UI
   └───► Task 6: Memorization Dashboard & Review UI
            │
            ▼
Task 4: Reader Navigation & Footer Bar
   │
   ▼
Task 7: Mutshabehat Phone Magazine Feed
   │
   ▼
Task 8: Unified Backup & Merge Restore
   │
   ▼
Task 9: Design Tokens & Black Page Appearance
```

### Task 1: TypeScript Pure Logic Engine for Memorization & Reading
* **Goal:** Port pure logic models, policies, and algorithms from Swift to TypeScript with full test coverage.
* **Web files to create:**
  - `packages/memorization-core/src/types.ts`
  - `packages/memorization-core/src/policy.ts`
  - `packages/memorization-core/src/quranIndex.ts`
  - `packages/memorization-core/src/selection.ts`
  - `packages/memorization-core/src/selectionParser.ts`
  - `packages/memorization-core/src/planner.ts`
  - `packages/memorization-core/src/reviewEngine.ts`
  - `packages/memorization-core/src/statistics.ts`
  - `packages/memorization-core/src/streak.ts`
  - `packages/reading-core/src/dwellCalculator.ts`
  - `packages/reading-core/src/khatmaProgress.ts`
  - `packages/memorization-core/tests/*.test.ts`
* **iOS files to mirror:**
  - `MushafCore/Sources/MushafCore/Memorization/*` (`MemorizationModels.swift`, `MemorizationPolicy.swift`, `MemorizationReview.swift`, `MemorizationStatistics.swift`, `MemorizationPlanner.swift`, `MemorizationStreak.swift`)
  - `Sources/Reading/QuranReadingModels.swift:243-267`
* **Size:** **L**
* **Parallel-safe:** **Yes** (independent core packages).

### Task 2: Client-side IndexedDB Repositories & React Stores
* **Goal:** Create local-first IndexedDB storage layers for reading progress and memorization, avoiding database migrations.
* **Web files to create:**
  - `src/lib/storage/reading-db.ts`
  - `src/lib/storage/memorization-db.ts`
  - `src/lib/hooks/useReadingTracker.ts`
  - `src/lib/hooks/useMemorizationStore.ts`
* **iOS files to mirror:**
  - `Sources/Reading/QuranReadingDatabase.swift:152-217`
  - `Sources/Reading/ReadingTracker.swift:73-243`
  - `Sources/Memorization/MemorizationDatabase.swift:16-40`
  - `Sources/Memorization/MemorizationDatabase+History.swift:18-100`
* **Size:** **M**
* **Parallel-safe:** **No** (depends on Task 1).

### Task 3: Mushaf Reader Dwell Tracking, Header Marks & Ayah Interaction
* **Goal:** Integrate 30s dwell time tracking, top banner status mark, and ayah long-press memorization/bookmark sheet into the web reader.
* **Web files to touch / create:**
  - `src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx` (wire dwell timers, header mark, context menu)
  - `src/app/mushaf-1441/_components/memorization/PageStatusMark.tsx` (shape, label, mix bar)
  - `src/app/mushaf-1441/_components/memorization/AyahActionSheet.tsx` (status picker, bookmarks, range mode)
  - `src/app/mushaf-1441/_components/memorization/RangePill.tsx`
  - `src/app/mushaf-1441/_components/memorization/PageSheet.tsx`
* **iOS files to mirror:**
  - `Sources/Reader/ReaderView.swift:173-214, 422-433`
  - `Sources/Reader/ReaderTopBar.swift:68-79, 116-120`
  - `Sources/Memorization/PageStatusMark.swift:6-88`
  - `Sources/Memorization/AyahSheet.swift:12-100`
  - `Sources/Memorization/PageSheet.swift`
* **Size:** **L**
* **Parallel-safe:** **No** (depends on Task 2).

### Task 4: Phone-width Floating Bottom Tab Bar & Shell Unification
* **Goal:** Add the 6-slot floating glass footer capsule to `/mushaf-1441` at phone width with auto-hide support.
* **Web files to touch / create:**
  - `src/app/mushaf-1441/_components/navigation/ReaderMobileBottomBar.tsx` (Index, Search, Bookmarks, Qiraat, More, Settings)
  - `src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx`
* **iOS files to mirror:**
  - `Sources/Reader/ReaderBottomBar.swift:8-12, 111-122, 205-224`
* **Size:** **M**
* **Parallel-safe:** **Yes** (UI shell component).

### Task 5: Reading Statistics Dashboard, Khatma Engine & Bookmarks Screen
* **Goal:** Implement the reading statistics dashboard, 7-day streak visualizer, daily volume charts, Khatma completion modal, and bookmarks list.
* **Web files to create / touch:**
  - `src/app/(app)/stats/reading/page.tsx`
  - `src/components/reading/ReadingStatisticsView.tsx`
  - `src/components/reading/BookmarksSheet.tsx`
  - `src/components/reading/AddReadingSessionModal.tsx`
  - `src/components/reading/KhatmaCelebrationModal.tsx`
* **iOS files to mirror:**
  - `Sources/Reading/ReadingStatisticsView.swift:70-224`
  - `Sources/Reading/BookmarksView.swift:36-100`
  - `Sources/Reading/AddReadingSessionView.swift`
  - `Sources/Reading/KhatmaCelebrationView.swift`
* **Size:** **L**
* **Parallel-safe:** **No** (depends on Task 2).

### Task 6: Memorization Dashboard, Detail Screens & Update Flow
* **Goal:** Implement the Memorization dashboard (`/memorization`), `UpdateSheet` range selector with confirmation, 604-page grid, and review flow.
* **Web files to create:**
  - `src/app/(app)/memorization/page.tsx`
  - `src/components/memorization/DashboardView.tsx`
  - `src/components/memorization/UpdateSheet.tsx`
  - `src/components/memorization/ReviewSessionModal.tsx`
  - `src/components/memorization/PageGridModal.tsx`
  - `src/components/memorization/SurahDetailModal.tsx`
  - `src/components/memorization/HistoryLogModal.tsx`
* **iOS files to mirror:**
  - `Sources/Memorization/MemorizationView.swift:22-91`
  - `Sources/Memorization/DashboardView.swift:21-378`
  - `Sources/Memorization/UpdateSheet.swift:32-130, 250-320`
  - `Sources/Memorization/ReviewView.swift`
  - `Sources/Memorization/PageGridView.swift`
  - `Sources/Memorization/SurahDetailView.swift`
  - `Sources/Memorization/HistoryView.swift`
* **Size:** **L**
* **Parallel-safe:** **No** (depends on Task 2).

### Task 7: Mutshabehat Phone-Width Magazine Feed & Flip Cards
* **Goal:** Enable responsive magazine feed on mobile widths with animated flip cards and jewel-tone palette.
* **Web files to touch:**
  - `src/app/(app)/page.tsx:349-355` (enable magazine layout below `lg`)
  - `src/components/GroupCardGrid.tsx`
  - `src/components/GroupRow.tsx`
* **iOS files to mirror:**
  - `Sources/Mutshabehat/MutshabehatView.swift:267-300`
  - `Sources/Mutshabehat/PersonalMagazineFeed.swift`
* **Size:** **M**
* **Parallel-safe:** **Yes** (independent UI styling).

### Task 8: Unified App Backup, JSON Export & Merge Restore
* **Goal:** Expand web backup beyond Mutshabehat groups to generate canonical `memorization.json`, reading history exports, and support merge-restore.
* **Web files to create / touch:**
  - `src/lib/storage/backup-service.ts`
  - `src/components/DatabaseExport.tsx`
  - `src/app/(app)/settings/page.tsx:60-72`
* **iOS files to mirror:**
  - `Sources/Backup/BackupService.swift:43-135`
  - `Sources/Backup/BackupWorker.swift:145-150`
  - `MushafCore/Sources/MushafCore/Backup/*`
* **Size:** **M**
* **Parallel-safe:** **No** (depends on Tasks 2, 5, 6).

### Task 9: Design Tokens & Black Page Appearance
* **Goal:** Add missing semantic color tokens and pure black page theme to the web reader.
* **Web files to touch:**
  - `src/app/globals.css:12-55` (add `--color-progress`, `--color-caution`, and memorization status tokens)
  - `src/app/mushaf-1441/_components/mushafTheme.ts:1-4, 99-120` (add `blackPage` token set)
  - `src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx`
* **iOS files to mirror:**
  - `Sources/Design/AppColors.swift:93-102`
  - `Sources/Shared/MushafAppearance.swift:9-13, 104-112`
  - `Sources/Memorization/MemorizationTheme.swift:8-22`
* **Size:** **S**
* **Parallel-safe:** **Yes**.
