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
        .accessibilityValue(isOn ? Text("مفعّلة") : Text("متوقفة"))
        .accessibilityIdentifier("qiraat-toggle")
    }
}

extension QiraatCatalog {
    /// The filter spelled out: «الإمام نافع», «الراوي ورش», or «الكل».
    func filterName(_ filter: QiraatFilter) -> LocalizedStringKey {
        switch filter {
        case .all: "الكل"
        case .reader(let id): reader(id).map { "الإمام \($0.nameArShort)" } ?? LocalizedStringKey(id)
        case .reading(let id): narrator(id).map { "الراوي \($0.nameAr)" } ?? LocalizedStringKey(id)
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
