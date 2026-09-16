# Qiraat Core

Framework-agnostic domain package for the Qiraat Ashr (ten canonical Quran readings) system. Depends on
nothing from `src/` or from `packages/quran-data`/`packages/mutshabehat-core` — the Mushaf viewer imports
this package, never the other way around.

See `docs/qiraat/` at the repo root for the full design (domain model, color system, database schema,
rendering engine, UI/UX, verification workflow, the page-1 prototype and its test results, and the plan
for a full-Quran rollout).

## What's here

| File | Purpose |
|---|---|
| `types.ts` | IDs (`ReaderId`, `NarratorId`, `ReadingId`), `QiraatVariant`, operations, difference types, the `EXTRACTED → MAPPED → REVIEWED → VERIFIED → PUBLISHED` verification lifecycle, the `BASE_READING` constant (Hafs, `Q05-R02`) |
| `readers.ts` | The 10 canonical readers, fixed IDs and colors |
| `narrators.ts` | The 20 canonical narrators, fixed IDs and colors — **`Q03-R01` and `Q07-R02` are both named "الدوري" and are unrelated people; never identify either by the bare name** |
| `readings.ts` | The 20 Riwayat (reader+narrator), derived from `narrators.ts` so they can never drift apart |
| `colors.ts` | Single source of truth for reader/narrator hex colors and their `globals.css` custom-property names |
| `attribution.ts` | "Who reads this variant" → marker color/shape (single narrator / whole reader / segmented multi-reader) |
| `engine.ts` | The deterministic, token-anchored rendering engine: `renderToken`, `resolveTokenForReading`, verification-status filtering |
| `repository.ts` | Data-access abstraction (`QiraatRepository`) + the prototype's fixture-backed implementation |
| `qiraatAdapter.ts` | Thin `ayahKey` query helper over an already-loaded variant list |
| `fixtures/pages/page-001.json` | The page-1 (Al-Fatihah) prototype variants — real, cited classical Qiraat differences, **not** synthetic |
| `fixtures/synthetic/*.json` | Clearly-labeled invented data used only by unit tests, to exercise operations/cases the page-1 prototype doesn't happen to contain (never rendered in the app UI) |

## Real data policy

No fabricated Quran reading may enter this package as if it were real. Every `QiraatVariant` in
`fixtures/pages/` carries a `verificationStatus` and (for anything status `VERIFIED`/`PUBLISHED`) a
`sources` entry naming the classical reference it comes from. Anything not yet at that bar
(`EXTRACTED`/`MAPPED`/`REVIEWED`) never reaches an ordinary user — see `engine.ts`'s
`PUBLIC_VERIFICATION_STATUSES` filter and `docs/qiraat/06-verification-workflow.md`. Files under
`fixtures/synthetic/` are marked `"source": "SYNTHETIC — ..."`, exactly like the empty fixture this
package originally shipped with, and are wired only into `packages/qiraat-core/*.test.mjs`, never into
`repository.ts`'s page loaders.

## Run validation

```bash
npm run test:qiraat
# equivalent to:
node packages/qiraat-core/validate.mjs
tsx --test packages/qiraat-core/engine.test.mjs
```
