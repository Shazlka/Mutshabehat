-- Adds the أصول باب «التسهيل» to the review editor's categories, next to تحقيق / النقل / الإبدال.
-- Word-anchored (an entry sits on a word, so the Mushaf colours it); no rasm change.
-- Rollback: supabase/rollbacks/20261006120000_add_usul_tashil_category.down.sql
INSERT INTO qiraat_categories (code, name_ar, name_en, is_word_anchored, changes_rasm, sort_order)
VALUES ('USUL_TASHIL', 'التسهيل', 'Tashil', true, false, 18)
ON CONFLICT (code) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  is_word_anchored = EXCLUDED.is_word_anchored,
  sort_order = EXCLUDED.sort_order;

NOTIFY pgrst, 'reload schema';
