-- ============================================================================
-- PROPOSED MIGRATION (NOT APPLIED): Public Read-Only Access for Qiraat iOS App
-- File: supabase/migrations/PROPOSED_public_readonly_export.sql.txt
--
-- PURPOSE:
-- Provide secure, public read-only access for client devices (e.g. the Qiraat iOS app)
-- without granting direct permissions on internal functions or tables, and without
-- allowing callers to control visibility filters, draft states, or result limits.
--
-- SECURITY ARCHITECTURE & REVIEW FINDINGS FIX:
-- 1. NO DIRECT ACCESS OR MUTATION OF EXISTING RPCs:
--    - Existing functions (`qiraat_export_page`, `qiraat_mutoon_snapshot_json`,
--      `qiraat_mutoon_changes_json`) are NOT altered and their permissions are NOT
--      granted to `anon`. They remain reserved for the authenticated web app and service role.
-- 2. NEW STRICT SECURITY DEFINER WRAPPERS:
--    - Four dedicated read-only wrappers are created with `SET search_path = public`:
--      a) `qiraat_public_export_page(p_mushaf_page smallint)`
--      b) `qiraat_public_mutoon_snapshot()`
--      c) `qiraat_public_mutoon_changes(p_since bigint)`
--      d) `qiraat_public_page_versions()`
-- 3. NO CALLER-CONTROLLED VISIBILITY FLAGS:
--    - `p_include_unpublished` is NOT exposed. `qiraat_public_export_page` hardcodes `true`
--      to match the exact shipping dataset the iOS app already contains.
--    - The page argument is strictly validated to between 1 and 604; invalid numbers raise an exception.
--    - In `qiraat_public_mutoon_changes`, the pagination limit is hardcoded to 300 (not caller-controlled).
-- 4. NO WRITE PATH:
--    - All wrappers are STABLE queries returning jsonb or table rows.
--    - They contain zero INSERT, UPDATE, DELETE, or DDL statements.
--    - Table write permissions (INSERT/UPDATE/DELETE) remain strictly revoked from `anon` and `PUBLIC`.
--    - All write RPCs (e.g. `qiraat_mutoon_apply`, `qiraat_review_*`) remain locked to authenticated editors / service_role.
-- 5. NO HIDDEN, REJECTED, SYNTHETIC, OR SOFT-DELETED ROWS:
--    - `qiraat_export_page` filters:
--        WHERE NOT e.synthetic
--          AND e.deleted_at IS NULL
--          AND NOT e.hidden_from_mushaf
--          AND e.verification_status <> 'REJECTED'
--          AND l.deleted_at IS NULL
--      Even with `p_include_unpublished = true`, soft-deleted entries, entries on soft-deleted loci,
--      synthetic entries, hidden-from-mushaf entries, and rejected entries are filtered out.
--    - `qiraat_public_page_versions` mirrors the exact same visibility rules:
--        WHERE NOT e.synthetic
--          AND e.deleted_at IS NULL
--          AND NOT e.hidden_from_mushaf
--          AND e.verification_status <> 'REJECTED'
--          AND l.deleted_at IS NULL
--      Ensuring the manifest version token reflects only visible, shipping entries.
-- 6. PERMISSIONS:
--    - REVOKE ALL ON FUNCTION ... FROM PUBLIC
--    - GRANT EXECUTE ON FUNCTION ... TO anon, authenticated
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. qiraat_public_export_page(p_mushaf_page smallint)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qiraat_public_export_page(p_mushaf_page smallint)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_mushaf_page IS NULL OR p_mushaf_page < 1 OR p_mushaf_page > 604 THEN
    RAISE EXCEPTION 'Invalid Mushaf page: %. Expected integer 1-604.', p_mushaf_page
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  RETURN public.qiraat_export_page(p_mushaf_page, true);
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. qiraat_public_mutoon_snapshot()
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qiraat_public_mutoon_snapshot()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.qiraat_mutoon_snapshot_json();
$$;

-- ----------------------------------------------------------------------------
-- 3. qiraat_public_mutoon_changes(p_since bigint)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qiraat_public_mutoon_changes(p_since bigint)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_since IS NULL OR p_since < 0 THEN
    RAISE EXCEPTION 'Invalid since parameter: %. Expected non-negative integer.', p_since
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  RETURN public.qiraat_mutoon_changes_json(p_since, 300);
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. qiraat_public_page_versions()
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qiraat_public_page_versions()
RETURNS TABLE (
  page smallint,
  version text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH pages AS (
    SELECT generate_series(1, 604)::smallint AS page
  ),
  page_stats AS (
    SELECT
      p.mushaf_page_number AS page,
      count(e.id) AS entry_count,
      max(e.updated_at) AS max_entry_updated_at,
      max(l.updated_at) AS max_locus_updated_at
    FROM qiraat_pages p
    JOIN qiraat_entries e ON e.page_id = p.id
    JOIN qiraat_loci l ON l.id = e.locus_id
    WHERE p.mushaf_page_number BETWEEN 1 AND 604
      AND NOT e.synthetic
      AND e.deleted_at IS NULL
      AND NOT e.hidden_from_mushaf
      AND e.verification_status <> 'REJECTED'
      AND l.deleted_at IS NULL
    GROUP BY p.mushaf_page_number
  )
  SELECT
    pg.page,
    md5(
      pg.page::text || ':' ||
      coalesce(ps.entry_count, 0)::text || ':' ||
      coalesce(to_char(greatest(ps.max_entry_updated_at, ps.max_locus_updated_at), 'YYYY-MM-DD"T"HH24:MI:SS.USOF'), 'none')
    ) AS version
  FROM pages pg
  LEFT JOIN page_stats ps ON ps.page = pg.page
  ORDER BY pg.page;
$$;

-- ----------------------------------------------------------------------------
-- Grants & Revokes
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.qiraat_public_export_page(smallint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.qiraat_public_mutoon_snapshot() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.qiraat_public_mutoon_changes(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.qiraat_public_page_versions() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.qiraat_public_export_page(smallint) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qiraat_public_mutoon_snapshot() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qiraat_public_mutoon_changes(bigint) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qiraat_public_page_versions() TO anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
