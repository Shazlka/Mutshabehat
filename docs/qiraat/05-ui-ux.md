# 05 — UI/UX

## Component map (Part 22), as actually built

```
Mushaf1441Viewer (existing, extended)
  ├── burger drawer ("القائمة")
  │     └── "القراءات" panel → QiraatToolbar (mode / reading / study mode / diff-toggle / filter / legend button / debug toggle)
  ├── QiraatLegend (bottom sheet / side panel, opened from the toolbar's "مفتاح القراءات" button)
  ├── per-word rendering (inside the existing renderQcfWord/renderLineWords) → qiraatWordMarker.ts (comparisonMarkerForWord / riwayahResolutionForWord)
  └── detail panel "قراءات" tab (existing placeholder tab, now filled in) → the Part 13 bottom-sheet content
```

`QiraatToolbar`/`QiraatLegend`/`qiraatWordMarker.ts` live in
`src/app/mushaf-1441/_components/qiraat/`, imported by the viewer. No existing component was
rewritten; the viewer gained new state, new closures reading that state, and new prop plumbing
(Part 41 rule 3: composition over rewriting stable components). The detail-panel "قراءات" tab and
its `activeDetailTab`/`qiraatVariantsForSelectedAyah` wiring already existed as an intentional,
literally-empty placeholder from an earlier session (see `00-existing-architecture.md`) — this is
where the new content was plugged in, not a new UI surface.

## Why the toolbar lives in the burger drawer, not a floating bar

The reader already has exactly one settings surface (the "القائمة" drawer: account, page/font
info, navigation sliders). A fourth floating control bar competing for the same cramped mobile
viewport as the page-turn taps, the wheel handler, and the existing top bar would directly conflict
with the reader's core interaction (Part 41 rule 4: avoid a giant bespoke UI when an existing
pattern fits). Mode/reading/study-mode are "set it and read," not "adjust every few seconds," so a
drawer panel is the right cost/frequency trade-off.

## The three modes, exactly as specified (Part 3)

- **المصحف (normal)** — the default. Qiraat code paths are short-circuited entirely
  (`qiraatView.mode === 'normal'` skips variant lookup for every word); the page is byte-for-byte
  what it was before this feature existed. Mutashabihat continues to work unmodified (Test A/J).
- **مقارنة القراءات (comparison)** — Hafs stays the displayed text; only tokens with a (filtered,
  public) variant get an underline marker. Tapping a marked word opens the "قراءات" detail tab.
- **القراءة برواية (riwayah)** — Part 16 is enforced by construction: the reading `<select>` is
  grouped by reader (`<optgroup>`) with only leaf Riwayah `<option>`s selectable — there is no way
  to "select a reader" without picking one of its two narrators, so the UI can never present an
  artificial combined "Nafi Mushaf" (Part 16's explicit prohibition).

## Layering with Mutashabihat (Part 27)

Mutashabihat keeps its existing visual language: a continuous highlighter-colored **background
band** across an ayah's words and the gaps between them (`renderWordGap`/`getWordBandColor`,
unchanged). Qiraat is a **border-style underline bar** drawn on the word itself, absolutely
positioned just under the glyph. The two occupy different visual layers (background vs. a thin bar
near the baseline) and different z-positions, so a mutashabihat-highlighted ayah with a
Qiraat-marked word inside it shows both at once without either being unreadable — verified visually
in `08-test-results.md`.

## Study Mode (Part 19)

Toggled from the toolbar (hidden in normal mode — nothing to "study" without markers on). Doubles
the marker's height (2px → 4px) and adds a background tint via `color-mix(in srgb, <color> 8%,
transparent)` behind the word glyph. Tashkeel stays legible because 8% is a very light tint against
the paper background — checked visually at both the marker's solid-color and (approximate,
neutral-tinted) segmented-marker cases.

## Bottom sheet (Part 13)

## Mandatory colouring pipeline for new pages

Qiraat colours are data-driven; do not hand-style a new page. A `QiraatVariant` in
`scripts/qiraat/data_variants.py` produces the established reader/narrator underline in comparison
mode and the existing tint in study mode. A reader-specific `QiraatRuling` in
`scripts/qiraat/data_rulings.py` produces the existing per-family word colour through
`rulingMarkerForWord`. `build_variants.py` and `build_rulings.py` must resolve every query to a
real Mushaf-1441 token, and both generated fixtures must be registered in the two loader maps in
`packages/qiraat-core/repository.ts`; the viewer loads these immutable chunks directly for each
mounted page/spread.

Keep the established meaning of colour: import reader-specific أصول, but do not create colour
noise for universal tajwid. Before handoff run both generators, `npm run qiraat:validate`, and a
repository runtime load with `includeUnpublished: true`; confirm that variants and rulings are
present for every populated page and render under the same Qiraat layer toggles as older pages.

The existing detail-panel "قراءات" tab, reachable either from the burger-menu-adjacent notes sheet
flow or directly by tapping a marked word (`selectWordForQiraat`, which selects the word exactly
like the existing `selectWord` and then forces the detail tab to `'qiraat'`). Content, per variant
touching the selected ayah: the Hafs text struck through next to the variant text, the readers/
narrators grouped by reader (matching the spec's "نافع / قالون · ورش" layout), how many of the
remaining 20 readings are unaffected (`readingsNotIn`), the Arabic difference-type label, source
name/reference, and verification status — with a "قيد المراجعة" chip on anything not yet
VERIFIED/PUBLISHED (only ever visible with the debug toggle on).

## Admin/debug view (Part 38)

A single checkbox in the toolbar ("عرض بيانات قيد المراجعة… لأغراض التطوير"), off by default,
labeled honestly as a development aid rather than hidden behind a gesture — this is a personal
single-user study tool (see `PROJECT_MASTER.md` §1), not a multi-tenant product needing a locked
admin role. Turning it on adds `&debug=1` to the page fetch and lets REVIEWED/MAPPED/EXTRACTED
records reach the client-side engine; the API route documents (and the DB migration's RLS policy,
once applied, would enforce) that this must go through a server-privileged path, never widen what
an ordinary anon-key request can see.
