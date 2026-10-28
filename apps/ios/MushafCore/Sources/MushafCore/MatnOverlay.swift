import Foundation

/// The live copy of the متون the app keeps beside its bundled one: the files `MatnLibrary` reads (`mutoon.json`,
/// `mutoon-symbols.json`) plus the sequence number of the web database's change log they are current to. A fresh install
/// takes one snapshot; after that the app asks "what changed since N" and swaps only the verses that did, so an edit made
/// in the web editor reaches the phone in seconds and as a few kilobytes.
public enum MatnOverlay {
    public static let seqFileName = "mutoon-seq.json"

    public enum DeltaResult: Equatable, Sendable {
        /// `changed` verses were replaced; the files are current to `seq`.
        case applied(changed: Int, seq: Int)
        /// Nothing changed since the stored sequence.
        case unchanged(seq: Int)
        /// The files cannot be patched (none yet, too many changes, or a verse they do not have): take a snapshot.
        case needsSnapshot
    }

    /// The sequence the files in `directory` are current to, or nil when there is no usable live copy.
    public static func seq(in directory: URL) -> Int? {
        guard let data = try? Data(contentsOf: directory.appendingPathComponent(seqFileName)),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let seq = object["seq"] as? Int else { return nil }
        let fm = FileManager.default
        guard fm.fileExists(atPath: directory.appendingPathComponent(MatnLibrary.fileName).path) else { return nil }
        return seq
    }

    /// Writes a whole snapshot (`{seq, document: {mutoon}, symbols}`) as the live copy. Returns its sequence, or nil when
    /// the server did not send one (an older server: the copy then never patches and is re-taken each time).
    @discardableResult
    public static func writeSnapshot(_ json: [String: Any], to directory: URL) throws -> Int? {
        guard let document = json["document"] as? [String: Any], let mutoon = document["mutoon"] else {
            throw CocoaError(.fileReadCorruptFile)
        }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let seq = json["seq"] as? Int
        // The old sequence goes first: a crash between the files and the number must not leave a stale number on new files.
        try? FileManager.default.removeItem(at: directory.appendingPathComponent(seqFileName))
        try JSONSerialization.data(withJSONObject: mutoon).write(to: directory.appendingPathComponent(MatnLibrary.fileName), options: .atomic)
        if let symbols = json["symbols"] ?? document["symbols"] {
            try JSONSerialization.data(withJSONObject: symbols).write(to: directory.appendingPathComponent(MatnSymbolLayer.fileName), options: .atomic)
        }
        if let seq { try writeSeq(seq, to: directory) }
        return seq
    }

    /// Applies `{seq, full, verses: [{work, verse: {number, lines, printedPage, pageId}, annotations}]}`.
    public static func applyDelta(_ json: [String: Any], to directory: URL) throws -> DeltaResult {
        guard seq(in: directory) != nil, let newSeq = json["seq"] as? Int, let verses = json["verses"] as? [[String: Any]] else { return .needsSnapshot }
        if (json["full"] as? Bool) == true { return .needsSnapshot }
        if verses.isEmpty {
            try writeSeq(newSeq, to: directory)
            return .unchanged(seq: newSeq)
        }

        let mutoonURL = directory.appendingPathComponent(MatnLibrary.fileName)
        let symbolsURL = directory.appendingPathComponent(MatnSymbolLayer.fileName)
        guard var mutoon = try JSONSerialization.jsonObject(with: Data(contentsOf: mutoonURL)) as? [String: Any],
              var works = mutoon["works"] as? [[String: Any]] else { return .needsSnapshot }
        var symbols: [String: Any] = (try? Data(contentsOf: symbolsURL))
            .flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] } ?? ["schemaVersion": 1, "annotations": [Any]()]
        var annotations = symbols["annotations"] as? [[String: Any]] ?? []

        var changedKeys = Set<String>()
        for entry in verses {
            guard let workKey = entry["work"] as? String, let verse = entry["verse"] as? [String: Any],
                  let number = verse["number"] as? Int else { return .needsSnapshot }
            var found = false
            for w in works.indices where works[w]["work"] as? String == workKey {
                var chapters = works[w]["chapters"] as? [[String: Any]] ?? []
                for c in chapters.indices {
                    var list = chapters[c]["verses"] as? [[String: Any]] ?? []
                    guard let v = list.firstIndex(where: { $0["number"] as? Int == number }) else { continue }
                    list[v]["lines"] = verse["lines"]
                    list[v]["printedPage"] = verse["printedPage"] ?? NSNull()
                    list[v]["pageId"] = verse["pageId"] ?? NSNull()
                    chapters[c]["verses"] = list
                    found = true
                    break
                }
                works[w]["chapters"] = chapters
            }
            // A verse the app's copy does not have (a renumbered one): only a snapshot can place it.
            if !found { return .needsSnapshot }
            changedKeys.insert("\(workKey):\(number)")
        }
        mutoon["works"] = works

        annotations.removeAll { changedKeys.contains("\($0["work"] as? String ?? ""):\($0["verse"] as? Int ?? -1)") }
        for entry in verses { annotations.append(contentsOf: entry["annotations"] as? [[String: Any]] ?? []) }
        symbols["annotations"] = annotations

        try? FileManager.default.removeItem(at: directory.appendingPathComponent(seqFileName))
        try JSONSerialization.data(withJSONObject: mutoon).write(to: mutoonURL, options: .atomic)
        try JSONSerialization.data(withJSONObject: symbols).write(to: symbolsURL, options: .atomic)
        try writeSeq(newSeq, to: directory)
        return .applied(changed: changedKeys.count, seq: newSeq)
    }

    private static func writeSeq(_ seq: Int, to directory: URL) throws {
        try JSONSerialization.data(withJSONObject: ["seq": seq]).write(to: directory.appendingPathComponent(seqFileName), options: .atomic)
    }
}
