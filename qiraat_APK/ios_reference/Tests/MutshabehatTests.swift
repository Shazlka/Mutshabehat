import SQLite3
import XCTest
@testable import Mutshabehat

final class MutshabehatTests: XCTestCase {

    // MARK: - Arabic Diff Algorithm Tests

    func testStripTashkeel() {
        let input = "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ"
        let stripped = ArabicDiffAlgorithm.stripTashkeel(input)
        XCTAssertFalse(stripped.contains("ِ"))
        XCTAssertFalse(stripped.contains("َّ"))
        XCTAssertFalse(stripped.contains("ْ"))
    }

    func testNormalizeArabic() {
        let input = "إِنَّمَا ٱلْمُؤْمِنُونَ إِخْوَةٌ"
        let normalized = ArabicDiffAlgorithm.normalizeArabic(input)
        XCTAssertTrue(normalized.contains("انما"))
        XCTAssertTrue(normalized.contains("اخوه"))
        XCTAssertFalse(normalized.contains("إ"))
        XCTAssertFalse(normalized.contains("ة"))
    }

    func testLevenshteinDistance() {
        XCTAssertEqual(ArabicDiffAlgorithm.levenshtein("كتب", "كتب"), 0)
        XCTAssertEqual(ArabicDiffAlgorithm.levenshtein("قال", "قالوا"), 2)
        XCTAssertEqual(ArabicDiffAlgorithm.levenshtein("موسى", "عيسى"), 2)
    }

    func testDiffTokensIdentical() {
        let textA = "الحمد لله رب العالمين"
        let textB = "الحمد لله رب العالمين"
        let tokens = ArabicDiffAlgorithm.computeWordDiff(textA: textA, textB: textB)
        XCTAssertEqual(tokens.count, 4)
        for token in tokens {
            XCTAssertEqual(token.status, .same)
        }
    }

    func testDiffTokensDiffering() {
        let textA = "قالوا يا موسى"
        let textB = "قال يا موسى"
        let tokens = ArabicDiffAlgorithm.computeWordDiff(textA: textA, textB: textB)
        XCTAssertEqual(tokens.count, 3)
        XCTAssertEqual(tokens[0].word, "قال")
        XCTAssertEqual(tokens[0].status, .changed(oldWord: "قالوا"))
        XCTAssertEqual(tokens[1].status, .same)
        XCTAssertEqual(tokens[2].status, .same)
    }

    func testAutoColorPair() {
        let textA = "وقالوا يا موسى"
        let textB = "قالوا يا موسى"
        let (partsA, partsB) = ArabicDiffAlgorithm.autoColorPair(textA: textA, textB: textB)

        XCTAssertFalse(partsA.isEmpty)
        XCTAssertFalse(partsB.isEmpty)
        let typesA = partsA.map(\.type)
        let typesB = partsB.map(\.type)
        XCTAssertTrue(typesA.contains("diff") || typesA.contains("normal"))
        XCTAssertTrue(typesB.contains("diff") || typesB.contains("normal"))
    }

    // MARK: - Mutshabehat Database Tests

