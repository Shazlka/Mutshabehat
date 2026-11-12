import MushafCore
import SwiftUI

/// The short summary that floats over the page while the reader holds a finger down and slides it across the words:
/// the Mushaf word, each differing reading with who reads it, and the أصول أبواب with their أداء. The full card still
/// opens with a tap.
struct QiraatWordPeekView: View {
    let item: QiraatPageSummaryItem

    /// Enough to tell the words apart under a finger; the rest is «و N أخرى» and the full card has it all.
    private static let maxVariants = 3
    private static let maxRulingGroups = 2

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(verbatim: item.word.textUthmani)
                .font(Font(MushafLibrary.mushafFont(size: 22)))
                .foregroundStyle(Color(uiColor: .mushafBrown))
            ForEach(item.variants.prefix(Self.maxVariants)) { variant in
                VStack(alignment: .leading, spacing: 3) {
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text(verbatim: variant.readingText)
                            .font(Font(MushafLibrary.mushafFont(size: 20)))
                        if let note = variant.variant.performanceNote, !note.isEmpty {
                            Text(verbatim: note).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    authorities(variant.authorities)
                }
            }
            if item.variants.count > Self.maxVariants {
                Text("و\(item.variants.count - Self.maxVariants) أخرى").font(.caption).foregroundStyle(.secondary)
            }
            ForEach(item.rulingGroups.prefix(Self.maxRulingGroups)) { group in
                VStack(alignment: .leading, spacing: 3) {
                    Text(verbatim: group.categoryAr).font(.caption.bold())
                    ForEach(Array(group.rulings.flatMap(\.actionGroups).prefix(2).enumerated()), id: \.offset) { _, action in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(verbatim: action.action).font(.caption)
                            authorities(action.authorities)
                        }
                    }
                }
            }
            if item.rulingGroups.count > Self.maxRulingGroups {
                Text("و\(item.rulingGroups.count - Self.maxRulingGroups) أبواب أخرى")
                    .font(.caption).foregroundStyle(.secondary)
            }
        }
        .padding(12)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(.primary.opacity(0.08)))
        .shadow(color: .black.opacity(0.18), radius: 10, y: 4)
        .environment(\.layoutDirection, .rightToLeft)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("qiraat-word-peek")
    }

    /// One wrapping line «● قنبل  ● رويس», each dot in the reader's or narrator's colour. A single Text (not a flow
    /// layout) so the bubble is only as wide as its content; no-break spaces keep a dot and its name on one line.
    private func authorities(_ pills: [AuthorityPill]) -> some View {
        pills.enumerated().reduce(Text(verbatim: "")) { line, entry in
            let dot = Text(verbatim: "●").foregroundStyle(Color(qiraatHex: entry.element.color))
            let separator = entry.offset == 0 ? "" : "   "
            return Text("\(line)\(Text(verbatim: separator))\(dot)\(Text(verbatim: "\u{00A0}" + entry.element.cleanName.replacingOccurrences(of: " ", with: "\u{00A0}")))")
        }
        .font(.caption)
    }
}
