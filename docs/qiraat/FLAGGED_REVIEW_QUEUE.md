# Qiraat Flagged Review Queue (Triage)

**Triage Date:** 2026-09-24  
**Corpus Status:** 932 open flags across 881 flagged entries and 806 loci (Pages 1–604)  
**Rule:** **READ-ONLY TRIAGE.** No flags or records have been resolved or modified.  

---

## 1. Executive Triage Matrix

The 932 open QA flags are triaged into three distinct action tiers based on resolution complexity and scholarly requirement:

| Tier | Flag Type | Open Flags | Entries | Review Strategy | Scholarly Risk |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Tier 1** | `NARRATOR_TWICE` | 143 | 143 | **Bulk Deduplication**: Automated removal of duplicate narrator assignments | Low |
| **Tier 1** | `DB_ONLY` | 58 | 58 | **Bulk Fixture Reconciliation**: Promote valid variants or retire legacy rows | Low |
| **Tier 2** | `Q6_AMBIGUOUS` | 472 | 472 | **Category-Guided Bulk Review**: Farsh vs. Usul taxonomy classification | Medium |
| **Tier 3** | `D8_HAFS_KEPT` | 119 | 119 | **Scholarly Authority Audit**: D8 Hafs baseline vs. legitimate secondary wajh | High |
| **Tier 3** | `DOCUMENTED_CONFLICT` | 81 | 79 | **Matn & Tariq Discrepancy**: Shatibiyya vs. Durra / Tayyiba reconciliation | High |
| **Tier 3** | `ATTRIBUTION_MISMATCH` | 54 | 49 | **Authority Normalization**: Resolving narrator subsets vs verbatim source string | High |
| **Tier 3** | `NEEDS_MANUAL_REVIEW` | 5 | 5 | **Priority Critical Review**: Explicit source defects on Surah Al-Baqarah | Critical |
| **TOTAL** | | **932** | **885** (881 distinct) | | |

---

## 2. Tier 1: Bulk-Reviewable & Structural Discrepancies

These 201 flags represent structural or duplicate anomalies that do not dispute Quranic reading variants and can be systematically resolved in batches.

### 2.1 `NARRATOR_TWICE` (143 flags)
**Description:** The same narrator (`reading_id`) appears twice in the first wajh (`wajh_order = 1`), typically when a narrator was attributed both explicitly and inherited via a parent reader in the same source record.
**Resolution Procedure:** Automated deduplication keeping one distinct `(entry_id, reading_id, action_ar)` tuple.