    func testSaveAndFetchPersonalGroup() {
        let tempURL = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("test_mutshabehat_\(UUID().uuidString).sqlite")
        defer { try? FileManager.default.removeItem(at: tempURL) }

        autoreleasepool {
            let db = MutshabehatDatabase(url: tempURL)

            let groupId = UUID().uuidString
            let verse1Id = UUID().uuidString
            let verse2Id = UUID().uuidString

            let part1 = PersonalPart(id: UUID().uuidString, type: "diff", text: "فأخذتهم الرجفة", sortOrder: 0)
            let part2 = PersonalPart(id: UUID().uuidString, type: "normal", text: "فأصبحوا في دارهم جاثمين", sortOrder: 1)
            let verse1 = PersonalVerse(id: verse1Id, groupId: groupId, surah: "الأعراف", ayah: 78, label: "الأعراف 78", sortOrder: 0, parts: [part1, part2])

            let part3 = PersonalPart(id: UUID().uuidString, type: "diff", text: "فأخذتهم الصيحة", sortOrder: 0)
            let part4 = PersonalPart(id: UUID().uuidString, type: "normal", text: "فأصبحوا في ديارهم جاثمين", sortOrder: 1)
            let verse2 = PersonalVerse(id: verse2Id, groupId: groupId, surah: "هود", ayah: 67, label: "هود 67", sortOrder: 1, parts: [part3, part4])

            let group = PersonalGroup(
                id: groupId,
                title: "الرجفة والصيحة في ثمود",
                color: "#EF4444",
                status: "published",
                favorite: true,
                completed: false,
                note: "الرجفة في الأعراف، الصيحة في هود",
                unote: "فائدة فريدة في سياق العذاب",
                verses: [verse1, verse2]
            )

            // Save
            db.savePersonalGroup(group)

            // Fetch
            let fetched = db.fetchPersonalGroup(id: groupId)
            XCTAssertNotNil(fetched)
            XCTAssertEqual(fetched?.id, groupId)
            XCTAssertEqual(fetched?.title, "الرجفة والصيحة في ثمود")
            XCTAssertEqual(fetched?.color, "#EF4444")
            XCTAssertEqual(fetched?.favorite, true)
            XCTAssertEqual(fetched?.completed, false)
            XCTAssertEqual(fetched?.note, "الرجفة في الأعراف، الصيحة في هود")
            XCTAssertEqual(fetched?.unote, "فائدة فريدة في سياق العذاب")
            XCTAssertEqual(fetched?.verses.count, 2)

            let fetchedV1 = fetched?.verses.first(where: { $0.surah == "الأعراف" })
            XCTAssertNotNil(fetchedV1)
            XCTAssertEqual(fetchedV1?.ayah, 78)
            XCTAssertEqual(fetchedV1?.parts.count, 2)
            XCTAssertEqual(fetchedV1?.parts[0].type, "diff")
            XCTAssertEqual(fetchedV1?.parts[0].text, "فأخذتهم الرجفة")
        }
    }

    func testUpdatePersonalGroup() {
        let tempURL = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("test_mutshabehat_\(UUID().uuidString).sqlite")
        defer { try? FileManager.default.removeItem(at: tempURL) }

        autoreleasepool {
            let db = MutshabehatDatabase(url: tempURL)

            let groupId = UUID().uuidString
            var group = PersonalGroup(
                id: groupId,
                title: "عنوان قديم",
                color: "#3B82F6",
                verses: [PersonalVerse(id: UUID().uuidString, groupId: groupId, surah: "البقرة", ayah: 10, parts: [])]
            )
            db.savePersonalGroup(group)

            // Modify and save
            group.title = "عنوان محدّث"
            group.color = "#10B981"
            group.completed = true
            db.savePersonalGroup(group)

            let fetched = db.fetchPersonalGroup(id: groupId)
            XCTAssertEqual(fetched?.title, "عنوان محدّث")
            XCTAssertEqual(fetched?.color, "#10B981")
            XCTAssertEqual(fetched?.completed, true)
        }
    }

    func testToggleFavoriteAndCompleted() {
        let tempURL = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("test_mutshabehat_\(UUID().uuidString).sqlite")
        defer { try? FileManager.default.removeItem(at: tempURL) }

        autoreleasepool {
            let db = MutshabehatDatabase(url: tempURL)

            let groupId = UUID().uuidString
            let group = PersonalGroup(id: groupId, title: "اختبار المفضلة", favorite: false, completed: false, verses: [])
            db.savePersonalGroup(group)

            db.toggleFavorite(groupId: groupId)
            var fetched = db.fetchPersonalGroup(id: groupId)
            XCTAssertEqual(fetched?.favorite, true)

            var updated = fetched!
            updated.completed = true
            db.savePersonalGroup(updated)

            fetched = db.fetchPersonalGroup(id: groupId)
            XCTAssertEqual(fetched?.completed, true)
        }
    }

