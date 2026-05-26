# Combined README and Release Notes for V82B
V82B new version

---

## README_V70_DUAL_QURAN_FONTS_THEME_MODAL.md


# V70 — Dual Quran Fonts + Theme-Aligned Edit Modal

## What changed

### Font modes
- **Normal Quran**: used for search, edit, textareas, live preview inside edit, and comparison.
- **Mushaf QPC V2**: used for beautiful group display/review when selected from Settings.

### Font file support
The CSS now supports local fonts placed in `/fonts`:
- `qpc-v2.woff2` or `qpc-v2.ttf`
- `KFGQPCNastaleeq-Regular.woff2` or `.ttf`
- `surah-name-v4.woff2` or `.ttf`

If the font files are missing, the app falls back to the normal Quran font stack.

### Edit modal theme fix
- The modification modal header now follows the current app theme.
- The X close button now uses matching theme color, border, and background.
- Dark mode compatibility improved.

## Preserved
- Personal/Automated databases.
- Smart Quran search.
- Existing quran-reference.js data and APIs.
- Existing filters, comparison, add/edit workflow.


---

## README_V71_SURAH_AYAH_DROPDOWN_FONT_PREVIEW.md


# V71 — Surah/Ayah Dropdowns + Font Preview

## What changed

### Modification window
- Replaced manual Surah input with a Surah dropdown.
- Replaced manual Ayah input with an Ayah dropdown.
- Ayah dropdown updates automatically based on the selected Surah using `quran-reference.js`.

### Settings font preview
- Added live font preview under Settings > Font.
- Preview changes immediately when selecting Normal Quran or Mushaf QPC V2.

### Fonts folder
The app works even if `/fonts` is empty because CSS fallback fonts are included.
For real QPC V2 display, add one of these files:
- `fonts/qpc-v2.woff2`
- `fonts/qpc-v2.ttf`

Keep the exact file name.


---

## README_V78_CLEAN_V71_RESTORED_FEATURES.md


# V78 — Clean V71 + Restored Features

This version starts from the clean V71 base and restores the requested V72/V73 features without using corrupted V74/V75/V76 code.

## Restored
- Canvas HD photo export.
- Copy with notes and fallback.
- Modal scroll lock.
- Mobile swipe-down close.
- GitHub status panel.
- Mobile group detail modal.
- Completed group-number toggle.
- diff3 color type.
- Outline SVG icons.

## Preserved
- V71 Surah/Ayah dropdowns.
- V71 font preview.
- Personal and automated database separation.


---

## README_V79_GITHUB_SYNC_STATUS.md


# V79 — Improved GitHub Auto Sync Status

This version keeps the V78/V71 UI and features, and adds a real GitHub Auto Sync status system for `V71/personal-data.js`.

Defaults: Owner `Shazlka`, Repo `Mutashabihat`, Branch `main`, Path `V71/personal-data.js`.

Live GitHub validation requires opening from HTTPS/GitHub Pages and using a valid token with repository contents permissions.


---

## README_V80_AUTO_DELETE.md


# V80 — Automated Database Delete

This version adds deletion of unwanted groups from the Automated database while preserving all V79/V78/V71 features.

Use Settings > Edit Mode, open the Automated database, then click **حذف من الآلية**. Export the Automated database afterward if you want the cleaned database to become permanent in GitHub.


---

## README_V82_FIX_AUTOMATED_SURAHS_LOADER.md


Mutashabihat V82 - Fix Automated Surah Loader Empty Issue

Problem fixed:
- In V81 some deployments showed the automated-surahs database as empty.

Root correction:
- The loader now uses Surah number instead of Arabic Surah name in the button onclick/loading path.
- Each chunk now registers data in window.AUTOMATED_SURAH_DATA_BY_NO[SurahNo].
- The old Arabic-name assignment is also kept for compatibility.
- Added clear error message if a chunk file cannot be loaded from GitHub.

Required GitHub files:
- index.html
- app.js
- automated-manifest.js
- automated-data.js small stub
- full folder automated-surahs with 114 files

Validation:
- automated-surahs files generated: 114
- Original automated groups: 12668
- Largest chunk size bytes: 7690825
- Generated: 2026-05-15T03:58:11.487753Z


---

## README_V70_DUAL_QURAN_FONTS_THEME_MODAL.md


# V70 — Dual Quran Fonts + Theme-Aligned Edit Modal

## What changed

### Font modes
- **Normal Quran**: used for search, edit, textareas, live preview inside edit, and comparison.
- **Mushaf QPC V2**: used for beautiful group display/review when selected from Settings.

