# Phase 3 migration report

- Fixture SHA-256: `641a74791a3d8560c548a0f2c79d64985dd46e9d977a280803b7b62276b60ed1`
- SQL SHA-256: `9686f5b991d1a2f910f53b02f75bd1342f48d5ab2a69998527598369c36b098c`
- SQL size: 11507965 bytes
- Loci merged: 1013

## Table counts

- `qiraat_entries`: INSERT=2506, UPDATE=12788
- `qiraat_entry_authorities`: INSERT=32313, UPDATE=22687
- `qiraat_evidence_links`: DELETE=3, INSERT=31, UPDATE=58
- `qiraat_evidence_texts`: INSERT=19, UPDATE=11
- `qiraat_loci`: INSERT=1824, UPDATE=12752
- `qiraat_ruling_details`: INSERT=1770, UPDATE=2
- `qiraat_variant_details`: DELETE=29, INSERT=765, UPDATE=53

## Drops

7 drops

```json
[
  {
    "entry_id": "v-D300-قبلا-w1-a55-t19",
    "narrators": [
      "Q05-R01",
      "Q05-R02",
      "Q06-R01",
      "Q06-R02",
      "Q07-R01",
      "Q07-R02",
      "Q08-R01",
      "Q08-R02"
    ],
    "page": 300,
    "reason": "D8_BASELINE_PARTITION",
    "span": [
      18,
      55,
      19,
      55,
      19
    ],
    "text": "قُبُلًۭا"
  },
  {
    "entry_id": "v-D307-قول_الحق-w1-a34-t5",
    "narrators": [
      "Q04-R01",
      "Q04-R02",
      "Q05-R01",
      "Q05-R02",
      "Q09-R01",
      "Q09-R02"
    ],
    "page": 307,
    "reason": "D8_BASELINE_PARTITION",
    "span": [
      19,
      34,
      5,
      34,
      6
    ],
    "text": "قَوْلَ ٱلْحَقِّ"
  },
  {
    "entry_id": "v-D308-مخلصا-w1-a51-t7",
    "narrators": [
      "Q05-R01",
      "Q05-R02",
      "Q06-R01",
      "Q06-R02",
      "Q07-R01",
      "Q07-R02",
      "Q10-R01",
      "Q10-R02"
    ],
    "page": 308,
    "reason": "D8_BASELINE_PARTITION",
    "span": [
      19,
      51,
      7,
      51,
      7
    ],
    "text": "مُخْلَصًۭا"
  },
  {
    "entry_id": "v-D310-اءذا-w1-a66-t3",
    "narrators": [
      "Q01-R01",
      "Q01-R02",
      "Q02-R01",
      "Q02-R02",
      "Q03-R01",
      "Q03-R02",
      "Q04-R01",
      "Q05-R01",
      "Q05-R02",
      "Q06-R01",
      "Q06-R02",
      "Q07-R01",
      "Q07-R02",
      "Q08-R01",
      "Q08-R02",
      "Q09-R01",
      "Q09-R02",
      "Q10-R01",
      "Q10-R02"
    ],
    "page": 310,
    "reason": "D8_BASELINE_PARTITION",
    "span": [
      19,
      66,
      3,
      66,
      3
    ],
    "text": "أَءِذَا"
  },
  {
    "entry_id": "v-AUDIT-P503-R03071-12-12-a12-t12-h0386e07851f8d41c",
    "narrators": [
      "Q02-R01",
      "Q02-R02",
      "Q03-R01",
      "Q03-R02",
      "Q05-R01",
      "Q05-R02",
      "Q06-R01",
      "Q06-R02",
      "Q07-R01",
      "Q07-R02",
      "Q10-R01",
      "Q10-R02"
    ],
    "page": 503,
    "reason": "D8_BASELINE_PARTITION",
    "span": [
      46,
      12,
      12,
      12,
      12
    ],
    "text": "لِيُنْذِرَ"
  },
  {
    "entry_id": "v-DOCX-P525-5-R03284-45-7-2-a45-t7",
    "narrators": [
      "Q04-R01",
      "Q04-R02",
      "Q05-R01",
      "Q05-R02"
    ],
    "page": 525,
    "reason": "D8_BASELINE_PARTITION",
    "span": [
      52,
      45,
      7,
      45,
      7
    ],
    "text": "يَصْعَقُونَ"
  },
  {
    "entry_id": "v-D582-78-25-3--R03823-3-a25-t3",
    "narrators": [
      "Q05-R02",
      "Q06-R02",
      "Q07-R01",
      "Q07-R02"
    ],
    "page": 582,
    "reason": "D8_BASELINE_PARTITION",
    "span": [
      78,
      25,
      3,
      25,
      3
    ],
    "text": "وَغَسَّاقًا"
  }
]
```

## Flags

### ATTRIBUTION_MISMATCH (54)

```json
[
  {
    "entry_id": "r-p052-023-1",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "r-p052-023-1",
    "original_text": "وإسكانها وصلاً للباقين.",
    "page_id": 303,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p137-024-1",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "r-p137-024-1",
    "original_text": "الفتح وصلاً لنافع وابن عامر وحفص وأبي جعفر، والإسكان للباقين",
    "page_id": 388,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p164-030-1",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "r-p164-030-1",
    "original_text": "الفتح وصلاً لحفص، والإسكان للباقين",
    "page_id": 415,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p200-020-1",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "r-p200-020-1",
    "original_text": "الفتح وصلاً لحفص، والإسكان وصلاً للباقين",
    "page_id": 635,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p249-IMALAH_TAQLIL-استوا-2",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "r-p249-IMALAH_TAQLIL-استوا-2",
    "original_text": "",
    "page_id": 3183,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p249-IMALAH_TAQLIL-مسمي-3",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "r-p249-IMALAH_TAQLIL-مسمي-3",
    "original_text": "",
    "page_id": 3183,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p251-IMALAH_TAQLIL-الحسنا-3",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "r-p251-IMALAH_TAQLIL-الحسنا-3",
    "original_text": "",
    "page_id": 2845,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p252-IMALAH_TAQLIL-اعما-11",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "r-p252-IMALAH_TAQLIL-اعما-11",
    "original_text": "",
    "page_id": 2846,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p265-003-1",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "r-p265-003-1",
    "original_text": "",
    "page_id": 2859,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p313-037-1",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "r-p313-037-1",
    "original_text": "",
    "page_id": 2907,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p321-001-1",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "r-p321-001-1",
    "original_text": "",
    "page_id": 2915,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p321-009-1",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "r-p321-009-1",
    "original_text": "",
    "page_id": 2915,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p321-022-1",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "r-p321-009-1",
    "original_text": "",
    "page_id": 2915,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p321-013-1",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "r-p321-013-1",
    "original_text": "",
    "page_id": 2915,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p321-014-1",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "r-p321-014-1",
    "original_text": "",
    "page_id": 2915,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p321-019-1",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "D321-ترضا-a130-t20",
    "original_text": "",
    "page_id": 2915,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p321-020-1",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "r-p321-020-1",
    "original_text": "",
    "page_id": 2915,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p321-025-1",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "r-p321-025-1",
    "original_text": "",
    "page_id": 2915,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p321-031-1",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "r-p321-029-1",
    "original_text": "",
    "page_id": 2915,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p321-033-1",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "r-p321-033-1",
    "original_text": "",
    "page_id": 2915,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p321-036-1",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "r-p321-036-1",
    "original_text": "",
    "page_id": 2915,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p323-018-1",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "r-p323-018-1",
    "original_text": "الفتح وصلاً لحفص، والإسكان للباقين.",
    "page_id": 2917,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p335-008-1",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "r-p335-008-1",
    "original_text": "فتح ياء الإضافة وصلاً لنافع وهشام وحفص، وإسكانها للباقين.",
    "page_id": 2929,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p337-009-1",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "r-p337-009-1",
    "original_text": "إثبات الياء وصلاً لأبي عمرو وورش بخلفه، وفي الحالين ليعقوب، وحذفها للباقين.",
    "page_id": 2931,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p337-013-1",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "r-p337-013-1",
    "original_text": "",
    "page_id": 2931,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p337-016-2",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "r-p337-016-2",
    "original_text": "",
    "page_id": 2931,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p338-004-1",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "r-p338-004-1",
    "original_text": "",
    "page_id": 2932,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p338-005-1",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "r-p338-005-1",
    "original_text": "",
    "page_id": 2932,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p340-014-1",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "r-p340-014-1",
    "original_text": "",
    "page_id": 2934,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p341-010-1",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "r-p341-010-1",
    "original_text": "",
    "page_id": 2935,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p341-IMALAH_TAQLIL-سماكم-2",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "r-p341-IMALAH_TAQLIL-سماكم-2",
    "original_text": "",
    "page_id": 2935,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p341-014-1",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "r-p341-014-1",
    "original_text": "",
    "page_id": 2935,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p341-015-1",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "r-p341-015-1",
    "original_text": "",
    "page_id": 2935,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p342-005-1",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "r-p342-005-1",
    "original_text": "",
    "page_id": 2936,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p342-011-1",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "r-p342-011-1",
    "original_text": "",
    "page_id": 2936,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p342-IMALAH_TAQLIL-قرار-3",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "r-p342-IMALAH_TAQLIL-قرار-3",
    "original_text": "",
    "page_id": 2936,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p343-003-1",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "r-p343-003-1",
    "original_text": "",
    "page_id": 2937,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p343-010-1",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "r-p343-010-1",
    "original_text": "",
    "page_id": 2937,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p343-017-1",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "r-p343-017-1",
    "original_text": "",
    "page_id": 2937,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p344-002-1",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "r-p344-002-1",
    "original_text": "",
    "page_id": 2938,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p389-YAAT_IDAFA-mai-rid",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "loc-028-034-008-034-009",
    "original_text": "",
    "page_id": 2983,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-SRC585-IMALAH_TAQLIL-1-2",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "loc-080-001-002-001-002",
    "original_text": "رؤوس آي سورة عبس حسب المصدر",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-SRC585-TAGHYIR_HAMZ-34-3",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "loc-080-034-003-034-003",
    "original_text": "نقل الهمزة لورش",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-SRC585-SAKT-34-3",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "loc-080-034-003-034-003",
    "original_text": "السكت لحمزة وإدريس كما في المصدر",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-SRC586-IMALAH_TAQLIL-23-2",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "loc-081-023-002-023-002",
    "original_text": "إمالة رآه وتقليل ورش وإمالة الدوري للراء",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-SRC586-TAGHYIR_HAMZ-23-2",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "loc-081-023-002-023-002",
    "original_text": "النقل لورش في الأفق",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-SRC588-IMALAH_TAQLIL-14-3",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "loc-083-014-003-014-003",
    "original_text": "إمالة ألف ران",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-SRC588-TAGHYIR_HAMZ-23-2",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "loc-083-023-002-023-002",
    "original_text": "نقل ورش",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-SRC588-SAKT-23-2",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "loc-083-023-002-023-002",
    "original_text": "السكت لحمزة وإدريس",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-SQL601-TAGHYIR_HAMZ-5-3",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "loc-105-005-003-005-003",
    "original_text": "إبدال الهمزة الساكنة لورش والسوسي وأبي جعفر",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-SQL603-IMALAH_TAQLIL-1-3",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "loc-109-001-003-001-003",
    "original_text": "إمالة حمزة والكسائي وخلف وهشام وتقليل الدوري وورش",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-SQL603-IMALAH_TAQLIL-1-2",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "loc-110-001-002-001-002",
    "original_text": "إمالة ابن ذكوان وحمزة وخلف العاشر",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-SQL604-TAGHYIR_HAMZ-1-1",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "loc-112-001-001-001-001",
    "original_text": "النقل لورش في قل أعوذ",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-SQL604-SAKT-1-1",
    "flag_type": "ATTRIBUTION_MISMATCH",
    "issue_ar": "[phase3] نسبة الرواة لا تطابق قائمة القراءات",
    "locus_id": "loc-112-001-001-001-001",
    "original_text": "السكت لحمزة وخلف العاشر",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  }
]
```

### D8_HAFS_KEPT (119)

