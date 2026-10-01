-- Migration: 20260925170000_qiraat_unrestrict_editor_access.sql
-- Purpose: Unrestrict editor access so the owner can edit from any device without authentication blocks

BEGIN;

CREATE OR REPLACE FUNCTION qiraat_is_editor()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
   SELECT true;
$$;

CREATE OR REPLACE FUNCTION qiraat_require_editor()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
   -- Unrestricted: allow owner editing from any device without session gating
   RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION qiraat_review_is_editor()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
   SELECT true;
$$;

COMMIT;
