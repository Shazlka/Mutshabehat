-- متون editor: the شرح (commentary) of each verse, editable in the web editor.
--
-- The text is book text and stays out of the public repository: this migration only creates the table. It is loaded
-- from the owner's private file with scripts/qiraat/import_mutoon_sharh.py (idempotent, ON CONFLICT DO NOTHING).
-- Edits are versioned and logged like every other mutoon row, so the change feed carries them.
BEGIN;

CREATE TABLE IF NOT EXISTS public.qiraat_mutoon_sharh (
  work text NOT NULL,
  verse integer NOT NULL,
  text text NOT NULL CHECK (length(text) BETWEEN 1 AND 40000),
  title text NOT NULL DEFAULT '',
  author text NOT NULL DEFAULT '',
  pages text[] NOT NULL DEFAULT '{}',
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (work, verse),
  FOREIGN KEY (work, verse) REFERENCES public.qiraat_mutoon_verses(work, verse)
);

ALTER TABLE public.qiraat_mutoon_log DROP CONSTRAINT IF EXISTS qiraat_mutoon_log_entity_check;
ALTER TABLE public.qiraat_mutoon_log ADD CONSTRAINT qiraat_mutoon_log_entity_check CHECK (entity IN ('verse', 'mark', 'assignment', 'sharh'));

-- The log row id of a verse or a شرح is its "work:verse".
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
          CASE WHEN v_entity IN ('verse', 'sharh') THEN v_row.work || ':' || v_row.verse ELSE (to_jsonb(v_row)->>'id') END,
          v_old, v_new, nullif(current_setting('qiraat.mutoon_client', true), ''));
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS qiraat_mutoon_sharh_touch ON public.qiraat_mutoon_sharh;
CREATE TRIGGER qiraat_mutoon_sharh_touch BEFORE UPDATE ON public.qiraat_mutoon_sharh FOR EACH ROW EXECUTE FUNCTION public.qiraat_mutoon_touch();
DROP TRIGGER IF EXISTS qiraat_mutoon_sharh_log ON public.qiraat_mutoon_sharh;
CREATE TRIGGER qiraat_mutoon_sharh_log AFTER INSERT OR UPDATE OR DELETE ON public.qiraat_mutoon_sharh FOR EACH ROW EXECUTE FUNCTION public.qiraat_mutoon_log_change('sharh');

CREATE OR REPLACE FUNCTION public.qiraat_mutoon_sharh_json(s public.qiraat_mutoon_sharh) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT jsonb_build_object('work', s.work, 'verse', s.verse, 'text', s.text, 'title', s.title, 'author', s.author,
    'pages', to_jsonb(s.pages), 'version', s.version)
$$;

CREATE OR REPLACE FUNCTION public.qiraat_mutoon_verse_json(p_work text, p_verse integer) RETURNS jsonb
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT jsonb_build_object(
    'work', v.work, 'chapter', v.chapter_title, 'verse', public.qiraat_mutoon_verse_row_json(v),
    'sharh', (SELECT public.qiraat_mutoon_sharh_json(sh) FROM public.qiraat_mutoon_sharh sh WHERE sh.work = v.work AND sh.verse = v.verse),
    'marks', coalesce((SELECT jsonb_agg(public.qiraat_mutoon_mark_json(m) ORDER BY m.line, m.id) FROM public.qiraat_mutoon_marks m WHERE m.work = v.work AND m.verse = v.verse), '[]'::jsonb),
    'assignments', coalesce((SELECT jsonb_agg(public.qiraat_mutoon_assignment_json(a) ORDER BY a.line, a.id) FROM public.qiraat_mutoon_assignments a WHERE a.work = v.work AND a.verse = v.verse), '[]'::jsonb))
  FROM public.qiraat_mutoon_verses v WHERE v.work = p_work AND v.verse = p_verse
$$;

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
                 'assignments', (SELECT count(*) FROM public.qiraat_mutoon_assignments a WHERE a.work = v.work AND a.verse = v.verse),
                 'sharh', EXISTS (SELECT 1 FROM public.qiraat_mutoon_sharh sh WHERE sh.work = v.work AND sh.verse = v.verse)
               ) ORDER BY v.position) AS verses
        FROM public.qiraat_mutoon_verses v WHERE v.work = w.work
        GROUP BY v.chapter_index, v.chapter_title
      ) ch), '[]'::jsonb))
  FROM public.qiraat_mutoon_works w WHERE w.work = p_work
$$;

CREATE OR REPLACE FUNCTION public.qiraat_mutoon_apply(p_ops jsonb, p_client text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o jsonb;
  t text;
  a public.qiraat_mutoon_assignments;
  m public.qiraat_mutoon_marks;
  v public.qiraat_mutoon_verses;
  sh public.qiraat_mutoon_sharh;
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

    ELSIF t = 'sharh_set' THEN
      IF o->>'version' IS NULL THEN
        BEGIN
          INSERT INTO public.qiraat_mutoon_sharh (work, verse, text, title, author, pages)
          VALUES (o->>'work', (o->>'verse')::integer, o->>'text', coalesce(o->>'title', ''), coalesce(o->>'author', ''),
                  ARRAY(SELECT jsonb_array_elements_text(coalesce(o->'pages', '[]'::jsonb))))
          RETURNING * INTO sh;
        EXCEPTION WHEN unique_violation THEN
          PERFORM public.qiraat_mutoon_conflict('sharh exists');
        END;
      ELSE
        UPDATE public.qiraat_mutoon_sharh SET text = o->>'text', title = coalesce(o->>'title', title), author = coalesce(o->>'author', author),
               pages = CASE WHEN o ? 'pages' THEN ARRAY(SELECT jsonb_array_elements_text(o->'pages')) ELSE pages END
         WHERE work = o->>'work' AND verse = (o->>'verse')::integer AND version = (o->>'version')::integer RETURNING * INTO sh;
        IF NOT FOUND THEN PERFORM public.qiraat_mutoon_conflict('sharh changed'); END IF;
      END IF;
      results := results || jsonb_build_object('entity', 'sharh', 'action', 'set', 'row', public.qiraat_mutoon_sharh_json(sh));

    ELSIF t = 'sharh_del' THEN
      DELETE FROM public.qiraat_mutoon_sharh WHERE work = o->>'work' AND verse = (o->>'verse')::integer AND version = (o->>'version')::integer RETURNING * INTO sh;
      IF NOT FOUND THEN PERFORM public.qiraat_mutoon_conflict('sharh changed'); END IF;
      results := results || jsonb_build_object('entity', 'sharh', 'action', 'delete', 'work', sh.work, 'verse', sh.verse);

    ELSE
      RAISE EXCEPTION 'MUTOON_BAD_OP: %', coalesce(t, 'null') USING ERRCODE = 'PT400';
    END IF;
  END LOOP;

  RETURN jsonb_build_object('seq', public.qiraat_mutoon_seq_now(), 'results', results);
END;
$$;

ALTER TABLE public.qiraat_mutoon_sharh ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.qiraat_mutoon_sharh FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qiraat_mutoon_sharh TO service_role;
REVOKE ALL ON FUNCTION public.qiraat_mutoon_sharh_json(public.qiraat_mutoon_sharh) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qiraat_mutoon_sharh_json(public.qiraat_mutoon_sharh) TO service_role;
-- CREATE OR REPLACE keeps the grants of the functions replaced above.

COMMIT;
NOTIFY pgrst, 'reload schema';
