import Foundation
import Testing
@testable import MushafCore

@Suite struct MatnSharhTests {
    @Test func decodesCommentariesAndMatchesVerses() throws {
        let json = """
        {
          "schemaVersion": 1,
          "commentaries": {
            "shatibiyyah": {
              "title": "الوافي في شرح الشاطبية",
              "author": "عبد الفتاح القاضي",
              "verses": {
                "1": {
                  "text": "بدأت ببسم الله: الاستعانة بالله تعالى.",
                  "pages": ["9", "10"]
                }
              }
            }
          }
        }
        """
        let data = try #require(json.data(using: .utf8))
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: folder) }
        try data.write(to: folder.appendingPathComponent(MatnSharhStore.fileName))

        let store = MatnSharhStore(directory: folder)
        #expect(!store.isEmpty)

        let result = store.sharh(for: .shatibiyyah, verse: 1)
        #expect(result != nil)
        #expect(result?.title == "الوافي في شرح الشاطبية")
        #expect(result?.author == "عبد الفتاح القاضي")
        #expect(result?.entry.pages == ["9", "10"])
        #expect(result?.entry.text.contains("الاستعانة بالله") == true)

        #expect(store.sharh(for: .shatibiyyah, verse: 2) == nil)
        #expect(store.sharh(for: .tayyibah, verse: 1) == nil)
    }

    @Test func wrongSchemaVersionOrMissingYieldsEmpty() {
        let missing = MatnSharhStore(directory: URL(fileURLWithPath: "/nonexistent"))
        #expect(missing.isEmpty)

        let json = """
        {
          "schemaVersion": 999,
          "commentaries": {}
        }
        """
        let data = json.data(using: .utf8)!
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: folder) }
        try? data.write(to: folder.appendingPathComponent(MatnSharhStore.fileName))

        let wrongSchema = MatnSharhStore(directory: folder)
        #expect(wrongSchema.isEmpty)
    }

    @Test func matnLibraryLoadsSharhBesideMutoon() throws {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: folder) }

        let mutoonJSON = """
        {
          "schemaVersion": 1,
          "works": [
            {
              "work": "shatibiyyah",
              "title": "الشاطبية",
              "author": "الشاطبي",
              "chapters": [
                {
                  "title": "المقدمة",
                  "farsh": false,
                  "verses": [{"number": 1, "lines": ["شطر أول", "شطر ثان"]}]
                }
              ]
            }
          ]
        }
        """
        try mutoonJSON.data(using: .utf8)!.write(to: folder.appendingPathComponent(MatnLibrary.fileName))

        let sharhJSON = """
        {
          "schemaVersion": 1,
          "commentaries": {
            "shatibiyyah": {
              "title": "الوافي",
              "author": "القاضي",
              "verses": {
                "1": {"text": "شرح البيت", "pages": ["1"]}
              }
            }
          }
        }
        """
        try sharhJSON.data(using: .utf8)!.write(to: folder.appendingPathComponent(MatnSharhStore.fileName))

        let lib = MatnLibrary(directory: folder)
        #expect(!lib.isEmpty)
        #expect(!lib.sharh.isEmpty)
        #expect(lib.sharh.sharh(for: .shatibiyyah, verse: 1)?.entry.text == "شرح البيت")
    }
}
