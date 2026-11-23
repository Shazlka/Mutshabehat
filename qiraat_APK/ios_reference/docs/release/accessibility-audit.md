# Qiraat iOS: accessibility audit for App Store release (v1)

Date: 2026-11-03. Scope: `apps/ios/Sources` and `apps/ios/MushafCore/Sources`, everything outside `#if DEBUG`.
Method: static reading of the source only. Nothing was built or run, and no VoiceOver, Voice Control, Switch Control or
Dynamic Type pass was done on a device or simulator. Every item below should be confirmed with one real VoiceOver walk-through
before submission. Paths are relative to `apps/ios/`.

## Summary

The reader core is in good shape and clearly built with accessibility in mind:

- The QCF Private Use Area glyphs are never exposed to VoiceOver. `MushafPageView` replaces them with its own element tree:
  page, surah header (`.header` trait), basmala, one element per ayah carrying the canonical Uthmani text (`textUthmani`,
  `accessibilityLanguage = "ar"`), and one element per Qiraat-marked word (`Sources/Reader/MushafPageView.swift:259-370`).
  The sheet header does the same for its QCF glyph (`Sources/Qiraat/QiraatSheet.swift:206-208`).
- The gesture-only actions have accessible alternatives. Page turn: `accessibilityScroll` and "next/previous page" custom actions
  (`MushafPageView.swift:265-272, 372-379`). Long-press ayah options: element activation plus a custom action (`:333-344`).
  Qiraat word-to-word swipe: `QiraatSheetNavigator` buttons. Surah completion swipe: `accessibilityAction(named:)`
  (`Sources/Reading/ReadingStatisticsCards.swift:460-466`). Memorization page long press: named action (`Sources/Memorization/PageGridView.swift:103`).
- The custom Liquid Glass footer menus are modal for VoiceOver and close on the escape gesture (`Sources/Reader/BarPopoverMenu.swift:139-142`).
- Colour is mostly backed by text or shape: reader pills carry an initial letter and the name in ink (`Sources/Qiraat/QiraatPills.swift`),
  memorization status has shapes, and the needs-review badge has an icon and words.
- Contrast is covered by tests (`Tests/QiraatContrastTests.swift`, `Tests/ReaderHeaderContrastTests.swift`). That includes mark colours at 3:1 on all five page themes.
- Reduce Motion is honoured in the page curl, the footer menus, `withMotion`, and the 3D transitions.
- Targets: `FilterChip` is 44 pt, `PageStatusMark` is 44 pt, the Mutoon clear button is 44 pt, and the footer/rail items are large-content-viewer enabled.

The gaps are concentrated in the "المتشابهات" (Mutshabehat) feature and in a few icon-only buttons elsewhere, plus first-launch language.

## MUST-FIX for v1

### M1. Mutshabehat screens: icon-only buttons without labels, state or 44 pt targets

The "المزيد > المتشابهات" row is reachable from the reader's footer (`Sources/Reader/ReaderBottomBar.swift:212`), so a reviewer
will tap through it. Nothing in `Sources/Mutshabehat` sets an accessibility label except the colour swatches
(`MutshabehatGroupEditorView.swift:101`) and one hint (`:498`). VoiceOver falls back to the generic SF Symbol description in the
device language (not the app language), with no state ("star" for both the on and off state), and several hit areas are about 20 pt.

| File:line | Control | Problem |
|---|---|---|
| `Mutshabehat/MutshabehatMagazine.swift:209-214` | favourite star (card) | no label, no state, `.footnote` icon, no padding |
| `Mutshabehat/MutshabehatMagazine.swift:243` | "copied" checkmark | meaning lost; should read "منسوخة" |
| `Mutshabehat/MutshabehatGroupDetailViews.swift:32-38` | favourite star (detail) | no label or state |
| `Mutshabehat/MutshabehatView.swift:68-71` | clear search | no label |
| `Mutshabehat/MutshabehatView.swift:104-111` | favourites-only filter | no label, no `.isSelected` |
| `Mutshabehat/MutshabehatGroupEditorView.swift:189-195` | `slider.horizontal.3` menu | no label |
| `Mutshabehat/MutshabehatGroupEditorView.swift:463-486` | move up / move down / delete verse | no label, `.padding(4)` on a `.caption2` icon (about 20 pt) |
| `Mutshabehat/MutshabehatGroupEditorView.swift:598-625` | move up / move down / remove part | same |
| `Mutshabehat/MutshabehatQuranSearchView.swift:33-40` | clear search | no label |
| `Mutshabehat/MutshabehatQuranSearchView.swift:92-99` | row select circle | state only in the icon; add the `.isSelected` trait and hide the icon |

