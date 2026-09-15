-- ============================================================
-- Mutshabehat V2 — Full indexing pass
-- Idempotent: every statement uses IF NOT EXISTS / OR REPLACE.
-- Paste into Supabase → SQL Editor → Run once.
-- ============================================================

-- ── 1. surah_counts view ─────────────────────────────────────
-- The main listing page calls supabase.from('surah_counts') to power
-- the SurahFilter sidebar (shows verse counts per surah for the current user).
-- security_invoker = on is REQUIRED: the view is owned by the postgres
-- superuser, which would bypass RLS without it. With security_invoker, the
-- view runs with the caller's identity so the RLS policy on verses
-- (group_id → groups.user_id = auth.uid()) applies correctly.
CREATE OR REPLACE VIEW public.surah_counts
  WITH (security_invoker = on) AS
  SELECT
    surah,
    COUNT(DISTINCT group_id)::bigint AS cnt
  FROM public.verses
  GROUP BY surah;

GRANT SELECT ON public.surah_counts TO authenticated;

-- ── 2. pg_trgm ILIKE indexes ──────────────────────────────────
-- The search cascade falls back to .ilike('title', '%...%') and
-- .ilike('text', '%...%') when FTS returns nothing. Without gin_trgm_ops
-- indexes these are sequential scans on every user's rows.
-- pg_trgm is already enabled (supabase-parts-fts.sql).
CREATE INDEX IF NOT EXISTS groups_title_trgm_idx
  ON public.groups USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS parts_text_trgm_idx
  ON public.parts USING gin (text gin_trgm_ops);

-- ── 3. Title sort index ───────────────────────────────────────
-- ?sort=title calls .order('title', { ascending: true }) scoped to user.
-- Without (user_id, title), Postgres fetches via user_id index then sorts
-- the entire user's groups in memory. This delivers them pre-sorted.
CREATE INDEX IF NOT EXISTS groups_user_title_idx
  ON public.groups (user_id, title);

-- ── 4. sort_order composite indexes ──────────────────────────
-- Every group view/edit page fetches:
--   verses WHERE group_id = ? ORDER BY sort_order
--   parts  WHERE verse_id IN (…) ORDER BY sort_order
-- The existing (group_id) and (verse_id) indexes cover the filter but
-- leave an in-memory sort step. Composites deliver pre-sorted rows.
CREATE INDEX IF NOT EXISTS verses_group_sort_idx
  ON public.verses (group_id, sort_order);

CREATE INDEX IF NOT EXISTS parts_verse_sort_idx
  ON public.parts (verse_id, sort_order);

-- ── 5. group_tags reverse lookup ─────────────────────────────
-- PK (group_id, tag_id) covers WHERE group_id = ? but not WHERE tag_id = ?.
-- The get_dashboard_stats() RPC joins group_tags → tags on tag_id; this
-- index keeps that join fast as tag and group counts grow.
CREATE INDEX IF NOT EXISTS group_tags_tag_id_idx
  ON public.group_tags (tag_id);

-- ── 6. Boolean filter partial indexes ────────────────────────
-- ?filter=favorite and ?filter=completed only match the true rows.
-- Partial indexes store only those rows — very compact, very fast.
CREATE INDEX IF NOT EXISTS groups_user_favorite_idx
  ON public.groups (user_id) WHERE favorite = true;

CREATE INDEX IF NOT EXISTS groups_user_completed_idx
  ON public.groups (user_id) WHERE completed = true;

-- ── 7. Status filter index ────────────────────────────────────
-- ?filter=draft and ?filter=locked narrow by status per user.
CREATE INDEX IF NOT EXISTS groups_user_status_idx
  ON public.groups (user_id, status);
