import Foundation
import Testing
@testable import MushafCore

@Suite struct BuilderTests {
    private struct Golden: Decodable {
        struct Presets: Decodable {
            let imalahNarrators: [String], taqlilNarrators: [String]
            let kalimaTashilIdkhal: [String], kalimaTashilNoIdkhal: [String], kalimaTahqiq: [String]
            let kalimataynIsqatFirst: [String], kalimataynTashilFirst: [String], kalimataynTashilSecond: [String], kalimataynTahqiq: [String]
        }
        let imalahFaces: [[JSONValue]]
        let imalahRuling: [[JSONValue]]
        let detect: [[JSONValue]]
        let hamzahFaces: [[JSONValue]]
        let defaults: [[String]]
        let presets: Presets
    }

    private func string(_ v: JSONValue) -> String? { if case .string(let s) = v { s } else { nil } }
    private func bool(_ v: JSONValue) -> Bool? { if case .bool(let b) = v { b } else { nil } }

    // MARK: Golden parity

    @Test func imalahTextsMatchTheWeb() throws {
        let g: Golden = try ReviewGolden.load("builders")
        for row in g.imalahFaces {
            guard let t = string(row[0]), let type = ImalahType(rawValue: t), let p = string(row[1]),
                  let perf = FacePerformance(rawValue: p), let k = string(row[2]), let khulf = Khulf(rawValue: k) else {
                Issue.record("bad golden row \(row)"); return
            }
            #expect(ImalahBuilder.faceActionText(type, perf, khulf) == string(row[3]))
        }
        for row in g.imalahRuling {
            guard let t = string(row[0]), let type = ImalahType(rawValue: t), let wasl = bool(row[1]), let waqf = bool(row[2]) else {
                Issue.record("bad golden row \(row)"); return
            }
            #expect(ImalahBuilder.rulingText(type, wasl: wasl, waqf: waqf) == string(row[3]))
        }
        for row in g.detect {
            let input = string(row[0])
            let expected = string(row[1]).flatMap(ImalahType.init(rawValue:))
            #expect(ImalahBuilder.detectType(input) == expected, "input: \(input ?? "nil")")
        }
        #expect(g.imalahFaces.count == 24)
    }

    @Test func hamzahActionTextsMatchTheWeb() throws {
        let g: Golden = try ReviewGolden.load("builders")
        var bad: [String] = []
        for row in g.hamzahFaces {
            guard let category = string(row[0]) else { Issue.record("bad golden row"); return }
            let params = try JSONDecoder().decode(HamzahParams.self, from: try JSONEncoder().encode(row[1]))
            if HamzahBuilder.faceActionText(category: category, params: params) != string(row[2]) { bad.append("\(category) \(row[1])") }
        }
        #expect(bad.isEmpty, "\(bad.count) mismatches, first: \(bad.first ?? "")")
        #expect(g.hamzahFaces.count > 1000)
        for pair in g.defaults {
            #expect(HamzahBuilder.faceActionText(category: pair[0], params: HamzahParams()) == pair[1])
        }
    }

    @Test func presetNarratorGroupsMatchTheWeb() throws {
        let p = (try ReviewGolden.load("builders") as Golden).presets
        #expect(ImalahBuilder.narratorIds == p.imalahNarrators)
        #expect(ImalahBuilder.taqlilIds == p.taqlilNarrators)
        func ids(_ category: String, _ title: String) -> [String]? { HamzahBuilder.presets(for: category).first { $0.title.hasPrefix(title) }?.ids }
        #expect(ids("HAMZATAN_KALIMA", "أهل التسهيل مع الإدخال") == p.kalimaTashilIdkhal)
        #expect(ids("HAMZATAN_KALIMA", "أهل التسهيل بدون إدخال") == p.kalimaTashilNoIdkhal)
        #expect(ids("HAMZATAN_KALIMA", "أهل التحقيق") == p.kalimaTahqiq)
        #expect(ids("HAMZATAN_KALIMATAYN", "أبو عمرو البصري") == p.kalimataynIsqatFirst)
        #expect(ids("HAMZATAN_KALIMATAYN", "قالون والبزي") == p.kalimataynTashilFirst)
        #expect(ids("HAMZATAN_KALIMATAYN", "ورش وقنبل") == p.kalimataynTashilSecond)
        #expect(ids("HAMZATAN_KALIMATAYN", "المحققون") == p.kalimataynTahqiq)
    }

    // MARK: Adding a configured face

    @Test func facesGetSequentialWajhOrderAndAreNumberedWhenIdentical() {
        var list = FaceBuilder.addFace(to: [], ids: ["Q01-R02"], action: "تقليل وقفاً", performance: .waqfOnly, khulf: .bikhulf)
        #expect(list == [NarratorInput(id: "Q01-R02", action: "تقليل وقفاً", wajhOrder: 1, wajhNote: "بخلف عنه")])
        list = FaceBuilder.addFace(to: list, ids: ["Q01-R02"], action: "فتح وقفاً", performance: .waqfOnly, khulf: .qawlanWahidan)
        #expect(list[1] == NarratorInput(id: "Q01-R02", action: "فتح وقفاً", wajhOrder: 2, wajhNote: "عند الوقف"))
        list = FaceBuilder.addFace(to: list, ids: ["Q01-R02"], action: "فتح وقفاً", performance: .waslOnly, khulf: .qawlanWahidan)
        #expect(list[2].action == "فتح وقفاً (وجه 3)")                   // the same text is numbered
        #expect(list[2].wajhNote == "عند الوصل")
    }

