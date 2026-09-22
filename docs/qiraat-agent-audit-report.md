# Qira'at agent audit report

Date: 2026-09-22  
Branch: `feature/qiraat-annotation-engine-v2`  
Scope: read-only discovery and implementation validation; no Qira'at database mutation.

## Agent results

| Agent | Commit / status | Records added | Pages added | Result |
| --- | --- | ---: | ---: | --- |
| Usul inventory | `b2d4cdd` | 0 | 0 | Audited fixture pages 1–584, all 20 canonical categories, and 307 source-preserved action strings. Found 21 rulings with 36 omitted reader/rawi expansion events. |
| PostgreSQL reconciliation | `e03e79c` | 0 | 0 | Read-only comparison: 7,247 DB entries on pages 1–244 versus 12,763 unique fixture import keys on pages 1–584. Found 5,516 mapping gaps, 2 normalization mismatches, 62 association conflicts, and 25 duplicate fixture keys. |
| Frontend/context validation | `a4c55f2` (partial; agent hit usage limit) | 0 | 0 | Added corpus-wide frontend contract validation and made optional resolved annotations non-blocking. Validator passes 584 pages, 2,889 variants, 9,899 rulings, and 2,601 contextual spans. |
| Root reviewer | `8522cff` | 0 | 0 | Fixed cross-ayah contextual marker evaluation; page 1 browser smoke showed visible Usul markers with zero page/console errors. |

No agent inserted, updated, or deleted a Qira'at row. No page was added to the database.

## Deterministic inventory

- Fixture pages: 584 of 604; pages 585–604 are explicit warnings because fixture files are absent.
- Fixture records: 2,889 variants and 9,899 Usul rulings (12,788 total).
- Distinct canonical Usul categories: 20; unknown categories, labels, authorities, reading IDs, blank actions, and unlinked words: 0.
- Contextual/multi-token rulings: 2,601.
- Frontend checks: 38,512 variant-reader, 73,326 ruling-reader, 5,232 contextual endpoint, and 1,290 multi-rule token checks; all passed.

## Association review queue

- Q04: six rulings on pages 226, 228, 242, 244, and 334 name Q04 but only Q04-R01 is present in source `readings`.
- Q10: fifteen rulings on pages 319–322 name Q10 but omit both configured narrators.
- PostgreSQL reconciliation reports 62 reader/rawi association conflicts on pages 19, 20, 43, 44, 226, 228–239, and 241–244.
- Twenty-five non-identical fixture rows share an importer key, all on pages 327 and later.

These are `DATA_EXISTS_WRONG_ASSOCIATION`, `DATA_CONFLICT`, or `DATA_DUPLICATE`, not `DATA_GENUINELY_MISSING`; they remain unchanged pending authoritative source review.

## Validation

- `npm run qiraat:frontend:validate` — PASS.
- `npm run test:qiraat` — PASS (40 tests, including data and frontend validation).
- `npm run typecheck` — PASS.
- `python3 -m py_compile scripts/qiraat/audit_postgres_reconciliation.py` — PASS.
- `npm run qiraat:audit` — expected non-zero status because it surfaces 36 attribution expansion failures and 37 source-detail differences; no unknown-rule failure.
- PostgreSQL preflight against `mutshabehat-db:5433` — read-only; 7,247 entries, 244 pages, 0 database-only rows, 64 conflicts.

## Reviewer conclusion

All recognized fixture rules have working normalization, reader/rawi filtering, contextual endpoint handling, and frontend marker coverage. The remaining work is not a safe blind import: it requires authoritative source review for the 36 omitted attributions, 62 association conflicts, 25 duplicate keys, and absent pages 585–604. Production data was not mutated and no deployment was performed from this incomplete review state.

