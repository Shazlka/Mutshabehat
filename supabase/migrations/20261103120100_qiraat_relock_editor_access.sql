-- ============================================================================
-- PROPOSED MIGRATION (NOT APPLIED): Relock Editor Access
-- File: supabase/migrations/PROPOSED_relock_editor_access.sql.txt
--
-- PURPOSE:
-- Restore real editor authentication checks by reverting the changes introduced
-- in `20260925170000_qiraat_unrestrict_editor_access.sql`.
--
-- BACKGROUND & PROBLEM STATEMENT:
-- In migration `20260925170000_qiraat_unrestrict_editor_access.sql`, editor checks
-- were replaced with open stubs:
--   - `qiraat_is_editor()` returned `SELECT true;`
--   - `qiraat_require_editor()` returned `RETURN;` (no-op)
--   - `qiraat_review_is_editor()` returned `SELECT true;`
-- While this allowed testing across devices without session constraints, it completely
-- removed authorization enforcement on all review editor writes, allowing any caller
-- (or unauthenticated requests if functions were accessible) to perform mutations.
--
-- OWNER ACCOUNT COMPATIBILITY:
-- The site architecture signs visitors in as the owner via proxy auto-login
-- (`src/proxy.ts`), setting a valid Supabase session for `auth.uid()`.
-- The owner user ID ('ec34e9cc-7c98-4180-86ce-2b80ac34646e'::uuid) was seeded
-- into `qiraat_editors` in `20260925120000_qiraat_phase4_review_api.sql`.
-- This migration guarantees `qiraat_editors` contains the owner user ID.
-- Thus, the owner account will continue to function seamlessly across all editor workflows.
--
-- COMPLETE LIST OF WRITE RPCS AND HOW THEY ARE GATED AFTER RE-LOCK:
-- ----------------------------------------------------------------------------
-- All write functions below are SECURITY DEFINER with SET search_path = public.
--
-- A. Qiraat Review Workspace Write RPCs (gated by `qiraat_require_editor()`):
--    These functions call `PERFORM qiraat_require_editor();` at their entrypoint,
--    which strictly verifies `auth.uid() IS NOT NULL` and exists in `qiraat_editors`.
--    If not authorized, an exception with ERRCODE 'insufficient_privilege' is raised.
--
--    1.  `qiraat_review_create_entry(p jsonb)`
--        - Gates: `PERFORM qiraat_require_editor();`
--        - Grants: EXECUTE to `authenticated, service_role`.
--    2.  `qiraat_review_update_entry(p jsonb)`
--        - Gates: `PERFORM qiraat_require_editor();`
--        - Grants: EXECUTE to `authenticated, service_role`.
--    3.  `qiraat_review_set_status(p_entry_id text, p_status qiraat_review_status, ...)`
--        - Gates: `PERFORM qiraat_require_editor();` (called via `qiraat_review_begin`)
--        - Grants: EXECUTE to `authenticated, service_role`.
--    4.  `qiraat_review_set_hidden(p_entry_id text, p_hidden boolean, ...)`
--        - Gates: `PERFORM qiraat_require_editor();` (called via `qiraat_review_begin`)
--        - Grants: EXECUTE to `authenticated, service_role`.
--    5.  `qiraat_review_set_narrators(p_entry_id text, p_narrators jsonb, ...)`
--        - Gates: `PERFORM qiraat_require_editor();`
--        - Grants: EXECUTE to `authenticated, service_role`.
--    6.  `qiraat_review_delete_entry(p_entry_id text, p_expected timestamptz, ...)`
--        - Gates: `PERFORM qiraat_require_editor();`
--        - Grants: EXECUTE to `authenticated, service_role`.
--    7.  `qiraat_review_restore_entry(p_entry_id text, p_expected timestamptz, ...)`
--        - Gates: `PERFORM qiraat_require_editor();`
--        - Grants: EXECUTE to `authenticated, service_role`.
--    8.  `qiraat_review_copy_entry(p jsonb)`
--        - Gates: `PERFORM qiraat_require_editor();`
--        - Grants: EXECUTE to `authenticated, service_role`.
--    9.  `qiraat_review_bulk_delete(p_items jsonb, ...)`
--        - Gates: `PERFORM qiraat_require_editor();`
--        - Grants: EXECUTE to `authenticated, service_role`.
--    10. `qiraat_review_bulk_apply(p_source_entry_id text, p_targets jsonb, ...)`
--        - Gates: `PERFORM qiraat_require_editor();`
--        - Grants: EXECUTE to `authenticated, service_role`.
--    11. `qiraat_review_undo(p_txid bigint, ...)`
--        - Gates: `PERFORM qiraat_require_editor();` and verifies actor was in `qiraat_editors`.
--        - Grants: EXECUTE to `authenticated, service_role`.
--
-- B. Phase 4 Annotation Editor Write RPCs (gated by `qiraat_require_editor()`):
--    12. `qiraat_editor_create_annotation(p jsonb)`
--        - Gates: `PERFORM qiraat_require_editor();`
--        - Grants: EXECUTE to `authenticated, service_role`.
--    13. `qiraat_editor_update_annotation(p jsonb)`
--        - Gates: `PERFORM qiraat_require_editor();`
--        - Grants: EXECUTE to `authenticated, service_role`.
--    14. `qiraat_editor_soft_delete_annotation(p_annotation_id uuid, p_expected_version integer)`
--        - Gates: `PERFORM qiraat_require_editor();`
--        - Grants: EXECUTE to `authenticated, service_role`.
--
-- C. Mutoon Editor Write RPCs (Service Role Only):
--    15. `qiraat_mutoon_apply(p_ops jsonb, p_client text)`
--        - Defined in `20261028150000_qiraat_mutoon_rows.sql` & `20261028180000_qiraat_mutoon_sharh.sql`.
--        - Gates: REVOKED from `PUBLIC`, `anon`, and `authenticated`.
--          Granted ONLY to `service_role`.
--          The Next.js API route (`src/app/api/mushaf-1441/mutoon-editor/route.ts`) invokes this
--          server-side using `mutoonRpc` (SUPABASE_SERVICE_ROLE_KEY) after verifying sameOrigin(request)
--          and validating operations with `validateOps`. Browser clients cannot call it directly via PostgREST.
--    16. `qiraat_mutoon_save_revision()`
--        - Defined in `20261028100000_qiraat_mutoon_editor.sql`.
--        - Gates: REVOKED from `PUBLIC`, `anon`, and `authenticated`. Service role only.
--
-- D. Review Workspace Gated Internal Read RPCs (gated by `qiraat_require_editor()`):
--    The following review workbench queries also enforce `qiraat_require_editor()`:
--    - `qiraat_review_page(p_page integer, p_include_deleted boolean)`
--    - `qiraat_review_history(p_page integer, p_limit integer)`
--    - `qiraat_review_overview()`
--    - `qiraat_review_find_same_word(...)`
--    - `qiraat_review_find_occurrences(...)`
--    - `qiraat_review_suggestions(...)`
--
-- E. Public Read Endpoints (Explicit Safe Wrappers):
--    The public API endpoints (`/api/public/v1/*`) do NOT use internal functions or write RPCs.
--    They use dedicated SECURITY DEFINER wrappers:
--    - `qiraat_public_export_page(p_mushaf_page smallint)`
--    - `qiraat_public_mutoon_snapshot()`
--    - `qiraat_public_mutoon_changes(p_since bigint)`
--    - `qiraat_public_page_versions()`
--    Granted only to `anon, authenticated` with fixed bounds, no write paths, and no caller-controlled visibility.
-- ============================================================================

