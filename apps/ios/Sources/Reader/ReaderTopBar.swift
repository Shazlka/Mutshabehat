import MushafCore
import SwiftUI

/// The reading header: where the page sits and how the reading and memorization are going. Information only, always
/// visible; every menu is in `ReaderBottomBar`. A tap on it shows or hides that bar.
struct ReaderTopBar: View {
    let surahTitle: String
    /// The printed number of the page, or of both pages of a spread; shown in the header, never under the paper.
    var pageNumbers: [Int] = []
    /// Juz and hizb for the reading header; nil hides them.
    let section: ReaderSection?
    let appearance: MushafAppearance
    let traits: UITraitCollection
    /// Where the Qiraat layer is narrowed to one reader or narrator, shown as a chip.
    var qiraat: QiraatPreferences
    var qiraatCatalog: QiraatCatalog?
    var openQiraatFilter: () -> Void = {}
    /// Page-status marks for the header (one page, or both pages of a spread), left to right; empty hides them.
    var memorizationMarks: [(page: Int, progress: MemorizationPageProgress)] = []
    var memorizationLanguage: AppLanguage = .arabic
    var openMemorizationPage: (Int) -> Void = { _ in }
    /// Progress of the current khatma, 0…100; a tap opens the reading statistics.
    var khatmaPercent: Double = 0
    var openStatistics: () -> Void = {}
    let onTapHeader: () -> Void

    var body: some View {
        // The row is tried at full size first; when a long surah name leaves no room it uses the compact memorization
        // mark, then stacks the juz over the hizb, and only then drops the percent next to the khatma ring. They are never cut.
        ViewThatFits(in: .horizontal) {
            row(showsPercent: true, compactMark: false, stackedSection: false)
            row(showsPercent: true, compactMark: true, stackedSection: false)
            row(showsPercent: true, compactMark: true, stackedSection: true)
            row(showsPercent: false, compactMark: true, stackedSection: true)
            row(showsPercent: false, compactMark: true, stackedSection: true).dynamicTypeSize(...DynamicTypeSize.large)
        }
        .padding(.horizontal, 16)
        .frame(height: 52)
        .contentShape(Rectangle())
        .onTapGesture { onTapHeader() }
        // The bar is a fixed 52 pt slot over the page: text grows with the user's size up to a point.
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
    }

    /// Page number at the far right with the surah name beside it; the progress (memorization mark, filter chip,
    /// khatma) in the middle; the juz and hizb at the far left. Each in a place of its own so no text runs under it.
    private func row(showsPercent: Bool, compactMark: Bool, stackedSection: Bool) -> some View {
        let ink = Color(uiColor: appearance.ink(for: traits))
        return HStack(alignment: .center, spacing: 10) {
            if !pageNumbers.isEmpty {
                Text(verbatim: pageNumbers.map { ArabicDigits.string($0) }.joined(separator: " – "))
                    .font(.custom("GeezaPro-Bold", size: 19))
                    .foregroundStyle(ink)
                    .lineLimit(1)
                    .fixedSize()
                    .accessibilityLabel(Text(verbatim: (memorizationLanguage == .english ? "Page " : "صفحة ")
                        + pageNumbers.map { ArabicDigits.string($0) }.joined(separator: memorizationLanguage == .english ? " and " : " و")))
                    .accessibilityIdentifier("reading-page-number")
            }

            Text(surahTitle)
                .font(Font(MushafLibrary.mushafFont(size: 19)))
                .foregroundStyle(ink)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .fixedSize(horizontal: true, vertical: false)
                .accessibilityIdentifier("reading-surah-title")

            Spacer(minLength: 8)
            HStack(spacing: 8) {
                memorizationMarkRow(compact: compactMark)
                qiraatFilterChip
                khatmaChip(showsPercent: showsPercent)
            }
            Spacer(minLength: 8)

            if let section {
                sectionLabel(section, ink: ink, stacked: stackedSection)
            }
        }
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
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(ink.opacity(0.75))
            .lineLimit(1)
            .fixedSize()
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(section.accessibilityText)
            .accessibilityAddTraits(.isStaticText)
            .accessibilityIdentifier("reading-section-text")
    }