| Page | Surah:Ayah | Locus Text | Entry ID | Issue Description | Review Link |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 115 | 5:43 | ٱلتَّوْرَىٰةُ | `r-p115-008-1` | [phase3] راوٍ مكرر في الوجه الأول عند الموضع | [/mushaf-1441/review?page=115](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=115) |
| 115 | 5:43 | ٱلتَّوْرَىٰةُ | `r-p115-009-1` | [phase3] راوٍ مكرر في الوجه الأول عند الموضع | [/mushaf-1441/review?page=115](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=115) |
| 132 | 6:37 | ءَايَةٌۭ | `r-p132-010-1` | [phase3] راوٍ مكرر في الوجه الأول عند الموضع | [/mushaf-1441/review?page=132](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=132) |
| 132 | 6:37 | ءَايَةٌۭ | `r-p132-011-1` | [phase3] راوٍ مكرر في الوجه الأول عند الموضع | [/mushaf-1441/review?page=132](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=132) |
| 132 | 6:39 | يَشَإِ | `r-p132-021-1` | [phase3] راوٍ مكرر في الوجه الأول عند الموضع | [/mushaf-1441/review?page=132](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=132) |
| 132 | 6:39 | يَشَإِ | `r-p132-022-1` | [phase3] راوٍ مكرر في الوجه الأول عند الموضع | [/mushaf-1441/review?page=132](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=132) |
| 138 | 6:88 | هُدَى | `r-p138-010-1` | [phase3] راوٍ مكرر في الوجه الأول عند الموضع | [/mushaf-1441/review?page=138](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=138) |
| 138 | 6:88 | هُدَى | `r-p138-012-1` | [phase3] راوٍ مكرر في الوجه الأول عند الموضع | [/mushaf-1441/review?page=138](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=138) |
| 183 | 8:48 | إِنِّىٓ أَرَىٰ | `v-DURI-008-48-26-r0783-performance-a48-t26` | [phase3] راوٍ مكرر في الوجه الأول عند الموضع | [/mushaf-1441/review?page=183](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=183) |
| 183 | 8:48 | إِنِّىٓ أَرَىٰ | `r-p183-023-1` | [phase3] راوٍ مكرر في الوجه الأول عند الموضع | [/mushaf-1441/review?page=183](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=183) |
| 219 | 10:90 | ءَامَنتُ | `r-p219-004-1` | [phase3] راوٍ مكرر في الوجه الأول عند الموضع | [/mushaf-1441/review?page=219](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=219) |
| 219 | 10:90 | ءَامَنتُ | `r-p219-005-1` | [phase3] راوٍ مكرر في الوجه الأول عند الموضع | [/mushaf-1441/review?page=219](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=219) |
| 225 | 11:32 | فَأْتِنَا | `r-p225-019-1` | [phase3] راوٍ مكرر في الوجه الأول عند الموضع | [/mushaf-1441/review?page=225](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=225) |
| 225 | 11:33 | يَأْتِيكُم | `r-p225-020-1` | [phase3] راوٍ مكرر في الوجه الأول عند الموضع | [/mushaf-1441/review?page=225](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=225) |
| 226 | 11:39 | يَأْتِيهِ | `r-p226-016-1` | [phase3] راوٍ مكرر في الوجه الأول عند الموضع | [/mushaf-1441/review?page=226](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=226) |
| 230 | 11:72 | يَـٰوَيْلَتَىٰٓ | `r-p230-008-1` | [phase3] راوٍ مكرر في الوجه الأول عند الموضع | [/mushaf-1441/review?page=230](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=230) |
| 231 | 11:86 | مُّؤْمِنِينَ ۚ | `r-p231-015-1` | [phase3] راوٍ مكرر في الوجه الأول عند الموضع | [/mushaf-1441/review?page=231](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=231) |
| 231 | 11:87 | تَأْمُرُكَ | `r-p231-016-1` | [phase3] راوٍ مكرر في الوجه الأول عند الموضع | [/mushaf-1441/review?page=231](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=231) |
| 232 | 11:93 | يَأْتِيهِ | `r-p232-016-1` | [phase3] راوٍ مكرر في الوجه الأول عند الموضع | [/mushaf-1441/review?page=232](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=232) |
| 237 | 12:17 | ٱلذِّئْبُ ۖ | `r-p237-023-1` | [phase3] راوٍ مكرر في الوجه الأول عند الموضع | [/mushaf-1441/review?page=237](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=237) |
| 242 | 12:54 | ٱلْمَلِكُ ٱئْتُونِى | `r-p242-018-1` | [phase3] راوٍ مكرر في الوجه الأول عند الموضع | [/mushaf-1441/review?page=242](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=242) |
| 242 | 12:59 | قَالَ ٱئْتُونِى | `r-p242-019-1` | [phase3] راوٍ مكرر في الوجه الأول عند الموضع | [/mushaf-1441/review?page=242](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=242) |
| 242 | 12:60 | تَأْتُونِى | `r-p242-020-1` | [phase3] راوٍ مكرر في الوجه الأول عند الموضع | [/mushaf-1441/review?page=242](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=242) |
| 243 | 12:66 | تُؤْتُونِ | `r-p243-020-1` | [phase3] راوٍ مكرر في الوجه الأول عند الموضع | [/mushaf-1441/review?page=243](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=243) |
| 243 | 12:66 | لَتَأْتُنَّنِى | `r-p243-021-1` | [phase3] راوٍ مكرر في الوجه الأول عند الموضع | [/mushaf-1441/review?page=243](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=243) |
| 245 | 12:80 | لِىٓ أَبِىٓ | `v-DURI-012-80-29-r1056-performance-a80-t29` | [phase3] راوٍ مكرر في الوجه الأول عند الموضع | [/mushaf-1441/review?page=245](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=245) |
| 245 | 12:80 | لِىٓ أَبِىٓ | `r-p245-YAAT_IDAFA-لي_ابي-18` | [phase3] راوٍ مكرر في الوجه الأول عند الموضع | [/mushaf-1441/review?page=245](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=245) |
| 253 | 13:31 | يَأْتِىَ | `r-p253-002-1` | [phase3] راوٍ مكرر في الوجه الأول عند الموضع | [/mushaf-1441/review?page=253](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=253) |
| 253 | 13:31 | يَأْتِىَ | `r-p253-011-1` | [phase3] راوٍ مكرر في الوجه الأول عند الموضع | [/mushaf-1441/review?page=253](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=253) |
| 254 | 13:38 | يَأْتِىَ | `r-p254-004-1` | [phase3] راوٍ مكرر في الوجه الأول عند الموضع | [/mushaf-1441/review?page=254](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=254) |
| ... | ... | ... | ... | *(+ 113 more entries across pages 115–583)* | ... |

### 2.2 `DB_ONLY` (58 flags)
**Description:** Records existing in PostgreSQL that do not exist in the 604 page JSON fixtures (`packages/qiraat-core/fixtures/pages/`). These originated from earlier database imports and require promotion into fixtures or graceful archiving.

