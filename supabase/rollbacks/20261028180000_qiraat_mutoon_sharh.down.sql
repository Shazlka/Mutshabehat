-- Removes the شرح table. Functions are put back to their previous bodies by re-applying 20261028150000_qiraat_mutoon_rows.sql
-- (its CREATE OR REPLACE statements restore qiraat_mutoon_apply, _verse_json, _work_json and _log_change). Export the شرح first
-- if edits matter: SELECT * FROM qiraat_mutoon_sharh WHERE version > 1.
BEGIN;
DROP TABLE IF EXISTS public.qiraat_mutoon_sharh;
DROP FUNCTION IF EXISTS public.qiraat_mutoon_sharh_json(public.qiraat_mutoon_sharh);
COMMIT;
