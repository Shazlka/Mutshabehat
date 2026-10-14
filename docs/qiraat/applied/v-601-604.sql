-- ============================================================================
-- Qiraat Automatic Review Approval SQL («معتمد آليًا»)
-- Generated: 2026-10-14T06:20:20.989Z
-- Total verdicts: 85, Approved in this script: 7
-- ============================================================================
--
-- Queued for human review:
-- Farsh entries whose derived sub-category differs from stored non-other variant_type
-- (These are NOT modified by this script)
--   v-SRC601-جمع-w2-a2-t2 (ref: 104:2:2, word: جَمَعَ): stored='consonant' != derived='vowel'
--   v-L-104-008-002-cc741af3-e2d8b4 (ref: 104:8:2, word: عَلَيْهِم): stored='vowel' != derived='addition'
--   v-SRC601-عمد-w2-a9-t2 (ref: 104:9:2, word: عَمَدٍۢ): stored='consonant' != derived='vowel'
--   v-L-105-003-002-ff80da8f-feb0f1 (ref: 105:3:2, word: عَلَيْهِمْ): stored='vowel' != derived='addition'
--   v-SUSI-106-2-1-4582-a2-t1 (ref: 106:2:1, word: إِۦلَـٰفِهِمْ): stored='omission' != derived='addition'
--   v-SUSI-107-1-1-4583-a1-t1 (ref: 107:1:1, word: أَرَءَيْتَ): stored='hamza' != derived='omission'
--   v-SRC604-كفؤا-باقون-w2-a4-t4 (ref: 112:4:4, word: كُفُوًا): stored='hamza' != derived='consonant'
--
BEGIN;

SELECT set_config('app.device_id', 'auto-review', true);

-- 1. Approve entries (tiers A1, A2)
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-SUSI-104-1-3-4575-IDGHAM_KABIR' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر، حمزة، الكسائي، خلف العاشر)' WHERE id = 'v-SRC601-جمع-w2-a2-t2' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (الدوري)' WHERE id = 'v-DURI-104-3-1-r2733-performance-a3-t1' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'v-SUSI-104-8-3-4577-performance-a8-t3' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-SQL602-WAQF_HAMZA-3-2' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'v-SUSI-108-3-2-4584-performance-a3-t2' AND review_status = 'unreviewed' AND deleted_at IS NULL;
UPDATE qiraat_entries SET review_status = 'reviewed', review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'v-SRC604-كفؤا-وصل-w2-a4-t4' AND review_status = 'unreviewed' AND deleted_at IS NULL;

-- 1b. Refresh the source label of earlier automatic approvals (never touches human approvals)
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-SUSI-104-1-3-4575-IDGHAM_KABIR' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر، حمزة، الكسائي، خلف العاشر)' WHERE id = 'v-SRC601-جمع-w2-a2-t2' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (ابن عامر، حمزة، الكسائي، خلف العاشر)');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (الدوري)' WHERE id = 'v-DURI-104-3-1-r2733-performance-a3-t1' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (الدوري)');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'v-SUSI-104-8-3-4577-performance-a8-t3' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'r-SQL602-WAQF_HAMZA-3-2' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran', review_note = 'طابق nquran.com' WHERE id = 'v-SUSI-108-3-2-4584-performance-a3-t2' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran' OR review_note IS DISTINCT FROM 'طابق nquran.com');
UPDATE qiraat_entries SET review_source = 'auto:nquran+book', review_note = 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)' WHERE id = 'v-SRC604-كفؤا-وصل-w2-a4-t4' AND review_status = 'reviewed' AND review_source LIKE 'auto:%' AND (review_source IS DISTINCT FROM 'auto:nquran+book' OR review_note IS DISTINCT FROM 'طابق nquran.com وكتاب القراءة المعتمد (حمزة)');

-- 2. Update farsh variant_type (for stored variant_type = other ONLY)
UPDATE qiraat_variant_details SET variant_type = 'vowel' WHERE entry_id = 'v-DURI-104-3-1-r2733-performance-a3-t1' AND variant_type = 'other';

-- 3. Print count of approved entries per tier
SELECT review_source, count(*) AS approved_count
FROM qiraat_entries
WHERE id IN (
    'r-SUSI-104-1-3-4575-IDGHAM_KABIR',
    'v-SRC601-جمع-w2-a2-t2',
    'v-DURI-104-3-1-r2733-performance-a3-t1',
    'v-SUSI-104-8-3-4577-performance-a8-t3',
    'r-SQL602-WAQF_HAMZA-3-2',
    'v-SUSI-108-3-2-4584-performance-a3-t2',
    'v-SRC604-كفؤا-وصل-w2-a4-t4'
  )
  AND review_status = 'reviewed'
GROUP BY review_source
ORDER BY review_source;

COMMIT;