| Page | Surah:Ayah | Locus Text | Entry ID | Issue Description | Review Link |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 58 | 3:66 | هَـٰٓأَنتُمْ | `v-L058-هانتم-1-w4-a66-t1` | [phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-L058-هانتم-1-w4-a66-t1 | [/mushaf-1441/review?page=58](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=58) |
| 65 | 3:119 | هَـٰٓأَنتُمْ | `v-L065-هاانتم-1-w3-a119-t1` | [phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-L065-هاانتم-1-w3-a119-t1 | [/mushaf-1441/review?page=65](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=65) |
| 261 | 14:44 | يَأْتِيهِمُ ٱلْعَذَابُ | `v-D261-ياتيهم_العذاب-performance2-a44-t4` | [phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D261-ياتيهم_العذاب-performance2-a44-t4 | [/mushaf-1441/review?page=261](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=261) |
| 261 | 14:44 | يَأْتِيهِمُ ٱلْعَذَابُ | `v-D261-ياتيهم_العذاب-performance3-a44-t4` | [phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D261-ياتيهم_العذاب-performance3-a44-t4 | [/mushaf-1441/review?page=261](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=261) |
| 279 | 16:104 | لَا يَهْدِيهِمُ ٱللَّهُ | `v-D279-لا_يهديهم_الله-performance2-a104-t7` | [phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D279-لا_يهديهم_الله-performance2-a104-t7 | [/mushaf-1441/review?page=279](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=279) |
| 279 | 16:104 | لَا يَهْدِيهِمُ ٱللَّهُ | `v-D279-لا_يهديهم_الله-performance3-a104-t7` | [phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D279-لا_يهديهم_الله-performance3-a104-t7 | [/mushaf-1441/review?page=279](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=279) |
| 300 | 18:55 | قُبُلًۭا | `v-D300-قبلا-w1-a55-t19` | [phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D300-قبلا-w1-a55-t19 | [/mushaf-1441/review?page=300](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=300) |
| 305 | 19:8 | عِتِيًّۭا | `v-D305-عتيا-w2-a8-t14` | [phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D305-عتيا-w2-a8-t14 | [/mushaf-1441/review?page=305](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=305) |
| 307 | 19:34 | قَوْلَ ٱلْحَقِّ | `v-D307-قول_الحق-w1-a34-t5` | [phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D307-قول_الحق-w1-a34-t5 | [/mushaf-1441/review?page=307](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=307) |
| 308 | 19:51 | مُخْلَصًۭا | `v-D308-مخلصا-w1-a51-t7` | [phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D308-مخلصا-w1-a51-t7 | [/mushaf-1441/review?page=308](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=308) |
| 310 | 19:66 | أَءِذَا | `v-D310-اءذا-w1-a66-t3` | [phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D310-اءذا-w1-a66-t3 | [/mushaf-1441/review?page=310](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=310) |
| 327 | 21:63 | فَسْـَٔلُوهُمْ | `v-D327-فسلوهم-w2-a63-t6-h71d86bd4a75b3fad` | [phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D327-فسلوهم-w2-a63-t6-h71d86bd4a75b3fad | [/mushaf-1441/review?page=327](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=327) |
| 343 | 23:21 | نُّسْقِيكُم | `v-D343-نسقيكم-performance2-a21-t6` | [phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D343-نسقيكم-performance2-a21-t6 | [/mushaf-1441/review?page=343](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=343) |
| 363 | 25:41 | هُزُوًا | `v-L363-s25a41b0-w3-a41-t6` | [phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-L363-s25a41b0-w3-a41-t6 | [/mushaf-1441/review?page=363](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=363) |
| 400 | 29:33 | مُنَجُّوكَ | `v-D400-منجوك-w2-a33-t17-h6fc99fd3d5438d24` | [phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D400-منجوك-w2-a33-t17-h6fc99fd3d5438d24 | [/mushaf-1441/review?page=400](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=400) |
| 412 | 31:18 | وَلَا تُصَعِّرْ | `v-D412-ولا_تصعر-w2-a18-t1` | [phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D412-ولا_تصعر-w2-a18-t1 | [/mushaf-1441/review?page=412](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=412) |
| 413 | 31:27 | وَٱلْبَحْرُ | `v-D413-والبحر-w2-a27-t8` | [phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D413-والبحر-w2-a27-t8 | [/mushaf-1441/review?page=413](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=413) |
| 421 | 33:30 | يُضَـٰعَفْ لَهَا ٱلْعَذَابُ | `v-D421-يضاعف_لها_العذاب-w4-a30-t8` | [phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D421-يضاعف_لها_العذاب-w4-a30-t8 | [/mushaf-1441/review?page=421](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=421) |
| 439 | 35:40 | بَيِّنَتٍۢ | `v-D439-بينت-w2-a40-t24` | [phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D439-بينت-w2-a40-t24 | [/mushaf-1441/review?page=439](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=439) |
| 446 | 37:6 | بِزِينَةٍ ٱلْكَوَاكِبِ | `v-D446-بزينه_الكواكب-w2-a6-t5` | [phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D446-بزينه_الكواكب-w2-a6-t5 | [/mushaf-1441/review?page=446](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=446) |
| 447 | 37:25 | لَا تَنَاصَرُونَ | `v-D447-لا_تناصرون-w2-a25-t3` | [phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D447-لا_تناصرون-w2-a25-t3 | [/mushaf-1441/review?page=447](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=447) |
| 447 | 37:40 | ٱلْمُخْلَصِينَ | `v-D447-المخلصين-w2-a40-t4` | [phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D447-المخلصين-w2-a40-t4 | [/mushaf-1441/review?page=447](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=447) |
| 448 | 37:53 | مِتْنَا | `v-D448-متنا-w2-a53-t2` | [phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D448-متنا-w2-a53-t2 | [/mushaf-1441/review?page=448](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=448) |
| 448 | 37:56 | لَتُرْدِينِ | `v-L448-s37a56b0-w2-a56-t5` | [phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-L448-s37a56b0-w2-a56-t5 | [/mushaf-1441/review?page=448](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=448) |
| 448 | 37:74 | ٱلْمُخْلَصِينَ | `v-D448-المخلصين-w2-a74-t4` | [phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D448-المخلصين-w2-a74-t4 | [/mushaf-1441/review?page=448](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=448) |
| 459 | 39:7 | يَرْضَهُ | `v-D459-يرضه-w2-DOCX-P459-R02655-a7-t13` | [phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D459-يرضه-w2-DOCX-P459-R02655-a7-t13 | [/mushaf-1441/review?page=459](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=459) |
| 471 | 40:40 | يَدْخُلُونَ | `v-D471-يدخلون-w2-a40-t18` | [phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D471-يدخلون-w2-a40-t18 | [/mushaf-1441/review?page=471](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=471) |
| 472 | 40:46 | أَدْخِلُوٓا۟ | `v-D472-ادخلوا-w2-a46-t9` | [phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D472-ادخلوا-w2-a46-t9 | [/mushaf-1441/review?page=472](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=472) |
| 486 | 42:23 | يُبَشِّرُ | `v-D486-يبشر-w1-a23-t3` | [phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D486-يبشر-w1-a23-t3 | [/mushaf-1441/review?page=486](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=486) |
| 495 | 43:85 | تُرْجَعُونَ | `v-D495-ترجعون-w2-a85-t13-h03798a01768f602f` | [phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D495-ترجعون-w2-a85-t13-h03798a01768f602f | [/mushaf-1441/review?page=495](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=495) |
| ... | ... | ... | ... | *(+ 28 more entries across pages 58–582)* | ... |

---

## 3. Tier 2: Category-Guided Bulk Review (`Q6_AMBIGUOUS`)

Total: **472 flags** across 271 pages.
**Description:** Ambiguity between whether an entry is classified as **Farsh** (فرش الحروف) or an **Usul ruling** (أصول: ياءات إضافة، صلة، إمالة، تغيير همز).
**Sub-category Breakdown:**
- **FARSH**: 280 entries
- **YAAT_IDAFA**: 60 entries
- **AMBIGUOUS**: 47 entries
- **SILAT_HA**: 31 entries
- **TAGHYIR_HAMZ**: 23 entries
- **غير متاح**: 14 entries
- **WAQF_RASM**: 10 entries
- **IMALAH_TAQLIL**: 6 entries
- **TARQIQ_RA**: 1 entries

### Sample Review Queue for `Q6_AMBIGUOUS` (Grouped by Target Category)

| Target Category | Page | Surah:Ayah | Base Text | Entry ID | Reading Text | Review Link |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **FARSH** | 3 | 2:11 | قِيلَ | `v-L003-قيل-1-w2-a11-t2` | قِيلَ | [/mushaf-1441/review?page=3](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=3) |
| **FARSH** | 3 | 2:13 | قِيلَ | `v-L003-قيل-2-w2-a13-t2` | قِيلَ | [/mushaf-1441/review?page=3](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=3) |
| **FARSH** | 8 | 2:54 | بَارِئِكُمْ | `v-L008-باريكم-1-w3-a54-t13` | بَارِئِكُمْ | [/mushaf-1441/review?page=8](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=8) |
| **FARSH** | 8 | 2:54 | بَارِئِكُمْ | `v-L008-باريكم-2-w3-a54-t20` | بَارِئِكُمْ | [/mushaf-1441/review?page=8](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=8) |
| **FARSH** | 9 | 2:59 | قِيلَ | `v-L009-قيل-1-w2-a59-t7` | قِيلَ | [/mushaf-1441/review?page=9](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=9) |
| **FARSH** | 10 | 2:67 | يَأْمُرُكُمْ | `v-L010-يامركم-1-w3-a67-t7` | يَأْمُرُكُمْ | [/mushaf-1441/review?page=10](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=10) |
| **YAAT_IDAFA** | 6 | 2:30 | إِنِّىٓ أَعْلَمُ | `v-SUSI-002-30-24-0027-performance-a30-t24` | إِنِّىٓ أَعْلَمُ | [/mushaf-1441/review?page=6](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=6) |
| **YAAT_IDAFA** | 6 | 2:33 | إِنِّىٓ أَعْلَمُ | `v-SUSI-002-33-12-0030-performance-a33-t12` | إِنِّىٓ أَعْلَمُ | [/mushaf-1441/review?page=6](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=6) |
| **YAAT_IDAFA** | 41 | 2:249 | مِنِّىٓ إِلَّا | `v-DURI-002-249-19-r0162-performance-a249-t19` | مِنِّىٓ إِلَّا | [/mushaf-1441/review?page=41](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=41) |
| **YAAT_IDAFA** | 52 | 3:20 | وَجْهِىَ لِلَّهِ | `v-DURI-003-20-5-r0218-performance-a20-t5` | وَجْهِىَ لِلَّهِ | [/mushaf-1441/review?page=52](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=52) |
| **YAAT_IDAFA** | 112 | 5:28 | إِنِّىٓ أَخَافُ | `v-SUSI-005-28-12-0555-performance-a28-t12` | إِنِّىٓ أَخَافُ | [/mushaf-1441/review?page=112](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=112) |
| **YAAT_IDAFA** | 168 | 7:144 | إِنِّى ٱصْطَفَيْتُكَ | `v-DURI-007-144-3-r0722-performance-a144-t3` | إِنِّى ٱصْطَفَيْتُكَ | [/mushaf-1441/review?page=168](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=168) |
| **SILAT_HA** | 261 | 14:44 | يَأْتِيهِمُ ٱلْعَذَابُ | `v-D261-ياتيهم_العذاب-performance1-a44-t4` | يَأْتِيهِمُ ٱلْعَذَابُ | [/mushaf-1441/review?page=261](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=261) |
| **SILAT_HA** | 269 | 16:26 | عَلَيْهِمُ | `v-D269-عليهم-performance1-a26-t12` | عَلَيْهِمُ | [/mushaf-1441/review?page=269](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=269) |
| **SILAT_HA** | 279 | 16:104 | لَا يَهْدِيهِمُ ٱللَّهُ | `v-D279-لا_يهديهم_الله-performance1-a104-t7` | لَا يَهْدِيهِمُ ٱللَّهُ | [/mushaf-1441/review?page=279](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=279) |
| **SILAT_HA** | 293 | 17:107 | عَلَيْهِمْ | `v-D293-عليهم-performance1-a107-t15` | عَلَيْهِمْ | [/mushaf-1441/review?page=293](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=293) |
| **SILAT_HA** | 294 | 18:15 | عَلَيْهِم | `v-D294-عليهم-performance1-a15-t9` | عَلَيْهِم | [/mushaf-1441/review?page=294](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=294) |
| **SILAT_HA** | 357 | 24:58 | عَلَيْهِمْ | `v-D357-عليهم-performance2-a58-t34` | عَلَيْهِمْ | [/mushaf-1441/review?page=357](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=357) |
| **TAGHYIR_HAMZ** | 499 | 45:9 | هُزُوًا ۚ | `v-AUDIT-P499-DOCX-P499-R03033-7-83beaf94-a9-t7` | هُزُوًا | [/mushaf-1441/review?page=499](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=499) |
| **TAGHYIR_HAMZ** | 502 | 45:33 | يَسْتَهْزِءُونَ | `v-AUDIT-P502-DOCX-P502-R03066-11-0e95b58f-a33-t11` | يَسْتَهْزِءُونَ | [/mushaf-1441/review?page=502](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=502) |
| **TAGHYIR_HAMZ** | 502 | 45:35 | هُزُوًۭا | `v-AUDIT-P502-DOCX-P502-R03060-6-83beaf94-a35-t6` | هُزُوًا | [/mushaf-1441/review?page=502](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=502) |
| **TAGHYIR_HAMZ** | 515 | 48:29 | سُوقِهِۦ | `v-D515-سوقهي-w2-a29-t39` | سُؤْقِهِ | [/mushaf-1441/review?page=515](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=515) |
| **TAGHYIR_HAMZ** | 515 | 48:29 | سُوقِهِۦ | `v-D515-سوقهي-w3-a29-t39` | سُئُوقِهِ | [/mushaf-1441/review?page=515](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=515) |
| **TAGHYIR_HAMZ** | 535 | 56:37 | عُرُبًا | `v-AUDIT-P535-R03371-071b5238-a37-t1` | عُرْبًا | [/mushaf-1441/review?page=535](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=535) |
| **WAQF_RASM** | 419 | 33:10 | ٱلظُّنُونَا۠ | `v-SUSI-033-10-16-3328-performance-a10-t16` | ٱلظُّنُونَا۠ | [/mushaf-1441/review?page=419](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=419) |
| **WAQF_RASM** | 427 | 33:66 | ٱلرَّسُولَا۠ | `v-SUSI-033-66-11-3389-performance-a66-t11` | ٱلرَّسُولَا۠ | [/mushaf-1441/review?page=427](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=427) |
| **WAQF_RASM** | 427 | 33:67 | ٱلسَّبِيلَا۠ | `v-SUSI-033-67-8-3390-performance-a67-t8` | ٱلسَّبِيلَا۠ | [/mushaf-1441/review?page=427](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=427) |
| **WAQF_RASM** | 503 | 46:9 | وَمَآ أَنَا۠ إِلَّا | `v-AUDIT-P503-R03069-9-20-a9-t20` | وَمَآ أَنَا۠ إِلَّا | [/mushaf-1441/review?page=503](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=503) |
| **WAQF_RASM** | 549 | 60:1 | وَأَنَا۠ أَعْلَمُ | `v-AUDIT-P549_R03505-a1-t36` | وَأَنَا۠ أَعْلَمُ | [/mushaf-1441/review?page=549](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=549) |
| **WAQF_RASM** | 578 | 76:4 | سَلَـٰسِلَا۟ | `v-AUDIT-P578-76-4-4-dd315601-a4-t4` | سَلَـٰسِلَا۟ | [/mushaf-1441/review?page=578](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=578) |

---

## 4. Tier 3: Scholarly Attention Required

These 259 flags involve nuanced Qiraat differences, baseline Hafs rules, or documented source disagreements. They require scholarly review using classical Matn references (حرز الأماني، الدرة المضية).

### 4.1 `D8_HAFS_KEPT` (119 flags)
**Scholarly Question:** Does this entry represent a **legitimate secondary wajh for Hafs** (which must be retained with `wajh_order >= 2` and a scholarly `wajh_note`), or is it a **redundant repetition of Hafs's baseline text** (which must be removed under Rule D8)?

| Page | Surah:Ayah | Locus Text | Kind | Entry ID | Issue Description | Review Link |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 19 | 2:124 | عَهْدِى ٱلظَّـٰلِمِينَ | ruling | `r-p019-028-1` | [phase3] الحكم يذكر حفصًا صراحة | [/mushaf-1441/review?page=19](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=19) |
| 19 | 2:125 | بَيْتِىَ لِلطَّآئِفِينَ | ruling | `r-p019-029-1` | [phase3] الحكم يذكر حفصًا صراحة | [/mushaf-1441/review?page=19](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=19) |
| 52 | 3:20 | وَجْهِىَ لِلَّهِ | ruling | `r-p052-023-1` | [phase3] الحكم يذكر حفصًا صراحة | [/mushaf-1441/review?page=52](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=52) |
| 127 | 5:116 | وَأُمِّىَ إِلَـٰهَيْنِ | ruling | `r-p127-018-1` | [phase3] الحكم يذكر حفصًا صراحة | [/mushaf-1441/review?page=127](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=127) |
| 137 | 6:79 | وَجَّهْتُ وَجْهِىَ | ruling | `r-p137-024-1` | [phase3] الحكم يذكر حفصًا صراحة | [/mushaf-1441/review?page=137](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=137) |
| 138 | 6:90 | ٱقْتَدِهْ ۗ | ruling | `r-p138-023-1` | [phase3] الحكم يذكر حفصًا صراحة | [/mushaf-1441/review?page=138](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=138) |
| 160 | 7:81 | إِنَّكُمْ | ruling | `r-p160-015-1` | [phase3] الحكم يذكر حفصًا صراحة | [/mushaf-1441/review?page=160](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=160) |
| 164 | 7:105 | مَعِىَ بَنِىٓ | ruling | `r-p164-030-1` | [phase3] الحكم يذكر حفصًا صراحة | [/mushaf-1441/review?page=164](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=164) |
| 164 | 7:113 | إِنَّ لَنَا | ruling | `r-p164-024-1` | [phase3] الحكم يذكر حفصًا صراحة | [/mushaf-1441/review?page=164](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=164) |
| 167 | 7:143 | أَرِنِىٓ أَنظُرْ | ruling | `r-p167-029-1` | [phase3] الحكم يذكر حفصًا صراحة | [/mushaf-1441/review?page=167](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=167) |
| 173 | 7:176 | يَلْهَث ۚ ذَّٰلِكَ | ruling | `r-p173-017-1` | [phase3] الحكم يذكر حفصًا صراحة | [/mushaf-1441/review?page=173](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=173) |
| 195 | 9:49 | ٱئْذَن لِّى وَلَا | ruling | `r-p195-023-1` | [phase3] الحكم يذكر حفصًا صراحة | [/mushaf-1441/review?page=195](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=195) |
| 200 | 9:83 | مَعِىَ أَبَدًۭا | ruling | `r-p200-019-1` | [phase3] الحكم يذكر حفصًا صراحة | [/mushaf-1441/review?page=200](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=200) |
| 200 | 9:83 | مَعِىَ عَدُوًّا ۖ | ruling | `r-p200-020-1` | [phase3] الحكم يذكر حفصًا صراحة | [/mushaf-1441/review?page=200](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=200) |
| 217 | 10:72 | إِنْ أَجْرِىَ إِلَّا | ruling | `r-p217-026-1` | [phase3] الحكم يذكر حفصًا صراحة | [/mushaf-1441/review?page=217](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=217) |
| 225 | 11:29 | أَجْرِىَ إِلَّا | ruling | `r-p225-026-1` | [phase3] الحكم يذكر حفصًا صراحة | [/mushaf-1441/review?page=225](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=225) |
| 226 | 11:41 | مَجْر۪ىٰهَا | ruling | `r-p226-008-1` | [phase3] الحكم يذكر حفصًا صراحة | [/mushaf-1441/review?page=226](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=226) |
| 226 | 11:42 | ٱرْكَب مَّعَنَا | ruling | `r-p226-012-1` | [phase3] الحكم يذكر حفصًا صراحة | [/mushaf-1441/review?page=226](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=226) |
| 227 | 11:51 | أَجْرِىَ إِلَّا | ruling | `r-p227-021-1` | [phase3] الحكم يذكر حفصًا صراحة | [/mushaf-1441/review?page=227](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=227) |
| 232 | 11:92 | وَٱتَّخَذْتُمُوهُ | ruling | `r-p232-014-1` | [phase3] الحكم يذكر حفصًا صراحة | [/mushaf-1441/review?page=232](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=232) |
| 256 | 14:7 | عَذَابِى | ruling | `r-p256-004-1` | [phase3] الحكم يذكر حفصًا صراحة | [/mushaf-1441/review?page=256](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=256) |
| 258 | 14:22 | لِىَ عَلَيْكُم | ruling | `r-p258-YAAT_IDAFA-لي_عليكم-3` | [phase3] الحكم يذكر حفصًا صراحة | [/mushaf-1441/review?page=258](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=258) |
| 261 | 14:44 | يَأْتِيهِمُ ٱلْعَذَابُ | variant | `v-D261-ياتيهم_العذاب-performance1-a44-t4` | [phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة | [/mushaf-1441/review?page=261](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=261) |
| 269 | 16:17 | تَذَكَّرُونَ | variant | `v-AUDIT-P269-16-17-7-FARSH-a17-t7` | [phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة | [/mushaf-1441/review?page=269](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=269) |
| 269 | 16:26 | عَلَيْهِمُ | variant | `v-D269-عليهم-performance1-a26-t12` | [phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة | [/mushaf-1441/review?page=269](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=269) |
| ... | ... | ... | ... | ... | *(+ 94 more entries across pages 19–600)* | ... |

### 4.2 `DOCUMENTED_CONFLICT` (81 flags)
**Scholarly Question:** Discrepancy between source texts recorded in `docs/qiraat-reader-dedupe-audit.json`. Requires arbitration between Shatibiyya and Durra riwayat.

| Page | Surah:Ayah | Locus Text | Kind | Entry ID | Issue Description | Review Link |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 6 | 2:30 | إِنِّىٓ أَعْلَمُ | variant | `v-SUSI-002-30-24-0027-performance-a30-t24` | [phase3] تعارض موثق في تدقيق القارئ | [/mushaf-1441/review?page=6](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=6) |
| 6 | 2:33 | إِنِّىٓ أَعْلَمُ | variant | `v-SUSI-002-33-12-0030-performance-a33-t12` | [phase3] تعارض موثق في تدقيق القارئ | [/mushaf-1441/review?page=6](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=6) |
| 48 | 2:282 | فَتُذَكِّرَ | variant | `v-L048-فتذكر-1-w3-a282-t69` | [phase3] تعارض موثق في تدقيق القارئ | [/mushaf-1441/review?page=48](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=48) |
| 112 | 5:28 | إِنِّىٓ أَخَافُ | variant | `v-SUSI-005-28-12-0555-performance-a28-t12` | [phase3] تعارض موثق في تدقيق القارئ | [/mushaf-1441/review?page=112](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=112) |
| 210 | 10:15 | لِىٓ | ruling | `v-SUSI-010-15-20-1343-performance-a15-t20` | [phase3] تعارض موثق في تدقيق القارئ | [/mushaf-1441/review?page=210](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=210) |
| 210 | 10:15 | نَفْسِىٓ ۖ | ruling | `v-SUSI-010-15-25-1344-performance-a15-t25` | [phase3] تعارض موثق في تدقيق القارئ | [/mushaf-1441/review?page=210](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=210) |
| 210 | 10:15 | إِنِّىٓ | ruling | `v-SUSI-010-15-32-1345-performance-a15-t32` | [phase3] تعارض موثق في تدقيق القارئ | [/mushaf-1441/review?page=210](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=210) |
| 214 | 10:53 | وَرَبِّىٓ | ruling | `v-SUSI-010-53-6-1383-performance-a53-t6` | [phase3] تعارض موثق في تدقيق القارئ | [/mushaf-1441/review?page=214](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=214) |
| 221 | 11:3 | فَإِنِّىٓ | ruling | `v-SUSI-011-3-20-1441-performance-a3-t20` | [phase3] تعارض موثق في تدقيق القارئ | [/mushaf-1441/review?page=221](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=221) |
| 222 | 11:10 | عَنِّىٓ ۚ | ruling | `v-SUSI-011-10-10-1447-performance-a10-t10` | [phase3] تعارض موثق في تدقيق القارئ | [/mushaf-1441/review?page=222](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=222) |
| 224 | 11:26 | إِنِّىٓ | ruling | `v-SUSI-011-26-6-1457-performance-a26-t6` | [phase3] تعارض موثق في تدقيق القارئ | [/mushaf-1441/review?page=224](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=224) |
| 225 | 11:29 | وَلَـٰكِنِّىٓ | ruling | `v-SUSI-011-29-19-1463-performance-a29-t19` | [phase3] تعارض موثق في تدقيق القارئ | [/mushaf-1441/review?page=225](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=225) |
| 225 | 11:34 | نُصْحِىٓ إِنْ | variant | `v-SUSI-011-34-3-1475-performance-a34-t3` | [phase3] تعارض موثق في تدقيق القارئ | [/mushaf-1441/review?page=225](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=225) |
| 227 | 11:46 | إِنِّىٓ | ruling | `v-SUSI-011-46-18-1490-performance-a46-t18` | [phase3] تعارض موثق في تدقيق القارئ | [/mushaf-1441/review?page=227](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=227) |
| 227 | 11:47 | إِنِّىٓ | ruling | `v-SUSI-011-47-3-1492-performance-a47-t3` | [phase3] تعارض موثق في تدقيق القارئ | [/mushaf-1441/review?page=227](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=227) |
| 230 | 11:78 | ضَيْفِىٓ ۖ | ruling | `v-SUSI-011-78-22-1524-performance-a78-t22` | [phase3] تعارض موثق في تدقيق القارئ | [/mushaf-1441/review?page=230](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=230) |
| 231 | 11:84 | إِنِّىٓ | ruling | `v-SUSI-011-84-18-1530-performance-a84-t18` | [phase3] تعارض موثق في تدقيق القارئ | [/mushaf-1441/review?page=231](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=231) |
| 231 | 11:84 | وَإِنِّىٓ | ruling | `v-SUSI-011-84-21-1532-performance-a84-t21` | [phase3] تعارض موثق في تدقيق القارئ | [/mushaf-1441/review?page=231](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=231) |
| 231 | 11:88 | تَوْفِيقِىٓ إِلَّا | variant | `v-SUSI-011-88-29-1538-performance-a88-t29` | [phase3] تعارض موثق في تدقيق القارئ | [/mushaf-1441/review?page=231](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=231) |
| 232 | 11:89 | شِقَاقِىٓ | ruling | `v-SUSI-011-89-4-1539-performance-a89-t4` | [phase3] تعارض موثق في تدقيق القارئ | [/mushaf-1441/review?page=232](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=232) |
| ... | ... | ... | ... | ... | *(+ 61 more entries across pages 6–579)* | ... |

### 4.3 `ATTRIBUTION_MISMATCH` (54 flags)
**Scholarly Question:** The narrators listed in `qiraat_entry_readings` do not match the verbatim authority description in `qiraat_entry_authorities`.

| Page | Surah:Ayah | Locus Text | Kind | Entry ID | Issue Description | Review Link |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 52 | 3:20 | وَجْهِىَ لِلَّهِ | ruling | `r-p052-023-1` | [phase3] نسبة الرواة لا تطابق قائمة القراءات | [/mushaf-1441/review?page=52](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=52) |
| 137 | 6:79 | وَجَّهْتُ وَجْهِىَ | ruling | `r-p137-024-1` | [phase3] نسبة الرواة لا تطابق قائمة القراءات | [/mushaf-1441/review?page=137](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=137) |
| 164 | 7:105 | مَعِىَ بَنِىٓ | ruling | `r-p164-030-1` | [phase3] نسبة الرواة لا تطابق قائمة القراءات | [/mushaf-1441/review?page=164](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=164) |
| 200 | 9:83 | مَعِىَ عَدُوًّا ۖ | ruling | `r-p200-020-1` | [phase3] نسبة الرواة لا تطابق قائمة القراءات | [/mushaf-1441/review?page=200](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=200) |
| 249 | 13:2 | ٱسْتَوَىٰ | ruling | `r-p249-IMALAH_TAQLIL-استوا-2` | [phase3] نسبة الرواة لا تطابق قائمة القراءات | [/mushaf-1441/review?page=249](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=249) |
| 249 | 13:2 | مُّسَمًّۭى ۚ | ruling | `r-p249-IMALAH_TAQLIL-مسمي-3` | [phase3] نسبة الرواة لا تطابق قائمة القراءات | [/mushaf-1441/review?page=249](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=249) |
| 251 | 13:18 | ٱلْحُسْنَىٰ ۚ | ruling | `r-p251-IMALAH_TAQLIL-الحسنا-3` | [phase3] نسبة الرواة لا تطابق قائمة القراءات | [/mushaf-1441/review?page=251](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=251) |
| 252 | 13:19 | أَعْمَىٰٓ ۚ | ruling | `r-p252-IMALAH_TAQLIL-اعما-11` | [phase3] نسبة الرواة لا تطابق قائمة القراءات | [/mushaf-1441/review?page=252](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=252) |
| 265 | 15:61 | جَآءَ | ruling | `r-p265-003-1` | [phase3] نسبة الرواة لا تطابق قائمة القراءات | [/mushaf-1441/review?page=265](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=265) |
| 313 | 20:36 | سُؤْلَكَ | ruling | `r-p313-037-1` | [phase3] نسبة الرواة لا تطابق قائمة القراءات | [/mushaf-1441/review?page=313](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=313) |
| 321 | 20:126 | تُنسَىٰ | ruling | `r-p321-001-1` | [phase3] نسبة الرواة لا تطابق قائمة القراءات | [/mushaf-1441/review?page=321](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=321) |
| 321 | 20:127 | وَأَبْقَىٰٓ | ruling | `r-p321-009-1` | [phase3] نسبة الرواة لا تطابق قائمة القراءات | [/mushaf-1441/review?page=321](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=321) |
| 321 | 20:127 | وَأَبْقَىٰٓ | ruling | `r-p321-022-1` | [phase3] نسبة الرواة لا تطابق قائمة القراءات | [/mushaf-1441/review?page=321](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=321) |
| 321 | 20:128 | ٱلنُّهَىٰ | ruling | `r-p321-013-1` | [phase3] نسبة الرواة لا تطابق قائمة القراءات | [/mushaf-1441/review?page=321](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=321) |
| 321 | 20:129 | مُّسَمًّۭى | ruling | `r-p321-014-1` | [phase3] نسبة الرواة لا تطابق قائمة القراءات | [/mushaf-1441/review?page=321](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=321) |
| 321 | 20:130 | تَرْضَىٰ | ruling | `r-p321-019-1` | [phase3] نسبة الرواة لا تطابق قائمة القراءات | [/mushaf-1441/review?page=321](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=321) |
| 321 | 20:131 | ٱلدُّنْيَا | ruling | `r-p321-020-1` | [phase3] نسبة الرواة لا تطابق قائمة القراءات | [/mushaf-1441/review?page=321](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=321) |
| 321 | 20:132 | لِلتَّقْوَىٰ | ruling | `r-p321-025-1` | [phase3] نسبة الرواة لا تطابق قائمة القراءات | [/mushaf-1441/review?page=321](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=321) |
| 321 | 20:133 | ٱلْأُولَىٰ | ruling | `r-p321-031-1` | [phase3] نسبة الرواة لا تطابق قائمة القراءات | [/mushaf-1441/review?page=321](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=321) |
| 321 | 20:134 | وَنَخْزَىٰ | ruling | `r-p321-033-1` | [phase3] نسبة الرواة لا تطابق قائمة القراءات | [/mushaf-1441/review?page=321](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=321) |
| ... | ... | ... | ... | ... | *(+ 34 more entries across pages 52–604)* | ... |

### 4.4 `NEEDS_MANUAL_REVIEW` (5 flags — HIGHEST PRIORITY)
**Scholarly Question:** Specific textual or attribution defects documented during initial data extraction across Surah Al-Baqarah. All 5 records are listed below in full:

| Page | Surah:Ayah | Locus Text | Kind | Entry ID | Issue Description | Review Link |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **9** | **2:61** | **سَأَلْتُمْ ۗ** | ruling | `r-p009-016-1` | [phase3] السجل يحتاج مراجعة يدوية | [/mushaf-1441/review?page=9](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=9) |
| **12** | **2:83** | **تَعْبُدُونَ** | variant | `v-L012-تعبدون-1-w2-a83-t7` | [phase3] السجل يحتاج مراجعة يدوية | [/mushaf-1441/review?page=12](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=12) |
| **14** | **2:93** | **قُلُوبِهِمُ ٱلْعِجْلَ** | variant | `v-L014-قلوبهم_العجل-1-w2-a93-t17` | [phase3] السجل يحتاج مراجعة يدوية | [/mushaf-1441/review?page=14](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=14) |
| **14** | **2:93** | **قُلُوبِهِمُ ٱلْعِجْلَ** | variant | `v-L014-قلوبهم_العجل-1-w3-a93-t17` | [phase3] السجل يحتاج مراجعة يدوية | [/mushaf-1441/review?page=14](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=14) |
| **16** | **2:105** | **يُنَزَّلَ** | variant | `v-L016-ينزل-1-w2-a105-t11` | [phase3] السجل يحتاج مراجعة يدوية | [/mushaf-1441/review?page=16](https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=16) |

---

## 5. Review Execution Guide via `/mushaf-1441/review`

To review and resolve any flagged entry in the UI:
1. Log in with an authenticated editor account (registered in `qiraat_editors`).
2. Open the page directly: `https://mutshabehat-v2.vercel.app/mushaf-1441/review?page=<PAGE>`.
3. Click on the flagged entry card marked with `flagged` status badge.
4. Review the readings, authority attribution, and base text alignment.
5. Update narrators, change status to `reviewed`, or add editorial notes using the RPC action buttons.
6. All transitions automatically update `qiraat_entries.review_status`, log full before/after diffs in `edit_log`, and clear the corresponding `qiraat_qa_flags` upon resolution.