### Font file support
The CSS now supports local fonts placed in `/fonts`:
- `qpc-v2.woff2` or `qpc-v2.ttf`
- `KFGQPCNastaleeq-Regular.woff2` or `.ttf`
- `surah-name-v4.woff2` or `.ttf`

If the font files are missing, the app falls back to the normal Quran font stack.

### Edit modal theme fix
- The modification modal header now follows the current app theme.
- The X close button now uses matching theme color, border, and background.
- Dark mode compatibility improved.

## Preserved
- Personal/Automated databases.
- Smart Quran search.
- Existing quran-reference.js data and APIs.
- Existing filters, comparison, add/edit workflow.


---

## README_V71_SURAH_AYAH_DROPDOWN_FONT_PREVIEW.md


# V71 — Surah/Ayah Dropdowns + Font Preview

## What changed

### Modification window
- Replaced manual Surah input with a Surah dropdown.
- Replaced manual Ayah input with an Ayah dropdown.
- Ayah dropdown updates automatically based on the selected Surah using `quran-reference.js`.

### Settings font preview
- Added live font preview under Settings > Font.
- Preview changes immediately when selecting Normal Quran or Mushaf QPC V2.

### Fonts folder
The app works even if `/fonts` is empty because CSS fallback fonts are included.
For real QPC V2 display, add one of these files:
- `fonts/qpc-v2.woff2`
- `fonts/qpc-v2.ttf`

Keep the exact file name.


---

## README_V78_CLEAN_V71_RESTORED_FEATURES.md


# V78 — Clean V71 + Restored Features

This version starts from the clean V71 base and restores the requested V72/V73 features without using corrupted V74/V75/V76 code.

## Restored
- Canvas HD photo export.
- Copy with notes and fallback.
- Modal scroll lock.
- Mobile swipe-down close.
- GitHub status panel.
- Mobile group detail modal.
- Completed group-number toggle.
- diff3 color type.
- Outline SVG icons.

## Preserved
- V71 Surah/Ayah dropdowns.
- V71 font preview.
- Personal and automated database separation.


---

## README_V79_GITHUB_SYNC_STATUS.md


# V79 — Improved GitHub Auto Sync Status

This version keeps the V78/V71 UI and features, and adds a real GitHub Auto Sync status system for `V71/personal-data.js`.

Defaults: Owner `Shazlka`, Repo `Mutashabihat`, Branch `main`, Path `V71/personal-data.js`.

Live GitHub validation requires opening from HTTPS/GitHub Pages and using a valid token with repository contents permissions.


---

## README_V80_AUTO_DELETE.md


# V80 — Automated Database Delete

This version adds deletion of unwanted groups from the Automated database while preserving all V79/V78/V71 features.

Use Settings > Edit Mode, open the Automated database, then click **حذف من الآلية**. Export the Automated database afterward if you want the cleaned database to become permanent in GitHub.


---

## README_V82_FIX_AUTOMATED_SURAHS_LOADER.md


Mutashabihat V82 - Fix Automated Surah Loader Empty Issue

Problem fixed:
- In V81 some deployments showed the automated-surahs database as empty.

Root correction:
- The loader now uses Surah number instead of Arabic Surah name in the button onclick/loading path.
- Each chunk now registers data in window.AUTOMATED_SURAH_DATA_BY_NO[SurahNo].
- The old Arabic-name assignment is also kept for compatibility.
- Added clear error message if a chunk file cannot be loaded from GitHub.

Required GitHub files:
- index.html
- app.js
- automated-manifest.js
- automated-data.js small stub
- full folder automated-surahs with 114 files

Validation:
- automated-surahs files generated: 114
- Original automated groups: 12668
- Largest chunk size bytes: 7690825
- Generated: 2026-05-15T03:58:11.487753Z


---

## RELEASE_NOTES_V85.md


# Release Notes — V85 Independent Sorting and Filters

## Implemented
- Moved sorting dropdown outside the collapsible Surah filter menu.
- Sorting dropdown is now in the same filter bar line as the filter controls.
- Desktop/tablet layout stays horizontal; mobile layout is compact and responsive.
- Added independent sorting persistence: `personalSortMethod`, `automatedSortMethod`.
- Added independent filter persistence: `personalFilters`, `automatedFilters`.
- Filters and sorting are restored per database when reopening.
- Filters reset only by user action.

## Preserved
- Adding personal groups, saving personal DB, copying Automated groups to Personal, exporting data.js, GitHub sync, RTL/theme/responsive design, DB format, and Automated lazy loading.

## Microsoft Graph / Azure
- No Microsoft Graph or Azure App Registration changes are required.
- Existing GitHub token/repo/branch/path settings remain unchanged.


