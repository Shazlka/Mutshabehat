import Foundation
import Testing
@testable import MushafCore

@Suite struct QuranSearchNormalizerTests {
    @Test func removesTashkilQuranMarksTatweelAndControls() {
        #expect(QuranSearchNormalizer.plain("ٱلرَّحْمَـٰنِ\u{200F}") == "الرحمن")
    }

    @Test func createsDistinctNormalizationLevels() {
        let value = QuranSearchNormalizer.query("ٱلصَّلَوٰةَ")
        #expect(value.plain == "الصلوة")
        #expect(value.canonical == "الصلوه")
        #expect(value.imlai == "الصلاه")
    }

    @Test func normalizesHamzaSeatsWithoutTouchingOriginal() {
        let value = QuranSearchNormalizer.query("إِيمَان")
        #expect(value.original == "إِيمَان")
        #expect(value.canonical == "ايمان")
    }

    @Test func createsLowerConfidenceRasmKey() {
        #expect(QuranSearchNormalizer.query("الحياة").rasmKey == "لح")
    }
}

@Suite struct QuranSearchDatabaseTests {
    @Test(arguments: ["الصلاة", "الزكاة", "الحياة", "الرحمن", "ايمان", "الكتاب", "اولئك"])
    func requiredSmartWordCases(_ query: String) throws {
        let results = try openDatabase().searchAyaat(matching: query, mode: .smart, limit: 200)
        #expect(!results.isEmpty, "query: \(query)")
        #expect(results.allSatisfy { !$0.uthmaniWord.isEmpty && !$0.matchedWordIDs.isEmpty })
    }

    @Test func copiedUthmaniWordIsAnExactMatch() throws {
        let results = try openDatabase().searchAyaat(matching: "ٱلصَّلَوٰةَ", mode: .exact)
        #expect(results.contains { $0.matchType == .exact })
    }

    @Test func unvocalizedPhraseMatchesConsecutiveTokens() throws {
        let results = try openDatabase().searchAyaat(matching: "ان الله غفور رحيم", mode: .smart)
        #expect(!results.isEmpty)
        #expect(results.allSatisfy { $0.matchedWordIDs.count == 4 })
    }

    @Test func smartModeUsesControlledTypoFallback() throws {
        let results = try openDatabase().searchAyaat(matching: "الرحمنن", mode: .smart)
        #expect(results.contains { $0.matchType == .fuzzy })
    }

    @Test func exactModeDoesNotUseFuzzyOrRasmFallback() throws {
        #expect(try openDatabase().searchAyaat(matching: "الرحمنن", mode: .exact).isEmpty)
    }

    @Test func indexedNormalSearchCompletesWithinBudget() throws {
        let database = try openDatabase()
        _ = try database.searchAyaat(matching: "الله", mode: .smart)
        let clock = ContinuousClock()
        let duration = try clock.measure {
            _ = try database.searchAyaat(matching: "الصلاة", mode: .smart)
        }
        #expect(duration < .milliseconds(350), "search took \(duration)")
    }

    @Test func reusableCorpusMatchesRealQuranData() throws {
        struct SearchCase: Decodable { let query: String; let kind: String }
        let url = try #require(Bundle.module.url(forResource: "quran-search-cases", withExtension: "json",
                                                  subdirectory: "Fixtures"))
        let cases = try JSONDecoder().decode([SearchCase].self, from: Data(contentsOf: url))
        #expect(cases.count >= 50)
        let database = try openDatabase()
        for item in cases {
            let results = try database.searchAyaat(matching: item.query, mode: .smart, limit: 5)
            #expect(!results.isEmpty, "\(item.kind): \(item.query)")
        }
    }
}

@Suite struct AdvancedQuranSearchEngineTests {
    @Test func mostMentionsOfAllah() throws {
        let db = try openDatabase()
        let results = try db.searchAyaat(matching: "(ج_آ:7) و >الله")
        #expect(results.contains { $0.ayah.surah == 73 && $0.ayah.ayah == 20 })
    }

    @Test func mostWordsAyatAlDayn() throws {
        let db = try openDatabase()
        let results = try db.searchAyaat(matching: "ك_آ:[129 الى 200]")
        #expect(results.contains { $0.ayah.surah == 2 && $0.ayah.ayah == 282 })
    }

    @Test func longestVerseLetters() throws {
        let db = try openDatabase()
        let results = try db.searchAyaat(matching: "(ح_آ:[400 الى 900])")
        #expect(results.contains { $0.ayah.surah == 2 && $0.ayah.ayah == 282 })
    }

    @Test func longestWord() throws {
        let db = try openDatabase()
        let results = try db.searchAyaat(matching: "فأسقيناكموه")
        #expect(results.contains { $0.ayah.surah == 15 && $0.ayah.ayah == 22 })
    }

    @Test func surahsWithMoreThan200Verses() throws {
        let db = try openDatabase()
        let results = try db.searchAyaat(matching: "آ_س:[200 الى 286] و رقم_الآية:200")
        #expect(results.count == 4)
        #expect(results.contains { $0.ayah.surah == 2 && $0.ayah.ayah == 200 })
        #expect(results.contains { $0.ayah.surah == 3 && $0.ayah.ayah == 200 })
    }