```json
[
  {
    "entry_id": "r-p019-028-1",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] الحكم يذكر حفصًا صراحة",
    "locus_id": "r-p019-028-1",
    "original_text": "والفتح وصلًا للباقين.",
    "page_id": 270,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p019-029-1",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] الحكم يذكر حفصًا صراحة",
    "locus_id": "r-p019-029-1",
    "original_text": "والإسكان وصلًا للباقين.",
    "page_id": 270,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p052-023-1",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] الحكم يذكر حفصًا صراحة",
    "locus_id": "r-p052-023-1",
    "original_text": "وإسكانها وصلاً للباقين.",
    "page_id": 303,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p127-018-1",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] الحكم يذكر حفصًا صراحة",
    "locus_id": "r-p127-018-1",
    "original_text": "الإسكان وصلاً لابن كثير وشعبة وحمزة والكسائي ويعقوب وخلف، والفتح للباقين",
    "page_id": 378,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p137-024-1",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] الحكم يذكر حفصًا صراحة",
    "locus_id": "r-p137-024-1",
    "original_text": "الفتح وصلاً لنافع وابن عامر وحفص وأبي جعفر، والإسكان للباقين",
    "page_id": 388,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p138-023-1",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] الحكم يذكر حفصًا صراحة",
    "locus_id": "r-p138-023-1",
    "original_text": "بإثبات الهاء وقفًا لجميع القراء",
    "page_id": 389,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p160-015-1",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] الحكم يذكر حفصًا صراحة",
    "locus_id": "r-p160-015-1",
    "original_text": "تسهيل الهمزة الثانية لابن كثير ورويس؛ وتسهيلها مع الإدخال لأبي عمرو؛ وتحقيقها مع الإدخال لهشام؛ وقرأها بهمزة واحدة على الإخبار نافع وحفص وأبو جعفر؛ وبتحقيق الهمزتين بدون إدخال الباقون.",
    "page_id": 411,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p164-030-1",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] الحكم يذكر حفصًا صراحة",
    "locus_id": "r-p164-030-1",
    "original_text": "الفتح وصلاً لحفص، والإسكان للباقين",
    "page_id": 415,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p164-024-1",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] الحكم يذكر حفصًا صراحة",
    "locus_id": "L164-ان_لنا-1-a113-t5",
    "original_text": "التسهيل بدون إدخال لرويس؛ والتسهيل مع الإدخال لأبي عمرو؛ والتحقيق مع الإدخال لهشام؛ وقرأها بهمزة واحدة نافع وابن كثير وحفص وأبو جعفر؛ والتحقيق للهمزتين للباقين.",
    "page_id": 415,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p167-029-1",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] الحكم يذكر حفصًا صراحة",
    "locus_id": "r-p167-029-1",
    "original_text": "اتفق القراء على إسكان ياء الإضافة",
    "page_id": 418,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p173-017-1",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] الحكم يذكر حفصًا صراحة",
    "locus_id": "r-p173-017-1",
    "original_text": "بالإدغام لجميع القراء عدا قالون (بخلف عنه)، ورش، ابن كثير، هشام، أبو جعفر",
    "page_id": 424,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p195-023-1",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] الحكم يذكر حفصًا صراحة",
    "locus_id": "r-p195-023-1",
    "original_text": "اتفق القراء على إسكان ياء الإضافة",
    "page_id": 630,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p200-019-1",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] الحكم يذكر حفصًا صراحة",
    "locus_id": "r-p200-019-1",
    "original_text": "الفتح وصلاً لنافع وابن كثير وأبي عمرو وابن عامر وحفص وأبي جعفر، والإسكان وصلاً للباقين",
    "page_id": 635,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p200-020-1",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] الحكم يذكر حفصًا صراحة",
    "locus_id": "r-p200-020-1",
    "original_text": "الفتح وصلاً لحفص، والإسكان وصلاً للباقين",
    "page_id": 635,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p217-026-1",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] الحكم يذكر حفصًا صراحة",
    "locus_id": "r-p217-026-1",
    "original_text": "والإسكان وصلًا للباقين.",
    "page_id": 856,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p225-026-1",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] الحكم يذكر حفصًا صراحة",
    "locus_id": "r-p225-026-1",
    "original_text": "الفتح وصلاً لنافع وأبي عمرو وابن عامر وحفص وأبي جعفر، والإسكان للباقين.",
    "page_id": 1088,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p226-008-1",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] الحكم يذكر حفصًا صراحة",
    "locus_id": "L226-مجريها-1-a41-t6",
    "original_text": "",
    "page_id": 1089,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p226-012-1",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] الحكم يذكر حفصًا صراحة",
    "locus_id": "r-p226-012-1",
    "original_text": "",
    "page_id": 1089,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p227-021-1",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] الحكم يذكر حفصًا صراحة",
    "locus_id": "r-p227-021-1",
    "original_text": "الفتح وصلاً لنافع وأبي عمرو وابن عامر وحفص وأبي جعفر، والإسكان للباقين.",
    "page_id": 1090,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p232-014-1",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] الحكم يذكر حفصًا صراحة",
    "locus_id": "r-p232-002-1",
    "original_text": "الإدغام لجميع القراء عدا ابن كثير وحفص ورويس.",
    "page_id": 1095,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p256-004-1",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] الحكم يذكر حفصًا صراحة",
    "locus_id": "r-p256-004-1",
    "original_text": "",
    "page_id": 2850,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p258-YAAT_IDAFA-لي_عليكم-3",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] الحكم يذكر حفصًا صراحة",
    "locus_id": "r-p258-YAAT_IDAFA-لي_عليكم-3",
    "original_text": "",
    "page_id": 2852,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D261-ياتيهم_العذاب-performance1-a44-t4",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "D261-ياتيهم_العذاب-a44-t4",
    "original_text": "يَأْتِيهِمُ ٱلْعَذَابُ",
    "page_id": 2855,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P269-16-17-7-FARSH-a17-t7",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "loc-016-017-007-017-007",
    "original_text": "تَذْكُرُونَ",
    "page_id": 2863,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D269-عليهم-performance1-a26-t12",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "loc-016-026-012-026-012",
    "original_text": "عَلَيْهِمُ",
    "page_id": 2863,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P272-16-43-7-FARSH-a43-t7",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "AUDIT-P272-16-43-7-9653e7fd-a43-t7",
    "original_text": "يُوحَى إِلَيْهِم",
    "page_id": 2866,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D279-لا_يهديهم_الله-performance1-a104-t7",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "D279-لا_يهديهم_الله-a104-t7",
    "original_text": "لَا يَهْدِيهِمُ ٱللَّهُ",
    "page_id": 2873,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D280-فمن_اضطر-performance1-a115-t13",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "D280-فمن_اضطر-a115-t13",
    "original_text": "فَمَنِ ٱضْطُرَّ",
    "page_id": 2874,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P282-LISUU-3-a7-t12",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "loc-017-007-012-007-012",
    "original_text": "لِيَسُوءَ",
    "page_id": 2876,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P285-17-31-12-FARSH-a31-t12",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "D285-خطا-a31-t12",
    "original_text": "خِطْئًا",
    "page_id": 2879,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P285-17-38-4-FARSH2-a38-t4",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "loc-017-038-004-038-004",
    "original_text": "سَيِّئُهُ",
    "page_id": 2879,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p293-SAKT-awaja-0",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] الحكم يذكر حفصًا صراحة",
    "locus_id": "loc-018-001-011-001-011",
    "original_text": "",
    "page_id": 2887,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D295-tazawaru-w2-a17-t5",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "loc-018-017-005-017-005",
    "original_text": "تَزَاوَرُ",
    "page_id": 2889,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D295-وتحسبهم-performance2-a18-t1",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "D295-وتحسبهم-a18-t1",
    "original_text": "وَتَحْسَبُهُمْ",
    "page_id": 2889,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p301-YAAT_IDAFA-معي_صبرا-1",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] الحكم يذكر حفصًا صراحة",
    "locus_id": "r-p301-YAAT_IDAFA-معي_صبرا-1",
    "original_text": "",
    "page_id": 2895,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p302-YAAT_IDAFA-معي_صبرا-0",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] الحكم يذكر حفصًا صراحة",
    "locus_id": "r-p302-YAAT_IDAFA-معي_صبرا-0",
    "original_text": "",
    "page_id": 2896,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D307-وان_الله-w1-a36-t1",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "D307-وان_الله-a36-t1",
    "original_text": "وَإِنَّ ٱللَّهَ",
    "page_id": 2901,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D310-مت-w1-a66-t5",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "D310-مت-a66-t5",
    "original_text": "مِتُّ",
    "page_id": 2904,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D310-يذكر-w1-a67-t2",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "D310-يذكر-a67-t2",
    "original_text": "يَذْكُرُ",
    "page_id": 2904,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D310-جثيا-w1-a68-t8",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "D310-جثيا-a68-t8",
    "original_text": "جِثِيًّۭا",
    "page_id": 2904,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D311-takaad-yatafattarna-w2-a90-t1",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "loc-019-090-001-090-003",
    "original_text": "تَكَادُ ٱلسَّمَاوَاتُ يَتَفَطَّرْنَ",
    "page_id": 2905,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p313-013-1",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] الحكم يذكر حفصًا صراحة",
    "locus_id": "r-p313-013-1",
    "original_text": "والإسكان وصلًا للباقين.",
    "page_id": 2907,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p323-018-1",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] الحكم يذكر حفصًا صراحة",
    "locus_id": "r-p323-018-1",
    "original_text": "الفتح وصلاً لحفص، والإسكان للباقين.",
    "page_id": 2917,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L329-نجي-1-w2-a88-t7",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "L329-نجي-1-a88-t7",
    "original_text": "نُنْجِي",
    "page_id": 2923,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D334-ولولوا-hamz-shuba-a22-t7",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "loc-022-022-007-022-007",
    "original_text": "وَلُؤْلُؤًۭا",
    "page_id": 2928,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p335-008-1",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] الحكم يذكر حفصًا صراحة",
    "locus_id": "r-p335-008-1",
    "original_text": "فتح ياء الإضافة وصلاً لنافع وهشام وحفص، وإسكانها للباقين.",
    "page_id": 2929,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L335-وليوفوا-1-w2-a29-t4",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "L335-وليوفوا-1-a29-t4",
    "original_text": "وَلْيُوَفُّوا۟",
    "page_id": 2929,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D343-نسقيكم-performance1-a21-t6",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "D343-نسقيكم-a21-t6",
    "original_text": "نُّسْقِيكُم",
    "page_id": 2937,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L345-تترا-1-w2-a44-t4",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "L345-تترا-1-a44-t4",
    "original_text": "تَتْرَىٰ ۖ",
    "page_id": 2939,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D347-استفهام-كلاهما-1-a82-t2",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "loc-023-082-002-082-002",
    "original_text": "أَئِذَا",
    "page_id": 2941,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D347-استفهام-كلاهما-2-a82-t7",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "loc-023-082-007-082-007",
    "original_text": "أَئِنَّا",
    "page_id": 2941,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L347-تذكرون-1-w2-a85-t5",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "L347-تذكرون-1-a85-t5",
    "original_text": "تَذْكُرُونَ",
    "page_id": 2941,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p348-011-1",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] الحكم يذكر حفصًا صراحة",
    "locus_id": "r-p348-011-1",
    "original_text": "",
    "page_id": 2942,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p370-YAAT_IDAFA-معي_ربي-5",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] الحكم يذكر حفصًا صراحة",
    "locus_id": "loc-026-062-004-062-005",
    "original_text": "",
    "page_id": 2964,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p371-YAAT_IDAFA-اجري_الا-2",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] الحكم يذكر حفصًا صراحة",
    "locus_id": "r-p371-YAAT_IDAFA-اجري_الا-2",
    "original_text": "",
    "page_id": 2965,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p373-YAAT_IDAFA-اجري_الا-2",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] الحكم يذكر حفصًا صراحة",
    "locus_id": "r-p373-YAAT_IDAFA-اجري_الا-2",
    "original_text": "",
    "page_id": 2967,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L373-s26a149b0-w2-a149-t4",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "L373-s26a149b0-a149-t4",
    "original_text": "بُيُوتًا",
    "page_id": 2967,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p374-YAAT_IDAFA-اجري_الا-1",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] الحكم يذكر حفصًا صراحة",
    "locus_id": "r-p374-YAAT_IDAFA-اجري_الا-1",
    "original_text": "",
    "page_id": 2968,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p390-HAMZATAN_KALIMA-ايمه-7",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] الحكم يذكر حفصًا صراحة",
    "locus_id": "r-p390-HAMZATAN_KALIMA-ايمه-7",
    "original_text": "",
    "page_id": 2984,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L395-s28a82b1-w2-a82-t21",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "L395-s28a82b1-a82-t21",
    "original_text": "لَخَسَفَ بِنَا",
    "page_id": 2989,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L399-s29a25b0-w2-a25-t8",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "L399-s29a25b0-a25-t8",
    "original_text": "مَوَدَّةَ بَيْنِكُمْ",
    "page_id": 2993,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L401-s29a41b0-w2-a41-t14",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "L401-s29a41b0-a41-t14",
    "original_text": "الْبُيُوتِ",
    "page_id": 2995,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D408-liyarbu-a39-t5",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "loc-030-039-005-039-005",
    "original_text": "لِيَرْبُوَ",
    "page_id": 3002,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D422-وقرن-a33-t1",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "loc-033-033-001-033-001",
    "original_text": "وَقِرْنَ",
    "page_id": 3016,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L428-s34a03-w3-a3-t11",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "L428-s34a3b0-a3-t11",
    "original_text": "عَالِمِ الْغَيْبِ",
    "page_id": 3022,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p433-YAAT_IDAFA-اجري_الا-7",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] الحكم يذكر حفصًا صراحة",
    "locus_id": "r-p433-YAAT_IDAFA-اجري_الا-7",
    "original_text": "",
    "page_id": 3027,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D443-يخصمون-performance1-a49-t8",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "loc-036-049-008-049-008",
    "original_text": "يَخِصِّمُونَ",
    "page_id": 3037,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p454-YAAT_IDAFA-ولي_نعجه-6",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] الحكم يذكر حفصًا صراحة",
    "locus_id": "r-p454-YAAT_IDAFA-ولي_نعجه-6",
    "original_text": "",
    "page_id": 3048,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D457-سخريا-performance1-a63-t2",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "loc-038-063-002-063-002",
    "original_text": "سِخْرِيًّا",
    "page_id": 3051,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p457-YAAT_IDAFA-ما_كان_لي_من_علم-6",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] الحكم يذكر حفصًا صراحة",
    "locus_id": "r-p457-YAAT_IDAFA-ما_كان_لي_من_علم-6",
    "original_text": "",
    "page_id": 3051,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D480-عليهم-performance1-a30-t9",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "loc-041-030-009-030-009",
    "original_text": "عَلَيْهِمُ",
    "page_id": 3074,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p481-HAMZATAN_KALIMA-ءاعجمي-2",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] الحكم يذكر حفصًا صراحة",
    "locus_id": "r-p481-HAMZATAN_KALIMA-ءاعجمي-2",
    "original_text": "",
    "page_id": 3075,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P489-43-5-5-DOCX-P489-R02928-a5-t5",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "AUDIT-P489-43-5-5-DOCX-P489-R02928-a5-t5",
    "original_text": "أَن كُنتُمْ",
    "page_id": 3083,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P490-43-18-2-DOCX-P490-R02938-a18-t2",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "AUDIT-P490-43-18-2-DOCX-P490-R02938-a18-t2",
    "original_text": "يُنَشَّأُ",
    "page_id": 3084,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P504-R03083-17-4-a17-t4-ha1c6531093982d70",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "v-AUDIT-P504-R03083-17-4-a17-t4",
    "original_text": "أُفَّ",
    "page_id": 3098,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P510-47-38-1-P4-a38-t1",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "AUDIT-P510-47-38-1-P4-a38-t1",
    "original_text": "هَـٰٓأَنتُمْ",
    "page_id": 3104,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P512-48-10-23-1826358b-a10-t23",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "AUDIT-P512-48-10-23-1826358b-a10-t23",
    "original_text": "فَسَيُؤْتِيهِ",
    "page_id": 3106,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P513-48-17-17-64f53bf0-a17-t17",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "AUDIT-P513-48-17-17-64f53bf0-a17-t17",
    "original_text": "يُدْخِلْهُ",
    "page_id": 3107,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P513-48-17-25-78ced917-a17-t25",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "AUDIT-P513-48-17-25-78ced917-a17-t25",
    "original_text": "يُعَذِّبْهُ",
    "page_id": 3107,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L519-s50a33b7-w1-R03223-a33-t7",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "L519-s50a33b7-a33-t7",
    "original_text": "مُّنِيبٍ ٱدْخُلُوهَا",
    "page_id": 3113,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L521-s51a15b5-w1-R03238-a15-t5",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "L521-s51a15b5-a15-t5",
    "original_text": "وَعُيُونٍ",
    "page_id": 3115,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L521-s51a23b6-w1-R03239-a23-t6",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "L521-s51a23b6-a23-t6",
    "original_text": "مِثْلُ",
    "page_id": 3115,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L522-s51a41b5-w1-R03248-a41-t5",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "L522-s51a41b5-a41-t5",
    "original_text": "عَلَيْهِمُ الرِّيحَ",
    "page_id": 3116,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DOCX-P525-5-R03281-37-7-2-a37-t7",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "DOCX-P525-5-R03281-37-7-a37-t7",
    "original_text": "ٱلْمُسَيْطِرُونَ",
    "page_id": 3119,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P528-thamud-6-a51-t1",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "AUDIT-P528-thamud-a51-t1",
    "original_text": "وَثَمُودَ",
    "page_id": 3122,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P532-55-24-3-96d76088-a24-t3",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "AUDIT-P532-55-24-3-96d76088-a24-t3",
    "original_text": "الْمُنْشِئَاتُ",
    "page_id": 3126,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L536-s56a62b1-w1-a62-t6",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "L536-s56a62b1-a62-t6",
    "original_text": "تَذْكُرُونَ",
    "page_id": 3130,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P544-58-19-2-03451-1-عليهم الشيطان-عليهم الشيطان-a19-t2",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "AUDIT-P544-58-19-2-03451-1-عليهم الشيطان-عليهم الشيطان-a19-t2",
    "original_text": "عَلَيْهِمُ الشَّيْطَـٰنُ",
    "page_id": 3138,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P545-58-22-25-03457-1-قلوبهم الايمان-قلوبهم الايمان-a22-t25",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "AUDIT-P545-58-22-25-03457-1-قلوبهم الايمان-قلوبهم الايمان-a22-t25",
    "original_text": "قُلُوبِهِمُ الْإِيمَـٰنَ",
    "page_id": 3139,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P545-59-2-31-03462-1-قلوبهم الرعب-قلوبهم الرعب-a2-t31",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "AUDIT-P545-59-2-31-03462-1-قلوبهم الرعب-قلوبهم الرعب-a2-t31",
    "original_text": "قُلُوبِهِمُ الرُّعْبَ",
    "page_id": 3139,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P546-59-7-17-03475-1-كي لا يكون دوله-كي لا يكون دوله-a7-t17",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "AUDIT-P546-59-7-17-03475-1-كي لا يكون دوله-كي لا يكون دوله-a7-t17",
    "original_text": "كَيْ لَا يَكُونَ دُولَةً",
    "page_id": 3140,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P547-59-10-22-R03486-a10-t22",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "loc-059-010-022-010-022",
    "original_text": "رَءُوفٌۭ",
    "page_id": 3141,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p555-HAMZATAN_KALIMATAYN-جاء_اجلها-4",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] الحكم يذكر حفصًا صراحة",
    "locus_id": "r-p555-HAMZATAN_KALIMATAYN-جاء_اجلها-4",
    "original_text": "",
    "page_id": 3149,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p564-YAAT_IDAFA-معي_او-3",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] الحكم يذكر حفصًا صراحة",
    "locus_id": "r-p564-YAAT_IDAFA-معي_او-3",
    "original_text": "",
    "page_id": 3158,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DOCX-564-R03649-single-a14-t1",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "DOCX-P564-R03649-14-1-a14-t1",
    "original_text": "أَن كَانَ",
    "page_id": 3158,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DOCX-565-R03654-522b56dc-a32-t3",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "DOCX-P565-R03654-32-3-a32-t3",
    "original_text": "أَن يُبْدِلَنَا",
    "page_id": 3159,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D568-تذكرون-w3-a42-t6",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "D568-تذكرون-a42-t6",
    "original_text": "تَذَّكَّرُونَ",
    "page_id": 3162,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p571-YAAT_IDAFA-بيتي_مومنا-3",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] الحكم يذكر حفصًا صراحة",
    "locus_id": "r-p571-YAAT_IDAFA-بيتي_مومنا-3",
    "original_text": "",
    "page_id": 3165,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P578-75-27-2-18dd38ca-a27-t2",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "AUDIT-P578-75-27-2-18dd38ca-a27-t2",
    "original_text": "مَنْ ۜ رَاقٍۢ",
    "page_id": 3172,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P578-76-4-4-dd315601-a4-t4",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "AUDIT-P578-76-4-4-90623940-a4-t4",
    "original_text": "سَلَـٰسِلَا۟",
    "page_id": 3172,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D579-76-14-2--R03780-3-a14-t2",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "D579-76-14-al-yahim-2-a14-t2",
    "original_text": "عَلَيْهِمْ",
    "page_id": 3173,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D579-76-15-2--R03780-3-a15-t2",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "D579-76-15-al-yahim-2-a15-t2",
    "original_text": "عَلَيْهِمْ",
    "page_id": 3173,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D579-76-15-8--R03782-2-a15-t8",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "D579-76-15-16-qawarir-pair-a15-t8",
    "original_text": "قَوَارِيرَا",
    "page_id": 3173,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D579-76-16-1--R03786-2-a16-t1",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "D579-76-15-16-qawarir-pair-a16-t1",
    "original_text": "قَوَارِيرَ",
    "page_id": 3173,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D579-76-19-2--R03780-3-a19-t2",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "D579-76-19-al-yahim-2-a19-t2",
    "original_text": "عَلَيْهِمْ",
    "page_id": 3173,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D579-76-21-1--R03789-4-a21-t1",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "D579-76-21-alayhim-a21-t1",
    "original_text": "عَالِيَهُمْ",
    "page_id": 3173,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D579-76-21-4--R03791-2-a21-t4",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "D579-76-21-khudr-istabraq-a21-t4",
    "original_text": "خُضْرٌ وَإِسْتَبْرَقٌ ۖ",
    "page_id": 3173,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D580-77-11-3--R03803-2-a11-t3",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "D580-77-11-face-a11-t3",
    "original_text": "أُقِّتَتْ",
    "page_id": 3174,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D581-77-33-2--R03812-4-a33-t2",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "D581-77-33-face-a33-t2",
    "original_text": "جِمَالَتٌ",
    "page_id": 3175,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D581-77-41-5--R03815-2-a41-t5",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "D581-77-41-face-a41-t5",
    "original_text": "وَعُيُونٍ",
    "page_id": 3175,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D582-78-19-1--R03821-2-a19-t1",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "D582-78-19-face-a19-t1",
    "original_text": "وَفُتِحَتِ",
    "page_id": 3176,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D582-78-23-1--R03822-2-a23-t1",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "D582-78-23-face-a23-t1",
    "original_text": "لَابِثِينَ",
    "page_id": 3176,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D585-انا-w2-a25-t1",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "loc-080-025-001-025-001",
    "original_text": "أَنَّا",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D587-فعدلك-w2-a7-t4",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "loc-082-007-004-007-004",
    "original_text": "فَعَدَلَكَ",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-SRC588-SAKT-14-2",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] الحكم يذكر حفصًا صراحة",
    "locus_id": "loc-083-014-002-014-002",
    "original_text": "سكت حفص على اللام",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-SRC588-IDGHAM_KABIR-14-2",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] الحكم يذكر حفصًا صراحة",
    "locus_id": "loc-083-014-002-014-002",
    "original_text": "الإدغام المحض حسب المصدر",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SRC-P591-86-4-4-a4-t4",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "loc-086-004-004-004-004",
    "original_text": "لَّمَّا",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SRC-P592-88-11-2-a-a11-t2",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] حفص محفوظ في هذا الموضع ضمن أوجه متعددة",
    "locus_id": "loc-088-011-002-011-002",
    "original_text": "لَّا تَسْمَعُ",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-SQL600-SAKT-101-10-4-2",
    "flag_type": "D8_HAFS_KEPT",
    "issue_ar": "[phase3] الحكم يذكر حفصًا صراحة",
    "locus_id": "loc-101-010-004-010-004",
    "original_text": "",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  }
]
```

### DB_ONLY (58)

