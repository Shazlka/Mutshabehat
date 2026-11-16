# 1. THEMES

This was a read-only source audit. No build, browser run, package installation, or repository mutation was performed.

## iOS Mushaf appearances

iOS exposes five choices under storage key `mushaf1441:theme:v1`: Automatic, Light, Dark, White Page, and Black Page. Automatic follows the system; Light/White force light chrome; Dark/Black force dark chrome. Desk always equals paper. A selected reader/narrator adds a 5% wash of the reader’s colour to both paper and desk. [MushafAppearance.swift:5–56](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Shared/MushafAppearance.swift:5) [QiraatPageTint.swift:3–26](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/MushafCore/Sources/MushafCore/QiraatPageTint.swift:3)

| iOS option | Arabic | Paper / desk | Ink | Brown | Gold |
|---|---|---:|---:|---:|---:|
| Automatic, light system | تلقائي / Automatic | `rgb(100% 99.2% 96.5%)` ≈ `#FFFDF6` | `rgb(9% 9% 9%)` ≈ `#171717` | `rgb(34.9% 27.5% 11.4%)` ≈ `#59461D` | `rgb(78% 62% 24%)` ≈ `#C79E3D` |
| Automatic, dark system | تلقائي / Automatic | `rgb(11% 10.5% 9%)` ≈ `#1C1B17` | `rgb(92% 91% 86%)` ≈ `#EBE8DB` | `rgb(82% 74% 55%)` ≈ `#D1BD8C` | `rgb(88% 75% 42%)` ≈ `#E0BF6B` |
| Light | فاتح / Light | same as automatic-light | same | same | same |
| Dark | داكن / Dark | same as automatic-dark | same | same | same |
| White Page | صفحة بيضاء / White Page | `#FFFFFF` | `#000000` | `rgb(20% 20% 20%)` = `#333333` | `rgb(72% 55% 20%)` ≈ `#B88C33` |
| Black Page | صفحة سوداء / Black Page | `#000000` | `#FFFFFF` | `rgb(78% 78% 78%)` ≈ `#C7C7C7` | `rgb(85% 72% 38%)` ≈ `#D9B861` |

The decimal RGB components above are the authoritative values; the hex values are rounded CSS equivalents. [MushafAppearance.swift:25–43](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Shared/MushafAppearance.swift:25) [MushafAppearance.swift:71–111](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Shared/MushafAppearance.swift:71)

The bookmark ribbon starts at `rgb(76% 22% 18%)` ≈ `#C2382E` and is moved toward ink in 6% steps until it reaches 3:1 against the current, possibly reader-washed paper. [MushafAppearance.swift:58–68](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Shared/MushafAppearance.swift:58)

### Shared Mushaf semantic colours

The shared `UIColor.mushaf*` values used by Qiraat sheets are not entirely identical to `MushafAppearance`: paper, ink, and brown match, but shared gold is `#9A7B35` light / `#C7AB61` dark rather than the appearance gold above. [MushafColors.swift:3–23](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Shared/MushafColors.swift:3)

| Token | Light | Dark |
|---|---:|---:|
| `mushafPaper` | `#FFFDF6` | ≈ `#1C1B17` |
| `mushafInk` | `#171717` | ≈ `#EBE8DB` |
| `mushafBrown` | `#59461D` | ≈ `#D1BD8C` |
| `mushafGold` | `#9A7B35` | `#C7AB61` |

### App semantic tokens

[AppColors.swift:70–101](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Design/AppColors.swift:70)

| Token | Meaning | Light | Dark |
|---|---|---:|---:|
| `progress` | Progress/completion text and rings | `#1A7340` | `#5FD38D` |
| `progressFill` | Selected/completed fill | `#1A7340` | `#23854D` |
| `switchOn` | All enabled switches | system green | system green |
| `caution` | Offline/remaining/undo | `#A14D07` | `#F7A65E` |
| `cautionFill` | Filled caution | `#A14D07` | `#A8530C` |
| `info` | Counts/time/neutral information | `#1B5FC1` | `#80B4FF` |
| `insight` | Secondary category | `#6A3DB0` | `#C3A5F7` |
| `favorite` | Favourite star | `#8F6A00` | `#F2C94C` |
| `danger` | Errors/destructive actions | `#B4232A` | `#FF8A8A` |

### iOS Qiraat sheet palette

[AppColors.swift:104–125](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Design/AppColors.swift:104)

| Token | Light | Dark |
|---|---:|---:|
| `qiraatCardFill` | `#FFFEFA` | `#27241E` |
| `qiraatCardStroke` | `#D9C99B` | `#5A5036` |
| `qiraatVariantInk` | `#7A1F1A` | `#F2A9A1` |
| `qiraatBadgeInk` | `#6B4A00` | `#F0D58A` |
| `qiraatBadgeFill` | `#F1E2B6` | `#4A3A12` |
| `qiraatReviewInk` | `#8A2F10` | `#FFC1A8` |
| `qiraatReviewFill` | `#F7D2C4` | `#5C2616` |
| `qiraatOnFillLight` | `#FFFFFF` | `#FFFFFF` |
| `qiraatOnFillDark` | `#16110A` | `#16110A` |

