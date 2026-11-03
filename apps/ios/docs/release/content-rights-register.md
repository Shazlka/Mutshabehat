# Content rights register — Qiraat iOS (Release build)

Prepared 2026-11-03 for App Store Review Guidelines 5.2.1 (intellectual property: the developer must own or be licensed to use everything in the app) and 5.2.2 (third-party sites and services: use must be permitted by their terms).

**This is not legal advice.** It records what was checked in the repository and on the web, and marks what is assumed. Every "OK" below means "no obstacle found", not "cleared by a lawyer".

Scope: `apps/ios` on branch `ios/main`, checkout `/Users/amrelshazly/Projects/qiraat-ios`. Read-only audit; nothing else was changed.

## 1. What ships in a Release build

`project.yml` puts these into the app bundle (target `Mutshabehat`, display name «Qiraat», bundle id `com.shazlka.qiraat`):

| Build step | Resource | Release? |
| --- | --- | --- |
| Resources phase | `Generated/mushaf.sqlite`, `Generated/mutshabehat.sqlite`, folder `Generated/Fonts` (604 QCF V2 `.woff2` + `KFGQPC Uthmanic Script HAFS Regular.otf`), folder `Generated/Qiraat` (604 page JSON + `catalog.json`) | Yes |
| Asset catalog `Sources/Assets.xcassets` | `AppIcon`, 15 `SurahBanner<n>{Left,Middle,Right}` JPEGs, `SurahBannerTemplate` | Yes (compiled into `Assets.car`) |
| Source folder | `Sources/Reader/SurahBannerTemplate.png` | Yes (loose file in bundle) |
| Script «Copy Qiraat references (optional)» | `Generated/QiraatReferences/references.json` → `QiraatReferences/` | Yes, whenever the file exists on the build machine (it does) |
| Script «Copy Qiraat mutoon (optional)» | `mutoon.json`, `mutoon-symbols.json`, `mutoon-sharh.json` → `QiraatMutoon/` | Yes, whenever the files exist (they do) |
| Script «Copy review reference (Debug only)» | `Generated/Review/reference/{nquran,shamil}` → `ReviewReference/` | **No** — guarded by `CONFIGURATION = Debug`; `scripts/release_guard.py` fails a Release build that contains `ReviewReference` |

Checked against the existing Release product `DerivedData/Build/Products/Release-iphonesimulator/Mutshabehat.app` (built 2026-10-28). It contains exactly: `AppIcon60x60@2x.png`, `AppIcon76x76@2x~ipad.png`, `Assets.car`, `Fonts/` (605 files, 95 MB), `Qiraat/` (605 files, 39 MB, snapshot of 2026-10-28T07:53Z), `QiraatMutoon/` (3 files, 7.9 MB), `QiraatReferences/references.json` (2.7 MB), `SurahBannerTemplate.png`, `mushaf.sqlite` (56 MB), `mutshabehat.sqlite` (1.3 MB), `ar.lproj`/`en.lproj` strings. No `ReviewReference/`. The bundled `QiraatReferences` and `QiraatMutoon` files are byte-identical to `Generated/`; `Qiraat/catalog.json` is older than the current `Generated/Qiraat` (2026-10-30), which is expected.

Important: the two "optional" copy steps are opt-out only by deleting files on the build machine. As configured today, an archive for the App Store **will include** the commentary texts in section 2.8.

The app also downloads Qiraat and matn-overlay updates at runtime from `https://mutshabehat-v2.vercel.app` (`Sources/Sync/AppEndpoints.swift`; `QiraatLiveSync`, `QiraatBulkSync`, `MatnOverlay`). That data is the same Qiraat database as section 2.6, so the same rights question applies to it even though it is not in the bundle.

## 2. Register

Ratings: **BLOCKER** = do not submit with this content as it is; **NEEDS PERMISSION** = shippable only with written permission or proof the terms are met; **OK-ATTRIBUTE** = no obstacle found, credit required or advisable; **OK** = no obstacle found.

### Summary table

