-- متون editor v2: row-level storage, change log and atomic operations.
--
-- The first editor kept the three poems, 3,693 marks and every manual assignment in ONE jsonb document and re-sent the
-- whole 3 MB on every save (30 s to open, last-writer-wins on conflict, nothing small enough to sync to the phone).
-- Here every verse, mark and assignment is a row with its own version; every change is logged with a global sequence
-- number so a client asks "what changed since N" and receives only those verses.
--
-- The old table qiraat_mutoon_documents is left untouched as a backup of the import.
-- All tables are closed to anon/authenticated; the API verifies the session and uses the service role.
BEGIN;

CREATE SEQUENCE IF NOT EXISTS public.qiraat_mutoon_seq;

CREATE TABLE IF NOT EXISTS public.qiraat_mutoon_works (
  work text PRIMARY KEY CHECK (work IN ('shatibiyyah', 'durrah', 'tayyibah')),
  title text NOT NULL,
  author text NOT NULL DEFAULT '',
  book_id integer,
  position integer NOT NULL
);

CREATE TABLE IF NOT EXISTS public.qiraat_mutoon_verses (
  work text NOT NULL REFERENCES public.qiraat_mutoon_works(work),
  verse integer NOT NULL CHECK (verse > 0),
  chapter_index integer NOT NULL,
  chapter_title text NOT NULL,
  chapter_farsh boolean NOT NULL DEFAULT false,
  position integer NOT NULL,
  lines text[] NOT NULL CHECK (cardinality(lines) BETWEEN 1 AND 2),
  printed_page text,
  page_id integer,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (work, verse)
);
CREATE INDEX IF NOT EXISTS qiraat_mutoon_verses_order ON public.qiraat_mutoon_verses (work, position);

CREATE TABLE IF NOT EXISTS public.qiraat_mutoon_marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work text NOT NULL,
  verse integer NOT NULL,
  line smallint NOT NULL CHECK (line IN (0, 1)),
  word text NOT NULL,
  occurrence integer NOT NULL CHECK (occurrence >= 1),
  mode text NOT NULL CHECK (mode IN ('letter', 'word')),
  symbol text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('reader', 'narrator', 'group')),
  reading_ids text[] NOT NULL CHECK (cardinality(reading_ids) >= 1),
  note text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT '',
  status text NOT NULL CHECK (status IN ('verified', 'extracted')),
  method text NOT NULL DEFAULT 'hand' CHECK (method IN ('hand', 'match')),
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (work, verse) REFERENCES public.qiraat_mutoon_verses(work, verse),
  UNIQUE (work, verse, line, word, occurrence)
);
CREATE INDEX IF NOT EXISTS qiraat_mutoon_marks_verse ON public.qiraat_mutoon_marks (work, verse);

CREATE TABLE IF NOT EXISTS public.qiraat_mutoon_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work text NOT NULL,
  verse integer NOT NULL,
  line smallint NOT NULL CHECK (line IN (0, 1)),
  word text NOT NULL,
  occurrence integer NOT NULL CHECK (occurrence >= 1),
  mode text NOT NULL DEFAULT 'word' CHECK (mode IN ('letter', 'word')),
  letter_index integer CHECK (letter_index IS NULL OR letter_index >= 0),
  reading_ids text[] NOT NULL CHECK (cardinality(reading_ids) >= 1),
  note text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (work, verse) REFERENCES public.qiraat_mutoon_verses(work, verse),
  UNIQUE (work, verse, line, word, occurrence)
);
CREATE INDEX IF NOT EXISTS qiraat_mutoon_assignments_verse ON public.qiraat_mutoon_assignments (work, verse);

-- Every change, in commit order. The feed behind "what changed since N" for the web editor and the iOS app.
CREATE TABLE IF NOT EXISTS public.qiraat_mutoon_log (
  seq bigint PRIMARY KEY DEFAULT nextval('public.qiraat_mutoon_seq'),
  at timestamptz NOT NULL DEFAULT now(),
  work text NOT NULL,
  verse integer NOT NULL,
  entity text NOT NULL CHECK (entity IN ('verse', 'mark', 'assignment')),
  action text NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
  row_id text NOT NULL,
  before jsonb,
  after jsonb,
  client text
);
CREATE INDEX IF NOT EXISTS qiraat_mutoon_log_verse ON public.qiraat_mutoon_log (work, verse, seq);

