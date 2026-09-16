-- Migration: 20260916121000_qiraat_page_001_seed.sql
-- Description: Idempotent seed data for Mushaf 1441 Page 1 (Surah Al-Fatihah) Qira'at pilot.

-- 1. Insert Source
insert into public.qiraat_sources (id, title, edition, source_type, file_name, total_pages, notes)
values (
  'ten-qiraat-mushaf-1',
  'مصحف القراءات العشر',
  'النسخة المطبوعة الأولى',
  'scanned_mushaf_with_margin',
  'مصحف القراءات العشر-1.pdf',
  604,
  'المصدر المعتمد للقراءات العشر الصغرى من طريقي الشاطبية والدرة'
)
on conflict (id) do update set
  title = excluded.title,
  edition = excluded.edition,
  notes = excluded.notes;

-- 2. Insert Persons (Imams and Narrators required for Page 1)
insert into public.qiraat_persons (id, canonical_name, display_name, person_type, parent_person_id, order_index, alias, notes)
values
  ('NAFI', 'نافع بن عبد الرحمن المدني', 'نافع', 'imam', null, 1, 'الإمام نافع', 'الإمام الأول من القراء العشرة'),
  ('IBN_KATHIR', 'عبد الله بن كثير المكي', 'ابن كثير', 'imam', null, 2, 'الإمام ابن كثير', 'الإمام الثاني من القراء العشرة'),
  ('AL_BAZZI', 'أحمد بن محمد البزي', 'البزي', 'rawi', 'IBN_KATHIR', 1, 'البزي عن ابن كثير', 'الراوي الأول عن ابن كثير'),
  ('QUNBUL', 'محمد بن عبد الرحمن قنبل', 'قنبل', 'rawi', 'IBN_KATHIR', 2, 'قنبل عن ابن كثير', 'الراوي الثاني عن ابن كثير'),
  ('ABU_AMR', 'أبو عمرو بن العلاء البصري', 'أبو عمرو', 'imam', null, 3, 'الإمام أبو عمرو', 'الإمام الثالث من القراء العشرة'),
  ('IBN_AMIR', 'عبد الله بن عامر الشامي', 'ابن عامر', 'imam', null, 4, 'الإمام ابن عامر', 'الإمام الرابع من القراء العشرة'),
  ('ASIM', 'عاصم بن أبي النجود الكوفي', 'عاصم', 'imam', null, 5, 'الإمام عاصم', 'الإمام الخامس من القراء العشرة'),
  ('HAMZA', 'حمزة بن حبيب الزيات الكوفي', 'حمزة', 'imam', null, 6, 'الإمام حمزة', 'الإمام السادس من القراء العشرة'),
  ('KHALAF_HAMZA', 'خلف بن هشام البزار (عن حمزة)', 'خلف عن حمزة', 'rawi', 'HAMZA', 1, 'خلف الراوي عن حمزة', 'الراوي الأول عن الإمام حمزة (يتميز عن خلف العاشر)'),
  ('KHALLAD', 'خلاد بن خالد الصيرفي', 'خلاد', 'rawi', 'HAMZA', 2, 'خلاد عن حمزة', 'الراوي الثاني عن الإمام حمزة'),
  ('AL_KISAI', 'علي بن حمزة الكسائي', 'الكسائي', 'imam', null, 7, 'الإمام الكسائي', 'الإمام السابع من القراء العشرة'),
  ('ABU_JAFAR', 'يزيد بن القعقاع أبو جعفر المدني', 'أبو جعفر', 'imam', null, 8, 'الإمام أبو جعفر', 'الإمام الثامن من القراء العشرة'),
  ('YAQUB', 'يعقوب بن إسحاق الحضرمي', 'يعقوب', 'imam', null, 9, 'الإمام يعقوب', 'الإمام التاسع من القراء العشرة'),
  ('RUWAYS', 'محمد بن المتوكل رويس', 'رويس', 'rawi', 'YAQUB', 1, 'رويس عن يعقوب', 'الراوي الأول عن يعقوب الحضرمي'),
  ('RAWH', 'روح بن عبد المؤمن البصري', 'روح', 'rawi', 'YAQUB', 2, 'روح عن يعقوب', 'الراوي الثاني عن يعقوب الحضرمي'),
  ('KHALAF_ASHIR', 'خلف بن هشام البزار (العاشر)', 'خلف', 'imam', null, 10, 'خلف العاشر', 'الإمام العاشر بذاته في اختياره (يتميز عن روايته عن حمزة)')
