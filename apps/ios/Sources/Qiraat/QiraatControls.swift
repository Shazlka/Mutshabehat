import MushafCore
import SwiftUI

/// Native Settings switch for the Qiraat layer.
struct QiraatToggle: View {
    @Binding var isOn: Bool

    var body: some View {
        Toggle("إظهار علامات القراءات", isOn: $isOn)
            .toggleStyle(.switch)
            .tint(.progressFill)
        .accessibilityLabel("القراءات العشر")
        .accessibilityValue(isOn ? "مفعّلة" : "متوقفة")
        .accessibilityIdentifier("qiraat-toggle")
    }
}

/// The choices of the Qiraat filter: all, then one reader (both narrators or either one) per submenu.
/// Shared by the standalone menu and the reader's Qiraat menu. A checkmark marks the current choice.
struct QiraatFilterItems: View {
    let catalog: QiraatCatalog
    @Binding var filter: QiraatFilter

    var body: some View {
        choice("الكل", .all, id: "qiraat-filter-all")
        ForEach(catalog.readers.sorted { $0.sortOrder < $1.sortOrder }) { reader in
            Menu("الإمام \(reader.nameArShort)") {
                choice("روايتاه معًا", .reader(reader.id), id: "qiraat-filter-reader-\(reader.id)")
                ForEach(catalog.narrators(of: reader.id)) { narrator in
                    choice("الراوي \(narrator.nameAr)", .reading(narrator.id), id: "qiraat-filter-narrator-\(narrator.id)")
                }
            }
            .accessibilityIdentifier("qiraat-filter-menu-\(reader.id)")
        }
    }

    private func choice(_ title: String, _ value: QiraatFilter, id: String) -> some View {
        Toggle(title, isOn: Binding(get: { filter == value }, set: { _ in filter = value }))
            .accessibilityIdentifier(id)
    }
}

/// Narrows the page to one reader or one narrator (the web's comparison filter).
struct QiraatFilterMenu: View {
    let catalog: QiraatCatalog
    @Binding var filter: QiraatFilter

    var body: some View {
        Menu {
            QiraatFilterItems(catalog: catalog, filter: $filter)
        } label: {
            Label(catalog.filterName(filter), systemImage: "line.3.horizontal.decrease.circle")
                .labelStyle(.titleAndIcon)
                .font(.subheadline.bold())
        }
        .accessibilityIdentifier("qiraat-filter")
    }
}

extension QiraatCatalog {
    /// The filter spelled out: «الإمام نافع», «الراوي ورش», or «الكل».
    func filterName(_ filter: QiraatFilter) -> String {
        switch filter {
        case .all: "الكل"
        case .reader(let id): reader(id).map { "الإمام \($0.nameArShort)" } ?? id
        case .reading(let id): narrator(id).map { "الراوي \($0.nameAr)" } ?? id
        }
    }

    /// The filter as a short label for the reading header: the reader's short name, or the narrator's name
    /// (the repeated «الإمام» / «الراوي» dropped). Nil for «الكل».
    func filterShortName(_ filter: QiraatFilter) -> String? {
        switch filter {
        case .all: nil
        case .reader(let id): reader(id)?.nameArShort ?? id
        case .reading(let id): narrator(id)?.nameAr ?? id
        }
    }
}