---

## release_note_v70_dual_quran_fonts_theme_modal.txt


Release Note — V70 Dual Quran Fonts + Theme-Aligned Edit Modal

Implemented requested changes:
- Added two clear Quran font modes in Settings:
  1) Normal Quran — for search, edit, and comparison.
  2) Mushaf QPC V2 — for beautiful display/review.
- Group display/review text now follows the selected font mode.
- Search/edit/comparison areas always use the Normal Quran font stack for readability and accurate editing.
- Added CSS @font-face references for local font files:
  - fonts/qpc-v2.woff2 / fonts/qpc-v2.ttf
  - fonts/KFGQPCNastaleeq-Regular.woff2 / .ttf
  - fonts/surah-name-v4.woff2 / .ttf
- Updated Settings > Font dropdown to include Normal Quran and Mushaf QPC V2 modes.
- Fixed تعديل المتشابه modal header color to match the active app theme.
- Fixed X close button style to match the app theme in light and dark modes.
- Updated in-app Release Notes to V70.

Preserved:
- Personal and Automated database separation.
- Smart Quran search in Add/Edit windows.
- Surah filter and display mode controls.
- Existing quran-reference.js APIs and current data files.

Note:
- The QPC V2 font mode is ready for local font files. If the actual QPC V2 font file is not present in /fonts, the browser will use the fallback Quran font stack.


---

## release_note_v71_surah_ayah_dropdown_font_preview.txt


Release Note — V71 Surah/Ayah Dropdowns + Font Preview

Implemented:
- In the modification window, Surah is now a dropdown list.
- Ayah number is now a dropdown list dependent on the selected Surah.
- Changing the Surah automatically refreshes the Ayah dropdown based on quran-reference.js.
- Settings > Font now includes a live preview area before saving.
- Font preview explains when the real QPC V2 font file is missing and fallback font is being used.

Font folder note:
- No action is required if you accept the fallback Quran font.
- To use real Mushaf QPC V2 display, place qpc-v2.woff2 or qpc-v2.ttf inside /fonts.
- Keep the exact filename as referenced by CSS.

Preserved:
- Personal and Automated database separation.
- Smart Quran search.
- Theme modal styling.
- Existing add/edit/compare/filter workflows.


---

## release_note_v78_clean_v71_restored_features.txt


Release Note — V78 Clean V71 + Restored Features

Base:
- Clean V71 UTF-8 Arabic base. No corrupted V74/V75/V76 override chain is used.

Restored features:
- Canvas-based HD PNG photo export with color coding and notes.
- Reliable copy group text with notes and clipboard fallback.
- Modal background scroll lock.
- Swipe-down close on mobile from modal header/top area.
- GitHub connection status panel in Settings with HTTPS/repo/token/live test indicators.
- Database updating/ready status for GitHub sync action.
- Mobile group detail modal.
- Completed toggle by clicking group number.
- diff3 color type.
- Status text beside group title removed; favorite/completed/lock are icon/color only.
- Professional outline SVG icons for camera/copy/favorite/lock/edit/compare.

Preserved from V71:
- Surah/Ayah dependent dropdowns.
- Settings font preview.
- Personal and automated databases.
- Smart Quran search.


---

## release_note_v79_github_sync_status.txt


Release Note — V79 GitHub Auto Sync Status Improvements

Implemented:
- Added clear GitHub Sync Status section in Settings > GitHub Auto Sync.
- Added status states: 🟡 جاري المزامنة، ✅ تمت المزامنة بنجاح، ❌ فشل المزامنة، ⚠️ لا توجد تغييرات للمزامنة.
- Shows last successful sync date/time, synced file path, short commit SHA, optional commit link.
- Added Copy Error, Open Commit, and Verify on GitHub buttons.
- Uses real GitHub Contents API flow: GET current SHA, compare content, UTF-8 Base64 encode, PUT update with message/content/sha/branch.
- Success is displayed only after GitHub returns commit information.
- If local and remote content are identical, no commit is created.
- Stores last successful sync info in localStorage: github_last_sync_time, github_last_commit_sha, github_last_commit_url, github_last_sync_path.
- Added console logs for sync start, SHA retrieval, update request, success SHA, and full failure error.
- Auto Sync runs after personal database changes saved through saveDb().
- Added soft green/yellow/red/gray visual indicator near GitHub Auto Sync title.

Defaults preserved:
- Owner: Shazlka
- Repo: Mutashabihat
- Branch: main
- Path: V71/personal-data.js

