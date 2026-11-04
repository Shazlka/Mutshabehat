# Web parity — Qiraat UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the web reader at `/mushaf-1441` every Qiraat feature of the iOS app (colour key, reader picker, hub and filter chip, word-sheet navigation, page summary, search, usul index, compare, favourites/notes, per-باب switches, «المتون», sync status), reading the existing database through the existing routes.

**Architecture:** Pure logic is ported from the Swift in `apps/ios/MushafCore/Sources/MushafCore` (read-only reference) to TypeScript under `packages/qiraat-core/features/`, with ported tests. UI lives in `src/app/mushaf-1441/_features/<feature>/`, mounted through one `QiraatFeaturesHost` that the viewer renders once. Personal data (favourites, notes) goes to IndexedDB behind `personalStore`.

**Tech Stack:** Next.js 16 (read `node_modules/next/dist/docs/` before touching routing/caching), React 19, TypeScript, Tailwind v4, `tsx --test` (node:test), Playwright.

**Spec:** `docs/superpowers/specs/2026-11-04-web-ios-parity-design.md` (§5 is this plan's scope).

## Global Constraints

- Work only in `~/Projects/mutshabehat-web-parity` on branch `web/ios-parity`. Never edit `apps/ios`, never commit on `ios/main`, no DB migrations, no new tables. Do not push without the owner's yes.
- Routes are read-only data sources: `/api/mushaf-1441/qiraat`, `/api/mushaf-1441/qiraat-resolved`, `/api/mushaf-1441/mutshabehat`, `/api/public/v1/qiraat`, `/api/public/v1/mutoon`. Extending a route is code only.
- One reader layer answers a press; with Qiraat on, a marked word opens the word sheet (`PROJECT_MASTER.md` §13). No per-hover or per-selection state in `MushafPageSlot` props (keeps the ~1 ms page-turn invariant).
- Colours, reader and narrator names come from `packages/qiraat-core` (`colors.ts`, `readers.ts`, `narrators.ts`, `attribution.ts`). No second palette. Never show a bare «خلف» or «الدوري»; use the disambiguated names the data carries.
- Every colour-coded difference also has a non-colour cue. Controls are at least 24 px (44 px on touch). The reader is Arabic-only; layout is RTL; use `--mushaf-*` tokens and `mushafTheme.ts`.
- Changes to the viewer are limited to small hook points; new code goes in new files. All `localStorage`/IndexedDB access is wrapped in try/catch and the page works without it.
- Before each feature task, confirm its "web today" row in the spec against the running code. If the web already does it, write the TS test against the existing behaviour and skip the build.
- Every finished task adds a dated entry, newest first, to **both** `CHANGELOG.md` and the `# Changelog` section of `CLAUDE.md`. Commit with `GIT_AUTHOR_NAME=Shazlka GIT_AUTHOR_EMAIL=amr.eshazly@gmail.com` (and the committer vars); no model names in commit messages.
- Gate for every task: `npm run typecheck`, `npm run test:qiraat:features`, and `npm run test:qiraat` pass; `npm run build` passes at the end of Tasks 4, 9 and 15.

## Review Focus

1. A page with no Qiraat data (empty fixtures): summary, search and usul index show an empty state, never throw. Pinned in Tasks 8, 9, 10.
2. Loci with several ruling rows (93 in the database): rows with the same category and span aggregate into one place, keeping every row's authority details. Pinned in Task 9.
3. A filter or live update removes the word the sheet is showing: the sheet moves to the nearest marked word instead of closing on nothing. Pinned in Task 2.
4. Two narrators named «الدوري» (Q03-R01, Q07-R02) and reader «خلف» (Q10) vs narrator «خلف عن حمزة» (Q06-R01): never merged or shown bare. Pinned in Tasks 6 and 11.
5. IndexedDB unavailable (private window, blocked storage): favourites/notes show a "not saved on this device" notice and nothing else breaks. Pinned in Task 12.
6. A two-page spread: marked-word order follows Quran position, not the `[left, right]` page order. Pinned in Task 2.

## File Structure

- `packages/qiraat-core/features/wordOrder.ts`, `pageSummary.ts`, `search.ts`, `usulIndex.ts`, `compare.ts`, `readingForm.ts`, `classification.ts`, `preferences.ts`, `readerPicker.ts`, `legend.ts`, `mutoon.ts`, `syncStatus.ts`, `notes.ts`: pure ports, no React, no DOM.
- `src/lib/personal-store.ts`: IndexedDB wrapper (`personalStore`) with JSON export/import.
- `src/app/mushaf-1441/_features/host/QiraatFeaturesHost.tsx`: owns which sheet is open; single mount point.
- `src/app/mushaf-1441/_features/<word-sheet|hub|reader-picker|legend|page-summary|search|usul-index|compare|notes|mutoon|sync-status>/`: one folder per iOS view.
- `tests/qiraat/features/*.test.ts`: ported unit tests. `tests/quiz/e2e/qiraat-features.spec.ts`: Playwright flows (existing e2e folder; base URL from `HIFZ_E2E_URL`).

### Task 1: Preview prerequisites (no push)

**Files:** Modify `docs/superpowers/specs/2026-11-04-web-ios-parity-design.md` §6.

**Produces:** the spec's open item "preview environment" resolved or turned into a precise owner request.

- [ ] **Step 1:** With the Vercel MCP (`get_project`, project env var names only, never values), record for project `mutshabehat-v2` which env vars (Supabase URL/key, `AUTOLOGIN_EMAIL`, `AUTOLOGIN_PASSWORD`) exist for the Preview scope, and whether `src/proxy.ts` auto-login applies on `*.vercel.app` preview hosts.
- [ ] **Step 2:** Replace the open item in spec §6 with the findings. If Preview lacks a variable, write exactly which one the owner must add; do not add it yourself.
- [ ] **Step 3:** Commit `docs: preview prerequisites for web/ios-parity`.

### Task 2: Word order, marked-word predicate, feature host

**Files:**
- Create: `packages/qiraat-core/features/wordOrder.ts`, `src/app/mushaf-1441/_features/host/QiraatFeaturesHost.tsx`, `tests/qiraat/features/word-order.test.ts`
- Modify: `src/app/mushaf-1441/_components/qiraat/qiraatWordMarker.ts` (extract the viewer's inline "this word has a Qiraat mark" check as `isQiraatMarkedWord`), `src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx` (use it; render the host once), `package.json` (script `test:qiraat:features`: `tsx --test tests/qiraat/features/*.test.ts`)

**Interfaces — Produces:**
```ts
export interface OrderableWord { id: string; surah: number; ayah: number; tokenInAyah: number; page: number; line: number; indexInLine: number }
export function comesBefore(a: OrderableWord, b: OrderableWord): boolean   // tuple (surah, ayah, tokenInAyah, page, line, indexInLine)
export function markedWords<W extends OrderableWord>(pages: number[], words: W[], isMarked: (w: W) => boolean): W[]  // page-filtered, de-duplicated by id, sorted by comesBefore
export function nextMarked<W extends OrderableWord>(list: W[], current: W): W | null        // no wraparound
export function previousMarked<W extends OrderableWord>(list: W[], current: W): W | null
export function nearestMarked<W extends OrderableWord>(list: W[], current: W): W | null     // exact match, else first not-before current, else last
export function variantWajhNumbers(variants: QiraatVariant[]): Record<string, number>        // {} when only one distinct face
```
```ts
export function isQiraatMarkedWord(word: MushafWord, ctx: { variants: QiraatVariant[]; rulings: QiraatRuling[]; filter: QiraatComparisonFilter }): boolean
export function toOrderable(word: MushafWord): OrderableWord   // pageNumber→page, lineNumber→line, wordIndexInLine→indexInLine, wordIndexInAyah→tokenInAyah
```
`QiraatFeaturesHost` props: `{ page: number; pages: number[]; words: MushafWord[]; variantsByPage; rulingsByPage; filter: QiraatComparisonFilter; onSelectWord(w: MushafWord): void; onGoToPage(p: number): void }`; exposes `openFeature(name: FeatureName)` through a React context `useQiraatFeatures()`, where `FeatureName = 'legend'|'readerPicker'|'pageSummary'|'search'|'usulIndex'|'compare'|'mutoon'`.

- [ ] **Step 1: Write failing tests** in `word-order.test.ts` (port `QiraatWordOrderTests.swift`, 11 cases): order by Quran position ignoring line layout; spread `pages: [16, 17]` and `[17, 16]` give the same list (Review Focus 6); `markedWords` drops words from other pages and duplicate ids; `nextMarked` at the end is `null`; `previousMarked` at the start is `null`; `nearestMarked` for a removed word returns the next marked word in Quran order, and the last word when none follows (Review Focus 3); `variantWajhNumbers` returns `{}` for one face, numbers faces 1..n in appearance order for several, and gives two variants with the same text, note and readers the same number.
- [ ] **Step 2:** Run `npm run test:qiraat:features`; expected FAIL (module missing).
- [ ] **Step 3:** Implement `wordOrder.ts` from `QiraatWordOrder.swift` (copy the tuple comparison and the face-key idea: surah, ayah, token span, displayed text `uthmaniText ?? variantText`, `performanceNote ?? ''`, sorted unique `readingIds`).
- [ ] **Step 4:** Extract `isQiraatMarkedWord`/`toOrderable`; replace the viewer's inline check with them; add a regression test that `isQiraatMarkedWord` equals the old predicate on page 17 fixtures.
- [ ] **Step 5:** Add the empty host (renders nothing yet) and mount it once in the viewer; run the Gate.
- [ ] **Step 6:** Changelog (both files), commit `feat(qiraat-web): word order, marked-word predicate and feature host`.

### Task 3: Word sheet — next/previous and face numbers

**Files:** Create `src/app/mushaf-1441/_features/word-sheet/WordSheetNav.tsx`, `FaceBadge.tsx`; Modify `Mushaf1441Viewer.tsx` (`renderQiraatSelection`, `selectWordForQiraat`); Test: `tests/quiz/e2e/qiraat-features.spec.ts`.

**Interfaces — Consumes:** Task 2 (`markedWords`, `nextMarked`, `previousMarked`, `nearestMarked`, `variantWajhNumbers`). **Produces:** `WordSheetNav({ position: number; total: number; canPrev: boolean; canNext: boolean; onPrev(): void; onNext(): void })` and `FaceBadge({ number: number })` ("وجه N").

- [ ] **Step 1: Write the Playwright flow** `word sheet steps through marked words`: open page 17 with the Qiraat layer on, click a marked word, assert the card shows "k من n", click next, assert a different word is selected and its Quran position is later; assert previous at the first word is disabled; assert a word with two faces shows «وجه 1» and «وجه 2» and a one-face word shows none.
- [ ] **Step 2:** Run `HIFZ_E2E_URL=http://localhost:3222 npx playwright test qiraat-features -g "word sheet"`; expected FAIL.
- [ ] **Step 3:** Implement the two components and wire them in `renderQiraatSelection`. The marked-word list is derived with `useMemo` from the page words and passed through the host, not through `MushafPageSlot` props. When the filter changes and the selected word is no longer marked, call `nearestMarked`.
- [ ] **Step 4:** Run the flow; expected PASS. Run the page-turn check `python3 -m pytest -q tests/test_mushaf_page_performance.py` against `next start -p 3222`; expected pass.
- [ ] **Step 5:** Changelog, commit `feat(qiraat-web): word sheet navigation and face numbers`.

### Task 4: Reading forms, classification, per-reader performance

**Files:** Create `packages/qiraat-core/features/readingForm.ts`, `classification.ts`, `tests/qiraat/features/reading-form.test.ts`, `src/app/mushaf-1441/_features/word-sheet/ReadingFormLine.tsx`, `ClassificationChips.tsx`; Modify `renderQiraatSelection`.

**Interfaces — Produces:** `readingFormFor(ruling: QiraatRuling, attribution: QiraatRulingAttribution): string` ("the word as it is read"); `classificationChips(item: QiraatVariant | QiraatRuling): { label: string; kind: 'category' | 'sub' | 'difference' }[]` (sub-category from the database, never «أخرى»).

- [ ] **Step 1:** Read `QiraatReadingForm.swift` (185 lines), `QiraatClassification.swift` and `QiraatReadingFormTests.swift`; port each Swift test case as a TS test with the same inputs and expected strings. Include a case where the ruling spans two words and one where `subCategory` is absent (no chip).
- [ ] **Step 2:** Run the feature tests; expected FAIL.
- [ ] **Step 3:** Implement the two modules to the signatures above; extend `distinctRulingText`-style de-duplication only if the Swift tests require it.
- [ ] **Step 4:** Render both in the selection card (the card already groups per-reader performance by action; keep that grouping).
- [ ] **Step 5:** Gate plus `npm run build`; changelog; commit `feat(qiraat-web): reading forms and classification in the word sheet`.

### Task 5: Preferences — one switch per أصول باب, «فرش فقط»

**Files:** Create `packages/qiraat-core/features/preferences.ts`, `tests/qiraat/features/preferences.test.ts`, `src/app/mushaf-1441/_features/hub/UsulPrefsPanel.tsx`; Modify `Mushaf1441Viewer.tsx` (apply the enabled-category set where rulings are marked).

**Interfaces — Produces:**
```ts
export interface QiraatUsulPrefs { farshOnly: boolean; disabledCategories: string[] }
export const QIRAAT_USUL_PREFS_KEY = 'mushaf1441:qiraat-usul-prefs:v1'
export function loadUsulPrefs(storage: Pick<Storage,'getItem'>): QiraatUsulPrefs   // defaults on any failure
export function saveUsulPrefs(storage: Pick<Storage,'setItem'>, p: QiraatUsulPrefs): void  // swallows errors
export function isRulingVisible(r: QiraatRuling, p: QiraatUsulPrefs): boolean
```

- [ ] **Step 1: Write failing tests:** defaults when storage is empty or throws; `farshOnly` hides every ruling; a disabled category hides only its rulings; a round-trip save/load is identical; corrupt JSON gives defaults.
- [ ] **Step 2:** Run; expected FAIL. **Step 3:** Implement. **Step 4:** Build `UsulPrefsPanel` listing every category of `USUL_RULE_REGISTRY` with a switch and a colour dot plus a text label (non-colour cue); filter rulings with `isRulingVisible` before marking.
- [ ] **Step 5:** Gate; changelog; commit `feat(qiraat-web): per-باب switches and farsh-only`.

### Task 6: Hub, filter chip, reader picker

**Files:** Create `src/app/mushaf-1441/_features/hub/QiraatHub.tsx`, `FilterChip.tsx`, `src/app/mushaf-1441/_features/reader-picker/ReaderPicker.tsx`, `packages/qiraat-core/features/readerPicker.ts`, `tests/qiraat/features/reader-picker.test.ts`; Modify the top bar in `Mushaf1441Viewer.tsx` (one entry button when the Qiraat layer is on) and `QiraatToolbar.tsx` (reuse the picker).

**Interfaces — Produces:** `filterLabel(filter: QiraatComparisonFilter): string` (reader name, narrator disambiguated name, or "الكل"); `searchReaders(query: string): { readers: QiraatReader[]; narrators: QiraatNarrator[] }` (Arabic-normalised via `normalizeArabic` from `src/lib/arabic.ts`); `toggleCompare(selected: ReadingId[], id: ReadingId): ReadingId[]` (max 2, oldest dropped).

- [ ] **Step 1: Write failing tests** (port `QiraatReaderPickerTests`): `filterLabel` for Q10 returns "خلف العاشر", for `Q06-R01` returns the narrator's full name, for `Q03-R01` and `Q07-R02` returns two different names that both include the reader (Review Focus 4); `searchReaders('الدوري')` returns both narrators; `searchReaders('نافع')` returns Q01 and both its narrators; `toggleCompare` with three picks keeps the last two.
- [ ] **Step 2:** Run; expected FAIL. **Step 3:** Implement. **Step 4:** Build the full-screen picker (readers coloured by `readerColor`, narrators nested, search box, multi-select compare button disabled until two are chosen) and the hub menu (colour key, page summary, search, usul index, compare, «المتون», prefs) opening through `openFeature`. **Step 5:** Playwright flow `picker filters the page`: pick Warsh, assert only his marked words stay marked and the chip reads his name.
- [ ] **Step 6:** Gate; changelog; commit `feat(qiraat-web): Qiraat hub, filter chip and reader picker`.

### Task 7: Colour key

**Files:** Create `packages/qiraat-core/features/legend.ts`, `tests/qiraat/features/legend.test.ts`, `src/app/mushaf-1441/_features/legend/LegendSheet.tsx`.

**Interfaces — Produces:** `legendRows(variantsByPage: Record<number, QiraatVariant[]>, rulingsByPage: Record<number, QiraatRuling[]>): { readers: LegendRow[]; narrators: LegendRow[]; abwab: LegendRow[]; marks: LegendRow[] }` where `LegendRow = { key: string; label: string; color: string; sampleWord?: { text: string; page: number } }` — each row carries a real word of the Mushaf that only that authority/باب reads, when one exists.

- [ ] **Step 1: Write failing tests** (port `QiraatLegendTests`): every `READER_COLOR` appears once in `readers`; rows have no duplicated `key`; a reader with no data on the supplied pages has no `sampleWord`; the marks list contains the ذو وجهين dotted underline and the إمالة/تقليل dot.
- [ ] **Step 2:** Run; expected FAIL. **Step 3:** Implement. **Step 4:** Build the sheet with three tabs (القرّاء، الأبواب، العلامات), each row showing colour, label and sample word; opened from the hub. **Step 5:** Gate; changelog; commit `feat(qiraat-web): colour key`.

### Task 8: Page summary

**Files:** Create `packages/qiraat-core/features/pageSummary.ts`, `tests/qiraat/features/page-summary.test.ts`, `src/app/mushaf-1441/_features/page-summary/PageSummarySheet.tsx`.

**Interfaces — Produces:** `buildPageSummary(args: { page: number; words: OrderableWord[]; variants: QiraatVariant[]; rulings: QiraatRuling[]; filter: QiraatComparisonFilter }): PageSummaryItem[]` with `PageSummaryItem = { wordId: string; surah: number; ayah: number; token: number; variants: { variant: QiraatVariant; pills: AuthorityPill[] }[]; rulingGroups: { category: string; categoryAr: string; rulings: { ruling: QiraatRuling; actionGroups: { action: string; pills: AuthorityPill[] }[] }[] }[] }`, in Quran order.

- [ ] **Step 1: Write failing tests** (port `QiraatPageSummaryTests`, 13 cases): items sorted in Quran order; a word with a variant and a ruling yields one item with both; rulings group by category; pills use `rollupAuthorityPills` (both narrators of a reader collapse to the reader); an empty page returns `[]` (Review Focus 1); a filter that matches nothing returns `[]`.
- [ ] **Step 2:** Run; expected FAIL. **Step 3:** Implement. **Step 4:** Build the sheet: list of items; tapping one closes the sheet, selects the word in the reader (`onSelectWord`). Empty state text «لا توجد قراءات على هذه الصفحة». **Step 5:** Gate; changelog; commit `feat(qiraat-web): page summary`.

### Task 9: Usul index

**Files:** Create `packages/qiraat-core/features/usulIndex.ts`, `tests/qiraat/features/usul-index.test.ts`, `src/app/mushaf-1441/_features/usul-index/UsulIndexSheet.tsx`; Modify `src/app/api/mushaf-1441/qiraat/` only if all 604 pages cannot be read from `defaultQiraatRepository` in one request (then add `?index=usul` returning categories and places, no schema change).

**Interfaces — Produces:** `buildUsulIndex(rulingsByPage: Record<number, QiraatRuling[]>): UsulCategory[]` with `UsulCategory = { code: string; categoryAr: string; color: string; count: number; places: UsulPlace[] }` and `UsulPlace = { id: string; page: number; surah: number; ayah: number; startToken: number; endAyah: number; endToken: number; baseText: string; rulings: QiraatRuling[] }`; categories ordered by `USUL_RULE_REGISTRY`, places by Quran position.

- [ ] **Step 1: Write failing tests** (port `UsulIndexTests`, 8 cases): rulings with the same category and span aggregate into one place and keep all `attribution` rows (Review Focus 2: build a fixture of 3 rows at one span, expect 1 place with 3 rulings); a ruling with empty `baseText` still appears; a ruling filed on the wrong page keeps the page it carries; `count` equals the number of places; empty input gives `[]`.
- [ ] **Step 2:** Run; expected FAIL. **Step 3:** Implement. **Step 4:** Build the sheet (category list, then places; tapping a place closes the sheet and calls `onGoToPage` and selects the word); load the 604 pages lazily on first open with a progress line, cache in memory. **Step 5:** Gate plus `npm run build`; changelog; commit `feat(qiraat-web): usul index`.

### Task 10: Qiraat search

**Files:** Create `packages/qiraat-core/features/search.ts`, `tests/qiraat/features/search.test.ts`, `src/app/mushaf-1441/_features/search/QiraatSearchSheet.tsx`.

**Interfaces — Produces:**
```ts
export type QiraatSearchQuery = { kind: 'authority'; authorityId: string } | { kind: 'word'; text: string } | { kind: 'category'; code: string }
export interface QiraatSearchResult { page: number; surah: number; ayah: number; token: number; displayText: string; kinds: ('variant'|'ruling')[]; recordCount: number }
export function buildSearchIndex(variantsByPage: Record<number, QiraatVariant[]>, rulingsByPage: Record<number, QiraatRuling[]>, wordText: (surah: number, ayah: number, token: number) => string): { search(q: QiraatSearchQuery): QiraatSearchResult[]; categories: { code: string; nameAr: string; rulingCount: number }[]; missingPages: number[] }
export function groupResults(results: QiraatSearchResult[]): { surah: number; pages: { page: number; results: QiraatSearchResult[] }[] }[]
```

- [ ] **Step 1: Write failing tests** (port `QiraatSearchTests`, 12 cases): authority search for a reader includes its narrators' records; a word query ignores diacritics and alef wasla (`normalizeArabic`); a category query returns only that باب; results sort by surah, ayah, token; `groupResults` groups by surah then page; a query on an empty index returns `[]` (Review Focus 1).
- [ ] **Step 2:** Run; expected FAIL. **Step 3:** Implement (index built once, reuses the 604-page cache from Task 9). **Step 4:** Build the sheet with a segmented control (قارئ، كلمة، باب), grouped results, tap to go to the word. **Step 5:** Gate; changelog; commit `feat(qiraat-web): Qiraat search`.

### Task 11: Compare

**Files:** Create `packages/qiraat-core/features/compare.ts`, `tests/qiraat/features/compare.test.ts`, `src/app/mushaf-1441/_features/compare/CompareSheet.tsx`.

**Interfaces — Produces:** `compareAt(args: { locus: { surah: number; ayah: number; startToken: number; endAyah: number; endToken: number }; variants: QiraatVariant[]; rulings: QiraatRuling[]; authorityIds: [string, string] }): { voices: ComparedVoice[] }` where `ComparedVoice = { authorityId: string; name: string; color: string; kind: 'reader'|'narrator'; narratorIds: string[]; content: { wajhs: { text: string; note?: string; source: 'variant'|'baseline'|'ruling' }[]; usul: { groupId: string; sourceRulingIds: string[]; categoryAr: string; color: string; status: 'recorded'|'baseline'|'notRecorded' }[] } }`.

- [ ] **Step 1: Write failing tests** (port `QiraatCompareTests`, 19 cases; the Swift file is the authority for `status` rules): a reader and a narrator of another reader compare; two voices with identical content are both returned; a voice with no record at the locus has `status: 'notRecorded'`, never an empty list; two «الدوري» narrators get different names (Review Focus 4); rulings with several rows at one locus appear as one `usul` entry with all `sourceRulingIds`.
- [ ] **Step 2:** Run; expected FAIL. **Step 3:** Implement to the Swift behaviour. **Step 4:** Build the sheet (two columns, colour plus text status) and open it from the word sheet with the two picks of Task 6. **Step 5:** Gate; changelog; commit `feat(qiraat-web): compare two readers at a word`.

### Task 12: Personal store, favourites and notes

**Files:** Create `src/lib/personal-store.ts`, `packages/qiraat-core/features/notes.ts`, `tests/qiraat/features/notes.test.ts`, `src/app/mushaf-1441/_features/notes/NoteButton.tsx`, `FavouriteButton.tsx`, `NotesPanel.tsx`.

**Interfaces — Produces:**
```ts
// personal-store.ts
export interface PersonalStore { get<T>(store: string, key: string): Promise<T | undefined>; put<T>(store: string, key: string, value: T): Promise<void>; delete(store: string, key: string): Promise<void>; all<T>(store: string): Promise<T[]>; available: boolean }
export function openPersonalStore(factory?: IDBFactory | null): Promise<PersonalStore>   // available=false, no throw, when IndexedDB is missing or blocked
export function exportPersonalData(store: PersonalStore): Promise<string>                // JSON, versioned
export function importPersonalData(store: PersonalStore, json: string): Promise<{ imported: number }>
// notes.ts
export interface QiraatWordNote { id: string; surah: number; ayah: number; token: number; text: string; favourite: boolean; updatedAt: string }
export function noteId(surah: number, ayah: number, token: number): string   // `${surah}:${ayah}:${token}`
export function mergeNotes(local: QiraatWordNote[], incoming: QiraatWordNote[]): QiraatWordNote[]  // newest updatedAt wins per id
```

- [ ] **Step 1: Write failing tests** (port `QiraatNotesTests`, 14 cases, using `fake-indexeddb` as a dev dependency): put/get/delete round-trip; `openPersonalStore(null)` returns `available: false` and `put` resolves without throwing (Review Focus 5); export then import into an empty store restores every note; `mergeNotes` keeps the newer text; importing malformed JSON rejects with a message and changes nothing.
- [ ] **Step 2:** Run; expected FAIL. **Step 3:** Implement. **Step 4:** Add the buttons to the word sheet; when `available` is false show «غير محفوظ على هذا الجهاز» and keep the note in memory. Add export/import buttons in the hub. **Step 5:** Gate; changelog; commit `feat(qiraat-web): personal store, Qiraat favourites and notes`.

### Task 13: «المتون»

**Files:** Create `src/app/mushaf-1441/_features/mutoon/MutoonSheet.tsx`, `packages/qiraat-core/features/mutoon.ts`, `tests/qiraat/features/mutoon.test.ts`.

- [ ] **Step 1:** Read `src/app/api/public/v1/mutoon/route.ts` and `MutoonView.swift` (without the local references data); write in the test file the TS type for the route's response and a test that `groupMutoonByMatn(response)` groups verses per متن (الشاطبية، الدرة، طيبة النشر) in verse order and handles an empty response.
- [ ] **Step 2:** Run; expected FAIL. **Step 3:** Implement `groupMutoonByMatn(response: MutoonResponse): { matn: string; verses: MutoonVerse[] }[]` and the sheet (search box that keeps focus, RTL list). Authority symbols shown only if the route returns them. **Step 4:** Gate; changelog; commit `feat(qiraat-web): المتون page`.

### Task 14: Sync status and report link

**Files:** Create `packages/qiraat-core/features/syncStatus.ts`, `tests/qiraat/features/sync-status.test.ts`, `src/app/mushaf-1441/_features/sync-status/SyncStatusChip.tsx`.

**Interfaces — Produces:** `syncStatus(input: { lastFetchedAt: number | null; now: number; failed: boolean }): { state: 'live'|'stale'|'error'|'unknown'; label: string }`; `reportLink(word: { surah: number; ayah: number; token: number; page: number }): string` (a link to the existing site feedback destination chosen in Step 1).

- [ ] **Step 1:** Read `QiraatSyncStatus*.swift` and its 17 tests; record the thresholds in the TS tests; ask the owner for the report destination if the site has none and stop that part until answered.
- [ ] **Step 2–4:** Failing tests, implement, chip in the hub header; gate; changelog; commit `feat(qiraat-web): sync status chip and report link`.

### Task 15: Whole-branch verification

- [ ] **Step 1:** Run `npm run typecheck`, `npm run test:qiraat`, `npm run test:qiraat:features`, `npm run test:qiraat:review`, `npm run mushaf:validate`, `npm run build` (with `env -u __NEXT_PROCESSED_ENV`); all pass.
- [ ] **Step 2:** Run `npx playwright test qiraat-features` against `next start -p 3222` for desktop, tablet and iphone projects; all pass; run `tests/test_mushaf_page_performance.py`; passes.
- [ ] **Step 3:** Confirm the spec's feature table row by row; write the result (done / not applicable / deferred, with reasons) as a new section at the end of the spec.
- [ ] **Step 4:** Commit `docs: Qiraat UX parity verification`. Ask the owner before the first push and before any merge to `main`.
