# Handoff: scholarly references, the «المتون» page and the reader/narrator symbols (2026-10-27)

For the next agent continuing this work. Read `apps/ios/AGENTS.md` first; its rules hold throughout.

## 1. Where things are

- Checkout: `~/Projects/qiraat-ios` (a git worktree of `Shazlka/Mutshabehat`). Work under `apps/ios` only.
- Branch: `ios/main`, pushed to origin at `b0e2012f`. Working tree clean at handoff (this file and the HANDOFF.md link
  are the only uncommitted changes, if not yet committed).
- Rules that bit or nearly bit in this work:
  - The repo is public. **Never commit book text or derived data** (poem verses, commentary pages, symbol marks,
    `references.json`). All of it lives in the git-ignored `apps/ios/Generated/`, which `make clean` does not delete.
  - Commits: author `Shazlka <amr.eshazly@gmail.com>`, no model names, no Co-Authored-By line.
  - Never push or merge without the owner's go-ahead. `ios/main` never merges into `main`.
  - Every change gets a dated entry, newest first, in `apps/ios/CHANGELOG.md`.
  - UI tests run on the simulator only.

## 2. What was built (newest last)

| Commit | What |
|---|---|
| `a5945804` | Qiraat card «المصادر» row: where الشاطبية، الدرة and طيبة النشر document a variant (verse, page, symbol, readers). |
| `33527cc9` | الدرة's consistency check uses a subset rule («فإن خالفوا أذكر وإلا فأهملا»). |
| `50532302` | References load on the first Qiraat card, not at launch (the file is ~2.3 MB). |
| `58892335` | Changelog for the فرش references completed per poem. |
| `02701c88` | «المتون» page under المزيد (all three books, chapters, verses, search); DEBUG switch under المطور to hide the card's «المراجعة والتحرير». |
| `24d4d2f1` | «المتون» right to left; the search field keeps the keyboard; Arabic-Indic digits. |
| `8d2144d7` | Red reader/narrator symbols in «المتون» with a card for each; switch «تمييز الرموز»; key line. |
| `c743bb1a` | A mark says how it was checked (`method`: `hand` / `match`); card wording for each. |
| `b0e2012f` | Word symbols match their tanween/accusative/final-ى spellings (`MatnSymbols.wordKey`). |

## 3. Code map

- `MushafCore/Sources/MushafCore/QiraatReferences.swift`: `QiraatMatn`, `QiraatReference`, `QiraatReferenceStore` (lookup by
  variant id then key; reader consistency per work).
- `MushafCore/Sources/MushafCore/MatnLibrary.swift`: the three متون (`mutoon.json`), search, and the symbol layer it loads
  beside them (`mutoon-symbols.json`).
