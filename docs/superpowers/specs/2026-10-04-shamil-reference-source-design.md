# «الشامل» reference source for the review editor — design

Date: 2026-10-04 · Status: awaiting review · Path: architectural (brainstormed with owner)

## 1. Goal

Add «الشامل في قراءات الأئمة العشر» as a second **reference source** in the review editor
(`/mushaf-1441/review`), beside nquran.com. The reviewer can:

1. switch the reference panel between **nquran** and **الشامل**;
2. see, for the clicked word, every الشامل وجه that applies, each with a **reconciliation badge**
   against what is already recorded for that word (same five states as nquran);
3. press ➕ on a وجه to fill the open face's draft, then press «حفظ» to save it into the qiraat
   database — exactly the nquran flow.

Delivered first with two sample files (`Qiraat_Baqarah_p002-008.json`, `Qiraat_Baqarah_p002-013.json`,
Mushaf pages 2–13) to test before importing the rest of the Mushaf.

**Not in scope:** auto-applying anything; one-click saving; a Postgres copy of the source; poetry
(`poetry`) and `indexes` from the files; editing الشامل data in the UI; changing nquran behaviour.

## 2. Source data (observed)

Both files share one shape: `meta, readers, narrators, entries, records, poetry, indexes`.
`p002-008` is an exact subset of `p002-013` (117 entries / 423 records, all identical), so merging
overlapping files by id is lossless.

- **entry** (`entry_id` e.g. `p003_e08`): `page`, `surah`, `ayahs[]` (can hold several ayahs, e.g.
  `[2,5]`), `words[{text, normalized}]` (one or more words), `type` (`usul`|`farsh`), `category`,
  `scope` (`this_word` 186 | `all_quran` 34), `source_text` (book wording), `flags[]` (reviewer
  warnings), `justification`.
- **record** (`id` e.g. `p003_e08_w1`) = one وجه of an entry: `wajh`, `description`, `reading_text`
  (null for most usul), `condition` (`both`|`wasl`|`waqf`) + `condition_basis` (`stated`|`default`|
  `inherent`|`inferred`…), `narrators[]` (ids), `readers[]` (ids), `type`, `category`.
- 220 entries, 738 records, 20 narrators. Narrator ids are a closed set, so unlike nquran no Arabic
  label parsing is needed.
- Categories are coarse. 215 usul records (and all 87 farsh records) sit in the mixed bucket
  «الأصول/فرش».
- **No word positions** — only word text + ayah numbers. Matching is text-based, as for nquran.

## 3. Architecture

Four units, each testable on its own.

### 3.1 Build script — `scripts/qiraat/build_shamil_reference.py`

`python3 scripts/qiraat/build_shamil_reference.py <file.json> [<file.json> …]`

- Reads every input, merges `entries`/`records` **by id** (later file wins on a conflict and the
  script prints the conflicting ids), groups by surah.
- Writes `src/app/mushaf-1441/review/_lib/reference/shamil/surah-NNN.json` (only for surahs that
  have data) and `…/shamil/index.json` = `{ surahs: { "2": { pages: [2,13], entries: 220 } } }`.
- Per-surah file = list of entries, each with `entryId, page, ayahs, words[normalized text kept
  as-is], type, category, scope, sourceText, flags, wajhs[{id, wajh, description, readingText,
  condition, conditionBasis, narrators[], category, type}]`. Dropped: `justification`, `poetry`,
  `indexes`, `type_basis`, top-level reader/narrator tables.
- **Validation (hard failures, exit 1):** a narrator id outside the 20 known; a record whose entry
  is missing; an entry with no records; empty narrator list on a record.
  **Warnings (printed, exit 0):** source-category histogram, `condition_basis=default` count,
  multi-ayah entries. (The mapped/unmapped *category suggestion* count lives in the TS test, since the
  mapping lives in `shamilReference.ts`.)
- Idempotent: re-running with more files regenerates identical output for unchanged ids.
- Existing `reference/nquran/` files are untouched.

### 3.2 Resolver — `_lib/shamilReference.ts`

- `loadShamilReference(surah)` / `hasShamilReferenceForSurah(surah)`: lazy `import()` of
  `reference/shamil/surah-NNN.json`, cached per surah. Coverage comes from the generated
  `index.json` (not "1..114"), because a dynamic import of a missing file would fail at runtime.
  The chunk loads **only when the الشامل tab is active**.