    func testDeletePersonalGroup() {
        let tempURL = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("test_mutshabehat_\(UUID().uuidString).sqlite")
        defer { try? FileManager.default.removeItem(at: tempURL) }

        autoreleasepool {
            let db = MutshabehatDatabase(url: tempURL)

            let groupId = UUID().uuidString
            let verseId = UUID().uuidString
            let group = PersonalGroup(
                id: groupId,
                title: "للحذف",
                verses: [PersonalVerse(id: verseId, groupId: groupId, surah: "يس", ayah: 1, parts: [
                    PersonalPart(id: UUID().uuidString, type: "normal", text: "يس", sortOrder: 0)
                ])]
            )
            db.savePersonalGroup(group)
            XCTAssertNotNil(db.fetchPersonalGroup(id: groupId))

            db.deletePersonalGroup(groupId: groupId)
            XCTAssertNil(db.fetchPersonalGroup(id: groupId))
        }
    }

    func testExportAndImportDatabase() throws {
        let tempURL = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("test_mutshabehat_\(UUID().uuidString).sqlite")
        let tempURL2 = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("test_mutshabehat_import_\(UUID().uuidString).sqlite")
        defer {
            try? FileManager.default.removeItem(at: tempURL)
            try? FileManager.default.removeItem(at: tempURL2)
        }

        let groupId = UUID().uuidString
        var exportData: Data = Data()

        try autoreleasepool {
            let db = MutshabehatDatabase(url: tempURL)
            let group = PersonalGroup(
                id: groupId,
                title: "تصدير تجريبي",
                color: "#6366F1",
                verses: [
                    PersonalVerse(id: UUID().uuidString, groupId: groupId, surah: "الكهف", ayah: 1, parts: [
                        PersonalPart(id: UUID().uuidString, type: "normal", text: "الحمد لله الذي أنزل على عبده الكتاب", sortOrder: 0)
                    ])
                ]
            )
            db.savePersonalGroup(group)
            exportData = try db.exportDatabase()
        }

        XCTAssertFalse(exportData.isEmpty)

        // Import into second database
        try autoreleasepool {
            let db2 = MutshabehatDatabase(url: tempURL2)
            try db2.importDatabase(exportData)
            let importedGroup = db2.fetchPersonalGroup(id: groupId)
            XCTAssertNotNil(importedGroup)
            XCTAssertEqual(importedGroup?.title, "تصدير تجريبي")
        }
    }

    // MARK: - Import / export safety

    private func temporaryDatabaseURL() -> URL {
        URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("test_mutshabehat_\(UUID().uuidString).sqlite")
    }

    private func removeDatabaseFiles(_ url: URL) {
        for suffix in ["", "-wal", "-shm"] { try? FileManager.default.removeItem(atPath: url.path + suffix) }
    }

    // MARK: - Checked, transactional writes

    func testFailedSaveRollsBackAndKeepsTheOldGroup() throws {
        let url = temporaryDatabaseURL()
        defer { removeDatabaseFiles(url) }
        let db = MutshabehatDatabase(url: url)
        let original = simpleGroup(title: "الأصل")
        try db.saveGroup(original)

        // Two parts share one id: the second insert violates the primary key halfway through the write.
        var broken = original
        broken.title = "معطوب"
        broken.verses = [PersonalVerse(id: UUID().uuidString, groupId: original.id, surah: "الكهف", ayah: 2, parts: [
            PersonalPart(id: "same", type: "normal", text: "أ", sortOrder: 0),
            PersonalPart(id: "same", type: "normal", text: "ب", sortOrder: 1)])]
        XCTAssertThrowsError(try db.saveGroup(broken)) { error in
            guard case DatabaseTransferError.writeFailed = error else { return XCTFail("wrong error: \(error)") }
        }
        XCTAssertFalse(db.savePersonalGroup(broken))

        let kept = try XCTUnwrap(db.fetchPersonalGroup(id: original.id))
        XCTAssertEqual(kept.title, "الأصل")
        XCTAssertEqual(kept.verses.map(\.ayah), [1])
        XCTAssertEqual(kept.verses.first?.parts.map(\.text), ["الأصل"])
    }

