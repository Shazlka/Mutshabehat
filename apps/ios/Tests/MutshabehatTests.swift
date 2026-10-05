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
}
