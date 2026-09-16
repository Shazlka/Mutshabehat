# 02 — Color system

Single source of truth: `packages/qiraat-core/colors.ts` (`READER_COLOR`, `NARRATOR_COLOR`,
`readerCssVar`, `narratorCssVar`). `src/app/globals.css` mirrors the same 30 hex values as
`--q01-*` … `--q10-*` custom properties, in a dedicated `:root` block kept out of the Tailwind
`@theme` block (that block generates static utility classes; Qiraat colors are picked dynamically
by reader/narrator ID at render time, via inline `style`, not by class name). If the two ever
drift, `packages/qiraat-core/validate.mjs` catches the TypeScript side; there is no automated CSS↔TS
diff (see `09-full-rollout-plan.md` for a suggested follow-up: generate the CSS block from
`colors.ts` at build time instead of hand-mirroring it).

## Rule (Part 10/12): color = identity, never difference type

A marker's color answers **"who reads this?"**, never **"what kind of difference is this?"**.
Difference type (`DifferenceType`) is shown as Arabic text/label only
(`DIFFERENCE_TYPE_LABELS_AR`), never as a second color channel. This keeps the total color
vocabulary at 30 (reader+narrator) instead of exploding to 30 × 13 (× difference type).

## Case A — one narrator (Part 10)

Only one of a reader's two narrators applies → narrator color (e.g. Warsh alone → `#1D4ED8`, not
Nafi's `#2563EB`). `computeAttribution(readingIds)` returns `{ kind: 'single-narrator', color }`.

## Case B — both narrators of one reader

Both narrators of the same reader apply → the parent reader's color (e.g. both Khalaf and Khallad
'an Hamzah → Hamzah's `#DC2626`), read as "this is a reading of Hamzah, transmitted either way."
`computeAttribution` returns `{ kind: 'reader', color }`. The page-1 prototype's REVIEWED سين/صاد
variants are a real example of this case.

## Case C — more than one reader (Part 10/11)

Never one underline per reader. `computeAttribution` returns one segmented marker:
`{ kind: 'multi-reader', segments: [{ readerId, color, percentFrom, percentTo }, …] }`, one equal
slice per **reader** (never per narrator/reading — narrators of the same reader inside a
multi-reader group don't get their own slice, matching Part 10's 3-reader example). `gradientCss()`
turns that into one `linear-gradient(to right, …)` CSS string. The page-1 prototype's مالك/ملك
variant is a real 8-segment example (`Q01, Q02, Q03, Q04, Q06, Q08, Q09, Q10`). Segments are
ordered by `QIRAAT_READERS`' fixed `sortOrder`, so the same set of readers always draws the same
gradient regardless of the order their variant rows happen to list `readingIds` in.

At the extreme (Part 11, up to 9 readers sharing a variant, all but Hafs's own reader/Kisai), the
marker stays one compact bar — tapping it opens the full attribution list in the bottom sheet
(`06-verification-workflow.md`/`05-ui-ux.md`), never 9 stacked lines under the word.

## Rendering the marker (implementation, not spec)

`src/app/mushaf-1441/_components/qiraat/qiraatWordMarker.ts` turns an `Attribution` into a
`WordMarker { color, isGradient, variants }`; the Mushaf viewer draws it as a thin
`position: absolute` bar under the word (2px normal, 4px Study Mode — Part 19), using `color` as a
solid `background` or, for `multi-reader`, the gradient string directly (CSS gradients work fine
as a `background` value on a 100%-width, 2–4px-tall bar). Study Mode additionally tints the word's
background using `color-mix(in srgb, <color> 8%, transparent)` exactly as Part 19 specifies; a
segmented marker's tint falls back to a neutral warm gray (`#8a7c5c`) since `color-mix` needs one
color, not a gradient — documented as a known simplification, not a bug (`08-test-results.md`).

## Accessibility (Part 20)

Every marker is paired with a text label, never color alone: the word's `aria-label` appends
"قراءات مختلفة: <narrator names>" (`attributionLabelsAr`), and the tap-to-open detail panel always
prints the reader/narrator names next to their swatch (`QiraatLegend.tsx` renders a colored dot
*and* the Arabic name on every row, never a bare swatch).