-- ---------------------------------------------------------------------------------------------------------------
-- Import the current document (idempotent: only into empty tables).
-- ---------------------------------------------------------------------------------------------------------------
INSERT INTO public.qiraat_mutoon_works (work, title, author, book_id, position)
SELECT w->>'work', coalesce(w->>'title', w->>'work'), coalesce(w->>'author', ''), (w->>'bookId')::integer, ord::integer
FROM public.qiraat_mutoon_documents d,
     jsonb_array_elements(d.document->'mutoon'->'works') WITH ORDINALITY AS t(w, ord)
WHERE d.id = 'current' AND NOT EXISTS (SELECT 1 FROM public.qiraat_mutoon_works);

-- The source numbers two different verses of الدرة «٢٣٨» (the gap at ٢٣٩ is the second one). A verse needs a unique
-- number here, so the second occurrence of a repeated number takes the next number, which must be free.
INSERT INTO public.qiraat_mutoon_verses (work, verse, chapter_index, chapter_title, chapter_farsh, position, lines, printed_page, page_id)
SELECT s.work, s.number + CASE WHEN s.dup_rank > 1 THEN s.dup_rank - 1 ELSE 0 END, s.chapter_index, s.chapter_title, s.chapter_farsh,
       (row_number() OVER (PARTITION BY s.work ORDER BY s.c_ord, s.v_ord))::integer, s.lines, s.printed_page, s.page_id
FROM (
  SELECT w->>'work' AS work, (v->>'number')::integer AS number, (c_ord - 1)::integer AS chapter_index, coalesce(c->>'title', '') AS chapter_title,
         coalesce((c->>'farsh')::boolean, false) AS chapter_farsh, c_ord, v_ord,
         ARRAY(SELECT x FROM jsonb_array_elements_text(v->'lines') WITH ORDINALITY AS l(x, o) ORDER BY o) AS lines,
         v->>'printedPage' AS printed_page, (v->>'pageId')::integer AS page_id,
         row_number() OVER (PARTITION BY w->>'work', (v->>'number')::integer ORDER BY c_ord, v_ord) AS dup_rank
  FROM public.qiraat_mutoon_documents d,
       jsonb_array_elements(d.document->'mutoon'->'works') AS w,
       jsonb_array_elements(w->'chapters') WITH ORDINALITY AS cc(c, c_ord),
       jsonb_array_elements(c->'verses') WITH ORDINALITY AS vv(v, v_ord)
  WHERE d.id = 'current'
) s
WHERE NOT EXISTS (SELECT 1 FROM public.qiraat_mutoon_verses);

INSERT INTO public.qiraat_mutoon_marks (work, verse, line, word, occurrence, mode, symbol, kind, reading_ids, note, source, status, method)
SELECT m->>'work', (m->>'verse')::integer, (m->>'line')::smallint, m->>'word', (m->>'occurrence')::integer, m->>'mode', m->>'symbol',
       m->>'kind', ARRAY(SELECT jsonb_array_elements_text(m->'readingIds')), coalesce(m->>'note', ''), coalesce(m->>'source', ''),
       m->>'status', coalesce(m->>'method', 'hand')
FROM public.qiraat_mutoon_documents d, jsonb_array_elements(d.document->'marks'->'marks') AS m
WHERE d.id = 'current' AND NOT EXISTS (SELECT 1 FROM public.qiraat_mutoon_marks);

INSERT INTO public.qiraat_mutoon_assignments (work, verse, line, word, occurrence, mode, letter_index, reading_ids, note, source)
SELECT a->>'work', (a->>'verse')::integer, (a->>'line')::smallint, a->>'word', (a->>'occurrence')::integer, coalesce(a->>'mode', 'word'),
       (a->>'letterIndex')::integer, ARRAY(SELECT jsonb_array_elements_text(a->'readingIds')), coalesce(a->>'note', ''), coalesce(a->>'source', '')
