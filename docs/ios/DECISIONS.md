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
2. Fetch **`.ttf`** (not `.woff2`) per page on first view, register with
   `CTFontManagerRegisterFontsForURL`, and cache the file permanently under
   `Application Support/`, excluded from iCloud backup
   (`isExcludedFromBackupKey = true`).
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

| Format | Avg/page | All 604 pages | iOS-loadable? |
|---|---:|---:|---|
| QCF **V2 `.woff2`** (what the web app uses) | ~152 KB | **~89 MB** | **No** |
| QCF **V2 `.ttf`** | ~348 KB | **~205 MB** | Yes |
| QCF V1 `.ttf` | ~137 KB | ~81 MB | Yes |
| QCF V1 `.woff2` | ~69 KB | ~40 MB | **No** |
| QCF V2 `.otf` | — | — | does not exist (404) |

Four facts decide it:

- **WOFF2 is not an option on iOS.** CoreText registers OTF/TTF/TTC/dfont only;
  WOFF2 decoding lives inside WebKit and is not exposed. Using the web app's
  89 MB of `.woff2` would mean embedding a WOFF2 decoder — a new dependency,
  and decoding the file is squarely what the licence calls "Decompile".
- **205 MB of TTF cannot go in the binary.** It dwarfs the rest of the app,
  crosses Apple's cellular-download warning threshold on its own, and forces
  every user to pay for 604 pages to read one.
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
- **Ship WOFF2 + an on-device decoder.** New dependency, and decoding is
  "Decompile" under the licence.

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
