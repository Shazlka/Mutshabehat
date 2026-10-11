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
            FlowLayout(spacing: 6) {
                QiraatBadge(performanceOnly
                    ? Text("qiraat.difference.PERFORMANCE")
                    : differenceLabel(variant.differenceType))
                if let note = variant.performanceNote {
                    Text(verbatim: note).font(.caption2.bold()).foregroundStyle(.secondary)
                }
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
            QiraatPills(pills: rollupAuthorityPills(scopedReadingIds, catalog: catalog))
            if variant.verificationStatus == "NEEDS_MANUAL_REVIEW" { QiraatNeedsReviewBadge() }
        }
        .padding(10)
        .background(RoundedRectangle(cornerRadius: 10).fill(.qiraatCardFill))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(.qiraatCardStroke))
    }

    /// The web's difference-kind labels (`DIFFERENCE_TYPE_LABELS_AR`), translated. Unknown kinds read as "other".
    private func differenceLabel(_ type: String?) -> Text {
        switch type {
        case "HARAKAH": Text("qiraat.difference.HARAKAH")
        case "LETTER": Text("qiraat.difference.LETTER")
        case "ADDITION": Text("qiraat.difference.ADDITION")
        case "OMISSION": Text("qiraat.difference.OMISSION")
        case "MADD": Text("qiraat.difference.MADD")
        case "HAMZ": Text("qiraat.difference.HAMZ")
        case "IMALAH": Text("qiraat.difference.IMALAH")
        case "IDGHAM": Text("qiraat.difference.IDGHAM")
        case "WAQF": Text("qiraat.difference.WAQF")
        case "NAQL": Text("qiraat.difference.NAQL")
        case "SILAH": Text("qiraat.difference.SILAH")
        case "ORTHOGRAPHY": Text("qiraat.difference.ORTHOGRAPHY")
        default: Text("qiraat.difference.OTHER")
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
