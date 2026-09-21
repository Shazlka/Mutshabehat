-- Additive verified taxonomy vocabulary for the Phase 5 manual editor.
-- This migration defines generic rule categories only; it does not assert any
-- Reader/Narrator/Tariq applicability.

INSERT INTO qiraat_taxonomies (category_type, code, name_ar, name_en, sort_order, metadata)
VALUES
  ('USUL','USUL_HAMZ','الهمز','Hamza',10,'{}'::jsonb),
  ('USUL','USUL_MADD','المدود','Madd',20,'{}'::jsonb),
  ('USUL','USUL_IDGHAM','الإدغام','Idgham',30,'{}'::jsonb),
  ('USUL','USUL_SAKT','السكت','Sakt',40,'{}'::jsonb),
  ('USUL','USUL_IMALA','الإمالة','Imala',50,'{}'::jsonb),
  ('USUL','USUL_TAQLIL','التقليل','Taqlil',60,'{}'::jsonb),
  ('USUL','USUL_HAA_KINAYA','هاء الكناية','Ha al-Kinaya',70,'{}'::jsonb),
  ('USUL','USUL_MIM_JAM','ميم الجمع','Mim al-Jam',80,'{}'::jsonb),
  ('USUL','USUL_YAA_IDAFA','ياءات الإضافة','Ya al-Idafa',90,'{}'::jsonb),
  ('USUL','USUL_YAA_ZAWAID','ياءات الزوائد','Ya al-Zawaid',100,'{}'::jsonb),
  ('USUL','USUL_RAA','الراءات','Ra letters',110,'{}'::jsonb),
  ('USUL','USUL_LAM','تغليظ اللام','Lam emphasis',120,'{}'::jsonb),
  ('USUL','USUL_WAQF','الوقف','Waqf',130,'{}'::jsonb),
  ('USUL','USUL_ISHMAM','الإشمام','Ishmam',140,'{}'::jsonb),
  ('USUL','USUL_RAWM','الروم','Rawm',150,'{}'::jsonb)
ON CONFLICT (code) DO UPDATE SET
  category_type=EXCLUDED.category_type,
  name_ar=EXCLUDED.name_ar,
  name_en=EXCLUDED.name_en,
  sort_order=EXCLUDED.sort_order,
  active=true,
  updated_at=now();

INSERT INTO qiraat_taxonomies (category_type, code, name_ar, name_en, sort_order, metadata)
VALUES
  ('USUL','USUL_HAMZ_TASHIL','التسهيل','Facilitation',10,'{}'::jsonb),
  ('USUL','USUL_HAMZ_IBDAL','الإبدال','Substitution',20,'{}'::jsonb),
  ('USUL','USUL_HAMZ_NAQL','النقل','Naql',30,'{}'::jsonb),
  ('USUL','USUL_HAMZ_TA07IQ','التحقيق','Full articulation',40,'{}'::jsonb),
  ('USUL','USUL_MADD_BADAL','مد البدل','Madd al-Badal',10,'{"face_presets":[{"faceType":"MADD_LENGTH","faceValue":"2","labelAr":"القصر"},{"faceType":"MADD_LENGTH","faceValue":"4","labelAr":"التوسط"},{"faceType":"MADD_LENGTH","faceValue":"6","labelAr":"الإشباع"}]}'::jsonb),
  ('USUL','USUL_MADD_MUNFASIL','المد المنفصل','Munfasil',20,'{"face_presets":[{"faceType":"MADD_LENGTH","faceValue":"2","labelAr":"القصر"},{"faceType":"MADD_LENGTH","faceValue":"4","labelAr":"التوسط"},{"faceType":"MADD_LENGTH","faceValue":"6","labelAr":"الإشباع"}]}'::jsonb),
  ('USUL','USUL_MADD_MUTTASIL','المد المتصل','Muttasil',30,'{"face_presets":[{"faceType":"MADD_LENGTH","faceValue":"4","labelAr":"التوسط"},{"faceType":"MADD_LENGTH","faceValue":"5","labelAr":"الإشباع"}]}'::jsonb),
  ('USUL','USUL_IDGHAM_KABIR','الإدغام الكبير','Major Idgham',10,'{}'::jsonb),
  ('USUL','USUL_IDGHAM_SAGHIR','الإدغام الصغير','Minor Idgham',20,'{}'::jsonb),
  ('USUL','USUL_SAKT_GENERAL','السكت','Sakt',10,'{"face_presets":[{"faceType":"SAKT","faceValue":"true","labelAr":"السكت"},{"faceType":"SAKT","faceValue":"false","labelAr":"عدم السكت"}]}'::jsonb),
  ('USUL','USUL_IMALA_GENERAL','الإمالة','Imala',10,'{"face_presets":[{"faceType":"IMALA","faceValue":"FATH","labelAr":"الفتح"},{"faceType":"IMALA","faceValue":"TAQLIL","labelAr":"التقليل"},{"faceType":"IMALA","faceValue":"IMALA","labelAr":"الإمالة"}]}'::jsonb),
  ('USUL','USUL_TAQLIL_GENERAL','التقليل','Taqlil',10,'{"face_presets":[{"faceType":"IMALA","faceValue":"FATH","labelAr":"الفتح"},{"faceType":"IMALA","faceValue":"TAQLIL","labelAr":"التقليل"}]}'::jsonb),
  ('USUL','USUL_HAA_KINAYA_SILA','صلة هاء الكناية','Kinaya connection',10,'{}'::jsonb),
  ('USUL','USUL_MIM_JAM_GENERAL','ميم الجمع','Mim al-Jam',10,'{}'::jsonb),
  ('USUL','USUL_YAA_IDAFA_GENERAL','ياءات الإضافة','Ya al-Idafa',10,'{}'::jsonb),
  ('USUL','USUL_YAA_ZAWAID_GENERAL','ياءات الزوائد','Ya al-Zawaid',10,'{}'::jsonb),
  ('USUL','USUL_RAA_TARQIQ','الترقيق','Ra lightening',10,'{}'::jsonb),
  ('USUL','USUL_RAA_TAFKHIM','التفخيم','Ra emphasis',20,'{}'::jsonb),
  ('USUL','USUL_LAM_GENERAL','تغليظ اللام','Lam emphasis',10,'{}'::jsonb),
  ('USUL','USUL_WAQF_HAMZ','الوقف على الهمز','Waqf on hamza',10,'{}'::jsonb),
  ('USUL','USUL_WAQF_RASM','الوقف على مرسوم الخط','Waqf on rasm',20,'{}'::jsonb),
  ('USUL','USUL_ISHMAM_GENERAL','الإشمام','Ishmam',10,'{}'::jsonb),
  ('USUL','USUL_RAWM_GENERAL','الروم','Rawm',10,'{}'::jsonb)
