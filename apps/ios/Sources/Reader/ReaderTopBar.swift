import MushafCore
import SwiftUI

/// The reading header: where the page sits. Information only, always
/// visible; every menu is in `ReaderBottomBar`. A tap on it shows or hides that bar. In iPad landscape the same items
/// stand in a column, the left side rail (`axis: .vertical`), and the page takes the full height.
struct ReaderTopBar: View {
    let surahTitle: String
    /// The printed number of the page, or of both pages of a spread; shown in the header. The side rail leaves it out:
    /// there each page carries its number under the paper (`PageController`).
    var pageNumbers: [Int] = []
    /// Juz and hizb for the reading header; nil hides them.
    let section: ReaderSection?
    let appearance: MushafAppearance
    let traits: UITraitCollection
    /// Where the Qiraat layer is narrowed to one reader or narrator, shown as a chip.
    var qiraat: QiraatPreferences
    var qiraatCatalog: QiraatCatalog?
    var openQiraatFilter: () -> Void = {}
    var language: AppLanguage = .arabic
    let onTapHeader: () -> Void
    /// A tap on the surah name opens the index (the same sheet as the bottom bar's الفهرس).
    var openIndex: () -> Void = {}
    /// `.vertical`: the left side rail of iPad landscape.
    var axis: Axis = .horizontal

    var body: some View {
        if axis == .vertical { column } else { bar }
    }

    /// The side rail, top to bottom: the surah, the juz, the hizb and its quarter disc each on a row of its own and
    /// aligned to the reading side, then the reader chip. The page numbers stand under the pages.
    private var column: some View {
        let ink = Color(uiColor: appearance.ink(for: traits))
        return VStack(alignment: .leading, spacing: 14) {
            surahTitleButton(ink: ink, tight: false, wraps: true)
                .frame(maxWidth: .infinity, alignment: .leading)
            if let section { railSection(section, ink: ink) }
            Capsule().fill(ink.opacity(0.15)).frame(height: 1).accessibilityHidden(true)
            qiraatFilterChip(vertical: true)
            Spacer(minLength: 16)
        }
        .padding(.top, 20)
        .padding(.bottom, 16)
        .padding(.horizontal, 10)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .dynamicTypeSize(...DynamicTypeSize.xxLarge)
    }

    /// The juz, the hizb and the quarter disc, one per row, at the reading side of the rail.
    private func railSection(_ section: ReaderSection, ink: Color) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(section.juzText)
            Text(section.hizbText)
            RubDisc(quarter: section.rubInHizb, diameter: 18)
        }
        .font(.subheadline.weight(.semibold))
        .foregroundStyle(ink.opacity(0.75))
        .lineLimit(1)
        .minimumScaleFactor(0.8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(section.accessibilityText)
        .accessibilityAddTraits(.isStaticText)
        .accessibilityIdentifier("reading-section-text")
    }

    private var bar: some View {
        // The row is tried at full size first, then with the juz over the hizb, then smaller text; the last row's
        // surah name may shrink (to 75%) so nothing is pushed off the screen.
        ViewThatFits(in: .horizontal) {
            row(stackedSection: false)
            row(stackedSection: true)
            row(stackedSection: true).dynamicTypeSize(...DynamicTypeSize.large)
            row(stackedSection: true, tight: true).dynamicTypeSize(...DynamicTypeSize.large)
        }
        .padding(.horizontal, 16)
        .frame(height: 52)
        .contentShape(Rectangle())
        .onTapGesture { onTapHeader() }
        // The bar is a fixed 52 pt slot over the page: text grows with the user's size up to a point.
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
    }

    /// Page number at the far right with the surah name beside it; the filter chip in the middle; the juz and hizb at
    /// the far left. Each in a place of its own so no text runs under it.
    private func row(stackedSection: Bool, tight: Bool = false) -> some View {
        let ink = Color(uiColor: appearance.ink(for: traits))
        return HStack(alignment: .center, spacing: tight ? 6 : 10) {
            if !pageNumbers.isEmpty { pageNumberText(ink: ink).fixedSize() }

            surahTitleButton(ink: ink, tight: tight, wraps: false)

            Spacer(minLength: tight ? 4 : 8)
            qiraatFilterChip(vertical: false)
            Spacer(minLength: tight ? 4 : 8)

            if let section {
                sectionLabel(section, ink: ink, stacked: stackedSection)
            }
        }
    }

    /// The surah name; a tap opens the index so the reader need not go to the bottom bar. A tap gesture rather than a
    /// `Button` keeps it a static text for VoiceOver and the UI tests; the index is offered as an accessibility action.
    private func surahTitleButton(ink: Color, tight: Bool, wraps: Bool) -> some View {
        SurahTitle(text: surahTitle, ink: ink, tight: tight, wraps: wraps)
            .contentShape(Rectangle())
            .onTapGesture(perform: openIndex)
            .accessibilityAction(named: Text(language == .english ? "Open the index" : "فتح الفهرس"), openIndex)
    }

    private func pageNumberText(ink: Color) -> some View {
        Text(verbatim: pageNumbers.map { ArabicDigits.string($0) }.joined(separator: " – "))
            .font(.custom("GeezaPro-Bold", size: 19, relativeTo: .headline))
            .foregroundStyle(ink)
            .lineLimit(1)
            .accessibilityLabel(Text(verbatim: (language == .english ? "Page " : "صفحة ")
                + pageNumbers.map { ArabicDigits.string($0) }.joined(separator: language == .english ? " and " : " و")))
            .accessibilityIdentifier("reading-page-number")
    }

    /// The juz and hizb with the quarter disc between them: on one line, or the juz over the hizb when the row is tight.
    @ViewBuilder
    private func sectionLabel(_ section: ReaderSection, ink: Color, stacked: Bool) -> some View {
        let content = Group {
            if stacked {
                VStack(alignment: .leading, spacing: 1) {
                    Text(section.juzText)
                    HStack(spacing: 5) {
                        RubDisc(quarter: section.rubInHizb, diameter: 14)
                        Text(section.hizbText)
                    }
                }
            } else {
                HStack(spacing: 5) {
                    Text(section.juzText)
                    RubDisc(quarter: section.rubInHizb, diameter: 14)
                    Text(section.hizbText)
                }
            }
        }
        content
            .font(.footnote.weight(.semibold))
            .foregroundStyle(ink.opacity(0.75))
            .lineLimit(1)
            .fixedSize()
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(section.accessibilityText)
            .accessibilityAddTraits(.isStaticText)
            .accessibilityIdentifier("reading-section-text")
    }

    /// The colour of the chosen reader or narrator, as the page draws it; the chip is never the app's green.
    private var filterColor: Color {
        switch qiraat.filter {
        case .all: return .progressFill
        case .reader(let id): return qiraatCatalog?.reader(id).map { Color(qiraatHex: $0.color) } ?? .progressFill
        case .reading(let id): return qiraatCatalog?.narrator(id).map { Color(qiraatHex: $0.color) } ?? .progressFill
        }
    }

    /// The current reader or narrator while the Qiraat layer is narrowed to one; a tap opens the picker.
    @ViewBuilder
    private func qiraatFilterChip(vertical: Bool) -> some View {
        if qiraat.enabled, let name = qiraatCatalog?.filterShortName(qiraat.filter),
           let full = qiraatCatalog?.filterName(qiraat.filter) {
            FilterChip(isSelected: true, selectedFill: filterColor, action: openQiraatFilter) {
                Text(name)
                    .lineLimit(vertical ? 2 : 1)
                    .multilineTextAlignment(.center)
                    .minimumScaleFactor(0.8)
            }
            .frame(maxWidth: vertical ? .infinity : 130)
            .fixedSize(horizontal: !vertical, vertical: true)
            .accessibilityLabel(Text("القراءات العشر") + Text(verbatim: ": ") + Text(full))
            .accessibilityHint("لتغيير القارئ أو الراوي")
            .accessibilityIdentifier("qiraat-filter-chip")
        }
    }
}

