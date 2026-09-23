# Phase 3 data migration: implementation spec

Status: approved design (Gate 2 + Phase 3 questions answered 2026-09-23). Read `docs/qiraat/QIRAAT_AUDIT.md` §9–§10 and `docs/qiraat/SCHEMA.md` first.

**Hard rules**
- Nothing in this phase may write to the live DB. The generator reads the live DB **read-only** (`PGOPTIONS='-c default_transaction_read_only=on'`) and writes a SQL file. The SQL is applied later, after Amr approves it, by a human-run `psql --single-transaction`.
- `quran_words` is read-only. Never retype Quranic text. Every Hafs/base text comes from the fixtures (`hafsText` / `baseText`) or `quran_words`.
- No credentials in code. DSN comes from `QIRAAT_DB_DSN` (or libpq `PG*` env vars).
- Reuse `scripts/qiraat/import_to_postgres.py` helpers (`consolidate_duplicate_variant_faces`, `disambiguated_variant_id`, `load_reconcile_keys`, `load_fixture_page_specs`, `DIFF_INV`, `CATEGORY_INV`) and `scripts/qiraat/tokens.py` (`norm`). Do not duplicate them.
- Fixtures are never modified.

## 1. Inputs
1. Fixtures: `packages/qiraat-core/fixtures/pages/page-NNN.json` (variants) and `.../rulings/page-NNN.json` (rulings), pages 1–604. Some `startToken`/`endToken`/`ayah` values are strings: coerce them to int.
2. Live DB snapshot (read-only): `qiraat_pages`, `qiraat_loci`, `qiraat_entries`, `qiraat_variant_details`, `qiraat_ruling_details`, `qiraat_entry_authorities`, `qiraat_evidence_texts`, `qiraat_evidence_links`, `qiraat_source_documents`, `qiraat_categories`.
3. `docs/qiraat-reader-dedupe-audit.json` → `conflicts[]` (82 documented reader conflicts; each has `page` and `duplicate` fixture record, possibly `existing`).

## 2. Decisions (do not change)
| # | Decision |
|---|---|
| Q2 | Fixtures are the source of truth. DB entries with no fixture counterpart (≈88, all variants; exclude `REJECTED`) are kept and set `review_status='flagged'`, `legacy_ref='db-only:<entry id>'`. |
| Q4/D8 | Hafs = `Q05-R02`. See §4. |
| Q6 | The 829 fixture variants with `locusType == 'performance_variant'` are classified to an أصول category from `performanceNote`/`description` (§5). Ambiguous → stay فرش (`kind='variant'`) and flagged. |
| Q8 | Fixture `NEEDS_MANUAL_REVIEW` → flagged. The 82 documented conflicts → flagged. Same narrator twice at a location → flagged. |
| P3-1 | **Merge per span.** One live `qiraat_loci` row per exact span `(surah, ayah, startToken, endAyah, endToken)` where `endAyah = record.endAyah or (ayah+1 if endToken < startToken else ayah)`. Canonical locus id = the lexicographically smallest **existing live** locus id on that span; if none exists, `loc-SSS-AAA-WWW-AAA-WWW` (zero-padded surah, ayah, startToken, endAyah, endToken). Other loci on the span are soft-deleted (`deleted_at = now()`) after their entries and evidence links are re-pointed. Canonical `legacy_ref` = the sorted, `;`-joined old locus ids + fixture `locusId`s that merged into it. |
| P3-2 | **Narrator-level attribution.** `qiraat_entry_authorities` for a fixture entry = the resolved narrator list: variants from `readingIds` (`action_ar` NULL, `is_default = id not in alternateOf`); rulings from `readings[]` (`action_ar = action or NULL`, `is_default = isDefault` (default true), `condition_ar = attribution.condition or record.condition`). Reader-level rows (`Q01`…`Q10`) already in the DB are soft-deleted. Rulings whose expanded `attribution` narrator set ≠ `readings` narrator set (54) → flagged. |
| P3-3 | **Update in place.** Existing entries keep their ids; content is overwritten from the fixture only where it differs (`IS DISTINCT FROM`), so edit_log records exactly the changed fields. |
| P3-4 | **edit_log on.** Do not set `app.edit_log='off'`. Set `SET LOCAL app.device_id = 'phase3-migration'`. |