Preserved:
- Current UI theme/layout.
- Existing GitHub settings fields: Token, Owner, Repo, Branch, Path, Save, Test Connection, Sync Now.
- All V78/V71 restored features and database separation.


---

## release_note_v80_auto_delete.txt


Release Note — V80 Automated Database Delete

Implemented:
- Added ability to delete unwanted groups from the Automated database.
- Delete button appears on Automated database cards only when Edit Mode is enabled.
- Deletion is saved in the local Automated database cache, so deleted groups stay removed after refresh.
- Added confirmation before deletion to avoid accidental removal.
- Added mobile group detail delete option for Automated groups.
- Export data.js can be used after cleanup to download the cleaned automated-data.js file.

Important workflow:
1. Open Settings.
2. Enable Edit Mode.
3. Open Automated database.
4. Press “حذف من الآلية” for groups not required.
5. After finishing cleanup, press “Export data.js” while Automated database is open.
6. Replace automated-data.js in GitHub with the exported file.

Note:
- Reset Cache / تحديث البيانات reloads data from automated-data.js. If you do not replace automated-data.js after cleanup, deleted automated groups will return after reset.

Preserved:
- All V79 GitHub sync status features.
- All V78/V71 restored features and UI.
- Personal and Automated database separation.


---

## release_note_v82_fix_automated_surahs_loader.txt


Mutashabihat V82 - Fix Automated Surah Loader Empty Issue

Problem fixed:
- In V81 some deployments showed the automated-surahs database as empty.

Root correction:
- The loader now uses Surah number instead of Arabic Surah name in the button onclick/loading path.
- Each chunk now registers data in window.AUTOMATED_SURAH_DATA_BY_NO[SurahNo].
- The old Arabic-name assignment is also kept for compatibility.
- Added clear error message if a chunk file cannot be loaded from GitHub.

Required GitHub files:
- index.html
- app.js
- automated-manifest.js
- automated-data.js small stub
- full folder automated-surahs with 114 files

Validation:
- automated-surahs files generated: 114
- Original automated groups: 12668
- Largest chunk size bytes: 7690825
- Generated: 2026-05-15T03:58:11.487753Z


---

## release_note_v70_dual_quran_fonts_theme_modal.txt


Release Note — V70 Dual Quran Fonts + Theme-Aligned Edit Modal

Implemented requested changes:
- Added two clear Quran font modes in Settings:
  1) Normal Quran — for search, edit, and comparison.
  2) Mushaf QPC V2 — for beautiful display/review.
- Group display/review text now follows the selected font mode.
- Search/edit/comparison areas always use the Normal Quran font stack for readability and accurate editing.
- Added CSS @font-face references for local font files:
  - fonts/qpc-v2.woff2 / fonts/qpc-v2.ttf
  - fonts/KFGQPCNastaleeq-Regular.woff2 / .ttf
  - fonts/surah-name-v4.woff2 / .ttf
- Updated Settings > Font dropdown to include Normal Quran and Mushaf QPC V2 modes.
- Fixed تعديل المتشابه modal header color to match the active app theme.
- Fixed X close button style to match the app theme in light and dark modes.
- Updated in-app Release Notes to V70.

Preserved:
- Personal and Automated database separation.
- Smart Quran search in Add/Edit windows.
- Surah filter and display mode controls.
- Existing quran-reference.js APIs and current data files.

Note:
- The QPC V2 font mode is ready for local font files. If the actual QPC V2 font file is not present in /fonts, the browser will use the fallback Quran font stack.


---

## release_note_v71_surah_ayah_dropdown_font_preview.txt


Release Note — V71 Surah/Ayah Dropdowns + Font Preview

Implemented:
- In the modification window, Surah is now a dropdown list.
- Ayah number is now a dropdown list dependent on the selected Surah.
- Changing the Surah automatically refreshes the Ayah dropdown based on quran-reference.js.
- Settings > Font now includes a live preview area before saving.
- Font preview explains when the real QPC V2 font file is missing and fallback font is being used.

Font folder note:
- No action is required if you accept the fallback Quran font.
- To use real Mushaf QPC V2 display, place qpc-v2.woff2 or qpc-v2.ttf inside /fonts.
- Keep the exact filename as referenced by CSS.

Preserved:
- Personal and Automated database separation.
- Smart Quran search.
- Theme modal styling.
- Existing add/edit/compare/filter workflows.


---

## release_note_v78_clean_v71_restored_features.txt


Release Note — V78 Clean V71 + Restored Features

Base:
- Clean V71 UTF-8 Arabic base. No corrupted V74/V75/V76 override chain is used.

