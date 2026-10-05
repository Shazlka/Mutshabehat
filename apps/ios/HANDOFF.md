# Qiraat iOS — Agent Handoff (Reference Baseline: iOS v1.0)

Last updated: 2026-10-05
Milestone: **iOS v1.0** (Reference Tag: `ios-v1.0`)

This is the active handoff and reference baseline for the native iPhone/iPad app in `apps/ios`.
The repository-root `HANDOFF.md` describes the web application and production backend; do not replace it with iOS state.

---

## 🎯 iOS v1.0 Reference Baseline & Recovery Guide

> [!IMPORTANT]
> **iOS v1.0 is the canonical reference milestone.**
> If anything crashes, regresses, or breaks during future development, return to this rock-solid reference baseline immediately using:
> ```bash
> # Rollback entire iOS app to iOS v1.0:
> git checkout ios-v1.0
> 
> # Or restore only apps/ios/ to iOS v1.0 without changing branches:
> git checkout ios-v1.0 -- apps/ios/
> ```

### Verification Baseline at v1.0
- **Core Tests (`make core-test`):** 100/100 tests passing in 14 suites.
- **App Tests (`MutshabehatTests`):** 37/37 tests passing (0 failures).
- **Isolation Check (`./apps/ios/scripts/check_isolation.sh`):** Clean (`isolation ok: only apps/ios differs from origin/main`).
- **Visual Parity:** Verified on iPhone 18 Pro (Page 208/209 reading mode & controls mode) and iPad Pro 13-inch (two-page spread).

---

## Start here

1. Read `AGENTS.md`, then the repository-root `HANDOFF.md` and `PROJECT_MASTER.md`, then `CLAUDE.md`.
2. Work only under `apps/ios/` on `ios/main` or a short-lived `ios/<topic>` branch.
3. Do not merge iOS work into web branch `main`, do not push without the user's permission, and do
   not modify authoritative Qur'an or Qiraat source data to make UI/search features work.
4. Add a dated entry to `CHANGELOG.md` for every code or documentation change.

## Current state (iOS v1.0 Release Features)

The native app currently includes:

- **Mushaf 1441 Reader & Geometry (Full Screen & Stretched):**
  - Page-accurate Mushaf 1441 rendering for all 604 pages with authentic QCF page fonts (`p1...p604.woff2`).
  - Single-slot top header (`ReaderTopBar.swift`): reading mode header (Surah name in authentic King Fahd font, Hizb & Juz) and controls top banner (search, bookmarks, mutshabehat, settings, index button) share the exact same 52pt slot. Tapping smoothly overlays in place without jumping.
  - Non-overlapping stretched Mushaf page: window coordinate mapping via `view.convert(CGPoint.zero, to: nil)` eliminates double safe area insets, anchoring `pageView` directly below the 52pt top header with zero dead gap.
  - Proportional vertical line spacing expansion across all 15 Quranic lines via `PageLayout` (over +50% inter-line breathing room).
  - Prominent bottom page numbers: placed strictly outside and below the page paper in 22pt bold system font (odd on right, even on left).
  - Realistic book spine curvature, specular cylindrical highlight sheen, spine fold line, and paper rim depth (`drawBookSpineAndPageEdges`).
  - Five Mushaf appearances: automatic, light, dark, white page, black page.
- **Illuminated Islamic Surah Banner & Basmalah Typography:**
  - Classical Ottoman/Mamluk manuscript illumination parity (`drawSurahHeader`).
  - Right roundel: Surah number in Arabic-Indic digits without caption text.
  - Left roundel: total Ayah count in Arabic-Indic digits without caption text.
  - Central cartouche: vertically and horizontally centered Surah title in King Fahd Complex calligraphy (`KFGQPCUthmanicScriptHAFS`).
  - Authentic Madinah Mushaf QCF Page 1 Basmalah glyphs (`["ﱁ", "ﱂ", "ﱃ", "ﱄ"]`) matching physical print 100%.