    /// The khatma progress: a ring and the percent in one tinted capsule, red while it has just begun, through
    /// yellow, to green as it completes; opens the reading statistics.
    private func khatmaChip(showsPercent: Bool) -> some View {
        let fraction = min(max(khatmaPercent, 0), 100) / 100
        let percent = Int(fraction * 100)
        let tint = ProgressTint.color(fraction)
        return Button(action: openStatistics) {
            HStack(spacing: 6) {
                KhatmaRing(fraction: fraction, tint: tint)
                    .frame(width: 28, height: 28)
                if showsPercent {
                    Text(verbatim: "\(ArabicDigits.string(percent))٪")
                        .font(.system(size: 17, weight: .bold, design: .rounded))
                        .monospacedDigit()
                        .foregroundStyle(Color(uiColor: ProgressTint.text(fraction, appearance: appearance, traits: traits)))
                        .lineLimit(1)
                }
            }
            .padding(.horizontal, showsPercent ? 10 : 6)
            .frame(height: 40)
            .background(Capsule().fill(Color(uiColor: ProgressTint.chipFill(fraction, appearance: appearance, traits: traits))))
            .overlay(Capsule().strokeBorder(tint.opacity(0.55), lineWidth: 1))
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .fixedSize()
        .accessibilityLabel(Text(verbatim: memorizationLanguage == .english ? "Khatma \(percent)%" : "ختمة \(ArabicDigits.string(percent))٪"))
        .accessibilityHint(memorizationLanguage == .english ? "Opens reading statistics" : "يفتح إحصائيات القراءة")
        .accessibilityIdentifier("khatma-progress")
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
    private var qiraatFilterChip: some View {
        if qiraat.enabled, let name = qiraatCatalog?.filterShortName(qiraat.filter),
           let full = qiraatCatalog?.filterName(qiraat.filter) {
            FilterChip(isSelected: true, selectedFill: filterColor, action: openQiraatFilter) {
                Text(name).lineLimit(1).minimumScaleFactor(0.8)
            }
            .frame(maxWidth: 130)
            .fixedSize()
            .accessibilityLabel(Text("القراءات العشر") + Text(verbatim: ": ") + Text(full))
            .accessibilityHint("لتغيير القارئ أو الراوي")
            .accessibilityIdentifier("qiraat-filter-chip")
        }
    }

    /// Page-status marks (one page, or both pages of a spread), left to right; nothing when they are hidden.
    @ViewBuilder
    private func memorizationMarkRow(compact: Bool) -> some View {
        if !memorizationMarks.isEmpty {
            HStack(spacing: 6) {
                ForEach(memorizationMarks, id: \.page) { mark in
                    Button { openMemorizationPage(mark.page) } label: {
                        PageStatusMark(page: mark.page, progress: mark.progress,
                                       showsPageNumber: memorizationMarks.count > 1, compact: compact,
                                       language: memorizationLanguage)
                    }
                    .buttonStyle(.plain)
                }
            }
            .fixedSize()
            .environment(\.layoutDirection, .leftToRight)
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

/// The khatma as a ring filled clockwise from twelve o'clock.
struct KhatmaRing: View {
    let fraction: Double
    var tint: Color = .primary

    var body: some View {
        ZStack {
            Circle().stroke(tint.opacity(0.22), lineWidth: 4)
            Circle().trim(from: 0, to: max(fraction, 0.015))
                .stroke(tint, style: StrokeStyle(lineWidth: 4, lineCap: .round))
                .rotationEffect(.degrees(-90))
        }
        .accessibilityHidden(true)
    }
}

/// Progress as a colour: red at the start, through yellow, to green at the end (hue 0° → 130°).
enum ProgressTint {
    static func color(_ fraction: Double) -> Color { Color(uiColor: uiColor(fraction)) }

    static func uiColor(_ fraction: Double) -> UIColor {
        let f = min(max(fraction, 0), 1)
        return UIColor(hue: 0.36 * f, saturation: 0.88, brightness: 0.80, alpha: 1)
    }

    /// The khatma chip's fill: a 14% wash of the tint over the page.
    static func chipFill(_ fraction: Double, appearance: MushafAppearance, traits: UITraitCollection) -> UIColor {
        appearance.paper(for: traits).mixed(with: uiColor(fraction), amount: 0.14)
    }

    /// The percent: the tint, moved toward the page's ink only as far as it takes to read at 4.5:1 on its chip
    /// (the bright yellow-green of the middle of a khatma measures 1.6:1 on light paper). The ring keeps the tint.
    static func text(_ fraction: Double, appearance: MushafAppearance, traits: UITraitCollection) -> UIColor {
        let fill = chipFill(fraction, appearance: appearance, traits: traits)
        let ink = appearance.ink(for: traits)
        var color = uiColor(fraction)
        var step = 0
        while color.contrast(with: fill) < 4.5, step < 20 {
            color = color.mixed(with: ink, amount: 0.08)
            step += 1
        }
        return color
    }
}
