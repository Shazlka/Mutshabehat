import MushafCore
import SwiftUI
import UIKit

/// One variant card: the differing reading in the Mushaf's Uthmani face, and the readers who read it.
struct VariantCard: View {
    let variant: QiraatVariant
    let catalog: QiraatCatalog
    let filter: QiraatFilter

    var body: some View {
        let performanceOnly = variant.isPerformanceOnly && variant.performanceNote != nil
        let label = variant.performanceNote ?? differenceTypeLabelAr(variant.differenceType)
        let text = variant.uthmaniText ?? (performanceOnly ? variant.hafsText : variant.variantText)
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                QiraatBadge(text: label, foreground: Color(qiraatHex: "#7a5a10"), background: Color(qiraatHex: "#f1e2b6"))
                Spacer()
                Text("خلاف في الرسم").font(.caption2.bold()).foregroundStyle(.secondary)
            }
            Text(verbatim: text)
                .font(variantFont)
                .foregroundStyle(Color(qiraatHex: "#7a1f1a"))
                .frame(maxWidth: .infinity)
            QiraatPills(pills: rollupAuthorityPills(scopedReadingIds, catalog: catalog))
            if variant.verificationStatus == "NEEDS_MANUAL_REVIEW" { QiraatNeedsReviewBadge() }
        }
        .padding(10)
        .background(RoundedRectangle(cornerRadius: 10).fill(.white))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color(qiraatHex: "#e3d6b4")))
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
        let font = UIFont(name: "KFGQPCUthmanicScriptHAFS", size: 40)
            ?? UIFont(name: "DamascusBold", size: 40)
            ?? UIFont.systemFont(ofSize: 40, weight: .bold)
        return Font(font)
    }
}
