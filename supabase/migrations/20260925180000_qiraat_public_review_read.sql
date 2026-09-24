-- Migration: 20260925180000_qiraat_public_review_read.sql
-- Purpose: Allow anon role to read active review rows via qiraat_review_page and qiraat_review_row
-- so the public Quran reader (/mushaf-1441) displays live reviewed data without requiring login.

BEGIN;

GRANT EXECUTE ON FUNCTION qiraat_review_row(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION qiraat_review_page(integer, boolean) TO anon, authenticated;

COMMIT;