## 3. Entry identity and mapping
- Variant entry id: `f"{id}-a{ayah}-t{startToken}"` after `consolidate_duplicate_variant_faces` per page; if that key is reused by more than one fixture face (`load_reconcile_keys`) use `disambiguated_variant_id`. Ruling entry id: fixture `id`.
- If the id exists in the DB → update in place. Otherwise → insert. DB entries matched by no fixture → db-only (flagged, content untouched).
- `wajh_order = 1 if is_default else 2`. `wajh_note` NULL, except where Hafs is a further wajh (then the fixture `description`/`performanceNote`/`action`).
- `kind`: `variant` for فرش; `ruling` for rulings and for performance variants classified in §5. When an existing DB variant becomes a ruling: update `kind`, insert `qiraat_ruling_details`, **delete** its `qiraat_variant_details` row (logged, undoable).
- `verification_status` = fixture `verificationStatus`. `review_status` = `flagged` if any flag reason (§6), else `unreviewed`.
- `legacy_ref` = `pages/page-NNN.json#<id>` or `rulings/page-NNN.json#<id>`.
- `notes` = fixture `notes` (rulings: `notes` + `note` joined by `؛ ` when both exist).
- Details (variants): `reading_text=variantText`, `reading_text_normalized=norm(variantText)`, `uthmani_text=uthmaniText or variantText`, `description_ar=description`, `variant_type=DIFF_INV.get(differenceType,'other')`, `is_baseline_reading=false`, `performance_note`.
- Details (rulings): `category_code = CATEGORY_INV.get(category, category)` plus `NAQL → USUL_NAQL`; must exist in `qiraat_categories`, else flag and keep the raw code in the flag. `text_ar=text`, `options` as list (wrap scalar). Keep existing `rule_id`.
- Classified performance variants (§5): `category_code` = the inferred code, `text_ar = performanceNote or description`, each narrator's `action_ar = performanceNote or description`.
- `entry_order`: unique per `(locus_id, kind)` after merging. Renumber 1..n within each (canonical locus, kind) ordered by (fixture `wajhIndex` or existing order, id). Use a two-step update (first `entry_order + 10000`, then final) to avoid transient unique violations, and only touch rows whose order actually changes.
- `page_id`: the `qiraat_pages` row for the fixture's Mushaf page (smallest id when several). Create missing pages 585–604 exactly as `import_to_postgres.py` does (`SRC-MUSHAF-10`, `source_page_number = 10000 + page`, ayah range from `load_fixture_page_specs`).
- Count schools: AYAH_COUNT rulings keep/insert `qiraat_entry_count_schools` from `countSchools`.

## 4. D8 (Hafs baseline)
For every fixture variant whose narrators include `Q05-R02`:
- **Drop** it when all of these hold: (a) `norm(variantText) == norm(hafsText)`; (b) at the same span there is at least one other fixture variant (after consolidation) that does not include Hafs; (c) this record's narrators ∪ the other variants' narrators at the span = all 20 narrators, with no narrator in two of them. Existing DB entry → soft-delete (`deleted_at`). Fixture-only → not inserted. Every drop is listed in the report with span, text, narrators and reason.
- Otherwise **flag** it and keep Hafs as stored (mixed / Hafs-positive rows; Q4).
- Every fixture ruling whose readings include `Q05-R02` → flagged, kept.
- Flagged rows are exempt from the D8 trigger. **Non-flagged rows must never list Hafs with `wajh_order = 1`.**

## 5. Q6 classifier (performance variants, `locusType == 'performance_variant'`)
Pure function `classify_performance(record) -> (category_code | None, rule_name)`, over `text = performanceNote + ' ' + description` with diacritics stripped. Apply rules in order; if **more than one** category matches, return None (ambiguous). No match → None.
| Rule | Pattern (on text) | Extra condition | Category |
|---|---|---|---|
| yaa_idafa | `(فتح|فتحها|إسكان|أسكن|سكون|بإسكان|بفتح)` … `الياء` | Hafs word (last word of `hafsText`, diacritics and waqf marks stripped) ends in `ي`/`ى` | `YAAT_IDAFA` |
| yaa_zawaid | `(إثبات|بإثبات|حذف|بحذف) الياء` | — | `YAAT_ZAWAID` |
| hamzatan | `الهمزتين|الهمزة الثانية|بين الهمزتين` | — | `HAMZATAN_KALIMA` if span is one word, else `HAMZATAN_KALIMATAYN` |
| hamz | `(إبدال|بإبدال|تسهيل|بتسهيل|تحقيق) الهمز` | not hamzatan | `TAGHYIR_HAMZ` |
| naql | `نقل` | — | `USUL_NAQL` |
| sakt | `سكت|بالسكت` | — | `USUL_SAKT` |
| imalah | `إمال|تقليل|بين اللفظين|بين بين` | — | `IMALAH_TAQLIL` |
| silah | `صلة الهاء|بصلة الهاء|قصر الهاء|بقصر الهاء` | — | `SILAT_HA` |
| mim_jam | `ميم الجمع|صلة الميم|بصلة الميم` | — | `USUL_MIM_JAM` |
| tarqiq | `ترقيق الراء` | — | `TARQIQ_RA` |
| taghliz | `تغليظ اللام` | — | `TAGHLIZ_LAM` |
| ghunna | `ترك الغنة|بلا غنة|بغير غنة` | — | `TARK_GHUNNA` |
Everything else (إشمام, روم, اختلاس, إدغام without a qualifier, مد/قصر without البدل/اللين, حركات الفرش, …) → None → stays فرش, flagged with reason `Q6_AMBIGUOUS`.