```json
[
  {
    "entry_id": "v-AUDIT-P499-DOCX-P499-R03029-1-74e7e80f-a1-t1",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-AUDIT-P499-DOCX-P499-R03029-1-74e7e80f-a1-t1",
    "locus_id": "AUDIT-P499-DOCX-P499-R03029-1-74e7e80f-a1-t1",
    "original_text": "v-AUDIT-P499-DOCX-P499-R03029-1-74e7e80f-a1-t1",
    "page_id": 3093,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P503-R03071-12-12-a12-t12-hdaa2ff2bba25c34f",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-AUDIT-P503-R03071-12-12-a12-t12-hdaa2ff2bba25c34f",
    "locus_id": "v-AUDIT-P503-R03071-12-12-a12-t12",
    "original_text": "v-AUDIT-P503-R03071-12-12-a12-t12-hdaa2ff2bba25c34f",
    "page_id": 3097,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P510-47-38-1-P5-a38-t1",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-AUDIT-P510-47-38-1-P5-a38-t1",
    "locus_id": "AUDIT-P510-47-38-1-P4-a38-t1",
    "original_text": "v-AUDIT-P510-47-38-1-P5-a38-t1",
    "page_id": 3104,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P510-47-38-1-P6-a38-t1",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-AUDIT-P510-47-38-1-P6-a38-t1",
    "locus_id": "AUDIT-P510-47-38-1-P4-a38-t1",
    "original_text": "v-AUDIT-P510-47-38-1-P6-a38-t1",
    "page_id": 3104,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P535-R03371-PERF-SAKT-Q06R01-a37-t1",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-AUDIT-P535-R03371-PERF-SAKT-Q06R01-a37-t1",
    "locus_id": "AUDIT-P535-R03371-071b5238-a37-t1",
    "original_text": "v-AUDIT-P535-R03371-PERF-SAKT-Q06R01-a37-t1",
    "page_id": 3129,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P543-58-11-5-03443-1-قيل لكم-قيل لكم-a11-t5",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-AUDIT-P543-58-11-5-03443-1-قيل لكم-قيل لكم-a11-t5",
    "locus_id": "AUDIT-P543-58-11-5-03443-1-قيل لكم-قيل لكم-a11-t5",
    "original_text": "v-AUDIT-P543-58-11-5-03443-1-قيل لكم-قيل لكم-a11-t5",
    "page_id": 3137,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P578-76-4-4-bc096c6f-a4-t4",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-AUDIT-P578-76-4-4-bc096c6f-a4-t4",
    "locus_id": "AUDIT-P578-76-4-4-90623940-a4-t4",
    "original_text": "v-AUDIT-P578-76-4-4-bc096c6f-a4-t4",
    "page_id": 3172,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D261-ياتيهم_العذاب-performance2-a44-t4",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D261-ياتيهم_العذاب-performance2-a44-t4",
    "locus_id": "D261-ياتيهم_العذاب-a44-t4",
    "original_text": "v-D261-ياتيهم_العذاب-performance2-a44-t4",
    "page_id": 2855,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D261-ياتيهم_العذاب-performance3-a44-t4",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D261-ياتيهم_العذاب-performance3-a44-t4",
    "locus_id": "D261-ياتيهم_العذاب-a44-t4",
    "original_text": "v-D261-ياتيهم_العذاب-performance3-a44-t4",
    "page_id": 2855,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D279-لا_يهديهم_الله-performance2-a104-t7",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D279-لا_يهديهم_الله-performance2-a104-t7",
    "locus_id": "D279-لا_يهديهم_الله-a104-t7",
    "original_text": "v-D279-لا_يهديهم_الله-performance2-a104-t7",
    "page_id": 2873,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D279-لا_يهديهم_الله-performance3-a104-t7",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D279-لا_يهديهم_الله-performance3-a104-t7",
    "locus_id": "D279-لا_يهديهم_الله-a104-t7",
    "original_text": "v-D279-لا_يهديهم_الله-performance3-a104-t7",
    "page_id": 2873,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D300-قبلا-w1-a55-t19",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D300-قبلا-w1-a55-t19",
    "locus_id": "D300-قبلا-a55-t19",
    "original_text": "v-D300-قبلا-w1-a55-t19",
    "page_id": 2894,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D305-عتيا-w2-a8-t14",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D305-عتيا-w2-a8-t14",
    "locus_id": "D305-عتيا-a8-t14",
    "original_text": "v-D305-عتيا-w2-a8-t14",
    "page_id": 2899,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D307-قول_الحق-w1-a34-t5",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D307-قول_الحق-w1-a34-t5",
    "locus_id": "D307-قول_الحق-a34-t5",
    "original_text": "v-D307-قول_الحق-w1-a34-t5",
    "page_id": 2901,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D308-مخلصا-w1-a51-t7",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D308-مخلصا-w1-a51-t7",
    "locus_id": "D308-مخلصا-a51-t7",
    "original_text": "v-D308-مخلصا-w1-a51-t7",
    "page_id": 2902,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D310-اءذا-w1-a66-t3",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D310-اءذا-w1-a66-t3",
    "locus_id": "D310-اءذا-a66-t3",
    "original_text": "v-D310-اءذا-w1-a66-t3",
    "page_id": 2904,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D327-فسلوهم-w2-a63-t6-h71d86bd4a75b3fad",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D327-فسلوهم-w2-a63-t6-h71d86bd4a75b3fad",
    "locus_id": "D327-فسلوهم-a63-t6",
    "original_text": "v-D327-فسلوهم-w2-a63-t6-h71d86bd4a75b3fad",
    "page_id": 2921,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D343-نسقيكم-performance2-a21-t6",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D343-نسقيكم-performance2-a21-t6",
    "locus_id": "D343-نسقيكم-a21-t6",
    "original_text": "v-D343-نسقيكم-performance2-a21-t6",
    "page_id": 2937,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D400-منجوك-w2-a33-t17-h6fc99fd3d5438d24",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D400-منجوك-w2-a33-t17-h6fc99fd3d5438d24",
    "locus_id": "D400-منجوك-a33-t17",
    "original_text": "v-D400-منجوك-w2-a33-t17-h6fc99fd3d5438d24",
    "page_id": 2994,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D412-ولا_تصعر-w2-a18-t1",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D412-ولا_تصعر-w2-a18-t1",
    "locus_id": "D412-ولا_تصعر-a18-t1",
    "original_text": "v-D412-ولا_تصعر-w2-a18-t1",
    "page_id": 3006,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D413-والبحر-w2-a27-t8",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D413-والبحر-w2-a27-t8",
    "locus_id": "D413-والبحر-a27-t8",
    "original_text": "v-D413-والبحر-w2-a27-t8",
    "page_id": 3007,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D421-يضاعف_لها_العذاب-w4-a30-t8",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D421-يضاعف_لها_العذاب-w4-a30-t8",
    "locus_id": "D421-يضاعف_لها_العذاب-a30-t8",
    "original_text": "v-D421-يضاعف_لها_العذاب-w4-a30-t8",
    "page_id": 3015,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D439-بينت-w2-a40-t24",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D439-بينت-w2-a40-t24",
    "locus_id": "D439-بينت-a40-t24",
    "original_text": "v-D439-بينت-w2-a40-t24",
    "page_id": 3033,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D446-بزينه_الكواكب-w2-a6-t5",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D446-بزينه_الكواكب-w2-a6-t5",
    "locus_id": "D446-بزينه_الكواكب-a6-t5",
    "original_text": "v-D446-بزينه_الكواكب-w2-a6-t5",
    "page_id": 3040,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D447-المخلصين-w2-a40-t4",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D447-المخلصين-w2-a40-t4",
    "locus_id": "D447-المخلصين-a40-t4",
    "original_text": "v-D447-المخلصين-w2-a40-t4",
    "page_id": 3041,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D447-لا_تناصرون-w2-a25-t3",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D447-لا_تناصرون-w2-a25-t3",
    "locus_id": "D447-لا_تناصرون-a25-t3",
    "original_text": "v-D447-لا_تناصرون-w2-a25-t3",
    "page_id": 3041,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D448-المخلصين-w2-a74-t4",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D448-المخلصين-w2-a74-t4",
    "locus_id": "D448-المخلصين-a74-t4",
    "original_text": "v-D448-المخلصين-w2-a74-t4",
    "page_id": 3042,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D448-متنا-w2-a53-t2",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D448-متنا-w2-a53-t2",
    "locus_id": "D448-متنا-a53-t2",
    "original_text": "v-D448-متنا-w2-a53-t2",
    "page_id": 3042,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D459-يرضه-w2-DOCX-P459-R02655-a7-t13",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D459-يرضه-w2-DOCX-P459-R02655-a7-t13",
    "locus_id": "D459-يرضه-DOCX-P459-R02654-a7-t13",
    "original_text": "v-D459-يرضه-w2-DOCX-P459-R02655-a7-t13",
    "page_id": 3053,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D471-يدخلون-w2-a40-t18",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D471-يدخلون-w2-a40-t18",
    "locus_id": "D471-يدخلون-a40-t18",
    "original_text": "v-D471-يدخلون-w2-a40-t18",
    "page_id": 3065,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D472-ادخلوا-w2-a46-t9",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D472-ادخلوا-w2-a46-t9",
    "locus_id": "D472-ادخلوا-a46-t9",
    "original_text": "v-D472-ادخلوا-w2-a46-t9",
    "page_id": 3066,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D486-يبشر-w1-a23-t3",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D486-يبشر-w1-a23-t3",
    "locus_id": "D486-يبشر-a23-t3",
    "original_text": "v-D486-يبشر-w1-a23-t3",
    "page_id": 3080,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D495-ترجعون-w2-a85-t13-h03798a01768f602f",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D495-ترجعون-w2-a85-t13-h03798a01768f602f",
    "locus_id": "D495-ترجعون-a85-t13",
    "original_text": "v-D495-ترجعون-w2-a85-t13-h03798a01768f602f",
    "page_id": 3089,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D495-ترجعون-w2-a85-t13-h2d627d0fffe497e6",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D495-ترجعون-w2-a85-t13-h2d627d0fffe497e6",
    "locus_id": "D495-ترجعون-a85-t13",
    "original_text": "v-D495-ترجعون-w2-a85-t13-h2d627d0fffe497e6",
    "page_id": 3089,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D495-يعلمون-w2-a86-t13-h8671d64a3f940984",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D495-يعلمون-w2-a86-t13-h8671d64a3f940984",
    "locus_id": "D495-يعلمون-a86-t13",
    "original_text": "v-D495-يعلمون-w2-a86-t13-h8671d64a3f940984",
    "page_id": 3089,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D496-رب_السماوات-w2-a7-t1-h14b24c146ba32712",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D496-رب_السماوات-w2-a7-t1-h14b24c146ba32712",
    "locus_id": "D496-رب_السماوات-a7-t1",
    "original_text": "v-D496-رب_السماوات-w2-a7-t1-h14b24c146ba32712",
    "page_id": 3090,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D497-فاسر-w2-a23-t1-ha77e0b5de259ebf1",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D497-فاسر-w2-a23-t1-ha77e0b5de259ebf1",
    "locus_id": "D497-فاسر-a23-t1",
    "original_text": "v-D497-فاسر-w2-a23-t1-ha77e0b5de259ebf1",
    "page_id": 3091,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D497-وعيون-w2-a25-t5-h2ab21346e3b327c2",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D497-وعيون-w2-a25-t5-h2ab21346e3b327c2",
    "locus_id": "D497-وعيون-a25-t5",
    "original_text": "v-D497-وعيون-w2-a25-t5-h2ab21346e3b327c2",
    "page_id": 3091,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D498-فاعتلوه-w2-a47-t2-h2fcfe2c78219923d",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D498-فاعتلوه-w2-a47-t2-h2fcfe2c78219923d",
    "locus_id": "D498-فاعتلوه-a47-t2",
    "original_text": "v-D498-فاعتلوه-w2-a47-t2-h2fcfe2c78219923d",
    "page_id": 3092,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D498-مقام_امين-w2-a51-t4-h0e0b30d62050800d",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D498-مقام_امين-w2-a51-t4-h0e0b30d62050800d",
    "locus_id": "D498-مقام_امين-a51-t4",
    "original_text": "v-D498-مقام_امين-w2-a51-t4-h0e0b30d62050800d",
    "page_id": 3092,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D498-وعيون-w2-a52-t3-h42595aa918c060d8",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D498-وعيون-w2-a52-t3-h42595aa918c060d8",
    "locus_id": "D498-وعيون-a52-t3",
    "original_text": "v-D498-وعيون-w2-a52-t3-h42595aa918c060d8",
    "page_id": 3092,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D509-اسرارهم-w2-a26-t15-h530c0574279f64aa",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D509-اسرارهم-w2-a26-t15-h530c0574279f64aa",
    "locus_id": "D509-اسرارهم-a26-t15",
    "original_text": "v-D509-اسرارهم-w2-a26-t15-h530c0574279f64aa",
    "page_id": 3103,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D555-قيل-performance2-a5-t2",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D555-قيل-performance2-a5-t2",
    "locus_id": "D555-قيل-a5-t2",
    "original_text": "v-D555-قيل-performance2-a5-t2",
    "page_id": 3149,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D567-فهي_يومئذ-w3-a16-t3",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D567-فهي_يومئذ-w3-a16-t3",
    "locus_id": "D567-فهي_يومئذ-a16-t3",
    "original_text": "v-D567-فهي_يومئذ-w3-a16-t3",
    "page_id": 3161,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D581-77-48-2--R03816-3-a48-t2",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D581-77-48-2--R03816-3-a48-t2",
    "locus_id": "D581-77-48-2--R03816-a48-t2",
    "original_text": "v-D581-77-48-2--R03816-3-a48-t2",
    "page_id": 3175,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D582-78-19-1--R03821-4-a19-t1",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D582-78-19-1--R03821-4-a19-t1",
    "locus_id": "D582-78-19-face-a19-t1",
    "original_text": "v-D582-78-19-1--R03821-4-a19-t1",
    "page_id": 3176,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D582-78-25-3--R03823-3-a25-t3",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-D582-78-25-3--R03823-3-a25-t3",
    "locus_id": "D582-78-25-3--R03823-a25-t3",
    "original_text": "v-D582-78-25-3--R03823-3-a25-t3",
    "page_id": 3176,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DOCX-564-R03642-934bff72-a27-t4",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-DOCX-564-R03642-934bff72-a27-t4",
    "locus_id": "DOCX-P564-SIET-67-27-a27-t4",
    "original_text": "v-DOCX-564-R03642-934bff72-a27-t4",
    "page_id": 3158,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DOCX-P523-3-R03257-60-5-3-a60-t5",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-DOCX-P523-3-R03257-60-5-3-a60-t5",
    "locus_id": "DOCX-P523-3-R03257-60-5-a60-t5",
    "original_text": "v-DOCX-P523-3-R03257-60-5-3-a60-t5",
    "page_id": 3117,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DOCX-P525-5-R03276-32-2-2-a32-t2",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-DOCX-P525-5-R03276-32-2-2-a32-t2",
    "locus_id": "DOCX-P525-5-R03276-32-2-a32-t2",
    "original_text": "v-DOCX-P525-5-R03276-32-2-2-a32-t2",
    "page_id": 3119,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DOCX-P525-5-R03284-45-7-2-a45-t7",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-DOCX-P525-5-R03284-45-7-2-a45-t7",
    "locus_id": "DOCX-P525-5-R03284-45-7-a45-t7",
    "original_text": "v-DOCX-P525-5-R03284-45-7-2-a45-t7",
    "page_id": 3119,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DOCX-P526-6-R03295-23-23-3-a23-t23",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-DOCX-P526-6-R03295-23-23-3-a23-t23",
    "locus_id": "DOCX-P526-6-R03295-23-23-a23-t23",
    "original_text": "v-DOCX-P526-6-R03295-23-23-3-a23-t23",
    "page_id": 3120,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L058-هانتم-1-w4-a66-t1",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-L058-هانتم-1-w4-a66-t1",
    "locus_id": "L058-هانتم-1-a66-t1",
    "original_text": "v-L058-هانتم-1-w4-a66-t1",
    "page_id": 309,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L065-هاانتم-1-w3-a119-t1",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-L065-هاانتم-1-w3-a119-t1",
    "locus_id": "L065-هاانتم-1-a119-t1",
    "original_text": "v-L065-هاانتم-1-w3-a119-t1",
    "page_id": 316,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L363-s25a41b0-w3-a41-t6",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-L363-s25a41b0-w3-a41-t6",
    "locus_id": "L363-s25a41b0-a41-t6",
    "original_text": "v-L363-s25a41b0-w3-a41-t6",
    "page_id": 2957,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L448-s37a56b0-w2-a56-t5",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-L448-s37a56b0-w2-a56-t5",
    "locus_id": "L448-s37a56b0-a56-t5",
    "original_text": "v-L448-s37a56b0-w2-a56-t5",
    "page_id": 3042,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L522-s51a41b5-w2-R03249-a41-t5",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-L522-s51a41b5-w2-R03249-a41-t5",
    "locus_id": "L522-s51a41b5-a41-t5",
    "original_text": "v-L522-s51a41b5-w2-R03249-a41-t5",
    "page_id": 3116,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L522-s51a41b5-w3-R03250-a41-t5",
    "flag_type": "DB_ONLY",
    "issue_ar": "[phase3] قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: v-L522-s51a41b5-w3-R03250-a41-t5",
    "locus_id": "L522-s51a41b5-a41-t5",
    "original_text": "v-L522-s51a41b5-w3-R03250-a41-t5",
    "page_id": 3116,
    "severity": "warning",
    "status": "open"
  }
]
```

### DOCUMENTED_CONFLICT (81)

```json
[
  {
    "entry_id": "v-SUSI-002-30-24-0027-performance-a30-t24",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "r-p006-024-1",
    "original_text": "إِنِّىٓ أَعْلَمُ",
    "page_id": 257,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-002-33-12-0030-performance-a33-t12",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "r-p006-024-2",
    "original_text": "إِنِّىٓ أَعْلَمُ",
    "page_id": 257,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L048-فتذكر-1-w3-a282-t69",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "L048-فتذكر-1-a282-t69",
    "original_text": "فَتُذْكِرَ",
    "page_id": 299,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-005-28-12-0555-performance-a28-t12",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "r-p112-021-1",
    "original_text": "إِنِّىٓ أَخَافُ",
    "page_id": 363,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-010-15-20-1343-performance-a15-t20",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-010-015-020-015-020",
    "original_text": "لِىٓ",
    "page_id": 849,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-010-15-25-1344-performance-a15-t25",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-010-015-025-015-025",
    "original_text": "نَفْسِىٓ ۖ",
    "page_id": 849,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-010-15-32-1345-performance-a15-t32",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-010-015-032-015-032",
    "original_text": "إِنِّىٓ",
    "page_id": 849,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-010-53-6-1383-performance-a53-t6",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-010-053-006-053-006",
    "original_text": "وَرَبِّىٓ",
    "page_id": 853,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-011-3-20-1441-performance-a3-t20",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-011-003-020-003-020",
    "original_text": "فَإِنِّىٓ",
    "page_id": 860,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-011-10-10-1447-performance-a10-t10",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-011-010-010-010-010",
    "original_text": "عَنِّىٓ ۚ",
    "page_id": 861,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-011-26-6-1457-performance-a26-t6",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-011-026-006-026-006",
    "original_text": "إِنِّىٓ",
    "page_id": 863,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-011-29-19-1463-performance-a29-t19",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-011-029-019-029-019",
    "original_text": "وَلَـٰكِنِّىٓ",
    "page_id": 1088,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-011-34-3-1475-performance-a34-t3",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "r-p225-029-1",
    "original_text": "نُصْحِىٓ إِنْ",
    "page_id": 1088,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-011-46-18-1490-performance-a46-t18",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-011-046-018-046-018",
    "original_text": "إِنِّىٓ",
    "page_id": 1090,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-011-47-3-1492-performance-a47-t3",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-011-047-003-047-003",
    "original_text": "إِنِّىٓ",
    "page_id": 1090,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-011-78-22-1524-performance-a78-t22",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-011-078-022-078-022",
    "original_text": "ضَيْفِىٓ ۖ",
    "page_id": 1093,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-011-84-18-1530-performance-a84-t18",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-011-084-018-084-018",
    "original_text": "إِنِّىٓ",
    "page_id": 1094,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-011-84-21-1532-performance-a84-t21",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-011-084-021-084-021",
    "original_text": "وَإِنِّىٓ",
    "page_id": 1094,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-011-88-29-1538-performance-a88-t29",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "r-p231-027-1",
    "original_text": "تَوْفِيقِىٓ إِلَّا",
    "page_id": 1094,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-011-89-4-1539-performance-a89-t4",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-011-089-004-089-004",
    "original_text": "شِقَاقِىٓ",
    "page_id": 1095,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-011-92-3-1541-performance-a92-t3",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-011-092-003-092-003",
    "original_text": "أَرَهْطِىٓ",
    "page_id": 1095,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-012-23-17-1600-performance-a23-t17",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-012-023-017-023-017",
    "original_text": "رَبِّىٓ",
    "page_id": 1101,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-012-36-7-1615-performance-a36-t7",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-012-036-007-036-007",
    "original_text": "إِنِّىٓ",
    "page_id": 1102,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-012-36-13-1615-performance-a36-t13",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-012-036-013-036-013",
    "original_text": "إِنِّىٓ",
    "page_id": 1102,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-012-37-15-1625-performance-a37-t15",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-012-037-015-037-015",
    "original_text": "رَبِّىٓ ۚ",
    "page_id": 1102,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-012-43-3-1633-performance-a43-t3",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-012-043-003-043-003",
    "original_text": "إِنِّىٓ",
    "page_id": 1103,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-012-46-17-1642-performance-a46-t17",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-012-046-017-046-017",
    "original_text": "لَّعَلِّىٓ",
    "page_id": 1104,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-012-53-3-1653-performance-a53-t3",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "r-p242-028-1",
    "original_text": "نَفْسِىٓ ۚ إِنَّ",
    "page_id": 1105,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-012-69-9-1671-performance-a69-t9",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-012-069-009-069-009",
    "original_text": "إِنِّىٓ",
    "page_id": 1106,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-012-80-30-1686-performance-a80-t30",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-012-080-030-080-030",
    "original_text": "أَبِىٓ",
    "page_id": 3179,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-012-86-5-1691-performance-a86-t5",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-012-086-005-086-005",
    "original_text": "وَحُزْنِىٓ",
    "page_id": 3179,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-012-96-14-1699-performance-a96-t14",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-012-096-014-096-014",
    "original_text": "إِنِّىٓ",
    "page_id": 3181,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-012-98-5-1703-performance-a98-t5",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-012-098-005-098-005",
    "original_text": "رَبِّىٓ ۖ",
    "page_id": 3181,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-012-100-21-1707-performance-a100-t21",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-012-100-021-100-021",
    "original_text": "بِىٓ",
    "page_id": 3181,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-014-37-2-1823-performance-a37-t2",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-014-037-002-037-002",
    "original_text": "إِنِّىٓ",
    "page_id": 2854,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-016-89-10-1962-performance-a89-t10",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "r-p277-TAGHYIR_HAMZ-وجينا-2",
    "original_text": "وَجِئْنَا",
    "page_id": 2871,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-016-90-3-1964-performance-a90-t3",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "r-p277-TAGHYIR_HAMZ-يامر-3",
    "original_text": "يَأْمُرُ",
    "page_id": 2871,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-017-100-7-2090-performance-a100-t7",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-017-100-007-100-007",
    "original_text": "رَبِّىٓ",
    "page_id": 2886,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-018-22-16-2126-performance-a22-t16",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-018-022-016-022-016",
    "original_text": "رَّبِّىٓ",
    "page_id": 2890,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-018-38-7-2144-performance-a38-t7",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-018-038-007-038-007",
    "original_text": "بِرَبِّىٓ",
    "page_id": 2892,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-018-40-2-2148-performance-a40-t2",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-018-040-002-040-002",
    "original_text": "رَبِّىٓ",
    "page_id": 2892,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-018-102-8-2218-performance-a102-t8",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-018-102-008-102-008",
    "original_text": "دُونِىٓ",
    "page_id": 2898,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-019-10-4-2241-performance-a10-t4",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-019-010-004-010-004",
    "original_text": "لِّىٓ",
    "page_id": 2899,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-020-10-7-2312-performance-a10-t7",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-020-010-007-010-007",
    "original_text": "إِنِّىٓ",
    "page_id": 2906,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-020-10-10-2313-performance-a10-t10",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-020-010-010-010-010",
    "original_text": "لَّعَلِّىٓ",
    "page_id": 2906,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-020-14-1-2320-performance-a14-t1",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-020-014-001-014-001",
    "original_text": "إِنَّنِىٓ",
    "page_id": 2907,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-021-45-8-2509-performance-a45-t8",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "r-p326-001-1",
    "original_text": "ٱلدُّعَآءَ إِذَا",
    "page_id": 2920,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-025-30-5-2808-performance-a30-t5",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-025-030-005-030-005",
    "original_text": "قَوْمِى",
    "page_id": 2956,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-026-12-3-2850-performance-a12-t3",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-026-012-003-012-003",
    "original_text": "إِنِّىٓ",
    "page_id": 2961,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-026-77-3-2892-performance-a77-t3",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-026-077-003-077-003",
    "original_text": "لِّىٓ",
    "page_id": 2964,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-027-7-5-2951-performance-a7-t5",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-027-007-005-007-005",
    "original_text": "إِنِّىٓ",
    "page_id": 2971,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-028-37-3-3088-performance-a37-t3",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-028-037-003-037-003",
    "original_text": "رَبِّىٓ",
    "page_id": 2984,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-028-38-19-3091-performance-a38-t19",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-028-038-019-038-019",
    "original_text": "لَّعَلِّىٓ",
    "page_id": 2984,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-028-78-6-3132-performance-a78-t6",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-028-078-006-078-006",
    "original_text": "عِندِىٓ ۚ",
    "page_id": 2989,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-028-85-10-3140-performance-a85-t10",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-028-085-010-085-010",
    "original_text": "رَّبِّىٓ",
    "page_id": 2990,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-029-26-8-3157-performance-a26-t8",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-029-026-008-026-008",
    "original_text": "رَبِّىٓ ۖ",
    "page_id": 2993,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D400-منجوك-w2-a33-t17-h397221b6d551b0d8",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "D400-منجوك-a33-t17",
    "original_text": "مُنْجُوكَ",
    "page_id": 2994,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-034-50-13-3456-performance-a50-t13",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-034-050-013-050-013",
    "original_text": "رَبِّىٓ ۚ",
    "page_id": 3028,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-036-24-1-3510-performance-a24-t1",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-036-024-001-024-001",
    "original_text": "إِنِّىٓ",
    "page_id": 3035,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-036-25-1-3511-performance-a25-t1",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-036-025-001-025-001",
    "original_text": "إِنِّىٓ",
    "page_id": 3035,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-038-32-2-3613-performance-a32-t2",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-038-032-002-032-002",
    "original_text": "إِنِّىٓ",
    "page_id": 3049,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-038-35-11-3617-performance-a35-t11",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-038-035-011-035-012",
    "original_text": "مِّنۢ بَعْدِىٓ ۖ",
    "page_id": 3049,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-039-13-2-3661-performance-a13-t2",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-039-013-002-013-002",
    "original_text": "إِنِّىٓ",
    "page_id": 3054,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-040-26-8-3737-performance-a26-t8",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-040-026-008-026-008",
    "original_text": "إِنِّىٓ",
    "page_id": 3064,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-040-36-7-3756-performance-a36-t7",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-040-036-007-036-007",
    "original_text": "لَّعَلِّىٓ",
    "page_id": 3065,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-040-44-6-3774-performance-a44-t6",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-040-044-006-044-006",
    "original_text": "أَمْرِىٓ",
    "page_id": 3066,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-041-50-19-3862-performance-a50-t19",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-041-050-019-050-019",
    "original_text": "رَبِّىٓ",
    "page_id": 3076,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-043-51-15-3936-performance-a51-t15",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-043-051-015-051-015",
    "original_text": "تَحْتِىٓ ۖ",
    "page_id": 3087,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-044-19-6-3970-performance-a19-t6",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-044-019-006-019-006",
    "original_text": "إِنِّىٓ",
    "page_id": 3091,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-046-21-20-4024-performance-a21-t20",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-046-021-020-021-020",
    "original_text": "إِنِّىٓ",
    "page_id": 3099,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-046-23-10-4029-performance-a23-t10",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "loc-046-023-010-023-010",
    "original_text": "وَلَـٰكِنِّىٓ",
    "page_id": 3099,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P536-R03380-PERF-fe7dd2d9-a58-t1",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "AUDIT-P536-R03380-PERF-1006ef40-a58-t1",
    "original_text": "أَفَرَءَيْتُم",
    "page_id": 3130,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P536-R03380-PERF-ae204faa-a58-t1",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "AUDIT-P536-R03380-PERF-1006ef40-a58-t1",
    "original_text": "أَفَرَءَيْتُم",
    "page_id": 3130,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P536-R03380-PERF-1006ef40-a58-t1",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "AUDIT-P536-R03380-PERF-1006ef40-a58-t1",
    "original_text": "أَفَرَءَيْتُم",
    "page_id": 3130,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P536-R03380-PERF-365be4f5-a58-t1",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "AUDIT-P536-R03380-PERF-1006ef40-a58-t1",
    "original_text": "أَفَرَءَيْتُم",
    "page_id": 3130,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P536-R03380-PERF-f0ed9283-a58-t1",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "AUDIT-P536-R03380-PERF-1006ef40-a58-t1",
    "original_text": "أَفَرَءَيْتُم",
    "page_id": 3130,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-061-6-21-4287-performance-a6-t21",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "r-p552-YAAT_IDAFA-من_بعدي_اسمهو-9",
    "original_text": "مِنۢ بَعْدِى ٱسْمُهُۥٓ",
    "page_id": 3146,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DOCX-563-R03636-2ee39a8b-a20-t7",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "DOCX-P563-R03636-20-7-a20-t7",
    "original_text": "يَنصُرُكُم",
    "page_id": 3157,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DOCX-564-R03642-ec591abe-a27-t4",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "DOCX-P564-SIET-67-27-a27-t4",
    "original_text": "سِيٓـَٔتْ",
    "page_id": 3158,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D579-76-15-8--R03783-4-a15-t8",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "D579-76-15-16-qawarir-pair-a15-t8",
    "original_text": "قَوَارِيرًا",
    "page_id": 3173,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D579-76-16-1--R03786-3-a16-t1",
    "flag_type": "DOCUMENTED_CONFLICT",
    "issue_ar": "[phase3] تعارض موثق في تدقيق القارئ",
    "locus_id": "D579-76-15-16-qawarir-pair-a16-t1",
    "original_text": "قَوَارِيرَ",
    "page_id": 3173,
    "severity": "warning",
    "status": "open"
  }
]
```

