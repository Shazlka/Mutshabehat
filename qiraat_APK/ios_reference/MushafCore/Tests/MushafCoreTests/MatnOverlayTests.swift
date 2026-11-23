import Foundation
import Testing
@testable import MushafCore

private func temporaryDirectory() -> URL {
    let url = FileManager.default.temporaryDirectory.appendingPathComponent("matn-overlay-\(UUID().uuidString)", isDirectory: true)
    try! FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
    return url
}

/// Synthetic verses: made-up words, not book text.
private func snapshot(seq: Int?) -> [String: Any] {
    func work(_ key: String, _ verses: [[String: Any]]) -> [String: Any] {
        ["work": key, "title": key, "author": "x", "bookId": NSNull(), "chapters": [["title": "باب", "farsh": false, "verses": verses]]]
    }
    var json: [String: Any] = [
        "document": ["mutoon": ["schemaVersion": 1, "works": [
            work("shatibiyyah", [["number": 1, "lines": ["أ ب", "ج د"], "printedPage": "1", "pageId": 5], ["number": 2, "lines": ["أو ب", "ز ح"], "printedPage": NSNull(), "pageId": NSNull()]]),
            work("durrah", []), work("tayyibah", []),
        ]]],
        "symbols": ["schemaVersion": 1, "annotations": [
            ["work": "shatibiyyah", "verse": 2, "line": 0, "start": 0, "end": 1, "text": "أ", "symbol": "أ", "kind": "reader", "readingIds": ["Q01"], "note": "", "source": "", "status": "verified", "method": "hand", "origin": "symbol"],
        ]],
    ]
    if let seq { json["seq"] = seq }
    return json
}

@Suite struct MatnOverlayTests {
    @Test func aSnapshotBecomesTheLiveCopyAndRemembersItsSequence() throws {
        let dir = temporaryDirectory()
        #expect(MatnOverlay.seq(in: dir) == nil)
        #expect(try MatnOverlay.writeSnapshot(snapshot(seq: 7), to: dir) == 7)
        #expect(MatnOverlay.seq(in: dir) == 7)
        let library = MatnLibrary(directory: dir)
        #expect(library.work(.shatibiyyah)?.verseCount == 2)
    }

    @Test func aSnapshotWithoutASequenceNeverPatches() throws {
        let dir = temporaryDirectory()
        _ = try MatnOverlay.writeSnapshot(snapshot(seq: nil), to: dir)
        #expect(MatnOverlay.seq(in: dir) == nil)
        #expect(try MatnOverlay.applyDelta(["seq": 3, "full": false, "verses": [[String: Any]]()], to: dir) == .needsSnapshot)
    }

    @Test func aDeltaSwapsOnlyTheChangedVerseAndItsMarks() throws {
        let dir = temporaryDirectory()
        _ = try MatnOverlay.writeSnapshot(snapshot(seq: 7), to: dir)
        let delta: [String: Any] = ["seq": 9, "full": false, "verses": [[
            "work": "shatibiyyah",
            "verse": ["number": 1, "lines": ["أ ب", "ج د"], "printedPage": "1", "pageId": 5],
            "annotations": [["work": "shatibiyyah", "verse": 1, "line": 0, "start": 0, "end": 1, "text": "أ", "symbol": "أ", "kind": "group",
                             "readingIds": ["Q01", "Q02"], "note": "", "source": "", "status": "verified", "method": "hand", "origin": "assignment"]],
        ]]]
        #expect(try MatnOverlay.applyDelta(delta, to: dir) == .applied(changed: 1, seq: 9))
        #expect(MatnOverlay.seq(in: dir) == 9)

        let library = MatnLibrary(directory: dir)
        let marks1 = library.symbols.marks(.shatibiyyah, verse: 1)
        #expect(marks1.count == 1)
        #expect(marks1.first?.isAssignment == true)
        #expect(marks1.first?.readingIds == ["Q01", "Q02"])
        // verse 2 keeps the mark it had
        #expect(library.symbols.marks(.shatibiyyah, verse: 2).count == 1)
    }

    @Test func aDeltaThatClearsAVerseRemovesItsMarks() throws {
        let dir = temporaryDirectory()
        _ = try MatnOverlay.writeSnapshot(snapshot(seq: 7), to: dir)
        let delta: [String: Any] = ["seq": 8, "full": false, "verses": [[
            "work": "shatibiyyah", "verse": ["number": 2, "lines": ["أو ب", "ز ح"], "printedPage": NSNull(), "pageId": NSNull()], "annotations": [[String: Any]](),
        ]]]
        #expect(try MatnOverlay.applyDelta(delta, to: dir) == .applied(changed: 1, seq: 8))
        #expect(MatnLibrary(directory: dir).symbols.marks(.shatibiyyah, verse: 2).isEmpty)
    }