## 6. Flag reasons (write one `qiraat_qa_flags` row per reason)
`qiraat_qa_flags(page_id, locus_id, entry_id, severity='warning', flag_type=<code>, issue_ar=<Arabic sentence>, original_text=<short context>, status='open')`. Codes: `D8_HAFS_KEPT`, `NEEDS_MANUAL_REVIEW`, `DOCUMENTED_CONFLICT`, `ATTRIBUTION_MISMATCH`, `NARRATOR_TWICE`, `Q6_AMBIGUOUS`, `DB_ONLY`, `UNKNOWN_CATEGORY`. Idempotency: before inserting, delete open flags whose `flag_type` is one of these codes and whose `issue_ar` starts with `[phase3]`, then insert fresh ones (prefix every `issue_ar` with `[phase3] `).
`NARRATOR_TWICE`: after everything else is computed, for non-flagged live entries group by (canonical locus, kind, category_code) and narrator with `wajh_order = 1`; every entry in a group with count > 1 is flagged.

## 7. Loci and evidence
- Evidence: never delete a shahid. Re-point links from merged-away loci to the canonical locus; if the canonical already has the same `(evidence_text_id, page_id)`, delete the duplicate link (logged). Insert missing evidence from fixture `evidence[]` (texts upserted by `(source_document_id, text_normalized)`, creating missing `qiraat_source_documents` rows exactly as `import_to_postgres.py --reconcile` does).
- A canonical locus with no live entry → soft-delete it. Loci whose only entries are `REJECTED` → soft-delete them.
- Loci `base_text` = fixture `hafsText`/`baseText` of the first record on the span; `mapping_status='verified'`; `location_order` = position of the span on the page, ordered by (ayah, startToken).

## 8. Output SQL (`--out <file.sql>`, not committed; it is large)
Set-based, readable, deterministic (sorted), applied with `psql -v ON_ERROR_STOP=1 --single-transaction`:
1. Header comment: generator commit, fixture sha256 (hash over all fixture files), DB snapshot time, expected counts.
2. `SET LOCAL app.device_id = 'phase3-migration';`
3. Pre-assert DO block: `quran_words` count 77,429 and checksum `52839d155fd0f90f999822a43e8198f5`; entry count equals the snapshot count (abort if the DB changed since the snapshot).
4. `ALTER TABLE qiraat_entry_authorities DISABLE TRIGGER qiraat_entry_authorities_sync_trg;`
5. Stage the target state in TEMP tables filled with `INSERT … VALUES` (e.g. `p3_loci`, `p3_entries`, `p3_variant_details`, `p3_ruling_details`, `p3_authorities`, `p3_evidence`, `p3_flags`, `p3_drops`).
6. Set-based `INSERT … ON CONFLICT` / `UPDATE … FROM p3_* WHERE … IS DISTINCT FROM …` / soft-delete statements, in FK order: pages → loci (insert canonical) → entries (insert/update, including re-pointing `locus_id`) → details → authorities → count schools → evidence → soft-delete merged loci → flags.
7. Rebuild readings: `SELECT count(qiraat_rebuild_locus_readings(id)) FROM qiraat_loci WHERE id IN (touched canonical loci);` then re-enable the sync trigger.
8. `SET CONSTRAINTS ALL IMMEDIATE;` (fires the Phase 2 rule checks now).
9. Post-assert DO block: checksum unchanged; `qiraat_qa_phase2_violations` has **0 rows for non-flagged entries/loci**; live entry counts by kind match the plan; no live non-flagged entry lists `Q05-R02` with `wajh_order = 1`. Any mismatch → `RAISE EXCEPTION` (the whole transaction rolls back).

## 9. Report
`--report-json artifacts/qiraat-phase3-migration-report.json` and `--report-md docs/qiraat/PHASE3_MIGRATION_REPORT.md`, with counts (inserted/updated/unchanged/soft-deleted per table, loci merged, entries converted فرش→أصول by category, drops with the full list, flags by code with the full list, db-only list) and the sha256 of the SQL file.

## 10. Code layout and tests
- `scripts/qiraat/phase3/plan.py`: **pure** functions, no DB and no I/O: classify, D8 test, span merge, flag computation, diff (desired vs snapshot). Input = plain dicts.
- `scripts/qiraat/phase3/snapshot.py`: read-only DB loader → plain dicts.
- `scripts/qiraat/phase3/emit_sql.py`: plan → SQL text (proper literal quoting; use `psycopg2.extensions.adapt` or a tested quoting helper; Arabic text must round-trip exactly).
- `scripts/qiraat/phase3/__main__.py`: CLI (`python3 -m scripts.qiraat.phase3 --out … --report-json … --report-md …`, or an equivalent runnable path).
- `scripts/qiraat/phase3/test_plan.py`: stdlib `unittest`, no DB: classifier table cases, D8 drop/flag cases (partition complete, overlap, text differs), span merge + canonical id choice, entry_order renumbering, attribution mismatch, narrator-twice detection, SQL quoting round-trip of Arabic with quotes/backslashes.
- Also: in `scripts/qiraat/import_to_postgres.py` replace the hard-coded password with the DSN from `QIRAAT_DB_DSN`/libpq env vars (no default secret).