Data colours used for large glyphs, marks, and card text are contrast-adjusted toward the current ink only as far as necessary to reach 3:1. [AppColors.swift:127–169](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Design/AppColors.swift:127)

### Reader/narrator identity palette

The web and iOS both consume the canonical Qiraat catalogue palette. The existing web CSS variables are byte-identical to the TypeScript source. [colors.ts:5–17](/Users/amrelshazly/Projects/mutshabehat-v2/packages/qiraat-core/colors.ts:5) [globals.css:66–117](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/globals.css:66)

| Reader | Imam | Narrator 1 | Narrator 2 |
|---|---:|---:|---:|
| Nafiʿ | `#2563EB` | Qalun `#60A5FA` | Warsh `#1D4ED8` |
| Ibn Kathir | `#16A34A` | al-Bazzi `#4ADE80` | Qunbul `#15803D` |
| Abu ʿAmr | `#0891B2` | al-Duri `#67E8F9` | al-Susi `#0E7490` |
| Ibn ʿAmir | `#7C3AED` | Hisham `#A78BFA` | Ibn Dhakwan `#6D28D9` |
| ʿAsim | `#EA580C` | Shuʿbah `#FB923C` | Hafs `#C2410C` |
| Hamzah | `#DC2626` | Khalaf `#F87171` | Khallad `#B91C1C` |
| al-Kisaʾi | `#DB2777` | Abu al-Harith `#F472B6` | al-Duri `#BE185D` |
| Abu Jaʿfar | `#CA8A04` | Ibn Wardan `#FACC15` | Ibn Jammaz `#A16207` |
| Yaʿqub | `#B45309` | Ruways `#F59E0B` | Rawh `#92400E` |
| Khalaf al-ʿAshir | `#475569` | Ishaq `#94A3B8` | Idris `#334155` |
| Multiple readers | `#3F6212` | — | — |

### Surah-banner themes

iOS additionally offers six banner styles: Royal blue/gold, Emerald/gold, Ivory/navy, Night, Marble/rose-gold, and Classic following the Mushaf theme. The web has one theme-dependent SVG banner design, not these six selectable styles. [SurahBannerStyle.swift:4–52](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Reader/SurahBannerStyle.swift:4) [mushafTheme.ts:54–69](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/mushaf-1441/_components/mushafTheme.ts:54)

## Web today and exact diff

The web has only `sepia`, `dark`, and `white`. [mushafTheme.ts:1–3](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/mushaf-1441/_components/mushafTheme.ts:1)

- `sepia` paper `#FFFDF6` and ink `#171717` match iOS Light paper/ink, but its surrounding desk is `#EFE7D6`; iOS desk equals paper. Its other chrome tokens are a separate warm palette. [mushafTheme.ts:100–178](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/mushaf-1441/_components/mushafTheme.ts:100)
- Web dark paper `#18191D`, ink `#F1F5F9`, and desk `#0F1013` do not match iOS `rgb(11% 10.5% 9%)`, `rgb(92% 91% 86%)`, with desk equal to paper. [mushafTheme.ts:181–259](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/mushaf-1441/_components/mushafTheme.ts:181)
- Web white paper `#FFFFFF` is correct, but ink is blue-black `#0F172A`, not iOS `#000000`; desk is `#F4F4F5`, not white. [mushafTheme.ts:262–340](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/mushaf-1441/_components/mushafTheme.ts:262)
- Automatic and Black Page are missing.
- Reader/narrator 5% page wash is missing.
- Web Qiraat UX tokens are one light-only palette, and many cards explicitly use `bg-white`; therefore dark Qiraat sheets do not mirror the iOS dynamic palette. [globals.css:119–156](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/globals.css:119) [FeatureSheet.tsx:34–57](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/mushaf-1441/_features/host/FeatureSheet.tsx:34)
- Web theme selection exposes three options only. [Mushaf1441Viewer.tsx:4621–4666](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx:4621)

## Ready-to-paste CSS custom-property target