### NARRATOR_TWICE (143)

```json
[
  {
    "entry_id": "r-p115-008-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p115-008-1",
    "original_text": "r-p115-008-1",
    "page_id": 366,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p115-009-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p115-008-1",
    "original_text": "r-p115-009-1",
    "page_id": 366,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p132-010-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p132-010-1",
    "original_text": "r-p132-010-1",
    "page_id": 383,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p132-011-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p132-010-1",
    "original_text": "r-p132-011-1",
    "page_id": 383,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p132-021-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p132-021-1",
    "original_text": "r-p132-021-1",
    "page_id": 383,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p132-022-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p132-021-1",
    "original_text": "r-p132-022-1",
    "page_id": 383,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p138-010-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p138-010-1",
    "original_text": "r-p138-010-1",
    "page_id": 389,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p138-012-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p138-010-1",
    "original_text": "r-p138-012-1",
    "page_id": 389,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-008-48-26-r0783-performance-a48-t26",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p183-023-1",
    "original_text": "v-DURI-008-48-26-r0783-performance-a48-t26",
    "page_id": 434,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p183-023-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p183-023-1",
    "original_text": "r-p183-023-1",
    "page_id": 434,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p219-004-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p219-004-1",
    "original_text": "r-p219-004-1",
    "page_id": 858,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p219-005-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p219-004-1",
    "original_text": "r-p219-005-1",
    "page_id": 858,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p225-019-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p225-019-1",
    "original_text": "r-p225-019-1",
    "page_id": 1088,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p225-020-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p225-020-1",
    "original_text": "r-p225-020-1",
    "page_id": 1088,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p226-016-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p226-016-1",
    "original_text": "r-p226-016-1",
    "page_id": 1089,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p230-008-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p230-008-1",
    "original_text": "r-p230-008-1",
    "page_id": 1093,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p231-015-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p231-015-1",
    "original_text": "r-p231-015-1",
    "page_id": 1094,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p231-016-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p231-016-1",
    "original_text": "r-p231-016-1",
    "page_id": 1094,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p232-016-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p232-003-1",
    "original_text": "r-p232-016-1",
    "page_id": 1095,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p237-023-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p237-023-1",
    "original_text": "r-p237-023-1",
    "page_id": 1100,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p242-018-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p242-018-1",
    "original_text": "r-p242-018-1",
    "page_id": 1105,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p242-019-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p242-019-1",
    "original_text": "r-p242-019-1",
    "page_id": 1105,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p242-020-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p242-020-1",
    "original_text": "r-p242-020-1",
    "page_id": 1105,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p243-020-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p243-020-1",
    "original_text": "r-p243-020-1",
    "page_id": 1106,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p243-021-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p243-021-1",
    "original_text": "r-p243-021-1",
    "page_id": 1106,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-012-80-29-r1056-performance-a80-t29",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p245-YAAT_IDAFA-لي_ابي-18",
    "original_text": "v-DURI-012-80-29-r1056-performance-a80-t29",
    "page_id": 3179,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p245-YAAT_IDAFA-لي_ابي-18",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p245-YAAT_IDAFA-لي_ابي-18",
    "original_text": "r-p245-YAAT_IDAFA-لي_ابي-18",
    "page_id": 3179,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p253-002-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p253-002-1",
    "original_text": "r-p253-002-1",
    "page_id": 2847,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p253-011-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p253-002-1",
    "original_text": "r-p253-011-1",
    "page_id": 2847,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p254-004-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p254-004-1",
    "original_text": "r-p254-004-1",
    "page_id": 2848,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p257-001-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p257-001-1",
    "original_text": "r-p257-001-1",
    "page_id": 2851,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p261-001-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p261-001-1",
    "original_text": "r-p261-001-1",
    "page_id": 2855,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p265-004-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p265-004-1",
    "original_text": "r-p265-004-1",
    "page_id": 2859,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p265-006-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p265-006-1",
    "original_text": "r-p265-006-1",
    "page_id": 2859,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p268-IMALAH_TAQLIL-وتري-2",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p268-IMALAH_TAQLIL-وتري-2",
    "original_text": "r-p268-IMALAH_TAQLIL-وتري-2",
    "page_id": 2862,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p276-IMALAH_TAQLIL-رءا_الذين-5",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "loc-016-085-002-085-003",
    "original_text": "r-p276-IMALAH_TAQLIL-رءا_الذين-5",
    "page_id": 2870,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p276-IMALAH_TAQLIL-رءا_الذين-6",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "loc-016-086-002-086-003",
    "original_text": "r-p276-IMALAH_TAQLIL-رءا_الذين-6",
    "page_id": 2870,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p308-009-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p308-009-1",
    "original_text": "r-p308-009-1",
    "page_id": 2902,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p309-006-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p309-006-1",
    "original_text": "r-p309-006-1",
    "page_id": 2903,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p309-021-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p309-021-1",
    "original_text": "r-p309-021-1",
    "page_id": 2903,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p316-015-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p316-015-1",
    "original_text": "r-p316-015-1",
    "page_id": 2910,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p316-019-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p316-019-1",
    "original_text": "r-p316-019-1",
    "page_id": 2910,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p316-023-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p316-023-1",
    "original_text": "r-p316-023-1",
    "page_id": 2910,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p317-003-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p317-003-1",
    "original_text": "r-p317-003-1",
    "page_id": 2911,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p317-012-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p317-003-1",
    "original_text": "r-p317-012-1",
    "page_id": 2911,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p319-016-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p319-016-1",
    "original_text": "r-p319-016-1",
    "page_id": 2913,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p321-027-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "D321-تاتهم-a133-t8",
    "original_text": "r-p321-027-1",
    "page_id": 2915,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p322-003-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p322-003-1",
    "original_text": "r-p322-003-1",
    "page_id": 2916,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p322-005-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p322-005-1",
    "original_text": "r-p322-005-1",
    "page_id": 2916,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p322-006-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p322-006-1",
    "original_text": "r-p322-006-1",
    "page_id": 2916,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p322-012-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p322-012-1",
    "original_text": "r-p322-012-1",
    "page_id": 2916,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p322-017-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p322-017-1",
    "original_text": "r-p322-017-1",
    "page_id": 2916,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p323-003-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p323-003-1",
    "original_text": "r-p323-003-1",
    "page_id": 2917,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p323-005-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p323-005-1",
    "original_text": "r-p323-005-1",
    "page_id": 2917,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p323-006-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p323-006-1",
    "original_text": "r-p323-006-1",
    "page_id": 2917,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p323-007-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p323-006-1",
    "original_text": "r-p323-007-1",
    "page_id": 2917,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p323-010-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p323-006-1",
    "original_text": "r-p323-010-1",
    "page_id": 2917,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p323-011-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p323-006-1",
    "original_text": "r-p323-011-1",
    "page_id": 2917,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p324-006-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p324-006-1",
    "original_text": "r-p324-006-1",
    "page_id": 2918,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p325-008-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "D325-تاتيهم-a40-t2",
    "original_text": "r-p325-008-1",
    "page_id": 2919,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p325-009-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p325-009-1",
    "original_text": "r-p325-009-1",
    "page_id": 2919,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p325-014-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p325-014-1",
    "original_text": "r-p325-014-1",
    "page_id": 2919,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p325-017-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p325-017-1",
    "original_text": "r-p325-017-1",
    "page_id": 2919,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p326-006-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p326-006-1",
    "original_text": "r-p326-006-1",
    "page_id": 2920,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p326-012-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p326-011-1",
    "original_text": "r-p326-012-1",
    "page_id": 2920,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p327-005-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p327-005-1",
    "original_text": "r-p327-005-1",
    "page_id": 2921,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p328-001-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p328-001-1",
    "original_text": "r-p328-001-1",
    "page_id": 2922,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p328-013-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p328-013-1",
    "original_text": "r-p328-013-1",
    "page_id": 2922,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p329-005-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p329-005-1",
    "original_text": "r-p329-005-1",
    "page_id": 2923,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p329-008-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p329-008-1",
    "original_text": "r-p329-008-1",
    "page_id": 2923,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p330-003-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p330-003-1",
    "original_text": "r-p330-003-1",
    "page_id": 2924,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p330-013-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p330-013-1",
    "original_text": "r-p330-013-1",
    "page_id": 2924,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p333-003-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p333-001-1",
    "original_text": "r-p333-003-1",
    "page_id": 2927,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p335-010-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p335-010-1",
    "original_text": "r-p335-010-1",
    "page_id": 2929,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p335-011-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p335-011-1",
    "original_text": "r-p335-011-1",
    "page_id": 2929,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p338-011-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p338-011-1",
    "original_text": "r-p338-011-1",
    "page_id": 2932,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p338-012-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p338-012-1",
    "original_text": "r-p338-012-1",
    "page_id": 2932,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p340-017-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p340-017-1",
    "original_text": "r-p340-017-1",
    "page_id": 2934,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p342-003-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p342-003-1",
    "original_text": "r-p342-003-1",
    "page_id": 2936,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p345-003-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p345-003-1",
    "original_text": "r-p345-003-1",
    "page_id": 2939,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p345-006-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "L345-تترا-1-a44-t4",
    "original_text": "r-p345-006-1",
    "page_id": 2939,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p345-011-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p345-011-1",
    "original_text": "r-p345-011-1",
    "page_id": 2939,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p345-021-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p345-021-1",
    "original_text": "r-p345-021-1",
    "page_id": 2939,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p346-003-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p346-003-1",
    "original_text": "r-p346-003-1",
    "page_id": 2940,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p346-015-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p346-015-1",
    "original_text": "r-p346-015-1",
    "page_id": 2940,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p347-022-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p347-022-1",
    "original_text": "r-p347-022-1",
    "page_id": 2941,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p350-003-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p350-003-1",
    "original_text": "r-p350-003-1",
    "page_id": 2944,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p350-004-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p350-004-1",
    "original_text": "r-p350-004-1",
    "page_id": 2944,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p350-005-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p350-005-1",
    "original_text": "r-p350-005-1",
    "page_id": 2944,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p350-009-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p350-009-1",
    "original_text": "r-p350-009-1",
    "page_id": 2944,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p350-010-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p350-010-1",
    "original_text": "r-p350-010-1",
    "page_id": 2944,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p350-015-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p350-015-1",
    "original_text": "r-p350-015-1",
    "page_id": 2944,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p352-001-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p352-001-1",
    "original_text": "r-p352-001-1",
    "page_id": 2946,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p352-005-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p352-005-1",
    "original_text": "r-p352-005-1",
    "page_id": 2946,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p352-008-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p352-008-1",
    "original_text": "r-p352-008-1",
    "page_id": 2946,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p352-015-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p352-015-1",
    "original_text": "r-p352-015-1",
    "page_id": 2946,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p353-001-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p353-001-1",
    "original_text": "r-p353-001-1",
    "page_id": 2947,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p353-004-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p353-004-1",
    "original_text": "r-p353-004-1",
    "page_id": 2947,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p353-006-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p353-006-1",
    "original_text": "r-p353-006-1",
    "page_id": 2947,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p353-011-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p353-011-1",
    "original_text": "r-p353-011-1",
    "page_id": 2947,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p355-016-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p355-016-1",
    "original_text": "r-p355-016-1",
    "page_id": 2949,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p356-014-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p356-014-1",
    "original_text": "r-p356-014-1",
    "page_id": 2950,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p356-015-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p356-015-1",
    "original_text": "r-p356-015-1",
    "page_id": 2950,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p356-016-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p356-016-1",
    "original_text": "r-p356-016-1",
    "page_id": 2950,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p357-018-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p357-018-1",
    "original_text": "r-p357-018-1",
    "page_id": 2951,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p357-020-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p357-020-1",
    "original_text": "r-p357-020-1",
    "page_id": 2951,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p357-022-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p357-022-1",
    "original_text": "r-p357-022-1",
    "page_id": 2951,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p358-012-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p358-012-1",
    "original_text": "r-p358-012-1",
    "page_id": 2952,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p358-017-2",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p358-017-2",
    "original_text": "r-p358-017-2",
    "page_id": 2952,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p359-001-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p359-001-1",
    "original_text": "r-p359-001-1",
    "page_id": 2953,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p359-004-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p359-004-1",
    "original_text": "r-p359-004-1",
    "page_id": 2953,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p359-009-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p359-009-1",
    "original_text": "r-p359-009-1",
    "page_id": 2953,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p359-s25a1b0",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p359-009-1",
    "original_text": "r-p359-s25a1b0",
    "page_id": 2953,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p359-015-1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p359-015-1",
    "original_text": "r-p359-015-1",
    "page_id": 2953,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p359-s25a2b3",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p359-015-1",
    "original_text": "r-p359-s25a2b3",
    "page_id": 2953,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p369-s26a43b0",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p369-s26a43b0",
    "original_text": "r-p369-s26a43b0",
    "page_id": 2963,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p385-s28a3b0",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p385-s28a3b0",
    "original_text": "r-p385-s28a3b0",
    "page_id": 2979,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p390-s28a42b0",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p390-s28a42b0",
    "original_text": "r-p390-s28a42b0",
    "page_id": 2984,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p405-s30a10b0",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p405-s30a10b0",
    "original_text": "r-p405-s30a10b0",
    "page_id": 2999,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p412-s31a15b1",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p412-s31a15b1",
    "original_text": "r-p412-s31a15b1",
    "page_id": 3006,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p435-s35a5b0",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p435-s35a5b0",
    "original_text": "r-p435-s35a5b0",
    "page_id": 3029,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p435-s35a11b0",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p435-s35a11b0",
    "original_text": "r-p435-s35a11b0",
    "page_id": 3029,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p440-s36a12b0",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p440-s36a12b0",
    "original_text": "r-p440-s36a12b0",
    "page_id": 3034,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p444-s36a66b2",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p444-s36a66b2",
    "original_text": "r-p444-s36a66b2",
    "page_id": 3038,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p446-s37a6b0",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p446-s37a6b0",
    "original_text": "r-p446-s37a6b0",
    "page_id": 3040,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p446-s37a8b0",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p446-s37a8b0",
    "original_text": "r-p446-s37a8b0",
    "page_id": 3040,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p448-s37a59b0",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p448-s37a59b0",
    "original_text": "r-p448-s37a59b0",
    "page_id": 3042,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-037-102-7-r2042-performance-a102-t7",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p449-YAAT_IDAFA-اني_ارا-7",
    "original_text": "v-DURI-037-102-7-r2042-performance-a102-t7",
    "page_id": 3043,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p449-YAAT_IDAFA-اني_ارا-7",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p449-YAAT_IDAFA-اني_ارا-7",
    "original_text": "r-p449-YAAT_IDAFA-اني_ارا-7",
    "page_id": 3043,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p449-s37a102b0",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p449-s37a102b0",
    "original_text": "r-p449-s37a102b0",
    "page_id": 3043,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p450-s37a114b0",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p450-s37a114b0",
    "original_text": "r-p450-s37a114b0",
    "page_id": 3044,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p459-s39a6b0",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p459-s39a6b0",
    "original_text": "r-p459-s39a6b0",
    "page_id": 3053,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p459-s39a10b0",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p459-s39a10b0",
    "original_text": "r-p459-s39a10b0",
    "page_id": 3053,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DOCX-P525-5-R03277-32-2-3-a32-t2",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "DOCX-P525-5-R03276-32-2-a32-t2",
    "original_text": "v-DOCX-P525-5-R03277-32-2-3-a32-t2",
    "page_id": 3119,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p525-TAGHYIR_HAMZ-تامرهم-4",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "DOCX-P525-5-R03276-32-2-a32-t2",
    "original_text": "r-p525-TAGHYIR_HAMZ-تامرهم-4",
    "page_id": 3119,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p583-IMALAH_TAQLIL-الراجفه-doc",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p583-IMALAH_TAQLIL-الراجفه-doc",
    "original_text": "r-p583-IMALAH_TAQLIL-الراجفه-doc",
    "page_id": 3177,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p583-IMALAH_TAQLIL-الرادفه-doc",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p583-IMALAH_TAQLIL-الرادفه-doc",
    "original_text": "r-p583-IMALAH_TAQLIL-الرادفه-doc",
    "page_id": 3177,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p583-IMALAH_TAQLIL-واجفه-doc",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p583-IMALAH_TAQLIL-واجفه-doc",
    "original_text": "r-p583-IMALAH_TAQLIL-واجفه-doc",
    "page_id": 3177,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p583-IMALAH_TAQLIL-الحافره-doc",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p583-IMALAH_TAQLIL-الحافره-doc",
    "original_text": "r-p583-IMALAH_TAQLIL-الحافره-doc",
    "page_id": 3177,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p583-IMALAH_TAQLIL-نخره-doc",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "D583-نخره-a11-t4",
    "original_text": "r-p583-IMALAH_TAQLIL-نخره-doc",
    "page_id": 3177,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p583-IMALAH_TAQLIL-خاسره-doc",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p583-IMALAH_TAQLIL-خاسره-doc",
    "original_text": "r-p583-IMALAH_TAQLIL-خاسره-doc",
    "page_id": 3177,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p583-IMALAH_TAQLIL-واحده-doc",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p583-IMALAH_TAQLIL-واحده-doc",
    "original_text": "r-p583-IMALAH_TAQLIL-واحده-doc",
    "page_id": 3177,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "r-p583-IMALAH_TAQLIL-بالساهره-doc",
    "flag_type": "NARRATOR_TWICE",
    "issue_ar": "[phase3] راوٍ مكرر في الوجه الأول عند الموضع",
    "locus_id": "r-p583-IMALAH_TAQLIL-بالساهره-doc",
    "original_text": "r-p583-IMALAH_TAQLIL-بالساهره-doc",
    "page_id": 3177,
    "severity": "warning",
    "status": "open"
  }
]
```

### NEEDS_MANUAL_REVIEW (5)

```json
[
  {
    "entry_id": "r-p009-016-1",
    "flag_type": "NEEDS_MANUAL_REVIEW",
    "issue_ar": "[phase3] السجل يحتاج مراجعة يدوية",
    "locus_id": "r-p009-016-1",
    "original_text": "",
    "page_id": 260,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L012-تعبدون-1-w2-a83-t7",
    "flag_type": "NEEDS_MANUAL_REVIEW",
    "issue_ar": "[phase3] السجل يحتاج مراجعة يدوية",
    "locus_id": "L012-تعبدون-1-a83-t7",
    "original_text": "يَعْبُدُونَ",
    "page_id": 263,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L014-قلوبهم_العجل-1-w2-a93-t17",
    "flag_type": "NEEDS_MANUAL_REVIEW",
    "issue_ar": "[phase3] السجل يحتاج مراجعة يدوية",
    "locus_id": "L014-قلوبهم_العجل-1-a93-t17",
    "original_text": "قُلُوبِهِمِ ٱلْعِجْلَ",
    "page_id": 265,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L014-قلوبهم_العجل-1-w3-a93-t17",
    "flag_type": "NEEDS_MANUAL_REVIEW",
    "issue_ar": "[phase3] السجل يحتاج مراجعة يدوية",
    "locus_id": "L014-قلوبهم_العجل-1-a93-t17",
    "original_text": "قُلُوبِهُمُ ٱلْعِجْلَ",
    "page_id": 265,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L016-ينزل-1-w2-a105-t11",
    "flag_type": "NEEDS_MANUAL_REVIEW",
    "issue_ar": "[phase3] السجل يحتاج مراجعة يدوية",
    "locus_id": "L016-ينزل-1-a105-t11",
    "original_text": "يُنْزَلُ",
    "page_id": 267,
    "severity": "warning",
    "status": "open"
  }
]
```

### Q6_AMBIGUOUS (474)

