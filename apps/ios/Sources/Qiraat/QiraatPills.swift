import MushafCore
import SwiftUI
import UIKit

extension AuthorityPill {
    /// One letter that says who this is without the colour: the first letter of the reader's or
    /// narrator's name, after the «الإمام» / «الراوي» label and the article.
    var initial: String { Self.initial(ofName: name) }

    static func initial(ofName name: String) -> String {
        var base = Substring(name)
        for prefix in ["الإمام ", "الراوي "] where base.hasPrefix(prefix) {
            base = base.dropFirst(prefix.count)
            break
        }
        if base.hasPrefix("ال"), base.count > 3 { base = base.dropFirst(2) }
        return base.first.map(String.init) ?? "؟"
    }
}

/// Reader and narrator pills, one per authority. The colour is the authority's own, but it is never the
/// only cue: the dot carries the first letter of the name, and the name itself is set in ink.
struct QiraatPills: View {
    let pills: [AuthorityPill]
    @ScaledMetric(relativeTo: .caption) private var dotSize: CGFloat = 20

    var body: some View {
        FlowLayout(spacing: 6) {
            ForEach(pills) { pill in
                let uiColor = UIColor(qiraatHex: pill.color)
                let color = Color(uiColor: uiColor)
                HStack(spacing: 6) {
                    Text(verbatim: pill.initial)
                        .font(.caption2.bold())
                        .foregroundStyle(Color(uiColor: .qiraatInk(onFill: uiColor)))
                        .frame(width: dotSize, height: dotSize)
                        .background(Circle().fill(color))
                        .accessibilityHidden(true)
                    Text(verbatim: pill.name).font(.caption.bold()).foregroundStyle(Color(uiColor: .mushafInk))
                }
                .padding(.leading, 4).padding(.trailing, 9).padding(.vertical, 3)
                .background(Capsule().fill(color.opacity(0.10)))
                .overlay(Capsule().stroke(color.opacity(0.55)))
                .accessibilityElement(children: .combine)
            }
        }
    }
}

extension AuthorityPill {
    /// The name without the «الإمام» / «الراوي» label: the chip's colour and outline already say which it is.
    var cleanName: String {
        for prefix in ["الإمام ", "الراوي "] where name.hasPrefix(prefix) {
            return String(name.dropFirst(prefix.count))
        }
        return name
    }
}

/// The readers of one reading as a two-column grid of chips (one column at accessibility text sizes).
/// A whole reader (both his narrators) is a solid tinted chip with a filled initial; a single narrator is a
/// white chip with a dashed outline, an outlined initial and «عن <الإمام>» under the name, so the two are
/// told apart by shape as well as colour.
struct QiraatAttributionGrid: View {
    let pills: [AuthorityPill]
    let catalog: QiraatCatalog

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        let columns = Array(repeating: GridItem(.flexible(), spacing: 8, alignment: .leading),
                            count: dynamicTypeSize.isAccessibilitySize ? 1 : 2)
        LazyVGrid(columns: columns, alignment: .leading, spacing: 8) {
            ForEach(pills) { pill in
                QiraatAttributionChip(pill: pill, parentName: parentName(of: pill))
            }
        }
    }

    /// The imam a lone narrator reads for, unless the narrator's own name already says it («الدوري عن أبي عمرو»).
    private func parentName(of pill: AuthorityPill) -> String? {
        guard pill.kind == .narrator, !pill.cleanName.contains(" عن "),
              let narrator = catalog.narrator(pill.key), let reader = catalog.reader(narrator.readerId) else { return nil }
        return reader.nameArShort
    }
}

struct QiraatAttributionChip: View {
    let pill: AuthorityPill
    let parentName: String?

    @Environment(\.colorScheme) private var colorScheme
    @ScaledMetric(relativeTo: .caption) private var dotSize: CGFloat = 22

    private var isNarrator: Bool { pill.kind == .narrator }

