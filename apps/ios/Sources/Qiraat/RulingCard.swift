import MushafCore
import SwiftUI
import UIKit

/// One أصول ruling card: its category, the readers grouped by action, and the notes the web shows.
struct RulingCard: View {
    let ruling: QiraatRuling
    let catalog: QiraatCatalog

    var body: some View {
        let color = Color(qiraatHex: ruling.color)
        let distinct = distinctRulingText(ruling.text, categoryAr: ruling.categoryAr, actions: ruling.attribution.map(\.action))
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                QiraatBadge(Text(verbatim: ruling.categoryAr), foreground: .white, background: color)
                Spacer()
                if let condition = ruling.condition {
                    Text(verbatim: condition).font(.caption2.bold()).foregroundStyle(.secondary)
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
                    .font(.caption.bold()).foregroundStyle(Color(qiraatHex: "#7a5a10"))
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(RoundedRectangle(cornerRadius: 6).fill(Color(qiraatHex: "#fdf3d8")))
            }
            if let notes = ruling.notes { Text(verbatim: notes).font(.caption).foregroundStyle(.secondary) }
            ForEach(ruling.sourceNotes ?? [], id: \.self) { Text(verbatim: $0).font(.caption).foregroundStyle(.secondary) }
            if ruling.verificationStatus == "NEEDS_MANUAL_REVIEW" { QiraatNeedsReviewBadge() }
        }
        .padding(10)
        .background(RoundedRectangle(cornerRadius: 10).fill(color.opacity(0.05)))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(color))
    }

    /// How the readers above read it: wajh numbers, the action (unless it repeats the category),
    /// conditions, and the الخلاف notes — the web's `renderReaderPerformance`.
    @ViewBuilder
    private func performance(_ group: RulingActionGroup, ruling: QiraatRuling) -> some View {
        let showAction = !isRedundantActionLabel(group.action, categoryAr: ruling.categoryAr)
        let conditions = unique(group.entries.compactMap { $0.condition?.trimmingCharacters(in: .whitespaces) })
        let notes = unique(group.entries.compactMap { $0.wajhNote?.trimmingCharacters(in: .whitespaces) })
        let wajhs = ruling.hasSeveralWajhs ? Array(Set(group.entries.compactMap(\.wajhOrder))).sorted() : []
        if showAction || !conditions.isEmpty || !wajhs.isEmpty {
            HStack(spacing: 4) {
                ForEach(wajhs, id: \.self) { n in
                    QiraatBadge(Text("وجه \(n)"), foreground: Color(qiraatHex: "#7a5a10"), background: Color(qiraatHex: "#f1e2b6"))
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
