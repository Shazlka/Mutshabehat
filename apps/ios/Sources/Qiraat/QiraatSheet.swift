import CoreText
import MushafCore
import SwiftUI
import UIKit

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

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    /// The header glyph is drawn at the size it was loaded at (40 pt) and follows the title metric up to 72 pt.
    private func scaledWordFont(_ font: CTFont) -> CTFont {
        _ = dynamicTypeSize // Recompute when the SwiftUI Dynamic Type environment changes.
        let baseSize = CTFontGetSize(font)
        let scaledSize = UIFontMetrics(forTextStyle: .title1).scaledValue(for: baseSize)
        return CTFontCreateCopyWithAttributes(font, min(scaledSize, VariantCard.maxWordSize), nil, nil)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    header
                    if !item.selection.variants.isEmpty {
                        sectionHeading("الفرش")
                        ForEach(item.selection.variants) { VariantCard(variant: $0, catalog: catalog, filter: filter) }
                    }
                    if !item.selection.rulings.isEmpty {
                        sectionHeading("الأصول")
                        ForEach(item.selection.rulings) { RulingCard(ruling: $0, catalog: catalog) }
                    }
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
        .presentationDetents([.medium, .large])
    }

    /// «الفرش» (the words that differ) and «الأصول» (the rules that colour a word), as VoiceOver headings.
    private func sectionHeading(_ title: LocalizedStringKey) -> some View {
        Text(title)
            .font(.subheadline.bold())
            .foregroundStyle(Color(uiColor: .mushafBrown))
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 4)
            .accessibilityAddTraits(.isHeader)
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline) {
            if let wordFont {
                // The exact Mushaf glyph, in its own page's font.
                Text(verbatim: item.word.glyph)
                    .font(Font(scaledWordFont(wordFont)))
                    .foregroundStyle(Color(uiColor: .mushafInk))
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                    .allowsTightening(true)
                    .layoutPriority(1)
            } else {
                Text(verbatim: item.word.textUthmani).scaledFont(size: 30, weight: .bold)
            }
            Spacer()
            Text(verbatim: item.word.ayahKey.description)
                .font(.caption.bold()).foregroundStyle(.secondary)
                .environment(\.layoutDirection, .leftToRight)
        }
        .padding(.bottom, 4)
        .overlay(alignment: .bottom) { Divider() }
    }
}