FROM public.qiraat_mutoon_documents d, jsonb_array_elements(coalesce(d.document->'assignments'->'assignments', '[]'::jsonb)) AS a
WHERE d.id = 'current' AND NOT EXISTS (SELECT 1 FROM public.qiraat_mutoon_assignments);

-- ---------------------------------------------------------------------------------------------------------------
-- Triggers: version bump on every update, and the change log (after the import, so the import is not logged).
-- The advisory lock makes commit order equal sequence order, so "since N" can never skip a slower transaction.
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qiraat_mutoon_touch() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.qiraat_mutoon_log_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_entity text := TG_ARGV[0];
  v_old jsonb;
  v_new jsonb;
  v_row record;
BEGIN
  PERFORM pg_advisory_xact_lock(7710028);
  IF TG_OP <> 'INSERT' THEN v_old := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN v_new := to_jsonb(NEW); END IF;
  IF TG_OP = 'DELETE' THEN v_row := OLD; ELSE v_row := NEW; END IF;
  INSERT INTO public.qiraat_mutoon_log (work, verse, entity, action, row_id, before, after, client)
  VALUES (v_row.work, v_row.verse, v_entity, lower(TG_OP),
          CASE WHEN v_entity = 'verse' THEN v_row.work || ':' || v_row.verse ELSE (to_jsonb(v_row)->>'id') END,
          v_old, v_new, nullif(current_setting('qiraat.mutoon_client', true), ''));
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS qiraat_mutoon_verses_touch ON public.qiraat_mutoon_verses;
CREATE TRIGGER qiraat_mutoon_verses_touch BEFORE UPDATE ON public.qiraat_mutoon_verses FOR EACH ROW EXECUTE FUNCTION public.qiraat_mutoon_touch();
DROP TRIGGER IF EXISTS qiraat_mutoon_marks_touch ON public.qiraat_mutoon_marks;
CREATE TRIGGER qiraat_mutoon_marks_touch BEFORE UPDATE ON public.qiraat_mutoon_marks FOR EACH ROW EXECUTE FUNCTION public.qiraat_mutoon_touch();
DROP TRIGGER IF EXISTS qiraat_mutoon_assignments_touch ON public.qiraat_mutoon_assignments;
CREATE TRIGGER qiraat_mutoon_assignments_touch BEFORE UPDATE ON public.qiraat_mutoon_assignments FOR EACH ROW EXECUTE FUNCTION public.qiraat_mutoon_touch();

DROP TRIGGER IF EXISTS qiraat_mutoon_verses_log ON public.qiraat_mutoon_verses;
CREATE TRIGGER qiraat_mutoon_verses_log AFTER INSERT OR UPDATE OR DELETE ON public.qiraat_mutoon_verses FOR EACH ROW EXECUTE FUNCTION public.qiraat_mutoon_log_change('verse');
DROP TRIGGER IF EXISTS qiraat_mutoon_marks_log ON public.qiraat_mutoon_marks;
CREATE TRIGGER qiraat_mutoon_marks_log AFTER INSERT OR UPDATE OR DELETE ON public.qiraat_mutoon_marks FOR EACH ROW EXECUTE FUNCTION public.qiraat_mutoon_log_change('mark');
DROP TRIGGER IF EXISTS qiraat_mutoon_assignments_log ON public.qiraat_mutoon_assignments;
CREATE TRIGGER qiraat_mutoon_assignments_log AFTER INSERT OR UPDATE OR DELETE ON public.qiraat_mutoon_assignments FOR EACH ROW EXECUTE FUNCTION public.qiraat_mutoon_log_change('assignment');

-- ---------------------------------------------------------------------------------------------------------------
-- JSON shapes (camelCase, the same names the document and the iOS app already use).
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qiraat_mutoon_seq_now() RETURNS bigint
LANGUAGE sql STABLE SET search_path = public AS $$ SELECT coalesce(max(seq), 0) FROM public.qiraat_mutoon_log $$;

