import MushafCore
import SwiftUI

/// A small view displaying «الفئة › الفرعي › التفصيل» as chips or a ›-separated line,
/// RTL-correct, wrapping with FlowLayout.
struct QiraatClassificationLine: View {
    struct Chip: Identifiable, Hashable {
        let id: String
        let name: String
        let colorHex: String?

        init(name: String, colorHex: String? = nil) {
            self.id = name
            self.name = name
            self.colorHex = colorHex
        }
    }

    let chips: [Chip]
    let fullClassification: String

    init(variant: QiraatVariant) {
        let sub = QiraatClassification.subCategory(for: variant)
        self.chips = [
            Chip(name: QiraatClassification.farshCategoryTitle),
            Chip(name: sub)
        ]
        self.fullClassification = QiraatClassification.classification(for: variant)
    }

    init(ruling: QiraatRuling) {
        var items = [
            Chip(name: QiraatClassification.usulCategoryTitle),
            Chip(name: ruling.categoryAr, colorHex: ruling.color)
        ]
        if let subDetail = QiraatClassification.usulSubCategory(for: ruling), !subDetail.isEmpty {
            items.append(Chip(name: subDetail))
        }
        self.chips = items
        self.fullClassification = QiraatClassification.classification(for: ruling)
    }

    init(segments: [String]) {
        self.chips = segments.map { Chip(name: $0) }
        self.fullClassification = segments.joined(separator: " › ")
    }

    var body: some View {
        FlowLayout(spacing: 5) {
            ForEach(Array(chips.enumerated()), id: \.offset) { index, chip in
                if index > 0 {
                    Text(verbatim: "›")
                        .font(.caption2.bold())
                        .foregroundStyle(.secondary)
                        .accessibilityHidden(true)
                }
                if let hex = chip.colorHex {
                    QiraatBadge(category: chip.name, hex: hex)
                } else {
                    QiraatBadge(text: chip.name)
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityIdentifier("qiraat-classification")
        .accessibilityLabel(fullClassification)
    }
}
