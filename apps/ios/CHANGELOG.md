# Qiraat iOS app — changelog

> Newest first. One dated entry per change. iOS changes are logged here, never in the root
> `CHANGELOG.md`, which belongs to the web app (see `AGENTS.md` §1).

## [iOS v1.0] — 2026-10-05 — Milestone Reference Release (Tag: `ios-v1.0`)
- **Milestone Reference Baseline:** Official v1.0 release encapsulating the complete offline/online Mushaf 1441 reading experience, Ten Qira'at layer, Mutshabehat module, advanced AST Quran search engine, reading & Khatma progress tracking, and iCloud synchronization with the production Colima backend.
- **Mushaf Page Stretched to Fill Top Bar Gap & Expanded Line Spacing:**
  - Resolved double safe area inset in `PageController.swift` by computing `topY` and `bottomY` relative to window coordinate space via `view.convert(CGPoint.zero, to: nil)`:
    - Anchored `pageView` top strictly to the bottom edge of `ReaderTopBar` (`windowSafeTop + topBannerHeight - viewOriginInWindow.y`), eliminating the redundant 62pt gap of empty desk background.
    - Extended `pageView` height from 599pt to 695pt on iPhone, stretching the paper seamlessly from immediately below the top header down to the bottom page number.
    - Proportionally expanded vertical line spacing across all 15 Quranic text lines via `PageLayout` (`rowHeight` increased by >15%), providing comfortable vertical breathing room between verses without empty gaps.
  - Verified on iPhone 18 Pro (`page208_nochrome_v4.png`, `page208_chrome_v4.png`, `page209_nochrome_v4.png`, `page209_chrome_v4.png`) and iPad Pro 13-inch (`ipad_nochrome_v4.png`, `ipad_chrome_v4.png`).
  - All 100 core tests and 37 app tests passing; clean repository isolation (`./apps/ios/scripts/check_isolation.sh`).
- **Single-Slot Top Header Alignment & Non-Overlapping Stretched Mushaf Page:**
  - Redesigned `ReaderTopBar` (`apps/ios/Sources/Reader/ReaderTopBar.swift`) to host both the reading mode header and the navigation controls banner in a single unified `ZStack` with fixed 52pt height:
    - Reading mode (`!chromeVisible`): Surah name rendered in authentic King Fahd Mushaf font (`MushafLibrary.mushafFont(size: 20)`) on the right, and Hizb & Juz (`جزء N ◐ حزب M`) on the left, with transparent background showing the natural desk color behind the status bar.
    - Controls mode (`chromeVisible`): Navigation controls banner (search, bookmarks, mutshabehat, settings buttons, and surah index card) with `.regularMaterial` background occupies the exact same slot, directly covering the reading header without any jumping or mismatched coordinates.
  - Eliminated Mushaf page overlap: Set Mushaf page top anchor strictly to `safeTop + topBannerHeight + 3` (114pt on iPhone 18 Pro), while `ReaderTopBar` ends at `safeTop + topBannerHeight` (111pt), leaving a clean 3pt boundary of desk background so the top bar never touches or overlaps the white Mushaf page paper.
  - Mobile full-page stretching: Vertically stretched `pageView` between the top header area and bottom page number (`pageHeight = bounds.height - safeBottom - 34 - topY`), scaling all 15 lines of text evenly across the page without awkward whitespace or squished lines.
  - Bottom page numbers: Prominently displayed below the page paper in bold system font, adhering to authentic Mushaf convention (odd page numbers on the right, even page numbers on the left).
  - Verified on iPhone 18 Pro (`page208_nochrome_v3.png`, `page208_chrome_v3.png`, `page209_nochrome_v3.png`, `page209_chrome_v3.png`) and iPad Pro 13-inch (`ipad_nochrome_v3.png`, `ipad_chrome_v3.png`).
  - All 100 core tests and 37 app tests passing; clean repository isolation (`./apps/ios/scripts/check_isolation.sh`).
- **Clean Large Page Numbers on Mobile (No Ayah Rosette):**
  - Updated `PageController.swift` to render `pageNumberLabel` using bold system font (`UIFont.systemFont(ofSize: isSpreadHalf ? 18 : 22, weight: .bold)`), resolving the issue where the Uthmanic font shaped Arabic-Indic digits into ornamental ayah end markers.
  - Enforced bottom inset on both iPhone and iPad so the clean number is prominently displayed without clipping or overlapping.
- **Surah Banner Clean Roundels & Centered Title:**
  - Updated `drawSurahHeader` and `drawFallbackSurahHeader` in `MushafPageView.swift`:
    - Right roundel: Displays ONLY the Surah number without the «سُورَة» text caption, centered in the roundel.
    - Left roundel: Displays ONLY the Ayah count without the «آيَاتُهَا» text caption, centered in the roundel.
    - Central cartouche: Removed «مَكِّيَّة» / «مَدَنِيَّة» revelation classifications completely and vertically & horizontally centered the Surah name directly in the middle with expanded font sizing.
- **Top Bar Surah Title in Authentic Mushaf Font:**
  - Updated `ReaderTopBar.swift` to render `surahTitle` using `MushafLibrary.mushafFont(size: 18)`.
  - Ensured `PageController.swift`'s top-edge `surahLabel` also renders with `MushafLibrary.mushafFont`.