    func testFetchReturnsEveryGroupWithItsOwnVersesInOrder() throws {
        let url = temporaryDatabaseURL()
        defer { removeDatabaseFiles(url) }
        let db = MutshabehatDatabase(url: url)
        var groups: [PersonalGroup] = []
        for n in 1...3 {
            let id = UUID().uuidString
            let verses = (1...n).map { ayah in
                PersonalVerse(id: UUID().uuidString, groupId: id, surah: "سورة \(n)", ayah: ayah, parts: [
                    PersonalPart(id: UUID().uuidString, type: "diff", text: "\(n)-\(ayah)-a", sortOrder: 0),
                    PersonalPart(id: UUID().uuidString, type: "normal", text: "\(n)-\(ayah)-b", sortOrder: 1)])
            }
            let group = PersonalGroup(id: id, title: "مجموعة \(n)", color: "#6366F1", verses: verses)
            groups.append(group)
            XCTAssertTrue(db.savePersonalGroup(group))
        }
        let fetched = db.fetchPersonalGroups()
        XCTAssertEqual(fetched.count, 3)
        for group in groups {
            let got = try XCTUnwrap(fetched.first { $0.id == group.id })
            XCTAssertEqual(got.verses.map(\.ayah), group.verses.map(\.ayah))
            XCTAssertEqual(got.verses.flatMap { $0.parts.map(\.text) }, group.verses.flatMap { $0.parts.map(\.text) })
        }
        XCTAssertEqual(db.fetchPersonalGroups(surah: "سورة 2").map(\.title), ["مجموعة 2"])
    }

    func testSearchTreatsPercentAndUnderscoreAsLiteralText() {
        let url = temporaryDatabaseURL()
        defer { removeDatabaseFiles(url) }
        let db = MutshabehatDatabase(url: url)
        XCTAssertTrue(db.savePersonalGroup(simpleGroup(title: "100% نور")))
        XCTAssertTrue(db.savePersonalGroup(simpleGroup(title: "نور آخر")))
        XCTAssertEqual(db.fetchPersonalGroups(query: "%").map(\.title), ["100% نور"])
        XCTAssertEqual(db.fetchPersonalGroups(query: "_").count, 0)
        XCTAssertEqual(db.fetchPersonalGroups(query: "نور").count, 2)
    }

    private func simpleGroup(title: String) -> PersonalGroup {
        let groupId = UUID().uuidString
        let part = PersonalPart(id: UUID().uuidString, type: "normal", text: title, sortOrder: 0)
        let verse = PersonalVerse(id: UUID().uuidString, groupId: groupId, surah: "الكهف", ayah: 1, parts: [part])
        return PersonalGroup(id: groupId, title: title, color: "#6366F1", verses: [verse])
    }

    /// A real SQLite file with only the given tables.
    private func databaseData(tables: [String]) throws -> Data {
        let url = temporaryDatabaseURL()
        defer { removeDatabaseFiles(url) }
        var handle: OpaquePointer?
        XCTAssertEqual(sqlite3_open(url.path, &handle), SQLITE_OK)
        for table in tables { sqlite3_exec(handle, "CREATE TABLE \(table) (id TEXT PRIMARY KEY);", nil, nil, nil) }
        sqlite3_close(handle)
        return try Data(contentsOf: url)
    }

    func testImportCorruptFileKeepsExistingData() throws {
        let url = temporaryDatabaseURL()
        defer { removeDatabaseFiles(url) }
        let db = MutshabehatDatabase(url: url)
        let kept = simpleGroup(title: "باقية")
        db.savePersonalGroup(kept)

        XCTAssertThrowsError(try db.importDatabase(Data(repeating: 0x41, count: 4096))) { error in
            XCTAssertEqual(error as? DatabaseTransferError, .invalidDatabase)
        }

        XCTAssertEqual(db.fetchPersonalGroup(id: kept.id)?.title, "باقية")
        let later = simpleGroup(title: "بعد الفشل")
        db.savePersonalGroup(later)   // the connection is still open and writable
        XCTAssertEqual(db.fetchPersonalGroup(id: later.id)?.title, "بعد الفشل")
    }

