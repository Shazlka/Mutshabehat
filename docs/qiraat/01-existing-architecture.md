# Mutshabehat V2: Architecture Audit for Qira’at Integration
**Date:** 2026-09-16  
**Document:** `docs/qiraat/01-existing-architecture.md`  
**Phase:** Phase A — Initial Application Audit

---

## 1. Executive Summary

This audit evaluates the architecture of the Mutshabehat V2 application to determine how the Qira’at (القراءات العشر) knowledge layer can be integrated with zero disruption to existing Quran base text, page rendering, Mutshabehat groupings, search, annotations, and test pipelines.

---

## 2. Core Architecture Stack

| Component | Technology | Location / Description |
|---|---|---|
| **Frontend Framework** | Next.js 16.2.6 (App Router, Turbopack) | `src/app/` |
| **UI Library** | React 19.2 + Tailwind CSS v4 | RTL Arabic, Cairo (UI) + Amiri Quran (Script) |
| **Backend Stack** | Self-hosted Supabase | Docker/Colima on Mac Mini (`/Volumes/External Mini/Projects/apps/mutshabehat-selfhost`) |
| **Database** | PostgreSQL 17-alpine (`mutshabehat-db`) | Port `127.0.0.1:5433` (internal `5432`) |
| **Auth** | GoTrue v2.189.0 (`mutshabehat-auth`) | Port `9999` (internal) |
| **REST API** | PostgREST v14.12 (`mutshabehat-rest`) | Port `3000` (internal) |
| **Reverse Proxy** | Caddy 2-alpine (`mutshabehat-gateway`) | Port `127.0.0.1:8000` routing `/auth/v1` & `/rest/v1` |
| **Public Gateway** | Tailscale Funnel :8443 | `https://youssefs-mac-mini.tailcd68dd.ts.net:8443` |
| **Client Access** | `@supabase/ssr` & `@supabase/supabase-js` | `src/lib/supabase-server.ts`, `src/lib/resilient-fetch.ts` |
| **Deployment** | Vercel (Production) | Pinned to region `bom1` in `vercel.json`, push to `main` auto-deploys |

---

## 3. Database Schema & State

The current production database contains 13 active tables in schema `public` with Row Level Security (RLS) enabled across all tables (`auth.uid() = user_id`):
1. `groups` — Curated Mutshabehat groups.
2. `verses` — Ayah references per group (`surah`, `ayah`, `label`, `sort_order`).
3. `parts` — Colour-coded segments per verse (shared, diff, diff2, diff3, addition, unique).
4. `tags` — Tag labels.
5. `group_tags` — Group-tag join table.
6. `automated_groups` — 12,668 candidate groups.
7. `personal_groups` — User personal groups copy.
8. `personal_verses` — Personal verse copies.
9. `group_verses` — Join relation.
10. `verse_parts` — Parts for personal verses.
11. `mushaf_annotations` — Page notes, bookmarks, favourites, highlights (14 live rows).
12. `test_answers` — Answers recorded during test mode.
13. `profiles` — User profile settings.

Views: `surah_counts`, `automated_surah_counts`, `automated_groups_with_copy`.  
Functions: `save_group`, `search_group_ids`, `get_dashboard_stats`, `get_test_answer_stats`, `normalize_arabic`, `rasm_skeleton`.

---

## 4. Quran Datasets & Data Representations

The application maintains two primary Quran data layers:

1. **Corpus-Level Uthmani Text:**
   - Location: `public/quran/ayahs.json` (6,236 ayahs).
   - Format: Array of objects with `surah`, `ayah`, and `text` in Uthmani script (contains alef wasla `ٱ`, dagger alefs `ٰ`, Quran pause marks).
   - Surah Names: `public/quran/surah-names.json` (114 surahs with transliterations, page numbers, juz numbers).

2. **Mushaf 1441 Page-Accurate Word Dataset:**
   - Location: `packages/quran-data/mushaf1441/fixtures/page-words/page-{001..604}.json`.
   - Manifest: `packages/quran-data/mushaf1441/fixtures/page-words-manifest.json` (604 pages, 83,665 total tokens).
   - Auxiliary fixtures: `page-ayahs.json` (mapping pages to ayahs), `page-metadata.json` (surah headers, hizb, juz, rub).
   - TypeScript definitions: `packages/quran-data/mushaf1441/types.ts`.

---

## 5. Word Identification Model in Mushaf 1441

