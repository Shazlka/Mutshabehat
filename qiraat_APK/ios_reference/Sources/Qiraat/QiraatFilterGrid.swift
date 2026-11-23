import MushafCore
import SwiftUI

/// Every reader and narrator on one screen, three columns of cards: one tap picks «الكل», a reader with both of
/// their narrators, or one narrator. The page's own colours mark each card.
struct QiraatFilterGrid: View {
    let catalog: QiraatCatalog
    @Binding var selection: QiraatFilter
    @Environment(\.dismiss) private var dismiss

    @Environment(\.dynamicTypeSize) private var typeSize

    /// Three columns at normal sizes; one at accessibility sizes, where a name like «الإمام ابن كثير» cannot fit in a third of the width.
    private var columns: [GridItem] {
        Array(repeating: GridItem(.flexible(), spacing: 8, alignment: .top), count: typeSize.isAccessibilitySize ? 1 : 3)
    }

    private var readers: [QiraatCatalog.Reader] { catalog.readers.sorted { $0.sortOrder < $1.sortOrder } }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 10) {
                    allButton
                    LazyVGrid(columns: columns, spacing: 8) {
                        ForEach(readers) { reader in card(reader) }
                    }
                }
                .padding(12)
            }
            .scrollBounceBehavior(.basedOnSize)
            .navigationTitle("اختر القارئ أو الراوي")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("إغلاق") { dismiss() }.accessibilityIdentifier("qiraat-filter-close")
                }
            }
        }
    }

    private func choose(_ filter: QiraatFilter) {
        selection = filter
        dismiss()
    }

    private var allButton: some View {
        let color = Color(qiraatHex: catalog.multiReaderColor)
        return Button { choose(.all) } label: {
            tile(Text("كل القراء والرواة"), color: color, isSelected: selection == .all, weight: .semibold)
        }
        .buttonStyle(GridTileButtonStyle())
        .accessibilityAddTraits(selection == .all ? .isSelected : [])
        .accessibilityIdentifier("qiraat-reader-all")
    }

    /// A reader: their name selects both narrators; the two narrators under it select one each.
    private func card(_ reader: QiraatCatalog.Reader) -> some View {
        let color = Color(qiraatHex: reader.color)
        let readerFilter = QiraatFilter.reader(reader.id)
        return VStack(spacing: 6) {
            Button { choose(readerFilter) } label: {
                tile(Text("الإمام \(reader.nameArShort)"), color: color, isSelected: selection == readerFilter, weight: .bold)
            }
            .buttonStyle(GridTileButtonStyle())
            .accessibilityAddTraits(selection == readerFilter ? .isSelected : [])
            .accessibilityIdentifier("qiraat-reader-\(reader.id)")

            ForEach(catalog.narrators(of: reader.id)) { narrator in
                let narratorColor = Color(qiraatHex: narrator.color)
                let filter = QiraatFilter.reading(narrator.id)
                Button { choose(filter) } label: {
                    tile(Text(verbatim: narrator.nameAr), color: narratorColor, isSelected: selection == filter, weight: .regular)
                }
                .buttonStyle(GridTileButtonStyle())
                .accessibilityAddTraits(selection == filter ? .isSelected : [])
                .accessibilityIdentifier("qiraat-narrator-\(narrator.id)")
            }
        }
        .padding(6)
        .background(color.opacity(0.07), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(color.opacity(0.25), lineWidth: 1))
    }

    private func tile(_ title: Text, color: Color, isSelected: Bool, weight: Font.Weight) -> some View {
        HStack(spacing: 4) {
            Circle().fill(color).frame(width: 8, height: 8)
            title
                .font(.subheadline.weight(weight))
                .foregroundStyle(.primary)
                .lineLimit(typeSize.isAccessibilitySize ? nil : 2)
                .minimumScaleFactor(typeSize.isAccessibilitySize ? 1 : 0.8)
                .multilineTextAlignment(.leading)
            Spacer(minLength: 0)
            if isSelected {
                Image(systemName: "checkmark").font(.caption.weight(.bold)).foregroundStyle(color)
            }
        }
        .padding(.horizontal, 8)
        .frame(maxWidth: .infinity, minHeight: 44)
        .background(color.opacity(isSelected ? 0.22 : 0.10), in: RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(color.opacity(isSelected ? 0.7 : 0.25), lineWidth: isSelected ? 1.5 : 1))
        .contentShape(RoundedRectangle(cornerRadius: 8))
    }
}

private struct GridTileButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .opacity(configuration.isPressed ? 0.72 : 1.0)
            .scaleEffect(configuration.isPressed ? 0.97 : 1.0)
            .animation(.easeOut(duration: 0.1), value: configuration.isPressed)
    }
}
