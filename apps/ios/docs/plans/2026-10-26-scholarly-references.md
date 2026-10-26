# Scholarly references per word variant (الشاطبية، الدرة، طيبة النشر) — implementation plan

## Revision (2026-10-26, after review against the code)
The first pass was written without a Swift toolchain. Reviewing it against the code changed these points; the rest of
the plan stands and is implemented.
1. **Bundling.** An `optional: true` folder resource in `project.yml` still copies a folder Xcode then cannot find when
   the file is absent. Replaced by a pre-build script, "Copy Qiraat references (optional)": copies
   `Generated/QiraatReferences/references.json` into the bundle when present and removes the bundle copy when absent,
   so a deleted file never lingers in DerivedData. Verified both ways.
2. **Where the store is set.** `.environment(\.qiraatReferences, …)` sat on the reader root, outside the `.sheet`
   modifier, so the card might not see it. It is now set inside `qiraatCard(…)`, which builds both the sheet and the
   iPad side-bar card.
3. **Store type.** A value type (`struct QiraatReferenceStore: Sendable`) instead of `final class @unchecked Sendable`;
   no `Identifiable` (the row uses offsets: two references can share a work and verse).
4. **Key normalisation.** Swift compares and hashes `String` by canonical equivalence, so an NFD key in the file
   matches already; a test guards it.
5. **Row completeness.** The chip now shows the verse and a written status (the least-checked of that work's
   references); the opened block adds «الرمز», the named readers as `QiraatPills` with which side they read, the note
   and «افتح في الشاملة» (http/https only). Work names and statuses are localized literals, not `labelAr` verbatim.
6. **String catalog.** The first pass re-sorted the whole `Localizable.xcstrings`; it was restored and only the new
   keys were added (additions-only diff).
7. **Report contract.** No separate patch file: the work is in the tree for review and commit.

Goal: each فرش variant card in the word sheet shows where the reading is documented in the three متون: the verse line, its number, the printed page, which readers the verse names, and a check that those readers match the variant's own `readingIds`.