```css
/* Exact iOS reader palette. Decimal percentages preserve the Swift values. */
:root,
[data-mushaf-theme="system"],
[data-mushaf-theme="light"] {
  --mushaf-paper: rgb(100% 99.2% 96.5%);
  --mushaf-desk: var(--mushaf-paper);
  --mushaf-ink: rgb(9% 9% 9%);
  --mushaf-brown: rgb(34.9% 27.5% 11.4%);
  --mushaf-gold: rgb(78% 62% 24%);

  --app-progress: #1A7340;
  --app-progress-fill: #1A7340;
  --app-caution: #A14D07;
  --app-caution-fill: #A14D07;
  --app-info: #1B5FC1;
  --app-insight: #6A3DB0;
  --app-favorite: #8F6A00;
  --app-danger: #B4232A;

  --qiraat-card-fill: #FFFEFA;
  --qiraat-card-stroke: #D9C99B;
  --qiraat-variant-ink: #7A1F1A;
  --qiraat-badge-ink: #6B4A00;
  --qiraat-badge-fill: #F1E2B6;
  --qiraat-review-ink: #8A2F10;
  --qiraat-review-fill: #F7D2C4;
  --qiraat-on-fill-light: #FFFFFF;
  --qiraat-on-fill-dark: #16110A;
  --qiraat-page-wash: 5%;
}

[data-mushaf-theme="dark"] {
  --mushaf-paper: rgb(11% 10.5% 9%);
  --mushaf-desk: var(--mushaf-paper);
  --mushaf-ink: rgb(92% 91% 86%);
  --mushaf-brown: rgb(82% 74% 55%);
  --mushaf-gold: rgb(88% 75% 42%);

  --app-progress: #5FD38D;
  --app-progress-fill: #23854D;
  --app-caution: #F7A65E;
  --app-caution-fill: #A8530C;
  --app-info: #80B4FF;
  --app-insight: #C3A5F7;
  --app-favorite: #F2C94C;
  --app-danger: #FF8A8A;

  --qiraat-card-fill: #27241E;
  --qiraat-card-stroke: #5A5036;
  --qiraat-variant-ink: #F2A9A1;
  --qiraat-badge-ink: #F0D58A;
  --qiraat-badge-fill: #4A3A12;
  --qiraat-review-ink: #FFC1A8;
  --qiraat-review-fill: #5C2616;
}

[data-mushaf-theme="whitePage"] {
  --mushaf-paper: #FFFFFF;
  --mushaf-desk: #FFFFFF;
  --mushaf-ink: #000000;
  --mushaf-brown: #333333;
  --mushaf-gold: rgb(72% 55% 20%);
}

[data-mushaf-theme="blackPage"] {
  --mushaf-paper: #000000;
  --mushaf-desk: #000000;
  --mushaf-ink: #FFFFFF;
  --mushaf-brown: rgb(78% 78% 78%);
  --mushaf-gold: rgb(85% 72% 38%);
}

@media (prefers-color-scheme: dark) {
  [data-mushaf-theme="system"] {
    --mushaf-paper: rgb(11% 10.5% 9%);
    --mushaf-desk: var(--mushaf-paper);
    --mushaf-ink: rgb(92% 91% 86%);
    --mushaf-brown: rgb(82% 74% 55%);
    --mushaf-gold: rgb(88% 75% 42%);

    --app-progress: #5FD38D;
    --app-progress-fill: #23854D;
    --app-caution: #F7A65E;
    --app-caution-fill: #A8530C;
    --app-info: #80B4FF;
    --app-insight: #C3A5F7;
    --app-favorite: #F2C94C;
    --app-danger: #FF8A8A;

    --qiraat-card-fill: #27241E;
    --qiraat-card-stroke: #5A5036;
    --qiraat-variant-ink: #F2A9A1;
    --qiraat-badge-ink: #F0D58A;
    --qiraat-badge-fill: #4A3A12;
    --qiraat-review-ink: #FFC1A8;
    --qiraat-review-fill: #5C2616;
  }
}

/* Apply a selected reader's existing canonical hex without changing identity tokens. */
[data-qiraat-reader-color] {
  --mushaf-paper-tinted:
    color-mix(in srgb, var(--qiraat-reader-color) var(--qiraat-page-wash),
                      var(--mushaf-paper));
}
```

Retain the existing `--q01-*` through `--q10-*` identity variables unchanged.

# 2. CHROME & MENUS

## Phone-width parity matrix