Restored features:
- Canvas-based HD PNG photo export with color coding and notes.
- Reliable copy group text with notes and clipboard fallback.
- Modal background scroll lock.
- Swipe-down close on mobile from modal header/top area.
- GitHub connection status panel in Settings with HTTPS/repo/token/live test indicators.
- Database updating/ready status for GitHub sync action.
- Mobile group detail modal.
- Completed toggle by clicking group number.
- diff3 color type.
- Status text beside group title removed; favorite/completed/lock are icon/color only.
- Professional outline SVG icons for camera/copy/favorite/lock/edit/compare.

Preserved from V71:
- Surah/Ayah dependent dropdowns.
- Settings font preview.
- Personal and automated databases.
- Smart Quran search.


---

## release_note_v79_github_sync_status.txt


Release Note — V79 GitHub Auto Sync Status Improvements

Implemented:
- Added clear GitHub Sync Status section in Settings > GitHub Auto Sync.
- Added status states: 🟡 جاري المزامنة، ✅ تمت المزامنة بنجاح، ❌ فشل المزامنة، ⚠️ لا توجد تغييرات للمزامنة.
- Shows last successful sync date/time, synced file path, short commit SHA, optional commit link.
- Added Copy Error, Open Commit, and Verify on GitHub buttons.
- Uses real GitHub Contents API flow: GET current SHA, compare content, UTF-8 Base64 encode, PUT update with message/content/sha/branch.
- Success is displayed only after GitHub returns commit information.
- If local and remote content are identical, no commit is created.
- Stores last successful sync info in localStorage: github_last_sync_time, github_last_commit_sha, github_last_commit_url, github_last_sync_path.
- Added console logs for sync start, SHA retrieval, update request, success SHA, and full failure error.
- Auto Sync runs after personal database changes saved through saveDb().
- Added soft green/yellow/red/gray visual indicator near GitHub Auto Sync title.

Defaults preserved:
- Owner: Shazlka
- Repo: Mutashabihat
- Branch: main
- Path: V71/personal-data.js

Preserved:
- Current UI theme/layout.
- Existing GitHub settings fields: Token, Owner, Repo, Branch, Path, Save, Test Connection, Sync Now.
- All V78/V71 restored features and database separation.


---

## release_note_v80_auto_delete.txt


Release Note — V80 Automated Database Delete

Implemented:
- Added ability to delete unwanted groups from the Automated database.
- Delete button appears on Automated database cards only when Edit Mode is enabled.
- Deletion is saved in the local Automated database cache, so deleted groups stay removed after refresh.
- Added confirmation before deletion to avoid accidental removal.
- Added mobile group detail delete option for Automated groups.
- Export data.js can be used after cleanup to download the cleaned automated-data.js file.

Important workflow:
1. Open Settings.
2. Enable Edit Mode.
3. Open Automated database.
4. Press “حذف من الآلية” for groups not required.
5. After finishing cleanup, press “Export data.js” while Automated database is open.
6. Replace automated-data.js in GitHub with the exported file.

Note:
- Reset Cache / تحديث البيانات reloads data from automated-data.js. If you do not replace automated-data.js after cleanup, deleted automated groups will return after reset.

Preserved:
- All V79 GitHub sync status features.
- All V78/V71 restored features and UI.
- Personal and Automated database separation.


---

## release_note_v82_fix_automated_surahs_loader.txt


Mutashabihat V82 - Fix Automated Surah Loader Empty Issue

Problem fixed:
- In V81 some deployments showed the automated-surahs database as empty.

Root correction:
- The loader now uses Surah number instead of Arabic Surah name in the button onclick/loading path.
- Each chunk now registers data in window.AUTOMATED_SURAH_DATA_BY_NO[SurahNo].
- The old Arabic-name assignment is also kept for compatibility.
- Added clear error message if a chunk file cannot be loaded from GitHub.

Required GitHub files:
- index.html
- app.js
- automated-manifest.js
- automated-data.js small stub
- full folder automated-surahs with 114 files

Validation:
- automated-surahs files generated: 114
- Original automated groups: 12668
- Largest chunk size bytes: 7690825
- Generated: 2026-05-15T03:58:11.487753Z


---

## fonts_README_V70.txt


Fonts folder instructions for V70

Place optional local font files here if available:
- qpc-v2.woff2 or qpc-v2.ttf
- KFGQPCNastaleeq-Regular.woff2 or KFGQPCNastaleeq-Regular.ttf
- surah-name-v4.woff2 or surah-name-v4.ttf

The project will still work without these files because CSS fallback fonts are included.


---

## README_V70_DUAL_QURAN_FONTS_THEME_MODAL.md


# V70 — Dual Quran Fonts + Theme-Aligned Edit Modal

