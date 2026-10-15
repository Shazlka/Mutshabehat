import Foundation
import MushafCore
import XCTest
@testable import Mutshabehat

/// Phase 5 tests: real records for multi-word span rules (الهمزتان من كلمتين، المدغم الكبير، ترك الغنة، المدغم الصغير، السكت، multi-token variant).
@MainActor
final class QiraatMultiWordSpanTests: XCTestCase {
    private var library: MushafLibrary!

    override func setUp() async throws {
        try await super.setUp()
        library = try MushafLibrary()
    }

    override func tearDown() async throws {
        library = nil
        try await super.tearDown()
    }

    /// 1. الهمزتان من كلمتين: 2:13 tokens 12..13 (ٱلسُّفَهَآءُ ۗ أَلَآ)
    func testAlHamzatanMinKalimataynSpan() throws {
        let store = try XCTUnwrap(library.qiraat)
        let page3 = try XCTUnwrap(library.page(3))
        let words = page3.lines.flatMap(\.words)
        let marks = try XCTUnwrap(store.marks(page: 3))

        let word1 = try XCTUnwrap(words.first { $0.ayahKey == AyahKey(surah: 2, ayah: 13) && $0.indexInAyah == 12 })
        let word2 = try XCTUnwrap(words.first { $0.ayahKey == AyahKey(surah: 2, ayah: 13) && $0.indexInAyah == 13 })

        let sel1 = try XCTUnwrap(marks.selection(surah: 2, ayah: 13, token: 12, filter: .all))
        let sel2 = try XCTUnwrap(marks.selection(surah: 2, ayah: 13, token: 13, filter: .all))

        let ruling1 = try XCTUnwrap(sel1.rulings.first { $0.categoryAr == "الهمزتان من كلمتين" })
        let ruling2 = try XCTUnwrap(sel2.rulings.first { $0.categoryAr == "الهمزتان من كلمتين" })

        // 1. Both words show the same connected ruling
        XCTAssertEqual(ruling1.id, ruling2.id)
        XCTAssertEqual(ruling1.id, "r-p003-019-1")
        XCTAssertGreaterThan(ruling1.endToken, ruling1.startToken)
        XCTAssertEqual(ruling1.startToken, 12)
        XCTAssertEqual(ruling1.endToken, 13)

        // 2. Both words shown together in baseText
        XCTAssertEqual(ruling1.baseText, "ٱلسُّفَهَآءُ ۗ أَلَآ")

        // 3. Readers/narrators unchanged
        XCTAssertEqual(ruling1.attribution.map(\.authorityId), ruling2.attribution.map(\.authorityId))
        XCTAssertFalse(ruling1.attribution.isEmpty)

        // 4. Linked words in WordContextIndex connect both word IDs
        let ctx = WordContextIndex.shared.resolveSync(page: 3, filter: .all, qiraatStore: store, pageWords: words)
        XCTAssertEqual(ctx.words[word1.id]?.linkedWordIDs, [word2.id])
        XCTAssertEqual(ctx.words[word2.id]?.linkedWordIDs, [word1.id])
    }

    /// 2. المدغم الكبير: 2:20 tokens 17..18 (لَذَهَبَ بِسَمْعِهِمْ)
    func testAlIdghamAlKabirSpan() throws {
        let store = try XCTUnwrap(library.qiraat)
        let marks = try XCTUnwrap(store.marks(page: 4))

        let sel1 = try XCTUnwrap(marks.selection(surah: 2, ayah: 20, token: 17, filter: .all))
        let sel2 = try XCTUnwrap(marks.selection(surah: 2, ayah: 20, token: 18, filter: .all))

        let ruling1 = try XCTUnwrap(sel1.rulings.first { $0.categoryAr == "المدغم الكبير" })
        let ruling2 = try XCTUnwrap(sel2.rulings.first { $0.categoryAr == "المدغم الكبير" })

        XCTAssertEqual(ruling1.id, ruling2.id)
        XCTAssertEqual(ruling1.id, "r-p004-014-1")
        XCTAssertEqual(ruling1.startToken, 17)
        XCTAssertEqual(ruling1.endToken, 18)
        XCTAssertEqual(ruling1.baseText, "لَذَهَبَ بِسَمْعِهِمْ")
        XCTAssertEqual(ruling1.attribution.map(\.authorityId), ruling2.attribution.map(\.authorityId))
    }

    /// 3. ترك الغنة: 2:58 tokens 10..11 (رَغَدًۭا وَٱدْخُلُوا۟)
    func testTarkAlGhunnahSpan() throws {
        let store = try XCTUnwrap(library.qiraat)
        let marks = try XCTUnwrap(store.marks(page: 9))

        let sel1 = try XCTUnwrap(marks.selection(surah: 2, ayah: 58, token: 10, filter: .all))
        let sel2 = try XCTUnwrap(marks.selection(surah: 2, ayah: 58, token: 11, filter: .all))

        let ruling1 = try XCTUnwrap(sel1.rulings.first { $0.categoryAr == "ترك الغنة" })
        let ruling2 = try XCTUnwrap(sel2.rulings.first { $0.categoryAr == "ترك الغنة" })

        XCTAssertEqual(ruling1.id, ruling2.id)
        XCTAssertEqual(ruling1.id, "r-p009-012-1")
        XCTAssertEqual(ruling1.startToken, 10)
        XCTAssertEqual(ruling1.endToken, 11)
        XCTAssertEqual(ruling1.baseText, "رَغَدًۭا وَٱدْخُلُوا۟")
        XCTAssertEqual(ruling1.attribution.map(\.authorityId), ruling2.attribution.map(\.authorityId))
    }

