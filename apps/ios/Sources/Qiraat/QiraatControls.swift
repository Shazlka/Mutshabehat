import MushafCore
import SwiftUI

/// The «ق» button in the top bar: turns the Qiraat layer on and off (like the web's).
struct QiraatToggle: View {
    @Binding var isOn: Bool

    var body: some View {
        Button { isOn.toggle() } label: {
            Text(verbatim: "ق")
                .font(.system(size: 17, weight: .bold))
                .frame(width: 32, height: 32)
                .foregroundStyle(isOn ? Color.white : Color(uiColor: .mushafBrown))
                .background(Circle().fill(isOn ? Color(uiColor: .mushafGold) : Color.clear))
                .overlay(Circle().stroke(Color(uiColor: .mushafGold), lineWidth: 1.5))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("القراءات العشر")
        .accessibilityValue(isOn ? "مفعّلة" : "متوقفة")
        .accessibilityAddTraits(isOn ? .isSelected : [])
        .accessibilityIdentifier("qiraat-toggle")
    }
}

/// Narrows the page to one reader or one narrator (the web's comparison filter).
struct QiraatFilterMenu: View {
    let catalog: QiraatCatalog
    @Binding var filter: QiraatFilter

    var body: some View {
        Menu {
            Button { filter = .all } label: { selectable("الكل", .all) }
            ForEach(catalog.readers.sorted { $0.sortOrder < $1.sortOrder }) { reader in
                Menu("الإمام \(reader.nameArShort)") {
                    Button { filter = .reader(reader.id) } label: { selectable("روايتاه معًا", .reader(reader.id)) }
                    ForEach(catalog.narrators(of: reader.id)) { narrator in
                        Button { filter = .reading(narrator.id) } label: {
                            selectable("الراوي \(narrator.nameAr)", .reading(narrator.id))
                        }
                    }
                }
            }
        } label: {
            Label(name(of: filter), systemImage: "line.3.horizontal.decrease.circle")
                .labelStyle(.titleAndIcon)
                .font(.subheadline.bold())
        }
        .accessibilityIdentifier("qiraat-filter")
    }

    private func selectable(_ title: String, _ value: QiraatFilter) -> some View {
        Label(title, systemImage: value == filter ? "checkmark" : "")
    }

    private func name(of filter: QiraatFilter) -> String {
        switch filter {
        case .all: "الكل"
        case .reader(let id): catalog.reader(id).map { "الإمام \($0.nameArShort)" } ?? id
        case .reading(let id): catalog.narrator(id).map { "الراوي \($0.nameAr)" } ?? id
        }
    }
}
