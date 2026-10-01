# Qira'at tail-page source review (pages 585–604)

Date: 2026-09-22  
Branch: `feature/qiraat-annotation-engine-v2`  
Scope: read-only provenance review. No Qira'at fixture or database row was changed.

## Finding

Pages 585–604 have the ordinary Mushaf-1441 page-word fixtures, but no
Qira'at Farsh/Usul fixtures, no corresponding rows in the current
`mutshabehat-db` Qira'at tables, and no tail-page source package in the
checkout or reachable Git history. This proves that the Qira'at records are
not currently available to the application, but it does **not** prove that
the recitation content is absent from the authoritative external source.

The correct classification is `I. UNKNOWN_REQUIRES_REVIEW` (and, for any
future import comparison, `DATA_EXISTS_MAPPING_MISSING` only once an approved
source package is supplied). No recitation should be inferred or generated
from the ordinary Hafs Mushaf text.

## Evidence

| Surface | Observation | Evidence |
| --- | --- | --- |
| Qira'at variant fixtures | Exactly 584 files, `page-001.json` through `page-584.json`; pages 585–604 absent | `packages/qiraat-core/fixtures/pages/` |
| Qira'at ruling fixtures | Exactly 584 files, `page-001.json` through `page-584.json`; pages 585–604 absent | `packages/qiraat-core/fixtures/rulings/` |
| Source importer | Its source contract explicitly says “Mushaf pages 225–584”; source name and extraction package are bounded to 225–584 | `scripts/qiraat/import_doc_tables.py` module docstring and `SRC` declaration |
| Ordinary Mushaf text | Pages 585–604 are present and validated as base Mushaf word data | `packages/quran-data/mushaf1441/fixtures/page-words/page-585.json` through `page-604.json` and `page-words-manifest.json` |
| Live Qira'at pages | 244 rows, minimum page 1, maximum page 244; zero rows in 585–604 | read-only query of `qiraat_pages` in `mutshabehat-db` |
| Live Qira'at loci | 7,038 loci joined to pages 1–244; zero loci in 585–604 | read-only join of `qiraat_loci` → `qiraat_pages` |
| Live Qira'at entries | 7,247 entries joined to pages 1–244; zero entries in 585–604 | read-only join of `qiraat_entries` → `qiraat_pages` |
| Live raw extraction/notes | Zero rows in `qiraat_extraction_raw` and `qiraat_notes`; no tail-page material retained there | read-only query of current database |
| Annotation-source page labels | Zero `qiraat_annotation_sources.page` values matching 585–604 | read-only query of current database |
| Git history/branches | No Qira'at fixture page beyond 584 on reachable branches; no matching tail-page source blobs found in unreachable Git objects | `git ls-tree` across local/remotes and `git fsck --unreachable` content scan |
| Self-hosted backups | Dumps contain prior Qira'at schemas/data snapshots, but no evidence of pages 585–604 was found | `backups/pre-qiraat-*.dump` catalog inspection |

## Counts and page list

- Qira'at records added: **0**
- Qira'at pages added: **0**
- Qira'at database rows changed: **0**
- Missing Qira'at fixture pages: **585, 586, 587, 588, 589, 590, 591, 592,
  593, 594, 595, 596, 597, 598, 599, 600, 601, 602, 603, 604**
- Ordinary Mushaf page-word files available for those pages: **20/20**
- Current database Qira'at rows for those pages: **0/20 pages, 0 rows**

## Safe next step

Obtain an approved source package covering pages 585–604 (with page, ayah,
token, reader/rawi, rule, and source evidence), then run the existing
deterministic importer in a dry-run mode. Compare each proposed row against
the canonical Mushaf token and the existing database before any batch backup,
UPSERT, or deployment. Until that evidence exists, importing records or
creating a zero-rule fixture would violate the no-invention and
no-overwrite constraints.

## Verification commands

```text
find packages/qiraat-core/fixtures/pages -name 'page-*.json' | sort -V
find packages/qiraat-core/fixtures/rulings -name 'page-*.json' | sort -V
docker exec mutshabehat-db psql -U postgres -d postgres -P pager=off -c \
  "select count(*), min(mushaf_page_number), max(mushaf_page_number) from qiraat_pages;"
docker exec mutshabehat-db psql -U postgres -d postgres -P pager=off -c \
  "select count(*) from qiraat_entries e join qiraat_pages p on p.id=e.page_id
   where p.mushaf_page_number between 585 and 604;"
```

All commands were read-only.

## History & Changelog

- **2026-09-22 (Codex)**
  - **Added**: Provenance review for Qira'at pages 585–604, including fixture,
    source, Git, backup, and live-database evidence.
  - **Removed**: None.
  - **Changed**: None.
  - **Verification**: Read-only filesystem, Git, backup catalog, and PostgreSQL
    checks; 0 rows or files were mutated.