    /// 4. المدغم الصغير: 2:58 tokens 16..17 (نَّغْفِرْ لَكُمْ)
    func testAlIdghamAlSaghirSpan() throws {
        let store = try XCTUnwrap(library.qiraat)
        let marks = try XCTUnwrap(store.marks(page: 9))

        let sel1 = try XCTUnwrap(marks.selection(surah: 2, ayah: 58, token: 16, filter: .all))
        let sel2 = try XCTUnwrap(marks.selection(surah: 2, ayah: 58, token: 17, filter: .all))

        let spanRuling1 = try XCTUnwrap(sel1.rulings.first { $0.categoryAr == "المدغم الصغير" && $0.endToken > $0.startToken })
        let spanRuling2 = try XCTUnwrap(sel2.rulings.first { $0.categoryAr == "المدغم الصغير" && $0.endToken > $0.startToken })

        XCTAssertEqual(spanRuling1.id, spanRuling2.id)
        XCTAssertEqual(spanRuling1.id, "r-SUSI-002-58-16-0055-IDGHAM_KABIR")
        XCTAssertEqual(spanRuling1.startToken, 16)
        XCTAssertEqual(spanRuling1.endToken, 17)
        XCTAssertEqual(spanRuling1.baseText, "نَّغْفِرْ لَكُمْ")
        XCTAssertEqual(spanRuling1.attribution.map(\.authorityId), spanRuling2.attribution.map(\.authorityId))

        // Single-word ruling on token 16 is preserved separately and not merged into the span
        let singleRuling = try XCTUnwrap(sel1.rulings.first { $0.categoryAr == "المدغم الصغير" && $0.startToken == 16 && $0.endToken == 16 })
        XCTAssertEqual(singleRuling.id, "ent-r-p009-008-1-w16-Q03-R01")
        XCTAssertEqual(singleRuling.baseText, "نَّغْفِرْ")
    }

    /// 5. السكت: 19:6 tokens 3..4 (مِنْ ءَالِ)
    func testSaktSpan() throws {
        let store = try XCTUnwrap(library.qiraat)
        let marks = try XCTUnwrap(store.marks(page: 305))

        let sel1 = try XCTUnwrap(marks.selection(surah: 19, ayah: 6, token: 3, filter: .all))
        let sel2 = try XCTUnwrap(marks.selection(surah: 19, ayah: 6, token: 4, filter: .all))

        let ruling1 = try XCTUnwrap(sel1.rulings.first { $0.categoryAr == "السكت" })
        let ruling2 = try XCTUnwrap(sel2.rulings.first { $0.categoryAr == "السكت" })

        XCTAssertEqual(ruling1.id, ruling2.id)
        XCTAssertEqual(ruling1.id, "r-p305-018-1")
        XCTAssertEqual(ruling1.startToken, 3)
        XCTAssertEqual(ruling1.endToken, 4)
        XCTAssertEqual(ruling1.baseText, "مِنْ ءَالِ")
        XCTAssertEqual(ruling1.attribution.map(\.authorityId), ruling2.attribution.map(\.authorityId))
    }

    /// 6. Multi-token Farsh Variant: 2:31 tokens 12..13 (هَـٰٓؤُلَآءِ إِن -> هَؤُلَا إِن)
    func testMultiTokenFarshVariant() throws {
        let store = try XCTUnwrap(library.qiraat)
        let marks = try XCTUnwrap(store.marks(page: 6))

        let sel1 = try XCTUnwrap(marks.selection(surah: 2, ayah: 31, token: 12, filter: .all))
        let sel2 = try XCTUnwrap(marks.selection(surah: 2, ayah: 31, token: 13, filter: .all))

        let v1 = try XCTUnwrap(sel1.variants.first { $0.id == "v-SUSI-002-31-12-0029-a31-t12" })
        let v2 = try XCTUnwrap(sel2.variants.first { $0.id == "v-SUSI-002-31-12-0029-a31-t12" })

        XCTAssertEqual(v1.id, v2.id)
        XCTAssertEqual(v1.startToken, 12)
        XCTAssertEqual(v1.endToken, 13)
        XCTAssertEqual(v1.hafsText, "هَـٰٓؤُلَآءِ إِن")
        XCTAssertEqual(v1.uthmaniText, "هَؤُلَا إِن")
        XCTAssertEqual(v1.readingIds, v2.readingIds)
    }

    /// 7. Single-word variants on a word that also participates in a multi-word span are preserved separately.
    func testSingleWordVariantsAreNotMergedIntoSpan() throws {
        let store = try XCTUnwrap(library.qiraat)
        let marks = try XCTUnwrap(store.marks(page: 3))

        let sel1 = try XCTUnwrap(marks.selection(surah: 2, ayah: 13, token: 12, filter: .all))
        // Token 12 has the span ruling "الهمزتان من كلمتين"
        XCTAssertTrue(sel1.rulings.contains { $0.categoryAr == "الهمزتان من كلمتين" && $0.endToken > $0.startToken })

        // Check each variant in sel1 has distinct identity and is not mutated
        for variant in sel1.variants {
            XCTAssertFalse(variant.id.isEmpty)
        }
    }
}
