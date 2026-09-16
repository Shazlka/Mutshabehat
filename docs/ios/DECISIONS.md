# Mutshabehat iOS — Decision Log

One entry per decision that constrains later phases. Each records what was
decided, the evidence behind it, and what it rules out.

---

## D-04 — `/network` graph deferred to v1.1
**Decided 2026-09-15.** Full rationale in `DISCOVERY.md` §7.

`/network` is live and nav-linked, not dead code, but it is a D3 force-directed
graph with no SwiftUI equivalent — native means a hand-rolled `Canvas` force
layout or a new SPM dependency. Neither blocks the reading/study core loop.
Revisit for v1.1.

---

## D-06 — QCF font strategy: fetch official TTF on demand, cache permanently, never bundle all 604
**Decided 2026-09-16.** Resolves the offline-first conflict flagged in
`DISCOVERY.md` §3.

### The decision

1. Ship **no** Mushaf page fonts in the app binary.
2. Fetch **`.ttf`** per page on first view, register with
   `CTFontManagerRegisterFontsForURL`, and cache the file permanently under
   `Application Support/`, excluded from iCloud backup
   (`isExcludedFromBackupKey = true`). `.woff2` is ~57% smaller and *does*
   work — see "WOFF2" below — but is not what v1 ships on.
3. Offer one explicit **"تحميل المصحف كاملاً"** action in settings that
   prefetches all 604 pages over Wi-Fi, with progress and a cancel.
4. **Never transcode, subset, re-compress or otherwise alter a font file.**
   Ship the vendor's bytes or none.
5. Source the files from the **official KFGQPC distribution**
   (`fonts.qurancomplex.gov.sa`), not by scraping the quran.foundation CDN —
   see "Provenance" below. Mirror them on infrastructure we control.

### Why — measured, not assumed

Sizes sampled directly from `verses.quran.foundation` on 2026-09-16
(41 pages sampled at stride 15 for woff2, 11 pages at stride 60 for the rest):

| Format | Avg/page | All 604 pages | CoreText-loadable? |
|---|---:|---:|---|
| QCF **V2 `.woff2`** (what the web app uses) | ~152 KB | **~89 MB** | yes, but undocumented — see below |
| QCF **V2 `.ttf`** | ~348 KB | **~205 MB** | yes, documented |
| QCF V1 `.ttf` | ~137 KB | ~81 MB | yes |
| QCF V1 `.woff2` | ~69 KB | ~40 MB | yes, same caveat |
| QCF V2 `.otf` | — | — | does not exist (404) |

Three facts decide it:

- **No format fits in the binary.** 205 MB of TTF dwarfs the rest of the app,
  crosses Apple's cellular-download warning threshold on its own, and forces
  every user to pay for 604 pages to read one. Even the 89 MB WOFF2 set is a
  bad trade for a feature the reader degrades gracefully without.
- **The licence forbids the obvious workaround.** Subsetting, converting
  WOFF2→TTF, or re-compressing to shrink the bundle are all "Modified,
  Altered, … Reproduced". Ruled out, not merely inadvisable.
- **The reader already degrades correctly.** Every word fixture carries
  `textUthmani` alongside its V2 `glyph`, and `Mushaf1441Viewer.tsx` renders
  the Unicode Uthmani fallback first and swaps to glyphs when the page font
  loads. So a page with no font downloaded is **readable, not broken** — the
  app is genuinely usable offline from first launch, and the download only
  upgrades fidelity to exact Madinah-mushaf glyph form. This is what makes
  on-demand acceptable against the plan's offline-first requirement rather
  than a violation of it.

The TTF endpoint serves **uncompressed** (`content-length` identical with and
without `Accept-Encoding: br, gzip` — 323 348 bytes for p50 either way), so
~348 KB/page is real wire cost, not just disk. Budget ~205 MB for a full
prefetch.

### WOFF2 — measured, available, deliberately unused

An earlier draft of this decision asserted that CoreText cannot register WOFF2
and that using it would require bundling a decoder. **That is wrong**, and the
correction matters because it changes which URL the fetcher hits and how much
bandwidth to budget.

Measured on 2026-09-16 (macOS 27, the same CoreText that ships on iOS), against
the real `p110` font and the real PUA codepoints from
`packages/quran-data/mushaf1441/fixtures/page-words/page-110.json`:

| | `.ttf` | `.woff2` |
|---|---|---|
| `CTFontManagerRegisterFontsForURL` | succeeds | **succeeds** |
| resolves by PostScript name `QCF2110` | yes | yes |
| U+FC41…U+FC43, U+FC50, U+FCA0 map to glyphs | 5/5 | **5/5** |
| advances | `[54, 88, 46, 136, 95]` | **identical** |

WOFF2 renders the correct glyphs with identical metrics. Harness kept at
`apps/ios/tools/fontcheck.swift` — re-run it against an iOS simulator once
Xcode is installed (IOS-10).

The same harness validates the rest of the pipeline end to end. For pages 1,
77, 200, 404, 500 and 604, taking the **first two and the last** word glyph of
each page straight from that page's fixture:

| Page | PostScript name | glyphs | probes drawable |
|---:|---|---:|---|
| 001 | `QCF2001` | 376 | 3/3 |
| 077 | `QCF2077` | 194 | 3/3 |
| 200 | `QCF2200` | 187 | 3/3 |
| 404 | `QCF2404` | 166 | 3/3 |
| 500 | `QCF2500` | 179 | 3/3 |
| 604 | `QCF2604` | 109 | 3/3 |

So the conventions the fetcher can rely on: the font for page *N* is at
`…/hafs/v2/ttf/p{N}.ttf` and registers under PostScript name
`QCF2` + zero-padded three-digit *N*; every page's PUA range starts at
**U+FC41**; and the fixture's `glyph` codepoints resolve to drawable glyphs
with non-zero advances in that page's own font. Resolve fonts by that
PostScript name — do not assume the family name matches.

It is still not what v1 ships on, for one reason: **CoreText's WOFF2 support is
undocumented, and App Store review has been rejecting apps containing WOFF2
files**, detected by inspecting file contents rather than extensions. Even
though this design downloads fonts at runtime rather than embedding them — so
the documented rejection trigger does not apply — betting the Mushaf reader,
the app's core feature, on undocumented behaviour that Apple's own reviewers
call unsupported is a bad trade for ~120 MB of one-time optional download.

Revisit only if full-prefetch bandwidth becomes a real complaint. The fallback
is cheap and already proven: same CDN, same filenames, different extension.

### Licence position

KFGQPC terms: permission granted **free of cost** to *Use, Copy, Distribute*;
the font software may **not** be *Sold, Modified, Altered, Translated, Reverse
Engineered, Decompiled, Disassembled or Reproduced*. KFGQPC retains title.
The V2 binaries themselves carry `OS/2 fsType = 8` (**Editable Embedding** —
the most permissive non-zero setting; embedding and temporary loading on other
systems are allowed).

Consequences we accept:
- **The app must be free.** Not sold, no paid tier gating the Mushaf. "cannot
  be Sold" is the binding constraint on an App Store release.
- **Files ship byte-identical.** Covered by rule 4 above.
- Attribute KFGQPC in an in-app credits screen.

### Provenance — the open item

The `.ttf` files on the quran.foundation CDN are **not** an official KFGQPC
release build. Read from `p1.ttf`'s `name` table:

```
Copyright (0):  Test Font, KFGQPC
Family    (1):  QCF2001
Version   (5):  KFGQPC TEST
Trademark (7):  Test Font, KFGQPC
achVendID:      HARF
```

No `LicenseDesc` (ID 13), no `LicenseURL` (ID 14), self-described as a **test
font**, vendor ID `HARF` — i.e. rebuilt by a third party rather than shipped
by the Complex. Fine for a personal web app; not what should go into an App
Store binary under someone else's copyright.

**Action before any public release (Phase 5, not now):** obtain the official
604-page QCF V2 set from `fonts.qurancomplex.gov.sa` (unreachable from this
network on 2026-09-16 — `ECONNREFUSED`), confirm the name table carries real
copyright/licence strings, and mirror those. If the official build's glyph
codepoints differ from the CDN build's, the `packages/quran-data/mushaf1441`
fixtures must be re-verified against it — they hard-code V2 PUA glyphs
(`"glyph": "ﱁ", "qcfVersion": "v2"`).

For a private/TestFlight build for one user, the CDN files are acceptable in
the interim.

### Rejected alternatives

- **Bundle all 604 TTF (205 MB).** Size; and it would still need the
  provenance fix.
- **Bundle QCF V1 instead (81 MB TTF).** V1 glyph codepoints differ from V2,
  and every one of the 604 page-word fixtures is keyed to V2 (`qcfVersion:
  "v2"`). Adopting V1 means re-importing the entire fixture set — a Phase 2
  data project to save bundle size we do not need to save.
- **Apple On-Demand Resources.** The right-shaped platform feature, but it
  requires the 205 MB in the build's asset catalog, adds tag lifecycle
  management, and has Apple redistribute a third-party font whose provenance
  is exactly the thing in question. A plain HTTPS fetch plus a cache directory
  is less machinery and keeps us in control of the source.
- **Ship WOFF2 instead of TTF** (89 MB rather than 205 MB). Technically works
  — verified above — but undocumented and an App Store review risk. See
  "WOFF2" above. Reconsider if bandwidth becomes a real complaint.

---

## D-07 — `mushaf_annotations` is IN for v1; nothing to apply
**Decided 2026-09-16.** Evidence in `DISCOVERY.md` §8.3.

Phase 0 recorded this table as never applied to production, because the
migration file's header says "preview/dev only". Live verification proves the
opposite: the table exists in production with 14 rows, two of them real
highlights written **2026-09-15**, all 19 columns matching the migration file,
every CHECK constraint enforced, RLS holding, and the whole feature wired
through `src/app/api/mushaf-1441/annotations/route.ts`.

There is no migration to apply and no defer-vs-keep trade-off. Bookmarks,
notes and highlights stay in the v1 cut, and Phase 3 sync design should treat
`mushaf_annotations` as a first-class user table alongside `groups` / `verses`
/ `parts`.

Follow-up (documentation only, no schema change): correct the stale
"preview/dev branch" header in
`supabase/migrations/20260628000000_mushaf_annotations_preview.sql`. That
header is what caused the misclassification.
