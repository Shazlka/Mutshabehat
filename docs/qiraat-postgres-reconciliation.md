# Qiraat fixture-to-PostgreSQL reconciliation

`scripts/qiraat/audit_postgres_reconciliation.py` is the authoritative
read-only preflight for comparing committed Qiraat fixtures with the current
self-hosted PostgreSQL Qiraat schema. It does not call an import script and it
opens PostgreSQL in a `READ ONLY` transaction.

Run it only with an explicitly supplied local DSN; credentials must never be
written to the repository:

```bash
QIRAAT_AUDIT_DSN="$QIRAAT_AUDIT_DSN" \
  python3 scripts/qiraat/audit_postgres_reconciliation.py
```

The generated `artifacts/qiraat-postgres-reconciliation.json` records the
fixture and database page ranges, exact import-key differences, content
conflicts, database-only records, and duplicate fixture keys. A non-zero exit
status means a same-key database conflict or database-only record was found;
fixture-only records are reported for controlled follow-up rather than
automatically treated as an error.

## Classification and repair boundary

- `DATA_EXISTS_MAPPING_MISSING`: committed fixture record lacks a matching DB
  entry. It is evidence of import coverage lag, not missing Qiraat content.
- `DATA_DUPLICATE`: two fixture rows resolve to one importer key. Resolve at
  the fixture/source layer first; do not rely on `ON CONFLICT` to choose one.
- `DATA_CONFLICT`: same key has different fixture/DB contents. Always manual
  review; no automatic update.
- `DATABASE_ONLY_REQUIRES_REVIEW`: database data absent from committed
  fixtures. Never delete it automatically.

Any future mutation requires explicit approval, an external `pg_dump` backup,
small page batches, and re-running this script. The existing importer must not
be used wholesale because it is an operational write tool and it only defines
its original fixture page set.

## History

- 2026-09-22: Added the read-only reconciliation preflight and classification
  contract after database coverage was found to lag committed fixtures.
