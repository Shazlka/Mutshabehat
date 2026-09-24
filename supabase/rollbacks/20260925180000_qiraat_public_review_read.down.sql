-- Rollback: 20260925180000_qiraat_public_review_read.down.sql
BEGIN;

REVOKE EXECUTE ON FUNCTION qiraat_review_row(text) FROM anon;
REVOKE EXECUTE ON FUNCTION qiraat_review_page(integer, boolean) FROM anon;

COMMIT;
