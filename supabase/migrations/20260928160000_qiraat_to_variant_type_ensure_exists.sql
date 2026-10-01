-- ============================================================================
-- Fix: qiraat_to_variant_type(text), which qiraat_review_create_entry calls for every
-- farsh/variant entry, does not exist on live -- despite being defined in
-- 20260927100000_qiraat_review_safe_variant_type.sql.
--
-- Confirmed live (Vercel runtime logs): "[qiraat-review] database failure function
-- qiraat_to_variant_type(text) does not exist", raised from inside
-- qiraat_review_create_entry's step 5 (create details) the moment it finally got a
-- chance to run -- the third latent bug this same page-18/2:113 investigation has
-- uncovered, each hidden behind the one before it. PL/pgSQL does not validate a called
-- function's existence at CREATE FUNCTION time, only at first execution -- exactly the
-- same blind spot that hid the qiraat_entry_narrators bug (20260928140000). Whatever
-- happened to 20260927100000 on live (partial apply that rolled back before reaching
-- this CREATE FUNCTION, or it was simply never run), the safe fix is to stop depending
-- on its fate: this migration (re)creates the function directly, byte-identical to
-- 20260927100000's definition, so it exists regardless of history.
--
-- Rollback: supabase/rollbacks/20260928160000_qiraat_to_variant_type_ensure_exists.down.sql
-- Idempotent: CREATE OR REPLACE.
-- ============================================================================

CREATE OR REPLACE FUNCTION qiraat_to_variant_type(p_val text)
RETURNS qiraat_variant_type LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE lower(btrim(coalesce(p_val, '')))
    WHEN 'vowel' THEN 'vowel'::qiraat_variant_type
    WHEN 'harakah' THEN 'vowel'::qiraat_variant_type
    WHEN 'تشكيل' THEN 'vowel'::qiraat_variant_type
    WHEN 'تشكيل / حركة' THEN 'vowel'::qiraat_variant_type
    WHEN 'حركة' THEN 'vowel'::qiraat_variant_type
    WHEN 'consonant' THEN 'consonant'::qiraat_variant_type
    WHEN 'letter' THEN 'consonant'::qiraat_variant_type
    WHEN 'حرف' THEN 'consonant'::qiraat_variant_type
    WHEN 'إبدال حرف' THEN 'consonant'::qiraat_variant_type
    WHEN 'إبدال' THEN 'consonant'::qiraat_variant_type
    WHEN 'addition' THEN 'addition'::qiraat_variant_type
    WHEN 'زيادة' THEN 'addition'::qiraat_variant_type
    WHEN 'زيادة حرف/كلمة' THEN 'addition'::qiraat_variant_type
    WHEN 'زيادة حرف' THEN 'addition'::qiraat_variant_type
    WHEN 'omission' THEN 'omission'::qiraat_variant_type
    WHEN 'حذف' THEN 'omission'::qiraat_variant_type
    WHEN 'حذف حرف/كلمة' THEN 'omission'::qiraat_variant_type
    WHEN 'حذف حرف' THEN 'omission'::qiraat_variant_type
    WHEN 'word_form' THEN 'word_form'::qiraat_variant_type
    WHEN 'تقديم وتأخير' THEN 'word_form'::qiraat_variant_type
    WHEN 'تقديم وتأخير / بنية الكلمة' THEN 'word_form'::qiraat_variant_type
    WHEN 'بنية الكلمة' THEN 'word_form'::qiraat_variant_type
    WHEN 'orthography' THEN 'orthography'::qiraat_variant_type
    WHEN 'رسم' THEN 'orthography'::qiraat_variant_type
    WHEN 'hamza' THEN 'hamza'::qiraat_variant_type
    WHEN 'hamz' THEN 'hamza'::qiraat_variant_type
    WHEN 'همز' THEN 'hamza'::qiraat_variant_type
    WHEN 'همزة' THEN 'hamza'::qiraat_variant_type
    WHEN 'madd' THEN 'madd'::qiraat_variant_type
    WHEN 'مد' THEN 'madd'::qiraat_variant_type
    WHEN 'idgham' THEN 'idgham'::qiraat_variant_type
    WHEN 'إدغام' THEN 'idgham'::qiraat_variant_type
    WHEN 'ishmam' THEN 'ishmam'::qiraat_variant_type
    WHEN 'إشمام' THEN 'ishmam'::qiraat_variant_type
    WHEN 'imalah' THEN 'imalah'::qiraat_variant_type
    WHEN 'إمالة' THEN 'imalah'::qiraat_variant_type
    WHEN 'taqlil' THEN 'taqlil'::qiraat_variant_type
    WHEN 'تقليل' THEN 'taqlil'::qiraat_variant_type
    WHEN 'sakt' THEN 'sakt'::qiraat_variant_type
    WHEN 'سكت' THEN 'sakt'::qiraat_variant_type
    WHEN 'naql' THEN 'naql'::qiraat_variant_type
    WHEN 'نقل' THEN 'naql'::qiraat_variant_type
    WHEN 'ikhfa' THEN 'ikhfa'::qiraat_variant_type
    WHEN 'إخفاء' THEN 'ikhfa'::qiraat_variant_type
    WHEN 'ghunnah' THEN 'ghunnah'::qiraat_variant_type
    WHEN 'غنة' THEN 'ghunnah'::qiraat_variant_type
    WHEN 'pronoun' THEN 'pronoun'::qiraat_variant_type
    WHEN 'ضمير' THEN 'pronoun'::qiraat_variant_type
    WHEN 'grammar' THEN 'grammar'::qiraat_variant_type
    WHEN 'إعراب' THEN 'grammar'::qiraat_variant_type
    WHEN 'other' THEN 'other'::qiraat_variant_type
    WHEN 'أخرى' THEN 'other'::qiraat_variant_type
    ELSE 'other'::qiraat_variant_type
  END;
$$;

GRANT EXECUTE ON FUNCTION qiraat_to_variant_type(text) TO authenticated, service_role, anon;

NOTIFY pgrst, 'reload schema';
