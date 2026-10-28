-- Private, versioned poem data for the web editor. No authenticated/anon table access:
-- the server route verifies the existing Supabase session before using the service role.
BEGIN;
CREATE TABLE IF NOT EXISTS public.qiraat_mutoon_documents (
  id text PRIMARY KEY CHECK (id = 'current'),
  revision bigint NOT NULL CHECK (revision > 0),
  document jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.qiraat_mutoon_revisions (
  revision bigint PRIMARY KEY,
  document jsonb NOT NULL,
  saved_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.qiraat_mutoon_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qiraat_mutoon_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.qiraat_mutoon_documents, public.qiraat_mutoon_revisions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.qiraat_mutoon_documents TO service_role;
GRANT SELECT, INSERT, DELETE ON public.qiraat_mutoon_revisions TO service_role;
CREATE OR REPLACE FUNCTION public.qiraat_mutoon_save_revision() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.qiraat_mutoon_revisions(revision, document) VALUES (OLD.revision, OLD.document);
  DELETE FROM public.qiraat_mutoon_revisions WHERE revision <= NEW.revision - 21;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS qiraat_mutoon_revision_before_update ON public.qiraat_mutoon_documents;
CREATE TRIGGER qiraat_mutoon_revision_before_update BEFORE UPDATE ON public.qiraat_mutoon_documents
FOR EACH ROW EXECUTE FUNCTION public.qiraat_mutoon_save_revision();
REVOKE ALL ON FUNCTION public.qiraat_mutoon_save_revision() FROM PUBLIC, anon, authenticated;
COMMIT;
