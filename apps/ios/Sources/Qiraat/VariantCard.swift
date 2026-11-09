import MushafCore
import SwiftUI
import UIKit

/// One variant card: the sub-category, then a split matrix with the differing reading in the Mushaf's Uthmani
/// face on one side and the readers who read it on the other, and the references as a footer.
struct VariantCard: View {
    let variant: QiraatVariant
    let catalog: QiraatCatalog
    let filter: QiraatFilter

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    /// The reading follows the title metric up to `maxWordSize`.
    static let maxWordSize: CGFloat = 72

    var body: some View {
        let performanceOnly = variant.isPerformanceOnly && variant.performanceNote != nil
        let text = variant.uthmaniText ?? (performanceOnly ? variant.hafsText : variant.variantText)
        VStack(alignment: .leading, spacing: 12) {
            QiraatClassificationLine(variant: variant)
            QiraatMatrixRow {
                wordColumn(text)
            } readers: {
                readers
            }
            .padding(.vertical, 4)
            QiraatReferencesRow(variant: variant, catalog: catalog)
            if variant.verificationStatus == "NEEDS_MANUAL_REVIEW" { QiraatNeedsReviewBadge() }
        }
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 16).fill(.qiraatCardFill))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(.qiraatCardStroke))
        .environment(\.layoutDirection, .rightToLeft)
    }

    /// The word, with its short descriptor («بلا ألف») above it and the performance note under it.
    private func wordColumn(_ text: String) -> some View {
        VStack(spacing: 6) {
            if variant.endToken > variant.startToken {
                Text("الكلمات محل الخلاف")
                    .font(.caption.bold())
                    .foregroundStyle(Color(uiColor: .mushafBrown))
                    .accessibilityIdentifier("qiraat-span-heading")
            }
            if let description = variant.description?.trimmingCharacters(in: .whitespacesAndNewlines), !description.isEmpty {
                QiraatDescriptorPill(text: description)
            }
            Text(verbatim: text)
                .font(variantFont(size: text.contains(" ") ? 26 : 34))
                .foregroundStyle(.qiraatVariantInk)
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .minimumScaleFactor(0.7)
                .allowsTightening(true)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity)
                .accessibilityIdentifier("qiraat-variant-text")
            if let note = variant.performanceNote?.trimmingCharacters(in: .whitespacesAndNewlines), !note.isEmpty, note != variant.description {
                HStack(spacing: 4) {
                    ForEach(QiraatDabtSymbol.symbols(for: note), id: \.self) { symbol in
                        QiraatDabtSymbol(kind: symbol)
                    }
                    Text(verbatim: note)
                        .font(.caption.bold())
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }
            }
        }
        .frame(maxWidth: .infinity)
    }

    /// Who reads it, and how: one group per action with its reader chips and that group's details (الأداء،
    /// وجه N، الخلاف), so ابن ذكوان's own «بالياء» is not folded behind ابن عامر's chip. Plain chips when
    /// the web sent no per-reader rows for this word.
    @ViewBuilder private var readers: some View {
        let groups = variant.attributionByAction(scopedTo: scopedReadingIds, catalog: catalog)
        if groups.isEmpty {
            QiraatAttributionGrid(pills: rollupAuthorityPills(scopedReadingIds, catalog: catalog), catalog: catalog)
        } else {
            let showWajhs = groups.contains { $0.entries.contains { ($0.wajhOrder ?? 1) > 1 } }
            let label = variant.performanceNote ?? differenceTypeLabelAr(variant.differenceType)
            VStack(alignment: .leading, spacing: 10) {
                ForEach(groups, id: \.action) { group in
                    VStack(alignment: .leading, spacing: 4) {
                        QiraatAttributionGrid(pills: rollupAuthorityPills(group.entries.map(\.authorityId), catalog: catalog),
                                              catalog: catalog)
                        QiraatGroupPerformance(group: group, categoryAr: label, showWajhs: showWajhs)
                    }
                    .accessibilityIdentifier("qiraat-variant-reader-group")
                }
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
    private func variantFont(size: CGFloat) -> Font {
        _ = dynamicTypeSize // Recompute when the SwiftUI Dynamic Type environment changes.
        let baseFont = UIFont(name: "KFGQPCUthmanicScriptHAFS", size: size)
            ?? UIFont(name: "DamascusBold", size: size)
            ?? UIFont.systemFont(ofSize: size, weight: .bold)
        return Font(UIFontMetrics(forTextStyle: .title1)
            .scaledFont(for: baseFont, maximumPointSize: Self.maxWordSize))
    }
}
