# Pages 1–10 — visual verification (Phase 5 of the pages-1-10 task)

Local production build (`next build` + `next start`, dummy Supabase env vars so the middleware
doesn't 500 — no real backend reachable from this sandbox, same constraint as every other local
verification pass in this project), driven with Playwright/Chromium at 480×900 (phone viewport).
For each page: opened the burger menu → "القراءات" panel → مقارنة القراءات mode → enabled the
dev-only "عرض بيانات قيد المراجعة" (include reviewed) toggle, since nothing in this batch is
VERIFIED yet and the normal view would show nothing. Screenshots are not committed to git (ephemeral
verification artifacts, consistent with how the page-1 prototype's own `08-test-results.md`
documents screenshots by description rather than binary file) — sent directly to the user instead.

## What was checked

- **Page 1** — the corrected مالك/ملك attribution (now REVIEWED, 6 readers/12 narrators, not the
  earlier incorrect VERIFIED/8-reader version) and the 1:6/1:7 صراط + 1:7 عليهم markers all render
  as colour-coded underlines under the correct words, with no console/page errors.
- **Page 4** — the CRITICAL-REVIEW شاء الله placeholder (`NEEDS_MANUAL_REVIEW`, empty `readingIds`)
  renders as a neutral marker and is tappable: the قراءات detail panel opens, shows the red
  "تحتاج مراجعة يدوية — غير مؤكدة من المصدر الأصلي" badge, the performance-only text (no fake
  strikethrough diff, since `variantText === hafsText`), the `performanceNote`, the tracking-only
  `notes`, and — the fix under test — **"لم تُحدَّد نسبة هذه القراءة إلى قارئ/راوٍ بعد"** instead of
  a misleading "N رواية بلا تغيير" line. No crash, confirming the `computeAttribution([])` guard
  (`pages-001-010-reconciliation.md` §5) actually holds end-to-end through the real UI, not just in
  the unit test.
- **Page 6** — the 2:37 آدم/كلمات multi-word locus: both disjoint words (`ءَادَمَ` and `كَلِمَـٰتٍۢ`)
  show their own underline marker independently, confirming the shared-`locusId`/independent-
  resolution design works through the real per-token rendering path, not just in isolation.
- **Page 10** — the 2:67 هزوا three-way split (حفص / حمزة+خلف العاشر / الباقون) renders without
  error, including the "الباقون" branch computed as a set difference rather than a stored person.

Every page loaded with **zero console/page JS errors** related to Qiraat (the only console errors
present are expected: 401s from the annotations/mutshabehat endpoints, since this sandbox has no
real Supabase session, and the QCF glyph font failing to load — same documented fallback-to-Amiri
behavior as every other Mushaf-1441 page in this environment, unrelated to this batch).

## Not part of this pass

Riwayah-mode (القراءة برواية) full-page substitution and the reader/reading comparison filters
reuse the exact same `resolveTokenForReading`/`comparisonMarkerForWord` code paths already
Playwright-verified for page 1 in the original prototype (`08-test-results.md`) and exercised by
this session's own reconciliation script against all 10 pages' data — not re-screenshotted per
mode×page here to stay within this phase's scope (12 combinations for one already-verified
mechanism would not surface new information).
