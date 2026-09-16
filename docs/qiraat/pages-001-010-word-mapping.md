# Pages 1–10 — word mapping (Phase 2 of the pages-1-10 task)

Every locus below is anchored to `surah:ayah:wordIndexInAyah` (never a screen coordinate — task
Part 7), and every `hafsText` value is **copied verbatim** from the real, never-modified
`packages/quran-data/mushaf1441/fixtures/page-words/page-{NNN}.json` fixtures — not hand-typed by
the generator script. The build script (`scripts` folder does not carry it; it is a one-off
scratchpad script re-run to regenerate these fixtures, see `pages-001-010-reconciliation.md`)
resolves `hafsText` from that lookup table for every `(surah, ayah, token)` and raises immediately
if a referenced word does not exist — so a wrong ayah/token reference fails loudly instead of
silently drifting from the real Quran text.

A multi-token span (one locus, e.g. `2:20:15-16`) lists both tokens' real text, space-joined.
A `locusId` groups records that represent one conceptual source location spanning more than one
target word/occurrence (task Part 2's "targets"); see `pages-001-010-existing-architecture.md` for
why this is a field on `QiraatVariant` rather than a separate join table.

## PDF page ↔ Mushaf page mapping (verified programmatically, not assumed)

| Mushaf page | PDF page | Ayah range | Verified against |
|---|---|---|---|
| 1 | 6 | 1:1–1:7 | existing page-001 fixture range |
| 2 | 7 | 2:1–2:5 | existing page-002 fixture range |
| 3 | 8 | 2:6–2:16 | existing page-003 fixture range |
| 4 | 9 | 2:17–2:24 | existing page-004 fixture range |
| 5 | 10 | 2:25–2:29 | existing page-005 fixture range |
| 6 | 11 | 2:30–2:37 | existing page-006 fixture range |
| 7 | 12 | 2:38–2:48 | existing page-007 fixture range |
| 8 | 13 | 2:49–2:57 | existing page-008 fixture range |
| 9 | 14 | 2:58–2:61 | existing page-009 fixture range |
| 10 | 15 | 2:62–2:69 | existing page-010 fixture range |

This is the task's own stated mapping; it was cross-checked against the app's own already-verified
Mushaf-1441 fixture ayah boundaries and matches exactly, per `pages-001-010-existing-architecture.md`.

## Per-page locus table

`status` here is the value actually shipped in `packages/qiraat-core/fixtures/pages/page-{NNN}.json`
(REVIEWED or NEEDS_MANUAL_REVIEW — nothing in this batch is VERIFIED; see the final report for why).

### Mushaf page 1 (PDF p.6) — 7 variant record(s)

| id | surah:ayah:token(s) | hafsText | variantText | status | locusId |
|---|---|---|---|---|---|
| `v-p001-l001-malik-melik` | 1:4:1 | مَـٰلِكِ | مَلِكِ | REVIEWED | — |
| `v-p001-l002-sirat-sin` | 1:6:2 | ٱلصِّرَٰطَ | ٱلسِّرَٰطَ | REVIEWED | p1-sirat |
| `v-p001-l002-sirat-ishmam` | 1:6:2 | ٱلصِّرَٰطَ | ٱلصِّرَٰطَ | REVIEWED | p1-sirat |
| `v-p001-l003-sirat2-sin` | 1:7:1 | صِرَٰطَ | سِرَٰطَ | REVIEWED | p1-sirat2 |
| `v-p001-l003-sirat2-ishmam` | 1:7:1 | صِرَٰطَ | صِرَٰطَ | REVIEWED | p1-sirat2 |
| `v-p001-l004-alayhim-4` | 1:7:4 | عَلَيْهِمْ | عَلَيْهِمُ | REVIEWED | p1-alayhim |
| `v-p001-l004-alayhim-7` | 1:7:7 | عَلَيْهِمْ | عَلَيْهِمُ | REVIEWED | p1-alayhim |

### Mushaf page 2 (PDF p.7) — 6 variant record(s)

| id | surah:ayah:token(s) | hafsText | variantText | status | locusId |
|---|---|---|---|---|---|
| `v-p002-l001-alm-sakt` | 2:1:1 | الٓمٓ | الٓمٓ | REVIEWED | — |
| `v-p002-l002-fihi-silah` | 2:2:5 | فِيهِ ۛ | فِيهِ ۛ | REVIEWED | — |
| `v-p002-l003-huda-taqlil` | 2:2:6 | هُدًۭى | هُدًۭى | REVIEWED | p2-huda |
| `v-p002-l003-huda-imalah` | 2:2:6 | هُدًۭى | هُدًۭى | REVIEWED | p2-huda |
| `v-p002-l003-huda2-taqlil` | 2:5:3 | هُدًۭى | هُدًۭى | REVIEWED | p2-huda |
| `v-p002-l003-huda2-imalah` | 2:5:3 | هُدًۭى | هُدًۭى | REVIEWED | p2-huda |

### Mushaf page 3 (PDF p.8) — 5 variant record(s)

| id | surah:ayah:token(s) | hafsText | variantText | status | locusId |
|---|---|---|---|---|---|
| `v-p003-l001-alayhim-damm` | 2:6:5 | عَلَيْهِمْ | عَلَيْهِمْ | REVIEWED | — |
| `v-p003-l002-yukhadiuna` | 2:9:6 | يَخْدَعُونَ | يُخَـٰدِعُونَ | REVIEWED | — |
| `v-p003-l003-yukadhdhibuna` | 2:10:12 | يَكْذِبُونَ | يَكْذِبُونَ | REVIEWED | — |
| `v-p003-l004-qila-11` | 2:11:2 | قِيلَ | قِيلَ | REVIEWED | p3-qila |
| `v-p003-l004-qila-13` | 2:13:2 | قِيلَ | قِيلَ | REVIEWED | p3-qila |

### Mushaf page 4 (PDF p.9) — 1 variant record(s) — CRITICAL REVIEW ITEM

| id | surah:ayah:token(s) | hafsText | variantText | status | locusId |
|---|---|---|---|---|---|
| `v-p004-l001-shaa-allah` | 2:20:15-16 | شَآءَ ٱللَّهُ | شَآءَ ٱللَّهُ | NEEDS_MANUAL_REVIEW | — |

`readingIds` is empty — no attribution was confident enough to assert. See the final report.

### Mushaf page 5 (PDF p.10) — 1 variant record(s)

| id | surah:ayah:token(s) | hafsText | variantText | status | locusId |
|---|---|---|---|---|---|
| `v-p005-l001-turjaun` | 2:28:13 | تُرْجَعُونَ | تَرْجِعُونَ | REVIEWED | — |

### Mushaf page 6 (PDF p.11) — 4 variant record(s)

| id | surah:ayah:token(s) | hafsText | variantText | status | locusId |
|---|---|---|---|---|---|
| `v-p006-l001-lilmalaikatu` | 2:34:3 | لِلْمَلَـٰٓئِكَةِ | لِلْمَلَـٰٓئِكَةِ | REVIEWED | — |
| `v-p006-l002-azalahuma` | 2:36:1 | فَأَزَلَّهُمَا | فَأَزَالَهُمَا | REVIEWED | — |
| `v-p006-l003-adam-1` | 2:37:2 | ءَادَمُ | ءَادَمَ | REVIEWED | p6-adam-kalimat |
| `v-p006-l003-kalimat-1` | 2:37:5 | كَلِمَـٰتٍۢ | كَلِمَاتٌ | REVIEWED | p6-adam-kalimat |

The 2:37 آدم/كلمات locus is `multi_word_variant` — two disjoint words in the same ayah, one
`locusId`, each an independently-resolving single-token `QiraatVariant`.

### Mushaf page 7 (PDF p.12) — 2 variant record(s)

| id | surah:ayah:token(s) | hafsText | variantText | status | locusId |
|---|---|---|---|---|---|
| `v-p007-l001-khawfa` | 2:38:13 | خَوْفٌ | خَوْفَ | REVIEWED | p7-khawf |
| `v-p007-l002-tuqbalu` | 2:48:10 | يُقْبَلُ | تُقْبَلُ | REVIEWED | — |

### Mushaf page 8 (PDF p.13) — 3 variant record(s) — CRITICAL REVIEW ITEM

| id | surah:ayah:token(s) | hafsText | variantText | status | locusId |
|---|---|---|---|---|---|
| `v-p008-l001-waadna` | 2:51:2 | وَٰعَدْنَا | وَعَدْنَا | REVIEWED | — |
| `v-p008-l002-bariikum-13` | 2:54:13 | بَارِئِكُمْ | بَارِئِكُمْ | NEEDS_MANUAL_REVIEW | p8-bariikum |
| `v-p008-l002-bariikum-20` | 2:54:20 | بَارِئِكُمْ | بَارِئِكُمْ | NEEDS_MANUAL_REVIEW | p8-bariikum |

2:54's بارئكم occurs twice in the ayah (task's own example of a repeated-occurrence locus); both
occurrences share `locusId=p8-bariikum` and both are held at NEEDS_MANUAL_REVIEW with empty
`readingIds` — see the final report.