```json
[
  {
    "entry_id": "v-L001-الصرط-1-w3-a6-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L001-الصرط-1-a6-t2",
    "original_text": "ٱلصِّرَٰطَ",
    "page_id": 252,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L001-صرط-1-w3-a7-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L001-صرط-1-a7-t1",
    "original_text": "صِرَٰطَ",
    "page_id": 252,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L003-قيل-1-w2-a11-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L003-قيل-1-a11-t2",
    "original_text": "قِيلَ",
    "page_id": 254,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L003-قيل-2-w2-a13-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L003-قيل-2-a13-t2",
    "original_text": "قِيلَ",
    "page_id": 254,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-002-30-24-0027-performance-a30-t24",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "r-p006-024-1",
    "original_text": "إِنِّىٓ أَعْلَمُ",
    "page_id": 257,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-002-33-12-0030-performance-a33-t12",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "r-p006-024-2",
    "original_text": "إِنِّىٓ أَعْلَمُ",
    "page_id": 257,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L008-باريكم-1-w3-a54-t13",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L008-باريكم-1-a54-t13",
    "original_text": "بَارِئِكُمْ",
    "page_id": 259,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L008-باريكم-2-w3-a54-t20",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L008-باريكم-2-a54-t20",
    "original_text": "بَارِئِكُمْ",
    "page_id": 259,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L009-قيل-1-w2-a59-t7",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L009-قيل-1-a59-t7",
    "original_text": "قِيلَ",
    "page_id": 260,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L010-يامركم-1-w3-a67-t7",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L010-يامركم-1-a67-t7",
    "original_text": "يَأْمُرُكُمْ",
    "page_id": 261,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L014-قيل-1-w2-a91-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L014-قيل-1-a91-t2",
    "original_text": "قِيلَ",
    "page_id": 265,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L014-يامركم-1-w3-a93-t22",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L014-يامركم-1-a93-t22",
    "original_text": "يَأْمُرُكُم",
    "page_id": 265,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L020-وارنا-1-w3-a128-t10",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L020-وارنا-1-a128-t10",
    "original_text": "وَأَرِنَا",
    "page_id": 271,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L022-صرط-1-w3-a142-t20",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L022-صرط-1-a142-t20",
    "original_text": "صِرَٰطٍۢ",
    "page_id": 273,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L026-قيل-1-w2-a170-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L026-قيل-1-a170-t2",
    "original_text": "قِيلَ",
    "page_id": 277,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L032-قيل-1-w2-a206-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L032-قيل-1-a206-t2",
    "original_text": "قِيلَ",
    "page_id": 283,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L033-صرط-1-w3-a213-t48",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L033-صرط-1-a213-t48",
    "original_text": "صِرَٰطٍۢ",
    "page_id": 284,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-002-249-19-r0162-performance-a249-t19",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "r-p041-018-1",
    "original_text": "مِنِّىٓ إِلَّا",
    "page_id": 292,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L044-ارني-1-w3-a260-t5",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L044-ارني-1-a260-t5",
    "original_text": "أَرِنِى",
    "page_id": 295,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L045-ويامركم-1-w3-a268-t4",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L045-ويامركم-1-a268-t4",
    "original_text": "وَيَأْمُرُكُم",
    "page_id": 296,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L046-فنعما-1-w2-a271-t4",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L046-فنعما-1-a271-t4",
    "original_text": "فَنِعِمَّا",
    "page_id": 297,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-003-20-5-r0218-performance-a20-t5",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "r-p052-023-1",
    "original_text": "وَجْهِىَ لِلَّهِ",
    "page_id": 303,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L056-صرط-1-w3-a51-t7",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L056-صرط-1-a51-t7",
    "original_text": "صِرَٰطٌۭ",
    "page_id": 307,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L060-ولا_يامركم-1-w4-a80-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L060-ولا_يامركم-1-a80-t1",
    "original_text": "وَلَا يَأْمُرَكُمْ",
    "page_id": 311,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L060-ايامركم-1-w3-a80-t8",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L060-ايامركم-1-a80-t8",
    "original_text": "أَيَأْمُرُكُم",
    "page_id": 311,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L063-صراط-1-w3-a101-t16",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L063-صراط-1-a101-t16",
    "original_text": "صِرَٰطٍۢ",
    "page_id": 314,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L071-ينصركم-2-w3-a160-t12",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L071-ينصركم-2-a160-t12",
    "original_text": "يَنصُرُكُم",
    "page_id": 322,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L072-وقيل-1-w2-a167-t4",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L072-وقيل-1-a167-t4",
    "original_text": "وَقِيلَ",
    "page_id": 323,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-003-169-2-0293-performance-a169-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-003-169-002-169-002",
    "original_text": "تَحْسَبَنَّ",
    "page_id": 323,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-004-43-22-r0360-performance-a43-t22",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: IMALAH_TAQLIL",
    "locus_id": "r-p085-011-1",
    "original_text": "مَّرْضَىٰٓ",
    "page_id": 336,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L087-نعما-1-w2-a58-t18",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L087-نعما-1-a58-t18",
    "original_text": "نِعِمَّا",
    "page_id": 338,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L088-قيل-1-w2-a61-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L088-قيل-1-a61-t2",
    "original_text": "قِيلَ",
    "page_id": 339,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L089-صرطا-1-w3-a68-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L089-صرطا-1-a68-t2",
    "original_text": "صِرَٰطًۭا",
    "page_id": 340,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L090-قيل-1-w2-a77-t5",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L090-قيل-1-a77-t5",
    "original_text": "قِيلَ",
    "page_id": 341,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L092-اصدق-1-w2-a87-t14",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L092-اصدق-1-a87-t14",
    "original_text": "أَصْدَقُ",
    "page_id": 343,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L098-اصدق-1-w2-a122-t18",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L098-اصدق-1-a122-t18",
    "original_text": "أَصْدَقُ",
    "page_id": 349,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-004-136-14-0469-performance-a136-t14",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-004-136-014-136-014",
    "original_text": "أَنزَلَ",
    "page_id": 351,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-004-140-2-0474-performance-a140-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-004-140-002-140-002",
    "original_text": "نَزَّلَ",
    "page_id": 351,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L102-ارنا-1-w3-a153-t17",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L102-ارنا-1-a153-t17",
    "original_text": "أَرِنَا",
    "page_id": 353,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L102-لا_تعدوا-1-w2-a154-t12",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L102-لا_تعدوا-1-a154-t12",
    "original_text": "لَا تَعْدُوا۟",
    "page_id": 353,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L105-صراطا-1-w3-a175-t14",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L105-صراطا-1-a175-t14",
    "original_text": "صِرَٰطًۭا",
    "page_id": 356,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L110-صراط-1-w3-a16-t17",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L110-صراط-1-a16-t17",
    "original_text": "صِرَٰطٍۢ",
    "page_id": 361,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-005-28-12-0555-performance-a28-t12",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "r-p112-021-1",
    "original_text": "إِنِّىٓ أَخَافُ",
    "page_id": 363,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-005-45-15-0579-performance-a45-t15",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-005-045-015-045-015",
    "original_text": "وَٱلْجُرُوحَ",
    "page_id": 366,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L125-قيل-1-w2-a104-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L125-قيل-1-a104-t2",
    "original_text": "قِيلَ",
    "page_id": 376,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-006-23-4-0704-performance-a23-t4",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-006-023-004-023-004",
    "original_text": "فِتْنَتُهُمْ",
    "page_id": 381,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L132-صرط-1-w3-a39-t16",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L132-صرط-1-a39-t16",
    "original_text": "صِرَٰطٍۢ",
    "page_id": 383,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L133-يصدفون-1-w2-a46-t23",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L133-يصدفون-1-a46-t23",
    "original_text": "يَصْدِفُونَ",
    "page_id": 384,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-006-64-3-0748-performance-a64-t3",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-006-064-003-064-003",
    "original_text": "يُنَجِّيكُم",
    "page_id": 386,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L138-صرط-1-w3-a87-t8",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L138-صرط-1-a87-t8",
    "original_text": "صِرَٰطٍۢ",
    "page_id": 389,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-006-109-15-0809-performance-a109-t15",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: TARQIQ_RA",
    "locus_id": "loc-006-109-015-109-016",
    "original_text": "وَمَا يُشْعِرُكُمْ",
    "page_id": 392,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L141-يشعركم-1-w3-a109-t16",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L141-يشعركم-1-a109-t16",
    "original_text": "يُشْعِرُكُمْ",
    "page_id": 392,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-006-115-9-0821-performance-a115-t9",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-006-115-009-115-009",
    "original_text": "وَهُوَ",
    "page_id": 393,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-006-117-9-0823-performance-a117-t9",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-006-117-009-117-009",
    "original_text": "وَهُوَ",
    "page_id": 393,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L144-صرط-1-w3-a126-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L144-صرط-1-a126-t2",
    "original_text": "صِرَٰطُ",
    "page_id": 395,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L149-وان_هذا_صراطي-1-w4-a153-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L149-وان_هذا_صراطي-1-a153-t1",
    "original_text": "وَأَنَّ هَـٰذَا صِرَٰطِى",
    "page_id": 400,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L149-يصدفون-1-w2-a157-t28",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L149-يصدفون-1-a157-t28",
    "original_text": "يَصْدِفُونَ",
    "page_id": 400,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L149-يصدفون-2-w2-a157-t35",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L149-يصدفون-2-a157-t35",
    "original_text": "يَصْدِفُونَ",
    "page_id": 400,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L150-صراط-1-w3-a161-t6",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L150-صراط-1-a161-t6",
    "original_text": "صِرَٰطٍۢ",
    "page_id": 401,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L152-صراطك-1-w3-a16-t6",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L152-صراطك-1-a16-t6",
    "original_text": "صِرَٰطَكَ",
    "page_id": 403,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-007-40-8-0920-performance-a40-t8",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-007-040-008-040-008",
    "original_text": "تُفَتَّحُ",
    "page_id": 406,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L161-صراط-1-w3-a86-t4",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L161-صراط-1-a86-t4",
    "original_text": "صِرَٰطٍۢ",
    "page_id": 412,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L167-ارني-1-w3-a143-t9",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L167-ارني-1-a143-t9",
    "original_text": "أَرِنِىٓ",
    "page_id": 418,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-007-144-3-r0722-performance-a144-t3",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "r-p168-025-1",
    "original_text": "إِنِّى ٱصْطَفَيْتُكَ",
    "page_id": 419,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L171-قيل-1-w2-a161-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L171-قيل-1-a161-t2",
    "original_text": "قِيلَ",
    "page_id": 422,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L171-قيل-2-w2-a162-t8",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L171-قيل-2-a162-t8",
    "original_text": "قِيلَ",
    "page_id": 422,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-008-11-3-1134-performance-a11-t3",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-008-011-003-011-003",
    "original_text": "ٱلنُّعَاسَ",
    "page_id": 429,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-008-18-5-1142-performance-a18-t5",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-008-018-005-018-005",
    "original_text": "كَيْدِ",
    "page_id": 430,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L181-وتصديه-1-w2-a35-t8",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L181-وتصديه-1-a35-t8",
    "original_text": "وَتَصْدِيَةًۭ ۚ",
    "page_id": 432,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L193-قيل-1-w2-a38-t7",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L193-قيل-1-a38-t7",
    "original_text": "قِيلَ",
    "page_id": 628,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L194-وقيل-1-w2-a46-t12",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L194-وقيل-1-a46-t12",
    "original_text": "وَقِيلَ",
    "page_id": 629,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-009-98-13-1286-performance-a98-t13",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "r-p202-007-1",
    "original_text": "ٱلسَّوْءِ ۗ",
    "page_id": 637,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-009-110-11-1303-performance-a110-t11",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-009-110-011-110-011",
    "original_text": "تَقَطَّعَ",
    "page_id": 639,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L211-صرط-1-w3-a25-t10",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L211-صرط-1-a25-t10",
    "original_text": "صِرَٰطٍۢ",
    "page_id": 850,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-010-31-14-1364-performance-a31-t14",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: AMBIGUOUS",
    "locus_id": "loc-010-031-014-031-015",
    "original_text": "مِنَ ٱلْمَيِّتِ",
    "page_id": 851,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L213-تصديق-1-w2-a37-t11",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L213-تصديق-1-a37-t11",
    "original_text": "تَصْدِيقَ",
    "page_id": 852,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L214-قيل-1-w2-a52-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L214-قيل-1-a52-t2",
    "original_text": "قِيلَ",
    "page_id": 853,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-011-3-20-r0921-performance-a3-t20",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "r-p221-027-1",
    "original_text": "فَإِنِّىٓ أَخَافُ",
    "page_id": 860,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-011-10-10-r0924-performance-a10-t10",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "r-p222-026-1",
    "original_text": "عَنِّىٓ ۚ إِنَّهُۥ",
    "page_id": 861,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-011-26-6-r0932-performance-a26-t6",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "r-p224-018-1",
    "original_text": "إِنِّىٓ أَخَافُ",
    "page_id": 863,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-011-31-28-r0938-performance-a31-t28",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "r-p225-028-1",
    "original_text": "إِنِّىٓ إِذًۭا",
    "page_id": 1088,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-011-34-3-1475-performance-a34-t3",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "r-p225-029-1",
    "original_text": "نُصْحِىٓ إِنْ",
    "page_id": 1088,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-011-40-11-1480-performance-a40-t11",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-011-040-011-040-011",
    "original_text": "كُلٍّۢ",
    "page_id": 1089,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L226-وقيل-1-w2-a44-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L226-وقيل-1-a44-t1",
    "original_text": "وَقِيلَ",
    "page_id": 1089,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L226-وغيض-1-w2-a44-t7",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L226-وغيض-1-a44-t7",
    "original_text": "وَغِيضَ",
    "page_id": 1089,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L226-وقيل-2-w2-a44-t14",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L226-وقيل-2-a44-t14",
    "original_text": "وَقِيلَ",
    "page_id": 1089,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-011-46-18-r0950-performance-a46-t18",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "r-p227-019-1",
    "original_text": "إِنِّىٓ أَعِظُكَ",
    "page_id": 1090,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-011-47-3-r0951-performance-a47-t3",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "r-p227-020-1",
    "original_text": "إِنِّىٓ أَعُوذُ",
    "page_id": 1090,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L227-قيل-1-w2-a48-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L227-قيل-1-a48-t1",
    "original_text": "قِيلَ",
    "page_id": 1090,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L228-صرط-1-w3-a56-t17",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L228-صرط-1-a56-t17",
    "original_text": "صِرَٰطٍۢ",
    "page_id": 1091,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L230-سيء-1-w2-a77-t5",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L230-سيء-1-a77-t5",
    "original_text": "سِىٓءَ",
    "page_id": 1093,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-011-81-19-1528-performance-a81-t19",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "r-p230-027-1",
    "original_text": "ٱمْرَأَتَكَ ۖ",
    "page_id": 1093,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-011-84-18-r0978-performance-a84-t18",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "r-p231-025-1",
    "original_text": "إِنِّىٓ أَرَىٰكُم",
    "page_id": 1094,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-011-84-21-r0978-performance-a84-t21",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "r-p231-026-1",
    "original_text": "وَإِنِّىٓ أَخَافُ",
    "page_id": 1094,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-011-88-29-1538-performance-a88-t29",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "r-p231-027-1",
    "original_text": "تَوْفِيقِىٓ إِلَّا",
    "page_id": 1094,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-011-89-4-r0984-performance-a89-t4",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "r-p232-026-1",
    "original_text": "شِقَاقِىٓ أَن",
    "page_id": 1095,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-011-92-3-r0986-performance-a92-t3",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "r-p232-027-1",
    "original_text": "أَرَهْطِىٓ أَعَزُّ",
    "page_id": 1095,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-012-11-5-r1010-performance-a11-t5",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-012-011-005-011-006",
    "original_text": "لَا تَأْمَ۫نَّا",
    "page_id": 1099,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L236-تمنا-1-w2-a11-t6",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L236-تمنا-1-a11-t6",
    "original_text": "تَأْمَ۫نَّا",
    "page_id": 1099,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-012-53-3-1653-performance-a53-t3",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "r-p242-028-1",
    "original_text": "نَفْسِىٓ ۚ إِنَّ",
    "page_id": 1105,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-012-69-9-r1050-performance-a69-t9",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "r-p243-030-1",
    "original_text": "إِنِّىٓ أَنَا۠",
    "page_id": 1106,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-012-76-26-1678-performance-a76-t26",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-012-076-026-076-026",
    "original_text": "دَرَجَـٰتٍۢ",
    "page_id": 1107,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-012-84-11-1690-performance-a84-t11",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-012-084-011-084-011",
    "original_text": "فَهُوَ",
    "page_id": 3179,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-012-92-9-1696-performance-a92-t9",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-012-092-009-092-009",
    "original_text": "وَهُوَ",
    "page_id": 3180,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-012-96-14-r1063-performance-a96-t14",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "r-p247-YAAT_IDAFA-اني_اعلم-16",
    "original_text": "إِنِّىٓ أَعْلَمُ",
    "page_id": 3181,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-012-98-5-r1065-performance-a98-t5",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "r-p247-YAAT_IDAFA-ربي_انهو-17",
    "original_text": "رَبِّىٓ ۖ إِنَّهُۥ",
    "page_id": 3181,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-012-100-21-r1069-performance-a100-t21",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "r-p247-YAAT_IDAFA-بي_اذ-18",
    "original_text": "بِىٓ إِذْ",
    "page_id": 3181,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-012-110-8-1720-performance-a110-t8",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-012-110-008-110-008",
    "original_text": "كُذِبُوا۟",
    "page_id": 3182,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-012-110-11-1721-performance-a110-t11",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-012-110-011-110-011",
    "original_text": "فَنُجِّىَ",
    "page_id": 3182,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-013-3-1-1727-performance-a3-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-013-003-001-003-001",
    "original_text": "وَهُوَ",
    "page_id": 3183,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-013-13-17-1740-performance-a13-t17",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-013-013-017-013-017",
    "original_text": "وَهُوَ",
    "page_id": 2844,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-013-16-43-1745-performance-a16-t43",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-013-016-043-016-043",
    "original_text": "وَهُوَ",
    "page_id": 2845,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-013-41-14-1774-performance-a41-t14",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-013-041-014-041-014",
    "original_text": "وَهُوَ",
    "page_id": 2848,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L255-صرط-1-w3-a1-t14",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L255-صرط-1-a1-t14",
    "original_text": "صِرَٰطِ",
    "page_id": 2849,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-014-22-15-r1132-performance-a22-t15",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "r-p258-YAAT_IDAFA-لي_عليكم-3",
    "original_text": "لِىَ عَلَيْكُم",
    "page_id": 2852,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-014-31-18-1818-performance-a31-t18",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-014-031-018-031-018",
    "original_text": "بَيْعٌۭ",
    "page_id": 2853,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-014-31-21-1819-performance-a31-t21",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-014-031-021-031-021",
    "original_text": "خِلَـٰلٌ",
    "page_id": 2853,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-014-37-2-r1146-performance-a37-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "r-p260-YAAT_IDAFA-اني_اسكنت-3",
    "original_text": "إِنِّىٓ أَسْكَنتُ",
    "page_id": 2854,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D261-ياتيهم_العذاب-performance1-a44-t4",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: SILAT_HA",
    "locus_id": "D261-ياتيهم_العذاب-a44-t4",
    "original_text": "يَأْتِيهِمُ ٱلْعَذَابُ",
    "page_id": 2855,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-015-8-3-1844-performance-a8-t3",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: AMBIGUOUS",
    "locus_id": "loc-015-008-003-008-003",
    "original_text": "ٱلْمَلَـٰٓئِكَةَ",
    "page_id": 2856,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L264-صراط-1-w3-a41-t3",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L264-صراط-1-a41-t3",
    "original_text": "صِرَٰطٌ",
    "page_id": 2858,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-015-89-2-r1169-performance-a89-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "r-p266-005-1",
    "original_text": "إِنِّىٓ أَنَا",
    "page_id": 2860,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-016-12-7-r1172-performance-a12-t7",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: AMBIGUOUS",
    "locus_id": "loc-016-012-007-012-008",
    "original_text": "وَٱلنُّجُومُ مُسَخَّرَٰتٌۢ",
    "page_id": 2862,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-016-14-1-1878-performance-a14-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-016-014-001-014-001",
    "original_text": "وَهُوَ",
    "page_id": 2862,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-016-17-7-1882-performance-a17-t7",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-016-017-007-017-007",
    "original_text": "تَذَكَّرُونَ",
    "page_id": 2863,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D269-عليهم-performance1-a26-t12",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: SILAT_HA",
    "locus_id": "loc-016-026-012-026-012",
    "original_text": "عَلَيْهِمُ",
    "page_id": 2863,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P272-16-43-7-9653e7fd-a43-t7",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: AMBIGUOUS",
    "locus_id": "AUDIT-P272-16-43-7-9653e7fd-a43-t7",
    "original_text": "يُوحَى إِلَيْهُم",
    "page_id": 2866,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P272-16-43-7-FARSH-a43-t7",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "AUDIT-P272-16-43-7-9653e7fd-a43-t7",
    "original_text": "يُوحَى إِلَيْهِم",
    "page_id": 2866,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P275-16-76-28-8caaca05-a76-t28",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "AUDIT-P275-16-76-28-57e637e6-a76-t28",
    "original_text": "صِرَٰطٍۢ",
    "page_id": 2869,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-016-90-16-1967-performance-a90-t16",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-016-090-016-090-016",
    "original_text": "تَذَكَّرُونَ",
    "page_id": 2871,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D279-لا_يهديهم_الله-performance1-a104-t7",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: SILAT_HA",
    "locus_id": "D279-لا_يهديهم_الله-a104-t7",
    "original_text": "لَا يَهْدِيهِمُ ٱللَّهُ",
    "page_id": 2873,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D280-فمن_اضطر-performance1-a115-t13",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "D280-فمن_اضطر-a115-t13",
    "original_text": "فَمَنِ ٱضْطُرَّ",
    "page_id": 2874,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D281-صراط-w3-a121-t6",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-016-121-006-121-006",
    "original_text": "صِرَٰطٍۢ",
    "page_id": 2875,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-017-56-1-2045-performance-a56-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-017-056-001-056-002",
    "original_text": "قُلِ ٱدْعُوا۟",
    "page_id": 2881,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-017-72-6-2062-performance-a72-t6",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-017-072-006-072-006",
    "original_text": "فَهُوَ",
    "page_id": 2883,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-017-93-15-r1262-performance-a93-t15",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-017-093-015-093-015",
    "original_text": "تُنَزِّلَ",
    "page_id": 2885,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-017-97-4-2082-performance-a97-t4",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-017-097-004-097-004",
    "original_text": "فَهُوَ",
    "page_id": 2886,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D293-عليهم-performance1-a107-t15",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: SILAT_HA",
    "locus_id": "D293-عليهم-a107-t15",
    "original_text": "عَلَيْهِمْ",
    "page_id": 2887,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-017-110-1-2100-performance-a110-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-017-110-001-110-002",
    "original_text": "قُلِ ٱدْعُوا۟",
    "page_id": 2887,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-017-110-4-2101-performance-a110-t4",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-017-110-004-110-005",
    "original_text": "أَوِ ٱدْعُوا۟",
    "page_id": 2887,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D294-عليهم-performance1-a15-t9",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: SILAT_HA",
    "locus_id": "D294-عليهم-a15-t9",
    "original_text": "عَلَيْهِم",
    "page_id": 2888,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D295-فهو-performance1-a17-t26",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "D295-فهو-a17-t26",
    "original_text": "فَهُوَ",
    "page_id": 2889,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D295-وتحسبهم-performance2-a18-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "D295-وتحسبهم-a18-t1",
    "original_text": "وَتَحْسَبُهُمْ",
    "page_id": 2889,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-018-22-16-r1286-performance-a22-t16",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "loc-018-022-016-022-017",
    "original_text": "رَّبِّىٓ أَعْلَمُ",
    "page_id": 2890,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-018-37-4-2143-performance-a37-t4",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-018-037-004-037-004",
    "original_text": "وَهُوَ",
    "page_id": 2892,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-018-38-7-r1295-performance-a38-t7",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "r-p298-YAAT_IDAFA-بربي_احدا-6",
    "original_text": "بِرَبِّىٓ أَحَدًۭا",
    "page_id": 2892,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-018-40-2-r1298-performance-a40-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "r-p298-YAAT_IDAFA-ربي_ان-7",
    "original_text": "رَبِّىٓ أَن",
    "page_id": 2892,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-018-42-2-2150-performance-a42-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-018-042-002-042-002",
    "original_text": "بِثَمَرِهِۦ",
    "page_id": 2892,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-018-42-18-r1302-performance-a42-t18",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "loc-018-042-018-042-019",
    "original_text": "بِرَبِّىٓ أَحَدًۭا",
    "page_id": 2892,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-018-47-3-2158-performance-a47-t3",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-018-047-003-047-003",
    "original_text": "ٱلْجِبَالَ",
    "page_id": 2893,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-018-67-5-r1327-performance-a67-t5",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "r-p301-YAAT_IDAFA-معي_صبرا-1",
    "original_text": "مَعِىَ صَبْرًۭا",
    "page_id": 2895,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-018-72-7-r1329-performance-a72-t7",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "loc-018-072-007-072-008",
    "original_text": "مَعِىَ صَبْرًۭا",
    "page_id": 2895,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-018-75-8-r1332-performance-a75-t8",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "r-p302-YAAT_IDAFA-معي_صبرا-0",
    "original_text": "مَعِىَ صَبْرًۭا",
    "page_id": 2896,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-018-85-1-2206-performance-a85-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-018-085-001-085-001",
    "original_text": "فَأَتْبَعَ",
    "page_id": 2897,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-018-89-2-2210-performance-a89-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-018-089-002-089-002",
    "original_text": "أَتْبَعَ",
    "page_id": 2897,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-018-92-2-2212-performance-a92-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-018-092-002-092-002",
    "original_text": "أَتْبَعَ",
    "page_id": 2897,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-018-96-8-2215-performance-a96-t8",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-018-096-008-096-008",
    "original_text": "ٱلصَّدَفَيْنِ",
    "page_id": 2897,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-019-6-2-2233-performance-a6-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-019-006-002-006-002",
    "original_text": "وَيَرِثُ",
    "page_id": 2899,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-019-10-4-r1357-performance-a10-t4",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "loc-019-010-004-010-005",
    "original_text": "لِّىٓ ءَايَةًۭ ۚ",
    "page_id": 2899,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-019-18-2-r1359-performance-a18-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "r-p306-007-1",
    "original_text": "إِنِّىٓ أَعُوذُ",
    "page_id": 2900,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L306-تساقط-1-w2-a25-t5",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L306-تساقط-1-a25-t5",
    "original_text": "تَسَٰقَطْ",
    "page_id": 2900,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L306-تساقط-1-w3-a25-t5",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L306-تساقط-1-a25-t5",
    "original_text": "تَسَّاقَطْ",
    "page_id": 2900,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D307-وان_الله-w1-a36-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "D307-وان_الله-a36-t1",
    "original_text": "وَإِنَّ ٱللَّهَ",
    "page_id": 2901,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L307-صراط-1-w3-a36-t7",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L307-صراط-1-a36-t7",
    "original_text": "صِرَٰطٌۭ",
    "page_id": 2901,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L308-صراطا-1-w3-a43-t12",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L308-صراطا-1-a43-t12",
    "original_text": "صِرَٰطًۭا",
    "page_id": 2902,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-019-45-2-r1377-performance-a45-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "r-p308-011-1",
    "original_text": "إِنِّىٓ أَخَافُ",
    "page_id": 2902,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-019-47-6-r1378-performance-a47-t6",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "r-p308-019-1",
    "original_text": "رَبِّىٓ ۖ إِنَّهُۥ",
    "page_id": 2902,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D310-مت-w1-a66-t5",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "D310-مت-a66-t5",
    "original_text": "مِتُّ",
    "page_id": 2904,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D310-يذكر-w1-a67-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "D310-يذكر-a67-t2",
    "original_text": "يَذْكُرُ",
    "page_id": 2904,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D310-جثيا-w1-a68-t8",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: AMBIGUOUS",
    "locus_id": "D310-جثيا-a68-t8",
    "original_text": "جِثِيًّۭا",
    "page_id": 2904,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-020-14-1-r1400-performance-a14-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "r-p313-002-1",
    "original_text": "إِنَّنِىٓ أَنَا",
    "page_id": 2907,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-020-18-10-r1401-performance-a18-t10",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "r-p313-013-1",
    "original_text": "وَلِىَ فِيهَا",
    "page_id": 2907,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-020-69-5-2397-performance-a69-t5",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-020-069-005-069-005",
    "original_text": "تَلْقَفْ",
    "page_id": 2910,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L321-الصراط_السوي-1-w3-a135-t8",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L321-الصراط_السوي-1-a135-t8",
    "original_text": "ٱلصِّرَٰطِ ٱلسَّوِىِّ",
    "page_id": 2915,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-022-19-16-2556-performance-a19-t16",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-022-019-016-019-017",
    "original_text": "رُءُوسِهِمُ ٱلْحَمِيمُ",
    "page_id": 2928,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D335-صراط-ishmam-a24-t8",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "r-p335-001-1",
    "original_text": "صِرَٰطِ",
    "page_id": 2929,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D343-نسقيكم-performance1-a21-t6",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "D343-نسقيكم-a21-t6",
    "original_text": "نُّسْقِيكُم",
    "page_id": 2937,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-023-27-16-2627-performance-a27-t16",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-023-027-016-027-016",
    "original_text": "كُلٍّۢ",
    "page_id": 2937,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L346-صرط-1-w3-a73-t4",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L346-صرط-1-a73-t4",
    "original_text": "صِرَٰطٍۢ",
    "page_id": 2940,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L346-الصرط-1-w3-a74-t7",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L346-الصرط-1-a74-t7",
    "original_text": "ٱلصِّرَٰطِ",
    "page_id": 2940,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-023-85-5-2665-performance-a85-t5",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L347-تذكرون-1-a85-t5",
    "original_text": "تَذَكَّرُونَ",
    "page_id": 2941,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-024-11-8-2696-performance-a11-t8",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-024-011-008-011-008",
    "original_text": "تَحْسَبُوهُ",
    "page_id": 2945,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-024-15-13-2706-performance-a15-t13",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-024-015-013-015-013",
    "original_text": "وَهُوَ",
    "page_id": 2945,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-024-27-18-2722-performance-a27-t18",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-024-027-018-027-018",
    "original_text": "تَذَكَّرُونَ",
    "page_id": 2946,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L353-قيل-1-w2-a28-t12",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L353-قيل-1-a28-t12",
    "original_text": "قِيلَ",
    "page_id": 2947,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-024-43-38-r1590-performance-a43-t38",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: IMALAH_TAQLIL",
    "locus_id": "r-p355-017-1",
    "original_text": "بِٱلْأَبْصَـٰرِ",
    "page_id": 2949,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D357-عليهم-performance2-a58-t34",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: SILAT_HA",
    "locus_id": "loc-024-058-034-058-034",
    "original_text": "عَلَيْهِمْ",
    "page_id": 2951,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D358-عليهن-performance1-a60-t9",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: SILAT_HA",
    "locus_id": "loc-024-060-009-060-009",
    "original_text": "عَلَيْهِنَّ",
    "page_id": 2952,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-025-48-1-2824-performance-a48-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-025-048-001-048-001",
    "original_text": "وَهُوَ",
    "page_id": 2958,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-025-53-1-2829-performance-a53-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-025-053-001-053-001",
    "original_text": "۞ وَهُوَ",
    "page_id": 2958,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-025-54-1-2830-performance-a54-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-025-054-001-054-001",
    "original_text": "وَهُوَ",
    "page_id": 2958,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-025-62-1-2835-performance-a62-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-025-062-001-062-001",
    "original_text": "وَهُوَ",
    "page_id": 2959,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-026-9-3-2846-performance-a9-t3",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-026-009-003-009-003",
    "original_text": "لَهُوَ",
    "page_id": 2961,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-026-12-3-r1635-performance-a12-t3",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "loc-026-012-003-012-004",
    "original_text": "إِنِّىٓ أَخَافُ",
    "page_id": 2961,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-026-68-3-2888-performance-a68-t3",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-026-068-003-068-003",
    "original_text": "لَهُوَ",
    "page_id": 2964,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-026-77-3-r1655-performance-a77-t3",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "loc-026-077-003-077-004",
    "original_text": "لِّىٓ إِلَّا",
    "page_id": 2964,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-026-78-3-2893-performance-a78-t3",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-026-078-003-078-003",
    "original_text": "فَهُوَ",
    "page_id": 2964,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-026-80-3-2894-performance-a80-t3",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-026-080-003-080-003",
    "original_text": "فَهُوَ",
    "page_id": 2964,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-026-104-3-2902-performance-a104-t3",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-026-104-003-104-003",
    "original_text": "لَهُوَ",
    "page_id": 2965,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-026-122-3-2910-performance-a122-t3",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-026-122-003-122-003",
    "original_text": "لَهُوَ",
    "page_id": 2966,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D373-لهو-1-a140-t3",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-026-140-003-140-003",
    "original_text": "لَهْوَ",
    "page_id": 2967,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D373-لهو-2-a159-t3",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-026-159-003-159-003",
    "original_text": "لَهْوَ",
    "page_id": 2967,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D374-لهو-1-a175-t3",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-026-175-003-175-003",
    "original_text": "لَهْوَ",
    "page_id": 2968,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D374-اصحاب-الايكة-a176-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: غير متاح",
    "locus_id": "loc-026-176-002-176-003",
    "original_text": "أَصْحَـٰبُ لْـَٔيْكَةِ",
    "page_id": 2968,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D375-لهو-1-a191-t3",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-026-191-003-191-003",
    "original_text": "لَهْوَ",
    "page_id": 2969,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D376-تنزل-1-a221-t5",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: غير متاح",
    "locus_id": "loc-026-221-005-221-005",
    "original_text": "تَّنَزَّلُ",
    "page_id": 2970,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D376-تنزل-2-a222-t5",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: غير متاح",
    "locus_id": "loc-026-222-005-222-005",
    "original_text": "تَّنَزَّلُ",
    "page_id": 2970,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-027-7-5-r1676-performance-a7-t5",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "r-p377-YAAT_IDAFA-اني_ءانست-5",
    "original_text": "إِنِّىٓ ءَانَسْتُ",
    "page_id": 2971,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-027-16-16-2959-performance-a16-t16",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-027-016-016-016-016",
    "original_text": "لَهُوَ",
    "page_id": 2972,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-027-22-1-2965-performance-a22-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-027-022-001-022-001",
    "original_text": "فَمَكَثَ",
    "page_id": 2972,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-027-78-6-3019-performance-a78-t6",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-027-078-006-078-006",
    "original_text": "وَهُوَ",
    "page_id": 2978,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-027-82-11-3023-performance-a82-t11",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-027-082-011-082-011",
    "original_text": "أَنَّ",
    "page_id": 2978,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-027-88-3-3029-performance-a88-t3",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-027-088-003-088-003",
    "original_text": "تَحْسَبُهَا",
    "page_id": 2978,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-027-88-5-3030-performance-a88-t5",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-027-088-005-088-005",
    "original_text": "وَهِىَ",
    "page_id": 2978,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-027-89-9-3032-performance-a89-t9",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-027-089-009-089-010",
    "original_text": "فَزَعٍۢ يَوْمَئِذٍ",
    "page_id": 2979,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-028-23-12-3058-performance-a23-t12",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-028-023-012-023-014",
    "original_text": "مِن دُونِهِمُ ٱمْرَأَتَيْنِ",
    "page_id": 2982,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-028-56-11-3112-performance-a56-t11",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-028-056-011-056-011",
    "original_text": "وَهُوَ",
    "page_id": 2986,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-028-61-5-3117-performance-a61-t5",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-028-061-005-061-005",
    "original_text": "فَهُوَ",
    "page_id": 2987,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-028-66-2-3121-performance-a66-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-028-066-002-066-003",
    "original_text": "عَلَيْهِمُ ٱلْأَنۢبَآءُ",
    "page_id": 2987,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-028-70-1-3124-performance-a70-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-028-070-001-070-001",
    "original_text": "وَهُوَ",
    "page_id": 2987,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-028-78-6-r1781-performance-a78-t6",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "r-p395-YAAT_IDAFA-عندي_اولم-5",
    "original_text": "عِندِىٓ ۚ أَوَلَمْ",
    "page_id": 2989,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-028-78-27-3133-performance-a78-t27",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-028-078-027-078-028",
    "original_text": "ذُنُوبِهِمُ ٱلْمُجْرِمُونَ",
    "page_id": 2989,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-028-82-21-r1785-performance-a82-t21",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-028-082-021-082-021",
    "original_text": "لَخَسَفَ",
    "page_id": 2989,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-028-85-10-r1786-performance-a85-t10",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "loc-028-085-010-085-011",
    "original_text": "رَّبِّىٓ أَعْلَمُ",
    "page_id": 2990,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L399-s29a25b0-w2-a25-t8",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L399-s29a25b0-a25-t8",
    "original_text": "مَوَدَّةَ بَيْنِكُمْ",
    "page_id": 2993,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L399-s29a25b0-w3-a25-t8",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: AMBIGUOUS",
    "locus_id": "L399-s29a25b0-a25-t8",
    "original_text": "مَوَدَّةً بَيْنَكُمْ",
    "page_id": 2993,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-029-26-8-r1795-performance-a26-t8",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "loc-029-026-008-026-009",
    "original_text": "رَبِّىٓ ۖ إِنَّهُۥ",
    "page_id": 2993,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-029-31-3-3169-performance-a31-t3",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-029-031-003-031-003",
    "original_text": "رُسُلُنَآ",
    "page_id": 2994,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-029-33-4-3172-performance-a33-t4",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-029-033-004-033-004",
    "original_text": "رُسُلُنَا",
    "page_id": 2994,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-029-42-10-3181-performance-a42-t10",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-029-042-010-042-010",
    "original_text": "وَهُوَ",
    "page_id": 2995,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-029-60-10-3198-performance-a60-t10",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-029-060-010-060-010",
    "original_text": "وَهُوَ",
    "page_id": 2997,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-029-64-11-3203-performance-a64-t11",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-029-064-011-064-011",
    "original_text": "لَهِىَ",
    "page_id": 2998,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-030-5-6-3212-performance-a5-t6",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-030-005-006-005-006",
    "original_text": "وَهُوَ",
    "page_id": 2998,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-030-19-3-3219-performance-a19-t3",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: AMBIGUOUS",
    "locus_id": "loc-030-019-003-019-004",
    "original_text": "مِنَ ٱلْمَيِّتِ",
    "page_id": 3000,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D407-وهو-1-a27-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: غير متاح",
    "locus_id": "loc-030-027-001-027-001",
    "original_text": "وَهْوَ",
    "page_id": 3001,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D407-وهو-2-a27-t7",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: غير متاح",
    "locus_id": "loc-030-027-007-027-007",
    "original_text": "وَهْوَ",
    "page_id": 3001,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D407-وهو-3-a27-t16",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: غير متاح",
    "locus_id": "loc-030-027-016-027-016",
    "original_text": "وَهْوَ",
    "page_id": 3001,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D408-فهو-a35-t5",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: غير متاح",
    "locus_id": "loc-030-035-005-035-005",
    "original_text": "فَهْوَ",
    "page_id": 3002,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-030-50-15-3245-performance-a50-t15",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-030-050-015-050-015",
    "original_text": "وَهُوَ",
    "page_id": 3003,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-030-54-22-3252-performance-a54-t22",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-030-054-022-054-022",
    "original_text": "وَهُوَ",
    "page_id": 3004,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-031-9-6-3263-performance-a9-t6",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-031-009-006-009-006",
    "original_text": "وَهُوَ",
    "page_id": 3005,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-031-13-5-3267-performance-a13-t5",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-031-013-005-013-005",
    "original_text": "وَهُوَ",
    "page_id": 3006,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-031-13-7-r1861-performance-a13-t7",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "loc-031-013-007-013-007",
    "original_text": "يَـٰبُنَىَّ",
    "page_id": 3006,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-031-16-1-r1864-performance-a16-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "loc-031-016-001-016-001",
    "original_text": "يَـٰبُنَىَّ",
    "page_id": 3006,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-031-22-6-3278-performance-a22-t6",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-031-022-006-022-006",
    "original_text": "وَهُوَ",
    "page_id": 3007,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-033-4-26-3317-performance-a4-t26",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-033-004-026-004-026",
    "original_text": "وَهُوَ",
    "page_id": 3012,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-033-10-16-3328-performance-a10-t16",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: WAQF_RASM",
    "locus_id": "loc-033-010-016-010-016",
    "original_text": "ٱلظُّنُونَا۠",
    "page_id": 3013,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-033-13-8-3330-performance-a13-t8",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-033-013-008-013-008",
    "original_text": "مُقَامَ",
    "page_id": 3013,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-033-20-1-3337-performance-a20-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-033-020-001-020-001",
    "original_text": "يَحْسَبُونَ",
    "page_id": 3014,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-033-66-11-3389-performance-a66-t11",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: WAQF_RASM",
    "locus_id": "loc-033-066-011-066-011",
    "original_text": "ٱلرَّسُولَا۠",
    "page_id": 3021,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-033-67-8-3390-performance-a67-t8",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: WAQF_RASM",
    "locus_id": "loc-033-067-008-067-008",
    "original_text": "ٱلسَّبِيلَا۠",
    "page_id": 3021,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-034-1-15-3396-performance-a1-t15",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-034-001-015-001-015",
    "original_text": "وَهُوَ",
    "page_id": 3022,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-034-2-16-3398-performance-a2-t16",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-034-002-016-002-016",
    "original_text": "وَهُوَ",
    "page_id": 3022,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L428-s34a3b0-w1-a3-t11",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L428-s34a3b0-a3-t11",
    "original_text": "عَلَّامِ الْغَيْبِ",
    "page_id": 3022,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L428-s34a03-w3-a3-t11",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: AMBIGUOUS",
    "locus_id": "L428-s34a3b0-a3-t11",
    "original_text": "عَالِمِ الْغَيْبِ",
    "page_id": 3022,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-034-5-11-3402-performance-a5-t11",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-034-005-011-005-011",
    "original_text": "أَلِيمٌۭ",
    "page_id": 3022,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-034-17-8-3416-performance-a17-t8",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: AMBIGUOUS",
    "locus_id": "loc-034-017-008-017-008",
    "original_text": "ٱلْكَفُورَ",
    "page_id": 3024,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-034-22-1-3426-performance-a22-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-034-022-001-022-001",
    "original_text": "قُلِ",
    "page_id": 3024,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-034-22-1-r1949-performance-a22-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: AMBIGUOUS",
    "locus_id": "loc-034-022-001-022-002",
    "original_text": "قُلِ ٱدْعُوا۟",
    "page_id": 3024,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-034-23-20-3430-performance-a23-t20",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-034-023-020-023-020",
    "original_text": "وَهُوَ",
    "page_id": 3025,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-034-26-9-3432-performance-a26-t9",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-034-026-009-026-009",
    "original_text": "وَهُوَ",
    "page_id": 3025,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-034-39-16-3444-performance-a39-t16",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-034-039-016-039-016",
    "original_text": "فَهُوَ",
    "page_id": 3026,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-034-39-18-3445-performance-a39-t18",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-034-039-018-039-018",
    "original_text": "وَهُوَ",
    "page_id": 3026,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L434-s34a54b0-w1-a54-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L434-s34a54b0-a54-t1",
    "original_text": "وَحِيلَ",
    "page_id": 3028,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D434-وهو-a2-t17",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-035-002-017-002-017",
    "original_text": "وَهْوَ",
    "page_id": 3028,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-035-9-10-3468-performance-a9-t10",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: AMBIGUOUS",
    "locus_id": "L435-s35a9b1-a9-t10",
    "original_text": "مَّيِّتٍۢ",
    "page_id": 3029,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-035-36-17-3489-performance-a36-t17",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-035-036-017-036-017",
    "original_text": "كُلَّ",
    "page_id": 3032,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D440-صراط-w2-a4-t2-h399e94199d29bd33",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "D440-صراط-a4-t2",
    "original_text": "صِرَٰطٍۢ",
    "page_id": 3034,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-036-5-1-3498-performance-a5-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-036-005-001-005-001",
    "original_text": "تَنزِيلَ",
    "page_id": 3034,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-036-9-8-3501-performance-a9-t8",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-036-009-008-009-008",
    "original_text": "سَدًّۭا",
    "page_id": 3034,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D443-يخصمون-performance1-a49-t8",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-036-049-008-049-008",
    "original_text": "يَخِصِّمُونَ",
    "page_id": 3037,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-037-8-2-3544-performance-a8-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-037-008-002-008-002",
    "original_text": "يَسَّمَّعُونَ",
    "page_id": 3040,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L447-s37a35b0-w1-a35-t4",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L447-s37a35b0-a35-t4",
    "original_text": "قِيلَ",
    "page_id": 3041,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-037-102-11-r2042-performance-a102-t11",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "r-p449-YAAT_IDAFA-اني_اذبحك-8",
    "original_text": "أَنِّىٓ أَذْبَحُكَ",
    "page_id": 3043,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D450-لهو-a106-t3",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: غير متاح",
    "locus_id": "loc-037-106-003-106-003",
    "original_text": "لَهْوَ",
    "page_id": 3044,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D450-صراط-اشمام-a118-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: غير متاح",
    "locus_id": "loc-037-118-002-118-002",
    "original_text": "ٱلصِّرَٰطَ",
    "page_id": 3044,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-037-126-2-3588-performance-a126-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-037-126-002-126-002",
    "original_text": "رَبَّكُمْ",
    "page_id": 3044,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-037-126-3-3589-performance-a126-t3",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-037-126-003-126-003",
    "original_text": "وَرَبَّ",
    "page_id": 3044,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-038-23-8-r2062-performance-a23-t8",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "r-p454-YAAT_IDAFA-ولي_نعجه-6",
    "original_text": "وَلِىَ نَعْجَةٌۭ",
    "page_id": 3048,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-038-63-1-3634-performance-a63-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: AMBIGUOUS",
    "locus_id": "loc-038-063-001-063-001",
    "original_text": "أَتَّخَذْنَـٰهُمْ",
    "page_id": 3051,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D457-سخريا-performance1-a63-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-038-063-002-063-002",
    "original_text": "سِخْرِيًّا",
    "page_id": 3051,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-038-83-4-3642-performance-a83-t4",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-038-083-004-083-004",
    "original_text": "ٱلْمُخْلَصِينَ",
    "page_id": 3051,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-039-13-2-r2098-performance-a13-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "r-p460-YAAT_IDAFA-اني_اخاف-8",
    "original_text": "إِنِّىٓ أَخَافُ",
    "page_id": 3054,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D461-وقيل-w2-DOCX-P461-R02673-a24-t8",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "D461-وقيل-DOCX-P461-R02673-a24-t8",
    "original_text": "وَقِيلَ",
    "page_id": 3055,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-039-73-11-r2126-performance-a73-t11",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: AMBIGUOUS",
    "locus_id": "loc-039-073-011-073-011",
    "original_text": "وَفُتِحَتْ",
    "page_id": 3060,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-040-26-8-r2141-performance-a26-t8",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "r-p470-YAAT_IDAFA-اني_اخاف-9",
    "original_text": "إِنِّىٓ أَخَافُ",
    "page_id": 3064,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-040-30-5-r2147-performance-a30-t5",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "loc-040-030-005-030-006",
    "original_text": "إِنِّىٓ أَخَافُ",
    "page_id": 3064,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-040-32-2-r2148-performance-a32-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "loc-040-032-002-032-003",
    "original_text": "إِنِّىٓ أَخَافُ",
    "page_id": 3064,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-040-35-21-3754-performance-a35-t21",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-040-035-021-035-021",
    "original_text": "قَلْبِ",
    "page_id": 3065,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-041-16-7-3826-performance-a16-t7",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-041-016-007-016-007",
    "original_text": "نَّحِسَاتٍۢ",
    "page_id": 3072,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D480-عليهم-performance1-a30-t9",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: SILAT_HA",
    "locus_id": "loc-041-030-009-030-009",
    "original_text": "عَلَيْهِمُ",
    "page_id": 3074,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-041-50-19-r2216-performance-a50-t19",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "r-p482-YAAT_IDAFA-ربي_ان-3",
    "original_text": "رَبِّىٓ إِنَّ",
    "page_id": 3076,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-042-9-9-3871-performance-a9-t9",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-042-009-009-009-009",
    "original_text": "وَهُوَ",
    "page_id": 3077,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-042-9-12-3871-performance-a9-t12",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-042-009-012-009-012",
    "original_text": "وَهُوَ",
    "page_id": 3077,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-042-28-1-3895-performance-a28-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-042-028-001-028-001",
    "original_text": "وَهُوَ",
    "page_id": 3080,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-042-28-11-3895-performance-a28-t11",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-042-028-011-028-011",
    "original_text": "وَهُوَ",
    "page_id": 3080,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-042-29-11-3898-performance-a29-t11",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-042-029-011-029-011",
    "original_text": "وَهُوَ",
    "page_id": 3080,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P487-42-35-1-DOCX-P487-R02908-a35-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "AUDIT-P487-42-35-1-DOCX-P487-R02908-a35-t1",
    "original_text": "وَيَعْلَمَ",
    "page_id": 3081,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P487-42-41-7-DOCX-P487-R02910-a41-t7",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: SILAT_HA",
    "locus_id": "AUDIT-P487-42-41-7-DOCX-P487-R02910-a41-t7",
    "original_text": "عَلَيْهِم",
    "page_id": 3081,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P488-42-45-19-DOCX-P488-R02918-a45-t19",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: SILAT_HA",
    "locus_id": "AUDIT-P488-42-45-19-DOCX-P488-R02918-a45-t19",
    "original_text": "وَأَهْلِيهُمُ",
    "page_id": 3082,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P488-42-48-5-DOCX-P488-R02919-a48-t5",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: SILAT_HA",
    "locus_id": "AUDIT-P488-42-48-5-DOCX-P488-R02919-a48-t5",
    "original_text": "عَلَيْهِمْ",
    "page_id": 3082,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P488-42-48-24-DOCX-P488-R02918-a48-t24",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: SILAT_HA",
    "locus_id": "AUDIT-P488-42-48-24-DOCX-P488-R02918-a48-t24",
    "original_text": "أَيْدِيهُمُ",
    "page_id": 3082,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P489-42-52-26-DOCX-P489-R02924-a52-t26-h76242e7d6c06a7db",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: AMBIGUOUS",
    "locus_id": "AUDIT-P489-42-52-26-DOCX-P489-R02924-a52-t26",
    "original_text": "سِرَٰطٍ",
    "page_id": 3083,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P489-42-52-26-DOCX-P489-R02924-a52-t26-hba7662722d33e5d5",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "AUDIT-P489-42-52-26-DOCX-P489-R02924-a52-t26",
    "original_text": "صِرَٰطٍۢ",
    "page_id": 3083,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P489-42-53-1-DOCX-P489-R02924-a53-t1-h5a48bd831ea66503",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "AUDIT-P489-42-53-1-DOCX-P489-R02924-a53-t1",
    "original_text": "صِرَٰطِ",
    "page_id": 3083,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P489-43-4-2-DOCX-P489-R02927-a4-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "AUDIT-P489-43-4-2-DOCX-P489-R02927-a4-t2",
    "original_text": "فِىٓ أُمِّ",
    "page_id": 3083,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P489-43-5-5-DOCX-P489-R02928-a5-t5",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "AUDIT-P489-43-5-5-DOCX-P489-R02928-a5-t5",
    "original_text": "أَن كُنتُمْ",
    "page_id": 3083,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P489-43-7-2-DOCX-P489-R02930-a7-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: SILAT_HA",
    "locus_id": "AUDIT-P489-43-7-2-DOCX-P489-R02930-a7-t2",
    "original_text": "يَأْتِيهِم",
    "page_id": 3083,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P490-43-15-5-DOCX-P490-R02936-a15-t5-hf8d1442d4ad8ed4d",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: AMBIGUOUS",
    "locus_id": "AUDIT-P490-43-15-5-DOCX-P490-R02936-a15-t5",
    "original_text": "جُزُءًا",
    "page_id": 3084,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P490-43-17-11-DOCX-P490-R02937-a17-t11",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "AUDIT-P490-43-17-11-DOCX-P490-R02937-a17-t11",
    "original_text": "وَهُوَ",
    "page_id": 3084,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P490-43-18-5-DOCX-P490-R02937-a18-t5",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "AUDIT-P490-43-18-5-DOCX-P490-R02937-a18-t5",
    "original_text": "وَهُوَ",
    "page_id": 3084,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-043-33-12-3926-performance-a33-t12",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-043-033-012-033-012",
    "original_text": "سُقُفًۭا",
    "page_id": 3085,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-043-35-5-3927-performance-a35-t5",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-043-035-005-035-005",
    "original_text": "لَمَّا",
    "page_id": 3086,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-043-36-9-r2262-performance-a36-t9",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-043-036-009-036-009",
    "original_text": "فَهُوَ",
    "page_id": 3086,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-043-37-5-r2263-performance-a37-t5",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: AMBIGUOUS",
    "locus_id": "loc-043-037-005-037-005",
    "original_text": "وَيَحْسَبُونَ",
    "page_id": 3086,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-043-45-7-3932-performance-a45-t7",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-043-045-007-045-007",
    "original_text": "رُّسُلِنَآ",
    "page_id": 3086,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-044-19-6-r2290-performance-a19-t6",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "r-p497-YAAT_IDAFA-اني_ءاتيكم-5",
    "original_text": "إِنِّىٓ ءَاتِيكُم",
    "page_id": 3091,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P499-DOCX-P499-R03033-7-83beaf94-a9-t7",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: TAGHYIR_HAMZ",
    "locus_id": "AUDIT-P499-DOCX-P499-R03033-7-83beaf94-a9-t7",
    "original_text": "هُزُوًا",
    "page_id": 3093,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-045-23-24-3994-performance-a23-t24",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "AUDIT-P501-DOCX-P501-R03049-24-d3cb81eb-a23-t24",
    "original_text": "تَذَكَّرُونَ",
    "page_id": 3095,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P501-DOCX-P501-R03050-3-95ec0da8-a25-t3",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: SILAT_HA",
    "locus_id": "AUDIT-P501-DOCX-P501-R03050-3-95ec0da8-a25-t3",
    "original_text": "عَلَيْهِمْ",
    "page_id": 3095,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P501-DOCX-P501-R03052-2-8a33ee81-a32-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "AUDIT-P501-DOCX-P501-R03052-2-8a33ee81-a32-t2",
    "original_text": "قِيلَ",
    "page_id": 3095,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P502-DOCX-P502-R03066-11-0e95b58f-a33-t11",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: TAGHYIR_HAMZ",
    "locus_id": "AUDIT-P502-DOCX-P502-R03066-11-0e95b58f-a33-t11",
    "original_text": "يَسْتَهْزِءُونَ",
    "page_id": 3096,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P502-DOCX-P502-R03059-1-e94d01d3-a34-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "AUDIT-P502-DOCX-P502-R03059-1-e94d01d3-a34-t1",
    "original_text": "وَقِيلَ",
    "page_id": 3096,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P502-DOCX-P502-R03060-6-83beaf94-a35-t6",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: TAGHYIR_HAMZ",
    "locus_id": "AUDIT-P502-DOCX-P502-R03060-6-69a3a95a-a35-t6",
    "original_text": "هُزُوًا",
    "page_id": 3096,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P502-DOCX-P502-R03062-6-2457b9b3-a37-t6",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "AUDIT-P502-DOCX-P502-R03062-6-2457b9b3-a37-t6",
    "original_text": "وَهُوَ",
    "page_id": 3096,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P503-R03068-8-23-a8-t23",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "v-AUDIT-P503-R03068-8-23-a8-t23",
    "original_text": "وَهُوَ",
    "page_id": 3097,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P503-R03069-9-20-a9-t20",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: WAQF_RASM",
    "locus_id": "v-AUDIT-P503-R03069-9-20-a9-t20",
    "original_text": "وَمَآ أَنَا۠ إِلَّا",
    "page_id": 3097,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P503-R03072-13-8-a13-t8-h85b47de0fec52d24",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: SILAT_HA",
    "locus_id": "v-AUDIT-P503-R03072-13-8-a13-t8",
    "original_text": "فَلَا خَوْفٌ عَلَيْهُمُ",
    "page_id": 3097,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P503-R03072-13-8-a13-t8-h7e5568b43b0c74f2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "v-AUDIT-P503-R03072-13-8-a13-t8",
    "original_text": "فَلَا خَوْفَ عَلَيْهِم",
    "page_id": 3097,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-046-15-9-4014-performance-a15-t9",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-046-015-009-015-009",
    "original_text": "كُرْهًۭا ۖ",
    "page_id": 3098,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P504-R03083-17-4-a17-t4-hf8647f2bad90c190",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "v-AUDIT-P504-R03083-17-4-a17-t4",
    "original_text": "أُفٍّ",
    "page_id": 3098,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P504-R03083-17-4-a17-t4-ha1c6531093982d70",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "v-AUDIT-P504-R03083-17-4-a17-t4",
    "original_text": "أُفَّ",
    "page_id": 3098,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P504-R03085-18-4-a18-t4-h1eebd3e6a196fa8e",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: SILAT_HA",
    "locus_id": "v-AUDIT-P504-R03085-18-4-a18-t4",
    "original_text": "عَلَيْهُمُ ٱلْقَوْلُ",
    "page_id": 3098,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-046-21-20-r2323-performance-a21-t20",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "r-p505-YAAT_IDAFA-اني_اخاف-5",
    "original_text": "إِنِّىٓ أَخَافُ",
    "page_id": 3099,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-046-25-10-4033-performance-a25-t10",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-046-025-010-025-010",
    "original_text": "مَسَـٰكِنُهُمْ ۚ",
    "page_id": 3099,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P507-47-2-10-P1-a2-t10",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "AUDIT-P507-47-2-10-P1-a2-t10",
    "original_text": "وَهُوَ",
    "page_id": 3101,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P511-48-2-14-75dd0c66-a2-t14",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "AUDIT-P511-48-2-14-75dd0c66-a2-t14",
    "original_text": "صِرَٰطًۭا",
    "page_id": 3105,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-048-13-8-r2358-performance-a13-t8",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: IMALAH_TAQLIL",
    "locus_id": "r-p512-IMALAH_TAQLIL-للكافرين-1",
    "original_text": "لِلْكَـٰفِرِينَ",
    "page_id": 3106,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P513-48-20-17-65ff11e7-a20-t17",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "AUDIT-P513-48-20-17-65ff11e7-a20-t17",
    "original_text": "صِرَٰطًۭا",
    "page_id": 3107,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-048-21-1-r2360-performance-a21-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: IMALAH_TAQLIL",
    "locus_id": "r-p513-IMALAH_TAQLIL-واخرا-2",
    "original_text": "وَأُخْرَىٰ",
    "page_id": 3107,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-048-29-11-r2369-performance-a29-t11",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: IMALAH_TAQLIL",
    "locus_id": "r-p515-IMALAH_TAQLIL-تراهم-1",
    "original_text": "تَرَىٰهُمْ",
    "page_id": 3109,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D515-سوقهي-w2-a29-t39",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: TAGHYIR_HAMZ",
    "locus_id": "D515-سوقهي-a29-t39",
    "original_text": "سُؤْقِهِ",
    "page_id": 3109,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D515-سوقهي-w3-a29-t39",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: TAGHYIR_HAMZ",
    "locus_id": "D515-سوقهي-a29-t39",
    "original_text": "سُئُوقِهِ",
    "page_id": 3109,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L519-s50a33b7-w1-R03223-a33-t7",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L519-s50a33b7-a33-t7",
    "original_text": "مُّنِيبٍ ٱدْخُلُوهَا",
    "page_id": 3113,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L520-s50a37b12-perf-03227-a37-t12",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L520-s50a37b12-a37-t12",
    "original_text": "وَهُوَ",
    "page_id": 3114,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L520-s50a45b7-perf-03230-a45-t7",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: SILAT_HA",
    "locus_id": "L520-s50a45b7-a45-t7",
    "original_text": "عَلَيْهِم",
    "page_id": 3114,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L521-s51a15b5-w1-R03238-a15-t5",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L521-s51a15b5-a15-t5",
    "original_text": "وَعُيُونٍ",
    "page_id": 3115,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L521-s51a27b2-w1-R03242-a27-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: SILAT_HA",
    "locus_id": "L521-s51a27b2-a27-t2",
    "original_text": "إِلَيْهِمْ",
    "page_id": 3115,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L522-s51a33b2-w1-R03246-a33-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: SILAT_HA",
    "locus_id": "L522-s51a33b2-a33-t2",
    "original_text": "عَلَيْهِمْ",
    "page_id": 3116,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L522-s51a40b6-w1-R03247-a40-t6",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L522-s51a40b6-a40-t6",
    "original_text": "وَهُوَ",
    "page_id": 3116,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L522-s51a41b5-w1-R03248-a41-t5",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: SILAT_HA",
    "locus_id": "L522-s51a41b5-a41-t5",
    "original_text": "عَلَيْهِمُ الرِّيحَ",
    "page_id": 3116,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-L522-s51a43b4-w1-R03251-a43-t4",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "L522-s51a43b4-a43-t4",
    "original_text": "قِيلَ",
    "page_id": 3116,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-051-49-7-r2394-performance-a49-t7",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: AMBIGUOUS",
    "locus_id": "L522-s51a49b7-a49-t7",
    "original_text": "تَذَكَّرُونَ",
    "page_id": 3116,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DOCX-P523-3-R03257-60-5-2-a60-t5",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: SILAT_HA",
    "locus_id": "DOCX-P523-3-R03257-60-5-a60-t5",
    "original_text": "يَوْمِهِمُ ٱلَّذِى",
    "page_id": 3117,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DOCX-P524-R03263-1-a21-t3",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: AMBIGUOUS",
    "locus_id": "loc-052-021-003-021-004",
    "original_text": "وَٱتَّبَعَتْهُمْ ذُرِّيَّتُهُم",
    "page_id": 3118,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DOCX-P524-R03263-2-a21-t7",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: AMBIGUOUS",
    "locus_id": "loc-052-021-007-021-008",
    "original_text": "بِهِمْ ذُرِّيَّتَهُمْ",
    "page_id": 3118,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DOCX-P524-4-R03269-24-2-2-a24-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: SILAT_HA",
    "locus_id": "DOCX-P524-4-R03269-24-2-a24-t2",
    "original_text": "عَلَيْهِمْ",
    "page_id": 3118,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DOCX-P526-6-R03295-23-23-2-a23-t23",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: SILAT_HA",
    "locus_id": "DOCX-P526-6-R03295-23-23-a23-t23",
    "original_text": "مِّن رَّبِّهِمُ ٱلْهُدَىٰٓ",
    "page_id": 3120,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P535-R03371-071b5238-a37-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: TAGHYIR_HAMZ",
    "locus_id": "AUDIT-P535-R03371-071b5238-a37-t1",
    "original_text": "عُرْبًا",
    "page_id": 3129,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P536-R03380-PERF-b385f0aa-a58-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: AMBIGUOUS",
    "locus_id": "AUDIT-P536-R03380-PERF-1006ef40-a58-t1",
    "original_text": "أَفَرَءَيْتُم",
    "page_id": 3130,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P536-R03380-PERF-365be4f5-a58-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: AMBIGUOUS",
    "locus_id": "AUDIT-P536-R03380-PERF-1006ef40-a58-t1",
    "original_text": "أَفَرَءَيْتُم",
    "page_id": 3130,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-056-62-6-r2442-performance-a62-t6",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: AMBIGUOUS",
    "locus_id": "L536-s56a62b1-a62-t6",
    "original_text": "تَذَكَّرُونَ",
    "page_id": 3130,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P537-R03391-PERF-2cfcdcc1-a95-t3",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "AUDIT-P537-R03391-PERF-2cfcdcc1-a95-t3",
    "original_text": "لَهُوَ",
    "page_id": 3131,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P537-R03392-PERF-b14c9461-a1-t7",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "AUDIT-P537-R03392-PERF-b14c9461-a1-t7",
    "original_text": "وَهُوَ",
    "page_id": 3131,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P537-R03392-PERF-bd0817c8-a2-t7",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "AUDIT-P537-R03392-PERF-bd0817c8-a2-t7",
    "original_text": "وَهُوَ",
    "page_id": 3131,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P537-R03392-PERF-830aa49a-a3-t6",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "AUDIT-P537-R03392-PERF-830aa49a-a3-t6",
    "original_text": "وَهُوَ",
    "page_id": 3131,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P538-R03394-PERF-4a3c878b-a4-t28",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "AUDIT-P538-R03394-PERF-4a3c878b-a4-t28",
    "original_text": "وَهُوَ",
    "page_id": 3132,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P538-R03394-PERF-0083bf47-a6-t9",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "AUDIT-P538-R03394-PERF-0083bf47-a6-t9",
    "original_text": "وَهُوَ",
    "page_id": 3132,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-057-8-10-4222-performance-a8-t10",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-057-008-010-008-012",
    "original_text": "وَقَدْ أَخَذَ مِيثَـٰقَكُمْ",
    "page_id": 3132,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-DOCX-P539-R03408-82f84464a2-a13-t11",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "AUDIT-DOCX-P539-R03408-82f84464a2-a13-t11",
    "original_text": "قِيلَ",
    "page_id": 3133,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-057-27-5-r2470-performance-a27-t5",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: AMBIGUOUS",
    "locus_id": "loc-057-027-005-027-005",
    "original_text": "بِرُسُلِنَا",
    "page_id": 3135,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-DOCX-P542-R03435-a7eb56bb8b-a2-t12",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: AMBIGUOUS",
    "locus_id": "AUDIT-DOCX-P542-R03435-15f7ff6848-a2-t12",
    "original_text": "اللآءِ",
    "page_id": 3136,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P543-58-11-5-03443-1-قيل-قيل-a11-t5",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "AUDIT-P543-58-11-5-03443-1-قيل-قيل-a11-t5",
    "original_text": "قِيلَ",
    "page_id": 3137,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P543-58-11-15-03443-2-قيل-قيل-a11-t15",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "AUDIT-P543-58-11-15-03443-2-قيل-قيل-a11-t15",
    "original_text": "قِيلَ",
    "page_id": 3137,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P545-59-2-31-03462-1-قلوبهم الرعب-قلوبهم الرعب-a2-t31",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: SILAT_HA",
    "locus_id": "AUDIT-P545-59-2-31-03462-1-قلوبهم الرعب-قلوبهم الرعب-a2-t31",
    "original_text": "قُلُوبِهِمُ الرُّعْبَ",
    "page_id": 3139,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P546-59-7-17-03476-1-كي لا يكون دوله-كي لا تكون دوله-a7-t17",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: AMBIGUOUS",
    "locus_id": "AUDIT-P546-59-7-17-03475-1-كي لا يكون دوله-كي لا يكون دوله-a7-t17",
    "original_text": "كَيْ لَا تَكُونَ دُولَةٌ",
    "page_id": 3140,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P546-59-7-17-03477-1-كي لا يكون دوله-كي لا يكون دوله-a7-t17",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: AMBIGUOUS",
    "locus_id": "AUDIT-P546-59-7-17-03475-1-كي لا يكون دوله-كي لا يكون دوله-a7-t17",
    "original_text": "كَيْ لَا يَكُونَ دُولَةٌ",
    "page_id": 3140,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P547-59-10-22-R03486-a10-t22",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: AMBIGUOUS",
    "locus_id": "loc-059-010-022-010-022",
    "original_text": "رَءُوفٌۭ",
    "page_id": 3141,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P547_R03489-a14-t15",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "AUDIT-P547_R03489-a14-t15",
    "original_text": "تَحْسَبُهُمْ",
    "page_id": 3141,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-059-16-13-r2510-performance-a16-t13",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "r-p547-YAAT_IDAFA-اني_اخاف-5",
    "original_text": "إِنِّىٓ أَخَافُ",
    "page_id": 3141,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P548_R03495-a24-t15",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "AUDIT-P548_R03495-a24-t15",
    "original_text": "وَهُوَ",
    "page_id": 3142,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P549_R03505-a1-t36",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: WAQF_RASM",
    "locus_id": "AUDIT-P549_R03505-a1-t36",
    "original_text": "وَأَنَا۠ أَعْلَمُ",
    "page_id": 3143,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P550_R03519-a9-t15",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "AUDIT-P550_R03519-a9-t15",
    "original_text": "أَن تَوَلَّوْهُمْ ۚ",
    "page_id": 3144,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-061-6-21-4287-performance-a6-t21",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "r-p552-YAAT_IDAFA-من_بعدي_اسمهو-9",
    "original_text": "مِنۢ بَعْدِى ٱسْمُهُۥٓ",
    "page_id": 3146,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-061-7-8-r2534-performance-a7-t8",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-061-007-008-007-008",
    "original_text": "وَهُوَ",
    "page_id": 3146,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D555-قيل-performance1-a5-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "D555-قيل-a5-t2",
    "original_text": "قِيلَ",
    "page_id": 3149,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-065-1-23-r2555-performance-a1-t23",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: AMBIGUOUS",
    "locus_id": "loc-065-001-023-001-023",
    "original_text": "مُّبَيِّنَةٍۢ ۚ",
    "page_id": 3152,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-065-6-32-r2561-performance-a6-t32",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: IMALAH_TAQLIL",
    "locus_id": "r-p559-IMALAH_TAQLIL-اخرا-0",
    "original_text": "أُخْرَىٰ",
    "page_id": 3153,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D561-وقيل-performance1-a10-t23",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "D561-وقيل-a10-t23",
    "original_text": "وَقِيلَ",
    "page_id": 3155,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D562-تكاد_تميز-performance1-a8-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: AMBIGUOUS",
    "locus_id": "D562-تكاد_تميز-a8-t1",
    "original_text": "تَكَادُ تَمَيَّزُ",
    "page_id": 3156,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-067-13-6-4336-performance-a13-t6",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: TAGHYIR_HAMZ",
    "locus_id": "loc-067-013-006-013-009",
    "original_text": "إِنَّهُۥ عَلِيمٌۢ بِذَاتِ ٱلصُّدُورِ",
    "page_id": 3157,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DOCX-563-R03635-c46f2d21-a14-t5",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "DOCX-P563-R03635-14-5-a14-t5",
    "original_text": "وَهُوَ",
    "page_id": 3157,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DOCX-563-R03636-2171103a-a20-t7",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "DOCX-P563-R03636-20-7-a20-t7",
    "original_text": "يَنصُرُكُم",
    "page_id": 3157,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DOCX-563-R03636-2ee39a8b-a20-t7",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "DOCX-P563-R03636-20-7-a20-t7",
    "original_text": "يَنصُرُكُم",
    "page_id": 3157,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DOCX-563-R03637-47485347-a22-t11",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "DOCX-P563-R03637-22-11-a22-t11",
    "original_text": "صِرَٰطٍۢ",
    "page_id": 3157,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-067-27-2-4342-performance-a27-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: TAGHYIR_HAMZ",
    "locus_id": "loc-067-027-002-027-002",
    "original_text": "رَأَوْهُ",
    "page_id": 3158,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DOCX-564-R03642-78f422e4-a27-t4",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "DOCX-P564-SIET-67-27-a27-t4",
    "original_text": "سِيٓـَٔتْ",
    "page_id": 3158,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DOCX-564-R03642-ec591abe-a27-t4",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "DOCX-P564-SIET-67-27-a27-t4",
    "original_text": "سِيٓـَٔتْ",
    "page_id": 3158,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DOCX-564-R03643-c6cdc533-a27-t8",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "DOCX-P564-R03643-27-8-a27-t8",
    "original_text": "وَقِيلَ",
    "page_id": 3158,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DOCX-564-R03644-e870b08f-a27-t13",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "DOCX-P564-R03644-27-13-a27-t13",
    "original_text": "تَدَّعُونَ",
    "page_id": 3158,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DOCX-564-R03648-7c590bb6-a7-t9",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "DOCX-P564-R03648-7-9-a7-t9",
    "original_text": "وَهُوَ",
    "page_id": 3158,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DOCX-564-R03649-single-a14-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: AMBIGUOUS",
    "locus_id": "DOCX-P564-R03649-14-1-a14-t1",
    "original_text": "أَن كَانَ",
    "page_id": 3158,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DOCX-564-R03649-double-a14-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: AMBIGUOUS",
    "locus_id": "DOCX-P564-R03649-14-1-a14-t1",
    "original_text": "أَءَنْ كَانَ",
    "page_id": 3158,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DOCX-565-R03653-4974406f-a22-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "DOCX-P565-R03653-22-1-a22-t1",
    "original_text": "أَنِ ٱغْدُوا۟",
    "page_id": 3159,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DOCX-565-R03654-bb76c41d-a32-t4",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "DOCX-P565-R03654-32-4-a32-t4",
    "original_text": "يُبْدِلَنَا",
    "page_id": 3159,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DOCX-565-R03655-0b31d8d6-a38-t4",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "DOCX-P565-R03655-38-4-a38-t4",
    "original_text": "لَمَا تَخَيَّرُونَ",
    "page_id": 3159,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DOCX-566-R03659-1f48e4d0-a48-t10",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "DOCX-P566-R03659-48-10-a48-t10",
    "original_text": "وَهُوَ",
    "page_id": 3160,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DOCX-566-R03659-5ada8c44-a49-t9",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "DOCX-P566-R03659-49-9-a49-t9",
    "original_text": "وَهُوَ",
    "page_id": 3160,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DOCX-566-R03660-ff94f576-a51-t5",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: AMBIGUOUS",
    "locus_id": "DOCX-P566-R03660-51-5-a51-t5",
    "original_text": "لَيُزْلِقُونَكَ",
    "page_id": 3160,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DOCX-566-R03661-cc9861f6-a7-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: SILAT_HA",
    "locus_id": "DOCX-P566-R03661-7-2-a7-t2",
    "original_text": "عَلَيْهِمْ",
    "page_id": 3160,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-069-19-7-4355-performance-a19-t7",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: TAGHYIR_HAMZ",
    "locus_id": "loc-069-019-007-019-008",
    "original_text": "هَآؤُمُ ٱقْرَءُوا۟",
    "page_id": 3161,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D568-تذكرون-w2-a42-t6",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "D568-تذكرون-a42-t6",
    "original_text": "تَذْكُرُونَ",
    "page_id": 3162,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D568-تذكرون-w4-a42-t6",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "D568-تذكرون-a42-t6",
    "original_text": "يَذَّكَّرُونَ",
    "page_id": 3162,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-071-4-15-4364-performance-a4-t15",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: AMBIGUOUS",
    "locus_id": "loc-071-004-015-004-015",
    "original_text": "يُؤَخَّرُ ۖ",
    "page_id": 3164,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-071-16-5-4367-performance-a16-t5",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: TAGHYIR_HAMZ",
    "locus_id": "loc-071-016-005-016-007",
    "original_text": "وَجَعَلَ ٱلشَّمْسَ سِرَاجًۭا",
    "page_id": 3165,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-071-24-2-4368-performance-a24-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: TAGHYIR_HAMZ",
    "locus_id": "loc-071-024-002-024-003",
    "original_text": "أَضَلُّوا۟ كَثِيرًۭا ۖ",
    "page_id": 3165,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-072-25-10-r2626-performance-a25-t10",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "r-p573-YAAT_IDAFA-ربي_امدا-2",
    "original_text": "رَبِّىٓ أَمَدًا",
    "page_id": 3167,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-073-15-9-4377-performance-a15-t9",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: TAGHYIR_HAMZ",
    "locus_id": "loc-073-015-009-015-011",
    "original_text": "إِلَىٰ فِرْعَوْنَ رَسُولًۭا",
    "page_id": 3168,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-073-20-73-4379-performance-a20-t73",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: TAGHYIR_HAMZ",
    "locus_id": "loc-073-020-073-020-074",
    "original_text": "وَٱسْتَغْفِرُوا۟ ٱللَّهَ ۖ",
    "page_id": 3169,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-075-1-1-r2639-performance-a1-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: AMBIGUOUS",
    "locus_id": "loc-075-001-001-001-003",
    "original_text": "لَآ أُقْسِمُ بِيَوْمِ",
    "page_id": 3171,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P578-75-27-1-f0617b9e-a27-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "AUDIT-P578-75-27-1-f0617b9e-a27-t1",
    "original_text": "وَقِيلَ",
    "page_id": 3172,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-AUDIT-P578-76-4-4-dd315601-a4-t4",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: WAQF_RASM",
    "locus_id": "AUDIT-P578-76-4-4-90623940-a4-t4",
    "original_text": "سَلَـٰسِلَا۟",
    "page_id": 3172,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D579-76-14-2--R03780-3-a14-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: SILAT_HA",
    "locus_id": "D579-76-14-al-yahim-2-a14-t2",
    "original_text": "عَلَيْهِمْ",
    "page_id": 3173,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D579-76-15-2--R03780-3-a15-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: SILAT_HA",
    "locus_id": "D579-76-15-al-yahim-2-a15-t2",
    "original_text": "عَلَيْهِمْ",
    "page_id": 3173,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D579-76-15-8--R03782-2-a15-t8",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: WAQF_RASM",
    "locus_id": "D579-76-15-16-qawarir-pair-a15-t8",
    "original_text": "قَوَارِيرَا",
    "page_id": 3173,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D579-76-15-8--R03783-3-a15-t8",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: WAQF_RASM",
    "locus_id": "D579-76-15-16-qawarir-pair-a15-t8",
    "original_text": "قَوَارِيرًا",
    "page_id": 3173,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D579-76-15-8--R03784-5-a15-t8",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "D579-76-15-16-qawarir-pair-a15-t8",
    "original_text": "قَوَارِيرْ",
    "page_id": 3173,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D579-76-16-1--R03786-2-a16-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: WAQF_RASM",
    "locus_id": "D579-76-15-16-qawarir-pair-a16-t1",
    "original_text": "قَوَارِيرَ",
    "page_id": 3173,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D579-76-16-1--R03788-5-a16-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: WAQF_RASM",
    "locus_id": "D579-76-15-16-qawarir-pair-a16-t1",
    "original_text": "قَوَارِيرَا",
    "page_id": 3173,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D579-76-19-2--R03780-3-a19-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: SILAT_HA",
    "locus_id": "D579-76-19-al-yahim-2-a19-t2",
    "original_text": "عَلَيْهِمْ",
    "page_id": 3173,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D579-76-21-1--R03789-2-a21-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: SILAT_HA",
    "locus_id": "D579-76-21-alayhim-a21-t1",
    "original_text": "عَالِيهِمْ",
    "page_id": 3173,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D581-77-48-2--R03816-2-a48-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "D581-77-48-2--R03816-a48-t2",
    "original_text": "قِيلَ",
    "page_id": 3175,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-D582-78-19-1--R03821-2-a19-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "D582-78-19-face-a19-t1",
    "original_text": "وَفُتِحَتِ",
    "page_id": 3176,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-078-37-1-r2662-performance-a37-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: AMBIGUOUS",
    "locus_id": "loc-078-037-001-037-001",
    "original_text": "رَّبِّ",
    "page_id": 3177,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-078-37-6-r2662-performance-a37-t6",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: AMBIGUOUS",
    "locus_id": "loc-078-037-006-037-006",
    "original_text": "ٱلرَّحْمَـٰنِ ۖ",
    "page_id": 3177,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-079-27-6-4429-performance-a27-t6",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: AMBIGUOUS",
    "locus_id": "loc-079-027-006-027-006",
    "original_text": "بَنَىٰهَا",
    "page_id": 3178,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-079-44-3-4438-performance-a44-t3",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: AMBIGUOUS",
    "locus_id": "loc-079-044-003-044-003",
    "original_text": "مُنتَهَىٰهَآ",
    "page_id": 3178,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-080-4-3-r2672-performance-a4-t3",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: AMBIGUOUS",
    "locus_id": "loc-080-004-003-004-003",
    "original_text": "فَتَنفَعَهُ",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-080-9-1-4447-performance-a9-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-080-009-001-009-001",
    "original_text": "وَهُوَ",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-080-42-3-4450-performance-a42-t3",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: TAGHYIR_HAMZ",
    "locus_id": "loc-080-042-003-042-004",
    "original_text": "ٱلْكَفَرَةُ ٱلْفَجَرَةُ",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-081-10-3-r2677-performance-a10-t3",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: AMBIGUOUS",
    "locus_id": "loc-081-010-003-010-003",
    "original_text": "نُشِرَتْ",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-081-12-3-4454-performance-a12-t3",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-081-012-003-012-003",
    "original_text": "سُعِّرَتْ",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-082-19-1-r2684-performance-a19-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: AMBIGUOUS",
    "locus_id": "loc-082-019-001-019-002",
    "original_text": "يَوْمَ لَا",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SQL-P589-84-21-quri-a21-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: غير متاح",
    "locus_id": "loc-084-021-002-021-002",
    "original_text": "قُرِيَ",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-086-8-2-4468-performance-a8-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: TAGHYIR_HAMZ",
    "locus_id": "loc-086-008-002-008-004",
    "original_text": "عَلَىٰ رَجْعِهِۦ لَقَادِرٌۭ",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SQL-P591-87-1-imala-a1-t4",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: IMALAH_TAQLIL؛ تصنيف المراجع الخارجي: غير متاح",
    "locus_id": "loc-087-001-004-001-004",
    "original_text": "ٱلْأَعْلَى",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SQL-P591-87-6-quri-a6-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: غير متاح",
    "locus_id": "loc-087-006-001-006-001",
    "original_text": "سَنُقْرِيُكَ",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-088-4-1-4489-performance-a4-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-088-004-001-004-001",
    "original_text": "تَصْلَىٰ",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-088-11-4-4491-performance-a11-t4",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-088-011-004-011-004",
    "original_text": "لَـٰغِيَةًۭ",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SQL-P592-88-4-tsla-a22-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: غير متاح",
    "locus_id": "loc-088-022-001-022-001",
    "original_text": "تُصْلَىٰ",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SQL-P592-88-22-ishmam-a22-t3",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: غير متاح",
    "locus_id": "loc-088-022-003-022-003",
    "original_text": "بِمُصَيْطِرٍ",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-088-25-3-4493-performance-a25-t3",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: AMBIGUOUS",
    "locus_id": "loc-088-025-003-025-003",
    "original_text": "إِيَابَهُمْ",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-089-16-5-4494-performance-a16-t5",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-089-016-005-016-005",
    "original_text": "فَقَدَرَ",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-089-23-1-4499-performance-a23-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-089-023-001-023-001",
    "original_text": "وَجِا۟ىٓءَ",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-089-26-2-4502-performance-a26-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-089-026-002-026-002",
    "original_text": "يُوثِقُ",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-090-5-1-r2714-performance-a5-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: AMBIGUOUS",
    "locus_id": "loc-090-005-001-005-001",
    "original_text": "أَيَحْسَبُ",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-090-7-1-r2715-performance-a7-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: AMBIGUOUS",
    "locus_id": "loc-090-007-001-007-001",
    "original_text": "أَيَحْسَبُ",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-090-15-1-4505-performance-a15-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: TAGHYIR_HAMZ",
    "locus_id": "loc-090-015-001-015-003",
    "original_text": "يَتِيمًۭا ذَا مَقْرَبَةٍ",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-090-17-5-4506-performance-a17-t5",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: TAGHYIR_HAMZ",
    "locus_id": "loc-090-017-005-017-005",
    "original_text": "ءَامَنُوا۟",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-090-18-3-4507-performance-a18-t3",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: TAGHYIR_HAMZ",
    "locus_id": "loc-090-018-003-018-003",
    "original_text": "ٱلْمَيْمَنَةِ",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-091-1-2-4510-performance-a1-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: AMBIGUOUS",
    "locus_id": "loc-091-001-002-001-002",
    "original_text": "وَضُحَىٰهَا",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-093-9-3-4541-performance-a9-t3",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: TAGHYIR_HAMZ",
    "locus_id": "loc-093-009-003-009-004",
    "original_text": "فَلَا تَقْهَرْ",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-093-10-3-4542-performance-a10-t3",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: TAGHYIR_HAMZ",
    "locus_id": "loc-093-010-003-010-004",
    "original_text": "فَلَا تَنْهَرْ",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-094-2-3-4543-performance-a2-t3",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: TAGHYIR_HAMZ",
    "locus_id": "loc-094-002-003-002-003",
    "original_text": "وِزْرَكَ",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-099-7-6-4565-performance-a7-t6",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: SILAT_HA",
    "locus_id": "loc-099-007-006-007-006",
    "original_text": "يَرَهُۥ",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-099-8-6-4566-performance-a8-t6",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: SILAT_HA",
    "locus_id": "loc-099-008-006-008-006",
    "original_text": "يَرَهُۥ",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-101-7-1-r2731-performance-a7-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-101-007-001-007-001",
    "original_text": "فَهُوَ",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-103-1-1-4574-performance-a1-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: TAGHYIR_HAMZ",
    "locus_id": "loc-103-001-001-001-001",
    "original_text": "وَٱلْعَصْرِ",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-104-2-2-4576-performance-a2-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-104-002-002-002-003",
    "original_text": "جَمَعَ مَالًۭا",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-104-3-1-r2733-performance-a3-t1",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: AMBIGUOUS",
    "locus_id": "loc-104-003-001-003-001",
    "original_text": "يَحْسَبُ",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-109-6-3-4586-performance-a6-t3",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: YAAT_IDAFA",
    "locus_id": "loc-109-006-003-006-004",
    "original_text": "وَلِىَ دِينِ",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SUSI-110-3-4-4588-performance-a3-t4",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: TAGHYIR_HAMZ",
    "locus_id": "loc-110-003-004-003-004",
    "original_text": "وَٱسْتَغْفِرْهُ ۚ",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-DURI-111-4-2-r2736-performance-a4-t2",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: AMBIGUOUS",
    "locus_id": "loc-111-004-002-004-002",
    "original_text": "حَمَّالَةَ",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  },
  {
    "entry_id": "v-SRC604-كفؤا-وصل-w2-a4-t4",
    "flag_type": "Q6_AMBIGUOUS",
    "issue_ar": "[phase3] تصنيفنا: Q6_AMBIGUOUS؛ تصنيف المراجع الخارجي: FARSH",
    "locus_id": "loc-112-004-004-004-004",
    "original_text": "كُفْؤًا",
    "page_id": null,
    "severity": "warning",
    "status": "open"
  }
]
```

