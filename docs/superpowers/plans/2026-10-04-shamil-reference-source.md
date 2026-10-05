# «الشامل» Reference Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add «الشامل» as a second reference source in the review editor, switchable with nquran, with reconciliation badges and an nquran-style ➕ add into the open face's draft.

**Architecture:** A Python build script turns الشامل JSON files into per-surah JSON under `_lib/reference/shamil/` plus an `index.json`. A pure TS module resolves/matches/suggests; a second pure module plans what ➕ does to the draft. The nquran block in `ReviewEditorPane.tsx` is extracted into a source-agnostic `ReferencePanel` fed by one shared `ReferenceGroup` shape. No DB migration; saving uses the existing RPCs.

**Tech Stack:** Next.js 16 (Turbopack) / React 19 / TypeScript, `tsx --test` (node:test), Python 3 (stdlib only).

**Spec:** `docs/superpowers/specs/2026-10-04-shamil-reference-source-design.md` (read it first; it holds the data shape and the category table).

All paths below are relative to the repo root; `R/` = `src/app/mushaf-1441/review/`.

## Global Constraints

- **No DB migration**; reference data is read-only and bundled. Nothing is written until the reviewer presses «حفظ».
- Source sample files (outside the repo): `/Users/amrelshazly/Downloads/الشامل JSON/Qiraat_Baqarah_p002-008.json` (a verified subset of the other) and `…/Qiraat_Baqarah_p002-013.json`. Expected merged result: surah 2, **220 entries / 738 records**, pages 2–13.
- Narrator ids ↔ Q-ids are exactly: `qalun Q01-R01, warsh Q01-R02, bazzi Q02-R01, qunbul Q02-R02, duri_abuamr Q03-R01, susi Q03-R02, hisham Q04-R01, ibn_dhakwan Q04-R02, shubah Q05-R01, hafs Q05-R02, khalaf_hamzah Q06-R01, khallad Q06-R02, abulharith Q07-R01, duri_kisai Q07-R02, ibn_wardan Q08-R01, ibn_jammaz Q08-R02, ruways Q09-R01, rawh Q09-R02, ishaq Q10-R01, idris Q10-R02`.
- Word matching = whole-token equality after `matchKey(s) = normalizeArabic(s).replace(/ء/g, '')`; never the file's own `normalized` field; never substring.
- `category_code` values only from the set in `R/_components/UsulRuleGrid.tsx` `FALLBACK_USUL_CATEGORIES`; an unmatched wajh gets `null`, never a guess.
- nquran behaviour must not change: `tests/qiraat/nquran-reference.test.ts` keeps passing untouched.
- Match surrounding style: Arabic UI copy, existing Tailwind/CSS-variable classes, comments only for non-obvious "why".
- Project rules: a CHANGELOG entry in **both** `CHANGELOG.md` and the `# Changelog` section of `CLAUDE.md`; run Next with `env -u __NEXT_PROCESSED_ENV`; lint error count must not exceed the current **55**.
- Commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Commit only when executing this plan (the owner approved the plan); do not push.

## Review Focus

Failure modes the spec implies but a happy-path test would miss (each is pinned by a named test below):

1. **Spelling mismatch** between الشامل's hamza forms (`ءَاخِرَة`) and the Mushaf's (`ـَٔاخِرَة`) — an entry silently never appears. → Task 3 coverage test: every one of the 220 entries matches ≥1 real Mushaf word.
2. **Surah with no الشامل data** (e.g. 3) or a failed chunk import — must show an empty state, not crash. → Task 3 `hasShamilReferenceForSurah`; Task 5 manual check.
3. **Short/common clicked word** (e.g. bare «مَا») must not pull unrelated entries. → Task 3 token-equality test.
4. **Entry offered in an ayah it does not list** (multi-ayah/multi-word entries like `p005_e10`). → Task 3 property test.
5. **Pressing ➕ twice, or ➕ from both sources, on the same narrator** — must not duplicate or break wajh-order/Hafs rules. → Task 4 idempotence + distinct-wajh tests.
6. A later file introducing an **unknown narrator id** must fail the import loudly. → Task 1 test.

