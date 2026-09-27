-- Rollback for 20260927100000_qiraat_review_safe_variant_type.sql
-- Restores direct casting in qiraat_review_create_entry and qiraat_review_update_entry

DROP FUNCTION IF EXISTS qiraat_to_variant_type(text);

NOTIFY pgrst, 'reload schema';