BEGIN;

-- 1. Ensure qiraat_editors table exists and has RLS enabled
CREATE TABLE IF NOT EXISTS public.qiraat_editors (
  user_id  uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  note     text
);

ALTER TABLE public.qiraat_editors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.qiraat_editors FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.qiraat_editors TO service_role;

-- 2. Ensure owner account is present in the allowlist
INSERT INTO public.qiraat_editors (user_id, note)
SELECT 'ec34e9cc-7c98-4180-86ce-2b80ac34646e'::uuid, 'owner (seeded by Phase 4)'
 WHERE EXISTS (SELECT 1 FROM auth.users WHERE id = 'ec34e9cc-7c98-4180-86ce-2b80ac34646e')
ON CONFLICT (user_id) DO NOTHING;

-- 3. Restore true editor check in qiraat_is_editor()
CREATE OR REPLACE FUNCTION public.qiraat_is_editor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.qiraat_editors WHERE user_id = auth.uid());
$$;

-- 4. Restore strict privilege check in qiraat_require_editor()
CREATE OR REPLACE FUNCTION public.qiraat_require_editor()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.qiraat_is_editor() THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'insufficient_privilege';
  END IF;
END;
$$;

-- 5. Restore delegation in qiraat_review_is_editor()
CREATE OR REPLACE FUNCTION public.qiraat_review_is_editor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.qiraat_is_editor();
$$;

-- 6. Enforce restricted permissions on editor verification functions
REVOKE ALL ON FUNCTION public.qiraat_is_editor() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.qiraat_require_editor() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.qiraat_review_is_editor() FROM PUBLIC, anon;

-- The checks are called by write RPCs on behalf of the signed-in owner: authenticated must keep EXECUTE,
-- otherwise a SECURITY INVOKER caller fails with permission denied. Only anon loses access.
GRANT EXECUTE ON FUNCTION public.qiraat_is_editor() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.qiraat_require_editor() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.qiraat_review_is_editor() TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