---

### Task 1: Build script `build_shamil_reference.py`

**Files:**
- Create: `scripts/qiraat/build_shamil_reference.py`
- Create (generated, committed): `R/_lib/reference/shamil/surah-002.json`, `R/_lib/reference/shamil/index.json`
- Test: `tests/qiraat/shamil-build.test.ts`

**Interfaces:**
- Produces CLI: `python3 scripts/qiraat/build_shamil_reference.py [--out DIR] FILE [FILE …]` — default `--out` is `R/_lib/reference/shamil` (resolved relative to the script, as `build_nquran_reference.py` does). Exit 1 on a hard failure (message on stderr).
- Produces `surah-NNN.json` = array of **entries** sorted by `(page, entryId)`:
  `{ entryId: string, page: number, ayahs: number[], words: string[] /* word text only */, type: 'usul'|'farsh', category: string, scope: 'this_word'|'all_quran', sourceText: string, flags: string[], wajhs: { id: string, wajh: number, description: string, readingText: string|null, condition: 'both'|'wasl'|'waqf', conditionBasis: string, narrators: string[] /* الشامل ids */, type: 'usul'|'farsh', category: string }[] }` (wajhs sorted by `wajh`).
- Produces `index.json` = `{ "surahs": { "<n>": { "pages": [min, max], "entries": number, "records": number } } }`.