## What changed

### Font modes
- **Normal Quran**: used for search, edit, textareas, live preview inside edit, and comparison.
- **Mushaf QPC V2**: used for beautiful group display/review when selected from Settings.

### Font file support
The CSS now supports local fonts placed in `/fonts`:
- `qpc-v2.woff2` or `qpc-v2.ttf`
- `KFGQPCNastaleeq-Regular.woff2` or `.ttf`
- `surah-name-v4.woff2` or `.ttf`

If the font files are missing, the app falls back to the normal Quran font stack.

### Edit modal theme fix
- The modification modal header now follows the current app theme.
- The X close button now uses matching theme color, border, and background.
- Dark mode compatibility improved.

## Preserved
- Personal/Automated databases.
- Smart Quran search.
- Existing quran-reference.js data and APIs.
- Existing filters, comparison, add/edit workflow.


---

## README_V71_SURAH_AYAH_DROPDOWN_FONT_PREVIEW.md


# V71 — Surah/Ayah Dropdowns + Font Preview

## What changed

### Modification window
- Replaced manual Surah input with a Surah dropdown.
- Replaced manual Ayah input with an Ayah dropdown.
- Ayah dropdown updates automatically based on the selected Surah using `quran-reference.js`.

### Settings font preview
- Added live font preview under Settings > Font.
- Preview changes immediately when selecting Normal Quran or Mushaf QPC V2.

### Fonts folder
The app works even if `/fonts` is empty because CSS fallback fonts are included.
For real QPC V2 display, add one of these files:
- `fonts/qpc-v2.woff2`
- `fonts/qpc-v2.ttf`

Keep the exact file name.


---

## README_V78_CLEAN_V71_RESTORED_FEATURES.md


# V78 — Clean V71 + Restored Features

This version starts from the clean V71 base and restores the requested V72/V73 features without using corrupted V74/V75/V76 code.

## Restored
- Canvas HD photo export.
- Copy with notes and fallback.
- Modal scroll lock.
- Mobile swipe-down close.
- GitHub status panel.
- Mobile group detail modal.
- Completed group-number toggle.
- diff3 color type.
- Outline SVG icons.

## Preserved
- V71 Surah/Ayah dropdowns.
- V71 font preview.
- Personal and automated database separation.


---

## README_V79_GITHUB_SYNC_STATUS.md


# V79 — Improved GitHub Auto Sync Status

This version keeps the V78/V71 UI and features, and adds a real GitHub Auto Sync status system for `V71/personal-data.js`.

Defaults: Owner `Shazlka`, Repo `Mutashabihat`, Branch `main`, Path `V71/personal-data.js`.

Live GitHub validation requires opening from HTTPS/GitHub Pages and using a valid token with repository contents permissions.


---

## README_V80_AUTO_DELETE.md


# V80 — Automated Database Delete

This version adds deletion of unwanted groups from the Automated database while preserving all V79/V78/V71 features.

Use Settings > Edit Mode, open the Automated database, then click **حذف من الآلية**. Export the Automated database afterward if you want the cleaned database to become permanent in GitHub.


---

## README_V82_FIX_AUTOMATED_SURAHS_LOADER.md


Mutashabihat V82 - Fix Automated Surah Loader Empty Issue

Problem fixed:
- In V81 some deployments showed the automated-surahs database as empty.

Root correction:
- The loader now uses Surah number instead of Arabic Surah name in the button onclick/loading path.
- Each chunk now registers data in window.AUTOMATED_SURAH_DATA_BY_NO[SurahNo].
- The old Arabic-name assignment is also kept for compatibility.
- Added clear error message if a chunk file cannot be loaded from GitHub.

Required GitHub files:
- index.html
- app.js
- automated-manifest.js
- automated-data.js small stub
- full folder automated-surahs with 114 files

Validation:
- automated-surahs files generated: 114
- Original automated groups: 12668
- Largest chunk size bytes: 7690825
- Generated: 2026-05-15T03:58:11.487753Z

---

## README_V83_PREMIUM_UI_UX_AND_SETTINGS_PULL.md


# V83 — Premium UI/UX visual upgrades, Mobile Burger controls, and GitHub pull integration

This version implements extensive, modern visual upgrades to establish a high-end visual hierarchy and features comprehensive controls optimized for mobile interfaces.

## 🚀 Added Features & Visual Upgrades

