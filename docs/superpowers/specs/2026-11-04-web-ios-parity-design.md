# Web parity with the Qiraat iOS app — program design

Date: 2026-11-04. Status: draft for owner review. Branch: `web/ios-parity` (worktree `~/Projects/mutshabehat-web-parity`, cut from `origin/main` at `5dd65a3e`).

## 1. Goal

Make every feature of the Qiraat iOS app (`apps/ios` on `ios/main`) available in the web reader at
`/mushaf-1441?page=N`, reading the same self-hosted Supabase database through the web's existing API routes.

## 2. Constraints (owner, 2026-11-04)

- **Do not touch iOS files.** Nothing under `apps/ios`, and no commits on `ios/main`. iOS is read-only reference.
- **Do not touch the database.** No migrations, no new tables, no writes beyond what the web already does today
  (review editor, annotations).
- **Isolated until approved.** Work happens on `web/ios-parity` and is shown on a Vercel preview. It reaches
  `main` (and so the production link `https://mutshabehat-v2.vercel.app/mushaf-1441?page=17`) only after the
  owner approves the preview. Pushing the branch needs the owner's permission each time.
- **Personal data lives in the browser.** Memorization, reading/khatma statistics, bookmarks, Qiraat favourites and
  notes are stored per device in IndexedDB, with JSON export/import. Not shared between devices.
- Web rules still apply: `CLAUDE.md` / `AGENTS.md` (Next.js 16 has breaking changes — read
  `node_modules/next/dist/docs/` first), the mandatory dated changelog in **both** `CHANGELOG.md` and the
  `# Changelog` section of `CLAUDE.md`, and the reader-layer rule (one layer answers a press,
  `PROJECT_MASTER.md` §13). The ~1 ms page-turn invariant must hold: no new per-hover or per-selection state in
  `MushafPageSlot` props.

## 3. Architecture

Each iOS feature becomes its own web module; `Mushaf1441Viewer.tsx` (5,146 lines) only receives small hook points.

- **Pure logic** (no React): `packages/qiraat-core/` (existing) or a sibling folder, ported from the Swift in
  `apps/ios/MushafCore/Sources/MushafCore/*.swift`, each with tests ported from the matching Swift tests
  (Node test runner, as `npm run test:qiraat*` already does).
- **UI**: `src/app/mushaf-1441/_features/<feature>/` using the existing RTL layout, `mushafTheme.ts` and
  `--mushaf-*` tokens. One component per iOS view, mounted from the viewer through a single registry entry.
- **Data**: read-only through `/api/mushaf-1441/qiraat`, `/api/mushaf-1441/qiraat-resolved`,
  `/api/mushaf-1441/mutshabehat`, `/api/public/v1/qiraat`, `/api/public/v1/mutoon`. If a feature needs a shape those
  routes do not give, extend the route (code only) — never the schema.
- **Personal store**: one `personalStore` module over IndexedDB (versioned schema, every access try/caught, page
  renders without it), plus JSON export/import. Optional later: read the iOS backup JSON format.

Rejected: writing features straight into the viewer (file keeps growing, breaks layer isolation); a second reader
route (the owner wants the same link).

## 4. Decomposition and order

Three sub-projects, each with its own spec → plan → build → review cycle:

1. **Qiraat UX** (detailed in §5).
2. **Reader**: five appearances (web has three), five surah banners, bookmarks, index sheet, settings, advanced
   search engine (boolean, fields, ranges, root/lemma, wildcards; needs the morphology lexicon).
3. **Personal progress**: memorization, reading time and khatma statistics, backup/restore.

Mutashabihat groups and the review editor already exist on the web; they get a gap audit only.

## 5. Sub-project 1 — Qiraat UX

Source of truth: `apps/ios/docs/qiraat-ux-acceptance.md` and the Qiraat sections of `apps/ios/CHANGELOG.md`.
The "web today" column is preliminary (file inventory and grep of `Mushaf1441Viewer.tsx`); the implementation plan
starts by confirming each row against the running code.

