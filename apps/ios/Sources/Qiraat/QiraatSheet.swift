import CoreText
import MushafCore
import SwiftUI

/// A tapped word and what the Qiraat layer knows about it.
struct QiraatWordSelection: Identifiable {
    let id = UUID()
    let word: MushafWord
    let selection: QiraatSelection
}

/// The detail card the web shows in its Qiraat sidebar (`renderQiraatSelection`), as a sheet:
/// the word, one card per variant with who reads it, and one card per أصول ruling grouped by action.
struct QiraatSheet: View {
    let item: QiraatWordSelection
    let catalog: QiraatCatalog
    let filter: QiraatFilter
    let wordFont: CTFont?
    let onClose: () -> Void

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    header
                    ForEach(item.selection.variants) { variantCard($0) }
                    ForEach(item.selection.rulings) { rulingCard($0) }
                }
                .padding()
            }
            .background(Color(uiColor: .mushafPaper))
            .navigationTitle("القراءات العشر")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("إغلاق", action: onClose).accessibilityIdentifier("qiraat-sheet-close")
                }
            }
        }
        .environment(\.layoutDirection, .rightToLeft)
        .presentationDetents([.medium, .large])
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline) {
            if let wordFont {
                // The exact Mushaf glyph, in its own page's font.
                Text(verbatim: item.word.glyph).font(Font(wordFont)).foregroundStyle(Color(uiColor: .mushafInk))
            } else {
                Text(verbatim: item.word.textUthmani).font(.system(size: 30, weight: .bold))
            }
            Spacer()
            Text(verbatim: item.word.ayahKey.description)
                .font(.caption.bold()).foregroundStyle(.secondary)
                .environment(\.layoutDirection, .leftToRight)
        }
        .padding(.bottom, 4)
        .overlay(alignment: .bottom) { Divider() }
    }

    // MARK: Variants

    private func scopedReadingIds(_ variant: QiraatVariant) -> [String] {
        let scoped: [String] = switch filter {
        case .all: variant.readingIds
        case .reader(let readerId): variant.readingIds.filter { catalog.readerId(ofReading: $0) == readerId }
        case .reading(let readingId): variant.readingIds.filter { $0 == readingId }
        }
        return scoped.isEmpty ? variant.readingIds : scoped
    }

    private func variantCard(_ variant: QiraatVariant) -> some View {
        let performanceOnly = variant.isPerformanceOnly && variant.performanceNote != nil
        let label = variant.performanceNote ?? differenceTypeLabelAr(variant.differenceType)
        let text = variant.uthmaniText ?? (performanceOnly ? variant.hafsText : variant.variantText)
        return VStack(alignment: .leading, spacing: 8) {
            HStack {
                badge(label, foreground: Color(qiraatHex: "#7a5a10"), background: Color(qiraatHex: "#f1e2b6"))
                Spacer()
                Text("خلاف في الرسم").font(.caption2.bold()).foregroundStyle(.secondary)
            }
            Text(verbatim: text)
                .font(.system(size: 28, weight: .bold))
                .foregroundStyle(Color(qiraatHex: "#7a1f1a"))
                .frame(maxWidth: .infinity)
            pills(rollupAuthorityPills(scopedReadingIds(variant), catalog: catalog))
            if variant.verificationStatus == "NEEDS_MANUAL_REVIEW" { needsReview }
        }
        .padding(10)
        .background(RoundedRectangle(cornerRadius: 10).fill(.white))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color(qiraatHex: "#e3d6b4")))
    }

    // MARK: أصول rulings

    private func rulingCard(_ ruling: QiraatRuling) -> some View {
        let color = Color(qiraatHex: ruling.color)
        let distinct = distinctRulingText(ruling.text, categoryAr: ruling.categoryAr, actions: ruling.attribution.map(\.action))
        return VStack(alignment: .leading, spacing: 8) {
            HStack {
                badge(ruling.categoryAr, foreground: .white, background: color)
                Spacer()
                if let condition = ruling.condition {
                    Text(verbatim: condition).font(.caption2.bold()).foregroundStyle(.secondary)
                }
            }
            ForEach(ruling.attributionByAction, id: \.action) { group in
                VStack(alignment: .leading, spacing: 4) {
                    pills(rollupAuthorityPills(group.entries.map(\.authorityId), catalog: catalog))
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
            if ruling.verificationStatus == "NEEDS_MANUAL_REVIEW" { needsReview }
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
                    badge("وجه \(n)", foreground: Color(qiraatHex: "#7a5a10"), background: Color(qiraatHex: "#f1e2b6"))
                }
                if showAction { Text(verbatim: group.action).font(.caption.bold()) }
                if !conditions.isEmpty {
                    Text(verbatim: (showAction ? "— " : "") + conditions.joined(separator: "، "))
                        .font(.caption).foregroundStyle(.secondary)
                }
            }
        }
        ForEach(notes, id: \.self) { Text(verbatim: "الخلاف: \($0)").font(.caption).foregroundStyle(.secondary) }
    }

    // MARK: Pieces

    private func pills(_ pills: [AuthorityPill]) -> some View {
        FlowLayout(spacing: 6) {
            ForEach(pills) { pill in
                let color = Color(qiraatHex: pill.color)
                HStack(spacing: 5) {
                    Circle().fill(color).frame(width: 6, height: 6)
                    Text(verbatim: pill.name).font(.caption.bold())
                }
                .foregroundStyle(color)
                .padding(.horizontal, 9).padding(.vertical, 4)
                .background(Capsule().fill(color.opacity(0.08)))
                .overlay(Capsule().stroke(color.opacity(0.35)))
                .accessibilityElement(children: .combine)
            }
        }
    }

    private func badge(_ text: String, foreground: Color, background: Color) -> some View {
        Text(verbatim: text).font(.caption2.bold()).foregroundStyle(foreground)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(Capsule().fill(background))
    }

    private var needsReview: some View {
        badge("تحتاج مراجعة يدوية", foreground: Color(qiraatHex: "#8a2f10"), background: Color(qiraatHex: "#f7d2c4"))
    }

    private func unique(_ values: [String]) -> [String] {
        var seen: [String] = []
        for v in values where !v.isEmpty && !seen.contains(v) { seen.append(v) }
        return seen
    }
}

