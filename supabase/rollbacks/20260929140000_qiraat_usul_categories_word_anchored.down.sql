UPDATE qiraat_categories SET is_word_anchored = false
 WHERE code IN ('USUL_MIM_JAM', 'USUL_MADD', 'USUL_SAKT');
NOTIFY pgrst, 'reload schema';
