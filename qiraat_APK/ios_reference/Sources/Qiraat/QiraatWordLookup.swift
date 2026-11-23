import SwiftUI

/// Looks up the text of a Quran word by (surah, ayah, word index); set around the word sheet so a ruling card can
/// show a rule that works across a word boundary (نقل حركة الهمزة) with the neighbouring word.
/// `@unchecked Sendable`: only ever called on the main thread by the views.
struct QiraatWordLookup: @unchecked Sendable {
    let text: (Int, Int, Int) -> String?
}

struct QiraatWordLookupKey: EnvironmentKey {
    static let defaultValue: QiraatWordLookup? = nil
}

extension EnvironmentValues {
    var qiraatWordText: QiraatWordLookup? {
        get { self[QiraatWordLookupKey.self] }
        set { self[QiraatWordLookupKey.self] = newValue }
    }
}