- [ ] **Step 1: Write the failing test** `tests/qiraat/shamil-build.test.ts` using `execFileSync('python3', [script, '--out', tmp, ...files])` against tiny inline fixture files written to a temp dir. Tests:
  - `merges overlapping files by id`: file A has entry e1 (1 record), file B has e1 (same) + e2 → output has 2 entries; index says `entries: 2`.
  - `later file wins on conflict and prints the id`: B changes e1's record description → output has B's text, stderr/stdout mentions `e1`.
  - `rejects an unknown narrator id` (exit code ≠ 0, message names the id), `rejects a record whose entry is missing`, `rejects an entry with no records`, `rejects a record with empty narrators`.
  - `is idempotent`: running twice into two dirs gives byte-identical files.
  - `committed surah-002.json has 220 entries / 738 wajhs and index lists pages [2,13]` (reads the committed output; will fail until Step 5).
  The inline fixture needs the source shape: top-level `entries` (`entry_id, page, surah, ayahs, words[{text,normalized}], type, category, scope, source_text, flags`) and `records` (`id, entry_id, wajh, description, reading_text, condition, condition_basis, narrators, type, category`).

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx --test tests/qiraat/shamil-build.test.ts`
Expected: FAIL (script missing).

- [ ] **Step 3: Implement the script** (stdlib only, style of `build_nquran_reference.py`): merge by `entry_id` / record `id` (later file wins, print conflicting ids when content differs), group entries by `surah`, validate per the spec §3.1 hard failures (the 20 known narrator ids are listed in Global Constraints), emit compact JSON (`ensure_ascii=False, separators=(',', ':')`) in the shape above, print a summary plus the warnings from spec §3.1 (source-category histogram, `condition_basis=default` count, multi-ayah entry count).

- [ ] **Step 4: Run the validation tests** — `npx tsx --test tests/qiraat/shamil-build.test.ts`. Expected: all pass except the committed-output test.

- [ ] **Step 5: Generate the real data**

Run: `python3 scripts/qiraat/build_shamil_reference.py "/Users/amrelshazly/Downloads/الشامل JSON/Qiraat_Baqarah_p002-008.json" "/Users/amrelshazly/Downloads/الشامل JSON/Qiraat_Baqarah_p002-013.json"`
Expected: summary `surah 2: 220 entries, 738 records`, exit 0; the two files exist under `R/_lib/reference/shamil/`. Re-run `npx tsx --test tests/qiraat/shamil-build.test.ts` → all pass.

- [ ] **Step 6: Commit** — `git add scripts/qiraat/build_shamil_reference.py R/_lib/reference/shamil tests/qiraat/shamil-build.test.ts` → `feat(review): build script and sample data for the الشامل reference`

---

### Task 2: Shared reference types and generalised reconciliation

**Files:**
- Create: `R/_lib/referenceGroup.ts`
- Modify: `R/_lib/nquranReference.ts` (decision function moved/aliased; add adapter)
- Test: `tests/qiraat/reference-group.test.ts`

**Interfaces:**
- Produces in `referenceGroup.ts`:
  ```ts
  export type ReferenceCondition = 'both' | 'wasl' | 'waqf'
  export interface ReferenceSuggestion { kind: 'farsh' | 'usul'; categoryCode: string | null }
  export interface ReferenceGroup {
    key: string                     // unique within its entry/difference
    readersLabel: string            // shown before the colon
    narratorIds: string[]           // Q-ids; empty ⇒ unresolved
    performanceText: string         // saved as the narrator «الأداء»
    readingText?: string | null
    condition?: ReferenceCondition
    conditionBasis?: string
    suggestion?: ReferenceSuggestion
    unresolvedLabels?: string[]
  }
  export type ReferenceDecisionStatus = 'matched' | 'recorded_unreviewed' | 'partial' | 'missing' | 'unresolved'
  export interface ReferenceDecision { status: ReferenceDecisionStatus; matchedRow: ReviewRow | null }
  export function proposeReferenceDecision(group: { narratorIds: readonly string[] }, existingRows: readonly ReviewRow[]): ReferenceDecision
  ```
  Body = today's `proposeNquranDecision` logic unchanged.
- In `nquranReference.ts`: `export const proposeNquranDecision = proposeReferenceDecision`, `export type NquranDecisionStatus = ReferenceDecisionStatus`, `export type NquranDecision = ReferenceDecision` (names kept so existing imports/tests compile), and
  `export function nquranGroupsForDifference(difference: NquranDifference): ReferenceGroup[]` — wraps `resolveDifferenceGroups` (`readersLabel = group.readers.join('، ')`, `performanceText = group.reading`, `key = String(index)`).

- [ ] **Step 1: Write the failing test** `tests/qiraat/reference-group.test.ts` (reuse the `row()` helper pattern from `nquran-reference.test.ts`): `proposeReferenceDecision` returns each of the five statuses for hand-built groups/rows (matched needs a `reviewed` row covering all ids; `recorded_unreviewed`; `partial`; `missing`; `unresolved` for empty `narratorIds`); `nquranGroupsForDifference` on the 2:2 «فيه هدى» difference from `reference/nquran/surah-002.json` gives 3 groups (ابن كثير = 2 ids, السوسي عن أبي عمرو = 1 id `Q03-R02`, باقي الرواة = the other 17) whose `narratorIds` sets are pairwise disjoint and together equal all 20 ids.
- [ ] **Step 2: Run** `npx tsx --test tests/qiraat/reference-group.test.ts` → FAIL (module missing).
- [ ] **Step 3: Implement** `referenceGroup.ts` and the `nquranReference.ts` changes above (move the function body, don't duplicate it).
- [ ] **Step 4: Run** `npx tsx --test tests/qiraat/reference-group.test.ts tests/qiraat/nquran-reference.test.ts` → all pass (nquran tests unmodified).
- [ ] **Step 5: Commit** — `refactor(review): shared ReferenceGroup shape and generalised reconciliation`

---

### Task 3: الشامل resolver — `shamilReference.ts`

**Files:**
- Create: `R/_lib/shamilReference.ts`
- Test: `tests/qiraat/shamil-reference.test.ts`

**Interfaces:**
- Consumes: `ReferenceGroup`, `ReferenceSuggestion`, `ReferenceCondition` from `referenceGroup.ts`; `normalizeArabic` from `@/lib/arabic`; `R/_lib/reference/shamil/index.json`.
- Produces:
  ```ts
  export interface ShamilWajh { id: string; wajh: number; description: string; readingText: string | null; condition: ReferenceCondition; conditionBasis: string; narrators: string[]; type: 'usul' | 'farsh'; category: string }
  export interface ShamilEntry { entryId: string; page: number; ayahs: number[]; words: string[]; type: 'usul' | 'farsh'; category: string; scope: 'this_word' | 'all_quran'; sourceText: string; flags: string[]; wajhs: ShamilWajh[] }
  export const SHAMIL_NARRATOR_TO_ID: Readonly<Record<string, string>>
  export function matchKey(text: string): string
  export function hasShamilReferenceForSurah(surah: number): boolean   // from index.json
  export function loadShamilReference(surah: number): Promise<ShamilEntry[]>   // lazy import, cached; [] when no data
  export function findShamilEntriesForWord(entries: readonly ShamilEntry[], ayah: number, wordText: string): ShamilEntry[]
  export function shamilPerformanceText(description: string, condition: ReferenceCondition): string
  export function suggestShamilCategory(w: Pick<ShamilWajh, 'type' | 'category' | 'description'>): ReferenceSuggestion
  export function shamilGroupsForEntry(entry: ShamilEntry): ReferenceGroup[]
  ```
  `shamilPerformanceText`: description unchanged when `condition==='both'` or it already contains «وقف»/«وصل» (after `normalizeArabic`); otherwise `${description} وقفًا` / `${description} وصلاً`.
  `suggestShamilCategory`: `kind = w.type`; code from the table in spec §3.2 (named categories direct; «النقل والسكت» / «إدغام صغير/كبير» by description keywords; the «الأصول/فرش» usul bucket by keyword rules on `description`, first match wins, otherwise `null`; farsh → `null`). Tune the bucket's keyword list against the 738 real records (starting points in the spec: «ميم»→`USUL_MIM_JAM`, «البدل»→`MADD_BADAL`, «المد المتصل»→`USUL_MADD`) — only add a rule you can pin with a test on a real record.
  `shamilGroupsForEntry`: one group per wajh, `key = wajh.id`, `readersLabel` = the narrators' Arabic names joined «، » **or** reader names when a whole reader's two narrators are all present (reuse `describeNarratorGroup`/`NarratorBadges` conventions only if trivial; otherwise the narrator ids resolved via `CANONICAL_READERS` names), `narratorIds` via `SHAMIL_NARRATOR_TO_ID`, `performanceText = shamilPerformanceText(...)`, plus `readingText`, `condition`, `conditionBasis`, `suggestion`.

- [ ] **Step 1: Write the failing tests** `tests/qiraat/shamil-reference.test.ts` (read `R/_lib/reference/shamil/surah-002.json` with `readFileSync`; read real Mushaf word text from `packages/quran-data/mushaf1441/fixtures/page-words/page-NNN.json` — `lines[].words[]` with `charTypeName==='word'`, `surahNumber`, `ayahNumber`, `textUthmani`):
  - `narrator table covers exactly the 20 ids` and equals the Global Constraints mapping; every narrator id used anywhere in surah-002.json is a key.
  - `hasShamilReferenceForSurah`: true for 2, false for 1, 3, 0, 115.
  - `every entry matches at least one real Mushaf word in at least one of its ayahs` (all 220; collect surah-2 words from every page-words fixture) — Review Focus 1.
  - `2:9 «يَخْدَعُونَ» finds p003_e08 whose groups have 6 and 14 narrator ids`.
  - `2:4 the Mushaf word «وَبِٱلْـَٔاخِرَةِ» finds p002_e07; its first group is Q07-R01+Q07-R02, condition 'waqf', performanceText 'إمالة هاء التأنيث وقفًا', suggestion {kind:'usul', categoryCode:'IMALAH_TAQLIL'}` (take the word text from the fixture, don't retype it).
  - `a bare short word «مَا» does not match an entry whose tokens are only «وما»/«يخدعون»` (Review Focus 3).
  - `an entry is never returned for an ayah it does not list` — for every entry, with an ayah not in `ayahs` and each of the entry's own words → `[]` (Review Focus 4).
  - `shamilPerformanceText`: both→unchanged; waqf adds « وقفًا»; wasl adds « وصلاً»; description already containing «وقفًا» unchanged.
  - `suggestShamilCategory` pinned on named real records: one per row of the spec §3.2 table (use `entryId` + `wajh` lookups; include the SAKT/NAQL/TAHQIQ keyword cases and the mixed-bucket farsh → `null`); then a summary test that counts mapped vs unmapped usul wajhs across all 738, `console.log`s the numbers, and asserts every returned code is in `FALLBACK_USUL_CATEGORIES` or `null`.
- [ ] **Step 2: Run** `npx tsx --test tests/qiraat/shamil-reference.test.ts` → FAIL.
- [ ] **Step 3: Implement** `shamilReference.ts` per the interfaces. Chunk loading mirrors `loadNquranReference` (`import(\`./reference/shamil/surah-${file}.json\`)`, per-surah promise cache); `hasShamilReferenceForSurah` reads the statically imported `index.json`, so a missing file is never imported.
- [ ] **Step 4: Run** `npx tsx --test tests/qiraat/shamil-reference.test.ts` → pass; note the mapped/unmapped numbers from the log for the changelog.
- [ ] **Step 5: Commit** — `feat(review): الشامل resolver — matching, narrator ids, category suggestions`

