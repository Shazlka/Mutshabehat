import MushafCore
import SwiftUI
import UIKit

/// One variant card: the differing reading in the Mushaf's Uthmani face, and the readers who read it.
struct VariantCard: View {
    let variant: QiraatVariant
    let catalog: QiraatCatalog
    let filter: QiraatFilter

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    /// The reading is set at 40 pt and follows the title metric up to `maxWordSize`.
    static let maxWordSize: CGFloat = 72

    var body: some View {
        let performanceOnly = variant.isPerformanceOnly && variant.performanceNote != nil
        let text = variant.uthmaniText ?? (performanceOnly ? variant.hafsText : variant.variantText)
        VStack(alignment: .leading, spacing: 8) {
            QiraatClassificationLine(variant: variant)
            if variant.endToken > variant.startToken {
                Text("الكلمات محل الخلاف")
                    .font(.caption.bold())
                    .foregroundStyle(Color(uiColor: .mushafBrown))
                    .accessibilityIdentifier("qiraat-span-heading")
            }
            Text(verbatim: text)
                .font(variantFont)
                .foregroundStyle(.qiraatVariantInk)
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .minimumScaleFactor(0.65)
                .allowsTightening(true)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity)
                .accessibilityIdentifier("qiraat-variant-text")
            if let description = variant.description?.trimmingCharacters(in: .whitespacesAndNewlines), !description.isEmpty {
                Text(verbatim: description)
                    .font(.caption)
                    .foregroundStyle(Color(uiColor: .mushafBrown))
            }
            if let note = variant.performanceNote?.trimmingCharacters(in: .whitespacesAndNewlines), !note.isEmpty, note != variant.description {
                HStack(spacing: 4) {
                    ForEach(QiraatDabtSymbol.symbols(for: note), id: \.self) { symbol in
                        QiraatDabtSymbol(kind: symbol)
                    }
                    Text(verbatim: note)
                        .font(.caption.bold())
                        .foregroundStyle(.secondary)
                }
            }
            readers
            if variant.verificationStatus == "NEEDS_MANUAL_REVIEW" { QiraatNeedsReviewBadge() }
        }
        .padding(10)
        .background(RoundedRectangle(cornerRadius: 10).fill(.qiraatCardFill))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(.qiraatCardStroke))
    }

    /// Who reads it, and how: one group per action with its reader pills and that group's details (الأداء،
    /// وجه N، الخلاف), so ابن ذكوان's own «بالياء» is not folded behind ابن عامر's pill. Plain pills when
    /// the web sent no per-reader rows for this word.
    @ViewBuilder private var readers: some View {
        let groups = variant.attributionByAction(scopedTo: scopedReadingIds, catalog: catalog)
        if groups.isEmpty {
            QiraatPills(pills: rollupAuthorityPills(scopedReadingIds, catalog: catalog))
        } else {
            let showWajhs = groups.contains { $0.entries.contains { ($0.wajhOrder ?? 1) > 1 } }
            let label = variant.performanceNote ?? differenceTypeLabelAr(variant.differenceType)
            ForEach(groups, id: \.action) { group in
                VStack(alignment: .leading, spacing: 4) {
                    QiraatPills(pills: rollupAuthorityPills(group.entries.map(\.authorityId), catalog: catalog))
                    QiraatGroupPerformance(group: group, categoryAr: label, showWajhs: showWajhs)
                }
                .accessibilityIdentifier("qiraat-variant-reader-group")
            }
        }
    }

    /// The readers to show: narrowed to the selected reader or reading when the filter names one.
    private var scopedReadingIds: [String] {
        let scoped: [String] = switch filter {
        case .all: variant.readingIds
        case .reader(let readerId): variant.readingIds.filter { catalog.readerId(ofReading: $0) == readerId }
        case .reading(let readingId): variant.readingIds.filter { $0 == readingId }
        }
        return scoped.isEmpty ? variant.readingIds : scoped
    }

    /// QCF page fonts encode complete page-specific word glyphs in the private-use area, so a
    /// changed Unicode spelling cannot be shaped by them. The KFGQPC Unicode Mushaf face shapes
    /// the changed reading and its harakat without reusing the original word's incorrect QCF glyph.
    private var variantFont: Font {
        _ = dynamicTypeSize // Recompute when the SwiftUI Dynamic Type environment changes.
        let baseFont = UIFont(name: "KFGQPCUthmanicScriptHAFS", size: 40)
            ?? UIFont(name: "DamascusBold", size: 40)
            ?? UIFont.systemFont(ofSize: 40, weight: .bold)
        return Font(UIFontMetrics(forTextStyle: .title1)
            .scaledFont(for: baseFont, maximumPointSize: Self.maxWordSize))
    }
}