- **Quran Reading Duration Tracking (Accumulative & Daily Breakdown):**
  - Added `seconds_read` column to `reading_days` in `QuranReadingDatabase.swift` with automatic schema migration and fallback calculation for legacy days.
  - Extended `recordDailyReadingActivity` to record duration in seconds, crediting manual sessions (`durationMinutes * 60`) and page dwell progress.
  - Added `lifetimeReadingSeconds()`, `readingSeconds(for:)`, and `readingSecondsMap()` to calculate cumulative hours/minutes and daily hours/minutes.
  - Added a dedicated hero card in `ReadingStatisticsView.swift` displaying "إجمالي وقت التلاوة (تراكمي)" with formatted hours and minutes.
  - Added daily hours and minutes readout (`day.formattedDuration`) under each day of the week in `WeeklyStreakTrackerCard`.
  - Added `DailyReadingHistoryCard` ("سجل القراءة اليومي") listing daily reading time, pages, and ayahs for active days.
- **Unit & UI Verification:**
  - Added `testReadingDurationTrackingAndAccumulation` in `ReadingTests.swift`.
  - All 37 tests passing in `MutshabehatTests` (0 failures).
  - All 100 core tests passing in `MushafCoreTests` across 14 suites.
  - Visual verification on iPhone simulator for Page 2 and Statistics view.
  - Clean isolation (`apps/ios/scripts/check_isolation.sh`).

  - Updated `PageController.swift` to position the bottom page number label strictly below the paper frame (`paperFrame.maxY + 4`).
  - Odd page numbers align with the right paper margin (`textAlignment = .right`), while even page numbers align with the left paper margin (`textAlignment = .left`), adhering to authentic physical Mushaf conventions.
- **Mutshabehat Full-Page Detail Navigation:**
  - Upgraded card interactions in `MutshabehatView.swift`: tapping any personal or automated card in Magazine view pushes into a dedicated full-page screen (`PersonalGroupDetailView` / `AutomatedGroupDetailView`) via `NavigationStack(path:)`.
  - Full-page detail view displays the complete list of verses, full `ArabicDiffView` diff analysis with all semantic color highlights, notes, and direct "تعديل" (edit) action button.
- **Authentic Madinah Mushaf Basmalah Typography:**
  - Switched `drawBasmala(in:fontSize:in:)` in `MushafPageView.swift` to load the authentic Madinah Mushaf QCF Page 1 font (`p1.woff2`) with the 4 canonical glyphs (`["ﱁ", "ﱂ", "ﱃ", "ﱄ"]`), matching the physical Quran pages 100%.
- **Surah Banner Layout & Classification Subtitle:**
  - Dynamically sized Surah titles in `MushafPageView.swift` (`targetWidth = maxCartoucheWidth * 0.82`) to eliminate dead space in the central cartouche.
  - Rendered canonical vowelled «مَدَنِيَّة» and «مَكِّيَّة» subtitles with balanced vertical spacing above the bottom border.
- **Full Surah Manual Reading Session Mode:**
  - Added `.bySurah = "bySurah"` ("سورة كاملة") as the default mode in `AddReadingSessionView.swift`, featuring a Surah selector, Ayah count badge, first page badge, and Makkiyah/Madaniyah classification badge.
  - Added a 1-tap "تحديد كامل السورة" shortcut button inside `.byAyah` mode to instantly select all ayahs in the Surah.
- **Cumulative Lifetime Ayahs Read Statistic:**
  - Implemented `lifetimeReadAyahsCount()` in `QuranReadingDatabase.swift` computing the accumulative total of ayahs read across all sessions, active days, and completed khatmas (`max(COUNT(*) FROM khatma_read_ayahs, SUM(ayahs_read) FROM reading_days, completedCount * 6236)`).
  - Added illuminated hero card in `ReadingStatisticsView.swift` showing "مجموع الآيات المقروءة (تراكمي)" with Arabic-Indic formatting.
- **Mutshabehat Magazine Card Natural Spacing:**
  - Removed artificial vertical stretching and fixed sizes from `PersonalMagazineCard` and `AutomatedMagazineCard` so each card wraps its content naturally without dead space.
- **Unit & Visual Test Coverage:**
  - Added `testLifetimeReadAyahsAccumulation()` and `testFullSurahManualSessionRecording()` in `ReadingTests.swift`.
  - All 36 tests pass in `MutshabehatTests` (0 failures).
  - Visually verified all screens on iOS Simulator via screenshots.