### 1. 🎨 Emerald Green Sidebar Panel & Floating Mobile Card
- **Moved Active DB Panel**: Moved the entire active database controls section (dynamic database titles, dynamic description subtitle, search input box, and quick-action buttons: *Add Mutashabih, Expand/Collapse, Sync GitHub*) from the middle cards column into the **dark emerald green right sidebar (`v83-sidebar`)** for desktops and tablets.
- **Floating Mobile Widget**: Automatically adapts the panel on mobile viewports into a gorgeous, floating white card layout at the very top of the list view. This ensures full responsive access to search, sync, and add actions with zero HTML or ID duplicates!

### 2. 🧹 Dynamic Tashkeel Stripping from Titles
- **Vowel Stripping**: Created the `stripTashkeel` helper in `js/utils.js` (using unicode regex `[\u064B-\u065F\u0670\u06D6-\u06ED]`) to dynamically remove Arabic diacritics and vowel markers from titles in the cards list, mobile legacy details modal, main details pane, mobile sheet drawer, and live edit previews. Only headings are stripped; body verses retain full vowels for accurate reading.

### 3. 📏 Sleek Cairo Title Font & Normalized Layout Spacing
- **Cairo Google Font**: Registered the dynamic `Cairo` font weights inside `V83/index.html`.
- **Layout Normalization**: Now that tall diacritic harakat are stripped from titles, we normalized their CSS parameters in `styles/upgrades.css` to be tight, snug, and modern:
  - Tightened line-height to `1.5 !important` (was `1.65`).
  - Standardized card titles margin-bottom to `8px !important` (was `15px`).
  - Set the title font-size to a balanced `1.05rem !important` (was `1.08rem`).

### 4. 🍔 Premium Bottom Burger Drawer (Qanawat Control Menu)
- **Burger Button Beside Home**: Added a custom `<button id="mnavBurger">` directly next to the home button `mnavHome` in the mobile bottom navigation bar in `V83/index.html` with a beautiful inline SVG burger icon.
- **Dynamic Slide-out Bottom-Sheet Drawer**: Created `openV83MobileBurgerMenu()` in `js/modals.js` that constructs a full-featured, thumb-friendly panel. Swipe-to-close gestures and backdrop clicks seamlessly close the drawer.
- **Active Database Switcher**: Provides cards to switch instantly between Personal and Automated databases, dynamically highlighting the selected state and rendering localized counts.
- **Instant Sorting Selector**: Lists all 5 display modes (Original, By Surah, Grouped by Surah, Newest First, Most Verses) with a custom gold checkmark (✓) highlighting the active method.

### 5. 🔍 Surah Selector Database Loading in Mobile Drawer
- **Dynamic Surah Picker**: Populated a complete list of all 114 Surahs inside the mobile burger drawer using `surahNames()` helper.
- **Lazy Database Loading & Filtering**: Clicking any Surah closes the drawer immediately and triggers `filterBySurahNo(no)` which filters groups locally (for Personal DB) or **fetches and lazy-loads the specific Surah database remotely (for Automated DB)**, complete with pleasant network loading notifications.
- **Smart Mobile Notice**: Displays a warn hint panel inside the drawer when the Automated Database is selected but no Surah filter is active, advising the user to select a Surah to load its remote content.

### 6. 📥 Option to Pull Personal Database from GitHub in Settings
- **GitHub Pull Button**: Added a red `Pull / جلب من GitHub` action button inside the settings modal card actions row inside `js/settings.js`.
- **Dynamic Pull Logic**: Implemented `pullFromGitHub()` in `js/github-sync.js` to download, decode, and parse remote personal-data file, displaying a warning confirmation listing exact counts of groups to prevent accidental loss, backing up the current database locally (`ghBackupPersonalV88`) before overwriting, and instantly updating the UI.

### 7. 📏 Live Verse Font Size Scale Toggler
- **Interactive Sizers**: Interactive sizers inside the mobile drawer scale verse text sizes from `70%` to `180%` using responsive CSS custom variables (`--verse-fs`), preserving preference across page reloads.

### 8. 🧼 Mobile Toolbar Decluttering
- **Removed Favorite Button**: Fully removed the redundant `mnavFav` button from the bottom navigation bar to optimize space and establish a pristine visual hierarchy, as the premium burger drawer now contains all the necessary settings, database controls, and layout features.

### 9. ☁️ Version 14 Cache-Busters
- Promoted all query-string cache-busters to `v83_upgrades_20260526_7` across styles, scripts, and HTML imports to force immediate browser reloads.

### 10. 🧹 Ayah Preview Box Removal
- **Streamlined Card Aesthetics**: Completely removed the collapsed `.v83-preview` (Ayah preview box) from all group cards in both desktop and mobile viewports. This delivers a cleaner, faster, and highly focused list-view layout while avoiding extra DOM weight and redundant script processing.

