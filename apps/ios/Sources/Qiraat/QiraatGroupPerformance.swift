import MushafCore
import SwiftUI

/// How the readers of one action group read it: wajh numbers, the action (shown once under the pills,
/// never hidden because it repeats the category), conditions, and the الخلاف notes. Shared by the ruling
/// card and the variant card so both read the same way.
struct QiraatGroupPerformance: View {
    let group: RulingActionGroup
    let categoryAr: String
    /// True when more than one وجه is recorded for the word, so each group shows its wajh number.
    let showWajhs: Bool

    var body: some View {
        let showAction = QiraatClassification.shouldShowAction(group.action, categoryAr: categoryAr)
        let conditions = unique(group.entries.compactMap { $0.condition?.trimmingCharacters(in: .whitespaces) })
        let notes = unique(group.entries.compactMap { $0.wajhNote?.trimmingCharacters(in: .whitespaces) })
        let wajhs = showWajhs ? Array(Set(group.entries.compactMap(\.wajhOrder))).sorted() : []
        if showAction || !conditions.isEmpty || !wajhs.isEmpty {
            HStack(spacing: 4) {
                ForEach(wajhs, id: \.self) { n in
                    QiraatBadge(Text("وجه \(n)"))
                }
                if showAction {
                    ForEach(QiraatDabtSymbol.symbols(for: group.action), id: \.self) { symbol in
                        QiraatDabtSymbol(kind: symbol)
                    }
                    Text(verbatim: group.action).font(.caption.bold())
                }
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
