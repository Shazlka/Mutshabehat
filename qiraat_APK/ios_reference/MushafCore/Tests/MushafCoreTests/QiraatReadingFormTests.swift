import Testing
@testable import MushafCore

@Suite struct QiraatReadingFormTests {
    @Test func roundedZeroNoLongerCutsTheWord() {
        let word = "أُو۟لَـٰٓئِكَ"
        #expect(!QiraatReadingForm.display(word).unicodeScalars.contains { $0.value == 0x06DF })
        #expect(QiraatReadingForm.display("كَأَنَّهُمْ") == "كَأَنَّهُمْ")
    }

    @Test func silatAddsTheSmallWawAfterTheMeem() throws {
        let form = try #require(QiraatReadingForm.form(baseText: "كَأَنَّهُمْ", action: "قرأ بصلة ميم الجمع وصلا.", categoryCode: "USUL_MIM_JAM"))
        #expect(form.unicodeScalars.last?.value == 0x06E5)
        #expect(!form.unicodeScalars.contains { $0.value == 0x0652 })
        #expect(form.contains("مُ"))
        #expect(QiraatReadingForm.form(baseText: "كَأَنَّهُمْ", action: "كسر الدوري الميم وصلا", categoryCode: "USUL_MIM_JAM") == nil)
    }

    @Test func naqlDropsTheHamzaAndMovesItsVowel() throws {
        let base = "وَٱلْأَرْضَ"
        let form = try #require(QiraatReadingForm.form(baseText: base, action: "قرأ بالنقل مع ترك السكت.", categoryCode: "USUL_SAKT"))
        #expect(!form.unicodeScalars.contains { $0.value == 0x0623 })
        #expect(form.contains("لَ"))
        #expect(form.count < base.count)
        // naql only at the stop, or sakt: the written word does not change
        #expect(QiraatReadingForm.form(baseText: base, action: "قرأ بالسكت وصلاً، ووقف بالسكت والنقل.", categoryCode: "USUL_SAKT") == nil)
        #expect(QiraatReadingForm.form(baseText: base, action: "قرأ بترك السكت وصلا، ووقف بالنقل والتحقيق.", categoryCode: "USUL_SAKT") == nil)
    }

    @Test func naqlNeverCrossesAWordBoundary() {
        #expect(QiraatReadingForm.withNaql("قَدْ أَفْلَحَ") == nil)
    }

    @Test func naqlAcrossTwoWords() throws {
        // مِنْ + ءَامَنَ → مِنَ امَنَ
        let form = try #require(QiraatReadingForm.form(baseText: "مِنْ", action: "قرأ بالنقل وصلاً ووقفا.", categoryCode: "USUL_NAQL",
                                                      previousWord: nil, nextWord: "ءَامَنَ"))
        #expect(form.contains(" "))
        #expect(!form.unicodeScalars.contains { $0.value == 0x0652 })
        #expect(!form.contains("ء"))
        // the hamza word anchored itself, the previous word is the one at rest
        #expect(QiraatReadingForm.form(baseText: "أَفْلَحَ", action: "قرأ بالنقل وصلاً ووقفا.", categoryCode: "USUL_NAQL",
                                       previousWord: "قَدْ", nextWord: nil) != nil)
        // tanween before the hamza is not rewritten
        #expect(QiraatReadingForm.form(baseText: "عَذَابٌ", action: "قرأ بالنقل وصلاً ووقفا.", categoryCode: "USUL_SAKT",
                                       previousWord: nil, nextWord: "أَلِيمٌ") == nil)
    }

    @Test func silatOnAMeemThatAlreadyHasADammaOrNoVowel() throws {
        let a = try #require(QiraatReadingForm.form(baseText: "هُمُ", action: "قرأ بصلة ميم الجمع وصلا.", categoryCode: "USUL_MIM_JAM"))
        #expect(a.unicodeScalars.last?.value == 0x06E5)
        let b = try #require(QiraatReadingForm.form(baseText: "قُلُوبِهِم", action: "قرأ بصلة ميم الجمع وصلا.", categoryCode: "USUL_MIM_JAM"))
        #expect(b.unicodeScalars.suffix(2).map(\.value) == [0x064F, 0x06E5])
    }
}