    @Test func noChangesOnlyAdvancesTheSequence() throws {
        let dir = temporaryDirectory()
        _ = try MatnOverlay.writeSnapshot(snapshot(seq: 7), to: dir)
        #expect(try MatnOverlay.applyDelta(["seq": 7, "full": false, "verses": [[String: Any]]()], to: dir) == .unchanged(seq: 7))
    }

    @Test func aFullFlagOrAnUnknownVerseAsksForASnapshot() throws {
        let dir = temporaryDirectory()
        _ = try MatnOverlay.writeSnapshot(snapshot(seq: 7), to: dir)
        #expect(try MatnOverlay.applyDelta(["seq": 9, "full": true, "verses": [[String: Any]]()], to: dir) == .needsSnapshot)
        let unknown: [String: Any] = ["seq": 9, "full": false, "verses": [[
            "work": "shatibiyyah", "verse": ["number": 99, "lines": ["أ", "ب"], "printedPage": NSNull(), "pageId": NSNull()], "annotations": [[String: Any]](),
        ]]]
        #expect(try MatnOverlay.applyDelta(unknown, to: dir) == .needsSnapshot)
        #expect(MatnOverlay.seq(in: dir) == 7, "a refused delta leaves the copy as it was")
    }

    private func oneVerseDelta() -> [String: Any] {
        ["seq": 9, "full": false, "verses": [[
            "work": "shatibiyyah",
            "verse": ["number": 1, "lines": ["أ ب", "ج د"], "printedPage": "1", "pageId": 5],
            "annotations": [[String: Any]](),
        ]]]
    }

    /// A symbols file that cannot be read used to count as "no marks". The next small edit then wrote it back holding
    /// only the edited verse's marks, and every other verse lost its reader assignments for good.
    @Test func anUnreadableSymbolsFileAsksForASnapshotAndIsNotOverwritten() throws {
        let dir = temporaryDirectory()
        _ = try MatnOverlay.writeSnapshot(snapshot(seq: 7), to: dir)
        let symbolsURL = dir.appendingPathComponent(MatnSymbolLayer.fileName)
        try Data("not json".utf8).write(to: symbolsURL)

        #expect(try MatnOverlay.applyDelta(oneVerseDelta(), to: dir) == .needsSnapshot)
        #expect(try Data(contentsOf: symbolsURL) == Data("not json".utf8))
        #expect(MatnOverlay.seq(in: dir) == 7)
    }

    /// A corrupt متون file made the delta throw. The caller treats a throw as "try again later", so it retried the same
    /// failing delta every few seconds and never fell back to a fresh snapshot.
    @Test func anUnreadableMutoonFileAsksForASnapshotInsteadOfThrowing() throws {
        let dir = temporaryDirectory()
        _ = try MatnOverlay.writeSnapshot(snapshot(seq: 7), to: dir)
        try Data("not json".utf8).write(to: dir.appendingPathComponent(MatnLibrary.fileName))

        #expect(try MatnOverlay.applyDelta(oneVerseDelta(), to: dir) == .needsSnapshot)
    }

    /// A live copy that loads as no works at all (damaged files, a schema this build does not know) used to replace the
    /// working bundled library with an empty screen, and its sequence stayed, so later syncs only fetched deltas.
    @Test func aLiveCopyThatLoadsAsNothingIsRefusedAndItsSequenceForgotten() throws {
        let dir = temporaryDirectory()
        _ = try MatnOverlay.writeSnapshot(snapshot(seq: 7), to: dir)
        #expect(MatnOverlay.loadUsable(directory: dir, sharhDirectory: nil) != nil)
        #expect(MatnOverlay.seq(in: dir) == 7)

        try Data("not json".utf8).write(to: dir.appendingPathComponent(MatnLibrary.fileName))

        #expect(MatnOverlay.loadUsable(directory: dir, sharhDirectory: nil) == nil)
        #expect(MatnOverlay.seq(in: dir) == nil, "the next sync must take a fresh snapshot, not another delta")
    }

    @Test func anAssignmentIsShownWithoutADictionarySymbolButOnlyWhereItsTextIs() {
        let lines = ["أ ب", "ج د"]
        func mark(_ start: Int, _ end: Int, _ text: String, ids: [String] = ["Q01"], origin: MatnSymbolOrigin = .assignment) -> MatnSymbolAnnotation {
            MatnSymbolAnnotation(work: .shatibiyyah, verse: 1, line: 0, start: start, end: end, text: text, symbol: text, kind: .reader,
                                 readingIds: ids, note: "", source: "", status: .verified, origin: origin)
        }
        #expect(mark(0, 1, "أ").problem(in: lines) == nil)
        #expect(mark(0, 1, "ب").problem(in: lines) != nil, "the text must be where the mark says")
        #expect(mark(0, 1, "أ", ids: []).problem(in: lines) != nil)
        #expect(mark(0, 1, "أ").namesAr() == "الإمام نافع")
        #expect(mark(0, 1, "أ", ids: ["Q01", "Q02"]).assignmentColorHex == MatnSymbols.sharedColorHex)
    }
}
