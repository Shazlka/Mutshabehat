#if DEBUG
import Foundation
import Testing
@testable import MushafCore

@Suite struct ReferenceDecisionTests {
    // MARK: Helpers

    private func row(_ id: String, narrators: [String], status: String = "reviewed", deleted: Bool = false) throws -> ReviewRow {
        let list = narrators.map { #"{"id":"\#($0)","nameAr":"x","wajhOrder":1}"# }.joined(separator: ",")
        return try JSONDecoder().decode(ReviewRow.self, from: Data("""
        {"entryId":"\(id)","locationId":"l","version":"v","kind":"usul","surah":2,"ayah":1,"startWord":1,
         "reviewStatus":"\(status)","deleted":\(deleted),"narrators":[\(list)],"flags":[]}
        """.utf8))
    }

    private func group(_ ids: [String], performance: String = "أداء", reading: String? = nil,
                       suggestion: ReferenceSuggestion? = nil, condition: ReferenceCondition? = nil) -> ReferenceGroup {
        ReferenceGroup(key: "k", readersLabel: "x", narratorIds: ids, performanceText: performance,
                       readingText: reading, condition: condition, conditionBasis: nil,
                       suggestion: suggestion, unresolvedLabels: nil)
    }

    // MARK: Golden parity

    private struct ShamilGolden: Decodable {
        let samples: [[JSONValue]]
        let groups: [[ReferenceGroup]]
        let performance: [[JSONValue]]
        let matchKeys: [[String]]
    }

    private func ints(_ value: JSONValue) -> [Int] {
        guard case .array(let items) = value else { return [] }
        return items.compactMap { if case .number(let n) = $0 { Int(n) } else { nil } }
    }

    @Test func shamilMatchingGoldenParity() throws {
        let golden: ShamilGolden = try ReviewGolden.load("shamil")
        let entries = try #require(try ReferenceLibrary(directory: ReviewGolden.referenceDirectory).shamil(surah: 2))
        var pageCache: [Int: [ReviewGolden.FixtureWord]] = [:]
        var mismatches: [String] = []
        for sample in golden.samples {
            guard case .number(let p) = sample[0], case .number(let s) = sample[1],
                  case .number(let a) = sample[2], case .number(let w) = sample[3] else { Issue.record("bad sample"); return }
            let (page, surah, ayah, word) = (Int(p), Int(s), Int(a), Int(w))
            let words = try pageCache[page] ?? { let x = try ReviewGolden.pageWords(page); pageCache[page] = x; return x }()
            let text = try #require(words.first { $0.surah == surah && $0.ayah == ayah && $0.word == word }).text
            let withContext = ShamilMatching.matchingIndices(
                entries: entries, ayah: ayah, wordText: text,
                context: ReviewGolden.context(words, surah: surah, ayah: ayah, word: word))
            let without = ShamilMatching.matchingIndices(entries: entries, ayah: ayah, wordText: text, context: nil)
            if withContext != ints(sample[4]) || without != ints(sample[5]) {
                mismatches.append("\(surah):\(ayah):\(word) ctx \(withContext) vs \(ints(sample[4])), none \(without) vs \(ints(sample[5]))")
            }
        }
        #expect(mismatches.isEmpty, "\(mismatches.count) mismatches, first: \(mismatches.first ?? "")")
        #expect(golden.samples.count > 5_000)
    }

    @Test func shamilGroupsPerformanceAndCategoryMatchWeb() throws {
        let golden: ShamilGolden = try ReviewGolden.load("shamil")
        let entries = try #require(try ReferenceLibrary(directory: ReviewGolden.referenceDirectory).shamil(surah: 2))
        #expect(golden.groups.count == entries.count)
        var bad = 0
        for (entry, expected) in zip(entries, golden.groups) where ShamilMatching.groups(for: entry) != expected { bad += 1 }
        #expect(bad == 0)

        var index = 0
        for entry in entries {
            for wajh in entry.wajhs {
                let expected = golden.performance[index]; index += 1
                #expect(ShamilMatching.performanceText(description: wajh.description, condition: wajh.condition) == (expected[0] == .null ? nil : { if case .string(let s) = expected[0] { s } else { nil } }()))
                let suggestion = ShamilMatching.suggestCategory(type: wajh.type, category: wajh.category, description: wajh.description)
                let data = try JSONEncoder().encode(expected[1])
                #expect(try JSONDecoder().decode(ReferenceSuggestion.self, from: data) == suggestion)
            }
        }
        for pair in golden.matchKeys { #expect(ShamilMatching.matchKey(pair[0]) == pair[1]) }
    }

    @Test func nquranGroupsHaveSharedShape() throws {
        let difference = NquranDifference(location: "x", groups: [
            NquranReaderGroup(readers: ["ورش عن نافع", "حمزة"], reading: "تقليل"),
        ])
        let groups = NquranMatching.groups(for: difference)
        #expect(groups.count == 1)
        #expect(groups[0].key == "0")
        #expect(groups[0].readersLabel == "ورش عن نافع، حمزة")
        #expect(groups[0].performanceText == "تقليل")
        #expect(groups[0].narratorIds == ["Q01-R02", "Q06-R01", "Q06-R02"])
        #expect(groups[0].unresolvedLabels == [])
    }

    private struct DecisionCase: Decodable {
        struct R: Decodable { let narrators: [N]; let reviewStatus: String; let deleted: Bool }
        struct N: Decodable { let id: String }
        struct G: Decodable { let narratorIds: [String] }
        struct B: Decodable { let draft: Bool; let decision: Bool }
        let rows: [R]; let group: G; let draftIds: [String]
        let status: String; let matched: Int; let inDraft: Bool; let nullDecision: Bool; let badge: B
    }

    @Test func decisionAndBadgeGoldenParity() throws {
        let cases: [DecisionCase] = try ReviewGolden.load("decision")
        var bad: [String] = []
        for (n, c) in cases.enumerated() {
            let rows = try c.rows.enumerated().map {
                try row("r\($0.offset)", narrators: $0.element.narrators.map(\.id), status: $0.element.reviewStatus, deleted: $0.element.deleted)
            }
            let decision = ReferenceDecider.propose(narratorIds: c.group.narratorIds, rows: rows)
            let matchedIndex = decision.matchedRow.flatMap { m in rows.firstIndex { $0.entryId == m.entryId } } ?? -1
            let inDraft = ReferenceDecider.isGroupInDraft(narratorIds: c.group.narratorIds, draftNarratorIds: c.draftIds)
            let badge = ReferenceDecider.badgeVisibility(decision: c.nullDecision ? nil : decision, inDraft: inDraft)
            if decision.status.rawValue != c.status || matchedIndex != c.matched || inDraft != c.inDraft
                || badge.draft != c.badge.draft || badge.decision != c.badge.decision { bad.append("case \(n)") }
        }
        #expect(bad.isEmpty, "\(bad.count) mismatches, first: \(bad.first ?? "")")
        #expect(cases.count == 4000)
    }

    private struct ApplyCase: Decodable {
        let source: ReferenceSource; let group: ReferenceGroup; let ctx: ApplyContext; let plan: ApplyPlan
    }

    @Test func applyPlanGoldenParity() throws {
        let cases: [ApplyCase] = try ReviewGolden.load("apply")
        var bad: [String] = []
        for (n, c) in cases.enumerated() where ReferenceApply.plan(source: c.source, group: c.group, context: c.ctx) != c.plan {
            bad.append("case \(n)")
        }
        #expect(bad.isEmpty, "\(bad.count) mismatches, first: \(bad.first ?? "")")
        #expect(cases.count == 6000)
    }

    private struct NarratorsGolden: Decodable {
        struct Display: Decodable {
            struct N: Decodable { let id: String; let nameAr: String }
            let narrators: [N]; let items: [NarratorDisplayItem]; let text: String
        }
        struct Wajh: Decodable { let narrators: [NarratorInput]; let id: String; let next: Int }
        let display: [Display]; let wajh: [Wajh]
    }

    @Test func narratorDisplayAndWajhOrderGoldenParity() throws {
        let golden: NarratorsGolden = try ReviewGolden.load("narrators")
        for c in golden.display {
            let refs = c.narrators.map { NarratorRef(id: $0.id, nameAr: $0.nameAr) }
            #expect(NarratorDisplay.describe(refs) == c.items)
            #expect(NarratorDisplay.text(refs) == c.text)
        }
        for c in golden.wajh { #expect(WajhOrder.next(c.narrators, for: c.id) == c.next) }
        #expect(golden.display.count == 1500)
    }

    // MARK: Ported web cases

    @Test func savedStatusBeatsDraftBadge() throws {
        let reviewed = ReferenceDecider.propose(narratorIds: ["Q01-R01"], rows: [try row("a", narrators: ["Q01-R01"])])
        #expect(reviewed.status == .matched)
        #expect(ReferenceDecider.badgeVisibility(decision: reviewed, inDraft: true) == BadgeVisibility(draft: false, decision: true))
        let waiting = ReferenceDecider.propose(narratorIds: ["Q01-R01"], rows: [try row("a", narrators: ["Q01-R01"], status: "unreviewed")])
        #expect(waiting.status == .recordedUnreviewed)
        let missing = ReferenceDecider.propose(narratorIds: ["Q02-R01"], rows: [try row("a", narrators: ["Q01-R01"])])
        #expect(missing.status == .missing)
        #expect(ReferenceDecider.badgeVisibility(decision: missing, inDraft: true) == BadgeVisibility(draft: true, decision: false))
        #expect(ReferenceDecider.propose(narratorIds: [], rows: []).status == .unresolved)
    }

    private func context(narrators: [NarratorInput] = [], reading: String = "", fresh: Bool = false,
                         category: String? = nil, kind: ReadingKind = .usul) -> ApplyContext {
        ApplyContext(narrators: narrators, readingText: reading, defaultReadingText: "وَإِذْ", kind: kind,
                     categoryCode: category, isFreshDraft: fresh, otherFarshNarrators: [])
    }

    @Test func applyDoesNotOverwriteExistingCategory() {
        let g = group(["Q01-R02"], suggestion: ReferenceSuggestion(kind: .usul, categoryCode: "USUL_NAQL"))
        let plan = ReferenceApply.plan(source: .shamil, group: g, context: context(category: "USUL_SAKT"))
        #expect(plan.categoryCode == nil)
        #expect(plan.pendingSuggestion == ReferenceSuggestion(kind: .usul, categoryCode: "USUL_NAQL"))
        let free = ReferenceApply.plan(source: .shamil, group: g, context: context())
        #expect(free.categoryCode == "USUL_NAQL")
        #expect(free.pendingSuggestion == nil)
    }

    @Test func applyFillsReadingTextOnlyWhenEmptyOrDefaultOnFreshDraft() {
        let g = group(["Q01-R02"], reading: "نَقْل")
        #expect(ReferenceApply.plan(source: .shamil, group: g, context: context(reading: "")).readingText == "نَقْل")
        #expect(ReferenceApply.plan(source: .shamil, group: g, context: context(reading: "كتبتُه")).readingText == nil)
        #expect(ReferenceApply.plan(source: .shamil, group: g, context: context(reading: "وَإِذْ", fresh: true)).readingText == "نَقْل")
        #expect(ReferenceApply.plan(source: .shamil, group: g, context: context(reading: "وَإِذْ", fresh: false)).readingText == nil)
    }

    @Test func applyFloorsHafsAtWajhTwoWithNote() {
        let g = group([CanonicalReaders.hafsId], performance: "")
        let plan = ReferenceApply.plan(source: .nquran, group: g, context: context())
        #expect(plan.narrators.first?.wajhOrder == 2)
        #expect(plan.narrators.first?.wajhNote == "مستورد من مرجع nquran.com")
    }

    @Test func narratorDisplayCollapsesBothNarratorsOfAReader() {
        let both = NarratorDisplay.describe([NarratorRef(id: "Q01-R01", nameAr: "قالون"), NarratorRef(id: "Q01-R02", nameAr: "ورش")])
        #expect(both == [NarratorDisplayItem(key: "Q01", label: "نافع المدني", color: "#2563EB")])
        let one = NarratorDisplay.describe([NarratorRef(id: "Q01-R02", nameAr: "ورش")])
        #expect(one == [NarratorDisplayItem(key: "Q01-R02", label: "ورش", color: "#2563EB")])
    }
}
#endif
