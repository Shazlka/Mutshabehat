#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Run the Qiraat V2 schema's own QA views against the live database (task requirement #9).

    python3 scripts/qiraat/validate_qiraat_db.py

Exits non-zero if `qiraat_qa_blocking` (anything that must never reach a reader — an
unmapped locus, a published entry with no evidence, an open error-severity flag) reports
any row. `qiraat_qa_partition` overlaps and `qiraat_qa_alternates` violations are reported
as warnings (a partition gap is often just "not every وجه has been imported yet", which is
expected mid-batch — an OVERLAP, however, is always a real contradiction and is reported
loudly even though it doesn't block by itself, since `qiraat_qa_blocking` doesn't cover it).
"""
import os
import sys

import psycopg2
import psycopg2.extras


def main():
    db_url = os.environ.get('QIRAAT_DATABASE_URL') or os.environ.get('DATABASE_URL')
    if not db_url:
        print('QIRAAT_DATABASE_URL is required.', file=sys.stderr)
        sys.exit(2)

    conn = psycopg2.connect(db_url)
    exit_code = 0
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM qiraat_qa_blocking")
            blocking = cur.fetchall()
            print(f'qiraat_qa_blocking: {len(blocking)} row(s)')
            for row in blocking[:50]:
                print(f"  BLOCKING [{row['issue']}] {row['ref']}: {row['detail']}")
            if blocking:
                exit_code = 1

            cur.execute("SELECT * FROM qiraat_qa_partition WHERE overlapping_readings > 0")
            overlaps = cur.fetchall()
            print(f'qiraat_qa_partition overlaps: {len(overlaps)} row(s)')
            for row in overlaps[:50]:
                print(f"  OVERLAP locus={row['locus_id']} base_text={row['base_text']} overlap_ids={row['overlap_ids']}")
            if overlaps:
                exit_code = 1

            cur.execute("SELECT * FROM qiraat_qa_partition WHERE missing_readings > 0")
            gaps = cur.fetchall()
            print(f'qiraat_qa_partition gaps (informational — may be an incomplete import): {len(gaps)} row(s)')

            cur.execute("SELECT * FROM qiraat_qa_alternates")
            alts = cur.fetchall()
            print(f'qiraat_qa_alternates violations (should have exactly one default وجه): {len(alts)} row(s)')
            for row in alts[:50]:
                print(f"  ALTERNATE locus={row['locus_id']} authority={row['authority_id']} wajh_count={row['wajh_count']} default_count={row['default_count']}")
            if alts:
                exit_code = 1

            cur.execute("SELECT count(*) AS n FROM qiraat_qa_rule_divergence")
            div = cur.fetchone()['n']
            print(f'qiraat_qa_rule_divergence (review queue, not an error): {div} row(s)')

            cur.execute("SELECT status, count(*) AS n FROM qiraat_import_batches GROUP BY status ORDER BY status")
            print('Import batches by status:')
            for row in cur.fetchall():
                print(f"  {row['status']}: {row['n']}")
    finally:
        conn.close()

    if exit_code:
        print('\nVALIDATION FAILED — blocking issues found.', file=sys.stderr)
    else:
        print('\nAll QA views clean.')
    sys.exit(exit_code)


if __name__ == '__main__':
    main()
