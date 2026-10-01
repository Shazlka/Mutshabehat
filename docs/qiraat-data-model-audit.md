# Qira'at data-model audit

Audited 2026-09-22. This is a read-only baseline. No production Qira'at row was
inserted, updated, or deleted.

## Serving architecture

The Mushaf reader is fixture-first: `FixtureQiraatRepository` lazy-imports page
JSON from `packages/qiraat-core/fixtures/{pages,rulings}` and the viewer renders
them through `qiraatWordMarker.ts`. The API endpoint remains an external export
path; it is not on the page-turn critical path. PostgreSQL is an authoring/QA
export store, not the current reader's primary runtime source.

| Layer | Current implementation | Audit finding |
| --- | --- | --- |
| Farsh | `fixtures/pages`, `QiraatVariant`, engine operations | 2,889 records across 584 fixture pages. |
| Usul | `fixtures/rulings`, `QiraatRuling`, word marker | 9,899 records, 20 category codes across 584 fixture pages. |
| Page rules | `fixtures/rules`, `QiraatRule` | Separate non-token domain; only one fixture is presently present. |
| PostgreSQL export | `qiraat_*` tables and `qiraat_export_page()` | 7,247 entries across pages 1–244 only. |
| Annotation editor | `qiraat_annotations`, taxonomy and face tables | Schema is present, but only one active annotation exists; it does not feed the fixture reader. |

## Relevant PostgreSQL tables

| Table | Purpose | Current usage / issue |
| --- | --- | --- |
| `qiraat_pages` | Source/mushaf page identity | 244 rows, pages 1–244. |
| `qiraat_loci` | Token or span anchor: surah, ayah, word bounds | 7,038 rows. Anchors are suitable for cross-ayah spans. |
| `qiraat_entries` | Common variant/ruling envelope | 7,247 rows: 1,278 variants, 5,969 rulings. |
| `qiraat_variant_details` | Farsh text and type | One-to-one entry detail. |
| `qiraat_ruling_details` | Usul category, text and options | `category_code` is the current database rule classification. |
| `qiraat_entry_authorities` | Verbatim reader/rawi attribution/action | Retains source-level authority. |
| `qiraat_entry_readings` | Expanded twenty-riwayah attribution | Used for deterministic reader/rawi filtering. |
| `qiraat_authorities`, `qiraat_readings` | Ten readers, twenty narrators/riwayat | 10 + 20 valid mappings; no orphan found in baseline. |
| `qiraat_categories`, `qiraat_rules` | Registry/category metadata | DB has 24 categories, while imported rulings use 18. |
| `qiraat_evidence_*`, `qiraat_qa_*` | Evidence and review safeguards | 752 evidence texts, 1,696 links, no open flags. |
| `qiraat_annotations`, `qiraat_taxonomies`, `qiraat_annotation_*` | New editor/annotation model | Present but not yet integrated with fixture/runtime data. |

## Baseline and integrity

| Metric | Value |
| --- | ---: |
| Production deployment | `dpl_H6pCbNHnPMTgW8HUnS5xuot5gWRH`, Ready, `bom1` |
| Database Qira'at entries | 7,247 |
| Database entries checksum | `75bd28b4f4e933a0cce1e817bff30463` |
| Database rulings checksum | `ec7f5451387f027bd7d12e9a2a02a084` |
| Database variants checksum | `62e648e3ac6393841f6b4315f584f1ba` |
| Fixture variants | 2,889 |
| Fixture rulings | 9,899 |
| Fixture-covered Mushaf pages | 584 / 604 |
| Fixture pages absent | 585–604 |

The database/fixture page-count mismatch is **not** classified as missing
Qira'at content. It is `DATA_EXISTS_MAPPING_MISSING` until a source-preserving
export reconciliation proves otherwise. The present importer only writes the
subset in its legacy `PAGES` source map (pages 1–244).

## Canonical classification

`packages/qiraat-core/usulRegistry.ts` is now the single source for the 22
source-backed Usul category definitions. It maps raw category codes and Arabic
labels without replacing the source value. `scripts/qiraat/audit-qiraat-pages.mjs`
fails if a fixture category or reading ID is outside this registry/model.

## Required mutation protocol

Before any export/repair, create a timestamped `pg_dump -Fc` of the affected
tables, record the same checksums above, generate a dry-run with
`UNCHANGED`/`INSERT`/`UPDATE`/`CONFLICT`/`REQUIRES_REVIEW`, then use only
idempotent UPSERTs. No mutation is authorized by this audit itself.
