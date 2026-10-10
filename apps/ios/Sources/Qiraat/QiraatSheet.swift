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

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    header
                    ForEach(item.selection.variants) { VariantCard(variant: $0, catalog: catalog, filter: filter) }
                    ForEach(item.selection.rulings) { RulingCard(ruling: $0, catalog: catalog) }
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

    private var header: some View {
        HStack(alignment: .firstTextBaseline) {
            if let wordFont {
                // The exact Mushaf glyph, in its own page's font.
                Text(verbatim: item.word.glyph).font(Font(wordFont)).foregroundStyle(Color(uiColor: .mushafInk))
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