| # | Resource | Upstream source | Author / owner | Status found | Rating |
| --- | --- | --- | --- | --- | --- |
| 2.1 | QCF V2 page fonts `p1–p604.woff2` | `https://verses.quran.foundation/fonts/quran/hafs/v2/woff2` (`scripts/fetch_qcf_fonts.sh`) | King Fahd Glorious Quran Printing Complex (KFGQPC); distributed by Quran Foundation (QF) | No KFGQPC licence for QCF V2 found; QF terms allow bundling only under conditions | NEEDS PERMISSION |
| 2.2 | `KFGQPC Uthmanic Script HAFS Regular.otf` | "supplied" by the owner (CHANGELOG 2026-10); origin `fonts.qurancomplex.gov.sa` per the font's own name table | KFGQPC, © 2010 | Embedded EULA permits free use, copy, distribute; forbids selling and modifying | OK-ATTRIBUTE (if the app is free) |
| 2.3 | `mushaf.sqlite` (words, glyph codes, line layout, Uthmani text, page metadata, search tables) | `https://api.quran.com/api/v4/verses/by_page` fetched 2026-09-15 (`scripts/import-mushaf1441-page-words.mjs`, `…-page-metadata.mjs`, `apps/ios/scripts/build_mushaf_db.py`) | Quran text: KFGQPC Madinah Mushaf; data/glyph codes: Quran Foundation | Current QF Developer Terms do not allow a prepackaged database of QF content | NEEDS PERMISSION |
| 2.4 | `mutshabehat.sqlite` | `Generated/mutshabehat_seed.json`, export of the owner's 251 personal groups (`scripts/build_mutshabehat_db.py`) | The owner | Owner's own work; Quran fragments from 2.3 | OK (owner to confirm; see note) |
| 2.5 | App icon, 15 illuminated banner pieces, classic banner template | "supplied artwork" (icon, CHANGELOG 2026-10-07); "the supplied sheet" `docs/design/surah-banners-reference.jpg` (banners, 2026-10-26); "uploaded … manuscript reference" `media_1790935697488.png` (classic banner) | Unknown | Origin not recorded | NEEDS PERMISSION (owner must confirm origin) |
| 2.6 | Qiraat snapshot `Qiraat/page-*.json` + `catalog.json` (3,836 variants, 31,751 rulings, 8 rules) | Owner's web DB (`scripts/fetch_qiraat.py` → `mutshabehat-v2.vercel.app`), itself imported from several books, extracts and nquran.com (section 3) | Mixed | ~23,000 text segments are verbatim nquran.com wording; nquran's terms reserve all rights | **BLOCKER** (the nquran wording) |
| 2.7 | `mutoon.json` (Shatibiyyah 1,173 verses, Durrah 241, Tayyibah 1,015) and `references.json` (4,406 verse quotations per variant) | shamela.ws books 7754, 7749, 7795 (`Generated/Shamela/fetch_books.py`, `scripts/build_mutoon.py`, `Generated/QiraatReferences-full/match.py`) | الشاطبي (d. 590 AH / 1194 CE); ابن الجزري (d. 833 AH / 1429 CE) | Works are centuries old; the digital edition's typesetting and vowelling belong to whoever prepared it | OK-ATTRIBUTE |
| 2.8 | `mutoon-sharh.json` — full verse-by-verse commentary, ~3.35 million characters | shamela.ws book 38075 «الوافي في شرح الشاطبية» and book 8650 «الهادي شرح طيبة النشر» (`Generated/Shamela/fetch_sharh.py`, `scripts/build_matn_sharh.py`) | عبد الفتاح القاضي (d. 1403 AH / 1982 CE); محمد سالم محيسن (d. 1422 AH / 2001 CE) | Modern works, presumed in copyright; Shamela grants no reuse right | **BLOCKER** |
| 2.9 | `mutoon-symbols.json` (3,693 symbol marks) | Owner's own marking, matched against 2.8 | The owner | Own analysis; short notes and page citations to 2.8 | OK-ATTRIBUTE |
| 2.10 | Localized strings (`ar.lproj`, `en.lproj`) | Project | The owner | — | OK |

### 2.1 QCF V2 page fonts (604 files, 95 MB)