/// The surah name in the reading header. A view of its own so its size follows the text size of the row it is in
/// (the header's last rows are capped at `.large`), not that of the whole header.
private struct SurahTitle: View {
    let text: String
    let ink: Color
    /// In the header's last row the name may shrink (to 75%) instead of pushing the other items off the screen.
    let tight: Bool
    /// In the side rail the name wraps onto as many lines as it needs, at the reading side.
    var wraps = false
    @ScaledMetric(relativeTo: .headline) private var size: CGFloat = 19

    var body: some View {
        if wraps {
            Text(text)
                .font(Font(MushafLibrary.mushafFont(size: size)))
                .foregroundStyle(ink)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityIdentifier("reading-surah-title")
        } else {
            Text(text)
                .font(Font(MushafLibrary.mushafFont(size: size)))
                .foregroundStyle(ink)
                .lineLimit(1)
                .minimumScaleFactor(tight ? 0.75 : 0.7)
                .fixedSize(horizontal: !tight, vertical: false)
                .layoutPriority(tight ? -1 : 0)
                .accessibilityIdentifier("reading-surah-title")
        }
    }
}

/// What the reading header says about where the page sits: its juz and hizb, and which quarter of the hizb it is in.
struct ReaderSection: Equatable {
    let juzText: String
    let hizbText: String
    /// 1…4.
    let rubInHizb: Int
    let accessibilityText: String
}

/// A small circle filled like a pie by quarter of the hizb: a quarter at the first, half at the second, three
/// quarters at the third and full at the fourth; the next hizb starts again at a quarter.
struct RubDisc: View {
    let quarter: Int
    var diameter: CGFloat = 13

    var body: some View {
        ZStack {
            Circle().stroke(lineWidth: 1.3)
            RubPie(fraction: Double(min(max(quarter, 0), 4)) / 4)
        }
        .frame(width: diameter, height: diameter)
        .accessibilityHidden(true)
    }
}

/// A pie slice from twelve o'clock, clockwise.
struct RubPie: Shape {
    let fraction: Double

    func path(in rect: CGRect) -> Path {
        var path = Path()
        guard fraction > 0 else { return path }
        let center = CGPoint(x: rect.midX, y: rect.midY)
        path.move(to: center)
        path.addArc(center: center, radius: min(rect.width, rect.height) / 2,
                    startAngle: .degrees(-90), endAngle: .degrees(-90 + 360 * min(fraction, 1)), clockwise: false)
        path.closeSubpath()
        return path
    }
}