    @Test func hafsNeverTakesWajhOneAndGetsHisNoteWhenNothingElseSetsOne() {
        let list = FaceBuilder.addFace(to: [], ids: [CanonicalReaders.hafsId], action: "أ", performance: .waslWaqf, khulf: .qawlanWahidan)
        #expect(list.first?.wajhOrder == 2)
        #expect(list.first?.wajhNote == "وجه ثانٍ لحفص")
        let withKhulf = FaceBuilder.addFace(to: [], ids: [CanonicalReaders.hafsId], action: "أ", performance: .waslWaqf, khulf: .bikhulf)
        #expect(withKhulf.first?.wajhNote == "بخلف عنه")
    }

    @Test func aFaceForSeveralNarratorsAddsOneEachInOrder() {
        let list = FaceBuilder.addFace(to: [], ids: ["Q06-R01", "Q06-R02", "Q07-R01"], action: "إمالة", performance: .waslWaqf, khulf: .qawlanWahidan)
        #expect(list.map(\.id) == ["Q06-R01", "Q06-R02", "Q07-R01"])
        #expect(list.allSatisfy { $0.wajhOrder == 1 && $0.action == "إمالة" && $0.wajhNote == nil })
    }

    @Test func performanceSetsWaslAndWaqf() {
        #expect(FacePerformance.waslWaqf.waslWaqf == (true, true))
        #expect(FacePerformance.waqfOnly.waslWaqf == (false, true))
        #expect(FacePerformance.waslOnly.waslWaqf == (true, false))
    }

    // MARK: Ruling text and details

    @Test func imalahRulingTextIsOnlyReplacedWhenEmptyOrAboutImalah() {
        #expect(ImalahBuilder.updatedRulingText(current: nil, type: .imalah, performance: .waslWaqf) == "إمالة الألف وصلاً ووقفاً")
        #expect(ImalahBuilder.updatedRulingText(current: "  ", type: .taqlil, performance: .waqfOnly) == "تقليل الألف عند الوقف")
        #expect(ImalahBuilder.updatedRulingText(current: "حكم إمالة قديم", type: .taqlil, performance: .waslOnly) == "تقليل الألف عند الوصل")
        #expect(ImalahBuilder.updatedRulingText(current: "ملاحظة المراجع", type: .imalah, performance: .waslWaqf) == nil)
        #expect(ImalahBuilder.updatedRulingText(current: nil, type: .fath, performance: .waslWaqf) == nil)   // فتح has no ruling sentence
    }

    @Test func hamzahDetailsFollowTheChosenTreatments() {
        var params = HamzahParams()
        params.kalimaFirst = .tahqiq; params.kalimaSecond = .tasheel; params.kalimaIdkhal = true
        #expect(HamzahBuilder.detail(category: "HAMZATAN_KALIMA", params: params, wordKeys: nil)
                == .kalima(first: .tahqiq, second: .tasheel, idkhalAlif: true))
        params.kalimataynRelation = .mukhtalifatan; params.kalimataynFirst = .isqat; params.kalimataynSecond = .ibdal
        let keys = HamzahDetail.WordKeys(first: "002:001:002", second: "002:001:001")
        #expect(HamzahBuilder.detail(category: "HAMZATAN_KALIMATAYN", params: params, wordKeys: keys)
                == .kalimatayn(harakahRelation: .mukhtalifatan, firstTreatment: .isqat, secondTreatment: .ibdal,
                               isqatFirst: true, isqatSecond: false, ibdalMadd: true, wordKeys: keys))
        params.singleTreatment = .naql
        #expect(HamzahBuilder.detail(category: "TAGHYIR_HAMZ", params: params, wordKeys: nil) == .single(treatment: .naql))
        #expect(HamzahBuilder.detail(category: "HAMZATAN_KALIMATAYN", params: HamzahParams(), wordKeys: nil)
                == .kalimatayn(harakahRelation: .mutafiqatan, firstTreatment: .tahqiq, secondTreatment: .tasheel,
                               isqatFirst: false, isqatSecond: false, ibdalMadd: false, wordKeys: nil))
    }

    @Test func hamzahPresetsSetTheirTreatmentsAndPerformance() throws {
        var params = HamzahParams()
        let warsh = try #require(HamzahBuilder.presets(for: "HAMZATAN_KALIMA").first { $0.title.hasPrefix("ورش") })
        warsh.apply(&params)
        #expect(warsh.ids == ["Q01-R02"] && params.kalimaSecond == .ibdal && params.kalimaIdkhal == false)
        let hamzah = try #require(HamzahBuilder.presets(for: "TAGHYIR_HAMZ").first { $0.title.hasPrefix("حمزة") })
        hamzah.apply(&params)
        #expect(hamzah.ids == ["Q06-R01", "Q06-R02"] && params.singleTreatment == .tasheel && params.performance == .waqfOnly)
        #expect(HamzahBuilder.defaultPerformance(for: "HAMZATAN_KALIMATAYN") == .waslOnly)
        #expect(HamzahBuilder.defaultPerformance(for: "HAMZATAN_KALIMA") == .waslWaqf)
    }

    @Test func hamzahRulingTextFollowsTheActionWhenEmptyOrAboutHamz() {
        #expect(HamzahBuilder.updatedRulingText(current: nil, action: "تسهيل الهمزة وقفاً") == "تسهيل الهمزة وقفاً")
        #expect(HamzahBuilder.updatedRulingText(current: "تحقيق الهمزتين", action: "إبدال الثانية") == "إبدال الثانية")
        #expect(HamzahBuilder.updatedRulingText(current: "ملاحظة", action: "تسهيل") == nil)
    }
}