- **Surah Name & Basmalah Typography with Authentic Mushaf Font:**
  - Registered `KFGQPC Uthmanic Script HAFS Regular.otf` dynamically via `CTFontManagerRegisterFontsForURL` in `MushafLibrary.swift` and introduced helper `MushafLibrary.mushafFont(size:)` with graceful fallback to ensure the King Fahd Complex calligraphic font is universally available at runtime.
  - Redesigned Surah banner headers (`MushafPageView.swift`): updated central cartouche title («سُورَةُ ...»), revelation type subtitle, right circle caption («سُورَة»), right number (Arabic-Indic digits), left circle caption («آيَاتُهَا»), and left number (Arabic-Indic digits) to render using `MushafLibrary.mushafFont`.
  - Updated Basmalah typography (`drawBasmala(in:fontSize:)`): replaced system font rendering with `MushafLibrary.mushafFont(size: fontSize * 0.95)` and adaptive ink color matching the Mushaf appearance theme.
  - Added unit test `testMushafFontLoadsProperly` in `ReadingTests.swift`.
  - Visually confirmed via simulator screenshots on Page 2 (Al-Baqarah) and Page 151 (Al-A'raf).
- **Resume Navigation from Reading Statistics & Surah Index:**
  - Added `nextUnreadAyah(for:library:)` and `nextUnreadPage(for:library:)` in `ReadingTracker.swift` to calculate the exact continuation point for any Surah (e.g. if Ayahs 1..34 are read, automatically returns Ayah 35 and its corresponding Mushaf page; defaults to Ayah 1 / Page 1 if 0 read or 100% read).
  - Updated `ReadingStatisticsView.swift` to pass `targetPage` to `onSelectSurah` callback computed from `nextUnreadPage`.
  - Updated `ReaderView.swift` to handle Surah selection by immediately navigating to the first unread page.
  - Updated `IndexSheet.swift` Surah rows to jump to the first unread page upon tapping.
  - Added unit test `testNextUnreadAyahAndPageNavigation` in `ReadingTests.swift` testing Surah 7 with partial ayah progression.
- **Mutshabehat Magazine View Equal-Height Paired Cards:**
  - Resolved vertical empty spaces below compact cards in paired rows (`media_1791072623101.png`):
    - Configured both cards in paired rows (`.pair(let first, let second)`) with size `.tall`.
    - Enforced full-height stretching on card containers with `.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)`.
    - Added `Spacer(minLength: 0)` before the card bottom chevron to push footer actions to the baseline.
    - Constrained row `HStack` with `.fixedSize(horizontal: false, vertical: true)` so both cards expand to the tallest card's height while locking the row height, eliminating all empty gaps.
  - Visually confirmed via simulator screenshot in Mutshabehat magazine view.
- **Launch Arguments for Testing & Automated Verification:**
  - Added support for `-open-mutshabehat`, `-open-statistics`, and `-open-bookmarks` launch arguments in `ReaderView.swift`.
- **Test Suite Verification:**
  - All 34 unit tests pass in `MutshabehatTests` (0 failures).
  - All 100 core tests pass in `MushafCoreTests` across 14 suites.
  - All 41 data tests pass.
  - Repository isolation passes cleanly (`scripts/check_isolation.sh`).

## 2026-10-03
- **Qira'at Highlights & Rulings Parity with Web Application:**
  - **Identified & Resolved Highlight Discrepancies:**
    - Fixed issue where certain words were highlighted in the web app but not in the iOS app (reported on Page 8 of Surah Al-Baqarah, Ayah 49).
    - Root cause: local `apps/ios/Generated/Qiraat/` snapshot had an outdated set of 24 rulings for page 8, missing 20 Ten Qira'at rulings present in the live Colima PostgreSQL database (`mutshabehat-db`).
    - Ran full multi-threaded refresh across all 604 pages with `fetch_qiraat.py --refresh`, updating the full corpus to 12,506 rulings and 3,820 variants.
    - Page 8 now contains all 44 rulings and 6 variants, matching the web application identically.
    - Recompiled and published updated `qiraat.sqlite` (30.0 MB) and `qiraat.qiraatdata` (16 MB) to iCloud Drive `Mushaf_Qiraat`.
    - Added unit test `testPage008QiraatRulingsMatchWebapp` in `ReadingTests.swift` validating 44 rulings, 6 variants, and exact colors for Ayah 49 words 1 (`#DC2626`), 2 (`#DB2777`), 6 (`#DB2777`), and 7 (`#DC2626`).
    - Verified via simulator screenshot that Page 8 highlights and markings match the web app screenshot 100% on every line.
- **Direct Colima PostgreSQL Export & Web App Two-Way Sync Bridge (`Mushaf_Qiraat`):**
  - **Direct Colima Database Extraction (`sync_colima_to_icloud.py`):**
    - Connects directly to the live PostgreSQL instance running in Colima Docker on the Mac Mini (`mutshabehat-db`).
    - Extracts complete personal groups (251 groups), verses (943 verses), parts (3054 parts), automated groups (12,668 rows), and mushaf annotations (15 rows).
    - Compiles clean standalone SQLite database `mutshabehat.sqlite` (1.25 MB) with `DELETE` journal mode and `mutshabehat.json` (1.2 MB).
    - Generates complete PostgreSQL production backups directly from Colima: `database_backup.sql` (100.6 MB plaintext SQL) and `database_dump.dump` (13.5 MB binary pg_dump) for webapp full disaster recovery.
    - Preserves and links `qiraat.sqlite` (30.4 MB, 604 pages, 3,819 variants, 12,391 rulings), `qiraat.qiraatdata` (16.5 MB), and `mushaf.sqlite` (56.3 MB).
    - Implemented chunk streaming copy (`safe_copy`) avoiding macOS `fcopyfile(3)` EPERM permissions errors on iCloud-managed files.
    - Generates updated `manifest.json` with source of truth `"colima://mutshabehat-db (amr-Mac-mini)"`, timestamps, and SHA-256 signatures.
  - **Web App Integration on Mac Mini (`~/Projects/mutshabehat-v2`):**
    - Installed `scripts/sync_to_icloud.sh` wrapping the Colima export pipeline on the Mac Mini.
    - Added npm commands in `package.json`: `npm run sync:icloud` (exports from Colima to `Mushaf_Qiraat`) and `npm run sync:icloud:import` (two-way import from `Mushaf_Qiraat/mutshabehat.json` into Colima PostgreSQL with atomic transactional upsert).
  - **iOS App Synchronization (`ICloudDatabaseSyncService.swift`):**
    - Updated `SyncDatabaseEntry` model with optional keys for full schema flexibility (`dumpFile`, `sqlFile`, `automatedGroupsCount`, `mushafAnnotationsCount`).
    - Verified hot-reload and decoding with all 32 unit tests passing on iPhone 17 Simulator.
- **iCloud Database Synchronization (`Mushaf_Qiraat`) & Web App Source of Truth Pipeline:**
  - **Automated Web-to-iCloud Export Pipeline (`sync_webapp_to_icloud.py`, `Makefile`):**
    - Connects directly to the live web app (production source of truth: `https://mutshabehat-v2.vercel.app`) with authenticated session management.
    - Exports latest Mutshabehat data (251 groups, 943 verses, 3054 parts) and compiles into a clean, indexed SQLite database `mutshabehat.sqlite` alongside a companion raw JSON export `mutshabehat.json`.
    - Bundles Ten Qira'at catalog and all 604 pages of variants (3,819) and rulings (12,391) into unified `qiraat.sqlite` and portable `qiraat.qiraatdata`.
    - Copies canonical `mushaf.sqlite` (Madinah 1441 page layout, glyphs, coordinates).
    - Generates `manifest.json` with entity counts, ISO export timestamps, and SHA-256 hashes.
    - Publishes all files atomically to iCloud Drive: `~/Library/Mobile Documents/com~apple~CloudDocs/Mushaf_Qiraat/`.
    - Added `make sync-icloud` target in `Makefile` to trigger pipeline and update local seed files with one command.
  - **Native iOS Automatic Sync Engine (`ICloudDatabaseSyncService.swift`):**
    - Dynamic folder discovery resolving ubiquity container (`NSUbiquitousContainers` `Mushaf_Qiraat`), local/simulator iCloud Drive path, and security-scoped custom folder bookmarks.
    - Automatically triggers download of evicted iCloud placeholder items (`.icloud`).
    - Validates SQLite schema integrity (`PRAGMA integrity_check`, required table checks) before applying updates.
    - Hot-swaps `MutshabehatDatabase.shared` and `MushafLibrary.qiraat` with zero app restarts, broadcasting `.mutshabehatDatabaseDidUpdate` and `.qiraatDatabaseDidUpdate`.
    - Automatic background sync checks hooked into app launch and foreground resume (`scenePhase == .active` in `ReaderView.swift`).
    - Direct web fallback sync downloading directly from the web app API when iCloud is offline.
    - **Fix for Database Table Validation Error:** resolved «تعذر قراءة جداول قاعدة البيانات» by removing redundant in-place SQLite querying on external iCloud Drive paths (which failed due to iOS sandbox lock constraints), delegating schema validation to `MutshabehatDatabase.shared.importDatabase` inside the sandboxed temporary directory, and configuring `PRAGMA journal_mode = DELETE;` in `sync_webapp_to_icloud.py` to produce completely self-contained standalone SQLite files.
    - **Fix for Archive Decoding Format Error:** resolved "The data couldn't be read because it isn't in the correct format" by updating `build_qiraat_archive` in `sync_webapp_to_icloud.py` to encode file bytes using Base64 (`base64.b64encode`) as required by Swift's `[String: Data]` Codable schema in `QiraatBackupService`, regenerated `qiraat.qiraatdata` in `Mushaf_Qiraat`, and wrapped Qiraat archive installation in a resilient `do-catch` block.
  - **iCloud Sync Settings UI (`ICloudSyncSettingsView.swift`, `ReaderView.swift`):**
    - Added dedicated «مزامنة السحابة (iCloud Sync)» section to Settings with live connection indicator dot (🟢 Connected to `Mushaf_Qiraat`).
    - Real-time status scorecard showing last sync timestamp, Mutshabehat group count (251 groups), Qiraat pages (604), and source of truth info.
    - One-tap action buttons: «مزامنة الآن من iCloud» (Sync Now), «تحديث من خادم الويب مباشرة» (Fetch Directly from Web), and «تحديد مجلد مزامنة مخصص» (Select Custom Folder).
    - Configurable auto-sync switch («المزامنة التلقائية عند الفتح»).
  - **Preserved User Reading Progress:**
    - Personal reading stats (`reading_progress.sqlite` — bookmarks, active Khatmas, reading sessions, dwell history, streaks) remain strictly local and isolated, guaranteed never to be overwritten by database syncs.
  - **Unit Tests (`ReadingTests.swift`):**
    - Added `testSyncManifestParsing` verifying JSON manifest decoding, database counts, and SHA-256 hashes.
    - Added `testICloudSyncFolderDiscovery` verifying resolution of the `Mushaf_Qiraat` folder.
    - Added `testMutshabehatDatabaseHotReloadNotification` verifying notification dispatch and observer reload.
    - Added `testQiraatArchiveDecoding` verifying 100% successful decoding and installation of all 604 Qira'at pages and catalog; all 32 unit tests passing with 0 failures.

## 2026-10-02
- **iPad View Optimization, Book Spine Curvature, Mutshabehat Magazine View & Smart Search Arabic Localization:**
  - **iPad Layout & Top Bar Non-Overlap (`PageController.swift`):**
    - Calculated iPad-specific safe margins (`topInset` at least 68pt, `bottomInset` at least 46pt), ensuring `ReaderTopBar` (~56pt) never overlaps the top of the Mushaf page.
    - Disabled artificial vertical page stretching on iPad (`stretch: !isSpreadHalf && !isPad`) to preserve the canonical Madinah 1441 print aspect ratio.
    - Restricted `surahLabel` and `sectionLabel` frames strictly to `paperFrame.minX ... paperFrame.maxX`, preventing metadata spillover into the empty desk margins on right and left.
    - Centered `pageNumberLabel` directly underneath the page paper (`paperFrame.minX ... paperFrame.maxX` at `paperFrame.maxY + 4`) and forced `isHidden = false` on iPad so bottom page numbers are always clearly visible.
    - Added subtle page boundary borders (`appearance.brown.withAlphaComponent(0.20)`), soft paper drop shadow, and selective corner radius.
  - **Realistic Book Spine & Page Curvature (`MushafPageView.swift`):**
    - Implemented `drawBookSpineAndPageEdges(in context: CGContext)` simulating an authentic open physical Mushaf.
    - Rendered spine gutter gradient shadow (crease where pages meet), specular cylindrical highlight sheen reflecting light across the turning page curve, crisp spine fold line, top/bottom vignette depth gradients, and subtle outer edge paper rim depth.
    - In spread view, selectively rounded outer page corners (`.layerMaxXMinYCorner` / `.layerMinXMinYCorner`) while keeping inner spine corners square to seamlessly meet at the book's center fold.
  - **Mutshabehat Magazine View (`MutshabehatView.swift`):**
    - Built dynamic editorial magazine layout featuring randomized/asymmetric card heights and rich visual rhythm (`MutshabehatMagazineTheme`, `MagazineCardSize`, `buildMagazineBlocks`).
    - Alternates full-width hero cards (`.hero`) with side-by-side asymmetric card pairs (`.tall`, `.compact`) for high visual interest.
    - Expanded palette with 12 distinct editorial jewel and earth tones (`#0F5132`, `#1D4ED8`, `#6D28D9`, `#C2410C`, `#BE123C`, `#B45309`, `#0F766E`, `#4D7C0F`, `#3730A3`, `#831843`, `#78350F`, `#0284C7`), deterministically mapped by group ID hash.
    - Built `PersonalMagazineCard` and `AutomatedMagazineCard` with inline `ArabicDiffView` previews, ayah reference chips, and tap-to-expand spring animation (`.snappy`) revealing full word diffs, tags, notes, and actions.
  - **Smart Search Arabic Descriptions (`AdvancedSearchGuideView.swift`, `AyahSearchView.swift`):**
    - Localized `AdvancedSearchGuideView` with full Arabic translations for all 8 search tutorial cards and all 23 query example titles when app language is Arabic (`@AppStorage("app:language:v1")`).
    - Localized section headers: «كيفية استخدام البحث المتقدم:»، «أمثلة على البحث المتقدم:»، «النتيجة المتوقعة:»، «استعلام البحث:».
    - Localized `AyahSearchView` headers («البحث في القرآن»), result counters («إجمالي الآيات في نتائج البحث: N»), search field placeholder («ابحث في القرآن الكريم...»), and added informative Arabic sub-captions for each search mode (`smart`, `exact`, `broad`).
  - **Unit Tests (`ReadingTests.swift`):** added `testMutshabehatMagazineThemeColors` verifying 12-color palette count, custom hex color parsing, and deterministic hash mapping; all 28 tests passing cleanly with 0 failures.

- **Reading Progress Dashboard, 30s Proportional Dwell, Remaining Surah Filter & Manual Reading Sessions:**
  - **Qiraat Toggle Color (`QiraatControls.swift`):** updated Ten Qira'at activation switch tint from walnut brown (`.mushafGold`) to standard Apple system green (`.tint(.green)`).
  - **30-Second Proportional Page Dwell Engine (`ReadingTracker.swift`, `ReaderView.swift`):**
    - Transitioned page dwell rule to a 30-second completion target: staying on a Mushaf page for 30 seconds marks the entire page and all its verses as read.
    - Added real-time 1.0s periodic tick calculating proportional ayah credit during partial stays: `targetCount = Int(Double(totalAyahs) * min(1.0, elapsed / 30.0))` (e.g., 12 seconds on a 6-ayah page credits exactly 2 ayahs in chronological order).
    - Guarded with a 1.0-second initial threshold to ignore rapid flick-skimming.
    - Added `flushCurrentPageDwell(library:)` lifecycle integration executing whenever the user flips to another page, switches tabs, backgrounds the app (`scenePhase`), or closes the reader.
  - **Surah Progress "Remaining" Filter (`IndexSheet.swift`, `QuranReadingModels.swift`):**
    - Introduced `SurahProgressFilter` (`.all`, `.remaining`, `.completed`, `.started`) to filter Surahs by completion state.
    - Updated `IndexSheet` Surah list with horizontal filter pill bar: "الكل" (All), "المتبقي" (Remaining), "قيد القراءة" (In Progress), "المكتمل" (Completed).
    - Surah list items now display real-time remaining ayah count badge (e.g. «المتبقي: 143 آية») and completion icons.
  - **Apple-Friendly Reading Progress Dashboard (`ReadingStatisticsView.swift`):**
    - Redesigned the reading progress dashboard to professional Apple Health / Books standards matching reference screenshots (`media_1790935985906.png`, `media_1790936028095.png`, `media_1790936100322.png`):
    - Circular activity ring with emerald-to-mint gradient, Khatma percentage, and read/total pages count.
    - Key metrics scorecard: Total Pages (604), Remaining Pages, and Completed Khatmas.
    - "Continue Reading" (تابع القراءة) hero banner displaying current reading position with instant jump button.
    - 7-Day Weekly Streak Tracker with checkmark badges and direct `+ جلسة` quick action button.
    - Surah Khatma section ("الختم على حسب السورة") with search bar, filter capsules, remaining ayah counters, and direct tap-to-read navigation.
  - **Manual Reading Session Entry (`AddReadingSessionView.swift`):**
    - Created Apple HIG grouped form sheet allowing users to manually record recitation sessions.
    - Supports recording by Ayah range (Surah & Ayah steppers/pickers) or by Page range (1 to 604).
    - Date and time picker (`DatePicker`).
    - Recitation duration with quick-selection chips (5, 10, 15, 20, 30, 45, 60 minutes).
    - Recitation method toggle ("تلوتُ عن ظهر قلب (من الذاكرة)").
    - Immediate atomic commit to `QuranReadingDatabase`, crediting active khatma progress and updating daily streak history.
  - **Unit Tests (`ReadingTests.swift`):** added 3 comprehensive unit tests validating proportional 30s dwell calculations (12s / 6 ayahs = 2 ayahs, 30s = 6 ayahs, <1s flick = 0), manual session logging, and remaining Surah filter logic.

- **Authentic Classical Illuminated Surah Banner Redesign (`MushafPageView.swift`):**
  - **Manuscript Illumination Parity (`media_1790935697488.png`):** completely redesigned the Surah title banner in `MushafPageView` to match the exact visual composition of the uploaded Ottoman/Mamluk illuminated manuscript reference.
  - **Three-Part Sliced Geometry:** sliced the master illumination artwork into left wing (aspect ratio 3:1), right wing (aspect ratio 3:1), and horizontal bridging lines (connecting outer double borders and cartouche lines). Drawing dynamically scales the wings proportionally with banner height (`wingWidth = height * 3.0`), keeping circular medallions and arabesque vine scrolls geometrically undistorted on every screen size from iPhone SE to 13-inch iPad Pro.
  - **Medallion & Cartouche Metadata:**
    - **Right circular roundel:** displays Surah number in authentic Arabic-Indic digits (e.g. «٣») with upper semicircular caption («سُورَة»).
    - **Left circular roundel:** displays total Ayah count in Arabic-Indic digits (e.g. «٢٠٠») with upper semicircular caption («آيَاتُهَا»).
    - **Center cartouche:** displays canonical vowelled Surah title («سُورَةُ آلِ عِمْرَانَ») in authentic King Fahd Complex calligraphy (`KFGQPCUthmanicScriptHAFS`), supported by a complete 114-Surah vowelled canonical dictionary (`canonicalSurahTitles`), and revelation classification subtitle («مَدَنِيَّة» / «مَكِّيَّة»).
  - **Adaptive Five-Theme Tinting:** dynamically applies dark walnut brown ink in light and white-page themes, and luminous gold leaf (`appearance.gold`) in dark and black-page themes, against matching paper washes.
  - **Resilient Fallback:** retains vector-drawn multi-foil Mihrab arch cartouche as a private fallback (`drawFallbackSurahHeader`) if bundle image resources are ever unavailable.
  - **Unit Tests:** added automated test in `ReadingTests.swift` (`testSurahBannerMetadataAndAssets`) verifying template asset availability and canonical metadata.

- **Mushaf Reading Experience Upgrade — Screen Awake, Islamic Surah Banners, Bookmarks, Streaks, Reading Progress, Statistics & Auto-Khatma:**
  - **Screen Awake Management (`ReadingTracker.swift`, `ReaderView.swift`):** native `UIApplication.shared.isIdleTimerDisabled` control linked directly to application lifecycle (`ScenePhase`). When app is active and setting is enabled, screen stays awake for long reading sessions; automatically restores standard device auto-lock when backgrounded or inactive. Fully configurable via Settings toggle («إبقاء الشاشة مضاءة أثناء القراءة» / "Keep Screen Awake", default ON).
  - **Illuminated Islamic Surah Banner (`MushafPageView.swift`):** redesigned Surah banner replacing modern polygons and sharp geometric tiles with classical Quran manuscript illumination. Features an illuminated Mihrab-ogee central cartouche, vegetal arabesque scroll finials, dual-tone gold and brown multi-lobed framing, and traditional dual typography showing Surah name plus revelation classification (مكية/مدنية) and total ayah count.
  - **Quran Bookmarking System (`QuranReadingDatabase.swift`, `PageController.swift`, `MushafPager.swift`):**
    - Seamless long-press interaction on ayah end markers or words (0.45s threshold with haptic feedback) triggering a non-intrusive action sheet to bookmark/remove ayah and page.
    - Prevents duplicate bookmarks via SQLite `UNIQUE(type, surah, ayah, page)` with `ON CONFLICT DO UPDATE`.
    - Subtle visual indicators: illuminated crimson and gold silk ribbon on bookmarked pages, and delicate golden emblem on bookmarked ayah markers.
    - Dedicated Bookmarks screen (`BookmarksView.swift`) accessible from TopBar, IndexSheet, and Settings. Supports filtering (All, Ayahs, Pages), search, swipe-to-delete, Uthmanic ayah previews, and one-tap jump with ayah word highlighting.
  - **Reading Progress & Khatma Tracking (`ReadingTracker.swift`, `QuranReadingDatabase.swift`):**
    - Multi-tiered tracking separating active khatma (0% → 100%) from permanent lifetime statistics.
    - Dwell-based reading tracking: 2.5-second minimum dwell on primary visible page to register read ayahs and avoid flick-skips.
    - Ayah-based Surah reading progress: calculates read ayahs vs total ayahs dynamically for each of the 114 Surahs, displaying compact progress bars and percentages in `IndexSheet` and `ReadingStatisticsView`.
    - Full Mushaf Khatma progress displayed in TopBar details text and Statistics cards.
  - **Daily Quran Reading Streak (`QuranReadingDatabase.swift`):**
    - Tracks Current Streak, Longest Streak, and Total Reading Days using local calendar boundaries (`Calendar.current` and user timezone, not UTC).
    - Requires genuine reading activity (registering read ayahs/pages) to increment streak.
    - Missing a local calendar day resets current streak to 0/1 without ever losing longest streak, total reading days, or completed khatmas.
  - **Statistics Dashboard (`ReadingStatisticsView.swift`):**
    - Calm, respectful Quran-focused dashboard accessible directly from Settings (`Settings → إحصائيات القراءة والختمة`).
    - Displays Khatma progress percentage card, 4-stat scorecard (Current Streak, Longest Streak, Completed Khatmas, Total Days), Khatma details, and full 114 Surahs progress breakdown with tap-to-read navigation.
  - **Automatic Khatma Completion & Restart (`KhatmaCelebrationView.swift`):**
    - Automatically detects 100% completion when all 6,236 Quran ayahs are read in the active khatma.
    - Archives completed khatma with duration and dates, increments lifetime khatma counter, and seamlessly initializes a new Khatma #N at 0%.
    - Displays illuminated celebration modal («تَمَّتْ خَتْمَةُ الْقُرْآنِ الْكَرِيمِ») while strictly preserving all bookmarks and historical statistics.
  - **Unit Testing Suite (`ReadingTests.swift`):**
    - Added 12 automated unit tests in `Tests/ReadingTests.swift` running under `MutshabehatTests` target, covering bookmark CRUD, duplicate resolution, search, reading dwell, Surah progress %, streak calendar rules, khatma completion/restart, and screen awake lifecycle (100% pass rate across all 23 tests).
- **Advanced Qur'an Search Engine & Interactive Guide (Full Web & Screenshot Parity):** designed, implemented, and integrated a full-featured Qur'an search engine into both the Mushaf Reader (`AyahSearchView`) and Mutshabehat authoring search (`MutshabehatQuranSearchView`) matching all 8 reference screenshots:
  - **Core query engine (`MushafCore`):**
    - Metadata (`AdvancedQuranSearchData.swift`): all 114 Surahs with revelation order, Meccan/Medinan classification, verse counts, 15 Sajdah verses (highlighting the 4 obligatory 'Aza'im prostrations), and Muqatta'at letter sets.
    - Morphology (`AdvancedQuranMorphology.swift`): Arabic roots, lemmas, POS tags (noun, verb, particle), homographs, and prefixed orthographic forms (e.g., `يادم` in Uthmanic script).
    - Query Lexer & Recursive Parser (`AdvancedQuranQueryParser.swift`): AST compiler supporting logical operators (`AND`/`و`, `OR`/`أو`, binary `وليس` / `AND NOT`), search fields (`رقم_السورة`, `رقم_الآية`, `نوع_السورة`, `سجدة`, `نوع_السجدة`, `ك_آ` word count, `ح_آ` letter count, `آ_س` surah ayah count, `ج_آ` term frequency), numeric ranges `[min الى max]`, partial diacritics `آية_:`, root and lemma derivatives (`>`, `>>`, `><`), word properties `{root,pos}`, exact phrases, and wildcards `*`.
    - SQLite Evaluation (`AdvancedQuranSearchEngine.swift`): SQL generation against `mushaf.sqlite` with thread-safe database handles, scalar-level unicode replacement for composite diacritics, and automatic result ranking.
    - Test Suite (`QuranSearchTests.swift`): 23 test suites validating all query examples against the live Qur'an database (100% pass rate across 100 unit tests).
  - **UI & Interactive Guide (`AdvancedSearchGuideView`):**
    - Built all 8 interactive tutorial cards and 23 example query cards matching screenshots (`media_1790925947798.png` – `media_1790926039411.png`) with warm linen/sand query boxes, white cards, adaptive dark mode, and one-tap query execution.
    - Updated `AyahSearchView` with centered "Search in Quran" top header, chevron, circular close button, and "Search the Holy Quran..." placeholder.
    - Connected `AdvancedSearchGuideView` in `MutshabehatQuranSearchView`, enabling instant example selection, custom advanced search queries, and multi-verse insertion into Mutshabehat groups.

- **Mutshabehat — Add, edit, auto-color, word-linker & search module (Web parity):** migrated the full Mutshabehat authoring and management module from the web app into native SwiftUI with local SQLite persistence:
  - **SQLite persistence & schema:** added atomic transactional CRUD in `MutshabehatDatabase` (`savePersonalGroup`, `deletePersonalGroup`, `fetchPersonalGroup`, `toggleFavorite`, `exportDatabase`, `importDatabase`) with foreign-key cascade covering groups, verses, and styled parts.
  - **Arabic diff & auto-color engine:** pure Swift port of `ArabicDiffAlgorithm` (`stripTashkeel`, `normalizeArabic`, bounded Levenshtein distance, LCS matrix backtracking, and token diffing). Integrated `AutoColorPickerView` to compare reference and target verses, providing live diff previews and one-tap part generation with semantic difference coloring.
  - **Interactive word linker:** ported `WordLinkerView` allowing word-by-word visual painting using semantic brushes (عادي، مختلف، متشابه، خاص، محذوف، زائد), palette switching, reset, and automatic contiguous-token consolidation on save.
  - **Integrated Qur'an search:** added `MutshabehatQuranSearchView` directly inside the group editor, integrating `MushafLibrary.searchAyaat` for multi-verse selection and instant insertion with pre-parsed Uthmani text.
  - **Group editor & UI actions:** added `MutshabehatGroupEditorView` with title input, 10 suggested palette swatches, custom ColorPicker, status toggles (Favorite, Completed, Status draft/published/locked), verse reordering/deletion, expandable part badges, note and unique benefit (`unote`) editors, and safe deletion confirmation. Added toolbar `+` creation button, card-level edit actions, and swipe gestures in `MutshabehatView`.
  - **Unit testing:** added 11 automated unit tests in `Tests/MutshabehatTests.swift` running under `MutshabehatTests` target, verifying normalization, tashkeel stripping, Levenshtein distance, word diffs, auto-coloring, and isolated SQLite database operations.

- **Documentation — native iOS agent handoff:** added `apps/ios/HANDOFF.md` with the current feature state, Settings/localization architecture, important files, completed verification, environment blockers and exact continuation checks, while leaving the web branch's root handoff untouched.

- **Settings — grouped preferences and Arabic/English menus:** moved the five Mushaf themes into a dedicated Appearance page and the Debug-only Qiraat/Mutshabehat import/export controls into a dedicated Database page. Added a persisted Arabic/English language selector, native layout-direction switching, localized app menus across Settings, search, index, Qiraat and Mutshabehat, and localized reader metadata while preserving Arabic Qur'an content and fixed Mushaf geometry.

- **Reader — fixed page geometry under controls:** replaced the top control bar's safe-area inset with an overlay, so showing or hiding reader chrome no longer resizes, shifts or recentres the Mushaf page. The page location and print geometry remain identical in both states.

- **Developer data transfer:** added Debug-only Settings controls to export and import the complete Qiraat snapshot and the live Mutshabehat SQLite database through Apple's Files picker, including iCloud Drive. Qiraat exports as one versioned archive containing the catalog and all 604 page files; imports reject incomplete snapshots. Mutshabehat exports checkpoint WAL first and imports only SQLite files containing all required tables, with automatic rollback if reopening fails. The whole section is compiled out of public Release builds.

- **Reader — pure page themes:** added «صفحة بيضاء» and «صفحة سوداء» alongside the existing automatic, light and dark appearances. The selected paper, desk, ink, metadata and ornament colours propagate into already-visible UIKit pages without changing Qur'an layout or Qiraat marks.

## 2026-10-01
- **Mutshabehat — reference semantic palette:** matched the web group legend shown in the supplied references: shared text is green, first difference yellow, second difference purple, third difference teal, additions blue and unique text red, each with its corresponding pale highlight; ordinary continuation text remains black.

- **Mutshabehat — Mushaf-font flip cards:** personal and automated groups now start as compact, darker color-coded title cards. Tapping the title performs a native 3D flip to reveal notes, verses and actions; tapping again closes it. Verse fragments use the bundled KFGQPC Uthmanic Script HAFS font while preserving the established shared/difference/addition/unique semantic colors.

- **Qiraat cards — authentic Uthmanic variant font:** bundled the supplied KFGQPC Uthmanic Script HAFS Regular font in the app's licence-protected generated font folder and registered its internal iOS face (`KFGQPCUthmanicScriptHAFS`). Changed readings now use this Unicode Mushaf font, including their correct harakat, instead of the Damascus fallback; the original selected word continues to use its exact page-specific QCF glyph.

- **Qiraat cards — matched Mushaf weight for changed readings:** changed Unicode variant spellings now use Damascus Bold at the same 40-point optical size as the selected QCF word. This keeps altered harakat correct while removing the visibly thin mismatch in multi-word variant cards.

- **Feature — native Qur'an smart search:** replaced the per-query full-Qur'an scan with a rebuildable indexed SQLite layer derived from the immutable Mushaf fixtures. Added separate Unicode/plain/canonical/imla'i/rasm representations, configurable orthography aliases, ranked exact/smart/broad modes, consecutive-token phrase search, controlled typo fallback, 55 real-data corpus cases, collision reporting, compact Arabic search controls, diagnostics in debug builds, authoritative Uthmani result highlighting, and navigation to highlighted QCF word IDs. The required الصلاة، الزكاة، الحياة، الرحمن and ايمان cases pass; the measured worst indexed corpus query is 41 ms.

- **Qiraat cards — Mushaf-style variant words:** all changed readings now use the native Damascus Quranic Naskh face with full Unicode Arabic and harakat coverage instead of the bold system font. The original word remains rendered with its exact page-specific QCF glyph.

- **Mushaf desk metadata — outside the printed page:** moved the Surah, juz/hizb and page-number labels from the paper drawing into the surrounding UIKit page container. The page number now follows book binding: odd pages align right and even pages align left, including iPad spreads.

- **Mushaf margins — traditional metadata positions:** matched the printed-page convention by placing the current Surah name at the upper-left, juz and hizb at the upper-right, and the Arabic-Indic page number at the lower-right, all inside the protected blank margins.

- **Mushaf decoration — Surah banners:** every Surah heading now uses a consistent Madinah-inspired double-border frame with a shaped central title panel and symmetrical ornamentation, contained within the existing header row so Quran word geometry is unchanged.

- **Reader layout — protected Mushaf metadata and native Qiraat switch:** reserved dedicated top and bottom print bands for the surah name, juz/hizb/rub details and page number so they never overlap Quran glyphs, and replaced the custom Qiraat control with Apple's native SwiftUI switch.

- **Reader UI — full-width Mushaf, search, Qiraat picker and Mutshabehat destination:** removed the duplicate safe-area inset that made the page smaller, kept the top bar outside the Mushaf, added offline diacritic-insensitive ayah search with page jumps, moved the «ق» on/off control into Settings, added a full-screen color-coded reader/narrator picker, and exposed Mutshabehat as its own full-screen reader destination rather than a Settings row.

- **Branding — app icon:** added the supplied «القراءات العشر» artwork as the iPhone and iPad app icon.

- **Feature — reader controls and themes:** added Settings with a persisted System/Light/Dark theme selector; the Mushaf palette follows the selected appearance.

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