## فرش إلى أصول

{"HAMZATAN_KALIMA": 5, "HAMZATAN_KALIMATAYN": 5, "SILAT_HA": 1, "TAGHYIR_HAMZ": 238, "TARK_GHUNNA": 2, "USUL_MIM_JAM": 5, "USUL_SAKT": 13, "YAAT_IDAFA": 82}

## DB-only entries (58)

["v-AUDIT-P499-DOCX-P499-R03029-1-74e7e80f-a1-t1", "v-AUDIT-P503-R03071-12-12-a12-t12-hdaa2ff2bba25c34f", "v-AUDIT-P510-47-38-1-P5-a38-t1", "v-AUDIT-P510-47-38-1-P6-a38-t1", "v-AUDIT-P535-R03371-PERF-SAKT-Q06R01-a37-t1", "v-AUDIT-P543-58-11-5-03443-1-قيل لكم-قيل لكم-a11-t5", "v-AUDIT-P578-76-4-4-bc096c6f-a4-t4", "v-D261-ياتيهم_العذاب-performance2-a44-t4", "v-D261-ياتيهم_العذاب-performance3-a44-t4", "v-D279-لا_يهديهم_الله-performance2-a104-t7", "v-D279-لا_يهديهم_الله-performance3-a104-t7", "v-D300-قبلا-w1-a55-t19", "v-D305-عتيا-w2-a8-t14", "v-D307-قول_الحق-w1-a34-t5", "v-D308-مخلصا-w1-a51-t7", "v-D310-اءذا-w1-a66-t3", "v-D327-فسلوهم-w2-a63-t6-h71d86bd4a75b3fad", "v-D343-نسقيكم-performance2-a21-t6", "v-D400-منجوك-w2-a33-t17-h6fc99fd3d5438d24", "v-D412-ولا_تصعر-w2-a18-t1", "v-D413-والبحر-w2-a27-t8", "v-D421-يضاعف_لها_العذاب-w4-a30-t8", "v-D439-بينت-w2-a40-t24", "v-D446-بزينه_الكواكب-w2-a6-t5", "v-D447-المخلصين-w2-a40-t4", "v-D447-لا_تناصرون-w2-a25-t3", "v-D448-المخلصين-w2-a74-t4", "v-D448-متنا-w2-a53-t2", "v-D459-يرضه-w2-DOCX-P459-R02655-a7-t13", "v-D471-يدخلون-w2-a40-t18", "v-D472-ادخلوا-w2-a46-t9", "v-D486-يبشر-w1-a23-t3", "v-D495-ترجعون-w2-a85-t13-h03798a01768f602f", "v-D495-ترجعون-w2-a85-t13-h2d627d0fffe497e6", "v-D495-يعلمون-w2-a86-t13-h8671d64a3f940984", "v-D496-رب_السماوات-w2-a7-t1-h14b24c146ba32712", "v-D497-فاسر-w2-a23-t1-ha77e0b5de259ebf1", "v-D497-وعيون-w2-a25-t5-h2ab21346e3b327c2", "v-D498-فاعتلوه-w2-a47-t2-h2fcfe2c78219923d", "v-D498-مقام_امين-w2-a51-t4-h0e0b30d62050800d", "v-D498-وعيون-w2-a52-t3-h42595aa918c060d8", "v-D509-اسرارهم-w2-a26-t15-h530c0574279f64aa", "v-D555-قيل-performance2-a5-t2", "v-D567-فهي_يومئذ-w3-a16-t3", "v-D581-77-48-2--R03816-3-a48-t2", "v-D582-78-19-1--R03821-4-a19-t1", "v-D582-78-25-3--R03823-3-a25-t3", "v-DOCX-564-R03642-934bff72-a27-t4", "v-DOCX-P523-3-R03257-60-5-3-a60-t5", "v-DOCX-P525-5-R03276-32-2-2-a32-t2", "v-DOCX-P525-5-R03284-45-7-2-a45-t7", "v-DOCX-P526-6-R03295-23-23-3-a23-t23", "v-L058-هانتم-1-w4-a66-t1", "v-L065-هاانتم-1-w3-a119-t1", "v-L363-s25a41b0-w3-a41-t6", "v-L448-s37a56b0-w2-a56-t5", "v-L522-s51a41b5-w2-R03249-a41-t5", "v-L522-s51a41b5-w3-R03250-a41-t5"]

