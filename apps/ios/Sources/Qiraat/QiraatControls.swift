import MushafCore
import SwiftUI

/// Native Settings switch for the Qiraat layer.
struct QiraatToggle: View {
    @Binding var isOn: Bool

    var body: some View {
        Toggle("إظهار علامات القراءات", isOn: $isOn)
            .toggleStyle(.switch)
            .tint(.switchOn)
            // No label or value override: the spoken name must contain the visible text (Voice Control says
            // "tap إظهار علامات القراءات"), and the switch already reports on/off itself.
            .accessibilityIdentifier("qiraat-toggle")
    }
}

extension QiraatCatalog {
    /// The filter spelled out: «الإمام نافع», «الراوي ورش», or «الكل».
    func filterName(_ filter: QiraatFilter) -> LocalizedStringKey {
        switch filter {
        case .all: "الكل"
        case .reader(let id): reader(id).map { "الإمام \($0.nameArShort)" } ?? LocalizedStringKey(id)
        case .reading(let id): narrator(id).map { "الراوي \(unambiguousName(of: $0))" } ?? LocalizedStringKey(id)
        }
    }

    /// The narrator's catalog name, with «عن <الإمام>» added when that name is also the opening word of another
    /// reader's name: Q06-R01 is «خلف» in the catalog, beside the reader «خلف العاشر» (AGENTS.md §4, never a bare «خلف»).
    func unambiguousName(of narrator: Narrator) -> String {
        let name = narrator.nameAr
        var clashes = false
        for other in readers where other.id != narrator.readerId {
            let opening = other.nameArShort.split(separator: " ").first.map(String.init)
            if opening == name { clashes = true }
        }
        guard clashes, let own = reader(narrator.readerId) else { return name }
        return appLocalized("\(name) عن \(own.nameArShort)")
    }

    /// The filter as a short label for the reading header: the reader's short name, or the narrator's name
    /// (the repeated «الإمام» / «الراوي» dropped). Nil for «الكل».
    func filterShortName(_ filter: QiraatFilter) -> String? {
        switch filter {
        case .all: nil
        case .reader(let id): reader(id)?.nameArShort ?? id
        case .reading(let id): narrator(id).map(unambiguousName(of:)) ?? id
        }
    }
}