Fix (same pattern everywhere):

```swift
Button { onToggleFavorite(group) } label: {
    Image(systemName: group.favorite ? "star.fill" : "star")
        .font(.footnote)
        .frame(minWidth: 44, minHeight: 44)
        .contentShape(Rectangle())
}
.buttonStyle(.plain)
.accessibilityLabel(group.favorite ? "إزالة من المفضلة" : "إضافة إلى المفضلة")   // add both strings to Localizable.xcstrings, with English
```

For toggles also add `.accessibilityAddTraits(isOn ? .isSelected : [])`. For the editor reorder/delete buttons add the verse or part
number to the label ("نقل الآية 2 للأعلى"). In `MutshabehatQuranSearchView:92` use `.accessibilityAddTraits(isSelected ? .isSelected : [])`
and `Image(...).accessibilityHidden(true)`.

Alternative if there is no time: remove the "المتشابهات" row from the "المزيد" menu for v1. AGENTS.md already says the
متشابهات layer "comes later".

### M2. Same unlabeled pattern on the core search and bookmark paths

| File:line | Control | Problem |
|---|---|---|
| `Reader/AyahSearchView.swift:185-197` | clear query (`xmark.circle.fill`) | no label, icon-sized target |
| `Reader/AyahSearchView.swift:210-217` | dismiss `xmark` in the search capsule | no label, about 20 pt target (`.subheadline` icon, no frame). The top-bar close at `:61-74` is labeled but this one is not |
| `Reader/AyahSearchView.swift:356-361` | per-result `ShareLink` with only an icon | no label; `.padding(6)` gives about 30 pt |
| `Reading/BookmarksView.swift:54-59` | clear bookmark search | no label |
| `Reading/ReadingStatisticsView.swift:120-125` | clear filter | no label |

Fix: `.accessibilityLabel("مسح")`, `.accessibilityLabel("إغلاق البحث")`, `ShareLink(...) { Image(systemName: "square.and.arrow.up") }`
plus `.accessibilityLabel("مشاركة الآية")`, and `.frame(minWidth: 44, minHeight: 44).contentShape(Rectangle())` on each. `Mutoon`'s
clear button (`Qiraat/MutoonView.swift:103-108`) is the in-app model to copy.

### M3. The app opens in Arabic regardless of the device language

`appLanguageCode` returns `"ar"` when nothing is stored (`Design/AppLocalized.swift:4-6`). The same hard-coded default is repeated in
`Reader/ReaderView.swift:62`, `Reader/AyahSearchView.swift:9`, `Reader/AdvancedSearchGuideView.swift:13`, `Memorization/MemorizationView.swift:29`
and `Sync/ICloudSyncSettingsView.swift:13`. An English-speaking App Reviewer (and any VoiceOver user whose device is English) lands
in a right-to-left Arabic UI and has to find the language switch in Settings, which sits behind the footer that is hidden at launch
(see S1). `project.yml` also sets `CFBundleDevelopmentRegion: ar` and has no `CFBundleLocalizations`.

Fix: seed the stored value once at first launch from the device, and make every site read one constant:

```swift
enum AppLanguage { static var initialRaw: String {
    Locale.preferredLanguages.first?.hasPrefix("ar") == true ? "ar" : "en"
} }
// AppLocalized.swift:  UserDefaults.standard.string(forKey: "app:language:v1") ?? AppLanguage.initialRaw
// each @AppStorage("app:language:v1") var language = AppLanguage.initialRaw
```

UI tests already pass `-app:language:v1 ar` explicitly, so they are unaffected. If the owner wants Arabic-first on every device,
keep the code, but then: (a) state it in the App Review notes together with the path to Settings, and (b) add a first-run language
choice. This is a product decision; I would not leave it unaddressed.

### M4. Mutshabehat diffs convey meaning by colour alone, and VoiceOver reads them flat

`Mutshabehat/ArabicDiffView.swift:25-30`: shared, difference, difference 2/3, addition and unique parts differ only by foreground
and background colour (WCAG 1.4.1). VoiceOver reads the plain concatenated text, so the point of the feature (which words differ) is
lost to blind users and to colour-blind users. The font is also a fixed 23 pt (`:50-54`), so it does not follow Dynamic Type.

Fix:

```swift
@Environment(\.accessibilityDifferentiateWithoutColor) private var noColorOnly
...
switch style {
case .difference, .difference2, .difference3: str.underlineStyle = .single          // always, not only when the setting is on
case .addition: str.underlineStyle = Text.LineStyle(pattern: .dot)
case .unique:   str.inlinePresentationIntent = .stronglyEmphasized
default: break
}
// spoken text:
Text(attributedText).accessibilityLabel(parts.map { p in
    MutshabehatPartStyle(rawType: p.type).map { $0 == .shared || $0 == .blank ? p.text : "\(p.text)، \($0.title)" } ?? p.text
}.joined(separator: " "))
```

Use `UIFontMetrics(forTextStyle: .title3).scaledFont(for:maximumPointSize:)` for the font. `MutshabehatPartStyle.title` already holds the
Arabic names ("مشترك"، "اختلاف"، "زيادة"، "فريد"); localize them for English.

## SHOULD (v1.1)

### S1. The reader's chrome is hidden at launch; with VoiceOver or Switch Control it is the only door to every feature

`ReaderView.swift:31` starts with `chromeVisible = false`. Index, search, bookmarks, Qiraat menu, more, and settings are
`accessibilityHidden` until the user double-taps the page element (`MushafPageView.swift:263` hint explains this, `ReaderBottomBar.swift:87`).
That works, but it is a hidden step, and the opt-in auto-hide (10 s, `ReaderBottomBar.swift:97-102`, `ReaderView.swift:155-159`)
can remove the bar while a VoiceOver user is still exploring it.
Fix: start with `chromeVisible = UIAccessibility.isVoiceOverRunning || UIAccessibility.isSwitchControlRunning`, observe
`UIAccessibility.voiceOverStatusDidChangeNotification`, and skip auto-hide while either is on (`UndoToast.swift:111` already does the same check).
Promote to MUST if the device pass shows VoiceOver users cannot find the double-tap.

### S2. Word-level VoiceOver label gives no hint of what the Qiraat difference is

`MushafPageView.swift:357` reads "<word>، فيها قراءات" for every marked word. Add the count and kinds
(`marks[word.id]` already knows them), for example the value "3 أوجه، قاعدة إمالة". Also make sure activation of that word element
opens the card on a real device: the element has no `onActivate`, so it relies on VoiceOver's synthesized tap hitting `wordTap`
(`PageController.swift:276-285`).

### S3. Reader identity on the page is colour-only

The underline, dotted line and dots under a Qiraat word are the only page-level cue for which reader it belongs to
(`MushafPageView.swift:925-971`). The presence of a mark is not colour-only, and the card names the readers, so this is acceptable for v1.
For Differentiate Without Color, read `UIAccessibility.shouldDifferentiateWithoutColor` and vary the pattern per reader family
(dash length, dot shape) in `drawQiraatMarks`. The legend sheet (`QiraatLegendSheet.swift`) should show those patterns.

### S4. Dynamic Type

- Header and footer are capped at `.xxxLarge` / `.xxLarge` (`ReaderTopBar.swift:69, 131-133, 140`; `ReaderBottomBar.swift:107`; `ReaderActionRail.swift:56`)
  inside a fixed 52 pt slot. The footer and rail use the large content viewer; the top bar does not. At accessibility sizes, show
  one line ("صفحة N · surah") and move khatma/memorization into the Settings or statistics path, or add `.accessibilityShowsLargeContentViewer`.
- The Mushaf page is a fixed canvas by design. If Larger Text is claimed, the page text size has to be adjustable independently
  (a reader font-size control) and be shown to work.
- Fixed fonts: `Qiraat/RulingCard.swift:206` (`.system(size: 11)`), `Qiraat/QiraatSheet.swift:180` (`.system(size: 36)`), `Mutshabehat/ArabicDiffView.swift:50-54`
  (see M4). The Mutshabehat verse fonts at `MutshabehatGroupEditorView.swift:591`, `WordLinkerView.swift:122`, `MutshabehatQuranSearchView.swift:113`
  do scale (`relativeTo: .body`).

### S5. Decorative images not hidden

`Qiraat/QiraatSheet.swift:179` (`checkmark.seal` in the empty state), `Reading/ReadingStatisticsView.swift:167` (`hand.draw`),
`Reading/KhatmaCelebrationView.swift:21`, `Mutshabehat/MutshabehatQuranSearchView.swift:74`, `Mutshabehat/MutshabehatView.swift:236, 289`,
`Reading/AddReadingSessionView.swift:238, 288`, and the `chevron.*` rows in `Mutshabehat/MutshabehatMagazine.swift:165`,
`Memorization/DashboardView.swift:81`, `Memorization/AyahStatusListView.swift:202`. Add `.accessibilityHidden(true)`. Inside buttons that also
have a Text, the symbol description can be announced before the text.