CREATE OR REPLACE FUNCTION public.qiraat_mutoon_mark_json(m public.qiraat_mutoon_marks) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT jsonb_build_object('id', m.id, 'version', m.version, 'work', m.work, 'verse', m.verse, 'line', m.line, 'word', m.word,
    'occurrence', m.occurrence, 'mode', m.mode, 'symbol', m.symbol, 'kind', m.kind, 'readingIds', to_jsonb(m.reading_ids),
    'note', m.note, 'source', m.source, 'status', m.status, 'method', m.method)
$$;

CREATE OR REPLACE FUNCTION public.qiraat_mutoon_assignment_json(a public.qiraat_mutoon_assignments) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT jsonb_build_object('id', a.id, 'version', a.version, 'work', a.work, 'verse', a.verse, 'line', a.line, 'word', a.word,
    'occurrence', a.occurrence, 'mode', a.mode, 'letterIndex', a.letter_index, 'readingIds', to_jsonb(a.reading_ids),
    'note', a.note, 'source', a.source)
$$;

CREATE OR REPLACE FUNCTION public.qiraat_mutoon_verse_row_json(v public.qiraat_mutoon_verses) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT jsonb_build_object('number', v.verse, 'lines', to_jsonb(v.lines), 'printedPage', v.printed_page, 'pageId', v.page_id, 'version', v.version)
$$;

-- One verse with everything attached to it.
CREATE OR REPLACE FUNCTION public.qiraat_mutoon_verse_json(p_work text, p_verse integer) RETURNS jsonb
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT jsonb_build_object(
    'work', v.work, 'chapter', v.chapter_title, 'verse', public.qiraat_mutoon_verse_row_json(v),
    'marks', coalesce((SELECT jsonb_agg(public.qiraat_mutoon_mark_json(m) ORDER BY m.line, m.id) FROM public.qiraat_mutoon_marks m WHERE m.work = v.work AND m.verse = v.verse), '[]'::jsonb),
    'assignments', coalesce((SELECT jsonb_agg(public.qiraat_mutoon_assignment_json(a) ORDER BY a.line, a.id) FROM public.qiraat_mutoon_assignments a WHERE a.work = v.work AND a.verse = v.verse), '[]'::jsonb))
  FROM public.qiraat_mutoon_verses v WHERE v.work = p_work AND v.verse = p_verse
$$;

-- A poem's browser: chapters with verses and per-verse counts (no marks or assignments, so it stays small).
CREATE OR REPLACE FUNCTION public.qiraat_mutoon_work_json(p_work text) RETURNS jsonb
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT jsonb_build_object(
    'seq', public.qiraat_mutoon_seq_now(),
    'work', jsonb_build_object('work', w.work, 'title', w.title, 'author', w.author, 'bookId', w.book_id),
    'chapters', coalesce((
      SELECT jsonb_agg(jsonb_build_object('index', ch.chapter_index, 'title', ch.chapter_title, 'farsh', ch.chapter_farsh, 'verses', ch.verses) ORDER BY ch.chapter_index)
      FROM (
        SELECT v.chapter_index, v.chapter_title, bool_or(v.chapter_farsh) AS chapter_farsh,
               jsonb_agg(public.qiraat_mutoon_verse_row_json(v) || jsonb_build_object(
                 'marks', (SELECT count(*) FROM public.qiraat_mutoon_marks m WHERE m.work = v.work AND m.verse = v.verse),
                 'assignments', (SELECT count(*) FROM public.qiraat_mutoon_assignments a WHERE a.work = v.work AND a.verse = v.verse)
               ) ORDER BY v.position) AS verses
        FROM public.qiraat_mutoon_verses v WHERE v.work = w.work
        GROUP BY v.chapter_index, v.chapter_title
      ) ch), '[]'::jsonb))
  FROM public.qiraat_mutoon_works w WHERE w.work = p_work
$$;