ON CONFLICT (code) DO UPDATE SET
  category_type=EXCLUDED.category_type,
  name_ar=EXCLUDED.name_ar,
  name_en=EXCLUDED.name_en,
  sort_order=EXCLUDED.sort_order,
  metadata=EXCLUDED.metadata,
  active=true,
  updated_at=now();

UPDATE qiraat_taxonomies AS child
SET parent_id = parent.id, updated_at = now()
FROM qiraat_taxonomies AS parent
WHERE child.code IN ('USUL_HAMZ','USUL_MADD','USUL_IDGHAM','USUL_SAKT','USUL_IMALA','USUL_TAQLIL','USUL_HAA_KINAYA','USUL_MIM_JAM','USUL_YAA_IDAFA','USUL_YAA_ZAWAID','USUL_RAA','USUL_LAM','USUL_WAQF','USUL_ISHMAM','USUL_RAWM')
  AND parent.code='USUL';

UPDATE qiraat_taxonomies AS child
SET parent_id = parent.id, updated_at = now()
FROM qiraat_taxonomies AS parent
WHERE child.code IN ('USUL_HAMZ_TASHIL','USUL_HAMZ_IBDAL','USUL_HAMZ_NAQL','USUL_HAMZ_TA07IQ') AND parent.code='USUL_HAMZ'
   OR child.code IN ('USUL_MADD_BADAL','USUL_MADD_MUNFASIL','USUL_MADD_MUTTASIL') AND parent.code='USUL_MADD'
   OR child.code IN ('USUL_IDGHAM_KABIR','USUL_IDGHAM_SAGHIR') AND parent.code='USUL_IDGHAM'
   OR child.code='USUL_SAKT_GENERAL' AND parent.code='USUL_SAKT'
   OR child.code='USUL_IMALA_GENERAL' AND parent.code='USUL_IMALA'
   OR child.code='USUL_TAQLIL_GENERAL' AND parent.code='USUL_TAQLIL'
   OR child.code='USUL_HAA_KINAYA_SILA' AND parent.code='USUL_HAA_KINAYA'
   OR child.code='USUL_MIM_JAM_GENERAL' AND parent.code='USUL_MIM_JAM'
   OR child.code='USUL_YAA_IDAFA_GENERAL' AND parent.code='USUL_YAA_IDAFA'
   OR child.code='USUL_YAA_ZAWAID_GENERAL' AND parent.code='USUL_YAA_ZAWAID'
   OR child.code IN ('USUL_RAA_TARQIQ','USUL_RAA_TAFKHIM') AND parent.code='USUL_RAA'
   OR child.code='USUL_LAM_GENERAL' AND parent.code='USUL_LAM'
   OR child.code IN ('USUL_WAQF_HAMZ','USUL_WAQF_RASM') AND parent.code='USUL_WAQF'
   OR child.code='USUL_ISHMAM_GENERAL' AND parent.code='USUL_ISHMAM'
   OR child.code='USUL_RAWM_GENERAL' AND parent.code='USUL_RAWM';
