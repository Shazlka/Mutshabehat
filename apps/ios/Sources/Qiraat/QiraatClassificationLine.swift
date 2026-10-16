import MushafCore
import SwiftUI

/// A small view displaying «الفئة › الفرعي › التفصيل» as chips or a ›-separated line,
/// RTL-correct, wrapping with FlowLayout.
struct QiraatClassificationLine: View {
    struct Chip: Identifiable, Hashable {
        let id: String
        let name: String
        let colorHex: String?
        /// A string-catalog key when the chip is app chrome that follows the app's language; nil for data
        /// (ruling categories, sub-categories) that stays Arabic.
        let localizationKey: String?

        init(name: String, colorHex: String? = nil, localizationKey: String? = nil) {
            self.id = name
            self.name = name
            self.colorHex = colorHex
            self.localizationKey = localizationKey
        }

        var text: Text {
            if let localizationKey { Text(LocalizedStringKey(localizationKey)) } else { Text(verbatim: name) }
        }
    }

    let chips: [Chip]
    let fullClassification: String

    init(variant: QiraatVariant) {
        let sub = QiraatClassification.subCategory(for: variant)
        self.chips = [
            Chip(name: QiraatClassification.farshCategoryTitle, localizationKey: QiraatClassification.farshCategoryTitle),
            Chip(name: sub, localizationKey: QiraatClassification.subCategoryKey(for: variant.differenceType))
        ]
        self.fullClassification = QiraatClassification.classification(for: variant)
    }

    init(ruling: QiraatRuling) {
        var items = [
            Chip(name: QiraatClassification.usulCategoryTitle, localizationKey: QiraatClassification.usulCategoryTitle),
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
                    QiraatBadge(chip.text)
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityIdentifier("qiraat-classification")
        .accessibilityLabel(accessibilityText)
    }

    /// The chips read in order, in the app's language where a chip follows it (VoiceOver and UI tests read this).
    private var accessibilityText: Text {
        chips.dropFirst().reduce(chips.first?.text ?? Text(verbatim: "")) { line, chip in
            line + Text(verbatim: " › ") + chip.text
        }
    }
}
