DROP TRIGGER IF EXISTS qiraat_entry_insert_revives_locus ON qiraat_entries;
DROP FUNCTION IF EXISTS qiraat_entry_insert_revives_locus();
NOTIFY pgrst, 'reload schema';