| iOS surface/control | iOS label, icon, behaviour/state | Web phone equivalent | Status | Concrete change |
|---|---|---|---|---|
| Top information bar | Always-visible 52pt slot: page number, tappable Surah title/index action, Juz, Hizb, Rub disc; tap elsewhere toggles footer. [ReaderTopBar.swift:145–209](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Reader/ReaderTopBar.swift:145) | Top bar has hamburger, Surah picker, page frame, home, notes, Mutshabehat and Qiraat buttons. [Mushaf1441Viewer.tsx:4853–4983](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx:4853) | **PARTIAL** | Make the phone top bar informational: page/Surah/Juz/Hizb/Rub. Move actions to a six-item footer. Preserve Surah tap → full index. |
| Top Qiraat filter chip | Appears only while Qiraat is enabled; uses selected reader/narrator colour; tap opens picker; selected trait and “Qira’at: …” accessibility label. [ReaderTopBar.swift:278–329](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Reader/ReaderTopBar.swift:278) | Filter chip exists only inside drawer/sidebar Qiraat hub. [QiraatHubBar.tsx:34–48](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/mushaf-1441/_features/hub/QiraatHubBar.tsx:34) | **PARTIAL** | Add chip to phone header when Qiraat is active. |
| Footer: Index | `الفهرس / Index`, `list.bullet`; opens Index sheet. | Surah-title picker exists, but only Surahs. [Mushaf1441Viewer.tsx:4869–4896](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx:4869) | **PARTIAL** | Add footer item and full Surah/Juz/Bookmarks index sheet. |
| Footer: Search | `بحث / Search`, `magnifyingglass`; opens full Quran search. | No phone reader-wide Quran search control or equivalent sheet. | **MISSING** | Port the three-mode Quran search entry/sheet or deliberately link to an existing shared search implementation. |
| Footer: Bookmarks | `الفواصل / Bookmarks`, `bookmark.fill`; opens dedicated bookmarks view. | Bookmarks exist only through the annotations layer/context editor, not as a dedicated reader entry. [Mushaf1441Viewer.tsx:2348–2424](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx:2348) | **MISSING** | Add footer entry and dedicated list/filter/search/jump UI. |
| Footer: Qiraat | `القراءات / Qira’at`, `character.book.closed(.fill)`; accessibility value `مفعّلة / On` or `متوقفة / Off`; opens popover. [ReaderBottomBar.swift:111–121](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Reader/ReaderBottomBar.swift:111) | Top `ق` toggles the layer; hub lives in drawer. [Mushaf1441Viewer.tsx:4968–4981](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx:4968) | **PARTIAL** | Use the footer item as the menu entry while retaining a clear enabled/off state. |
| Footer: More | `المزيد / More`, `ellipsis.circle`; opens More popover. | Functions are scattered between the home link and Qiraat menu. | **MISSING** | Add native-equivalent More menu. |
| Footer: Settings | `الإعدادات / Settings`, `gearshape.fill`; opens Settings. | Hamburger drawer has a gear opening appearance only. [Mushaf1441Viewer.tsx:5157–5232](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx:5157) | **PARTIAL** | Add footer entry and expand Settings beyond appearance. |
| Footer interaction | Six equal action items; no item remains selected; Liquid Glass/system tab bar; Qiraat and More open on finger-down, support slide-to-row, and auto-hide after 10s when enabled. [FooterTabBar.swift:4–9](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Reader/FooterTabBar.swift:4) [ReaderBottomBar.swift:137–177](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Reader/ReaderBottomBar.swift:137) | No footer action bar. Permanent page slider occupies the bottom. [Mushaf1441Viewer.tsx:5091–5154](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx:5091) | **MISSING** | Replace/re-home the slider; implement footer overlay without moving the page. |
| Qiraat menu: enable | `إظهار علامات القراءات / Show Qira’at Marks`, checkmark state. | Top `ق` enables/disables; hub lacks the switch. | **PARTIAL** | Put the switch in the Qiraat footer menu; keep top/filter state synchronized. |
| Qiraat menu: filter | Current filter name, `line.3.horizontal.decrease.circle`; disabled when layer off. | Filter chip opens picker. [QiraatHubBar.tsx:37–47](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/mushaf-1441/_features/hub/QiraatHubBar.tsx:37) | **MATCH** functionally | Place it in the phone popover and retain 44px coarse-pointer target. |
| Qiraat menu: colour key | `مفتاح الألوان / Color Key`, `paintpalette`. | Hub entry exists. [QiraatFeaturesHost.tsx:21–29](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/mushaf-1441/_features/host/QiraatFeaturesHost.tsx:21) | **MATCH** | Placement only. |
| Qiraat menu: page differences | `خلافات الصفحة / Page Differences`, `list.bullet.rectangle`. | Called `ملخص الصفحة`; opens summary. | **PARTIAL** | Align label to `خلافات الصفحة` or consciously standardize both clients. |
| Qiraat menu: search | `البحث في القراءات / Search Qira’at`, `magnifyingglass`. | `بحث في القراءات` exists. | **MATCH** | Placement only. |
| Qiraat menu: Usul | `أصول القراءات / Qira’at Usul`, `books.vertical`; hidden when “Farsh only” is enabled. [QiraatHub.swift:20–50](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Qiraat/QiraatHub.swift:20) | `فهرس الأصول` exists, but hub entry is not hidden through exactly the same UI state. [QiraatFeaturesHost.tsx:22–29](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/mushaf-1441/_features/host/QiraatFeaturesHost.tsx:22) | **PARTIAL** | Drive entry visibility from the existing Usul preferences. |
| More menu | `المتشابهات / Mutashabihat` `square.stack.3d.up.fill`; `الحفظ / Memorization` `book.closed.fill`; `المتون / Mutun` `books.vertical.fill`. [ReaderBottomBar.swift:211–220](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Reader/ReaderBottomBar.swift:211) | Mutashabihat is a home link; Memorization is absent; Mutun is inside the Qiraat hub. | **PARTIAL** | Add the three-row More menu. Memorization implementation itself remains out of this audit’s scope. |
| Action rail | iPad-only vertical mirror of all six footer items, 56pt buttons, Qiraat/More popovers. [ReaderActionRail.swift:51–82](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Reader/ReaderActionRail.swift:51) | At phone width there is no rail, appropriately. | **MISSING/N/A at phone width** | Do not add a phone rail; ensure the footer supplies equivalent access. |
| Settings: reading | Statistics `chart.bar.xaxis`; Bookmarks `bookmark.fill`; Keep Screen Awake toggle; Hide Footer after 10 seconds toggle. [ReaderSettingsView.swift:35–72](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Reader/ReaderSettingsView.swift:35) | Appearance-only modal. [Mushaf1441Viewer.tsx:4621–4844](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx:4621) | **MISSING** | Add reader preferences; statistics implementation is out of scope, but its entry must be represented for chrome parity. |
| Settings: Qiraat | Enable; reader picker `person.2.fill`; Farsh-only; show sub-category; Usul categories `books.vertical`; unavailable-data warning. [ReaderSettingsView.swift:75–129](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Reader/ReaderSettingsView.swift:75) | Toolbar and Usul preference panel exist in the drawer, not Settings. [Mushaf1441Viewer.tsx:5258–5289](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx:5258) | **PARTIAL** | Consolidate persistent Qiraat preferences into Settings; reuse existing logic. |
| Settings: preferences | Appearance `circle.lefthalf.filled`; Surah banner `rectangle.inset.filled`; Language `globe`; page turn `book.pages` with Curl/Slide; iPad landscape mode. [ReaderSettingsView.swift:150–200](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Reader/ReaderSettingsView.swift:150) | Appearance has three choices; banner, language and page-turn settings absent. Web always curls. | **PARTIAL** | Add five appearances, six banner styles, Arabic/English chrome selector, and Curl/Slide selector. |
| Settings: legal | Privacy `hand.raised.fill`; Support `questionmark.circle`; Acknowledgements `text.book.closed`; app version. [ReaderSettingsView.swift:255–285](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Reader/ReaderSettingsView.swift:255) | Not in reader settings. | **MISSING** | Add links/version if web product requirements call for full app-settings parity. |
| Index sheet | Tabs `السور`, `الأجزاء`, `الفواصل`; Surah progress filters; current/completed state; selecting a Surah resumes next unread page. [IndexSheet.swift:5–18](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Reader/IndexSheet.swift:5) [IndexSheet.swift:59–199](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Reader/IndexSheet.swift:59) | Full-screen phone Surah picker with name/number search, current state, ayah count and first page. [Mushaf1441Viewer.tsx:4510–4617](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx:4510) | **PARTIAL** | Retain search; add Juz and Bookmarks tabs. Reading-progress details are out of scope. |
| Quran search | Smart/Exact/Broad modes; Arabic/English title; field, clear, submit, empty state; result Share and jump. [AyahSearchView.swift:51–107](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Reader/AyahSearchView.swift:51) [AyahSearchView.swift:138–226](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Reader/AyahSearchView.swift:138) | No equivalent general Quran search sheet. | **MISSING** | Port or expose the existing search engine behind the footer Search action. |
| Bookmark entry/list | Dedicated All/Ayahs/Pages segmented filter, search, jump, swipe-delete, Arabic preview. [BookmarksView.swift:14–116](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Reading/BookmarksView.swift:14) | Bookmark creation exists in annotation menus, but no equivalent list. | **PARTIAL** | Create dedicated list using existing annotation bookmark records. |

