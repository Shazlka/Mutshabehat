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
