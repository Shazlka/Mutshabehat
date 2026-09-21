# Phase 6 — Scope Selection, Indicators, and Review

The Mushaf Qiraat layer keeps canonical rendering separate from annotation scope. In Edit Mode, the desktop Qiraat rail exposes `تحديد نطاق` and `تحديد حد فاصل`; the user selects two semantic Mushaf words and the editor receives their canonical `{surah, ayah, word_position}` keys. The editor persists the selected `RANGE` or `BOUNDARY` anchors through the existing validated annotation write path. Cross-ayah selection uses the same semantic ordering and is not based on DOM positions.

The existing Qiraat renderer continues to use the page-level fixture/cache read path for ordinary reading display. Its compact marker and review-ring indicators do not replace or mutate Quran text. The page review controls track pending/confirmed/rejected imported locations and remain local review metadata until a verified source-backed annotation is entered.

Manual annotations are loaded in one page-level request from `/api/mushaf-1441/qiraat-resolved?page=N`, backed by `resolved_qiraat_cache`; the word renderer uses the returned canonical key, face count, and resolved colour for a compact indicator. The request is deduplicated per page and is invalidated after editor mutations.

## Verification

- Playwright desktop smoke: Qiraat layer → تحديد نطاق → two semantic words → editor opens with the selected start/end keys; zero page or console errors.
- Mobile smoke: Qiraat editor remains a bottom sheet with RTL controls and no horizontal overflow.
- `npm run test:qiraat`, `npm run mushaf:validate`, Node 22 typecheck, and `git diff --check` pass.
