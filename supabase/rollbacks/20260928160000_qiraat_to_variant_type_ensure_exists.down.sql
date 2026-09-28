-- Rollback for 20260928160000_qiraat_to_variant_type_ensure_exists.sql
-- Drops qiraat_to_variant_type(text). NOTE: reverting this reintroduces the
-- "function qiraat_to_variant_type(text) does not exist" failure on every farsh/variant
-- create -- do not use except to bisect. qiraat_review_create_entry and
-- qiraat_review_update_entry both call this function.

DROP FUNCTION IF EXISTS qiraat_to_variant_type(text);

NOTIFY pgrst, 'reload schema';
