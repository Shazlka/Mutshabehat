-- ── Search upgrade: Uthmani rasm tolerance (Tier 1 + Tier 2) ──────────────────
-- Run once in Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Safe to re-run: every column is dropped & re-added, every function is OR REPLACE.
--
-- Tier 1  — normalize the Uthmani dagger alef (ٰ U+0670) to a real ا so the mushaf
--           spelling (عَٰلَمِينَ, ٱلرَّحۡمَٰنِ) matches what users type (عالمين, الرحمن).
-- Tier 2  — a "rasm skeleton" (long alef removed) + trigram index, so plene/defective
--           variants collapse to the same key (السماوات ↔ السموات, عاكفين ↔ عكفين).

-- pg_trgm powers the gin_trgm_ops indexes used for ILIKE on the skeleton columns.
create extension if not exists pg_trgm;

-- ── normalize_arabic(): SQL mirror of TypeScript normalizeArabic() ─────────────
--   * dagger alef (U+0670) → ا   (done first, before tashkeel stripping)
--   * strip tashkeel + Quranic annotations  [U+064B–U+0670, U+06D6–U+06ED]
--   * fold alef variants → ا, ى → ي, ة → ه, ؤ → و, ئ → ي
--   * remove tatweel (ـ)
create or replace function public.normalize_arabic(input text)
returns text language sql immutable strict parallel safe as $$
  select trim(
    replace(
      translate(
        regexp_replace(
          -- dagger alef → ا FIRST, so it survives the tashkeel strip as a real letter
          replace(coalesce(input, ''), chr(1648), 'ا'),
          '[ً-ٰۖ-ۭ]',
          '',
          'g'
        ),
        'إأآٱىةؤئ',   -- from
        'اااايهوي'    -- to
      ),
      'ـ', ''          -- remove tatweel
    )
  )
$$;

-- ── rasm_skeleton(): aggressive fuzzy key — drop the long alef entirely ────────
-- Only ا is removed (the overwhelmingly common Uthmani variation); و/ي are kept
-- to avoid over-merging unrelated words.
create or replace function public.rasm_skeleton(input text)
returns text language sql immutable strict parallel safe as $$
  select replace(public.normalize_arabic(input), 'ا', '')
$$;

-- ── parts.search_vec — rebuild so it picks up the new normalize_arabic() ───────
-- (A STORED generated column is NOT recomputed when its function body changes,
--  so we drop & re-add it; ADD backfills every existing row automatically.)
alter table public.parts drop column if exists search_vec;
alter table public.parts
  add column search_vec tsvector
  generated always as (to_tsvector('simple', public.normalize_arabic(text))) stored;
create index if not exists parts_search_vec_idx
  on public.parts using gin(search_vec);

-- ── parts.rasm_skeleton (Tier 2) ──────────────────────────────────────────────
alter table public.parts drop column if exists rasm_skeleton;
alter table public.parts
  add column rasm_skeleton text
  generated always as (public.rasm_skeleton(text)) stored;
create index if not exists parts_rasm_skeleton_idx
  on public.parts using gin(rasm_skeleton gin_trgm_ops);

-- ── groups.search_vec — Tier 1: normalize titles too (was plain to_tsvector) ──
create or replace function public.groups_search_update()
returns trigger language plpgsql as $$
begin
  new.search_vec := to_tsvector('simple', public.normalize_arabic(coalesce(new.title, '')));
  return new;
end;
$$;

-- Backfill existing groups without bumping updated_at (disable that trigger only).
alter table public.groups disable trigger groups_updated_at;
update public.groups
  set search_vec = to_tsvector('simple', public.normalize_arabic(coalesce(title, '')));
alter table public.groups enable trigger groups_updated_at;

-- ── groups.rasm_skeleton (Tier 2) ─────────────────────────────────────────────
alter table public.groups drop column if exists rasm_skeleton;
alter table public.groups
  add column rasm_skeleton text
  generated always as (public.rasm_skeleton(title)) stored;
create index if not exists groups_rasm_skeleton_idx
  on public.groups using gin(rasm_skeleton gin_trgm_ops);