### 11. 📏 Mobile Detailed Pane Font Scale
- **Optimized Mobile Layout**: Reduced the Ayah/verse font size inside the mobile detailed sheet (`#v83MobileDetailContent`) and desktop-style detailed pane on mobile viewports by 60% (`calc(var(--verse-fs-mobile) * 0.6)`). This prevents text overflow, respects user-selected scaling, and ensures that long verses fit the window screen beautifully.

### 12. 🚫 Mobile Background Scroll Locking
- **Zero Scroll Leakage**: Linked the mobile detailed sheet lifecycle to the Safari-optimized global scroll lock system (`lockBodyScrollV78` and `unlockBodyScrollV78`). This completely locks the background main window viewport while the mobile detail drawer is active, allowing friction-free scrolling only inside the drawer.
- **Dismiss on Backdrop Tap**: Tapping anywhere on the dark blurred backdrop overlay outside the detail sheet container now smoothly closes the detailed drawer and unlocks scrolling automatically.

### 13. 📋 Double-Click to Copy Ayah Text
- **Quick Ayah Sharing**: Implemented a double-click event listener inside the mobile detailed sheet (`#v83MobileDetailContent`) and desktop detailed pane. Double-clicking any Ayah card instantly copies its Quranic text to the clipboard formatted as `[Surah: Ayah] Text` using fallback-safe clipboard routines.
- **Visual Success Toast**: Displays a success toast notification immediately (e.g., "تم نسخ الآية: البقرة (5)") to confirm clipboard copy action.

### 14. 📱 Bottom-First Ergonomic Mobile Layout
- **Ergonomic Reorganization**: Moved the detailed sheet's tabs (`.v83-tabs`), sheet navigation buttons (Back, Prev, Next, Edit in `.v83-mobile-sheet-head`), and comparison mode selection buttons (`.v83-cmp-modes`) to the bottom of the viewport on mobile devices.
- **Thumb-Friendly Experience**: Reordered elements via flexbox order styling, ensuring active content scrolls independently at the top while all controls remain static and comfortable for one-handed thumb interaction at the bottom edge.

### 15. 🎨 Overlap-Free Arabic Highlights Tuning
- **Tall Arabic Metrics Care**: Increased the mobile line-height of the parent verse container (`.verse-text`) inside detailed views to `2.5` to give Arabic vowel markers (harakat) ample vertical spacing.
- **Snug Highlight Backgrounds**: Standardized highlight span line heights inside the detailed container to a tight `1.25` and applied `box-decoration-break: clone` to avoid tall clipping and prevent backgrounds from adjacent lines from overlapping the Quranic text strokes.

### 16. 🎴 Premium Choice-Card Details Tabs
- **Ergonomic Grid Upgrade**: Resized the details pane tab buttons (`.v83-tab-btn`) on both desktop and mobile viewports to look exactly like the main home screen choices cards (big, highly tactile, and extremely easy to press).
- **Same Size & Layout**: Arranged the 5 tabs in a beautifully balanced 2-column grid (`الآيات` & `الاختلافات` / `الملاحظات` & `التفسير` / `مرتبط` spanning full-width). Active tabs feature a gold-bordered emerald green gradient, dynamic shadows, and 3D hover/press physics.
- **Mobile Viewport Optimization**: On mobile devices, decreased horizontal container margins/paddings (`padding: 10px 8px 14px`) to expand tabs to the maximum screen width, and increased their minimum heights to a substantial **`64px`** with an ergonomic `16px` border-radius for effortless thumb pressing.

### 17. 🎛️ Premium Mobile Navigation Actions Grid
- **Arrangement & Styling**: Redesigned all action buttons inside the mobile detailed sheet header (`رجوع`, `السابق`, `التالي`, and `تعديل` when active) to match the exact size, tactile boundaries, and arrangement as the main home screen choices cards and details tabs.
- **Dynamic 2-Column Grid**: Laid out buttons in a beautiful 2-column grid using the new flat container `.v83-mobile-buttons-grid` inside the bottom control sheet.
- **Active Accents & Theme Support**: Previous and Next buttons display with a premium gold-bordered dark emerald green gradient, and the Modify (Edit) button displays in a high-end gold gradient. The Back (`رجوع`) button dynamically spans the full 2 columns when the Modify button is hidden (such as on automated databases).
- **Mobile Width & Height Expansion**: Reduced the grid's horizontal padding (`padding: 10px 8px 14px`) to stretch buttons edge-to-edge, and boosted their minimum heights to **`64px`** with an ergonomic `16px` border-radius to ensure maximum accessibility and thumb-reach convenience.
