-- Deleting the last entry of a locus soft-deletes the locus. qiraat_review_create_entry (and copy)
-- then re-uses that locus by position without checking deleted_at, so the new entry hangs on a
-- hidden locus and qiraat_export_page (which requires l.deleted_at IS NULL) never shows it on the
-- Mushaf. Fix at the source: inserting a live entry revives its locus. Also repairs existing rows.
-- Rollback: supabase/rollbacks/20260929150000_qiraat_entry_insert_revives_locus.down.sql

CREATE OR REPLACE FUNCTION qiraat_entry_insert_revives_locus() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.deleted_at IS NULL THEN
    UPDATE qiraat_loci SET deleted_at = NULL
     WHERE id = NEW.locus_id AND deleted_at IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS qiraat_entry_insert_revives_locus ON qiraat_entries;
CREATE TRIGGER qiraat_entry_insert_revives_locus
  AFTER INSERT ON qiraat_entries
  FOR EACH ROW EXECUTE FUNCTION qiraat_entry_insert_revives_locus();

-- Repair: loci that are deleted but still carry a live, non-rejected entry.
UPDATE qiraat_loci l SET deleted_at = NULL
 WHERE l.deleted_at IS NOT NULL
   AND EXISTS (SELECT 1 FROM qiraat_entries e
                WHERE e.locus_id = l.id AND e.deleted_at IS NULL
                  AND e.verification_status <> 'REJECTED');

NOTIFY pgrst, 'reload schema';
