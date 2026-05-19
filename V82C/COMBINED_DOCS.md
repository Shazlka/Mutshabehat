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
