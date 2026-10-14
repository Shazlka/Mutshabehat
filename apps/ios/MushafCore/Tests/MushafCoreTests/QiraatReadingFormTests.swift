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
}
