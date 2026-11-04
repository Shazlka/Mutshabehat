import MushafCore
import SwiftUI
import UIKit

/// What the page views need to know to draw the Qiraat layer.
struct QiraatDisplay: Equatable {
    var enabled: Bool
    var filter: QiraatFilter
    /// «فرش فقط»: the أصول rulings are left out of everything the reader shows.
    var hidesUsul: Bool = false
    /// The أصول categories (`QiraatRuling.category` codes) the reader switched off one by one.
    var hiddenUsulCategories: Set<String> = []
    /// The soft wash the page takes from the chosen reader; nil for «الكل» or while the layer is off.
    var pageTint: QiraatColor?

    static let off = QiraatDisplay(enabled: false, filter: .all)
}

/// The reader's Qiraat choices, kept per device. The layer key is the web's
/// (`mushaf1441:reader-layer:v1`); on iOS only `qiraat` and `none` exist so far, and a new install
/// starts with Qiraat on until the متشابهات layer arrives.
@MainActor
@Observable
final class QiraatPreferences {
    static let layerKey = "mushaf1441:reader-layer:v1"
    static let filterKey = "mushaf1441:qiraat-filter:v1"
    static let hidesUsulKey = "mushaf1441:qiraat-hide-usul:v1"
    static let hiddenUsulCategoriesKey = "mushaf1441:qiraat-hidden-usul-categories:v1"

    @ObservationIgnored private let defaults: UserDefaults

    var enabled: Bool {
        didSet { defaults.set(enabled ? "qiraat" : "none", forKey: Self.layerKey) }
    }

    var filter: QiraatFilter {
        didSet { defaults.set(filter.storageValue, forKey: Self.filterKey) }
    }

    /// Keep only فرش: no أصول marks, cards, search results, key rows or index. Off by default.
    var hidesUsul: Bool {
        didSet { defaults.set(hidesUsul, forKey: Self.hidesUsulKey) }
    }

    /// The باب codes switched off in the settings list. A new install shows every باب.
    var hiddenUsulCategories: Set<String> {
        didSet { defaults.set(hiddenUsulCategories.sorted(), forKey: Self.hiddenUsulCategoriesKey) }
    }

    func setUsul(_ code: String, shown: Bool) {
        if shown { hiddenUsulCategories.remove(code) } else { hiddenUsulCategories.insert(code) }
    }

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        enabled = (defaults.string(forKey: Self.layerKey) ?? "qiraat") == "qiraat"
        filter = defaults.string(forKey: Self.filterKey).flatMap(QiraatFilter.init(storageValue:)) ?? .all
        hidesUsul = defaults.bool(forKey: Self.hidesUsulKey)
        hiddenUsulCategories = Set(defaults.stringArray(forKey: Self.hiddenUsulCategoriesKey) ?? [])
    }

    var display: QiraatDisplay { display(catalog: nil) }

    /// With the catalog, the chosen reader also tints the page.
    func display(catalog: QiraatCatalog?) -> QiraatDisplay {
        let tint = enabled ? catalog.flatMap { QiraatPageTint.readerColor(for: filter, catalog: $0) } : nil
        return QiraatDisplay(enabled: enabled, filter: filter, hidesUsul: hidesUsul,
                             hiddenUsulCategories: hiddenUsulCategories, pageTint: tint)
    }
}

extension UIColor {
    /// A web "#RRGGBB" colour; ink if it does not parse.
    convenience init(qiraatHex hex: String) {
        let c = QiraatColor(hex: hex) ?? QiraatColor(red: 0.09, green: 0.09, blue: 0.09)
        self.init(red: c.red, green: c.green, blue: c.blue, alpha: 1)
    }
}

extension Color {
    init(qiraatHex hex: String) { self.init(uiColor: UIColor(qiraatHex: hex)) }
}