| Feature | iOS source (logic → view) | Web today | Web target |
|---|---|---|---|
| Colour key «مفتاح الألوان» (readers, narrators, أبواب, marks, each row with a real word) | `QiraatPresentation`, `QiraatMarks` → `QiraatLegendSheet` | legend removed 2026-09-29; reference sheet exists | `_features/legend` |
| Reader/narrator picker (full screen, search, multi-select compare) | `QiraatReaderPicker` | `QiraatToolbar` dropdown lists | `_features/reader-picker` |
| Top-bar Qiraat menu + filter chip | `QiraatHub`, `QiraatControls` | toolbar in sidebar | `_features/hub` |
| Page summary | `QiraatPageSummary` → `QiraatPageSummaryView` | none | `_features/page-summary` |
| Qiraat search (reader/narrator, word, باب) | `QiraatSearch` → `QiraatSearchView` | none | `_features/search` |
| Usul index (أبواب and places across 604 pages) | `UsulIndex` → `UsulIndexView` | none | `_features/usul-index` |
| Compare two readers/narrators at a word | `QiraatCompare` → `QiraatCompareView` | none | `_features/compare` |
| Word sheet: next/previous marked word, face numbers | `QiraatWordOrder`, `QiraatSheetNavigator` | selection card, no navigation | `_features/word-sheet` |
| Per-reader performance details, classification, reading forms | `QiraatReadingForm`, `QiraatGroupPerformance`, `QiraatClassification` | partly (attribution grouping) | `_features/word-sheet` |
| Favourites and personal notes per Qiraat word | `QiraatNotesStore` | ayah-level annotations only | `_features/notes` (IndexedDB) |
| One switch per أصول باب; "فرش only" | `QiraatPreferences` | category chips removed 2026-09-29 | `_features/preferences` |
| «المتون» page | `MutoonView` | API only (`/api/public/v1/mutoon`) | `_features/mutoon` |
| Live sync status + «بلّغ عن خطأ» link | `QiraatSyncStatusView`, `QiraatLiveSync` | web reads live; no status UI | small status chip + report link |
| Resolved-page index | `QiraatResolvedPageIndex` | `qiraat-resolved` route | reuse |

### Known limits found while scoping

- **Scholarly references (الشاطبية، الدرة، طيبة النشر per variant)** read the owner's local, git-ignored
  `references.json`. That data is not in the database, so it cannot appear on the web without either a database
  change (forbidden) or committing the data (the repo is public; owner decision needed). **Out of scope** unless the
  owner decides otherwise.
- **English interface strings** (`Localizable.xcstrings`, all `needs_review`): the web reader is Arabic-only. Out of
  scope; the Qiraat features ship Arabic first.
- **Developer review editor**: already on the web (iOS copied it). Not ported.
- **Data defects** listed in `qiraat-ux-acceptance.md` (5 misfiled rulings, 2 empty `baseText`, 93 loci with several
  rows) are database issues; the port must aggregate like iOS does (rows with the same category and span become one
  place) and must not "fix" the data.
- Never write a bare «خلف» or «الدوري»: use the disambiguated names the data carries.

### Behaviour that must match iOS

- A press is answered only by the active layer; with Qiraat on, a marked word opens the word sheet.
- Colours, reader and narrator names come from `packages/qiraat-core`; do not introduce a second palette.
- Non-colour cues for every colour-coded difference (accessibility; iOS audit M4).
- Controls at least 24 px (web rule from the 2026-09-30 audit), 44 px on touch.

### Verification

- Ported unit tests: every iOS core suite listed in the acceptance report has a TypeScript counterpart
  (compare 19, page summary 13, word order 11, search 12, usul index 8, notes 14, sync status 17).
- `npm run typecheck`, `npm run test:qiraat`, `npm run test:qiraat:review`, `npm run mushaf:validate`, `npm run build`.
- Playwright on the local build, then on the Vercel preview, at 1440×950, iPad landscape and iPhone widths.
- Page-turn performance check (`tests/test_mushaf_page_performance.py`) still passes.
- Changelog entry per feature in both files.

### Build order inside sub-project 1

1. Shared base: feature registry, `personalStore`, word-order and presentation ports.
2. Word sheet (navigation, face numbers, performance details).
3. Hub, reader picker, filter chip, colour key.
4. Page summary, search, usul index.
5. Compare.
6. Notes/favourites, preferences, «المتون», sync status.

