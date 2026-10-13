import MushafCore
import SwiftUI
import UIKit

/// One أصول ruling card: its category, the readers grouped by action, and the notes the web shows.
struct RulingCard: View {
    let ruling: QiraatRuling
    let catalog: QiraatCatalog

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        let color = Color(qiraatHex: ruling.color)
        let distinct = distinctRulingText(ruling.text, categoryAr: ruling.categoryAr, actions: ruling.attribution.map(\.action))
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                QiraatClassificationLine(ruling: ruling)
                Spacer()
                if let condition = ruling.condition {
                    Text(verbatim: condition).font(.caption2.bold()).foregroundStyle(.secondary)
                }
            }
            if !ruling.baseText.isEmpty {
                VStack(spacing: 4) {
                    Text(verbatim: ruling.baseText)
                        .font(rulingWordFont)
                        .foregroundStyle(color)
                        .multilineTextAlignment(.center)
                        .lineLimit(2)
                        .minimumScaleFactor(0.65)
                        .allowsTightening(true)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity)
                        .accessibilityIdentifier("qiraat-ruling-word")
                    Text("تُقرأ هكذا")
                        .font(.caption2.bold())
                        .foregroundStyle(.secondary)
                }
            }
            ForEach(ruling.attributionByAction, id: \.action) { group in
                VStack(alignment: .leading, spacing: 4) {
                    QiraatPills(pills: rollupAuthorityPills(group.entries.map(\.authorityId), catalog: catalog))
                    performance(group, ruling: ruling)
                }
            }
            if let distinct { Text(verbatim: distinct).font(.caption).foregroundStyle(Color(uiColor: .mushafBrown)) }
            if !ruling.alternateReadings.isEmpty {
                Text("ذو وجهين (بخلف عنه) — الوجه الآخر جائز أيضًا")
                    .font(.caption.bold()).foregroundStyle(.qiraatBadgeInk)
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(RoundedRectangle(cornerRadius: 6).fill(.qiraatBadgeFill))
            }
            if !noteParagraphs.isEmpty { CollapsibleText(text: noteParagraphs.joined(separator: "\n")) }
            if ruling.verificationStatus == "NEEDS_MANUAL_REVIEW" { QiraatNeedsReviewBadge() }
        }
        .padding(10)
        .background {
            RoundedRectangle(cornerRadius: 10).fill(.qiraatCardFill)
            RoundedRectangle(cornerRadius: 10).fill(color.opacity(0.06))
        }
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(color))
    }

    private var rulingWordFont: Font {
        _ = dynamicTypeSize
        let baseFont = UIFont(name: "KFGQPCUthmanicScriptHAFS", size: 40)
            ?? UIFont(name: "DamascusBold", size: 40)
            ?? UIFont.systemFont(ofSize: 40, weight: .bold)
        return Font(UIFontMetrics(forTextStyle: .title1)
            .scaledFont(for: baseFont, maximumPointSize: VariantCard.maxWordSize))
    }

    /// The notes and the source notes, in the order the web shows them.
    private var noteParagraphs: [String] {
        ([ruling.notes].compactMap { $0 } + (ruling.sourceNotes ?? [])).filter { !$0.isEmpty }
    }

    /// How the readers above read it: wajh numbers, the action (shown once under the category line,
    /// never hidden because it repeats the category), conditions, and the الخلاف notes.
    @ViewBuilder
    private func performance(_ group: RulingActionGroup, ruling: QiraatRuling) -> some View {
        let showAction = QiraatClassification.shouldShowAction(group.action, categoryAr: ruling.categoryAr)
        let conditions = unique(group.entries.compactMap { $0.condition?.trimmingCharacters(in: .whitespaces) })
        let notes = unique(group.entries.compactMap { $0.wajhNote?.trimmingCharacters(in: .whitespaces) })
        let wajhs = ruling.hasSeveralWajhs ? Array(Set(group.entries.compactMap(\.wajhOrder))).sorted() : []
        if showAction || !conditions.isEmpty || !wajhs.isEmpty {
            HStack(spacing: 4) {
                ForEach(wajhs, id: \.self) { n in
                    QiraatBadge(Text("وجه \(n)"))
                }
                if showAction { Text(verbatim: group.action).font(.caption.bold()) }
                if !conditions.isEmpty {
                    Text(verbatim: (showAction ? "— " : "") + conditions.joined(separator: "، "))
                        .font(.caption).foregroundStyle(.secondary)
                }
            }
        }
        ForEach(notes, id: \.self) { Text("الخلاف: \($0)").font(.caption).foregroundStyle(.secondary) }
    }

    private func unique(_ values: [String]) -> [String] {
        var seen: [String] = []
        for v in values where !v.isEmpty && !seen.contains(v) { seen.append(v) }
        return seen
    }
}

/// Secondary text that shows three lines and offers «المزيد» when there is more, so a long note does not
/// push the readers off the screen. Short text shows no button.
struct CollapsibleText: View {
    let text: String
    var lineLimit = 3

    @State private var expanded = false
    @State private var fullHeight: CGFloat = 0
    @State private var limitedHeight: CGFloat = 0

    private var isTruncated: Bool { fullHeight > limitedHeight + 1 }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(verbatim: text).font(.caption).foregroundStyle(.secondary)
                .lineLimit(expanded ? nil : lineLimit)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(HeightReader(onChange: { limitedHeight = $0 }))
                .background {
                    // The same text with no line limit, only to know how tall it would be.
                    Text(verbatim: text).font(.caption)
                        .fixedSize(horizontal: false, vertical: true)
                        .hidden()
                        .background(HeightReader(onChange: { fullHeight = $0 }))
                }
            if isTruncated || expanded {
                Button {
                    withMotion { expanded.toggle() }
                } label: {
                    toggleLabel.font(.caption.bold()).foregroundStyle(.qiraatBadgeInk)
                        .frame(minWidth: 44, minHeight: 44, alignment: .leading)
                        .contentShape(Rectangle())
                }
                .accessibilityIdentifier("qiraat-notes-toggle")
                .accessibilityHint(expanded ? Text("يطوي الملاحظات") : Text("يعرض الملاحظات كاملة"))
            }
        }
    }

    private var toggleLabel: Text {
        expanded ? Text("أقل") : Text("المزيد")
    }
}

private struct HeightReader: View {
    let onChange: (CGFloat) -> Void
    var body: some View {
        GeometryReader { proxy in
            Color.clear
                .onAppear { onChange(proxy.size.height) }
                .onChange(of: proxy.size.height) { _, height in onChange(height) }
        }
    }
}
