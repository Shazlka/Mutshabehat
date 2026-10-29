-- Adds the أصول باب «هاء السكت» to the review editor's categories, next to السكت / النقل / التحقيق.
-- Word-anchored (an entry sits on a word, so the Mushaf colours it); no rasm change.
-- Existing entries that mention هاء السكت under السكت / النقل are left where they are.
-- Rollback: supabase/rollbacks/20261029120000_add_usul_ha_sakt_category.down.sql
INSERT INTO qiraat_categories (code, name_ar, name_en, is_word_anchored, changes_rasm, sort_order)
VALUES ('USUL_HA_SAKT', 'هاء السكت', 'Ha al-sakt', true, false, 19)
ON CONFLICT (code) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  is_word_anchored = EXCLUDED.is_word_anchored,
  sort_order = EXCLUDED.sort_order;

NOTIFY pgrst, 'reload schema';