Out of scope: أصول rulings (RulingCard), commentary/توجيه, audio, any web or database change, writing the real reference data (the orchestrator builds `references.json` separately from the user's Shamela library). Do not invent scholarly content anywhere. Tests use clearly synthetic text.

## Global constraints (AGENTS.md of apps/ios; read it first)
- Only files under `apps/ios/` change. Do not commit, push, sign in or touch git config. Leave changes in the working tree.
- No model or tool names in code comments, test names or changelog text.
- Tests first. Swift Testing in `MushafCore`, XCTest for the app. Swift 6, iOS 18 target.
- Real reference data is NOT committed (public repo). It lives in the git-ignored `Generated/QiraatReferences/references.json`. The app must work when that file is missing, empty, or malformed: no crash, no UI, a `Logger` line only.
- Add a dated entry (2026-10-26, newest first) to `apps/ios/CHANGELOG.md`.
- New Arabic UI strings need English translations in `Sources/Localizable.xcstrings` through the existing `appLocalized` pattern; `QiraatLocalizationTests` must stay green.
- Verse text is not Quran text. Never draw it in the Mushaf fonts (KFGQPC, QCF). Use a system Arabic face (Geeza Pro or the system serif) and label it «من متن الشاطبية» etc.

## File format (fixed; the orchestrator generates it)
`Generated/QiraatReferences/references.json`:
```json
{ "schemaVersion": 1, "generatedAt": "2026-10-26T00:00:00Z",
  "entries": [ {
    "variantId": "v-L001-مالك-1-w2-a4-t1",
    "variantKey": "1:4:1-1:مَلِكِ",
    "work": "shatibiyyah",
    "verse": 108,
    "lines": ["synthetic line"],
    "symbolText": "ناصر",
    "side": "complement",
    "readingIds": ["Q05-R01","Q05-R02","Q07-R01","Q07-R02"],
    "printedPage": "9",
    "sourceBookId": 7754,
    "sourceUrl": "https://shamela.ws/book/7754/15",
    "status": "extracted",
    "note": null } ] }
```
- `work`: `shatibiyyah` | `durrah` | `tayyibah`. `status`: `extracted` | `reviewed` | `verified`. `side`: `variant` (the named readers read `variantText`) or `complement` (they read the Hafs-side text, so the variant is read by the rest of the work's scope).
- `variantKey` = `"\(surah):\(ayah):\(startToken)-\(endToken):\(variantText)"` (variantText as in the data, NFC).
- Optional fields: `verse`, `symbolText`, `printedPage`, `sourceBookId`, `sourceUrl`, `note`.
- Scope per work (narrator ids): shatibiyyah = Q01-Q07 narrators; durrah = Q08-Q10 narrators; tayyibah = Q01-Q10 narrators.

## Task 1: Model, key, store, consistency (MushafCore)
Files: create `MushafCore/Sources/MushafCore/QiraatReferences.swift`; test `MushafCore/Tests/MushafCoreTests/QiraatReferenceTests.swift`.
Interfaces to produce (names are binding):
- `public enum QiraatMatn: String, Codable, CaseIterable, Sendable` with `labelAr` («الشاطبية»، «الدرة»، «طيبة النشر») and `func scope(in catalog: QiraatCatalog) -> Set<String>` (narrator reading ids per the scope rule above).
- `public struct QiraatReference: Codable, Sendable, Hashable, Identifiable` with the JSON fields above (`id` computed from variantId/work/verse), `enum Status`, `enum Side`.
- `public enum QiraatReferenceConsistency: Equatable, Sendable { case consistent, mismatch(expected: Set<String>, named: Set<String>), unknown }`.
- `public final class QiraatReferenceStore: @unchecked Sendable`: `init(directory: URL)` (never throws; missing/malformed file gives an empty store and `isEmpty == true`), `func references(for variant: QiraatVariant) -> [QiraatReference]` (match `variantId` first, else `variantKey`; order shatibiyyah, durrah, tayyibah, then verse), `func consistency(_ reference: QiraatReference, variant: QiraatVariant, catalog: QiraatCatalog) -> QiraatReferenceConsistency`, `static func key(for variant: QiraatVariant) -> String`.
Consistency rule: `scope` = the work's scope; `variantSet` = `Set(variant.readingIds)` ∩ scope; `expected` = side == .variant ? variantSet : scope − variantSet; `named` = `Set(reference.readingIds)` ∩ scope; empty `named` is `.unknown`; equal sets are `.consistent`; otherwise `.mismatch`.
Tests (assert exactly): the 1:4 example above is `.consistent` with side complement; flipping side to `.variant` gives `.mismatch`; durrah scope excludes Q01-Q07; tayyibah covers Q01-Q10; lookup by id, by key when the id differs, no cross-match when variantText differs; missing file, empty file, garbage bytes and `schemaVersion` 2 all give an empty store without throwing; duplicate entries for one variant are returned in the stated order.

## Task 2: Loading and wiring (app + build)
Files: modify `Sources/MushafLibrary.swift` (expose `qiraatReferences: QiraatReferenceStore`, loaded from the bundle resource folder `QiraatReferences`, empty store if absent), `project.yml` (add `Generated/QiraatReferences` as an optional folder resource; the pre-build check must NOT fail when it is absent), `Makefile` (new `references` target: `mkdir -p Generated/QiraatReferences` and copy `$(REFERENCES_SRC)` there, error with a clear message if the variable is unset or the file is missing; `REFERENCES_SRC ?=` empty; add to `.PHONY`; `make test` must not depend on it), SwiftUI environment key `\.qiraatReferences` set once at the reader root.
Check: `make project` succeeds with and without the folder present; `make release-guard` still passes.

## Task 3: Variant card row (UI)
Files: create `Sources/Qiraat/QiraatReferencesRow.swift`; modify `Sources/Qiraat/VariantCard.swift` to show the row under the readers block; strings in `Sources/Localizable.xcstrings`.
Behaviour:
- Store empty or no references for this variant: render nothing. (Never show «لم يُوثَّق بعد» when no file is loaded.) If the store has data but not for this variant: show one quiet line «المصادر: لم يُوثَّق بعد».
- Collapsed: a «المصادر» disclosure with one chip per work (الشاطبية ١٠٨ · الدرة · طيبة النشر), each chip tinted by `status` and carrying a text status label (مستخرج / مراجَع / موثّق); colour is never the only cue.
- Expanded inline (no sheet, no modal): per reference the work label, «البيت N»، «ص X», the verbatim `lines` (system Arabic face, RTL, wraps, honours Dynamic Type up to AX5), «الرمز: …» when `symbolText` exists, the named readers as the existing `QiraatPills`, and when `consistency` is `.mismatch` a visible warning «لا يطابق قراءات هذه الكلمة، يحتاج مراجعة» (never hide the reference).
- The `note` and a «افتح في الشاملة» link are shown only when present; the link uses `sourceUrl`.
- Touch targets ≥ 44 pt. VoiceOver: one combined element per chip, header trait on the section. Identifiers: `qiraat-references-row`, `qiraat-reference-chip-<work>`, `qiraat-reference-lines`, `qiraat-reference-mismatch`. Respect Reduce Motion (no animated expansion when on).
- Works in light/dark and all five Mushaf appearances; use existing colours (`mushafBrown`, `qiraatCardFill`), no new palette.
Tests: app XCTest `QiraatReferencesRowTests` using a synthetic store: nothing rendered for an empty store, three chips in order, mismatch warning shown, English strings present.

## Task 4: UI test hook
Files: `UITests/QiraatReferencesUITests.swift`; a DEBUG-only launch argument `-qiraat-references-fixture` that loads a synthetic store (text «نص تجريبي»; entries for the word at page 1, ayah 4, token 1). One test: open the word sheet for 1:4, the row exists, expanding it shows the synthetic line and the three chips. Run on the iPhone simulator only, alone.

## Task 5: Docs
Create `apps/ios/docs/qiraat-references-format.md` (the file format above, the scope and consistency rules, how to run `make references REFERENCES_SRC=…`). Add the CHANGELOG entry and one short paragraph in `HANDOFF.md`.

## Review focus (each needs a test or a stated manual check)
1. A malformed or missing file never crashes or shows a half-empty row.
2. Variants at one locus whose `variantText` differs (and performance-only variants where `variantText == hafsText`) must not receive each other's references.
3. A reference whose readers do not match the variant is shown with the warning, not dropped.
4. Long lines and AX5 text size: no clipped or overlapping text, no horizontal scroll.
5. `فرش فقط` mode and the reader filter do not change what the references row shows.

## Gates (run all, report real output)
`swift test --package-path MushafCore` ; `xcodebuild … -only-testing:MutshabehatTests` on the iPhone simulator ; `QiraatReferencesUITests` alone ; `make release-guard` ; `scripts/check_isolation.sh`. If a gate cannot run, say so; do not claim it passed.

## Report contract
Write `apps/ios/docs/plans/2026-10-26-scholarly-references-report.md` with: files changed, one line per task, every gate command with its pass/fail counts, decisions you made that the plan left open, anything you could not do. Also save the full diff against `ios/main` to `apps/ios/docs/plans/2026-10-26-scholarly-references.patch`. Do not commit.