## Interpretation

The migration rebuilds each touched canonical locus with qiraat_rebuild_locus_readings(locus_id) after entry and authority changes. Counts are scratch-verified; the live database was read-only.


## Independent verification (Claude, fresh scratch copy of live `post-qiraat-phase2-20260923T115619Z.dump`)
- Apply: exit 0, about 30 s, one transaction; pre- and post-asserts passed; `quran_words` 77,429 rows, checksum `52839d155fd0f90f999822a43e8198f5` unchanged.
- Live entries: فرش 3,035 unreviewed + 573 flagged; أصول 11,361 unreviewed + 308 flagged (15,277 total). Soft-deleted entries: 6.
- Locations: 13,254 live, 1,016 soft-deleted (merged or emptied). Pages: 604.
- Checks (all 0): unflagged Hafs main reading, unflagged narrator twice, empty location, live entry on a deleted location, duplicate live location per span, kind/detail mismatch, entry without readings, reader-level live authority on fixture entries, location page ≠ `quran_words` page, unanchored location, evidence link on a deleted location. Evidence links: 2,402 (none lost).
- Fixture fidelity: rulings 11,318/11,318 identical narrator sets; فرش 3,556 identical text + narrators; 351 converted to أصول (TAGHYIR_HAMZ 238, YAAT_IDAFA 82, USUL_SAKT 13, HAMZATAN_KALIMA 5, HAMZATAN_KALIMATAYN 5, USUL_MIM_JAM 5, TARK_GHUNNA 2, SILAT_HA 1); 7 dropped.
- Unchanged by the migration: editor annotations, resolved cache. Changed as expected: editor catalog (new source-document labels) and `qiraat_export_page` output (page content now from the fixtures).
- Rollback: restore the pre-apply `pg_dump`. An edit-log undo of this migration is intentionally blocked by the D8 check, because the old data breaks D8.