### S6. Localization completeness (English)

- `Sources/Localizable.xcstrings` has 630 keys. 229 entries are not in a final state (`new`, `needs_review`, or `machine_translated`),
  and about 40 keys have no localization at all (for example lines 24-26, 323-325, 336-338, 365-370, 442-444, 516-540, 591-596, 607-640: counters such as
  `"%lld آية"`, and English-literal keys such as `"Cancel"`, `"Close"`, `"Bookmarks"`). Arabic literals without an `en` value show Arabic in
  English mode. `Tests/QiraatLocalizationTests.swift` guards the Qiraat folder only; extend the scan to all of `Sources/`.
- Two mechanisms are mixed: the xcstrings catalog and `copy(ar, en)` / `language == .arabic ? ... : ...` ternaries in about 15 files. This works,
  but string-formatting for plurals ("%lld آية") is not done per language rules. Prefer the catalog with plural variations.
- `Qiraat/QiraatSheet.swift:132` forces RTL in English mode. That is deliberate for Arabic Quranic content; make sure the English chrome ("Close", "Compare") reads correctly in that direction.
- The Home Screen name is the fixed `CFBundleDisplayName: Qiraat`; there is no `InfoPlist.xcstrings` for an Arabic name (`project.yml:92`).
- SF Symbol fallback descriptions come from the device language, not the app language (see M1/M2); once labels are explicit this goes away.

### S7. Touch targets on the paper

The word hit area is the glyph box plus 20% of the font size (`MushafPageView.swift:388-392`), so marked words on a dense page are often
under 44 pt. This is inherent to the paper layout and matches the web. VoiceOver, Voice Control and Switch Control are covered by the element tree.
For motor-impaired users consider a "Qiraat words" list: `QiraatPageSummaryView` already lists a page's differences; surface it from the page element as a custom action ("خلافات الصفحة").

### S8. Smaller items

- The surah title in the header is an `onTapGesture` on Text with an `accessibilityAction` (`ReaderTopBar.swift:168-173`). It is reachable, but not announced as a button; add `.accessibilityAddTraits(.isButton)` and an `accessibilityHint`.
- `UsulIndexView`, `QiraatReaderPicker` and `Settings` rows use system controls and read well. A spot check with Voice Control ("Show numbers") is recommended for the footer tab bar and the glass menu rows.
- Basmala label is a hard-coded Arabic literal (`MushafPageView.swift:311`). That is intended, since it is Quranic text with `accessibilityLanguage = "ar"`.

## Contrast by theme

Covered by tests: the Qiraat card palette in light and dark (4.5:1 text, 3:1 large word), data colours as pill ink and fills, the khatma chip
(text lifted to 4.5:1 on its tint, `ReaderTopBar.swift:419-429`), and Qiraat mark colours at 3:1 on all `MushafAppearance` cases
(`system`, `light`, `dark`, `whitePage`, `blackPage`) in light and dark. Not covered: the Mutshabehat part colours (`ArabicDiffView.swift:103-153`; the
chosen pairs look sufficient but are untested), `.secondary` captions on `mushafPaper`, and the memorization status colours in all five themes. Add those to
`QiraatContrastTests`-style tests.

## Accessibility Nutrition Labels (voluntary)

These are self-declared and Apple expects the claim to hold for the app's common tasks. After M1-M4, and after a device pass that confirms them,
the app could honestly claim:

- Sufficient Contrast: yes, after adding the Mutshabehat and memorization pairs to the contrast tests.
- Reduced Motion: yes (page curl, menus, transitions, and haptic-only feedback respect it); confirm the remaining `withAnimation` calls once.
- Voice Control: likely, because controls carry labels and custom actions. Test with "Show names" on the footer bar and sheets.
- VoiceOver: yes for reading, search, Qiraat cards, bookmarks, memorization and statistics once M1-M2 are done, and Mutshabehat once M4 is done. Do the walk-through first.
- Differentiate Without Color Alone: only after M4; S3 would make it unqualified.
- Dark Interface: probably (system, dark and black page themes); verify the sheets and Mutshabehat in dark.

Do not claim yet: Larger Text (the Mushaf page is a fixed canvas and the header is capped, see S4), Captions and Audio Descriptions (not applicable: no media).