-- Everything, in the shape of the old document (used once by a fresh iOS install and by exports).
CREATE OR REPLACE FUNCTION public.qiraat_mutoon_snapshot_json() RETURNS jsonb
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT jsonb_build_object(
    'seq', public.qiraat_mutoon_seq_now(),
    'mutoon', jsonb_build_object('schemaVersion', 1, 'works', coalesce((
      SELECT jsonb_agg(jsonb_build_object('work', w.work, 'title', w.title, 'author', w.author, 'bookId', w.book_id,
        'chapters', coalesce((
          SELECT jsonb_agg(jsonb_build_object('title', ch.chapter_title, 'farsh', ch.chapter_farsh,
            'verses', ch.verses) ORDER BY ch.chapter_index)
          FROM (
            SELECT v.chapter_index, v.chapter_title, bool_or(v.chapter_farsh) AS chapter_farsh,
                   jsonb_agg(jsonb_build_object('number', v.verse, 'lines', to_jsonb(v.lines), 'printedPage', v.printed_page, 'pageId', v.page_id) ORDER BY v.position) AS verses
            FROM public.qiraat_mutoon_verses v WHERE v.work = w.work GROUP BY v.chapter_index, v.chapter_title
          ) ch), '[]'::jsonb)) ORDER BY w.position)
      FROM public.qiraat_mutoon_works w), '[]'::jsonb)),
    'marks', coalesce((SELECT jsonb_agg(public.qiraat_mutoon_mark_json(m) ORDER BY m.work, m.verse, m.line, m.id) FROM public.qiraat_mutoon_marks m), '[]'::jsonb),
    'assignments', coalesce((SELECT jsonb_agg(public.qiraat_mutoon_assignment_json(a) ORDER BY a.work, a.verse, a.line, a.id) FROM public.qiraat_mutoon_assignments a), '[]'::jsonb))
$$;

-- The verses that changed after p_since, each with its current rows. More than p_limit changed verses means the
-- caller should take a snapshot instead ('full': true).
CREATE OR REPLACE FUNCTION public.qiraat_mutoon_changes_json(p_since bigint, p_limit integer DEFAULT 300) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  v_seq bigint := public.qiraat_mutoon_seq_now();
  v_pairs jsonb;
  v_count integer;
BEGIN
  IF p_since >= v_seq THEN
    RETURN jsonb_build_object('seq', v_seq, 'full', false, 'verses', '[]'::jsonb);
  END IF;
  SELECT count(*) INTO v_count FROM (SELECT DISTINCT work, verse FROM public.qiraat_mutoon_log WHERE seq > p_since) d;
  IF v_count > p_limit THEN
    RETURN jsonb_build_object('seq', v_seq, 'full', true, 'verses', '[]'::jsonb);
  END IF;
  SELECT coalesce(jsonb_agg(public.qiraat_mutoon_verse_json(d.work, d.verse) ORDER BY d.work, d.verse), '[]'::jsonb)
    INTO v_pairs FROM (SELECT DISTINCT work, verse FROM public.qiraat_mutoon_log WHERE seq > p_since) d;
  RETURN jsonb_build_object('seq', v_seq, 'full', false, 'verses', v_pairs);
