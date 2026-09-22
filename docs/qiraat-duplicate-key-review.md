# Qira'at duplicate importer-key review

Date: 2026-09-22

## Result

The read-only reconciliation found **25 legacy importer-key collisions** on
pages 327, 400, 440, 489, 490, 495, 496, 497, 498, 503, 504, 509, 515,
517, and 560. Every collision has a different reading face: a different
variant text, reader/rawi set, performance annotation, or source attribution.
None is a byte-identical duplicate that can safely be discarded.

The collision is caused by the historical variant key:

```text
{source_id}-a{ayah}-t{startToken}
```

The same source id was reused for multiple faces at one locus. PostgreSQL's
`ON CONFLICT (id)` would therefore collapse one valid face into another. No
database mutation was performed.

## Exact collision inventory

| Page | Legacy key | Faces | Safe interpretation |
|---:|---|---:|---|
| 327 | `v-D327-فسلوهم-w2-a63-t6` | Q02/Q06/Q07 vs Q10 | Distinct attribution groups |
| 400 | `v-D400-منجوك-w2-a33-t17` | Q02/Q09-R01 vs Q09-R02 | Distinct rawi face |
| 440 | `v-D440-صراط-w2-a4-t2` | السين vs إشمام الصاد | Distinct performance/letter faces |
| 489 | `v-AUDIT-P489-42-52-26-DOCX-P489-R02924-a52-t26` | السين vs إشمام الصاد | Distinct performance faces |
| 489 | `v-AUDIT-P489-42-53-1-DOCX-P489-R02924-a53-t1` | السين vs إشمام الصاد | Distinct performance faces |
| 490 | `v-AUDIT-P490-43-15-5-DOCX-P490-R02936-a15-t5` | شعبة vs أبي جعفر | Distinct variant faces |
| 495 | `v-D495-ترجعون-w2-a85-t13` | 3 faces | Q02/Q06/Q07; Q09-R01; Q09-R02 |
| 495 | `v-D495-يعلمون-w2-a86-t13` | Q01/Q04/Q06/Q08 vs Q10 | Distinct attribution groups |
| 496 | `v-D496-رب_السماوات-w2-a7-t1` | Q01/Q02/Q03/Q04/Q06/Q08/Q09 vs Q10 | Distinct attribution groups |
| 497 | `v-D497-فاسر-w2-a23-t1` | Q01/Q02/Q06/Q08 vs Q10 | Distinct attribution groups |
| 497 | `v-D497-وعيون-w2-a25-t5` | mixed Q02/Q04/Q05/Q06/Q07 vs Q10 | Distinct attribution groups |
| 498 | `v-D498-فاعتلوه-w2-a47-t2` | Q01/Q02/Q04/Q06/Q09 vs Q10 | Distinct attribution groups |
| 498 | `v-D498-مقام_امين-w2-a51-t4` | Q01/Q04/Q06/Q08 vs Q10 | Distinct attribution groups |
| 498 | `v-D498-وعيون-w2-a52-t3` | mixed Q02/Q04/Q05/Q06/Q07 vs Q10 | Distinct attribution groups |
| 503 | `v-AUDIT-P503-R03071-12-12-a12-t12` | ياء الغيب vs تاء الخطاب | Distinct variant faces |
| 503 | `v-AUDIT-P503-R03072-13-8-a13-t8` | ضم الهاء vs فتح الفاء/لا تنوين | Distinct variant faces |
| 504 | `v-AUDIT-P504-R03083-17-4-a17-t4` | 3 faces | تنوين, فتح بلا تنوين, كسر بلا تنوين |
| 504 | `v-AUDIT-P504-R03085-18-4-a18-t4` | كسر الهاء والميم vs ضم الهاء والميم | Distinct performance faces |
| 509 | `v-D509-واملا-w2-a25-t15` | أبو عمرو vs يعقوب | Distinct vowel faces |
| 509 | `v-D509-اسرارهم-w2-a26-t15` | all non-Q10 group vs Q10 | Distinct attribution groups |
| 515 | `v-D515-بهم_الكفار-w2-a29-t43` | كسر الهاء والميم vs ضم الهاء والميم | Distinct performance faces |
| 517 | `v-D517-لا_يلتكم-w2-a14-t19` | همز vs إبدال الهمزة | Distinct hamza faces |
| 560 | `v-D560-وجبريل-w3-a4-t15` | Q06/Q07 vs Q05-R01 | Distinct spelling faces |

The full source payloads, token spans, source references, and reading IDs are
retained in `artifacts/qiraat-postgres-reconciliation.json` under
`duplicate_import_keys`.

## Deterministic disambiguation

`fixture_disambiguated_id()` in
`scripts/qiraat/audit_postgres_reconciliation.py` computes a diagnostic key
from the legacy source identity plus a SHA-256 digest of the kind, page,
surah/ayah/token span, and canonical payload (variant text/category and sorted
reader/rawi IDs). Across all 12,788 fixture records:

- legacy keys: 25 collisions;
- proposed keys: 12,788 unique keys;
- candidate collisions: 0;
- database changes: 0.

This proves deterministic disambiguation is technically possible for a future
import plan. It does **not** authorize renaming existing PostgreSQL entry IDs:
that would require a backup-first migration preserving all foreign keys and a
source-approved mapping from old IDs to new IDs. The current safe status is
`DATA_DUPLICATE` / `REQUIRES_MANUAL_REVIEW`, with all 25 faces withheld from
automatic import.

## Verification

```text
python3 -m pytest tests/test_qiraat_import_keys.py -q
```

The test proves the legacy collision count remains 25, every proposed key is
unique, and proposed IDs are stable under fixture ordering changes.