---

### Task 4: Apply planner — `referenceApply.ts`

**Files:**
- Create: `R/_lib/referenceApply.ts`
- Test: `tests/qiraat/reference-apply.test.ts`

**Interfaces:**
- Consumes: `ReferenceGroup`, `ReferenceSuggestion` (Task 2); `NarratorInput` (`R/_lib/types.ts`); `nextWajhOrder` (`R/_components/ImalahDetailFields.tsx`); `HAFS_ID` (`R/_components/ReaderNarratorSelector.tsx`).
- Produces:
  ```ts
  export type ReferenceSourceId = 'nquran' | 'shamil'
  export interface ApplyContext {
    narrators: NarratorInput[]
    readingText: string
    kind: 'farsh' | 'usul'
    categoryCode: string | null
    isFreshDraft: boolean   // add-mode draft with no narrators yet
    otherFarshNarrators: { id: string; wajhOrder: number }[]   // other active farsh rows at this word
  }
  export interface ApplyPlan {
    narrators: NarratorInput[]
    readingText?: string
    kind?: 'farsh' | 'usul'
    appliesWasl?: boolean
    appliesWaqf?: boolean
    categoryCode?: string
    pendingSuggestion: ReferenceSuggestion | null   // shown as a click-to-apply chip when not auto-applied
  }
  export function planApplyReferenceGroup(source: ReferenceSourceId, group: ReferenceGroup, ctx: ApplyContext): ApplyPlan
  ```
  Rules (spec §3.4): append each narrator id with `action = group.performanceText || null`, `wajhOrder = nextWajhOrder([...otherFarshNarrators, ...next], id)`, Hafs note = `performanceText || 'مستورد من مرجع nquran.com'` / `'مستورد من مرجع الشامل'` by source, skip an identical narrator+action; `readingText` only if `ctx.readingText.trim()===''` and the group has one; when `ctx.isFreshDraft`: set `kind` from the suggestion and `appliesWasl/appliesWaqf` from `condition` (wasl→true/false, waqf→false/true, both→true/true); `categoryCode` only if resulting kind is `'usul'`, `ctx.categoryCode===null` and a code is suggested; whatever suggestion was not applied is returned as `pendingSuggestion`. A group with none of the optional fields (every nquran group) yields a plan with `narrators` only — identical to today's `handleApplyNquranGroup`.