### Mushaf page 9 (PDF p.14) — 5 variant record(s) — 2 CRITICAL REVIEW ITEMS

| id | surah:ayah:token(s) | hafsText | variantText | status | locusId |
|---|---|---|---|---|---|
| `v-p009-l001-yughfar` | 2:58:16 | نَّغْفِرْ | يُغْفَرْ | REVIEWED | p9-naghfir |
| `v-p009-l001-tughfar` | 2:58:16 | نَّغْفِرْ | تُغْفَرْ | REVIEWED | p9-naghfir |
| `v-p009-l002-qila` | 2:59:7 | قِيلَ | قِيلَ | REVIEWED | — |
| `v-p009-l003-alayhim-hameed` | 2:61:38 | عَلَيْهِمُ | عَلَيْهِمُ | NEEDS_MANUAL_REVIEW | — |
| `v-p009-l004-nabiyyin` | 2:61:52 | ٱلنَّبِيِّـۧنَ | ٱلنَّبِيِّـۧنَ | NEEDS_MANUAL_REVIEW | — |

### Mushaf page 10 (PDF p.15) — 6 variant record(s) — CRITICAL REVIEW ITEM

| id | surah:ayah:token(s) | hafsText | variantText | status | locusId |
|---|---|---|---|---|---|
| `v-p010-l001-sabiina` | 2:62:7 | وَٱلصَّـٰبِـِٔينَ | وَٱلصَّابِينَ | REVIEWED | — |
| `v-p010-l002-khawfa` | 2:62:20 | خَوْفٌ | خَوْفَ | REVIEWED | — |
| `v-p010-l003-yamurukum` | 2:67:7 | يَأْمُرُكُمْ | يَأْمُرُكُمْ | NEEDS_MANUAL_REVIEW | — |
| `v-p010-l004-huzuwa-1` | 2:67:13 | هُزُوًۭا ۖ | هُزُوًۭا ۖ | REVIEWED | p10-huzuwa |
| `v-p010-l004-huzuwa-2` | 2:67:13 | هُزُوًۭا ۖ | هُزْؤًا | REVIEWED | p10-huzuwa |
| `v-p010-l004-huzuwa-3` | 2:67:13 | هُزُوًۭا ۖ | هُزُؤًا | REVIEWED | p10-huzuwa |

2:67's هزوا is the task's 3-way split example: حفص's own reading, حمزة+خلف العاشر's reading, and
"الباقون" computed as the 20-reading set minus the other two groups (never stored as a literal
person — see `pages-001-010-existing-architecture.md`).

## Totals

- 40 `QiraatVariant` records across 10 pages, grouping into 28 conceptual loci (by `locusId` or,
  where absent, the record's own id).
- 36 REVIEWED, 4 NEEDS_MANUAL_REVIEW (0 VERIFIED — see the final report for why).
- 6 records carry empty `readingIds` (candidate-only placeholders inside the 4 NEEDS_MANUAL_REVIEW
  loci that have more than one uncertain target — `شاء الله`, `بارئكم`×2, `عليهم` at 2:61,
  `النبيين`, `يأمركم`): no reader/narrator attribution was confident enough to assert, per the
  task's "do not guess" rule. They are excluded from every user-facing mode by verification status
  alone, and additionally can never crash the comparison-mode marker builder even in debug mode —
  see `pages-001-010-reconciliation.md`.