on conflict (id) do update set
  canonical_name = excluded.canonical_name,
  display_name = excluded.display_name,
  person_type = excluded.person_type,
  parent_person_id = excluded.parent_person_id,
  order_index = excluded.order_index,
  alias = excluded.alias,
  notes = excluded.notes;

-- 3. Insert Loci for Page 1
do $$
declare
  v_src text := 'ten-qiraat-mushaf-1';
  v_loc1 uuid;
  v_loc2 uuid;
  v_loc3 uuid;
  v_loc4 uuid;
  v_var1_1 uuid;
  v_var1_2 uuid;
  v_var2_1 uuid;
  v_var2_2 uuid;
  v_var2_3 uuid;
  v_var3_1 uuid;
  v_var3_2 uuid;
  v_var3_3 uuid;
  v_var4_1 uuid;
  v_var4_2 uuid;
begin

  -- Locus 1: 1:4 مَـٰلِكِ
  insert into public.qiraat_loci (source_id, locus_key, mushaf_page, surah, ayah, source_marker, marker_display, source_heading_raw, source_word_raw, mushaf_base_word, pdf_page, printed_page, status, requires_manual_review, notes)
  values (v_src, '1:4:1', 1, 1, 4, '1', '(١)', '﴿ مَلِكِ ﴾ (١) فيها قراءتان:', 'مَلِكِ', 'مَـٰلِكِ', 6, 1, 'verified', false, 'قراءتان في إثبات الألف وحذفها')
  on conflict (locus_key) do update set status = 'verified'
  returning id into v_loc1;

  -- Targets for Locus 1
  insert into public.qiraat_targets (locus_id, quran_word_id, surah, ayah, word_index, mushaf_page, line_number, word_index_in_line, base_text_uthmani, normalized_text)
  values (v_loc1, 'qurancom-word-3252', 1, 4, 1, 1, 4, 4, 'مَـٰلِكِ', 'مالك')
  on conflict (locus_id, quran_word_id) do nothing;

  -- Variants for Locus 1
  insert into public.qiraat_variants (locus_id, variant_index, display_text, normalized_text, performance_type, performance_text, source_line_raw, sort_order)
  values (v_loc1, 1, 'مَالِكِ', 'مالك', 'orthographic_alef', 'بإثبات الألف بعد الميم', '١- مَالِكِ : عاصم، الكسائي، يعقوب، خلف.', 1)
  on conflict (locus_id, variant_index) do update set display_text = excluded.display_text
  returning id into v_var1_1;

  insert into public.qiraat_variants (locus_id, variant_index, display_text, normalized_text, performance_type, performance_text, source_line_raw, sort_order)
  values (v_loc1, 2, 'مَلِكِ', 'ملك', 'orthographic_alef', 'بحذف الألف بعد الميم', '٢- مَلِكِ : نافع، ابن كثير، أبو عمرو، ابن عامر، حمزة، أبو جعفر.', 2)
  on conflict (locus_id, variant_index) do update set display_text = excluded.display_text
  returning id into v_var1_2;

  -- Attributions for Locus 1 Variant 1
  insert into public.qiraat_attributions (variant_id, person_id, attribution_raw, role, sort_order) values
    (v_var1_1, 'ASIM', 'عاصم', 'imam', 1),
    (v_var1_1, 'AL_KISAI', 'الكسائي', 'imam', 2),
    (v_var1_1, 'YAQUB', 'يعقوب', 'imam', 3),
    (v_var1_1, 'KHALAF_ASHIR', 'خلف', 'imam', 4)
  on conflict (variant_id, person_id) do nothing;

  -- Attributions for Locus 1 Variant 2
  insert into public.qiraat_attributions (variant_id, person_id, attribution_raw, role, sort_order) values
    (v_var1_2, 'NAFI', 'نافع', 'imam', 1),
    (v_var1_2, 'IBN_KATHIR', 'ابن كثير', 'imam', 2),
    (v_var1_2, 'ABU_AMR', 'أبو عمرو', 'imam', 3),
    (v_var1_2, 'IBN_AMIR', 'ابن عامر', 'imam', 4),
    (v_var1_2, 'HAMZA', 'حمزة', 'imam', 5),
    (v_var1_2, 'ABU_JAFAR', 'أبو جعفر', 'imam', 6)
  on conflict (variant_id, person_id) do nothing;


  -- Locus 2: 1:6 ٱلصِّرَٰطَ
  insert into public.qiraat_loci (source_id, locus_key, mushaf_page, surah, ayah, source_marker, marker_display, source_heading_raw, source_word_raw, mushaf_base_word, pdf_page, printed_page, status, requires_manual_review, notes)
  values (v_src, '1:6:2', 1, 1, 6, '2', '(٢)', '﴿ ٱلصِّرَٰطَ ﴾ (٢) فيها ثلاث قراءات:', 'ٱلصِّرَٰطَ', 'ٱلصِّرَٰطَ', 6, 1, 'verified', false, 'المعرف بأل: الصراط المعرفة')
  on conflict (locus_key) do update set status = 'verified'
  returning id into v_loc2;

  -- Targets for Locus 2
  insert into public.qiraat_targets (locus_id, quran_word_id, surah, ayah, word_index, mushaf_page, line_number, word_index_in_line, base_text_uthmani, normalized_text)
  values (v_loc2, 'qurancom-word-6845', 1, 6, 2, 1, 6, 1, 'ٱلصِّرَٰطَ', 'الصراط')
  on conflict (locus_id, quran_word_id) do nothing;

  -- Variants for Locus 2
  insert into public.qiraat_variants (locus_id, variant_index, display_text, normalized_text, performance_type, performance_text, source_line_raw, sort_order)
  values (v_loc2, 1, 'ٱلصِّرَاطَ', 'الصراط', 'pure_sad', 'بالصاد الخالصة', '١- ٱلصِّرَاطَ : نافع، البزي، أبو عمرو، ابن عامر، عاصم، الكسائي، أبو جعفر، روح، خلف.', 1)
  on conflict (locus_id, variant_index) do update set display_text = excluded.display_text
  returning id into v_var2_1;

  insert into public.qiraat_variants (locus_id, variant_index, display_text, normalized_text, performance_type, performance_text, source_line_raw, sort_order)
  values (v_loc2, 2, 'ٱلسِّرَاطَ', 'السراط', 'pure_seen', 'بالسين الخالصة', '٢- ٱلسِّرَاطَ : قنبل، رويس.', 2)
  on conflict (locus_id, variant_index) do update set display_text = excluded.display_text
  returning id into v_var2_2;

  insert into public.qiraat_variants (locus_id, variant_index, display_text, normalized_text, performance_type, performance_text, source_line_raw, sort_order)
  values (v_loc2, 3, 'ٱلصِّرَاطَ', 'الصراط', 'ishmam_sad_zay', 'بإشمام الصاد زايًا', '٣- ٱلصِّرَاطَ (بإشمام الصاد زايًا) : حمزة.', 3)
  on conflict (locus_id, variant_index) do update set display_text = excluded.display_text
  returning id into v_var2_3;

  -- Attributions for Locus 2 Variant 1
  insert into public.qiraat_attributions (variant_id, person_id, attribution_raw, role, parent_person_id, sort_order) values
    (v_var2_1, 'NAFI', 'نافع', 'imam', null, 1),
    (v_var2_1, 'AL_BAZZI', 'البزي', 'rawi', 'IBN_KATHIR', 2),
    (v_var2_1, 'ABU_AMR', 'أبو عمرو', 'imam', null, 3),
    (v_var2_1, 'IBN_AMIR', 'ابن عامر', 'imam', null, 4),
    (v_var2_1, 'ASIM', 'عاصم', 'imam', null, 5),
    (v_var2_1, 'AL_KISAI', 'الكسائي', 'imam', null, 6),
    (v_var2_1, 'ABU_JAFAR', 'أبو جعفر', 'imam', null, 7),
    (v_var2_1, 'RAWH', 'روح', 'rawi', 'YAQUB', 8),
    (v_var2_1, 'KHALAF_ASHIR', 'خلف', 'imam', null, 9)
  on conflict (variant_id, person_id) do nothing;

  -- Attributions for Locus 2 Variant 2
  insert into public.qiraat_attributions (variant_id, person_id, attribution_raw, role, parent_person_id, sort_order) values
    (v_var2_2, 'QUNBUL', 'قنبل', 'rawi', 'IBN_KATHIR', 1),
    (v_var2_2, 'RUWAYS', 'رويس', 'rawi', 'YAQUB', 2)
  on conflict (variant_id, person_id) do nothing;

  -- Attributions for Locus 2 Variant 3
  insert into public.qiraat_attributions (variant_id, person_id, attribution_raw, role, sort_order) values
    (v_var2_3, 'HAMZA', 'حمزة', 'imam', 1)
  on conflict (variant_id, person_id) do nothing;


  -- Locus 3: 1:7 صِرَٰطَ
  insert into public.qiraat_loci (source_id, locus_key, mushaf_page, surah, ayah, source_marker, marker_display, source_heading_raw, source_word_raw, mushaf_base_word, pdf_page, printed_page, status, requires_manual_review, notes)
  values (v_src, '1:7:1', 1, 1, 7, '3', '(٣)', '﴿ صِرَٰطَ ﴾ (٣) فيها ثلاث قراءات:', 'صِرَٰطَ', 'صِرَٰطَ', 6, 1, 'verified', false, 'المنكر: صراط المنكرة بدون أل')
  on conflict (locus_key) do update set status = 'verified'
  returning id into v_loc3;

  -- Targets for Locus 3
  insert into public.qiraat_targets (locus_id, quran_word_id, surah, ayah, word_index, mushaf_page, line_number, word_index_in_line, base_text_uthmani, normalized_text)
  values (v_loc3, 'qurancom-word-8411', 1, 7, 1, 1, 6, 4, 'صِرَٰطَ', 'صراط')
  on conflict (locus_id, quran_word_id) do nothing;

  -- Variants for Locus 3
  insert into public.qiraat_variants (locus_id, variant_index, display_text, normalized_text, performance_type, performance_text, source_line_raw, sort_order)
  values (v_loc3, 1, 'صِرَاطَ', 'صراط', 'pure_sad', 'بالصاد الخالصة', '١- صِرَاطَ : نافع، البزي، أبو عمرو، ابن عامر، خلاد، عاصم، الكسائي، أبو جعفر، روح، خلف.', 1)
  on conflict (locus_id, variant_index) do update set display_text = excluded.display_text
  returning id into v_var3_1;

  insert into public.qiraat_variants (locus_id, variant_index, display_text, normalized_text, performance_type, performance_text, source_line_raw, sort_order)
  values (v_loc3, 2, 'سِرَاطَ', 'سراط', 'pure_seen', 'بالسين الخالصة', '٢- سِرَاطَ : قنبل، رويس.', 2)
  on conflict (locus_id, variant_index) do update set display_text = excluded.display_text
  returning id into v_var3_2;

  insert into public.qiraat_variants (locus_id, variant_index, display_text, normalized_text, performance_type, performance_text, source_line_raw, sort_order)
  values (v_loc3, 3, 'صِرَاطَ', 'صراط', 'ishmam_sad_zay', 'بإشمام الصاد زايًا', '٣- صِرَاطَ (بإشمام الصاد زايًا) : خلف عن حمزة.', 3)
  on conflict (locus_id, variant_index) do update set display_text = excluded.display_text
  returning id into v_var3_3;

  -- Attributions for Locus 3 Variant 1
  insert into public.qiraat_attributions (variant_id, person_id, attribution_raw, role, parent_person_id, sort_order) values
    (v_var3_1, 'NAFI', 'نافع', 'imam', null, 1),
    (v_var3_1, 'AL_BAZZI', 'البزي', 'rawi', 'IBN_KATHIR', 2),
    (v_var3_1, 'ABU_AMR', 'أبو عمرو', 'imam', null, 3),
    (v_var3_1, 'IBN_AMIR', 'ابن عامر', 'imam', null, 4),
    (v_var3_1, 'KHALLAD', 'خلاد', 'rawi', 'HAMZA', 5),
    (v_var3_1, 'ASIM', 'عاصم', 'imam', null, 6),
    (v_var3_1, 'AL_KISAI', 'الكسائي', 'imam', null, 7),
    (v_var3_1, 'ABU_JAFAR', 'أبو جعفر', 'imam', null, 8),
    (v_var3_1, 'RAWH', 'روح', 'rawi', 'YAQUB', 9),
    (v_var3_1, 'KHALAF_ASHIR', 'خلف', 'imam', null, 10)
  on conflict (variant_id, person_id) do nothing;

  -- Attributions for Locus 3 Variant 2
  insert into public.qiraat_attributions (variant_id, person_id, attribution_raw, role, parent_person_id, sort_order) values
    (v_var3_2, 'QUNBUL', 'قنبل', 'rawi', 'IBN_KATHIR', 1),
    (v_var3_2, 'RUWAYS', 'رويس', 'rawi', 'YAQUB', 2)
  on conflict (variant_id, person_id) do nothing;

  -- Attributions for Locus 3 Variant 3
  insert into public.qiraat_attributions (variant_id, person_id, attribution_raw, role, parent_person_id, sort_order) values
    (v_var3_3, 'KHALAF_HAMZA', 'خلف عن حمزة', 'rawi', 'HAMZA', 1)
  on conflict (variant_id, person_id) do nothing;


  -- Locus 4: 1:7 عَلَيْهِمْ (معًا)
  insert into public.qiraat_loci (source_id, locus_key, mushaf_page, surah, ayah, source_marker, marker_display, source_heading_raw, source_word_raw, mushaf_base_word, pdf_page, printed_page, status, requires_manual_review, notes)
  values (v_src, '1:7:4_7', 1, 1, 7, '4', '(٤)', '﴿ عَلَيْهِمْ ﴾ (٤) (معًا) فيها قراءتان:', 'عَلَيْهِمْ', 'عَلَيْهِمْ', 6, 1, 'verified', false, 'معًا: تنطبق على موضعي أَنْعَمْتَ عَلَيْهِمْ و الْمَغْضُوبِ عَلَيْهِمْ')
  on conflict (locus_key) do update set status = 'verified'
  returning id into v_loc4;

  -- Targets for Locus 4 (TWO targets for "معًا")
  insert into public.qiraat_targets (locus_id, quran_word_id, surah, ayah, word_index, mushaf_page, line_number, word_index_in_line, base_text_uthmani, normalized_text)
  values
    (v_loc4, 'qurancom-word-8414', 1, 7, 4, 1, 7, 1, 'عَلَيْهِمْ', 'عليهم'),
    (v_loc4, 'qurancom-word-8417', 1, 7, 7, 1, 7, 4, 'عَلَيْهِمْ', 'عليهم')
  on conflict (locus_id, quran_word_id) do nothing;

  -- Variants for Locus 4
  insert into public.qiraat_variants (locus_id, variant_index, display_text, normalized_text, performance_type, performance_text, source_line_raw, sort_order)
  values (v_loc4, 1, 'عَلَيْهِمْ', 'عليهم', 'kasr_haa', 'بكسر الهاء', '١- عَلَيْهِمْ : نافع، ابن كثير، أبو عمرو، ابن عامر، عاصم، الكسائي، أبو جعفر، خلف.', 1)
  on conflict (locus_id, variant_index) do update set display_text = excluded.display_text
  returning id into v_var4_1;

  insert into public.qiraat_variants (locus_id, variant_index, display_text, normalized_text, performance_type, performance_text, source_line_raw, sort_order)
  values (v_loc4, 2, 'عَلَيْهِمُ', 'عليهم', 'damm_haa', 'بضم الهاء وصلاً ووقفاً', '٢- عَلَيْهِمُ : حمزة، يعقوب.', 2)
  on conflict (locus_id, variant_index) do update set display_text = excluded.display_text
  returning id into v_var4_2;

  -- Attributions for Locus 4 Variant 1
  insert into public.qiraat_attributions (variant_id, person_id, attribution_raw, role, sort_order) values
    (v_var4_1, 'NAFI', 'نافع', 'imam', 1),
    (v_var4_1, 'IBN_KATHIR', 'ابن كثير', 'imam', 2),
    (v_var4_1, 'ABU_AMR', 'أبو عمرو', 'imam', 3),
    (v_var4_1, 'IBN_AMIR', 'ابن عامر', 'imam', 4),
    (v_var4_1, 'ASIM', 'عاصم', 'imam', 5),
    (v_var4_1, 'AL_KISAI', 'الكسائي', 'imam', 6),
    (v_var4_1, 'ABU_JAFAR', 'أبو جعفر', 'imam', 7),
    (v_var4_1, 'KHALAF_ASHIR', 'خلف', 'imam', 8)
  on conflict (variant_id, person_id) do nothing;

  -- Attributions for Locus 4 Variant 2
  insert into public.qiraat_attributions (variant_id, person_id, attribution_raw, role, sort_order) values
    (v_var4_2, 'HAMZA', 'حمزة', 'imam', 1),
    (v_var4_2, 'YAQUB', 'يعقوب', 'imam', 2)
  on conflict (variant_id, person_id) do nothing;

end $$;