- **What:** one glyph font per Mushaf page; the reader draws every page with them.
- **Source:** downloaded at build time from QF's CDN. The script's own header says the fonts "are the King Fahd Complex's QCF glyph fonts, not ours to redistribute in source control". The fonts' name table (decoded from `p1.woff2`) reads `KFGQPC QCF2001`; it carries no licence text.
- **Verified terms:** QF's [Mushaf Fonts and Images](https://api-docs.quran.foundation/legal/mushaf-fonts-and-images/) page (last updated 2026-10-11) lets a developer bundle font files "obtained through QF APIs or documented CDN URLs" if the developer "maintains an active account in the Developer Console", credits Quran Foundation in the app or its credits, and distributes them only "as an integrated part of the Application". QF does not claim to own the fonts and says nothing about KFGQPC's permission.
- **Not found:** an official KFGQPC licence for the QCF V2 set. [QUL's font page](https://qul.tarteel.ai/resources/font/249/licence) says it has no copyright information for this resource. Third-party packages that bundle QCF fonts state their own non-commercial limits (not authoritative).
- **Assumed:** KFGQPC owns the fonts; KFGQPC generally allows its material in software ([qurancomplex.gov.sa](https://qurancomplex.gov.sa/en/?p=5536) guidance as reported by search; not read in full).
- **Rating: NEEDS PERMISSION.** Minimum to proceed: an active QF Developer Console account under the publisher's name, and the QF credit in the app. Safer: written confirmation from KFGQPC (or its developer portal terms) that QCF V2 may be bundled in a distributed app.

### 2.2 KFGQPC Uthmanic Script HAFS font

- **What:** Unicode Mushaf font for changed Qiraat words, banner titles, bookmarks and Mutashabihat text.
- **Source:** "the supplied KFGQPC Uthmanic Script HAFS Regular font" (CHANGELOG); the font's name table gives `http://fonts.qurancomplex.gov.sa`, version 0.09, designer Ashfaq Ahmad Niazi.
- **Verified terms (read from the font file itself):** the embedded EULA grants, free of cost, "the rights to Use, Copy, Distribute", on condition that the font "cannot be Sold, Modified, Altered …". The copyright string in the same file is stricter ("may not be reproduced, modified without the express written approval"). The same text is catalogued by [ScanCode LicenseDB](https://scancode-licensedb.aboutcode.org/kfgqpc-uthmanic-script-hafs.html).
- **Notes:** the file is shipped unmodified (registered as is via `UIAppFonts`). If the app is sold, it is arguable whether that counts as selling the font; free distribution is the clear case.
- **Rating: OK-ATTRIBUTE** for a free app; ask KFGQPC if the app will be paid.

### 2.3 `mushaf.sqlite` (56 MB)

- **What:** 83,665 tokens with QCF V2 glyph codes (`code_v2`), page and line positions, Uthmani text (`text_uthmani`/`text_qpc_hafs`), surah/juz/hizb metadata, plus search tables the project computed from them.
- **Source:** the repo's fixtures `packages/quran-data/mushaf1441/fixtures`, fetched from the Quran.com API v4 on 2026-09-15 (`page-words-report.json`; the DB `meta.source` says "Quran.com API v4 verses by page metadata").
- **Verified terms:** QF's [Developer Terms](https://api-docs.quran.foundation/legal/developer-terms/) (last updated 2026-10-11) say developers must not cache QF Content longer than one week except through Content Sync, that Content Sync "does not itself authorize distributing a prepackaged database or build-time bundle", and that redistribution needs a signed commercial licence. An offline database built from API responses is the case these clauses describe. (The fetch predates this version of the terms; the version in force on 2026-09-15 was not checked.)
- **Underlying text:** the Madinah Mushaf text is KFGQPC's; the glyph-code mapping is tied to the QCF V2 fonts (2.1).
- **Rating: NEEDS PERMISSION** — a written licence from QF for a bundled dataset, or rebuild from a source whose terms allow bundling (for example data published by KFGQPC itself or another provider with an explicit licence; QUL publishes the same layouts but states no licence).

### 2.4 `mutshabehat.sqlite` (1.3 MB)

- **What:** the owner's 251 personal Mutashabihat groups (titles, colours, notes `note`/`unote`, verses, coloured parts); the automated-groups table is empty.
- **Rating: OK**, on the assumption that the groups and notes are the owner's own writing. Not a rights issue, but worth a decision: every user receives the owner's personal notes.

### 2.5 App icon and surah banners

- **App icon:** "the supplied blue «القراءات العشر» artwork" (commit `60609a1a`, 2026-10-07). Creator not recorded.
- **Illuminated banners (5 styles):** cut by `scripts/make_surah_banners.swift` from `docs/design/surah-banners-reference.jpg`, described as "the supplied sheet" with named styles (Emerald & Gold, Royal Blue & Ornate Gold, …). Creator not recorded; the names suggest an AI-generated or stock design sheet (assumption).
- **Classic banner** (`SurahBannerTemplate`, added in the v1.0 commit `22618573`): modelled on "the uploaded Ottoman/Mamluk illuminated manuscript reference" (`media_1790935697488.png`). Whether the template was traced or cut from that image is not recorded.
- **Rating: NEEDS PERMISSION** until the owner states who made each image and under what terms (own work, commissioned, stock licence, or AI tool whose terms grant commercial use). A photograph of a museum manuscript can carry the museum's or photographer's rights even when the manuscript is old.

### 2.6 Qiraat snapshot (39 MB)

- **What:** per page, variants (Hafs text, variant text, description, performance note, narrator ids), rulings (category, base text, explanatory `text`, per-narrator `action` wording) and page rules.
- **Source:** a snapshot of the owner's own web database (`fetch_qiraat.py`, default `https://mutshabehat-v2.vercel.app`). Per-row source citations are not carried into the snapshot (only the 8 page rules keep a `sources` field, citing «مصحف القراءات العشر (نسخة PDF …)»). See section 3 for where the rows came from.
- **Measured:** 62,716 of 127,048 text fields (descriptions, ruling texts, narrator actions) are exactly equal to a reading sentence in the nquran.com reference files; counting only distinctive sentences of 25+ characters, 392 different nquran sentences appear 23,250 times in ruling texts. Many short matches are formulaic (e.g. a one-line "قرأ بالإدغام الكبير"), but the long ones are nquran's own phrasing.
- **Verified terms:** nquran.com's footer says all rights are reserved for «موقع ن للقرآن وعلومه»; its service agreement (`?group=service`, Qatari law) says texts are the owner's property and may be used only in good faith "لأغراض غير تجارية", and not reproduced or distributed without the owner's consent.
- **Facts vs wording (assumption, not legal advice):** which narrator reads which word is a fact of transmission and is generally not protected by copyright; specific wording, and in some jurisdictions a compiled database, can be.
- **Rating: BLOCKER** for the nquran-verbatim wording (obtain nquran's written consent, or rewrite those fields in the project's own words). The remaining rows need the source answers in section 3 before they can be called OK.

### 2.7 Mutoon text and per-variant references

- **What:** the three poems verse by verse with chapter titles and printed page numbers; `references.json` quotes the relevant verse lines for 4,406 variants, with symbol decoding written by the project and a link back to shamela.ws.
- **Source:** shamela.ws books 7754 «متن الشاطبية … حرز الأماني», 7749 «متن الدرة المضية», 7795 «متن طيبة النشر», fetched page by page by `fetch_books.py`.
- **Authors:** الإمام الشاطبي (d. 590 AH; death year from general knowledge, not checked in the repo); ابن الجزري (751–833 AH, as printed on the Shamela page).
- **Verified terms:** [Shamela's terms page](https://shamela.ws/page/terms) (it covers Shamela's read-only service) says rights in books and editions remain with their owners and the terms give no right to reuse content beyond what law or the right holder allows.
- **Assumed:** the poems themselves are long out of copyright everywhere; the Shamela digital edition (who vowelled and typeset it, which printed edition the page numbers follow) is not identified in the files.
- **Rating: OK-ATTRIBUTE.** Credit the poets and Shamela; owner should identify the underlying printed edition if one is named on the Shamela book card.

### 2.8 Commentary (`mutoon-sharh.json`, 5.97 MB)

- **What:** the full text of two modern commentaries, keyed by verse: الوافي (1,173 verses, ~1.28 M characters) and الهادي (995 verses, ~2.07 M characters).
- **Source:** shamela.ws, fetched page by page (book 38075: «الوافي في شرح الشاطبية»; book 8650: «الهادي شرح طيبة النشر في القراءات العشر»).
- **Authors (from the local Shamela catalogue):** عبد الفتاح القاضي, death year 1403 AH (1982 CE); محمد سالم محيسن, death year 1422 AH (2001 CE). The catalogue lists no publisher, edition or editor for either.
- **Assumed:** under common copyright terms (life + 50 years in Egypt and Saudi Arabia, life + 70 in the US and EU) both works are still protected, and publishers usually hold the rights. Shamela's terms give no reuse right (2.7).
- **Rating: BLOCKER.** Remove from the Release bundle, or obtain written permission from the heirs/publishers of both books. Short quotations with attribution would be a different, much smaller case.

### 2.9 Symbol marks (`mutoon-symbols.json`)

- **What:** 3,693 marks on reader/narrator symbol letters in the poems, each with a short note (median 40 characters) and a citation such as "الهادي شرح طيبة النشر (محمد سالم محيسن)، ص ٤٠٢".
- **Rating: OK-ATTRIBUTE** — the owner's analysis; it cites 2.8 but sampled notes do not quote it. Keep the citations.

## 3. Where the Qiraat rows came from

From the repo docs and the CLAUDE.md changelog (web project) and the snapshot's id prefixes:

| Source (as named in the repo) | Evidence | Rows in snapshot | Author / rights holder |
| --- | --- | --- | --- |
| Scanned «مصحف القراءات العشر» PDFs (30 files, `docs/qiraat/source-pdf-manifest.json`), typed in page by page by the generators `scripts/qiraat/data_variants.py` / `data_rulings.py` | Changelog 2026-09-17 → 2026-09-22; rule sources "نسخة PDF المزوَّدة من طرف المستخدم" | Most of the 33,093 rows with generator/editor ids (exact split not recorded per row) | Not identified in the repo |
| «مصحف القراءات العشر المتواترة بالألوان الميسرة» (`BOOK_27159_1.pdf`), pages 1–40 | `docs/qiraat/INGESTION_REPORT_P001-040.md`, changelog 2026-09-24 | Included in the above (corroborations and 791 gap-fills) | Not identified |
| Ayah-by-ayah tables (surahs 19–56) and a page-by-page DOCX extract (pages 225–584) | Changelog 2026-09-20/22 | DOCX ids: 54 rows; tables merged into generator rows | Not identified ("supplied") |
| al-Susi extract `farsh_susi_complete_quran.json` | `docs/qiraat-susi-import-audit.json` | 1,583 rows | Not identified |
| al-Duri Google Sheet «رواية الدوري عن أبي عمرو مستخرجة» | `docs/qiraat-duri-import-audit.json` | 321 rows | Sheet owner not identified |
| `qiraat_pages_585_604` SQL/JSON | Changelog 2026-09-22 | 44 rows | Not identified |
| nquran.com «فروقات القراء» | The editor's ➕ button copies a group's reading text into «الأداء» (changelog 2026-09-29); automatic review compared every entry with nquran (memory note 2026-10-14) | Wording in ~23,000 text segments (2.6) | موقع ن للقرآن وعلومه — all rights reserved, non-commercial use only |
| «الشامل في قراءات الأئمة العشر» | The review editor's الشامل JSON is a copy of nquran (owner's note, 2026-10-20); the real الشامل scans were OCR'd for review only | Indirect (review decisions) | Not identified |
| Quranpedia dump | Used to corroborate attributions (changelog 2026-09-20) | None verbatim known | [Quranpedia Data License](https://quranpedia.net/dumps/LICENSE.md): free use in apps; credit required only when republishing as a dataset |
| Owner's own review and the automatic review (24,135 Arabic explanations generated, 8,089 automatic approvals) | Memory note 2026-10-14; Excel batch decisions | Explanatory `text` in many rulings | The owner (generated text; may paraphrase the books) |

What this means for redistribution (assumptions, not legal advice):

- The readings themselves (who reads what) are facts drawn from the classical tradition and are generally free to state. The risk is in **copied wording** and in **wholesale extraction** of a modern compilation.
- nquran wording is copied verbatim at scale and nquran reserves all rights → blocker until permission or rewrite.
- For the printed books and extracts, nobody in the repo is named as author or publisher. The owner needs to say what each one is. If a modern book's notes were typed in close to verbatim, that is the same issue as nquran.
- The snapshot carries no per-row source, so the app cannot show users where a reading came from. Keeping source citations in the export would help both review and attribution.

## 4. Acknowledgements screen — draft text

To be adjusted once the questions in section 5 are answered. Items in brackets depend on the answers.

> **المصادر والشكر**
>
> - نص المصحف وخطوط صفحاته (QCF V2) وخط «KFGQPC Uthmanic Script HAFS»: مجمع الملك فهد لطباعة المصحف الشريف، المدينة المنورة. حقوق الخطوط محفوظة للمجمع.
> - بيانات الكلمات وتخطيط الصفحات وخطوط الصفحات عبر Quran Foundation (Quran.com). Quran data provided by Quran.Foundation.
> - متن الشاطبية «حرز الأماني ووجه التهاني» للإمام الشاطبي (ت ٥٩٠هـ)، ومتنا «الدرة المضية» و«طيبة النشر» للإمام ابن الجزري (ت ٨٣٣هـ)، من نسخة المكتبة الشاملة (shamela.ws).
> - [شرحا «الوافي» لعبد الفتاح القاضي و«الهادي» لمحمد سالم محيسن — فقط إن أُذن بنشرهما؛ وإلا فيُذكران مرجعين للرموز.]
> - [بيانات القراءات: المصادر المطبوعة كما يحددها المالك، مع الناشر والطبعة.]
> - [موقع ن للقرآن وعلومه (nquran.com) — فقط إن أُذن باستعمال نصوصه.]
> - [Quranpedia.net — إن بقي مصدرًا.]
> - [الأيقونة وترويسات السور: الجهة المصممة.]
>
> **Sources and acknowledgements** (English)
>
> - Mushaf text, QCF V2 page fonts and the KFGQPC Uthmanic Script HAFS font: King Fahd Glorious Quran Printing Complex, Madinah. Font rights belong to the Complex.
> - Word data, page layout and page fonts via Quran Foundation (Quran.com). "Quran data provided by Quran.Foundation."
> - Matn texts of al-Shatibiyyah (al-Shatibi, d. 590 AH), al-Durrah and Tayyibat al-Nashr (Ibn al-Jazari, d. 833 AH), from the Shamela library edition.
> - [Further items as above.]

## 5. Questions the owner must answer, and permissions to obtain

**Decisions before submission**

1. Will the App Store build include `mutoon-sharh.json` (الوافي and الهادي)? If yes: who are the publishers/heirs, and do you have written permission? If no: delete or move `Generated/QiraatMutoon/mutoon-sharh.json` from the build machine, or change the copy script so Release skips it.
2. Will the nquran-derived wording stay in the Qiraat data? If yes, obtain written consent from nquran.com (موقع ن للقرآن وعلومه) covering a distributed iOS app (paid or free). If no, the ~23,000 affected text fields must be rewritten before the snapshot is bundled — and the live database the app syncs from must change too.
3. Is the app free or paid, and will it have ads or in-app purchases? The HAFS font EULA forbids selling the font, nquran allows non-commercial use only, and QF's terms differ for redistribution.

**Permissions and confirmations**

4. Quran Foundation: do you have an active Developer Console account under the name that will publish the app? Will you request a written licence for the bundled `mushaf.sqlite` (words, glyph codes, layout), or should it be rebuilt from another source?
5. KFGQPC: will you ask the Complex (or point to its published terms) for permission to bundle the 604 QCF V2 fonts and the Mushaf text in a distributed app?
6. App icon: who made it, and under what terms? (Own work, commissioned with assignment, stock licence, AI tool — which one and its terms.)
7. Surah banner sheet `docs/design/surah-banners-reference.jpg`: same question. And for `media_1790935697488.png` (the manuscript reference behind the classic banner): what is the image, where was it obtained, and was any of it traced or copied into `SurahBannerTemplate`?

**Identify the Qiraat sources** (author, title, publisher, edition, and how the data was obtained)

8. The scanned «مصحف القراءات العشر» volumes (30 PDFs in the manifest).
9. «مصحف القراءات العشر المتواترة بالألوان الميسرة» (`BOOK_27159_1.pdf`).
10. «الشامل في قراءات الأئمة العشر» (scans).
11. The al-Susi file `farsh_susi_complete_quran.json`, the al-Duri Google Sheet, the ayah-by-ayah tables, the page-by-page DOCX and `qiraat_pages_585_604`: who made each, and was the wording typed from a modern book?
12. Do the generated Arabic explanations (automatic review) reproduce any book's sentences, or are they paraphrases?

**Other**

13. Should every user receive your personal Mutashabihat notes (`mutshabehat.sqlite`), or should the bundle ship without the notes?
14. The Shamela matn books: does the book card name a printed edition or editor that should be credited?

## 6. How this was checked

- `project.yml` resource phases and scripts; `scripts/fetch_qcf_fonts.sh`, `build_mushaf_db.py`, `fetch_qiraat.py`, `build_mutoon.py`, `build_matn_sharh.py`, `build_review_reference.py`, `make_surah_banners.swift`, `release_guard.py`; `Generated/Shamela/fetch_books.py` and `fetch_sharh.py`.
- Listing and byte comparison of the Release product bundle.
- Font name tables read directly from the `.otf` and from a decompressed `p1.woff2`.
- Shamela book metadata from the local Shamela catalogue (books 38075, 8650).
- Text overlap measured by comparing normalised snapshot text fields with the nquran reference files in `Generated/Review/reference/nquran`.
- Web: QF Developer Terms and Mushaf Fonts and Images page (both updated 2026-10-11), QUL font licence page, nquran.com footer and service agreement, Shamela terms page, Quranpedia Data License (version 2026-10-30), ScanCode entry for the HAFS font licence. Not found: an official KFGQPC licence for QCF V2; any licence for the scanned Qiraat books.
