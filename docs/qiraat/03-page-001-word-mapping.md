# Mutshabehat V2: Mushaf 1441 Page 1 Qira’at Word Mapping Report
**Date:** 2026-09-16  
**Document:** `docs/qiraat/03-page-001-word-mapping.md`  
**Phase:** Phase F — Word Mapping and Canonical Locators

---

## 1. Mapping Overview

This report documents the exact mapping from the 4 extracted source Qira’at loci on Printed Page 1 of *مصحف القراءات العشر* to the canonical word tokens within the existing Mushaf 1441 dataset (`packages/quran-data/mushaf1441/fixtures/page-words/page-001.json`).

All mappings are established using immutable canonical locators:
1. `surah_number` (1)
2. `ayah_number` (1 to 7)
3. `word_index_in_ayah` (1-indexed)
4. `quran_word_id` (e.g. `qurancom-word-3252`)
5. Page layout coordinate: `line_number` (1 to 15) and `word_index_in_line`.

---

## 2. Locus-to-Word Target Map

| Locus # | Marker | Surah:Ayah | Word Index (Ayah) | Existing Word ID | Display Text (Uthmani) | Normalized Text | Page Layout Position | Note |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---|
| **1** | `(١)` | **1:4** | 1 | `qurancom-word-3252` | `مَـٰلِكِ` | `مالك` | Line 4, Word 4 | Single target word |
| **2** | `(٢)` | **1:6** | 2 | `qurancom-word-6845` | `ٱلصِّرَٰطَ` | `الصراط` | Line 6, Word 1 | Single target word |
| **3** | `(٣)` | **1:7** | 1 | `qurancom-word-8411` | `صِرَٰطَ` | `صراط` | Line 6, Word 4 | Single target word |
| **4** | `(٤)` | **1:7** | 4 | `qurancom-word-8414` | `عَلَيْهِمْ` | `عليهم` | Line 7, Word 1 | Target 1 of 2 (`معًا`) |
| **4** | `(٤)` | **1:7** | 7 | `qurancom-word-8417` | `عَلَيْهِمْ` | `عليهم` | Line 7, Word 4 | Target 2 of 2 (`معًا`) |

---

## 3. Mapping Integrity & Validation Summary

- **Total Source Loci:** 4
- **Total Mapped Targets:** 5
- **Unresolved Quran Words:** 0
- **Unmapped Loci:** 0
- **Base Quran Text Alterations:** 0 (Text in `page-001.json` and `ayahs.json` is 100% untouched).

### The `(معًا)` Multi-Target Rule
Locus 4 (`عَلَيْهِمْ`) explicitly specifies `(معًا)` in the source text. This is modeled as a **single Qira’at locus** pointing to **two distinct `qiraat_targets`**:
- Target 1: Ayah 1:7, Word 4 (`أَنْعَمْتَ عَلَيْهِمْ`)
- Target 2: Ayah 1:7, Word 7 (`الْمَغْضُوبِ عَلَيْهِمْ`)
Tapping either word on the Mushaf page opens the identical Qira’at record without data duplication.
