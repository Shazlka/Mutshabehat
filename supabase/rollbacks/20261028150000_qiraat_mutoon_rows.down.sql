-- Rolls back the row-level متون storage. The old document table (qiraat_mutoon_documents) is untouched, but it holds
-- only the state at import time: export the rows first (SELECT qiraat_mutoon_snapshot_json()) if later edits matter.
BEGIN;
DROP FUNCTION IF EXISTS public.qiraat_mutoon_apply(jsonb, text);
DROP FUNCTION IF EXISTS public.qiraat_mutoon_changes_json(bigint, integer);
DROP FUNCTION IF EXISTS public.qiraat_mutoon_snapshot_json();
DROP FUNCTION IF EXISTS public.qiraat_mutoon_work_json(text);
DROP FUNCTION IF EXISTS public.qiraat_mutoon_verse_json(text, integer);
DROP FUNCTION IF EXISTS public.qiraat_mutoon_conflict(text);
DROP FUNCTION IF EXISTS public.qiraat_mutoon_mark_json(public.qiraat_mutoon_marks);
DROP FUNCTION IF EXISTS public.qiraat_mutoon_assignment_json(public.qiraat_mutoon_assignments);
DROP FUNCTION IF EXISTS public.qiraat_mutoon_verse_row_json(public.qiraat_mutoon_verses);
DROP FUNCTION IF EXISTS public.qiraat_mutoon_seq_now();
DROP TABLE IF EXISTS public.qiraat_mutoon_log, public.qiraat_mutoon_assignments, public.qiraat_mutoon_marks,
  public.qiraat_mutoon_verses, public.qiraat_mutoon_works;
DROP FUNCTION IF EXISTS public.qiraat_mutoon_log_change();
DROP FUNCTION IF EXISTS public.qiraat_mutoon_touch();
DROP SEQUENCE IF EXISTS public.qiraat_mutoon_seq;
COMMIT;
NOTIFY pgrst, 'reload schema';
