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
# The columns of every synced table in the one order the cloud format uses. They are read by name: a table keeps the
# column order it was created or migrated with, and an older iPhone database has last_read_at before seconds_read in
# reading_days, so SELECT * would hand other devices the two values swapped.
COLUMNS = {
    "khatmas": ["id", "khatma_number", "started_at", "completed_at", "status", "percent_complete"],
    "khatma_read_ayahs": ["khatma_id", "surah", "ayah", "page", "read_at"],
    "reading_days": ["date_string", "ayahs_read", "pages_read", "seconds_read", "last_read_at"],
    "reading_days_legacy": ["date_string", "ayahs_read", "pages_read", "seconds_read", "last_read_at"],
    "reading_activity_events": ["id", "date_string", "ayahs_read", "pages_read", "seconds_read", "recorded_at"],
    "reading_deletions": ["kind", "khatma_number", "surah", "ayah", "page", "deleted_at"],
    "memorization_ayahs": ["surah", "ayah", "status", "review_strength", "is_learning", "first_memorized_at",
                           "last_status_changed_at", "last_reviewed_at", "next_review_at", "review_count",
                           "successful_review_count", "consecutive_successful_reviews", "error_count", "updated_at"],
    "memorization_batches": ["id", "created_at", "kind", "label", "scope_json", "ayah_count", "device_id",
                             "counts_for_streak", "gain_ayahs", "undone_at", "undoes_batch_id"],
    "memorization_events": ["id", "batch_id", "surah", "ayah", "at", "old_status", "new_status", "old_strength",
                            "new_strength", "before_json", "after_json"],
    "memorization_goals": ["id", "json"],
    "memorization_meta": ["key", "value"],
}
META_KEYS = ("milestones_seen", "quran_completed_at")


def capture(db, table):
    present = {row[1] for row in db.execute(f"PRAGMA table_info({table})")}
    columns = COLUMNS[table]
    missing = [name for name in columns if name not in present]
    if missing:
        raise SystemExit(f"{table}: missing columns {missing}")
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
