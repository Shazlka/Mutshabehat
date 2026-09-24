-- Rollback: 20260925170000_qiraat_unrestrict_editor_access.down.sql
-- Purpose: Restore strict editor authentication checks

BEGIN;

CREATE OR REPLACE FUNCTION qiraat_is_editor()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
   SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM qiraat_editors WHERE user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION qiraat_require_editor()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
   IF NOT qiraat_is_editor() THEN
     RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'insufficient_privilege';
   END IF;
END;
$$;

CREATE OR REPLACE FUNCTION qiraat_review_is_editor()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
   SELECT qiraat_is_editor();
$$;

COMMIT;
