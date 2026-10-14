-- ============================================================================
-- Qiraat Automatic Review Approval SQL («معتمد آليًا»)
-- Generated: 2026-10-14T05:29:20.289Z
-- Total verdicts: 812, Approved in this script: 367
-- ============================================================================
--
-- Queued for human review:
-- Farsh entries whose derived sub-category differs from stored non-other variant_type
-- (These are NOT modified by this script)
--   v-L019-ابراهيم-1-w2-a124-t3 (ref: 2:124:3, word: إِبْرَٰهِـۧمَ): stored='consonant' != derived='addition'
--   v-L019-ابراهيم-2-w2-a125-t10 (ref: 2:125:10, word: إِبْرَٰهِـۧمَ): stored='consonant' != derived='addition'
--   v-L019-ابراهيم-3-w2-a125-t14 (ref: 2:125:14, word: إِبْرَٰهِـۧمَ): stored='consonant' != derived='addition'
--   v-L019-ابراهيم-4-w2-a126-t3 (ref: 2:126:3, word: إِبْرَٰهِـۧمُ): stored='consonant' != derived='addition'
--   v-L019-فامتعهو-1-w2-a126-t22 (ref: 2:126:22, word: فَأُمَتِّعُهُۥ): stored='consonant' != derived='vowel'
--   v-L020-ابراهيم-1-w2-a127-t3 (ref: 2:127:3, word: إِبْرَٰهِـۧمُ): stored='consonant' != derived='addition'
--   v-L020-عليهم-1-a129-t7-cdaec1 (ref: 2:129:7, word: عَلَيْهِمْ): stored='vowel' != derived='addition'
--   v-L020-ابراهيم-2-w2-a130-t5 (ref: 2:130:5, word: إِبْرَٰهِـۧمَ): stored='consonant' != derived='addition'
--   v-L020-ووصا-1-w2-a132-t1 (ref: 2:132:1, word: وَوَصَّىٰ): stored='consonant' != derived='addition'
--   v-L020-ابراهيم-3-w2-a132-t3 (ref: 2:132:3, word: إِبْرَٰهِـۧمُ): stored='consonant' != derived='addition'
--   v-L020-ابراهيم-4-w2-a133-t20 (ref: 2:133:20, word: إِبْرَٰهِـۧمَ): stored='consonant' != derived='addition'
--   v-L021-ابراهيم-1-w2-a135-t10 (ref: 2:135:10, word: إِبْرَٰهِـۧمَ): stored='consonant' != derived='addition'
--   v-L021-ابراهيم-2-w2-a136-t10 (ref: 2:136:10, word: إِبْرَٰهِـۧمَ): stored='consonant' != derived='addition'
--   v-L021-النبيون-1-w2-a136-t21 (ref: 2:136:21, word: ٱلنَّبِيُّونَ): stored='hamza' != derived='addition'
--   v-L021-ابراهيم-3-w2-a140-t4 (ref: 2:140:4, word: إِبْرَٰهِـۧمَ): stored='consonant' != derived='addition'
--   v-L022-لرءوف-1-w2-a143-t44 (ref: 2:143:44, word: لَرَءُوفٌۭ): stored='madd' != derived='omission'
--   v-L023-موليها-1-w2-a148-t4 (ref: 2:148:4, word: مُوَلِّيهَا ۖ): stored='consonant' != derived='vowel'
--   v-L024-عليهم-1-a157-t2-c41911 (ref: 2:157:2, word: عَلَيْهِمْ): stored='vowel' != derived='addition'
--   v-L024-عليهم-2-a160-t8-12ce10 (ref: 2:160:8, word: عَلَيْهِمْ ۚ): stored='vowel' != derived='addition'
--   v-L024-عليهم-3-a161-t8-e4de51 (ref: 2:161:8, word: عَلَيْهِمْ): stored='vowel' != derived='addition'
--   v-L025-الريح-1-w2-a164-t35 (ref: 2:164:35, word: ٱلرِّيَـٰحِ): stored='consonant' != derived='vowel'
--   v-L025-عليهم-1-a167-t18-b2a8fc (ref: 2:167:18, word: عَلَيْهِمْ ۖ): stored='vowel' != derived='addition'
--   v-L026-الميته-1-w2-a173-t4 (ref: 2:173:4, word: ٱلْمَيْتَةَ): stored='consonant' != derived='vowel'
--   v-L027-والنبيين-1-w2-a177-t18 (ref: 2:177:18, word: وَٱلنَّبِيِّـۧنَ): stored='hamza' != derived='addition'
--   v-L028-موص-1-w2-a182-t4 (ref: 2:182:4, word: مُّوصٍۢ): stored='consonant' != derived='vowel'
--   v-L028-فديه_طعام_مسكين-1-w2-a184-t17 (ref: 2:184:17, word: فِدْيَةٌۭ طَعَامُ مِسْكِينٍۢ ۖ): stored='consonant' != derived='vowel'
--   v-L028-فديه_طعام_مسكين-1-w3-a184-t17 (ref: 2:184:17, word: فِدْيَةٌۭ طَعَامُ مِسْكِينٍۢ ۖ): stored='consonant' != derived='vowel'
--   v-L028-القرءان-1-w2-a185-t6 (ref: 2:185:6, word: ٱلْقُرْءَانُ): stored='naql' != derived='omission'
--   v-L028-ولتكملوا-1-w2-a185-t36 (ref: 2:185:36, word: وَلِتُكْمِلُوا۟): stored='consonant' != derived='vowel'
--
BEGIN;

SELECT set_config('app.device_id', 'auto-review', true);

