# Full import and review of the Qiraat database (phases, owners, gates)

Owner goal (2026-10-14, `/goal`): import everything the sources hold into the database (nquran.com + all per-reader
CSV/JSON books), give every entry its full Arabic explanation, a category and a sub-category, approve automatically
what independent sources confirm («معتمد آليًا»), and queue the rest. **No wrong entry may be written.**
Branch: `feat/qiraat-auto-review` (web) and `ios/qiraat-ux` (iOS). Never push to `main`.

## Standing rules (every phase)
1. Sources only: nothing is written from memory. Every text/narrator written has a provenance (book file + row, or nquran ayah).
2. Never change an entry approved by a human (`review_status='reviewed'` and `review_source IS NULL`, device not `bulk-*`).
   Bulk nquran imports of 6 Oct (`device_id like 'bulk-%'`) are reviewed data too: additive explanation only.
3. Additive text: never overwrite a non-empty `description_ar` / `text_ar` / action text. Append only a sentence that is not already contained (compare after removing harakat/tatweel).
4. Hafs/D8 and the other database rules stay valid; the violation count (`qiraat_qa_phase2_violations`, 679 today, pre-existing) must not grow.
5. Every database write: fresh `pg_dump -Fc` first, rehearsal on the restored scratch Postgres 16, `--single-transaction -v ON_ERROR_STOP=1`, `device_id='auto-review'`, then a read-back check. Batches of at most 50 pages.
6. Gate script `scripts/qiraat/gate.sh` (phase 0) must pass before and after each write: entry counts per status, `quran_words` checksum, violation count, human approvals unchanged, no entry without category/sub-category.
7. Delegation order when a quota ends: Codex (`-m gpt-5.6-sol`, never astra or sol 6.x) → Agy (`gemini-3.8-flash-high`) → Claude. The orchestrator (Claude) reviews every diff, runs every test and every SQL itself. Agents never run SQL on a real database.

## Data facts (measured 2026-10-14 on the 13 Oct dump + our approvals)
34,446 live entries (3,836 farsh, 30,610 usul). Farsh: 3,811 already have `description_ar`. Usul: 1,022 have `text_ar`, 30,497 have a per-narrator action text.
Books: 34,475 records, 13 books, all 19 non-Hafs narrators. nquran: all 114 surahs, ~33,600 differences.

## Phases
| # | Phase | Owner | Output | Gate |
|---|---|---|---|---|
| 0 | Foundation: gate script, fresh scratch DB, tracker | Claude | `gate.sh`, `artifacts/` exports | gate passes on live |
| 1 | Gap analysis: every book record and nquran difference vs the database: matched / missing / conflicting | Codex | `scripts/qiraat/import-gap-analysis.ts`, `artifacts/gaps-*.json`, report | Claude spot-checks 40 random rows per class against the CSV |
| 2 | Explanation composer: full Arabic explanation per entry from books + nquran, with provenance | Codex | `scripts/qiraat/explanations.ts`, SQL generator, tests | zero overwrites, zero text without provenance, idempotent |
| 3 | Category + sub-category completion for every entry | Codex | generator + report | every entry has both; no non-`other` value overwritten |
| 4 | Import missing entries (only high-confidence classes from phase 1) | Codex writes generator, Claude validates | SQL + rollback | scratch rehearsal, violations unchanged, each new row has 2 sources or an aligned book row + nquran silence rule |
| 5 | Approval roll-out in 50-page batches (tiers A1/A2) and export of the human queue (B, C, A-S2) | Claude | batches applied, `AUTO_REVIEW_QUEUE.md` | per-batch gate |
| 6 | Show it: editor badge «معتمد آليًا» + filter, export field, iOS details/refresh, data sync to iCloud, install on the iPhone | Agy (code), Claude (verify) | PRs on branches | tests + screenshots |
| 7 | Final verification and report | Claude | report, changelog entries | all gates green |

## Delegation costs
Codex runs at medium reasoning (`-c model_reasoning_effort=medium`) on files only (its sandbox cannot reach the database socket). Agy uses `gemini-3.8-flash-high` and edits files only. Claude runs databases, builds and tests.
