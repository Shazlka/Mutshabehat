# 04 — Qiraat Rendering Engine

`packages/qiraat-core/engine.ts`. Deterministic and token-anchored — never a text search
(Part 5/7).

## Core function

```ts
resolveTokenForReading(variants, surah, ayah, token, hafsText, readingId, options?): TokenResolution
```

```ts
type TokenResolution =
  | { kind: 'base'; text: string }
  | { kind: 'variant'; text: string; variant: QiraatVariant }
  | { kind: 'suppressed'; variant: QiraatVariant }   // MERGE/SPLIT tail token, shown at the span's start instead
```

`renderToken(baseToken, selectedReading, variants, options?)` is the same function taking a
`{ surah, ayah, wordIndexInAyah, text }` token object, matching the spec's
`renderToken(baseToken, selectedReading)` signature literally.

## Query priority (Part 37) — implemented exactly as specified

1. `readingId === BASE_READING` → always the Hafs text, full stop. No variant lookup even runs —
   this is checked first in `resolveTokenForReading`, so a malformed record that lists the
   baseline in its `readingIds` (see the `syn-baseline-immunity` test fixture) can never affect
   Hafs rendering.
2. Otherwise, filter candidates to this exact token (`variantsForToken`) **and** this exact
   `readingId` in the variant's `readingIds`, **and** `verificationStatus` public
   (`VERIFIED`/`PUBLISHED`) unless `options.includeUnpublished` (the debug flag, Part 38).
3. No match → the Hafs text. **Never** a best guess, and never falling back from one narrator to
   their reader's sibling (e.g. Warsh's variant never applies to Qalun even though they share a
   reader) — `engine.test.mjs`'s "query priority" test asserts this directly.

## Operations (Part 6)

`applyOperation(operation, hafsText, variantText)`:

| Operation | Result |
|---|---|
| `KEEP` | `hafsText` unchanged |
| `REPLACE`, `DIACRITIC_CHANGE`, `ORTHOGRAPHIC_CHANGE` | `variantText` |
| `INSERT` | `hafsText + ' ' + variantText` (appended at the anchor token) |
| `DELETE` | `''` (the word disappears in that Riwayah) |
| `MERGE` | `variantText` at `startToken`; every token in `(startToken, endToken]` resolves `kind: 'suppressed'` (already shown at the span's start) |
| `SPLIT` | `variantText` (expected to contain the full multi-word replacement, e.g. `"SYN-PART1 SYN-PART2"`) at `startToken`; any further covered tokens suppressed the same way |

**Known simplification** (documented per Part 43's "known limitations" requirement, not hidden):
this is a *token-granular* engine — one DOM word slot per canonical token. `INSERT` cannot give an
inserted word its own independently-tappable DOM node (it's appended as text into the anchor
token's slot), and `SPLIT` cannot turn one Mushaf word slot into two independently laid-out words.
Both render correctly as *text*, but lose per-sub-word tap targets. None of the page-1 prototype's
real variants need `INSERT`/`SPLIT` (only `REPLACE`, confirmed working end-to-end); the operations
are proven by the `engine.test.mjs` synthetic fixtures. A full-Quran rollout that needs true
multi-node `INSERT`/`SPLIT` should upgrade to a token model with a variable number of DOM word
slots per Mushaf line — see `09-full-rollout-plan.md`.

## Glyph vs. flowing text (Part 21)

The base Mushaf renders via a page-specific QCF v2 glyph font pre-composed for Hafs's exact text
and line layout (`00-existing-architecture.md`). A Riwayah substitution can't reuse that glyph —
there is no Warsh glyph, and a different word length would misalign the font's pre-baked ligatures
and spacing anyway. The engine's output is plain text either way; the *viewer* (not the engine)
decides, per word, whether to draw the QCF glyph (`word.glyph`, only when the resolution is
`kind: 'base'`) or fall back to flowing Amiri Quran Unicode text (whenever a variant applies) —
reusing the exact fallback path the app already has for "this page's font hasn't loaded yet."
Trade-off: an affected word may render at a very slightly different visual weight/spacing than its
QCF neighbours on the same line; a differently-spelled/longer word can also shift the remainder of
that line. This is the "safe line-level reflow when unavoidable" Part 21 explicitly allows, and it
never changes the Mushaf-1441 page/ayah boundaries themselves — only the flow of words on the
existing line.

## Comparison-mode marker resolution

`variantsForToken(variants, surah, ayah, token, options)` — used directly by comparison mode: all
variants (public-only unless debug) touching a token, regardless of which reading is "selected"
(there is no selected reading in comparison mode — Hafs is always the displayed text, Part 3).
`differsFromHafs(resolution, hafsText)` is the single check both comparison-adjacent logic and
Riwayah-mode's "show difference from Hafs" toggle (Part 18) share.

## Performance (Part 24/33)

No per-word network request. One `GET /api/mushaf-1441/qiraat?page=N` (cached
`s-maxage=604800`) returns every variant for a page; the viewer resolves every word against that
already-in-memory array. Switching Riwayah or toggling comparison/study mode touches zero network
— it's a local state change that flows through the existing `MushafPageSlot` memo-comparator prop
(`qiraat`, see `05-ui-ux.md`/`00-existing-architecture.md`'s performance section), which is exactly
how the existing 1 ms page-turn optimization works.