- [ ] **Step 1: Write the failing tests** `tests/qiraat/reference-apply.test.ts`: nquran group → narrators only, action = reading, no other keys set; Hafs gets `wajhOrder ≥ 2` and a note (both sources' note texts); `identical narrator+action is skipped (apply twice)` — Review Focus 5; `same narrator, different action gets the next wajh order`; `readingText not overwritten when non-empty, filled when empty`; fresh draft takes kind/wasl/waqf/category from a shamil group, non-fresh draft does not (and returns `pendingSuggestion`); `existing categoryCode is never overwritten`; a farsh suggestion never sets `categoryCode`.
- [ ] **Step 2: Run** `npx tsx --test tests/qiraat/reference-apply.test.ts` → FAIL.
- [ ] **Step 3: Implement** `planApplyReferenceGroup` (pure, no React; returns new arrays, never mutates `ctx`).
- [ ] **Step 4: Run** the new test plus `tests/qiraat/review-workstation.test.ts` → pass.
- [ ] **Step 5: Commit** — `feat(review): planner for adding a reference group to the draft`

---

### Task 5: `ReferencePanel` + editor wiring

**Files:**
- Create: `R/_components/ReferencePanel.tsx`
- Modify: `R/_components/ReviewEditorPane.tsx` (remove nquran state/handler/block and its imports; render `<ReferencePanel>` where the block was, ~lines 1049–1141; replace `handleApplyNquranGroup`; state at ~209–263)
- Modify: `package.json` (add the five new test files to `test:qiraat:review`)

**Interfaces:**
- Consumes: Tasks 2–4 exports; `WordMeta` type from `ReviewEditorPane.tsx` (export it from there or move to `R/_lib/types.ts` if that avoids a circular import).
- Produces `ReferencePanel` props:
  ```ts
  type Props = {
    selectedWordMeta: WordMeta | null
    activeRowsForWord: ReviewRow[]
    isSaving: boolean
    appliedKey: string | null
    onApply(group: ReferenceGroup, source: ReferenceSourceId, appliedKey: string): void
    onApplySuggestion(s: ReferenceSuggestion): void
  }
  ```
  Panel owns: source (`'nquran' | 'shamil'`, persisted in `localStorage` key `mushaf1441:review:reference-source:v1`, every access try/caught, default nquran), loaded data per source, open/closed state.

- [ ] **Step 1: Build `ReferencePanel`.** Move the nquran block's markup and the `NQURAN_DECISION_BADGES` lookup into it unchanged for source `nquran` (use `nquranGroupsForDifference` + `proposeReferenceDecision`; same labels, classes, texts, help line, source link). Add the tab switch **[ nquran | الشامل ]** in the panel header. For `shamil`: load with `loadShamilReference` only when that tab is active (error → short line + «إعادة المحاولة»); `findShamilEntriesForWord` for the selected word; per entry show the «قاعدة عامة» tag when `scope==='all_quran'`, the wajh groups (readers, `performanceText`, reading text in `font-quran`, condition chip «وصلاً / وقفاً / وصلاً ووقفاً» with a muted «افتراضي» when `conditionBasis==='default'`, suggestion chip «الباب المقترح: <nameAr>» via `FALLBACK_USUL_CATEGORIES` that calls `onApplySuggestion`, the decision badge, «➕ إضافة للأداء» → «✓ أُضيف — اضغط حفظ»), plus a collapsible «نص الكتاب» (`sourceText`) and the entry `flags`. Empty states: «لا بيانات من الشامل لهذه السورة بعد» (surah not in index) and «لا يوجد في الشامل لهذه الكلمة» (no entry). Add a one-line help text noting that a word repeated in an ayah shows the same wajhs for each occurrence.
- [ ] **Step 2: Wire the pane.** Delete `nquranLoaded/nquranPanelOpen/nquranRanked/nquranAppliedKey`, the nquran imports, `NQURAN_DECISION_BADGES`, and the inline block. Add `const [referenceAppliedKey, setReferenceAppliedKey] = useState<string | null>(null)` and `handleApplyReferenceGroup(group, source, appliedKey)`: build `ApplyContext` from the hook's `narrators/readingText/kind/categoryCode`, `isFreshDraft = isAddMode && narrators.length === 0`, `otherFarshNarrators` from `activeRowsForWord` exactly as the old handler computed `others`; call `planApplyReferenceGroup`; then `setNarrators(plan.narrators)` and the optional `setReadingText/setKind/setAppliesWasl/setAppliesWaqf/setCategoryCode`; set the 2.5 s applied-key flash as before. `onApplySuggestion` sets `kind` and `categoryCode` (and `setKind` first). The panel renders where the nquran block was and only when a word is selected, as before.
- [ ] **Step 3: Static checks**

Run: `npm run typecheck && npm run lint 2>&1 | tail -5`
Expected: typecheck clean; lint errors ≤ 55 (record the number).

- [ ] **Step 4: Update `package.json`** `test:qiraat:review` to also run `tests/qiraat/shamil-build.test.ts tests/qiraat/reference-group.test.ts tests/qiraat/shamil-reference.test.ts tests/qiraat/reference-apply.test.ts`. Run `npm run test:qiraat:review` → all pass.
- [ ] **Step 5: Browser check** (local production build: `env -u __NEXT_PROCESSED_ENV npm run build && env -u __NEXT_PROCESSED_ENV npm run start`, then the built-in browser at `/mushaf-1441/review?page=3`, writes not performed — do **not** press «حفظ»). Verify and record: default tab is nquran and looks identical to before; switching to الشامل persists across reload; clicking the word «يَخْدَعُونَ» (2:9) lists the p003_e08 wajhs with the right readers and badges; ➕ adds the narrators (visible in «تفاصيل الأداء والأوجه») and fills the reading text when empty; page 20 (surah 2 beyond p13) shows «لا يوجد في الشامل لهذه الكلمة»; a surah-3 word shows «لا بيانات من الشامل لهذه السورة بعد»; no page/console errors; mobile viewport (375 px) editor still renders (it has no reference panel).
- [ ] **Step 6: Commit** — `feat(review): source switch and الشامل reference panel in the editor`

---

### Task 6: Changelog and final verification

**Files:**
- Modify: `CHANGELOG.md`, `CLAUDE.md` (the `# Changelog` section; keep both in sync, newest first, dated 2026-10-04)

- [ ] **Step 1:** Add the entry: what was added (source switch, per-surah data under `_lib/reference/shamil/`, build script and how to add more pages), the matching rule (token equality + hamza fold, why), the mapped/unmapped category numbers from Task 3, files touched, **DB migration: none**, verification results.
- [ ] **Step 2: Full verification**

Run: `npm run typecheck && npm run test:qiraat:review && env -u __NEXT_PROCESSED_ENV npm run build`
Expected: all clean/pass.

- [ ] **Step 3: Commit** — `docs: changelog for the الشامل reference source`

---

## Self-review notes (plan vs spec)

- Spec §3.1 → Task 1; §3.2 → Task 3; §3.3 → Tasks 2 + 5; §3.4 → Tasks 4 + 5; §6 testing → Tasks 1–6; changelog/lint/build → Task 6. Spec §5 limits (repeated word, default basis, unknown narrator) are covered by the panel help text/marker and Task 1.
- Deviations from the spec text, all recorded in the spec itself: matching is whole-token equality (not containment); unmapped-category count is reported by the TS test, not the build script; mobile gets no panel.
- Names used across tasks: `ReferenceGroup`, `ReferenceSuggestion`, `proposeReferenceDecision`, `nquranGroupsForDifference`, `shamilGroupsForEntry`, `findShamilEntriesForWord`, `planApplyReferenceGroup`, `ReferenceSourceId`.