# 3. QIRAAT FEATURES

| Feature | iOS reference | Web phone reference | Status | Exact parity change |
|---|---|---|---|---|
| Colour key / legend | Three tabs: word marks, reader/narrator colours, Usul; covers solid, segmented, performance, unresolved, dotted, family dot, imalah, taqlil and ruling-word marks. [QiraatLegendSheet.swift:12–89](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Qiraat/QiraatLegendSheet.swift:12) [QiraatLegendSheet.swift:521–552](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Qiraat/QiraatLegendSheet.swift:521) | Same three domains and mark drawings. [LegendSheet.tsx:9–35](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/mushaf-1441/_features/legend/LegendSheet.tsx:9) | **MATCH** functionally | Align tab names/order and theme the cards with dynamic Qiraat tokens. |
| Top menu + filter chip | Footer Qiraat popover plus selected-reader chip in the top bar. | Hub filter and More menu exist only inside drawer/sidebar. [QiraatHubBar.tsx:11–72](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/mushaf-1441/_features/hub/QiraatHubBar.tsx:11) | **PARTIAL** | Move phone access to footer; expose chip in header. |
| Page summary | Locally scans installed data, groups by ayah, supports live-refresh notifications, distinguishes unavailable from empty, jumps to word. [QiraatPageSummaryView.swift:38–97](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Qiraat/QiraatPageSummaryView.swift:38) | Lists marked words on visible page(s), variants/rulings/authority pills, then selects the word. [PageSummarySheet.tsx:11–68](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/mushaf-1441/_features/page-summary/PageSummarySheet.tsx:11) | **MATCH** core UI; **PARTIAL** state semantics | Add explicit unavailable/loading distinction and align title to `خلافات الصفحة`. |
| Offline Qiraat search | Installed local index; reader/narrator, word with ignore-tashkeel, or category; reports missing local pages. [QiraatSearchView.swift:13–55](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Qiraat/QiraatSearchView.swift:13) [QiraatSearchView.swift:62–128](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Qiraat/QiraatSearchView.swift:62) | Same three scopes, but `useAllPagesData` fetches all pages and reports loading/failures. [QiraatSearchSheet.tsx:21–53](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/mushaf-1441/_features/search/QiraatSearchSheet.tsx:21) | **PARTIAL** | Add a versioned offline cache/service worker or relabel it as online search; add ignore-tashkeel control if not already implicit in the core search. |
| Usul index | Local category/place index and direct jump. | Loads all web pages, groups categories and progressively exposes places. [UsulIndexSheet.tsx:9–73](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/mushaf-1441/_features/usul-index/UsulIndexSheet.tsx:9) | **PARTIAL** | Offline-cache the index; otherwise presentation is substantially equivalent. |
| Compare | Select up to two readers/narrators; side-by-side voices, several loci, Wajh and Usul status. | Two-authority picker, locus selector, verdict, side-by-side readings and Usul. [CompareSheet.tsx:59–101](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/mushaf-1441/_features/compare/CompareSheet.tsx:59) | **MATCH** | Theme via semantic Qiraat tokens. |
| Word sheet navigation | Previous/next marked word, position `N من M`, 44pt controls; recovers nearest selection. [QiraatSheetNavigator.swift:35–80](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Qiraat/QiraatSheetNavigator.swift:35) [QiraatSheetNavigator.swift:93–135](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Qiraat/QiraatSheetNavigator.swift:93) | Previous/next and position are wired to the marked list. [WordSheetNav.tsx:21–34](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/mushaf-1441/_features/word-sheet/WordSheetNav.tsx:21) [Mushaf1441Viewer.tsx:4099–4114](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx:4099) | **MATCH** | Localize English and use Arabic digits if strict visual parity is required. |
| Face numbers | iOS cards expose numbered Wajh badges where multiple faces exist. | `variantWajhNumbers` and `FaceBadge` are rendered per variant. [Mushaf1441Viewer.tsx:4070–4137](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx:4070) | **MATCH** | Theme tokens only. |
| Live-sync status | Current, confirmed elapsed time, or local copy; checkmark/clock/internal-drive icons; offline accessibility value. Report opens a prefilled Share sheet without sending data automatically. [QiraatSyncStatusView.swift:8–69](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Qiraat/QiraatSyncStatusView.swift:8) [QiraatSyncStatusView.swift:102–174](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Qiraat/QiraatSyncStatusView.swift:102) | Same status abstraction and online/offline monitoring; report uses Web Share or clipboard. [SyncStatusChip.tsx:19–33](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/mushaf-1441/_features/sync-status/SyncStatusChip.tsx:19) [ReportErrorButton.tsx:7–27](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/mushaf-1441/_features/sync-status/ReportErrorButton.tsx:7) | **MATCH** | Use the iOS dynamic status palette in dark mode. |
| Favourites + personal notes | Star/unstar; modal note editor with explicit Save/Cancel; SQLite-backed shared notes list and backup integration. [QiraatNoteButton.swift:14–60](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Qiraat/QiraatNoteButton.swift:14) [QiraatNoteButton.swift:64–129](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Qiraat/QiraatNoteButton.swift:64) | Favourite and debounced note editor use local IndexedDB; Notes panel supports JSON export/import and word jump. [WordNotes.tsx:35–67](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/mushaf-1441/_features/notes/WordNotes.tsx:35) [NotesPanel.tsx:10–67](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/mushaf-1441/_features/notes/NotesPanel.tsx:10) | **PARTIAL** | Decide whether web should preserve auto-save or mirror explicit Save/Cancel; clearly label device-only persistence. |
| Reader picker | Search, All, reader/narrator hierarchy, identity colours; single-tap selection; multi-select compare mode. | Same functional model and two-selection compare mode. [ReaderPicker.tsx:13–96](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/mushaf-1441/_features/reader-picker/ReaderPicker.tsx:13) | **MATCH** | English chrome and dynamic theme support. |
| Mutun | Books, chapters, full-text/verse-number search, verse sheets, previous/next, source pages, Sharh text, reader/narrator symbols and symbol explanations. [MutoonView.swift:119–182](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Qiraat/MutoonView.swift:119) [MutoonView.swift:450–696](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Qiraat/MutoonView.swift:450) | Books/chapters/search and verse text only. [MutoonSheet.tsx:9–95](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/mushaf-1441/_features/mutoon/MutoonSheet.tsx:9) | **PARTIAL** | Add verse detail/navigation, Sharh/page references, and interactive authority symbols. |
| Scholarly references row | Per variant: Shatibiyyah, Durrah, Tayyibah; verse/page/status; exact lines; symbols/readers; mismatch warning; source link. [QiraatReferencesRow.swift:18–69](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Qiraat/QiraatReferencesRow.swift:18) [QiraatReferencesRow.swift:73–159](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Qiraat/QiraatReferencesRow.swift:73) | Web has a general reader/symbol reference dictionary, not per-variant scholarly evidence. [QiraatReferenceSheet.tsx:14–30](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/mushaf-1441/_components/qiraat/QiraatReferenceSheet.tsx:14) | **MISSING** | Define/load per-variant reference data and render a collapsible row in each variant card. Do not treat the general symbol dictionary as equivalent. |
| First-use hint | One-time `hand.tap` hint, “المس كلمة ملوّنة لعرض قراءاتها”, dismiss button, remembered state, automatic dismissal after 8 seconds. [QiraatFirstUseHint.swift:3–41](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Qiraat/QiraatFirstUseHint.swift:3) | No equivalent persisted first-use hint. The empty Qiraat panel contains instructional prose only after opening the panel. [Mushaf1441Viewer.tsx:4062–4068](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx:4062) | **MISSING** | Add a persisted, dismissible, eight-second hint when Qiraat is enabled for the first time. |

