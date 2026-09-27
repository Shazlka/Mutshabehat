-- Migration: Add 'تحقيق' and 'الإبدال' to qiraat_categories and prioritize with 'النقل'
INSERT INTO qiraat_categories (code, name_ar, name_en, is_word_anchored, changes_rasm, sort_order)
VALUES
  ('USUL_TAHQIQ', 'تحقيق', 'Tahqiq', true, false, 15),
  ('USUL_NAQL', 'النقل', 'Naql', true, false, 16),
  ('USUL_IBDAL', 'الإبدال', 'Ibdal', true, false, 17)
ON CONFLICT (code) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  is_word_anchored = EXCLUDED.is_word_anchored,
  sort_order = EXCLUDED.sort_order;