/// Wraps its children onto as many rows as they need (reader pills).
struct FlowLayout: Layout {
    var spacing: CGFloat = 6

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let rows = arrange(subviews, width: proposal.width ?? .infinity)
        let height = rows.map(\.height).reduce(0, +) + spacing * CGFloat(max(rows.count - 1, 0))
        return CGSize(width: proposal.width ?? rows.map(\.width).max() ?? 0, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        for row in arrange(subviews, width: bounds.width) {
            // Laid out leading to trailing; SwiftUI mirrors a custom Layout in a right-to-left environment.
            var x = bounds.minX
            for index in row.indices {
                let size = subviews[index].sizeThatFits(.unspecified)
                subviews[index].place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
                x += size.width + spacing
            }
            y += row.height + spacing
        }
    }

    private struct Row { var indices: [Int] = []; var width: CGFloat = 0; var height: CGFloat = 0 }

    private func arrange(_ subviews: Subviews, width: CGFloat) -> [Row] {
        var rows: [Row] = [Row()]
        for index in subviews.indices {
            let size = subviews[index].sizeThatFits(.unspecified)
            if !rows[rows.count - 1].indices.isEmpty, rows[rows.count - 1].width + spacing + size.width > width {
                rows.append(Row())
            }
            var row = rows[rows.count - 1]
            row.width += (row.indices.isEmpty ? 0 : spacing) + size.width
            row.height = max(row.height, size.height)
            row.indices.append(index)
            rows[rows.count - 1] = row
        }
        return rows
    }
}