    func testImportMissingTablesKeepsExistingData() throws {
        let url = temporaryDatabaseURL()
        defer { removeDatabaseFiles(url) }
        let db = MutshabehatDatabase(url: url)
        let kept = simpleGroup(title: "باقية")
        db.savePersonalGroup(kept)

        XCTAssertThrowsError(try db.importDatabase(try databaseData(tables: ["groups"]))) { error in
            XCTAssertEqual(error as? DatabaseTransferError, .invalidDatabase)
        }

        XCTAssertEqual(db.fetchPersonalGroup(id: kept.id)?.title, "باقية")
    }

    func testImportPostsNotificationOnlyOnSuccess() throws {
        let sourceURL = temporaryDatabaseURL()
        let targetURL = temporaryDatabaseURL()
        defer { removeDatabaseFiles(sourceURL); removeDatabaseFiles(targetURL) }
        let source = MutshabehatDatabase(url: sourceURL)
        source.savePersonalGroup(simpleGroup(title: "مصدر"))
        let exported = try source.exportDatabase()
        let target = MutshabehatDatabase(url: targetURL)

        var posts = 0
        let token = NotificationCenter.default.addObserver(
            forName: Notification.Name("mutshabehatDatabaseDidUpdate"), object: nil, queue: nil) { _ in posts += 1 }
        defer { NotificationCenter.default.removeObserver(token) }

        XCTAssertThrowsError(try target.importDatabase(Data(repeating: 0x41, count: 4096)))
        XCTAssertEqual(posts, 0)
        try target.importDatabase(exported)
        XCTAssertEqual(posts, 1)
    }

    /// The web sync builds its file with `PRAGMA journal_mode = WAL` (ICloudDatabaseSyncService.compileMutshabehatSqlite),
    /// so the bytes it imports carry the WAL format flags and travel without sidecars.
    func testImportsAWALModeDatabaseLikeTheWebSyncBuildsIt() throws {
        let walURL = temporaryDatabaseURL()
        let targetURL = temporaryDatabaseURL()
        defer { removeDatabaseFiles(walURL); removeDatabaseFiles(targetURL) }
        var handle: OpaquePointer?
        XCTAssertEqual(sqlite3_open(walURL.path, &handle), SQLITE_OK)
        sqlite3_exec(handle, """
            PRAGMA journal_mode = WAL;
            CREATE TABLE groups (id TEXT PRIMARY KEY);
            CREATE TABLE verses (id TEXT PRIMARY KEY);
            CREATE TABLE parts (id TEXT PRIMARY KEY);
            CREATE TABLE automated_groups (id TEXT PRIMARY KEY);
            """, nil, nil, nil)
        sqlite3_close(handle)
        let bytes = try Data(contentsOf: walURL)   // the main file only
        XCTAssertEqual(Array(bytes[18...19]), [2, 2], "the candidate must carry the WAL format flags")
        let target = MutshabehatDatabase(url: targetURL)
        target.savePersonalGroup(simpleGroup(title: "قبل الاستيراد"))

        XCTAssertNoThrow(try target.importDatabase(bytes))
    }