-- 1. Approve entries (tiers A1, A2)
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p019-023-1-w8-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p019-008-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p019-023-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p019-023-1-w9-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p019-024-1-w12-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p019-024-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p019-024-1-w13-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p019-025-1-w15-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p019-025-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p019-025-1-w16-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر)' WHERE id = 'v-L019-ابراهيم-1-w2-a124-t3' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p019-014-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p019-019-1-w15-Q03-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'r-p019-019-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p019-019-1-w16-Q03-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p019-028-1-w18-Q05-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'v-DURI-002-124-18-r0072-performance-a124-t18' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p019-028-1-w18-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p019-028-1-w18-Q06-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p019-028-1-w19-Q05-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p019-028-1-w19-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p019-028-1-w19-Q06-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر)' WHERE id = 'ent-r-p019-016-1-w1-Q04-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p019-016-1-w2-Q03-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p019-016-1-w2-Q03-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر)' WHERE id = 'ent-r-p019-016-1-w2-Q04-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p019-014-2' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (قالون، ورش، ابن عامر)' WHERE id = 'v-L019-واتخذوا-1-w2-a125-t7' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر)' WHERE id = 'v-L019-ابراهيم-2-w2-a125-t10' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p019-003-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر)' WHERE id = 'v-L019-ابراهيم-3-w2-a125-t14' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p019-029-1-w18-Q01-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'v-DURI-002-125-18-r0074-performance-a125-t18' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p019-029-1-w18-Q01-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p019-029-1-w18-Q04-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p019-029-1-w18-Q05-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p019-029-1-w18-Q08-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p019-029-1-w18-Q08-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p019-029-1-w19-Q01-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p019-029-1-w19-Q01-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p019-029-1-w19-Q04-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p019-029-1-w19-Q05-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p019-029-1-w19-Q08-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p019-029-1-w19-Q08-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر)' WHERE id = 'v-L019-ابراهيم-4-w2-a126-t3' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p019-005-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p019-006-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p019-007-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر)' WHERE id = 'v-L020-ابراهيم-1-w2-a127-t3' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p020-011-1-w7-Q03-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'r-p020-011-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p020-011-1-w8-Q03-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (يعقوب)' WHERE id = 'v-L020-FIHIM-w2-a129-t3' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p020-005-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (يعقوب)' WHERE id = 'v-L020-FIHIM-w2-a129-t12' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p020-016-1-w1-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p020-016-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p020-016-1-w2-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر)' WHERE id = 'v-L020-ابراهيم-2-w2-a130-t5' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)' WHERE id = 'r-p020-001-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p020-004-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p020-006-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p020-012-1-w2-Q03-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'r-p020-012-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p020-012-1-w3-Q03-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر)' WHERE id = 'v-L020-ابراهيم-3-w2-a132-t3' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)' WHERE id = 'r-p020-002-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (قالون)' WHERE id = 'ent-r-p020-015-1-w3-Q01-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (قالون، ورش، ابن كثير، أبو جعفر، يعقوب)' WHERE id = 'r-p020-015-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ورش)' WHERE id = 'ent-r-p020-015-1-w3-Q01-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)' WHERE id = 'ent-r-p020-015-1-w3-Q02-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)' WHERE id = 'ent-r-p020-015-1-w3-Q02-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p020-015-1-w3-Q03-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p020-015-1-w3-Q03-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (أبو جعفر)' WHERE id = 'ent-r-p020-015-1-w3-Q08-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (أبو جعفر)' WHERE id = 'ent-r-p020-015-1-w3-Q08-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (يعقوب)' WHERE id = 'ent-r-p020-015-1-w3-Q09-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (قالون)' WHERE id = 'ent-r-p020-015-1-w4-Q01-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ورش)' WHERE id = 'ent-r-p020-015-1-w4-Q01-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)' WHERE id = 'ent-r-p020-015-1-w4-Q02-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)' WHERE id = 'ent-r-p020-015-1-w4-Q02-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p020-015-1-w4-Q03-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p020-015-1-w4-Q03-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (أبو جعفر)' WHERE id = 'ent-r-p020-015-1-w4-Q08-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (أبو جعفر)' WHERE id = 'ent-r-p020-015-1-w4-Q08-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (يعقوب)' WHERE id = 'ent-r-p020-015-1-w4-Q09-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p020-013-1-w9-Q03-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'r-p020-013-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p020-013-1-w10-Q03-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)' WHERE id = 'r-p020-003-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p020-007-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر)' WHERE id = 'v-L020-ابراهيم-4-w2-a133-t20' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p020-014-1-w25-Q03-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'r-p020-014-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p020-014-1-w26-Q03-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-DURI-002-135-4-r0079-IMALAH_TAQLIL-w4-Q03-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-DURI-002-135-4-r0079-IMALAH_TAQLIL' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-conflict-r-DURI-002-135-4-r0079-IMALAH_TAQLIL-w5-Q03-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p021-014-1-w11-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p021-014-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p021-014-1-w12-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p021-002-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p021-003-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p021-003-2' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p021-011-1-w29-Q03-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'r-p021-011-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p021-011-1-w30-Q03-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p021-005-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p021-006-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p021-010-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p021-015-1-w7-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p021-015-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p021-011-2-w8-Q03-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'r-p021-011-2' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p021-015-1-w8-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p021-011-2-w9-Q03-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p021-011-3-w12-Q03-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'r-p021-011-3' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p021-011-3-w13-Q03-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-DURI-002-140-11-r0084-IMALAH_TAQLIL-w11-Q03-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-DURI-002-140-11-r0084-IMALAH_TAQLIL' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-conflict-r-DURI-002-140-11-r0084-IMALAH_TAQLIL-w12-Q03-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ورش)' WHERE id = 'ent-conflict-r-p021-013-1-w14-Q01-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر)' WHERE id = 'ent-conflict-r-p021-013-1-w14-Q04-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p021-012-1-w19-Q03-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'r-p021-012-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p021-012-1-w20-Q03-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p022-024-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p022-007-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p022-009-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-DURI-002-142-8-r0087-MEEM_JAM-w8-Q03-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p022-018-1-w17-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p022-018-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (قالون)' WHERE id = 'ent-r-p022-017-1-w18-Q01-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ورش)' WHERE id = 'ent-r-p022-017-1-w18-Q01-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)' WHERE id = 'ent-r-p022-017-1-w18-Q02-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)' WHERE id = 'ent-r-p022-017-1-w18-Q02-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (الدوري)' WHERE id = 'ent-r-p022-017-1-w18-Q03-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p022-017-1-w18-Q03-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (أبو جعفر)' WHERE id = 'ent-r-p022-017-1-w18-Q08-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (أبو جعفر)' WHERE id = 'ent-r-p022-017-1-w18-Q08-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (يعقوب)' WHERE id = 'ent-r-p022-017-1-w18-Q09-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p022-018-1-w18-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (قالون)' WHERE id = 'ent-r-p022-017-1-w19-Q01-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ورش)' WHERE id = 'ent-r-p022-017-1-w19-Q01-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)' WHERE id = 'ent-r-p022-017-1-w19-Q02-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)' WHERE id = 'ent-r-p022-017-1-w19-Q02-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (أبو جعفر)' WHERE id = 'ent-r-p022-017-1-w19-Q08-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (أبو جعفر)' WHERE id = 'ent-r-p022-017-1-w19-Q08-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (يعقوب)' WHERE id = 'ent-r-p022-017-1-w19-Q09-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p022-019-1-w3-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p022-019-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p022-019-1-w4-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p022-007-2' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p022-020-1-w12-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p022-020-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p022-020-1-w13-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p022-014-1-w20-Q03-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p022-014-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p022-014-1-w21-Q03-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p022-021-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p022-021-1-w21-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p022-021-1-w22-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p022-022-1-w24-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p022-022-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p022-022-1-w25-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)' WHERE id = 'r-p022-001-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p022-002-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p022-003-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p022-008-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p022-015-1-w7-Q03-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'r-p022-015-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p022-015-1-w8-Q03-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p022-005-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p022-005-2' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p022-016-1-w5-Q03-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'r-p022-016-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p022-016-1-w6-Q03-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p022-006-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p022-023-1-w19-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p022-023-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p022-023-1-w20-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p023-005-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p023-013-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p023-012-1-w1-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p023-012-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p023-012-1-w2-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر)' WHERE id = 'v-L023-موليها-1-w2-a148-t4' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p023-001-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p023-008-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p023-002-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ورش)' WHERE id = 'r-p023-011-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p023-009-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p023-006-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (يعقوب)' WHERE id = 'ent-r-p023-015-1-w6-Q09-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (يعقوب)' WHERE id = 'ent-r-p023-015-1-w6-Q09-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p023-007-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p023-004-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p024-013-1-w3-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p024-013-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p024-013-1-w4-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p024-008-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)' WHERE id = 'r-p024-001-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p024-015-1-w6-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p024-009-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p024-015-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p024-015-1-w7-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)' WHERE id = 'r-p024-002-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p024-016-1-w15-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p024-016-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p024-016-1-w16-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p024-017-1-w18-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p024-017-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p024-017-1-w19-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p024-004-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p024-005-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)' WHERE id = 'r-p024-003-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p024-011-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p024-012-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p024-018-1-w2-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p024-018-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p024-018-1-w3-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (الكسائي)' WHERE id = 'r-p025-007-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p025-012-1-w33-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p025-012-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p025-012-1-w34-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p025-002-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p025-013-1-w42-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p025-013-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p025-013-1-w43-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-DURI-002-165-2-r0097-IMALAH_TAQLIL' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p025-014-1-w3-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p025-014-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p025-014-1-w4-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p025-015-1-w8-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p025-015-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p025-015-1-w9-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p025-003-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p025-016-1-w27-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p025-016-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p025-016-1-w28-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (أبو جعفر، يعقوب)' WHERE id = 'v-L025-ANNA2-w2-a165-t28' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (الدوري)' WHERE id = 'ent-r-p025-010-1-w1-Q03-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (الدوري)' WHERE id = 'r-DURI-002-166-1-r0099-IDGHAM_KABIR' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p025-010-1-w1-Q03-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر)' WHERE id = 'ent-r-p025-010-1-w1-Q04-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p025-010-1-w1-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p025-010-1-w1-Q06-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (الكسائي)' WHERE id = 'ent-r-p025-010-1-w1-Q07-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (الكسائي)' WHERE id = 'ent-r-p025-010-1-w1-Q07-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (خلف العاشر)' WHERE id = 'ent-r-p025-010-1-w1-Q10-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (خلف العاشر)' WHERE id = 'ent-r-p025-010-1-w1-Q10-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (الدوري)' WHERE id = 'ent-r-DURI-002-166-1-r0099-IDGHAM_KABIR-w1-Q03-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (الدوري)' WHERE id = 'ent-r-p025-010-1-w2-Q03-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p025-010-1-w2-Q03-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر)' WHERE id = 'ent-r-p025-010-1-w2-Q04-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p025-010-1-w2-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p025-010-1-w2-Q06-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (الكسائي)' WHERE id = 'ent-r-p025-010-1-w2-Q07-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (الكسائي)' WHERE id = 'ent-r-p025-010-1-w2-Q07-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (خلف العاشر)' WHERE id = 'ent-r-p025-010-1-w2-Q10-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (خلف العاشر)' WHERE id = 'ent-r-p025-010-1-w2-Q10-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (الدوري)' WHERE id = 'ent-r-DURI-002-166-1-r0099-IDGHAM_KABIR-w2-Q03-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-DURI-002-166-11-r0100-MEEM_JAM-w12-Q03-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p025-004-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-DURI-002-167-14-r0101-MEEM_JAM-w14-Q03-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (الدوري، السوسي)' WHERE id = 'v-L025-يريهم_الله-1-w2-a167-t14' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p025-017-1-w8-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p025-017-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p025-017-1-w9-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p026-013-1-w2-Q03-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'r-p026-013-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر، الكسائي، يعقوب)' WHERE id = 'v-L026-قيل-1-w2-a170-t2' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p026-013-1-w3-Q03-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (الكسائي)' WHERE id = 'ent-r-p026-012-1-w9-Q07-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (الكسائي)' WHERE id = 'r-p026-012-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (الكسائي)' WHERE id = 'ent-r-p026-012-1-w9-Q07-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (الكسائي)' WHERE id = 'ent-r-p026-012-1-w10-Q07-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (الكسائي)' WHERE id = 'ent-r-p026-012-1-w10-Q07-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)' WHERE id = 'r-p026-001-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p026-005-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p026-020-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p026-006-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p026-017-1-w20-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p026-008-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p026-018-1-w11-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p026-018-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p026-018-1-w12-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p026-007-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)' WHERE id = 'r-p026-002-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (أبو جعفر)' WHERE id = 'v-L026-الميته-1-w2-a173-t4' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (قالون، ورش، ابن كثير، ابن عامر، الكسائي، خلف العاشر)' WHERE id = 'v-L026-فمن_اضطر-1-w2-a173-t13' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (أبو جعفر)' WHERE id = 'v-L026-فمن_اضطر-1-w3-a173-t13' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p026-003-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p026-019-1-w16-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p026-019-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p026-019-1-w17-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)' WHERE id = 'r-p026-001-2' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (يعقوب)' WHERE id = 'v-L026-يزكيهم-1-w2-a174-t26' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p026-022-1-w28-Q06-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p026-022-1-w29-Q06-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p026-014-1-w6-Q03-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'r-p026-014-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p026-014-1-w7-Q03-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p026-004-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p026-011-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-DURI-002-175-11-r0105-IMALAH_TAQLIL' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p026-015-1-w5-Q03-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'r-p026-015-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p026-015-1-w6-Q03-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p027-006-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p027-007-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (قالون، ورش)' WHERE id = 'v-L027-والنبيين-1-w2-a177-t18' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-DURI-002-177-24-r0107-IMALAH_TAQLIL' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p027-005-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p027-010-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)' WHERE id = 'r-p027-001-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p027-011-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)' WHERE id = 'r-p027-002-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p027-022-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p027-018-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p027-023-1-w36-Q06-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p027-023-1-w37-Q06-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p027-020-1-w4-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p027-020-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p027-020-1-w5-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p027-004-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p028-008-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)' WHERE id = 'r-p028-001-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p028-007-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p028-018-1-w12-Q06-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p028-018-1-w13-Q06-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر)' WHERE id = 'v-L028-فديه_طعام_مسكين-1-w3-a184-t17' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p028-013-1-w18-Q03-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'r-p028-013-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p028-013-1-w19-Q03-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p028-017-1-w20-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p028-017-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p028-017-1-w21-Q06-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p028-003-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p028-004-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p028-004-2' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p028-014-1-w1-Q03-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'r-p028-014-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p028-014-1-w2-Q03-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)' WHERE id = 'v-L028-القرءان-1-w2-a185-t6' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p028-012-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)' WHERE id = 'r-p028-002-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p028-018-2-w26-Q06-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p028-018-2-w27-Q06-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (أبو جعفر)' WHERE id = 'v-L028-اليسر-1-w2-a185-t31' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (أبو جعفر)' WHERE id = 'v-L028-العسر-1-w2-a185-t35' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p028-005-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p028-011-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (يعقوب)' WHERE id = 'ent-r-p028-020-1-w9-Q09-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (يعقوب)' WHERE id = 'ent-r-p028-020-1-w9-Q09-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (الدوري)' WHERE id = 'ent-r-p028-020-1-w9-Q03-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p028-020-1-w9-Q03-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p028-020-1-w10-Q09-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p028-020-1-w10-Q09-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (الدوري)' WHERE id = 'ent-r-p028-020-1-w10-Q03-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p028-020-1-w10-Q03-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p028-020-1-w10-Q08-R01' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p028-020-1-w10-Q08-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p028-019-1-w15-Q01-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p028-019-1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p028-019-1-w16-Q01-R02' AND review_status = 'unreviewed' AND deleted_at IS NULL;