# 4. BEHAVIOUR

| Area | iOS | Web phone | Difference |
|---|---|---|---|
| Page turning | RTL book: next page is revealed by lifting the left edge; optional Curl or Slide; Reduce Motion forces single-page Slide. Tap-to-turn inside `UIPageViewController` is disabled. [MushafPager.swift:5–17](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Reader/MushafPager.swift:5) [MushafPager.swift:68–119](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Reader/MushafPager.swift:68) | Drag right → next, left → previous; begins after horizontal intent, commits after 30% travel or velocity `>0.35`; also taps left/right halves and supports wheel/trackpad. [Mushaf1441Viewer.tsx:1720–1800](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx:1720) [Mushaf1441Viewer.tsx:1817–1845](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx:1817) | Direction matches. Web lacks Slide selection and differs by supporting half-page tap navigation. |
| Chrome gesture | Centre tap toggles footer; footer may auto-hide after ten seconds. | Page taps turn pages; chrome remains visible. | **Different**. A direct port must reserve centre tap for chrome or consciously retain web tap navigation. |
| Long press | Native word/ayah press and bookmark/options path, approximately 0.45s; native haptic at recognition. | 480ms touch timer; opens the active layer’s menu and vibrates only when an action actually opens. [Mushaf1441Viewer.tsx:375](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx:375) [Mushaf1441Viewer.tsx:1868–1886](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx:1868) | **Near match**; web is 30ms longer. |
| Haptics | Medium impact for marked-word opening/row choice; lighter selection tick while crossing menu rows; prewarms generators. [Haptics.swift:3–38](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Shared/Haptics.swift:3) | Best-effort 15ms Vibration API, otherwise synthetic iOS switch haptic. [haptics.ts:3–16](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/mushaf-1441/_components/haptics.ts:3) [haptics.ts:46–60](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/mushaf-1441/_components/haptics.ts:46) | Web cannot reproduce distinct native intensities or menu-row selection ticks reliably. |
| RTL | Arabic chrome RTL; English chrome LTR; pager geometry is deliberately forced LTR internally so physical book direction does not mirror. Quran content remains Arabic. [AppLanguage.swift:28–41](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Shared/AppLanguage.swift:28) [MushafPager.swift:80](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Reader/MushafPager.swift:80) | Root and sheets are always `dir="rtl"`; some metadata uses `dir="ltr"`. [Mushaf1441Viewer.tsx:4847–4853](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx:4847) | Web lacks English/LTR chrome mode. |
| Localisation | Persisted Arabic/English choice; device-default Arabic only when the first preferred language has `ar` subtag. Footer translations include Index, Search, Bookmarks, Qira’at, More and Settings. [AppLanguage.swift:3–25](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Shared/AppLanguage.swift:3) [Localizable.xcstrings:3020](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Localizable.xcstrings:3020) | Reader chrome is Arabic-only. | **MISSING** English chrome and direction switch. |
| Hit targets | Reusable 44×44pt minimum target; filter chips have a compact capsule within a 44pt target. [MinimumHitTarget.swift:3–14](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Design/MinimumHitTarget.swift:3) [FilterChip.swift:3–25](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Design/FilterChip.swift:3) | Qiraat features generally raise controls to 44px only under coarse pointer; some phone Surah controls are 36px. [FeatureSheet.tsx:45–55](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/mushaf-1441/_features/host/FeatureSheet.tsx:45) [Mushaf1441Viewer.tsx:4523–4535](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx:4523) | Make all phone interactive targets at least 44 CSS px. |
| Motion/accessibility settings | 220ms quartic ease-out; movement becomes immediate with Reduce Motion. Glass becomes opaque with a 0.5pt separator under Reduce Transparency or Increased Contrast. [Motion.swift:4–15](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Design/Motion.swift:4) [ChromeContrast.swift:3–12](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Shared/ChromeContrast.swift:3) | Global reduced-motion rule collapses animations/transitions; no equivalent reduced-transparency/high-contrast surface policy. [globals.css:187–200](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/globals.css:187) | Add `prefers-contrast`/forced-colours treatment and opaque fallback for translucent surfaces. |
| Screen-reader Mushaf model | Exposes page, Surah headers, basmala, full ayah Arabic text, Qiraat words, bookmark state, custom next/previous-page actions and VoiceOver scrolling. [MushafPageView.swift:274–316](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Reader/MushafPageView.swift:274) [MushafPageView.swift:335–413](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Reader/MushafPageView.swift:335) | Lines have page/line labels and words have detailed button labels; dialogs have focus trapping and restoration. [Mushaf1441Viewer.tsx:3072](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx:3072) [FeatureSheet.tsx:12–31](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/mushaf-1441/_features/host/FeatureSheet.tsx:12) | **PARTIAL**: web needs ayah-level reading units, page custom actions, and explicit Arabic language metadata. |
| Modal semantics | Native sheets, selected traits, accessibility hints/values, escape handling for custom modal popovers. [BarPopoverMenu.swift:98–146](/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Shared/BarPopoverMenu.swift:98) | Qiraat feature sheets correctly use modal dialog, focus trap, Escape, close focus and focus return. [FeatureSheet.tsx:12–52](/Users/amrelshazly/Projects/mutshabehat-v2/src/app/mushaf-1441/_features/host/FeatureSheet.tsx:12) | **MATCH** for feature sheets; drawer and Surah picker should receive equivalent focus containment. |