- `SHAMIL_NARRATOR_TO_ID`: fixed 20-entry table →
  `qalun Q01-R01, warsh Q01-R02, bazzi Q02-R01, qunbul Q02-R02, duri_abuamr Q03-R01, susi Q03-R02,
  hisham Q04-R01, ibn_dhakwan Q04-R02, shubah Q05-R01, hafs Q05-R02, khalaf_hamzah Q06-R01,
  khallad Q06-R02, abulharith Q07-R01, duri_kisai Q07-R02, ibn_wardan Q08-R01, ibn_jammaz Q08-R02,
  ruways Q09-R01, rawh Q09-R02, ishaq Q10-R01, idris Q10-R02` (same IDs as nquran's table).
- `findShamilEntriesForWord(entries, ayah, wordText)`: entries whose `ayahs` include the ayah **and**
  one of whose words, split into tokens, equals the clicked word after `matchKey()` =
  `normalizeArabic(s)` with the hamza letter «ء» also removed (الشامل writes «ءَاخِرَة», the Mushaf
  writes «ـَٔاخِرَة»; `normalizeArabic` alone leaves 8 of 220 sample entries unmatched, with the
  extra fold only 3 multi-ayah entries lack a match in *every* listed ayah and none lacks one in
  *all* of them). **Whole-token equality, not substring containment** (refinement of the earlier
  "containment" wording, measured on the sample: equality already matches 220/220 entries, and
  containment only adds false hits for short words). Results keep file order; `all_quran` entries
  are returned with `scope` so the UI can tag them «قاعدة عامة». The file's own `normalized` field is
  not used.
- `suggestShamilCategory(wajh, entry)` → `{ kind: 'farsh'|'usul'; categoryCode: string|null }`.
  `kind` comes from the record's `type`. `categoryCode` comes from an explicit table:

  | الشامل category | `category_code` |
  |---|---|
  | التقليل والإمالة | `IMALAH_TAQLIL` |
  | الإبدال | `USUL_IBDAL` |
  | إدغام بلا غنة | `TARK_GHUNNA` |
  | صلة الهاء | `SILAT_HA` |
  | الترقيق | `TARQIQ_RA` |
  | التغليظ | `TAGHLIZ_LAM` |
  | النقل والسكت | description contains «سكت» → `USUL_SAKT`; «نقل» → `USUL_NAQL`; «تحقيق» → `USUL_TAHQIQ`; else none |
  | إدغام صغير/كبير | description contains «الكبير» → `IDGHAM_KABIR`; contains «إدغام» or «إظهار» → `IDGHAM_SAGHIR`; else none |
  | الأصول/فرش (usul) | keyword rules on `description`, e.g. «ميم» → `USUL_MIM_JAM`, «البدل» → `MADD_BADAL`, «المد المتصل» → `USUL_MADD`; first match wins; **no match → none** |
  | الأصول/فرش (farsh) | no category (farsh has none) |

  A `null` code is never guessed. The exact keyword list for the mixed bucket is tuned against the
  738 real records during implementation; the build script reports mapped/unmapped counts and the
  tests pin the chosen rules to named example records.
- Narrator resolution: `wajh.narrators` → Q-ids via the table above (already concrete, no
  "remainder" computation — the file expands «الباقون» itself).
- The generalised reconciliation function (3.3) is reused unchanged.

### 3.3 Shared reference panel — `_components/ReferencePanel.tsx`

Extract the nquran block (currently inline in `ReviewEditorPane.tsx`, ~lines 1049–1141, state at
~209–263) into a component and add the switch.

- Props: selected word meta, `activeRowsForWord`, `isSaving`, `onApplyGroup(group)`.
- Source switch **[ nquran | الشامل ]**, stored per device in `localStorage`
  (`mushaf1441:review:reference-source:v1`, try/caught; default nquran).
- Both sources are adapted to one **`ReferenceGroup`** shape:
  `{ key, readersLabel, narratorIds, performanceText, readingText?, condition?, conditionBasis?,
  suggestion?, scope?, sourceText?, flags? }`. nquran's adapter wraps today's
  `resolveDifferenceGroups` output (no behaviour change); the الشامل adapter wraps `wajhs`.
- `proposeNquranDecision` is generalised to `proposeReferenceDecision(group, existingRows)` taking
  anything with `narratorIds` (the nquran name stays exported as an alias so its tests and callers
  keep working). Statuses unchanged: matched / recorded_unreviewed / partial / missing / unresolved.
- الشامل rows show: wajh number, readers, description, reading text (Quran font), «وصلاً / وقفاً /
  وصلاً ووقفاً» chip (muted «افتراضي» marker when `conditionBasis = default`), suggested kind /
  category chip, the badge, ➕ button, and a collapsible «نص الكتاب» (`sourceText`) + entry `flags`.
  Entries with `scope = all_quran` get a «قاعدة عامة» tag.
- Empty states: surah not in الشامل index → «لا بيانات من الشامل لهذه السورة بعد»; no entry for this
  word → «لا يوجد في الشامل لهذه الكلمة» (same style as nquran's).
- Mobile editor: has no nquran panel today (checked), so none is added.

### 3.4 Add behaviour — `handleApplyReferenceGroup` in `ReviewEditorPane.tsx`

Same as today's `handleApplyNquranGroup` (it becomes the generic handler):

- appends each narrator to the **open face's** narrators draft with `action` = the performance
  text, wajh order via `nextWajhOrder` over the word's other active farsh rows, Hafs floored at 2
  with a note (rules `QIRAAT_NARRATOR_TWICE`, D8); skips an identical narrator+action;
- الشامل performance text = `description`; when `condition` is `waqf`/`wasl` and the description
  does not already say وقف/وصل, « وقفًا»/« وصلاً» is appended (matches existing phrasing);
- **extras only when they cannot overwrite anything the reviewer entered:**
  - `readingText` set from `reading_text` if the field is empty;
  - `kind`, `appliesWasl/appliesWaqf` set from the record only when the draft is a **new entry with
    no narrators yet**; on an existing saved row they are shown as chips, not applied;
  - `categoryCode` set from the suggestion only when the draft has no category; otherwise the chip
    offers a click-to-apply;
- nothing is written to the database until «حفظ». **No DB migration**; saving uses the existing
  create/update RPCs and the instant optimistic save queue unchanged.
- Button states as nquran: «➕ إضافة للأداء» → «✓ أُضيف — اضغط حفظ».

## 4. Data flow

```
الشامل JSON ──build script──▶ reference/shamil/surah-NNN.json + index.json
select word ─▶ ReferencePanel(source=الشامل) ─▶ loadShamilReference(surah)
            ─▶ findShamilEntriesForWord ─▶ ReferenceGroup[] ─▶ proposeReferenceDecision(activeRowsForWord)
➕ ─▶ handleApplyReferenceGroup ─▶ draft (narrators / readingText / flags) ─▶ «حفظ» ─▶ existing RPCs
```

## 5. Error handling and known limits

- Import failure of a surah chunk → panel shows a short error line with «إعادة المحاولة»; the editor
  keeps working (reference is optional).
- Text-based matching has nquran's limit: if a word appears twice in one ayah both occurrences show
  the same wajhs. Accepted for v1 (documented in the panel help text for الشامل).
- Multi-ayah entries match any listed ayah; the entry shows its full ayah list.
- `condition_basis = default` means the book was silent and the file assumed «both»; the panel marks
  it «افتراضي» so the reviewer does not read it as stated.
- Unknown narrator id in a future file → build script fails loudly (never silently dropped).

## 6. Testing

- `tests/qiraat/shamil-reference.test.ts` (added to `test:qiraat:review`):
  narrator table covers exactly the 20 ids; the resolver and containment matching on real records
  (e.g. 2:9 «وَمَا يَخْدَعُونَ» → 2 wajhs, 6 + 14 narrators; 2:4 «وَبِٱلْءَاخِرَةِ» → إمالة وقفًا for
  Kisai's two narrators); category suggestion on named example records for every table row;
  generalised decision function (all five statuses) for both sources; nquran tests still pass.
- Build-script check (run in the test): both sample files together produce exactly 220 entries /
  738 records for surah 2, `index.json` lists pages 2–13, and re-running is byte-identical.
- Manual browser check (Playwright, local build): switch persists across reload; on real words from
  pages 2–13 the الشامل panel lists the expected wajhs and badges; ➕ fills narrators / reading text /
  wasl-waqf per 3.4; nquran panel unchanged; no page errors.
- `npm run typecheck`, `npm run test:qiraat:review`, `npm run build`, lint error count not above the
  current 55.
- CHANGELOG entry in **both** `CHANGELOG.md` and the `# Changelog` section of `CLAUDE.md`.

## 7. Files

New: `scripts/qiraat/build_shamil_reference.py`, `_lib/shamilReference.ts`,
`_lib/reference/shamil/*.json`, `_components/ReferencePanel.tsx`,
`tests/qiraat/shamil-reference.test.ts`.
Changed: `_lib/nquranReference.ts` (generalised decision function, alias kept),
`_components/ReviewEditorPane.tsx` (panel extracted, generic apply handler),
`MobileReviewEditorView.tsx` (only if it shows a reference panel), `package.json` (test script),
`CHANGELOG.md`, `CLAUDE.md`.
(`_lib/` and `_components/` are under `src/app/mushaf-1441/review/`.)

## 8. Next steps after the pilot

Importing the remaining pages = run the build script with the new JSON files; no code change
expected. If the keyword rules for «الأصول/فرش» prove too weak on later pages, tune them in
`shamilReference.ts` with new pinned test cases.