-- 1b. Refresh the source label of earlier automatic approvals (never touches human approvals)
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p019-023-1-w8-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p019-008-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p019-023-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p019-023-1-w9-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p019-024-1-w12-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p019-024-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p019-024-1-w13-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p019-025-1-w15-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p019-025-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p019-025-1-w16-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر)' WHERE id = 'v-L019-ابراهيم-1-w2-a124-t3' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p019-014-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p019-019-1-w15-Q03-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'r-p019-019-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p019-019-1-w16-Q03-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p019-028-1-w18-Q05-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'v-DURI-002-124-18-r0072-performance-a124-t18' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p019-028-1-w18-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p019-028-1-w18-Q06-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p019-028-1-w19-Q05-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p019-028-1-w19-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p019-028-1-w19-Q06-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر)' WHERE id = 'ent-r-p019-016-1-w1-Q04-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p019-016-1-w2-Q03-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p019-016-1-w2-Q03-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر)' WHERE id = 'ent-r-p019-016-1-w2-Q04-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p019-014-2' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (قالون، ورش، ابن عامر)' WHERE id = 'v-L019-واتخذوا-1-w2-a125-t7' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (قالون، ورش، ابن عامر)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر)' WHERE id = 'v-L019-ابراهيم-2-w2-a125-t10' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p019-003-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر)' WHERE id = 'v-L019-ابراهيم-3-w2-a125-t14' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p019-029-1-w18-Q01-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'v-DURI-002-125-18-r0074-performance-a125-t18' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p019-029-1-w18-Q01-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p019-029-1-w18-Q04-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p019-029-1-w18-Q05-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p019-029-1-w18-Q08-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p019-029-1-w18-Q08-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p019-029-1-w19-Q01-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p019-029-1-w19-Q01-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p019-029-1-w19-Q04-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p019-029-1-w19-Q05-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p019-029-1-w19-Q08-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p019-029-1-w19-Q08-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر)' WHERE id = 'v-L019-ابراهيم-4-w2-a126-t3' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p019-005-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p019-006-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p019-007-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر)' WHERE id = 'v-L020-ابراهيم-1-w2-a127-t3' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p020-011-1-w7-Q03-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'r-p020-011-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p020-011-1-w8-Q03-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (يعقوب)' WHERE id = 'v-L020-FIHIM-w2-a129-t3' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (يعقوب)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p020-005-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (يعقوب)' WHERE id = 'v-L020-FIHIM-w2-a129-t12' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (يعقوب)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p020-016-1-w1-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p020-016-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p020-016-1-w2-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر)' WHERE id = 'v-L020-ابراهيم-2-w2-a130-t5' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)' WHERE id = 'r-p020-001-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p020-004-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p020-006-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p020-012-1-w2-Q03-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'r-p020-012-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p020-012-1-w3-Q03-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر)' WHERE id = 'v-L020-ابراهيم-3-w2-a132-t3' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)' WHERE id = 'r-p020-002-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (قالون)' WHERE id = 'ent-r-p020-015-1-w3-Q01-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (قالون)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (قالون، ورش، ابن كثير، أبو جعفر، يعقوب)' WHERE id = 'r-p020-015-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (قالون، ورش، ابن كثير، أبو جعفر، يعقوب)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ورش)' WHERE id = 'ent-r-p020-015-1-w3-Q01-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (ورش)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)' WHERE id = 'ent-r-p020-015-1-w3-Q02-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)' WHERE id = 'ent-r-p020-015-1-w3-Q02-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p020-015-1-w3-Q03-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p020-015-1-w3-Q03-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (أبو جعفر)' WHERE id = 'ent-r-p020-015-1-w3-Q08-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (أبو جعفر)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (أبو جعفر)' WHERE id = 'ent-r-p020-015-1-w3-Q08-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (أبو جعفر)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (يعقوب)' WHERE id = 'ent-r-p020-015-1-w3-Q09-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (يعقوب)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (قالون)' WHERE id = 'ent-r-p020-015-1-w4-Q01-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (قالون)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ورش)' WHERE id = 'ent-r-p020-015-1-w4-Q01-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (ورش)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)' WHERE id = 'ent-r-p020-015-1-w4-Q02-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)' WHERE id = 'ent-r-p020-015-1-w4-Q02-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p020-015-1-w4-Q03-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p020-015-1-w4-Q03-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (أبو جعفر)' WHERE id = 'ent-r-p020-015-1-w4-Q08-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (أبو جعفر)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (أبو جعفر)' WHERE id = 'ent-r-p020-015-1-w4-Q08-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (أبو جعفر)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (يعقوب)' WHERE id = 'ent-r-p020-015-1-w4-Q09-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (يعقوب)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p020-013-1-w9-Q03-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'r-p020-013-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p020-013-1-w10-Q03-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)' WHERE id = 'r-p020-003-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p020-007-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر)' WHERE id = 'v-L020-ابراهيم-4-w2-a133-t20' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p020-014-1-w25-Q03-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'r-p020-014-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p020-014-1-w26-Q03-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-DURI-002-135-4-r0079-IMALAH_TAQLIL-w4-Q03-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-DURI-002-135-4-r0079-IMALAH_TAQLIL' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-conflict-r-DURI-002-135-4-r0079-IMALAH_TAQLIL-w5-Q03-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p021-014-1-w11-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p021-014-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p021-014-1-w12-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p021-002-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p021-003-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p021-003-2' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p021-011-1-w29-Q03-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'r-p021-011-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p021-011-1-w30-Q03-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p021-005-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p021-006-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p021-010-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p021-015-1-w7-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p021-015-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p021-011-2-w8-Q03-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'r-p021-011-2' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p021-015-1-w8-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p021-011-2-w9-Q03-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p021-011-3-w12-Q03-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'r-p021-011-3' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p021-011-3-w13-Q03-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-DURI-002-140-11-r0084-IMALAH_TAQLIL-w11-Q03-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-DURI-002-140-11-r0084-IMALAH_TAQLIL' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-conflict-r-DURI-002-140-11-r0084-IMALAH_TAQLIL-w12-Q03-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ورش)' WHERE id = 'ent-conflict-r-p021-013-1-w14-Q01-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (ورش)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر)' WHERE id = 'ent-conflict-r-p021-013-1-w14-Q04-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p021-012-1-w19-Q03-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'r-p021-012-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p021-012-1-w20-Q03-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p022-024-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p022-007-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p022-009-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-DURI-002-142-8-r0087-MEEM_JAM-w8-Q03-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p022-018-1-w17-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p022-018-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (قالون)' WHERE id = 'ent-r-p022-017-1-w18-Q01-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (قالون)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ورش)' WHERE id = 'ent-r-p022-017-1-w18-Q01-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (ورش)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)' WHERE id = 'ent-r-p022-017-1-w18-Q02-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)' WHERE id = 'ent-r-p022-017-1-w18-Q02-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (الدوري)' WHERE id = 'ent-r-p022-017-1-w18-Q03-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (الدوري)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p022-017-1-w18-Q03-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (أبو جعفر)' WHERE id = 'ent-r-p022-017-1-w18-Q08-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (أبو جعفر)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (أبو جعفر)' WHERE id = 'ent-r-p022-017-1-w18-Q08-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (أبو جعفر)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (يعقوب)' WHERE id = 'ent-r-p022-017-1-w18-Q09-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (يعقوب)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p022-018-1-w18-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (قالون)' WHERE id = 'ent-r-p022-017-1-w19-Q01-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (قالون)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ورش)' WHERE id = 'ent-r-p022-017-1-w19-Q01-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (ورش)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)' WHERE id = 'ent-r-p022-017-1-w19-Q02-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)' WHERE id = 'ent-r-p022-017-1-w19-Q02-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (أبو جعفر)' WHERE id = 'ent-r-p022-017-1-w19-Q08-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (أبو جعفر)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (أبو جعفر)' WHERE id = 'ent-r-p022-017-1-w19-Q08-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (أبو جعفر)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (يعقوب)' WHERE id = 'ent-r-p022-017-1-w19-Q09-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (يعقوب)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p022-019-1-w3-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p022-019-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p022-019-1-w4-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p022-007-2' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p022-020-1-w12-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p022-020-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p022-020-1-w13-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p022-014-1-w20-Q03-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p022-014-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p022-014-1-w21-Q03-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p022-021-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p022-021-1-w21-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p022-021-1-w22-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p022-022-1-w24-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p022-022-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p022-022-1-w25-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)' WHERE id = 'r-p022-001-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p022-002-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p022-003-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p022-008-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p022-015-1-w7-Q03-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'r-p022-015-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p022-015-1-w8-Q03-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p022-005-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p022-005-2' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p022-016-1-w5-Q03-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'r-p022-016-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p022-016-1-w6-Q03-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p022-006-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p022-023-1-w19-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p022-023-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p022-023-1-w20-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p023-005-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p023-013-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p023-012-1-w1-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p023-012-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p023-012-1-w2-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر)' WHERE id = 'v-L023-موليها-1-w2-a148-t4' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p023-001-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p023-008-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p023-002-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ورش)' WHERE id = 'r-p023-011-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (ورش)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p023-009-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p023-006-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (يعقوب)' WHERE id = 'ent-r-p023-015-1-w6-Q09-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (يعقوب)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (يعقوب)' WHERE id = 'ent-r-p023-015-1-w6-Q09-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (يعقوب)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p023-007-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p023-004-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p024-013-1-w3-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p024-013-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p024-013-1-w4-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p024-008-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)' WHERE id = 'r-p024-001-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p024-015-1-w6-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p024-009-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p024-015-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p024-015-1-w7-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)' WHERE id = 'r-p024-002-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p024-016-1-w15-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p024-016-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p024-016-1-w16-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p024-017-1-w18-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p024-017-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p024-017-1-w19-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p024-004-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p024-005-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)' WHERE id = 'r-p024-003-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p024-011-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p024-012-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p024-018-1-w2-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p024-018-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p024-018-1-w3-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (الكسائي)' WHERE id = 'r-p025-007-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (الكسائي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p025-012-1-w33-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p025-012-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p025-012-1-w34-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p025-002-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p025-013-1-w42-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p025-013-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p025-013-1-w43-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-DURI-002-165-2-r0097-IMALAH_TAQLIL' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p025-014-1-w3-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p025-014-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p025-014-1-w4-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p025-015-1-w8-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p025-015-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p025-015-1-w9-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p025-003-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p025-016-1-w27-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p025-016-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p025-016-1-w28-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (أبو جعفر، يعقوب)' WHERE id = 'v-L025-ANNA2-w2-a165-t28' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (أبو جعفر، يعقوب)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (الدوري)' WHERE id = 'ent-r-p025-010-1-w1-Q03-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (الدوري)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (الدوري)' WHERE id = 'r-DURI-002-166-1-r0099-IDGHAM_KABIR' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (الدوري)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p025-010-1-w1-Q03-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر)' WHERE id = 'ent-r-p025-010-1-w1-Q04-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p025-010-1-w1-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p025-010-1-w1-Q06-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (الكسائي)' WHERE id = 'ent-r-p025-010-1-w1-Q07-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (الكسائي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (الكسائي)' WHERE id = 'ent-r-p025-010-1-w1-Q07-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (الكسائي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (خلف العاشر)' WHERE id = 'ent-r-p025-010-1-w1-Q10-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (خلف العاشر)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (خلف العاشر)' WHERE id = 'ent-r-p025-010-1-w1-Q10-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (خلف العاشر)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (الدوري)' WHERE id = 'ent-r-DURI-002-166-1-r0099-IDGHAM_KABIR-w1-Q03-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (الدوري)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (الدوري)' WHERE id = 'ent-r-p025-010-1-w2-Q03-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (الدوري)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p025-010-1-w2-Q03-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر)' WHERE id = 'ent-r-p025-010-1-w2-Q04-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p025-010-1-w2-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p025-010-1-w2-Q06-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (الكسائي)' WHERE id = 'ent-r-p025-010-1-w2-Q07-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (الكسائي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (الكسائي)' WHERE id = 'ent-r-p025-010-1-w2-Q07-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (الكسائي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (خلف العاشر)' WHERE id = 'ent-r-p025-010-1-w2-Q10-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (خلف العاشر)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (خلف العاشر)' WHERE id = 'ent-r-p025-010-1-w2-Q10-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (خلف العاشر)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (الدوري)' WHERE id = 'ent-r-DURI-002-166-1-r0099-IDGHAM_KABIR-w2-Q03-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (الدوري)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-DURI-002-166-11-r0100-MEEM_JAM-w12-Q03-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p025-004-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-DURI-002-167-14-r0101-MEEM_JAM-w14-Q03-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (الدوري، السوسي)' WHERE id = 'v-L025-يريهم_الله-1-w2-a167-t14' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (الدوري، السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p025-017-1-w8-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p025-017-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p025-017-1-w9-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p026-013-1-w2-Q03-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'r-p026-013-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر، الكسائي، يعقوب)' WHERE id = 'v-L026-قيل-1-w2-a170-t2' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر، الكسائي، يعقوب)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p026-013-1-w3-Q03-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (الكسائي)' WHERE id = 'ent-r-p026-012-1-w9-Q07-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (الكسائي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (الكسائي)' WHERE id = 'r-p026-012-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (الكسائي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (الكسائي)' WHERE id = 'ent-r-p026-012-1-w9-Q07-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (الكسائي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (الكسائي)' WHERE id = 'ent-r-p026-012-1-w10-Q07-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (الكسائي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (الكسائي)' WHERE id = 'ent-r-p026-012-1-w10-Q07-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (الكسائي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)' WHERE id = 'r-p026-001-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p026-005-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p026-020-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p026-006-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p026-017-1-w20-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p026-008-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p026-018-1-w11-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p026-018-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p026-018-1-w12-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p026-007-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)' WHERE id = 'r-p026-002-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (أبو جعفر)' WHERE id = 'v-L026-الميته-1-w2-a173-t4' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (أبو جعفر)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (قالون، ورش، ابن كثير، ابن عامر، الكسائي، خلف العاشر)' WHERE id = 'v-L026-فمن_اضطر-1-w2-a173-t13' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (قالون، ورش، ابن كثير، ابن عامر، الكسائي، خلف العاشر)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (أبو جعفر)' WHERE id = 'v-L026-فمن_اضطر-1-w3-a173-t13' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (أبو جعفر)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p026-003-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p026-019-1-w16-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p026-019-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p026-019-1-w17-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)' WHERE id = 'r-p026-001-2' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (يعقوب)' WHERE id = 'v-L026-يزكيهم-1-w2-a174-t26' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (يعقوب)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p026-022-1-w28-Q06-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p026-022-1-w29-Q06-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p026-014-1-w6-Q03-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'r-p026-014-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p026-014-1-w7-Q03-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p026-004-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p026-011-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-DURI-002-175-11-r0105-IMALAH_TAQLIL' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p026-015-1-w5-Q03-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'r-p026-015-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p026-015-1-w6-Q03-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p027-006-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p027-007-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (قالون، ورش)' WHERE id = 'v-L027-والنبيين-1-w2-a177-t18' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (قالون، ورش)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-DURI-002-177-24-r0107-IMALAH_TAQLIL' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p027-005-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p027-010-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)' WHERE id = 'r-p027-001-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p027-011-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)' WHERE id = 'r-p027-002-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p027-022-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p027-018-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p027-023-1-w36-Q06-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p027-023-1-w37-Q06-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p027-020-1-w4-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p027-020-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p027-020-1-w5-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p027-004-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p028-008-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)' WHERE id = 'r-p028-001-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p028-007-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p028-018-1-w12-Q06-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p028-018-1-w13-Q06-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر)' WHERE id = 'v-L028-فديه_طعام_مسكين-1-w3-a184-t17' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p028-013-1-w18-Q03-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'r-p028-013-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p028-013-1-w19-Q03-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p028-017-1-w20-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'r-p028-017-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'ent-r-p028-017-1-w21-Q06-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p028-003-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p028-004-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p028-004-2' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p028-014-1-w1-Q03-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'r-p028-014-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p028-014-1-w2-Q03-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)' WHERE id = 'v-L028-القرءان-1-w2-a185-t6' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p028-012-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)' WHERE id = 'r-p028-002-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p028-018-2-w26-Q06-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p028-018-2-w27-Q06-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (أبو جعفر)' WHERE id = 'v-L028-اليسر-1-w2-a185-t31' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (أبو جعفر)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (أبو جعفر)' WHERE id = 'v-L028-العسر-1-w2-a185-t35' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (أبو جعفر)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p028-005-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p028-011-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (يعقوب)' WHERE id = 'ent-r-p028-020-1-w9-Q09-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (يعقوب)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (يعقوب)' WHERE id = 'ent-r-p028-020-1-w9-Q09-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (يعقوب)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (الدوري)' WHERE id = 'ent-r-p028-020-1-w9-Q03-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (الدوري)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p028-020-1-w9-Q03-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p028-020-1-w10-Q09-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p028-020-1-w10-Q09-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (الدوري)' WHERE id = 'ent-r-p028-020-1-w10-Q03-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (الدوري)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)' WHERE id = 'ent-r-p028-020-1-w10-Q03-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (السوسي)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p028-020-1-w10-Q08-R01' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p028-020-1-w10-Q08-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p028-019-1-w15-Q01-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-p028-019-1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'ent-r-p028-019-1-w16-Q01-R02' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');

