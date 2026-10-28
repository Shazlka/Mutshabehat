BEGIN;
DROP TABLE IF EXISTS public.qiraat_mutoon_revisions;
DROP TABLE IF EXISTS public.qiraat_mutoon_documents;
DROP FUNCTION IF EXISTS public.qiraat_mutoon_save_revision();
COMMIT;
