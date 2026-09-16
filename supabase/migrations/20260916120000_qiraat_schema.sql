-- Migration: 20260916120000_qiraat_schema.sql
-- Description: Core schema for Qira’at (القراءات العشر) annotation layer linked to Quran words.
-- Safety: Completely additive. Zero existing tables, columns, or constraints are modified.

-- 1. Sources table
create table if not exists public.qiraat_sources (
  id text primary key,
  title text not null,
  edition text,
  source_type text not null default 'scanned_mushaf_with_margin',
  file_name text,
  total_pages int default 604,
  notes text,
  created_at timestamptz not null default now()
);

-- 2. Persons table (Ten Imams and Twenty Narrators)
create table if not exists public.qiraat_persons (
  id text primary key,
  canonical_name text not null,
  display_name text not null,
  person_type text not null check (person_type in ('imam', 'rawi')),
  parent_person_id text references public.qiraat_persons(id) on delete set null,
  order_index int not null,
  alias text,
  notes text,
  created_at timestamptz not null default now()
);

-- 3. Qira’at Loci (a distinct textual variation instance in the source book)
create table if not exists public.qiraat_loci (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references public.qiraat_sources(id) on delete cascade,
  locus_key text unique,
  mushaf_page int not null check (mushaf_page between 1 and 604),
  surah int not null check (surah between 1 and 114),
  ayah int not null check (ayah >= 1),
  source_marker text not null,
  marker_display text not null,
  source_heading_raw text not null,
  source_word_raw text not null,
  mushaf_base_word text not null,
  pdf_page int not null,
  printed_page int not null,
  status text not null default 'verified' check (status in ('extracted', 'reviewed', 'verified', 'disputed')),
  requires_manual_review boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

-- 4. Qira’at Targets (the specific Quran word tokens in Mushaf 1441 targeted by a locus)
create table if not exists public.qiraat_targets (
  id uuid primary key default gen_random_uuid(),
  locus_id uuid not null references public.qiraat_loci(id) on delete cascade,
  quran_word_id text not null,
  surah int not null check (surah between 1 and 114),
  ayah int not null check (ayah >= 1),
  word_index int not null check (word_index >= 1),
  mushaf_page int not null check (mushaf_page between 1 and 604),
  line_number int not null check (line_number between 1 and 15),
  word_index_in_line int not null check (word_index_in_line >= 1),
  base_text_uthmani text not null,
  normalized_text text not null,
  created_at timestamptz not null default now(),
  constraint qiraat_targets_locus_word_unique unique (locus_id, quran_word_id)
);

-- 5. Qira’at Variants (readings available for a given locus)
create table if not exists public.qiraat_variants (
  id uuid primary key default gen_random_uuid(),
  locus_id uuid not null references public.qiraat_loci(id) on delete cascade,
  variant_index int not null,
  display_text text not null,
  normalized_text text not null,
  performance_type text,
  performance_text text,
  source_line_raw text not null,
  sort_order int not null default 1,
  created_at timestamptz not null default now(),
  constraint qiraat_variants_locus_variant_unique unique (locus_id, variant_index)
);

-- 6. Qira’at Attributions (links between a variant and reader/rawi persons)
create table if not exists public.qiraat_attributions (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.qiraat_variants(id) on delete cascade,
  person_id text not null references public.qiraat_persons(id) on delete cascade,
  attribution_raw text not null,
  role text not null check (role in ('imam', 'rawi', 'tariq')),
  parent_person_id text references public.qiraat_persons(id) on delete set null,
  sort_order int not null default 1,
  created_at timestamptz not null default now(),
  constraint qiraat_attributions_variant_person_unique unique (variant_id, person_id)
);

-- Supporting indexes
create index if not exists qiraat_loci_page_idx on public.qiraat_loci(mushaf_page, surah, ayah);
create index if not exists qiraat_targets_page_idx on public.qiraat_targets(mushaf_page);
create index if not exists qiraat_targets_word_id_idx on public.qiraat_targets(quran_word_id);
create index if not exists qiraat_targets_surah_ayah_idx on public.qiraat_targets(surah, ayah, word_index);
create index if not exists qiraat_variants_locus_idx on public.qiraat_variants(locus_id, sort_order);
create index if not exists qiraat_attributions_variant_idx on public.qiraat_attributions(variant_id);
create index if not exists qiraat_attributions_person_idx on public.qiraat_attributions(person_id);

-- Enable RLS across all tables
alter table public.qiraat_sources enable row level security;
alter table public.qiraat_persons enable row level security;
alter table public.qiraat_loci enable row level security;
alter table public.qiraat_targets enable row level security;
alter table public.qiraat_variants enable row level security;
alter table public.qiraat_attributions enable row level security;

-- Read policies (accessible to public and authenticated users)
create policy "Allow read access on qiraat_sources" on public.qiraat_sources for select using (true);
create policy "Allow read access on qiraat_persons" on public.qiraat_persons for select using (true);
create policy "Allow read access on qiraat_loci" on public.qiraat_loci for select using (true);
create policy "Allow read access on qiraat_targets" on public.qiraat_targets for select using (true);
create policy "Allow read access on qiraat_variants" on public.qiraat_variants for select using (true);
create policy "Allow read access on qiraat_attributions" on public.qiraat_attributions for select using (true);

-- Grant select to anon and authenticated
grant select on public.qiraat_sources to anon, authenticated;
grant select on public.qiraat_persons to anon, authenticated;
grant select on public.qiraat_loci to anon, authenticated;
grant select on public.qiraat_targets to anon, authenticated;
grant select on public.qiraat_variants to anon, authenticated;
grant select on public.qiraat_attributions to anon, authenticated;