-- 2. Update farsh variant_type (for stored variant_type = other ONLY)

-- 3. Print count of approved entries per tier
SELECT review_source, count(*) AS approved_count
FROM qiraat_entries
WHERE id IN (
    'ent-r-p019-023-1-w8-Q06-R01',
    'r-p019-008-1',
    'r-p019-023-1',
    'ent-r-p019-023-1-w9-Q06-R01',
    'ent-r-p019-024-1-w12-Q06-R01',
    'r-p019-024-1',
    'ent-r-p019-024-1-w13-Q06-R01',
    'ent-r-p019-025-1-w15-Q06-R01',
    'r-p019-025-1',
    'ent-r-p019-025-1-w16-Q06-R01',
    'v-L019-ابراهيم-1-w2-a124-t3',
    'r-p019-014-1',
    'ent-r-p019-019-1-w15-Q03-R02',
    'r-p019-019-1',
    'ent-r-p019-019-1-w16-Q03-R02',
    'ent-r-p019-028-1-w18-Q05-R02',
    'v-DURI-002-124-18-r0072-performance-a124-t18',
    'ent-r-p019-028-1-w18-Q06-R01',
    'ent-r-p019-028-1-w18-Q06-R02',
    'ent-r-p019-028-1-w19-Q05-R02',
    'ent-r-p019-028-1-w19-Q06-R01',
    'ent-r-p019-028-1-w19-Q06-R02',
    'ent-r-p019-016-1-w1-Q04-R01',
    'ent-r-p019-016-1-w2-Q03-R01',
    'ent-r-p019-016-1-w2-Q03-R02',
    'ent-r-p019-016-1-w2-Q04-R01',
    'r-p019-014-2',
    'v-L019-واتخذوا-1-w2-a125-t7',
    'v-L019-ابراهيم-2-w2-a125-t10',
    'r-p019-003-1',
    'v-L019-ابراهيم-3-w2-a125-t14',
    'ent-r-p019-029-1-w18-Q01-R01',
    'v-DURI-002-125-18-r0074-performance-a125-t18',
    'ent-r-p019-029-1-w18-Q01-R02',
    'ent-r-p019-029-1-w18-Q04-R01',
    'ent-r-p019-029-1-w18-Q05-R02',
    'ent-r-p019-029-1-w18-Q08-R01',
    'ent-r-p019-029-1-w18-Q08-R02',
    'ent-r-p019-029-1-w19-Q01-R01',
    'ent-r-p019-029-1-w19-Q01-R02',
    'ent-r-p019-029-1-w19-Q04-R01',
    'ent-r-p019-029-1-w19-Q05-R02',
    'ent-r-p019-029-1-w19-Q08-R01',
    'ent-r-p019-029-1-w19-Q08-R02',
    'v-L019-ابراهيم-4-w2-a126-t3',
    'r-p019-005-1',
    'r-p019-006-1',
    'r-p019-007-1',
    'v-L020-ابراهيم-1-w2-a127-t3',
    'ent-r-p020-011-1-w7-Q03-R02',
    'r-p020-011-1',
    'ent-r-p020-011-1-w8-Q03-R02',
    'v-L020-FIHIM-w2-a129-t3',
    'r-p020-005-1',
    'v-L020-FIHIM-w2-a129-t12',
    'ent-r-p020-016-1-w1-Q06-R01',
    'r-p020-016-1',
    'ent-r-p020-016-1-w2-Q06-R01',
    'v-L020-ابراهيم-2-w2-a130-t5',
    'r-p020-001-1',
    'r-p020-004-1',
    'r-p020-006-1',
    'ent-r-p020-012-1-w2-Q03-R02',
    'r-p020-012-1',
    'ent-r-p020-012-1-w3-Q03-R02',
    'v-L020-ابراهيم-3-w2-a132-t3',
    'r-p020-002-1',
    'ent-r-p020-015-1-w3-Q01-R01',
    'r-p020-015-1',
    'ent-r-p020-015-1-w3-Q01-R02',
    'ent-r-p020-015-1-w3-Q02-R01',
    'ent-r-p020-015-1-w3-Q02-R02',
    'ent-r-p020-015-1-w3-Q03-R01',
    'ent-r-p020-015-1-w3-Q03-R02',
    'ent-r-p020-015-1-w3-Q08-R01',
    'ent-r-p020-015-1-w3-Q08-R02',
    'ent-r-p020-015-1-w3-Q09-R01',
    'ent-r-p020-015-1-w4-Q01-R01',
    'ent-r-p020-015-1-w4-Q01-R02',
    'ent-r-p020-015-1-w4-Q02-R01',
    'ent-r-p020-015-1-w4-Q02-R02',
    'ent-r-p020-015-1-w4-Q03-R01',
    'ent-r-p020-015-1-w4-Q03-R02',
    'ent-r-p020-015-1-w4-Q08-R01',
    'ent-r-p020-015-1-w4-Q08-R02',
    'ent-r-p020-015-1-w4-Q09-R01',
    'ent-r-p020-013-1-w9-Q03-R02',
    'r-p020-013-1',
    'ent-r-p020-013-1-w10-Q03-R02',
    'r-p020-003-1',
    'r-p020-007-1',
    'v-L020-ابراهيم-4-w2-a133-t20',
    'ent-r-p020-014-1-w25-Q03-R02',
    'r-p020-014-1',
    'ent-r-p020-014-1-w26-Q03-R02',
    'ent-r-DURI-002-135-4-r0079-IMALAH_TAQLIL-w4-Q03-R01',
    'r-DURI-002-135-4-r0079-IMALAH_TAQLIL',
    'ent-conflict-r-DURI-002-135-4-r0079-IMALAH_TAQLIL-w5-Q03-R01',
    'ent-r-p021-014-1-w11-Q06-R01',
    'r-p021-014-1',
    'ent-r-p021-014-1-w12-Q06-R01',
    'r-p021-002-1',
    'r-p021-003-1',
    'r-p021-003-2',
    'ent-r-p021-011-1-w29-Q03-R02',
    'r-p021-011-1',
    'ent-r-p021-011-1-w30-Q03-R02',
    'r-p021-005-1',
    'r-p021-006-1',
    'r-p021-010-1',
    'ent-r-p021-015-1-w7-Q06-R01',
    'r-p021-015-1',
    'ent-r-p021-011-2-w8-Q03-R02',
    'r-p021-011-2',
    'ent-r-p021-015-1-w8-Q06-R01',
    'ent-r-p021-011-2-w9-Q03-R02',
    'ent-r-p021-011-3-w12-Q03-R02',
    'r-p021-011-3',
    'ent-r-p021-011-3-w13-Q03-R02',
    'ent-r-DURI-002-140-11-r0084-IMALAH_TAQLIL-w11-Q03-R01',
    'r-DURI-002-140-11-r0084-IMALAH_TAQLIL',
    'ent-conflict-r-DURI-002-140-11-r0084-IMALAH_TAQLIL-w12-Q03-R01',
    'ent-conflict-r-p021-013-1-w14-Q01-R02',
    'ent-conflict-r-p021-013-1-w14-Q04-R01',
    'ent-r-p021-012-1-w19-Q03-R02',
    'r-p021-012-1',
    'ent-r-p021-012-1-w20-Q03-R02',
    'r-p022-024-1',
    'r-p022-007-1',
    'r-p022-009-1',
    'ent-r-DURI-002-142-8-r0087-MEEM_JAM-w8-Q03-R01',
    'ent-r-p022-018-1-w17-Q06-R01',
    'r-p022-018-1',
    'ent-r-p022-017-1-w18-Q01-R01',
    'ent-r-p022-017-1-w18-Q01-R02',
    'ent-r-p022-017-1-w18-Q02-R01',
    'ent-r-p022-017-1-w18-Q02-R02',
    'ent-r-p022-017-1-w18-Q03-R01',
    'ent-r-p022-017-1-w18-Q03-R02',
    'ent-r-p022-017-1-w18-Q08-R01',
    'ent-r-p022-017-1-w18-Q08-R02',
    'ent-r-p022-017-1-w18-Q09-R01',
    'ent-r-p022-018-1-w18-Q06-R01',
    'ent-r-p022-017-1-w19-Q01-R01',
    'ent-r-p022-017-1-w19-Q01-R02',
    'ent-r-p022-017-1-w19-Q02-R01',
    'ent-r-p022-017-1-w19-Q02-R02',
    'ent-r-p022-017-1-w19-Q08-R01',
    'ent-r-p022-017-1-w19-Q08-R02',
    'ent-r-p022-017-1-w19-Q09-R01',
    'ent-r-p022-019-1-w3-Q06-R01',
    'r-p022-019-1',
    'ent-r-p022-019-1-w4-Q06-R01',
    'r-p022-007-2',
    'ent-r-p022-020-1-w12-Q06-R01',
    'r-p022-020-1',
    'ent-r-p022-020-1-w13-Q06-R01',
    'ent-r-p022-014-1-w20-Q03-R02',
    'r-p022-014-1',
    'ent-r-p022-014-1-w21-Q03-R02',
    'r-p022-021-1',
    'ent-r-p022-021-1-w21-Q06-R01',
    'ent-r-p022-021-1-w22-Q06-R01',
    'ent-r-p022-022-1-w24-Q06-R01',
    'r-p022-022-1',
    'ent-r-p022-022-1-w25-Q06-R01',
    'r-p022-001-1',
    'r-p022-002-1',
    'r-p022-003-1',
    'r-p022-008-1',
    'ent-r-p022-015-1-w7-Q03-R02',
    'r-p022-015-1',
    'ent-r-p022-015-1-w8-Q03-R02',
    'r-p022-005-1',
    'r-p022-005-2',
    'ent-r-p022-016-1-w5-Q03-R02',
    'r-p022-016-1',
    'ent-r-p022-016-1-w6-Q03-R02',
    'r-p022-006-1',
    'ent-r-p022-023-1-w19-Q06-R01',
    'r-p022-023-1',
    'ent-r-p022-023-1-w20-Q06-R01',
    'r-p023-005-1',
    'r-p023-013-1',
    'ent-r-p023-012-1-w1-Q06-R01',
    'r-p023-012-1',
    'ent-r-p023-012-1-w2-Q06-R01',
    'v-L023-موليها-1-w2-a148-t4',
    'r-p023-001-1',
    'r-p023-008-1',
    'r-p023-002-1',
    'r-p023-011-1',
    'r-p023-009-1',
    'r-p023-006-1',
    'ent-r-p023-015-1-w6-Q09-R01',
    'ent-r-p023-015-1-w6-Q09-R02',
    'r-p023-007-1',
    'r-p023-004-1',
    'ent-r-p024-013-1-w3-Q06-R01',
    'r-p024-013-1',
    'ent-r-p024-013-1-w4-Q06-R01',
    'r-p024-008-1',
    'r-p024-001-1',
    'ent-r-p024-015-1-w6-Q06-R01',
    'r-p024-009-1',
    'r-p024-015-1',
    'ent-r-p024-015-1-w7-Q06-R01',
    'r-p024-002-1',
    'ent-r-p024-016-1-w15-Q06-R01',
    'r-p024-016-1',
    'ent-r-p024-016-1-w16-Q06-R01',
    'ent-r-p024-017-1-w18-Q06-R01',
    'r-p024-017-1',
    'ent-r-p024-017-1-w19-Q06-R01',
    'r-p024-004-1',
    'r-p024-005-1',
    'r-p024-003-1',
    'r-p024-011-1',
    'r-p024-012-1',
    'ent-r-p024-018-1-w2-Q06-R01',
    'r-p024-018-1',
    'ent-r-p024-018-1-w3-Q06-R01',
    'r-p025-007-1',
    'ent-r-p025-012-1-w33-Q06-R01',
    'r-p025-012-1',
    'ent-r-p025-012-1-w34-Q06-R01',
    'r-p025-002-1',
    'ent-r-p025-013-1-w42-Q06-R01',
    'r-p025-013-1',
    'ent-r-p025-013-1-w43-Q06-R01',
    'r-DURI-002-165-2-r0097-IMALAH_TAQLIL',
    'ent-r-p025-014-1-w3-Q06-R01',
    'r-p025-014-1',
    'ent-r-p025-014-1-w4-Q06-R01',
    'ent-r-p025-015-1-w8-Q06-R01',
    'r-p025-015-1',
    'ent-r-p025-015-1-w9-Q06-R01',
    'r-p025-003-1',
    'ent-r-p025-016-1-w27-Q06-R01',
    'r-p025-016-1',
    'ent-r-p025-016-1-w28-Q06-R01',
    'v-L025-ANNA2-w2-a165-t28',
    'ent-r-p025-010-1-w1-Q03-R01',
    'r-DURI-002-166-1-r0099-IDGHAM_KABIR',
    'ent-r-p025-010-1-w1-Q03-R02',
    'ent-r-p025-010-1-w1-Q04-R01',
    'ent-r-p025-010-1-w1-Q06-R01',
    'ent-r-p025-010-1-w1-Q06-R02',
    'ent-r-p025-010-1-w1-Q07-R01',
    'ent-r-p025-010-1-w1-Q07-R02',
    'ent-r-p025-010-1-w1-Q10-R01',
    'ent-r-p025-010-1-w1-Q10-R02',
    'ent-r-DURI-002-166-1-r0099-IDGHAM_KABIR-w1-Q03-R01',
    'ent-r-p025-010-1-w2-Q03-R01',
    'ent-r-p025-010-1-w2-Q03-R02',
    'ent-r-p025-010-1-w2-Q04-R01',
    'ent-r-p025-010-1-w2-Q06-R01',
    'ent-r-p025-010-1-w2-Q06-R02',
    'ent-r-p025-010-1-w2-Q07-R01',
    'ent-r-p025-010-1-w2-Q07-R02',
    'ent-r-p025-010-1-w2-Q10-R01',
    'ent-r-p025-010-1-w2-Q10-R02',
    'ent-r-DURI-002-166-1-r0099-IDGHAM_KABIR-w2-Q03-R01',
    'ent-r-DURI-002-166-11-r0100-MEEM_JAM-w12-Q03-R01',
    'r-p025-004-1',
    'ent-r-DURI-002-167-14-r0101-MEEM_JAM-w14-Q03-R01',
    'v-L025-يريهم_الله-1-w2-a167-t14',
    'ent-r-p025-017-1-w8-Q06-R01',
    'r-p025-017-1',
    'ent-r-p025-017-1-w9-Q06-R01',
    'ent-r-p026-013-1-w2-Q03-R02',
    'r-p026-013-1',
    'v-L026-قيل-1-w2-a170-t2',
    'ent-r-p026-013-1-w3-Q03-R02',
    'ent-r-p026-012-1-w9-Q07-R01',
    'r-p026-012-1',
    'ent-r-p026-012-1-w9-Q07-R02',
    'ent-r-p026-012-1-w10-Q07-R01',
    'ent-r-p026-012-1-w10-Q07-R02',
    'r-p026-001-1',
    'r-p026-005-1',
    'r-p026-020-1',
    'r-p026-006-1',
    'ent-r-p026-017-1-w20-Q06-R01',
    'r-p026-008-1',
    'ent-r-p026-018-1-w11-Q06-R01',
    'r-p026-018-1',
    'ent-r-p026-018-1-w12-Q06-R01',
    'r-p026-007-1',
    'r-p026-002-1',
    'v-L026-الميته-1-w2-a173-t4',
    'v-L026-فمن_اضطر-1-w2-a173-t13',
    'v-L026-فمن_اضطر-1-w3-a173-t13',
    'r-p026-003-1',
    'ent-r-p026-019-1-w16-Q06-R01',
    'r-p026-019-1',
    'ent-r-p026-019-1-w17-Q06-R01',
    'r-p026-001-2',
    'v-L026-يزكيهم-1-w2-a174-t26',
    'ent-r-p026-022-1-w28-Q06-R02',
    'ent-r-p026-022-1-w29-Q06-R02',
    'ent-r-p026-014-1-w6-Q03-R02',
    'r-p026-014-1',
    'ent-r-p026-014-1-w7-Q03-R02',
    'r-p026-004-1',
    'r-p026-011-1',
    'r-DURI-002-175-11-r0105-IMALAH_TAQLIL',
    'ent-r-p026-015-1-w5-Q03-R02',
    'r-p026-015-1',
    'ent-r-p026-015-1-w6-Q03-R02',
    'r-p027-006-1',
    'r-p027-007-1',
    'v-L027-والنبيين-1-w2-a177-t18',
    'r-DURI-002-177-24-r0107-IMALAH_TAQLIL',
    'r-p027-005-1',
    'r-p027-010-1',
    'r-p027-001-1',
    'r-p027-011-1',
    'r-p027-002-1',
    'r-p027-022-1',
    'r-p027-018-1',
    'ent-r-p027-023-1-w36-Q06-R02',
    'ent-r-p027-023-1-w37-Q06-R02',
    'ent-r-p027-020-1-w4-Q06-R01',
    'r-p027-020-1',
    'ent-r-p027-020-1-w5-Q06-R01',
    'r-p027-004-1',
    'r-p028-008-1',
    'r-p028-001-1',
    'r-p028-007-1',
    'ent-r-p028-018-1-w12-Q06-R02',
    'ent-r-p028-018-1-w13-Q06-R02',
    'v-L028-فديه_طعام_مسكين-1-w3-a184-t17',
    'ent-r-p028-013-1-w18-Q03-R02',
    'r-p028-013-1',
    'ent-r-p028-013-1-w19-Q03-R02',
    'ent-r-p028-017-1-w20-Q06-R01',
    'r-p028-017-1',
    'ent-r-p028-017-1-w21-Q06-R01',
    'r-p028-003-1',
    'r-p028-004-1',
    'r-p028-004-2',
    'ent-r-p028-014-1-w1-Q03-R02',
    'r-p028-014-1',
    'ent-r-p028-014-1-w2-Q03-R02',
    'v-L028-القرءان-1-w2-a185-t6',
    'r-p028-012-1',
    'r-p028-002-1',
    'ent-r-p028-018-2-w26-Q06-R02',
    'ent-r-p028-018-2-w27-Q06-R02',
    'v-L028-اليسر-1-w2-a185-t31',
    'v-L028-العسر-1-w2-a185-t35',
    'r-p028-005-1',
    'r-p028-011-1',
    'ent-r-p028-020-1-w9-Q09-R01',
    'ent-r-p028-020-1-w9-Q09-R02',
    'ent-r-p028-020-1-w9-Q03-R01',
    'ent-r-p028-020-1-w9-Q03-R02',
    'ent-r-p028-020-1-w10-Q09-R01',
    'ent-r-p028-020-1-w10-Q09-R02',
    'ent-r-p028-020-1-w10-Q03-R01',
    'ent-r-p028-020-1-w10-Q03-R02',
    'ent-r-p028-020-1-w10-Q08-R01',
    'ent-r-p028-020-1-w10-Q08-R02',
    'ent-r-p028-019-1-w15-Q01-R02',
    'r-p028-019-1',
    'ent-r-p028-019-1-w16-Q01-R02'
  )
  AND review_status = 'reviewed'
GROUP BY review_source
ORDER BY review_source;

COMMIT;
