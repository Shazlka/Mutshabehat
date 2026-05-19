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