Each word/token in `MushafPage` is structured as a `MushafWord`:
```typescript
export interface MushafWord {
  id: string              // e.g. "qurancom-word-3252"
  pageNumber: number      // e.g. 1
  lineNumber: number      // 1 to 15
  wordIndexInLine: number // 1-indexed position in line
  surahNumber: number     // 1 to 114
  ayahNumber: number      // 1 to 286
  wordIndexInAyah: number // 1-indexed position within the ayah
  ayahKey: string         // e.g. "1:4"
  textUthmani: string     // Uthmani script display text
  glyph?: string          // Specific QCF font glyph
  textQpcHafs?: string    // QPC Hafs representation
  charTypeName?: 'word' | 'end' | 'pause' | 'sajdah' | 'rub-el-hizb' | string
  qcfVersion?: 'v1' | 'v2' | 'v4' | string
}
```

### Detailed Token Inventory for Mushaf 1441 Page 1 (Surah Al-Fatihah)

Page 1 consists of 15 line slots:
- Line 1: Empty slot (renders decorative surah header).
- Line 2: Basmala decoration + 5 tokens (Ayah 1:1, 4 words + 1 end marker).
- Line 3: 5 tokens (Ayah 1:2, 4 words + 1 end marker).
- Line 4: 7 tokens (Ayah 1:3, 2 words + 1 end marker; Ayah 1:4, 3 words + 1 end marker).
- Line 5: 6 tokens (Ayah 1:5, 4 words + 1 end marker; Ayah 1:6, word 1).
- Line 6: 6 tokens (Ayah 1:6, words 2-3 + 1 end marker; Ayah 1:7, words 1-3).
- Line 7: 4 tokens (Ayah 1:7, words 4-7).
- Line 8: 3 tokens (Ayah 1:7, words 8-9 + 1 end marker).
- Lines 9–15: Empty layout slots (Page 1 has only 8 text lines).

**Key Qira'at Target Words on Page 1:**
1. `qurancom-word-3252` | Line 4, Word 4 | Ayah `1:4`, Word 1 | `مَـٰلِكِ`
2. `qurancom-word-6845` | Line 6, Word 1 | Ayah `1:6`, Word 2 | `ٱلصِّرَٰطَ`
3. `qurancom-word-8411` | Line 6, Word 4 | Ayah `1:7`, Word 1 | `صِرَٰطَ`
4. `qurancom-word-8414` | Line 7, Word 1 | Ayah `1:7`, Word 4 | `عَلَيْهِمْ` (1st occurrence)
5. `qurancom-word-8417` | Line 7, Word 4 | Ayah `1:7`, Word 7 | `عَلَيْهِمْ` (2nd occurrence)

---

## 6. Arabic Normalization & Text Matching Logic

Located in `src/lib/arabic.ts`:
- `normalizeArabic(text)`:
  - Folds Alef variants: `[إأآٱ] -> ا`
  - Folds Dagger Alef: `ٰ -> ا` (Tier 1 Uthmani normalization)
  - Folds Taa Marbuta: `ة -> ه`
  - Folds Alef Maqsura: `ى -> ي`
  - Strips Harakat, Tanween, Shaddah, Sukun, Tatweel (`ـ`).
- `rasmSkeleton(text)`:
  - Strips all long alefs `ا` to allow defective/plene spelling matches (e.g. `السموات` ↔ `السماوات`).
- `normalizeArabicWithMap(text)`:
  - Builds index mapping from normalized character positions back to raw Uthmani character offsets for precise highlight ranges.

---

## 7. Mushaf 1441 UI & Page Renderer

Located in:
- `src/app/mushaf-1441/page.tsx`: Server component pre-loading page-words, metadata, and user ayah highlights.
- `src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx`: Client component (~3,100 lines) rendering the 15 lines via container queries (`cqw`).
- Memoized `MushafPageSlot`: Renders current page and adjacent neighbours in a stacked container.
- Font fallback pipeline: Pre-loads QCF font while immediately painting Uthmani/Amiri Quran text fallback to eliminate render lag.
- Page curl: `PageCurlOverlay.tsx` animates realistic iBooks-style paper peeling.

---

## 8. Non-Disruptive Qira’at Integration Strategy

To guarantee zero regression of existing functionality:
1. **Separation of Concerns:** Qira’at is implemented as an independent annotation layer stored in dedicated relational tables (`qiraat_sources`, `qiraat_loci`, `qiraat_targets`, `qiraat_variants`, `qiraat_attributions`, `qiraat_persons`).
2. **Immutable Quran Base Text:** Words in `page-words/*.json` and `ayahs.json` are read-only and never modified.
3. **Word-Level Foreign Linking:** Targets link directly to existing `qurancom-word-${id}`, `surahNumber`, `ayahNumber`, and `wordIndexInAyah`.
4. **Clean UI Toggle:** In `Mushaf1441Viewer.tsx`, a state flag `isQiraatMode` (default `false`) controls visibility. When OFF, zero Qira’at markup is rendered. When ON, marked words receive a non-intrusive indicator (subtle underline/badge) that opens a dedicated Qira’at detail sheet when tapped.