# 5. TASK SPLIT

| Order | Task | Web files to touch | iOS files to mirror | Size | Parallel/conflict notes |
|---:|---|---|---|---|---|
| 1 | Canonical five-theme token layer | `mushafTheme.ts`, `globals.css`, Qiraat `FeatureSheet.tsx` and card classes | `MushafAppearance.swift`, `MushafColors.swift`, `AppColors.swift` | **L** | Can run independently. Avoid `Mushaf1441Viewer.tsx` initially by exposing token APIs first. |
| 2 | Phone footer and information-header shell | `Mushaf1441Viewer.tsx`; preferably new `_components/ReaderPhoneChrome.tsx` and `_components/ReaderFooter.tsx` | `ReaderTopBar.swift`, `ReaderBottomBar.swift`, `FooterTabBar.swift`, `BarPopoverMenu.swift` | **L** | **Must touch `Mushaf1441Viewer.tsx`**. Do not run in parallel with tasks 3 or 4 unless ownership boundaries are agreed. |
| 3 | Full Index, Quran Search and Bookmarks entry points | New `_features/index/*`, `_features/quran-search/*`, `_features/bookmarks/*`; viewer wiring | `IndexSheet.swift`, `AyahSearchView.swift`, `BookmarksView.swift` | **L** | Feature components can run parallel; final wiring **must touch `Mushaf1441Viewer.tsx`**. |
| 4 | Full reader Settings and persisted preferences | New `_features/settings/ReaderSettings.tsx`, preferences module, theme/banner/page-turn controls | `ReaderSettingsView.swift`, `SurahBannerSettingsView.swift`, `AppLanguage.swift`, `ReaderLayout.swift` | **L** | Core settings can run parallel with task 3; final opening/state wiring **must touch `Mushaf1441Viewer.tsx`**. |
| 5 | Qiraat phone hub placement + first-use hint | `QiraatHubBar.tsx`, new `QiraatFirstUseHint.tsx`, preferences storage, viewer wiring | `QiraatHub.swift`, `QiraatFirstUseHint.swift`, `ReaderTopBar.swift` | **M** | **Must touch `Mushaf1441Viewer.tsx`**. Best after task 2’s chrome structure. |
| 6 | Dark/theme-safe Qiraat component conversion | All `_features/*` cards, pills and sheets; remove `bg-white`/hardcoded light colours | `AppColors.swift`, `QiraatPills.swift`, `VariantCard.swift`, `RulingCard.swift` | **M** | Can run in parallel with tasks 2–5 after task 1 defines tokens; should not need the viewer. |
| 7 | Per-variant scholarly references | Qiraat reference types/data loader, new `ScholarlyReferencesRow.tsx`, word-card integration | `QiraatReferencesRow.swift`, `VariantCard.swift`, `QiraatSheet.swift` | **L** | UI/data work can run independently. Final integration currently **must touch `Mushaf1441Viewer.tsx`** unless the word sheet is extracted first. |
| 8 | Mutun detail/symbol parity and offline Qiraat indexes | `MutoonSheet.tsx`, mutoon API/types; `allPagesData.ts`; search/Usul caching | `MutoonView.swift`, `QiraatSearchView.swift`, `UsulIndexView.swift` | **L** | Can run in parallel with chrome tasks; no viewer edit should be necessary. |

The main conflict hotspot is therefore tasks **2, 3, 4, 5, and 7**. Before implementing them, extracting the phone chrome and Qiraat word-sheet body out of the 5.4k-line `Mushaf1441Viewer.tsx` would materially reduce merge conflicts.

