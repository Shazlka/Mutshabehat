DROP FUNCTION IF EXISTS qiraat_review_suggestions(integer, integer, integer, integer);
DROP FUNCTION IF EXISTS qiraat_suggestion_config(text, boolean);
NOTIFY pgrst, 'reload schema';