## 6. Risks and open items

- **Preview environment (checked 2026-11-04 with `vercel env ls`, names and scopes only):**
  - `AUTOLOGIN_EMAIL`, `AUTOLOGIN_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY` exist for **Production only**. A preview
    deployment therefore does not auto-sign-in (`src/proxy.ts` needs both), so routes that need the session
    (annotations, review, notes sync) answer 401 on a preview.
  - `NEXT_PUBLIC_SUPABASE_URL` exists for Preview (secret, same age as Production's, so most likely the same URL).
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` for Preview is a `sb_publishable_…` value created 155 days ago, whereas
    Production's was created 65 days ago. It probably belongs to the retired Supabase Cloud project, so a preview
    cannot reach the self-hosted database as built.
  - Owner action before a preview is useful (I will not add these myself): set the Preview scope of
    `NEXT_PUBLIC_SUPABASE_ANON_KEY` to Production's value, and decide whether to add `AUTOLOGIN_EMAIL` /
    `AUTOLOGIN_PASSWORD` to Preview (this signs anyone who can open the preview URL in as the owner; Vercel's
    deployment protection is the only gate). Whether the Qiraat reading pages still work on a preview without a
    session is not verified: `/api/public/v1/*` needs no session, and the reader falls back to the bundled fixtures,
    but `/api/mushaf-1441/qiraat` has not been tested on a preview.
- **Push permission:** each push of `web/ios-parity` needs the owner's explicit yes.
- **iOS keeps moving:** features added to `ios/main` after today are not in this scope unless the owner adds them.
- **Size:** sub-project 1 alone is on the order of 2,500 lines of ported core logic plus about 6,000 lines of views
  in Swift. It is built and reviewed in the six steps above, not in one change.

## 7. Verification result — sub-project 1 (Qiraat UX), 2026-11-04

Run on branch `web/ios-parity` (not pushed): `npm run typecheck`, `test:qiraat` 51/51, `test:qiraat:features` 112/112 (new),
`test:qiraat:review` 207/207, `test:mutoon` 28/28, `test:proxy` 15/15, `mushaf:validate`, `next build`; Playwright
`qiraat-features` 18/18 on each of desktop (1440×950), tablet (1024×768 landscape) and iPhone 13, against a local production
build whose backend is unreachable (so Qiraat data came from the bundled data and the live-data paths were exercised through
mocked routes). **Not run:** `tests/test_mushaf_page_performance.py` (Python Playwright is not installed here), a real
Vercel preview, VoiceOver/screen-reader checks, and real-device touch checks. No push, no migration, no `apps/ios` change.

| Feature | Result | Where |
|---|---|---|
| Colour key | done | hub «المزيد» → «مفتاح الألوان» |
| Reader/narrator picker | done (the older toolbar list stays and shares its state) | filter chip |
| Top-bar menu + filter chip | done as a row in the sidebar (desktop, iPad landscape) and in the burger menu (phones, portrait tablets), not in the top bar | `QiraatHubBar` |
| Page summary | done | hub |
| Qiraat search | done | hub |
| Usul index | done | hub |
| Compare two readers | done, opened from the word sheet (needs an open word) | word sheet |
| Word-sheet next/previous, face numbers | done | word sheet |
| Reading forms, classification | done; per-reader performance details already existed on the web | word sheet |
| Favourites and notes | done, per device (IndexedDB) with JSON export/import | word sheet, hub |
| Per-باب switches, «فرش فقط» | done | sidebar / menu panel |
| «المتون» | partial: books, chapters, verses and search; the red reader symbols and شرح cards are not rendered | hub |
| Sync status, report link | done; report is a share/copy text, as in iOS | hub row, word sheet |
| Resolved-page index | not needed on the web | — |

Found and fixed during verification: on phones the bottom word card closed on any tap, so its new controls (next/previous,
favourite, note, compare, report) could not be used; controls inside the card no longer close it.

Known limits: scholarly references stay out of scope (§5); the English interface is out of scope; the usul index, search
and colour key read all 604 pages once per visit from the public API (progress shown), which on a cold CDN can take a while.
