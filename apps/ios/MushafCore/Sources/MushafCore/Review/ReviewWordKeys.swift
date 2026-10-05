#if DEBUG
import Foundation

/// Joins the web review page's words (`SSS:AAA:WWW`) to the app's Mushaf words. Only real words carry a
/// key; ayah-end markers, pause marks and decorations do not.
public enum ReviewWordKeys {
    public static func key(surah: Int, ayah: Int, word: Int) -> String {
        String(format: "%03d:%03d:%03d", surah, ayah, word)
    }

    public static func key(for word: MushafWord) -> String? {
        guard word.charType == .word else { return nil }
        return key(surah: word.ayahKey.surah, ayah: word.ayahKey.ayah, word: word.indexInAyah)
    }

    public static func index(page: MushafPage) -> [String: MushafWord] {
        var result: [String: MushafWord] = [:]
        for word in page.lines.flatMap(\.words) { if let key = key(for: word) { result[key] = word } }
        return result
    }
}
#endif
