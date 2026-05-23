# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Serve the app locally (used by tests)
npx serve V82B -p 5173

# Unit tests (Vitest)
npm run test:unit
npm run test:unit:watch   # watch mode

# E2E tests (Playwright) — requires serve running
npm run test:e2e
npm run test:e2e:ui       # visual test runner
npm run test:e2e:headed   # headed Chrome

# Run a specific tagged subset
npm run test:database     # @database tagged tests
npm run test:filter       # @filter tagged tests
npm run test:actions      # @actions tagged tests

# View last report
npm run test:report
```

## Architecture

This is a **vanilla JS/HTML/CSS single-page app** — no build step, no framework. The active development version is `V82B/` (tests point to it). `V82C/` is an older version kept for reference.

### Script load order (index.html)

Scripts are loaded in dependency order. Later files override earlier ones by redefining the same function name — this is intentional. The last definition wins:

1. `quran-reference.js` — raw Quran text data (`getSurahAyahs`, `getAyah`, `SURAH_NAMES`)
2. `personal-data.js` — user's curated group data (`PERSONAL_DATA`)
3. `automated-manifest.js` — manifest for lazy-loaded surah chunks (`AUTOMATED_MANIFEST`)
4. `js/state.js` — global mutable variables (`personalData`, `automatedData`, `activeDb`, `draftVerses`, etc.)
5. `js/utils.js` — `safeText`, `escapeHtml`, `normalize`, `clone`, `highlight`
6. `js/quran-utils.js` — Arabic search engine: normalization, fuzzy scoring, `smartArabicSearchScore`, `smartArabicSearchMatch`
7. `js/data-loader.js` — `loadDb`, `saveDb`, lazy surah chunk loader (`loadAutomatedSurahNo`)
8. `js/icons-toast.js` — toast notifications, icon SVGs
9. `js/modals.js` — modal open/close
10. `js/filters.js` — `passFilters`, surah filter UI, display mode, `filterBySurahNo`
11. `js/render-groups.js` — `renderActiveGroups`, group card HTML
12. `js/group-actions.js` — copy/delete/favorite/complete on groups
13. `js/add-edit.js` — add and edit group modals
14. `js/quran-search.js` — search within add/edit modals: `runQuranSearch`, `highlightQuranText`
15. `js/navigation.js` — `init`, `openHome`, `openDatabase` (last definition wins)
16. `js/dashboard-search-merge.js` — global search UI, merge window
17. `js/github-sync.js` — GitHub sync feature
18. `js/settings.js` — settings modal, theme, font
19. `js/export-tools.js` — JSON/CSV export
20. `js/boot-check.js` — startup integrity check

### Data flow

- **Personal DB**: loaded from `localStorage` on boot (falls back to `PERSONAL_DATA` from `personal-data.js`). Written back to `localStorage` on save.
- **Automated DB**: lazy-loaded per surah. `AUTOMATED_MANIFEST` lists all 114 surah files. When a surah filter is selected, `loadAutomatedSurahNo(no)` fetches `automated-surahs/surah-NNN.js` and appends its data to `automatedData`.
- **State**: all live state is plain `let` globals in `js/state.js` — no reactive framework.

### Group data structure

```js
{
  id: "123",
  title: "...",
  note: "...",
  favorite: true,
  completed: false,
  surahs: ["البقرة", "آل عمران"],
  verses: [
    {
      surah: "البقرة", ayahNo: 5, label: "",
      parts: [{ type: "shared"|"diff"|"diff2"|"diff3"|"addition"|"unique", text: "..." }]
    }
  ]
}
```

### Arabic search engine (`js/quran-utils.js`)

`smartArabicSearchScore(query, text)` returns 0–100. Score tiers:
- **100** — raw substring exact match
- **90** — normalized match (tashkeel stripped, alef variants unified)
- **85** — root matches a root from `PERSONAL_DATA` highlighted parts
- **80** — prefix/variant match (`ف و ب ك ل ال` attachments), requires exact variant or text-contains-variant with variant ≥ 4 chars
- **70** — root containment: `tS.includes(stripped)`, both roots ≥ 4 chars, one direction only
- **55–70** — Levenshtein fuzzy, nWord must be ≥ 5 chars

Multi-word queries use `Math.min(...wordScores)` — every query word must match.

`smartArabicSearchMatch(query, text, threshold=50)` wraps score with try/catch fallback.

### Cache busting

All `<script>` and `<link>` tags in `index.html` use `?v=` suffixes. Always bump the version when editing a JS or CSS file so browsers reload.

## Critical constraints

**Never modify these data files:**
- `quran-reference.js`
- `personal-data.js`
- `automated-manifest.js`
- `automated-data.js`
- `automated-surahs/surah-*.js`

**Function redefinition pattern**: many functions are defined multiple times across files (accumulation of version patches). The last loaded definition is the live one. When fixing a bug, trace which file's definition is actually running — it is almost always in `js/navigation.js` or `js/filters.js` at the bottom.

## Deployment

Deployed to Azure Static Web Apps via `.github/workflows/azure-static-web-apps-wonderful-water-0cd46ec10.yml`. Push to `main` triggers deploy. The `V82B/` directory is served as the root.