    var body: some View {
        let fill = UIColor(qiraatHex: pill.color)
        let accent = Color(uiColor: fill)
        let traits = UITraitCollection(userInterfaceStyle: colorScheme == .dark ? .dark : .light)
        let accentInk = Color(uiColor: .qiraatCardText(hex: pill.color, traits: traits))
        HStack(spacing: 6) {
            ZStack {
                if isNarrator {
                    Circle().fill(accent.opacity(0.10))
                    Circle().strokeBorder(accent, lineWidth: 1.5)
                } else {
                    Circle().fill(accent)
                }
                Text(verbatim: pill.initial)
                    .font(.caption2.bold())
                    .foregroundStyle(isNarrator ? accentInk : Color(uiColor: .qiraatInk(onFill: fill)))
            }
            .frame(width: dotSize, height: dotSize)
            .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 0) {
                Text(verbatim: pill.cleanName)
                    .font(.caption.bold())
                    .foregroundStyle(Color(uiColor: .mushafInk))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                if let parentName {
                    Text(verbatim: "عن \(parentName)")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.leading, 4).padding(.trailing, 9).padding(.vertical, 4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Capsule().fill(isNarrator ? Color(uiColor: .systemBackground).opacity(0.85) : accent.opacity(0.14)))
        .overlay(
            Capsule().strokeBorder(accent.opacity(isNarrator ? 0.85 : 0.45),
                                   style: StrokeStyle(lineWidth: 1.2, dash: isNarrator ? [4, 3] : []))
        )
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(verbatim: parentName.map { "\(pill.cleanName) عن \($0)" } ?? pill.cleanName))
    }
}

/// The short phonetic or rule descriptor above a card's word («بلا ألف», «إبدال الهمزة وصلاً ووقفاً»).
struct QiraatDescriptorPill: View {
    let text: String

    var body: some View {
        Text(verbatim: text)
            .font(.caption2.weight(.medium))
            .foregroundStyle(Color(uiColor: .mushafBrown))
            .multilineTextAlignment(.center)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(RoundedRectangle(cornerRadius: 10).fill(Color.primary.opacity(0.06)))
    }
}

/// A small capsule label: a ruling category, a variant kind, a wajh number. The caller decides whether the
/// text is data (`Text(verbatim:)`, as the web gives it) or app chrome (`Text("…")`, translated).
struct QiraatBadge: View {
    let label: Text
    let foreground: Color
    let background: Color

    init(_ label: Text, foreground: Color, background: Color) {
        self.label = label
        self.foreground = foreground
        self.background = background
    }

    var body: some View {
        label.font(.caption2.bold()).foregroundStyle(foreground)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(Capsule().fill(background))
    }
}

extension QiraatBadge {
    /// The quiet gold badge for localized app chrome.
    init(_ label: Text) {
        self.init(label, foreground: .qiraatBadgeInk, background: .qiraatBadgeFill)
    }

    /// A quiet gold badge initialized with a localized key.
    init(key: LocalizedStringKey) {
        self.init(Text(key))
    }

    /// The quiet gold badge: a variant kind, a wajh number.
    init(text: String) {
        self.init(Text(verbatim: text))
    }

    /// A ruling category on its own data colour, with the ink that reads best on it.
    init(category text: String, hex: String) {
        let fill = UIColor(qiraatHex: hex)
        self.init(Text(verbatim: text),
                  foreground: Color(uiColor: .qiraatInk(onFill: fill)),
                  background: Color(uiColor: fill))
    }
}

/// Shown on a variant or ruling whose verification status is NEEDS_MANUAL_REVIEW: an icon and the words,
/// so it does not depend on colour.
struct QiraatNeedsReviewBadge: View {
    var body: some View {
        HStack(spacing: 5) {
            Image(systemName: "exclamationmark.triangle.fill").font(.caption2.bold()).accessibilityHidden(true)
            Text("تحتاج مراجعة يدوية").font(.caption.bold())
        }
        .foregroundStyle(.qiraatReviewInk)
        .padding(.horizontal, 10).padding(.vertical, 5)
        .background(Capsule().fill(.qiraatReviewFill))
        .overlay(Capsule().stroke(.qiraatReviewInk.opacity(0.6)))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("تحتاج مراجعة يدوية")
        .accessibilityHint("هذه القراءة لم تُراجَع بعد")
    }
}