    @Test func sajdahVerses() throws {
        let db = try openDatabase()
        let allSajdah = try db.searchAyaat(matching: "(سجدة:نعم)")
        #expect(allSajdah.count == 15)

        let wajibSajdah = try db.searchAyaat(matching: "(سجدة:نعم) و نوع_السجدة:واجبة")
        #expect(wajibSajdah.count == 4)
        #expect(wajibSajdah.contains { $0.ayah.surah == 32 && $0.ayah.ayah == 15 })
        #expect(wajibSajdah.contains { $0.ayah.surah == 41 && $0.ayah.ayah == 38 })
        #expect(wajibSajdah.contains { $0.ayah.surah == 53 && $0.ayah.ayah == 62 })
        #expect(wajibSajdah.contains { $0.ayah.surah == 96 && $0.ayah.ayah == 19 })
    }

    @Test func revelationOrderSorting() throws {
        let db = try openDatabase()
        let results = try db.searchAyaat(matching: "رقم_السورة:[1 الى 114] و رقم_الآية:1", limit: 114)
        #expect(results.count == 114)
        #expect(results.first?.ayah.surah == 96 && results.first?.ayah.ayah == 1) // Surah Al-Alaq was revealed first
    }

    @Test func medinanSurahs() throws {
        let db = try openDatabase()
        let results = try db.searchAyaat(matching: "نوع_السورة:مدنية و رقم_الآية:1", limit: 50)
        #expect(results.count == 28)
        #expect(results.contains { $0.ayah.surah == 2 && $0.ayah.ayah == 1 })
    }

    @Test func repentanceAndForgiveness() throws {
        let db = try openDatabase()
        let results = try db.searchAyaat(matching: "(><توب) و (><غفر)")
        #expect(!results.isEmpty)
    }

    @Test func prophetMusa() throws {
        let db = try openDatabase()
        let results = try db.searchAyaat(matching: ">>موسى")
        #expect(!results.isEmpty)
    }

    @Test func fatherConversationWithChildren() throws {

        let db = try openDatabase()
        let results = try db.searchAyaat(matching: "آية_:بَنِيَّ آية_:بُنَيَّ")
        #expect(results.count >= 8)
        #expect(results.contains { $0.ayah.surah == 11 && $0.ayah.ayah == 42 }) // Nuh to his son
        #expect(results.contains { $0.ayah.surah == 2 && $0.ayah.ayah == 132 }) // Ibrahim & Yaqub
    }

    @Test func muqattaatLetters() throws {
        let db = try openDatabase()
        let results = try db.searchAyaat(matching: "الم المص الر المر كهيعص طه طسم طس يس ص حم عسق ق ن", limit: 50)
        #expect(results.count >= 20)
        #expect(results.contains { $0.ayah.surah == 2 && $0.ayah.ayah == 1 })
    }

    @Test func singleWordVersesNotMuqattaat() throws {
        let db = try openDatabase()
        let results = try db.searchAyaat(matching: "(ك_آ:1) وليس (الم المص الر المر كهيعص طه طسم طس يس ص حم عسق ق ن)")
        #expect(results.contains { $0.ayah.surah == 55 && $0.ayah.ayah == 1 }) // Ar-Rahman
        #expect(results.contains { $0.ayah.surah == 55 && $0.ayah.ayah == 64 }) // Mudhammatan
        #expect(!results.contains { $0.ayah.surah == 2 && $0.ayah.ayah == 1 }) // Alif-Lam-Mim excluded
    }

    @Test func exactPhraseSearch() throws {
        let db = try openDatabase()
        let results = try db.searchAyaat(matching: "\"لا يحب\"")
        #expect(!results.isEmpty)
        #expect(results.allSatisfy { QuranSearchNormalizer.plain($0.text).contains("لا يحب") })
    }

    @Test func challengeVerses() throws {
        let db = try openDatabase()
        let results = try db.searchAyaat(matching: "(فأتوا و *سور*) أو (بمثل و القرآن) أو (فليأتوا و بحديث) أو (فأتوا و بكتاب)")
        #expect(!results.isEmpty)
        #expect(results.contains { $0.ayah.surah == 2 && $0.ayah.ayah == 23 }) // فأتوا بسورة من مثله
    }

    @Test func prayerEarlyRevelations() throws {
        let db = try openDatabase()
        let results = try db.searchAyaat(matching: ">>صلاة")
        #expect(!results.isEmpty)
    }

    @Test func adamAndWife() throws {
        let db = try openDatabase()
        let results = try db.searchAyaat(matching: "آدم و *زوج*")
        #expect(!results.isEmpty)
        #expect(results.contains { $0.ayah.surah == 2 && $0.ayah.ayah == 35 })
    }

    @Test func noFearNorGrieve() throws {
        let db = try openDatabase()
        let results = try db.searchAyaat(matching: "خوف و يحزنون")
        #expect(!results.isEmpty)
        #expect(results.contains { $0.ayah.surah == 2 && $0.ayah.ayah == 38 })
    }

    @Test func cursesVerses() throws {
        let db = try openDatabase()
        let results = try db.searchAyaat(matching: ">لعن")
        #expect(!results.isEmpty)
    }

    @Test func patienceVerses() throws {
        let db = try openDatabase()
        let results = try db.searchAyaat(matching: ">>صبر")
        #expect(!results.isEmpty)
    }

    @Test func allahLovesNotNegated() throws {
        let db = try openDatabase()
        let results = try db.searchAyaat(matching: "يحبكم >الله و يحب وليس لا")
        #expect(!results.isEmpty)
    }
}

