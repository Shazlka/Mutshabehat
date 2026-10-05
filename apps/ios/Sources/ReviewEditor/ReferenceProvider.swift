#if DEBUG
import Foundation
import MushafCore

/// One external-reference entry for the selected word, ready to show: nquran difference or الشامل entry
/// with its reader groups.
struct ReferenceItem: Identifiable, Hashable, Sendable {
    let id: String
    let source: ReferenceSource
    let heading: String
    let page: Int?
    let isGeneralRule: Bool
    let sourceText: String?
    let flags: [String]
    let sourceURL: URL?
    let groups: [ReferenceGroup]
}

/// Finds the reference entries about one word (nquran and الشامل), off the main thread.
enum ReferenceProvider {
    static let bundled = ReferenceLibrary(
        directory: (Bundle.main.resourceURL ?? URL(fileURLWithPath: "/")).appendingPathComponent("ReviewReference"))

    /// `nil` means the source has no data for this surah (only الشامل can say that).
    static func items(source: ReferenceSource, library: ReferenceLibrary, word: ReviewWord,
                      ayahWords: [AyahWord]) async throws -> [ReferenceItem]? {
        try await Task.detached(priority: .userInitiated) {
            let context = NquranAyahContext(wordIndex: word.word, ayahWords: ayahWords)
            switch source {
            case .nquran:
                guard let entry = NquranMatching.entry(in: try library.nquran(surah: word.surah), ayah: word.ayah) else { return [] }
                return NquranMatching.matchingIndices(differences: entry.differences, wordText: word.text, context: context).map { index in
                    let difference = entry.differences[index]
                    return ReferenceItem(id: "nquran:\(word.ayah):\(index)", source: .nquran, heading: difference.location, page: nil,
                                         isGeneralRule: false, sourceText: nil, flags: [], sourceURL: URL(string: entry.sourceUrl),
                                         groups: NquranMatching.groups(for: difference))
                }
            case .shamil:
                guard let entries = try library.shamil(surah: word.surah) else { return nil }
                return ShamilMatching.matchingIndices(entries: entries, ayah: word.ayah, wordText: word.text, context: context).map { index in
                    let entry = entries[index]
                    return ReferenceItem(id: "shamil:\(entry.entryId)", source: .shamil, heading: entry.words.joined(separator: " / "),
                                         page: entry.page, isGeneralRule: entry.scope == .allQuran, sourceText: entry.sourceText,
                                         flags: entry.flags, sourceURL: entry.sourceUrl.flatMap(URL.init(string:)),
                                         groups: ShamilMatching.groups(for: entry))
                }
            }
        }.value
    }
}
#endif