- **Quran Reading & Khatma Engine:**
  - Screen always awake (`isIdleTimerDisabled`) while reading with Settings toggle.
  - Quran bookmarking system: long-press on ayah end marker/word (0.45s with haptics) to bookmark ayah or page; dedicated `BookmarksView`.
  - Reading progress & 30s dwell tracking: dwell ticks every 1.0s and credits ayahs proportionally based on dwell duration.
  - Reading statistics dashboard (`ReadingStatisticsView`): circular activity ring, lifetime cumulative reading time (hours & minutes), daily reading history, 7-day streak tracker, remaining verses per Surah.
  - Cumulative lifetime Ayahs read counter (`lifetimeReadAyahsCount()`).
  - Manual reading sessions (`AddReadingSessionView`): log sessions by full Surah or Ayah range, date/time, duration pills, and recitation from memory toggle.
  - Automatic Khatma completion & restart: detects 100% read ayahs, presents celebration modal, increments lifetime counter, auto-starts Khatma #N.
- Qiraat colouring, reader/narrator filtering, and detailed variant sheets.
- KFGQPC Uthmanic Script HAFS for changed Qiraat words and Mutshabehat Arabic content.
- Native Qur'an smart search with exact, smart, broad, phrase, alias and fuzzy matching.
- Advanced Qur'an Search Engine & Interactive Guide (Web & Screenshot Parity):
  - Comprehensive metadata covering all 114 Surahs (revelation orders, classification, ayah counts), 15 Sajdah verses (with 4 'Aza'im obligatory verses), and Muqatta'at letter sequences.
  - Full morphology lexicon with Arabic roots, lemmas, POS tags, and Uthmanic orthography aliases (`يادم`).
  - AST-based query lexer & parser supporting boolean logic (`و`, `أو`, binary `وليس`), fields (`رقم_السورة`, `رقم_الآية`, `نوع_السورة`, `سجدة`, `نوع_السجدة`, `ك_آ`, `ح_آ`, `آ_س`, `ج_آ`), ranges `[min الى max]`, partial diacritics `آية_:`, root and lemma derivatives (`>`, `>>`, `><`), word properties `{root,pos}`, exact phrases, and wildcards `*`.
  - SQLite query evaluation engine against `mushaf.sqlite` with thread-safe handles, composite diacritic replacement, and query ranking.
  - Interactive `AdvancedSearchGuideView` with all 8 tutorial cards and 23 query example cards from reference screenshots (`media_1790925947798.png` – `media_1790926039411.png`) with warm linen query capsules and adaptive dark mode.
  - Integrated into both Reader search (`AyahSearchView`) and Mutshabehat authoring search (`MutshabehatQuranSearchView`).
- Full-screen Mutshabehat module with personal & automated groups, semantic colour categories and flip cards.
- Complete Mutshabehat group creation & editing (Web parity):
  - Group creation and editing sheet (`MutshabehatGroupEditorView`) with title, 10 suggested swatches + custom ColorPicker, switches for Favorite, Completed, and Status (draft/published/locked).
  - Multi-verse Qur'an search and addition directly from `MushafLibrary.searchAyaat` (`MutshabehatQuranSearchView`).
  - Native Arabic diff & auto-coloring tool with live diff preview (`AutoColorPickerView`, `ArabicDiffAlgorithm`).
  - Interactive word painter (`WordLinkerView`) with semantic brushes (عادي، مختلف، متشابه، خاص، محذوف، زائد) and automatic contiguous-token consolidation.
  - Full local SQLite persistence (`MutshabehatDatabase`) with atomic transactional CRUD and foreign-key cascade.
