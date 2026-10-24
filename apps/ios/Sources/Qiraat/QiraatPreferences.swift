import MushafCore
import SwiftUI
import UIKit

/// What the page views need to know to draw the Qiraat layer.
struct QiraatDisplay: Equatable {
    var enabled: Bool
    var filter: QiraatFilter
    /// «فرش فقط»: the أصول rulings are left out of everything the reader shows.
    var hidesUsul: Bool = false

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

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        enabled = (defaults.string(forKey: Self.layerKey) ?? "qiraat") == "qiraat"
        filter = defaults.string(forKey: Self.filterKey).flatMap(QiraatFilter.init(storageValue:)) ?? .all
        hidesUsul = defaults.bool(forKey: Self.hidesUsulKey)
    }

    var display: QiraatDisplay { QiraatDisplay(enabled: enabled, filter: filter, hidesUsul: hidesUsul) }
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