    /// A backup reading the database for a moment must delay an import, not fail it.
    func testImportWaitsForABriefReaderInsteadOfFailing() throws {
        let sourceURL = temporaryDatabaseURL()
        let targetURL = temporaryDatabaseURL()
        defer { removeDatabaseFiles(sourceURL); removeDatabaseFiles(targetURL) }
        let source = MutshabehatDatabase(url: sourceURL)
        source.savePersonalGroup(simpleGroup(title: "مصدر"))
        let exported = try source.exportDatabase()
        let target = MutshabehatDatabase(url: targetURL)
        target.savePersonalGroup(simpleGroup(title: "قبل"))

        var reader: OpaquePointer?
        XCTAssertEqual(sqlite3_open(targetURL.path, &reader), SQLITE_OK)
        sqlite3_exec(reader, "BEGIN;", nil, nil, nil)
        var select: OpaquePointer?
        sqlite3_prepare_v2(reader, "SELECT count(*) FROM groups", -1, &select, nil)
        XCTAssertEqual(sqlite3_step(select), SQLITE_ROW)
        sqlite3_finalize(select)
        target.savePersonalGroup(simpleGroup(title: "بعد القارئ"))   // new WAL frames beyond the reader's snapshot
        nonisolated(unsafe) let readerHandle = reader
        DispatchQueue.global().asyncAfter(deadline: .now() + 0.15) {
            sqlite3_exec(readerHandle, "COMMIT;", nil, nil, nil)
            sqlite3_close(readerHandle)
        }

        XCTAssertNoThrow(try target.importDatabase(exported))
    }

    /// Observers of `mutshabehatDatabaseDidUpdate` run synchronously on the importing thread and read the
    /// database, so the notification must not be posted while the database lock is held.
    func testImportNotificationCanBeObservedByCodeThatReadsTheDatabase() throws {
        let sourceURL = temporaryDatabaseURL()
        let targetURL = temporaryDatabaseURL()
        defer { removeDatabaseFiles(sourceURL); removeDatabaseFiles(targetURL) }
        let source = MutshabehatDatabase(url: sourceURL)
        source.savePersonalGroup(simpleGroup(title: "مصدر"))
        let exported = try source.exportDatabase()
        let target = MutshabehatDatabase(url: targetURL)

        let observed = expectation(description: "the observer read the database during the notification")
        let token = NotificationCenter.default.addObserver(
            forName: Notification.Name("mutshabehatDatabaseDidUpdate"), object: nil, queue: nil) { _ in
            _ = target.allSurahNames()   // takes the database lock: deadlocks if the import still holds it
            observed.fulfill()
        }
        defer { NotificationCenter.default.removeObserver(token) }

        DispatchQueue.global().async { try? target.importDatabase(exported) }
        wait(for: [observed], timeout: 5)
    }

    func testExportContainsLatestWriteWhileOpen() throws {
        let sourceURL = temporaryDatabaseURL()
        let targetURL = temporaryDatabaseURL()
        defer { removeDatabaseFiles(sourceURL); removeDatabaseFiles(targetURL) }
        let source = MutshabehatDatabase(url: sourceURL)
        let group = simpleGroup(title: "آخر كتابة")
        source.savePersonalGroup(group)

        let exported = try source.exportDatabase()   // no manual checkpoint; the source stays open

        let target = MutshabehatDatabase(url: targetURL)
        try target.importDatabase(exported)
        XCTAssertEqual(target.fetchPersonalGroup(id: group.id)?.title, "آخر كتابة")
    }

    func testExportFailureMapsToDatabaseUnavailable() {
        let url = temporaryDatabaseURL()
        let db = MutshabehatDatabase(url: url)
        removeDatabaseFiles(url)   // the file disappears while the connection is open

        XCTAssertThrowsError(try db.exportDatabase()) { error in
            XCTAssertEqual(error as? DatabaseTransferError, .databaseUnavailable)
        }
    }

    func testBundledSeedStillImports() throws {
        let seedURL = try XCTUnwrap(Bundle.main.url(forResource: "mutshabehat", withExtension: "sqlite"),
                                    "the build must bundle Generated/mutshabehat.sqlite")
        let targetURL = temporaryDatabaseURL()
        defer { removeDatabaseFiles(targetURL) }
        let target = MutshabehatDatabase(url: targetURL)

        XCTAssertNoThrow(try target.importDatabase(try Data(contentsOf: seedURL)))
    }
}
