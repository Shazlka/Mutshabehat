#!/usr/bin/env python3
"""Turn an app backup (reading.sqlite + memorization.sqlite) into the cloud sync snapshots.

The snapshots have exactly the shape the apps upload: {table: [[value-as-text-or-null, ...], ...]} with the tables
of each dataset, rows sorted by their text values, and memorization_meta limited to the two synced keys. Values are
read with CAST(... AS TEXT), which is what the apps' own capture does, so numbers keep the same text.

  python3 export_snapshots.py BACKUP_DIR OUTPUT_DIR
writes OUTPUT_DIR/khatma.json and OUTPUT_DIR/memorization.json and prints the row counts. The output holds personal
reading history: keep it out of git.
"""

import json
import sqlite3
import sys
from pathlib import Path

DATASETS = {
    "khatma": ("reading.sqlite", ["khatmas", "khatma_read_ayahs", "reading_days", "reading_days_legacy",
                                  "reading_activity_events", "reading_deletions"]),
    "memorization": ("memorization.sqlite", ["memorization_ayahs", "memorization_batches", "memorization_events",
                                             "memorization_goals", "memorization_meta"]),
}
EXPECTED_COLUMNS = {
    "khatmas": 6, "khatma_read_ayahs": 5, "reading_days": 5, "reading_days_legacy": 5,
    "reading_activity_events": 6, "reading_deletions": 6,
    "memorization_ayahs": 14, "memorization_batches": 11, "memorization_events": 11,
    "memorization_goals": 2, "memorization_meta": 2,
}
META_KEYS = ("milestones_seen", "quran_completed_at")


def capture(db, table):
    columns = [row[1] for row in db.execute(f"PRAGMA table_info({table})")]
    if len(columns) != EXPECTED_COLUMNS[table]:
        raise SystemExit(f"{table}: {len(columns)} columns, the cloud expects {EXPECTED_COLUMNS[table]}")
    where = " WHERE key IN ({})".format(",".join("?" * len(META_KEYS))) if table == "memorization_meta" else ""
    query = "SELECT {} FROM {}{}".format(", ".join(f'CAST("{c}" AS TEXT)' for c in columns), table, where)
    rows = [list(row) for row in db.execute(query, META_KEYS if where else ())]
    return sorted(rows, key=lambda row: [value or "" for value in row])


def main():
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    backup, output = Path(sys.argv[1]), Path(sys.argv[2])
    output.mkdir(parents=True, exist_ok=True)
    for dataset, (file, tables) in DATASETS.items():
        # Open read-only and immutable so the backup is never modified.
        db = sqlite3.connect(f"file:{backup / file}?mode=ro&immutable=1", uri=True)
        snapshot = {table: capture(db, table) for table in tables}
        db.close()
        (output / f"{dataset}.json").write_text(json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")))
        print(dataset, {table: len(rows) for table, rows in snapshot.items()})


if __name__ == "__main__":
    main()