END;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Atomic operations. Either every operation applies or none does. A stale or missing row raises PT409 (HTTP 409;
-- never SQLSTATE 40001, which PostgREST retries in a loop).
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qiraat_mutoon_conflict(p_what text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'MUTOON_CONFLICT: %', p_what USING ERRCODE = 'PT409';
END;
$$;

CREATE OR REPLACE FUNCTION public.qiraat_mutoon_apply(p_ops jsonb, p_client text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o jsonb;
  t text;
  a public.qiraat_mutoon_assignments;
  m public.qiraat_mutoon_marks;
  v public.qiraat_mutoon_verses;
  results jsonb := '[]'::jsonb;
  v_ids text[];
BEGIN
  IF jsonb_typeof(p_ops) <> 'array' OR jsonb_array_length(p_ops) = 0 OR jsonb_array_length(p_ops) > 200 THEN
    RAISE EXCEPTION 'MUTOON_BAD_OPS' USING ERRCODE = 'PT400';
  END IF;
  PERFORM set_config('qiraat.mutoon_client', coalesce(p_client, ''), true);

  FOR o IN SELECT * FROM jsonb_array_elements(p_ops) LOOP
    t := o->>'t';

    -- 'vv' is the verse version the client edited against: a stale verse (its text changed) refuses the write.
    IF o ? 'vv' AND t IN ('assign_set', 'mark_set') THEN
      IF NOT EXISTS (SELECT 1 FROM public.qiraat_mutoon_verses
                      WHERE work = o->>'work' AND verse = (o->>'verse')::integer AND version = (o->>'vv')::integer) THEN
        PERFORM public.qiraat_mutoon_conflict('verse changed');
      END IF;
    END IF;

    IF t = 'assign_set' THEN
      v_ids := ARRAY(SELECT jsonb_array_elements_text(o->'readingIds'));
      IF o->>'id' IS NULL THEN
        BEGIN
          INSERT INTO public.qiraat_mutoon_assignments (work, verse, line, word, occurrence, mode, letter_index, reading_ids, note, source)
          VALUES (o->>'work', (o->>'verse')::integer, (o->>'line')::smallint, o->>'word', (o->>'occurrence')::integer,
                  coalesce(o->>'mode', 'word'), (o->>'letterIndex')::integer, v_ids, coalesce(o->>'note', ''), coalesce(o->>'source', ''))
          RETURNING * INTO a;
        EXCEPTION WHEN unique_violation THEN
          PERFORM public.qiraat_mutoon_conflict('assignment exists');
        END;
      ELSE
        UPDATE public.qiraat_mutoon_assignments SET mode = coalesce(o->>'mode', 'word'), letter_index = (o->>'letterIndex')::integer,
               reading_ids = v_ids, note = coalesce(o->>'note', ''), source = coalesce(o->>'source', ''),
               line = coalesce((o->>'line')::smallint, line), word = coalesce(o->>'word', word), occurrence = coalesce((o->>'occurrence')::integer, occurrence)
         WHERE id = (o->>'id')::uuid AND version = (o->>'version')::integer RETURNING * INTO a;
        IF NOT FOUND THEN PERFORM public.qiraat_mutoon_conflict('assignment changed'); END IF;
      END IF;
      results := results || jsonb_build_object('entity', 'assignment', 'action', 'set', 'row', public.qiraat_mutoon_assignment_json(a));

    ELSIF t = 'assign_del' THEN
      DELETE FROM public.qiraat_mutoon_assignments WHERE id = (o->>'id')::uuid AND version = (o->>'version')::integer RETURNING * INTO a;
      IF NOT FOUND THEN PERFORM public.qiraat_mutoon_conflict('assignment changed'); END IF;
      results := results || jsonb_build_object('entity', 'assignment', 'action', 'delete', 'id', a.id);

    ELSIF t = 'mark_set' THEN
      v_ids := ARRAY(SELECT jsonb_array_elements_text(o->'readingIds'));
      IF o->>'id' IS NULL THEN
        BEGIN
          INSERT INTO public.qiraat_mutoon_marks (work, verse, line, word, occurrence, mode, symbol, kind, reading_ids, note, source, status, method)
          VALUES (o->>'work', (o->>'verse')::integer, (o->>'line')::smallint, o->>'word', (o->>'occurrence')::integer, o->>'mode', o->>'symbol',
                  o->>'kind', v_ids, coalesce(o->>'note', ''), coalesce(o->>'source', ''), o->>'status', coalesce(o->>'method', 'hand'))
          RETURNING * INTO m;
        EXCEPTION WHEN unique_violation THEN
          PERFORM public.qiraat_mutoon_conflict('mark exists');
        END;
      ELSE
        UPDATE public.qiraat_mutoon_marks SET mode = o->>'mode', symbol = o->>'symbol', kind = o->>'kind', reading_ids = v_ids,
               note = coalesce(o->>'note', ''), source = coalesce(o->>'source', ''), status = o->>'status',
               line = coalesce((o->>'line')::smallint, line), word = coalesce(o->>'word', word), occurrence = coalesce((o->>'occurrence')::integer, occurrence)
         WHERE id = (o->>'id')::uuid AND version = (o->>'version')::integer RETURNING * INTO m;
        IF NOT FOUND THEN PERFORM public.qiraat_mutoon_conflict('mark changed'); END IF;
      END IF;
      results := results || jsonb_build_object('entity', 'mark', 'action', 'set', 'row', public.qiraat_mutoon_mark_json(m));

    ELSIF t = 'mark_del' THEN
      DELETE FROM public.qiraat_mutoon_marks WHERE id = (o->>'id')::uuid AND version = (o->>'version')::integer RETURNING * INTO m;
      IF NOT FOUND THEN PERFORM public.qiraat_mutoon_conflict('mark changed'); END IF;
      results := results || jsonb_build_object('entity', 'mark', 'action', 'delete', 'id', m.id);

    ELSIF t = 'verse_set' THEN
      UPDATE public.qiraat_mutoon_verses SET lines = ARRAY(SELECT jsonb_array_elements_text(o->'lines'))
       WHERE work = o->>'work' AND verse = (o->>'verse')::integer AND version = (o->>'version')::integer RETURNING * INTO v;
      IF NOT FOUND THEN PERFORM public.qiraat_mutoon_conflict('verse changed'); END IF;
      results := results || jsonb_build_object('entity', 'verse', 'action', 'set', 'row', public.qiraat_mutoon_verse_row_json(v));

    ELSE
      RAISE EXCEPTION 'MUTOON_BAD_OP: %', coalesce(t, 'null') USING ERRCODE = 'PT400';
    END IF;
  END LOOP;

  RETURN jsonb_build_object('seq', public.qiraat_mutoon_seq_now(), 'results', results);
END;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Access: service role only.
-- ---------------------------------------------------------------------------------------------------------------
ALTER TABLE public.qiraat_mutoon_works ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qiraat_mutoon_verses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qiraat_mutoon_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qiraat_mutoon_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qiraat_mutoon_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.qiraat_mutoon_works, public.qiraat_mutoon_verses, public.qiraat_mutoon_marks, public.qiraat_mutoon_assignments,
  public.qiraat_mutoon_log FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qiraat_mutoon_works, public.qiraat_mutoon_verses, public.qiraat_mutoon_marks,
  public.qiraat_mutoon_assignments, public.qiraat_mutoon_log TO service_role;
GRANT USAGE ON SEQUENCE public.qiraat_mutoon_seq TO service_role;

REVOKE ALL ON FUNCTION public.qiraat_mutoon_apply(jsonb, text), public.qiraat_mutoon_changes_json(bigint, integer),
  public.qiraat_mutoon_snapshot_json(), public.qiraat_mutoon_work_json(text), public.qiraat_mutoon_verse_json(text, integer),
  public.qiraat_mutoon_seq_now(), public.qiraat_mutoon_conflict(text), public.qiraat_mutoon_touch(), public.qiraat_mutoon_log_change(),
  public.qiraat_mutoon_mark_json(public.qiraat_mutoon_marks), public.qiraat_mutoon_assignment_json(public.qiraat_mutoon_assignments),
  public.qiraat_mutoon_verse_row_json(public.qiraat_mutoon_verses) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qiraat_mutoon_apply(jsonb, text), public.qiraat_mutoon_changes_json(bigint, integer),
  public.qiraat_mutoon_snapshot_json(), public.qiraat_mutoon_work_json(text), public.qiraat_mutoon_verse_json(text, integer),
  public.qiraat_mutoon_seq_now(), public.qiraat_mutoon_conflict(text),
  public.qiraat_mutoon_mark_json(public.qiraat_mutoon_marks), public.qiraat_mutoon_assignment_json(public.qiraat_mutoon_assignments),
  public.qiraat_mutoon_verse_row_json(public.qiraat_mutoon_verses) TO service_role;

COMMIT;
NOTIFY pgrst, 'reload schema';