- Fixed reader geometry: showing/hiding the top chrome overlays the page and does not move it.
- Five Mushaf appearances: automatic, light, dark, white page and black page.
- Mushaf Reading Experience Upgrade:
  - **Screen Always Awake:** lifecycle-aware `isIdleTimerDisabled` keeping screen on while reading and restoring auto-lock on background/inactivity; configurable toggle in Settings.
  - **Illuminated Islamic Surah Banner:** classical Ottoman/Mamluk manuscript illumination parity matching user reference (`media_1790935697488.png`). Sliced into 3:1 aspect ratio wings and horizontal bridging borders, dynamically scaling across device sizes. Right roundel displays Surah number in Arabic-Indic digits with «سُورَة» caption; left roundel displays total Ayahs in Arabic-Indic digits with «آيَاتُهَا» caption; central cartouche displays canonical vowelled Surah title in King Fahd Complex calligraphy (`KFGQPCUthmanicScriptHAFS`) plus revelation classification subtitle («مَدَنِيَّة» / «مَكِّيَّة»). Adaptive dark gold leaf in dark mode and walnut brown in light mode, with resilient vector fallback.
  - **Quran Bookmarking System:** long-press on ayah end marker/word (0.45s with haptics) to bookmark ayah or page; dedicated `BookmarksView` with search, filter, and jump; illuminated silk ribbon and golden ayah emblem indicators.
  - **Reading Progress System & 30s Proportional Dwell:** dwell-based tracking with 30-second full page completion target. Dwell ticks every 1.0s and credits ayahs proportionally based on time stayed on page (`targetCount = Int(Double(totalAyahs) * min(1.0, elapsed / 30.0))`, e.g. 12s on 6 ayahs = 2 ayahs). Dwell flushes automatically on page navigation and app backgrounding. Surah progress supports "المتبقي" (Remaining) filter in `IndexSheet` and `ReadingStatisticsView`.
  - **Apple-Grade Reading Progress Dashboard:** circular activity ring (pages/percent), 3-card scorecard (Total Pages 604, Remaining Pages, Completed Khatmas), Continue Reading hero banner, 7-Day Weekly Streak tracker with checkmark badges, and Surah Khatma search and filter section.
  - **Manual Reading Sessions Modal:** Apple HIG form modal (`AddReadingSessionView`) allowing users to log reading sessions by Ayah or Page range, select date/time, pick duration pills, toggle recitation from memory, and immediately update streaks and Khatma progress.
  - **Daily Reading Streaks:** local timezone calendar day tracking for Current Streak, Longest Streak, and Total Reading Days.
  - **Automatic Khatma Completion & Restart:** detects 100% read ayahs, presents illuminated celebration dialog, increments lifetime khatma counter, and auto-starts Khatma #N at 0% while preserving bookmarks and history.
  - **iPad View Optimization & Bounded Paper Limits:**
    - Height calculation applies safe margins (`topInset` at least 68pt, `bottomInset` at least 46pt), preventing `ReaderTopBar` (~56pt) from ever overlapping the Mushaf page.
    - Vertical stretching disabled on iPad to maintain the canonical Madinah 1441 print aspect ratio.
    - `surahLabel` and `sectionLabel` frames are bounded strictly to `paperFrame.minX ... paperFrame.maxX`, preventing metadata spillover into desk margins.
    - `pageNumberLabel` is constrained beneath the page (`paperFrame.minX ... paperFrame.maxX` at `paperFrame.maxY + 4`) and forced `isHidden = false` on iPad so bottom page numbers are always clearly visible.
    - Subtle paper border, drop shadow, and corner radiuses.
  - **Realistic Book Spine & Page Curvature:**
    - Custom CoreGraphics `drawBookSpineAndPageEdges` in `MushafPageView` simulates a physical open book: spine gutter gradient shadow, specular cylindrical highlight sheen reflecting light across the turning page curve, crisp spine fold line, top/bottom vignette depth gradients, and subtle outer edge paper rim depth.
    - Outer corners selectively rounded while inner spine corners meet seamlessly at the center fold.
  - **Mutshabehat Magazine View:**
    - Editorial magazine layout with dynamic card sizing (`.hero`, `.tall`, `.compact`) partitioned in alternating single and paired blocks.
    - 12-color rich editorial jewel and earth tone palette (`MutshabehatMagazineTheme`) deterministically mapped by group ID hash.
    - Interactive spring expansion (`.snappy`) for both personal and automated cards, inline `ArabicDiffView` previews, ayah tags, and quick actions.
  - **Smart Search Arabic Localization:**
    - `AdvancedSearchGuideView` provides full Arabic titles and instructional descriptions for all 8 tutorials and 23 query cards when app language is Arabic (`app:language:v1`).
    - Localized section headers and `AyahSearchView` mode sub-captions for `smart`, `exact`, and `broad` search modes.
  - **iCloud Database Synchronization (`Mushaf_Qiraat`):**
    - Production database running in Colima Docker on the Mac Mini (`mutshabehat-db`) is the authoritative source of truth.
    - Python pipeline (`sync_colima_to_icloud.py` and webapp wrapper `npm run sync:icloud`) extracts the live database directly from Colima and compiles separate files:
      - `mutshabehat.sqlite` & `mutshabehat.json` (251 groups, 943 verses, 3054 parts, automated groups, annotations)
      - `database_backup.sql` (100.6 MB) & `database_dump.dump` (13.5 MB) (Full PostgreSQL disaster recovery backups)
       - `qiraat.sqlite` & `qiraat.qiraatdata` (Ten Qira'at catalog + 604 page overlays, 3,820 variants, 12,506 rulings)
      - `mushaf.sqlite` (Madinah 1441 page layout and search data)
      - `manifest.json` (Entity counts, timestamps, SHA-256 hashes, source: `colima://mutshabehat-db`)
    - Webapp integration in `~/Projects/mutshabehat-v2`:
      - `npm run sync:icloud`: Exports latest database from Colima to `Mushaf_Qiraat`.
      - `npm run sync:icloud:import`: Two-way import from `Mushaf_Qiraat/mutshabehat.json` back into Colima PostgreSQL.
    - Files written atomically via chunk streaming (`safe_copy`) to `~/Library/Mobile Documents/com~apple~CloudDocs/Mushaf_Qiraat/`.
    - Native `ICloudDatabaseSyncService.swift` on iPhone and iPad auto-discovers `Mushaf_Qiraat`, validates SQLite integrity, and performs hot-reload without app restart.
    - User reading progress (`reading_progress.sqlite` — bookmarks, khatmas, streaks) remains isolated and protected from overwrites.
    - Settings features dedicated «مزامنة السحابة (iCloud Sync)» screen (`ICloudSyncSettingsView.swift`) with live status badge, "Sync Now", "Fetch from Web", and auto-sync toggle.
- Debug-only Qiraat and Mutshabehat database import/export through Apple's Files picker, including
  iCloud Drive locations selected by the user.
- Arabic and English app menus using an Arabic-source String Catalog and a persisted in-app language
  selector. Qur'an content remains authoritative Arabic and keeps RTL rendering.

## Latest Settings implementation

Settings now contains organized sections:

- `Quran Reading & Khatma` / `قراءة القرآن والختمة`:
  - `Reading Statistics & Khatma` (`ReadingStatisticsView`)
  - `Bookmarks` (`BookmarksView`)
  - `Keep Screen Awake` toggle (`keepScreenAwake`, default true)
- `Ten Qira'at` / `القراءات العشر`: Qira'at toggle and reader/narrator picker.
- `Cloud Synchronization` / `مزامنة السحابة`:
  - `iCloud Sync (Mushaf_Qiraat)` (`ICloudSyncSettingsView.swift`) with connection dot, last sync time, database file metrics, manual sync, and direct web fallback.
- `Preferences` / `التفضيلات`:
  - `Appearance` / `المظهر`: all five themes.
  - `Language` / `اللغة`: Arabic and English, stored under `app:language:v1`.
- `Databases` / `قواعد البيانات`: Debug builds only; contains Qiraat and Mutshabehat import/export.

The language preference is applied from `ReaderView` using SwiftUI's `locale` and
`layoutDirection` environments. Arabic uses RTL and English uses LTR. Quranic text fields, QCF page
layout and Arabic difference content retain their own RTL treatment where required.

## Important files

| Area | Files |
|---|---|
| Reader and Settings | `Sources/Reader/ReaderView.swift`, `ReaderTopBar.swift` |
| Reading & Khatma Engine | `Sources/Reading/ReadingTracker.swift`, `QuranReadingDatabase.swift`, `QuranReadingModels.swift` |
| Reading UI & Banners | `Sources/Reading/BookmarksView.swift`, `ReadingStatisticsView.swift`, `KhatmaCelebrationView.swift`, `Sources/Reader/MushafPageView.swift`, `PageController.swift`, `MushafPager.swift` |
| App language | `Sources/Reader/AppLanguage.swift`, `Sources/Localizable.xcstrings` |
| Themes | `Sources/Reader/MushafAppearance.swift`, `MushafPageView.swift`, `PageController.swift` |
| Database transfer | `Sources/Reader/DeveloperDataTransfer.swift`, `Sources/Mutshabehat/MutshabehatDatabase.swift` |
| Search | `Sources/Reader/AyahSearchView.swift`, `MushafCore/Sources/MushafCore/QuranSearch.swift` |
| Qiraat UI | `Sources/Qiraat/QiraatReaderPicker.swift`, `QiraatSheet.swift`, `QiraatControls.swift` |
| Mutshabehat UI | `Sources/Mutshabehat/MutshabehatView.swift`, `ArabicDiffView.swift` |
| Mutshabehat Editor & Tools | `Sources/Mutshabehat/MutshabehatGroupEditorView.swift`, `AutoColorPickerView.swift`, `WordLinkerView.swift`, `MutshabehatQuranSearchView.swift` |
| Mutshabehat Algorithms & Models | `Sources/Mutshabehat/ArabicDiffAlgorithm.swift`, `MutshabehatModels.swift`, `MutshabehatDatabase.swift` |
| Project generation | `project.yml` |
| Unit and UI coverage | `Tests/ReadingTests.swift`, `Tests/MutshabehatTests.swift`, `UITests/ReaderUITests.swift`, `UITests/QiraatUITests.swift` |

## Verification completed

- `make project`: succeeds cleanly (`xcodegen generate --quiet`).
- Xcode regular application build: succeeds with `** BUILD SUCCEEDED **`.
- Unit test suite (`MutshabehatTests`): all 37 tests pass with 0 failures on simulator:
  - 26 `ReadingTests` (bookmarks CRUD & duplicate prevention, dwell time, streak calendar rules, Surah %, Khatma completion & restart, screen awake, page 8 Qira'at rulings parity, iCloud sync manifest and folder discovery, authentic Hafs font loading, next unread ayah and page resume navigation, full surah manual sessions, cumulative read ayahs accumulation, reading duration tracking and daily accumulation).
  - 11 `MutshabehatTests` (diff algorithm, normalization, auto-coloring, database operations).
- Core test suite (`make core-test` / `MushafCoreTests`): all 100 tests in 14 suites pass (including all 23 reference advanced search query test cases).
- Data test suite (`make data-test`): all 41 Python validation tests pass.
- Repository isolation check (`scripts/check_isolation.sh`): passes (`isolation ok: only apps/ios differs from origin/main`).
- String Catalog verification: zero untranslated English entries in both catalogs.
- `git diff --check`: clean.

## Verification blockers in this environment

- Running the full UI test target (`MutshabehatUITests`) through Xcode requires a developer signing team for the test runner bundle. (Unit tests run and pass under `MutshabehatTests`).

## Recommended next-agent checks

1. Open the generated project with `make open` and select the user's Development Team for the app and
   `MutshabehatUITests` target if the user wants simulator/device UI tests.
2. Run the Settings UI tests, especially:
   - themes are reachable through `open-theme-settings`;
   - languages are reachable through `open-language-settings`;
   - selecting `language-en` changes the title to `Language` without changing Mushaf geometry;
   - database actions are reachable through `open-database-settings` in Debug builds.
3. Verify Arabic and English on iPhone and iPad, including Settings, search, index, Qiraat reader
   picker/detail sheet and Mutshabehat. Quran verses and reader names must not be transliterated.
4. Confirm theme changes while a Mushaf page is already visible, particularly pure white and pure
   black pages.
5. Before committing, run `make test` when signing/sandbox configuration permits, then inspect
   `git status` carefully because many changes belong to the continuing user-requested feature set.

## Safety and release notes

- Database import/export remains compiled out of Release builds by `#if DEBUG`.
- Imports validate data before replacing the active copy and retain rollback behaviour. Do not weaken
  those checks merely to accept a file.
- The font and generated databases under `Generated/` are intentionally uncommitted/licence-sensitive.
- Do not commit credentials, `Config.xcconfig`, `Signing.xcconfig`, generated databases or fonts.
- Do not push or sign in to Apple/GitHub/Vercel without explicit user approval.
