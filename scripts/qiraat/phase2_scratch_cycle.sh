#!/bin/bash
# Full Phase 2 scratch cycle. Never touches the live DB (container qiraat-scratch-phase2, network none).
set -u
export PATH="/opt/homebrew/bin:$PATH"
S="${SCRATCH_DIR:?set SCRATCH_DIR to a temp dir holding scratch_reset.sh and backup_ts}"
R="$(cd "$(dirname "$0")/../.." && pwd)"
UP=$R/supabase/migrations/20260924120000_qiraat_phase2_review_sync.sql
DOWN=$R/supabase/rollbacks/20260924120000_qiraat_phase2_review_sync.down.sql
psqlx() { docker exec -i -e PGOPTIONS="-c client_min_messages=warning" qiraat-scratch-phase2 psql -U postgres -d scratch -X -q -v ON_ERROR_STOP=1 "$@"; }
schema() { docker exec qiraat-scratch-phase2 pg_dump -U postgres -d scratch --schema-only --schema=public | grep -v '^--' | grep -v '^$' | sed 's/\\restrict .*//; s/\\unrestrict .*//' > "$1"; }
step() { echo; echo "=== $* ==="; }

step "0. reset scratch from backup"; $S/scratch_reset.sh
step "0b. regression probe BEFORE migration"; psqlx < $R/scripts/qiraat/phase2_scratch_regression.sql > $S/reg_before.txt 2>&1; cat $S/reg_before.txt
$S/scratch_reset.sh >/dev/null   # probe wrote a test annotation; start the DDL cycle from a clean copy
schema $S/schema_base.sql
step "1. apply UP (single transaction)"; psqlx --single-transaction < $UP && echo "UP ok"; schema $S/schema_up1.sql
step "2. apply UP again (idempotency)"; psqlx --single-transaction < $UP && echo "UP (2nd) ok"; schema $S/schema_up2.sql
diff -q $S/schema_up1.sql $S/schema_up2.sql && echo "IDEMPOTENT: schema after 2nd UP identical to 1st"
step "3. regression probe AFTER migration"; psqlx < $R/scripts/qiraat/phase2_scratch_regression.sql > $S/reg_after.txt 2>&1; cat $S/reg_after.txt
echo "--- diff before/after (only the new annotation uuid-dependent lines may differ):"; diff $S/reg_before.txt $S/reg_after.txt && echo "NO DIFFERENCES"
step "4. behaviour tests"; psqlx < $R/scripts/qiraat/phase2_scratch_tests.sql 2>&1 | sed 's/^psql:[^ ]* NOTICE:  //' | grep -v -E '^ (expect|edit_log_undo|canonicalised) *$|^-+$|^ *$|^\([0-9]+ rows?\)$'
step "5. apply DOWN"; psqlx --single-transaction < $DOWN && echo "DOWN ok"; schema $S/schema_down1.sql
diff $S/schema_base.sql $S/schema_down1.sql > $S/down_diff.txt && echo "REVERSIBLE: schema after DOWN identical to baseline" || { echo "schema differs from baseline:"; cat $S/down_diff.txt | head -40; }
step "6. apply DOWN again (idempotency)"; psqlx --single-transaction < $DOWN && echo "DOWN (2nd) ok"
step "7. re-apply UP"; psqlx --single-transaction < $UP && echo "UP (3rd) ok"; schema $S/schema_up3.sql
diff -q $S/schema_up1.sql $S/schema_up3.sql && echo "RE-APPLY: schema identical to first UP"
step "8. quran_words checksum"; psqlx -At -c "select count(*), md5(string_agg(canonical_key||text_uthmani,'|' ORDER BY canonical_key)) from quran_words"