- `MushafCore/Sources/MushafCore/MatnSymbols.swift`: one symbol dictionary per متن (الشاطبية ٤٥–٥٥: 35; الدرة ٥–٨: 9;
  طيبة النشر ٣٦–٤٨: 44), `MatnSymbolAnnotation` (+ `problem(in:)`: the app's own check of every mark), `MatnSymbolLayer`,
  `MatnSymbols.key` / `wordKey`.
- `Sources/Qiraat/MutoonView.swift`: the page. Each hemistich is a `UITextView` (`MatnLineText`) so a red symbol is a link that
  answers a tap in RTL text and stays selectable; `MatnSymbolCard`; `MatnSymbolToggle` (`mutoon:symbols:v1`); `MatnSymbolKey`.
- `Sources/Qiraat/QiraatReferencesRow.swift`: the card's «المصادر» row.
- `Sources/MushafLibrary.swift`: loads both data folders lazily; DEBUG fixtures for UI tests (`-mutoon-fixture`,
  `-qiraat-references-fixture`, `-qiraat-references-empty`).
- `Sources/Reader/DeveloperSettings.swift`, `ReaderSettingsView.swift`, `ReaderView.swift`: the card-review switch and the
  «المتون» entry (also in `ReaderBottomBar.swift` / `ReaderActionRail.swift`).
- `scripts/build_mutoon.py`, `scripts/build_matn_symbols.py` (+ tests): build the bundled files.
- `project.yml`: pre-build steps copy `Generated/QiraatReferences/` and `Generated/QiraatMutoon/{mutoon,mutoon-symbols}.json`
  into the app when present, and remove them when not.
- Docs: `docs/qiraat-references-format.md` (all three file formats and how the marks were made).
- Tests: `MatnLibraryTests`, `MatnSymbolsTests` (8), `QiraatReferenceTests`; `UITests/MutoonUITests` (3),
  `QiraatReferencesUITests`, `QiraatCardReviewUITests`; `scripts/test_build_mutoon.py`, `scripts/test_build_matn_symbols.py`.

## 4. Data (local only, git-ignored, all under `apps/ios/Generated/`)

| Path | What |
|---|---|
| `Shamela/shamela-html/{7754,7749,7795}/` | The three متون pages from shamela.ws (`fetch_books.py`). |
| `Shamela/sharh-html/38075/` | الوافي في شرح الشاطبية (396 pages). |
| `Shamela/sharh-html/8650/` | الهادي شرح طيبة النشر (1,125 pages; nothing after). |
| `Shamela/fetch_sharh.py`, `fetch_books.py` | Downloaders (write only on HTTP 200; resume; skip saved pages). |
| `Shamela/second-copy/متون_…html` | The owner's second copy of the متون with its own marks. |
| `QiraatReferences-full/` | `parse_books.py` → `verses.json` (2,428 verses); `match.py` → `references.json`; review sheets. |
| `QiraatReferences/references.json` | Loaded by the app (4,406 references; 2,236 of 3,624 variants). |
| `QiraatMutoon/mutoon.json` | The three متون for the page (`make mutoon`). |
| `QiraatMutoon/symbols-sample.json` | 77 marks checked by hand (`method: hand`). |
| `QiraatMutoon/sharh_symbols.py` | Matches symbols to the شرح; writes `symbols-all.json`. |
| `QiraatMutoon/second_copy.py` | Compares the second copy; adds its marks that pass the same checks into `symbols-all.json`. |
| `QiraatMutoon/symbols-all.json` | All marks (input to the build). |
| `QiraatMutoon/mutoon-symbols.json` | Built layer the app loads (3,693 marks, all pass the app's check). |
| `QiraatMutoon/review-symbols.html` | Every marked verse with its red symbols, for the owner's review. |
| `QiraatMutoon/second-copy-report.txt` | The comparison with the second copy. |

Rebuild, in order (from `apps/ios`):

```bash
make mutoon
cd Generated/QiraatMutoon
python3 -I sharh_symbols.py ../Shamela/sharh-html mutoon.json symbols-sample.json symbols-all.json
python3 -I second_copy.py ../Shamela/second-copy/متون_الشاطبية_والدرة_وطيبة_النشر.html ../Shamela/sharh-html mutoon.json symbols-all.json symbols-all.json second-copy-report.txt
cd ../..
make matn-symbols
python3 -I Generated/QiraatMutoon/make_symbols_review.py Generated/QiraatMutoon/mutoon.json Generated/QiraatMutoon/mutoon-symbols.json Generated/QiraatMutoon/review-symbols.html
```

Re-running `second_copy.py` adds nothing the second time (checked). Re-running the whole chain reproduces the same file.

## 5. The symbols: state and how they were made

Counts: 3,693 marks in 1,358 verses: الشاطبية 1,482 in 594 (of 1,079 verses after the introduction), طيبة النشر 2,092 in
679, الدرة 119 in 85. Unconfirmed places stay plain by design (owner's rule: never show the unchecked as fact).

`sharh_symbols.py`, in short:

- Reads each verse's explanation in الوافي (verses are numbered there) or الهادي (unnumbered: its quoted hemistichs are
  matched to the verses).
- Accepts a run of neighbouring words that can be symbols only when the readers they stand for are exactly a set the شرح
  names together for that verse, and the run ends where symbols end (before a separating و, at the end of a hemistich, or
  through a «بخلف»/strictly redundant tail).
- Also accepts a word the شرح cites by name («بالحاء من «حلا»»، «مدلول «عمّ»»، «المرموز لهم ب «كنز ثوى»»), and vetoes
  any other word in the verse taking a letter the شرح gives to a named word.
- Never symbols: readers named outright (incl. «كوف»، «شام»، «فتى العلا»), words starting with و or «ال», description
  words (letter names, الكسر، الهمز، مثقلا… with or without a pronoun or ب), «the rest» words, position words, «خلف»
  qualifiers, words cut across the hemistichs.
- A lone word needs more evidence: outside فرش the شرح must quote it or name its letter; never a word the شرح discusses as
  Quran.
- الدرة has no شرح in the library or the Shamela catalogue: its verses are read against الهادي's explanation of the طيبة
  verses that document the same Quran word (linked through `references.json`), narrowed to أبو جعفر، يعقوب، خلف العاشر,
  short symbol words only, and never a run that is exactly one reader's two narrators.

Quality: about 200 picks read by hand across nine samples while the rules were tightened; each error kind became a rule;
the last samples showed none. The second copy then agreed on all 1,119 places both mark in الشاطبية (same readers), found
five more error kinds on our side (fixed), and contributed 300 marks that pass every check. Its own errors (mid-word
marks, names, letter lists of الأصول, Quran words) were left out.

## 6. Verify

```bash
make data-test                                   # Python tests (8 suites)
swift test --package-path MushafCore             # 509 tests
xcodebuild -project Mutshabehat.xcodeproj -scheme Mutshabehat -derivedDataPath DerivedData \
  -destination "platform=iOS Simulator,name=iPhone 18 Pro Max" -collect-test-diagnostics never \
  -only-testing:MutshabehatTests test            # 360 tests
xcodebuild … -only-testing:MutshabehatUITests/MutoonUITests -only-testing:MutshabehatUITests/QiraatReferencesUITests \
  -only-testing:MutshabehatUITests/QiraatCardReviewUITests test
make release-guard && make check-isolation
```

All passed at `b0e2012f`. To check the real marks against the app's own rules, a throwaway Swift test that loads
`Generated/QiraatMutoon` with `MatnLibrary(directory:)` and calls `problem(in:)` on every mark is enough (expected:
3,693 of 3,693 kept). Delete it afterwards: it reads local data.

## 7. Gotchas learned

- iOS 26: the system `.searchable` hides toolbar items while active, so the page uses its own search field, placed above the
  list (not in a safe-area inset: swapping the list rebuilt the field and dropped the keyboard after one letter).
- A `fullScreenCover` does not inherit the reader's layout direction: the page sets `.rightToLeft` itself.
- SwiftUI `Text` links did not answer taps inside an RTL `List` (hit-rects off by a few points); `UITextView` with
  `primaryActionFor` works and keeps selection.
- `NumberFormatter` with locale `ar` gives Latin digits on current iOS: use `mutoonDigits`.
- An accessibility identifier on a non-combined container goes to every child; combine where a test counts rows.
- `XCUIApplication.isolated()` keeps UserDefaults between runs: a UI test that flips a switch must restore it, and must not
  pin it with a launch argument (an argument overrides the stored value, so the switch then appears not to work).
- Offsets: Python counts code points, Swift counts graphemes. Marks store grapheme offsets; a stray mark written before a
  word attaches to the space before it (as in Swift).
- `Localizable.xcstrings`: add keys with a writer that round-trips Xcode's layout exactly, or the whole file re-sorts.
- Python 3.9 raises `socket.timeout` (an `OSError`), not `TimeoutError`, on a read timeout.

## 8. Open items, in priority order

1. **Owner review.** Ask the owner to look through `review-symbols.html`; marks they confirm can move to
   `symbols-sample.json` with `method: hand`; marks they reject need a rule or an exclusion in `sharh_symbols.py`.
2. **الدرة coverage (119 marks).** No شرح of الدرة is in the library or Shamela's catalogue. With one (e.g. a شرح of الدرة in
   another source the owner can provide), add a splitter like `wafi_blocks` and run الدرة directly. The second copy's 123 الدرة
   marks look plausible but are unverified and were not added.
3. **Recall gaps** (all safe misses, none coloured wrongly): word symbols with a pronoun («صُحْبَتُهُ»), symbols joined to «و»
   («وَحَقُّ نَصِيرٍ»), runs whose readers the شرح splits across sentences, lone letters in الأصول the شرح does not quote.
   Any new rule needs a fresh hand-read sample (15–20 verses per متن) before it is trusted.
4. **Names.** Readers named outright («المكي»، «الشامي»، «كوف»، «حفص») are not coloured: they are not رموز. If the owner wants
   them marked, give them their own style, not the symbol red.
5. **Shipping.** The data exists only on this Mac; any other build shows the plain text. TestFlight is undecided (AGENTS.md §8).
6. **No automated test runs the matcher** (it needs local book text). Keep `sharh_symbols.py` and `second_copy.py` changes
   checked by sampling and by the app's `problem(in:)` pass.
