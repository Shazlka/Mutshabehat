#if DEBUG
import Foundation

/// أبواب whose structured details (Hamzah / Imalah) make them single-choice.
public enum CategoryRules {
    public static let hamzahCodes: Set<String> = ["TAGHYIR_HAMZ", "HAMZATAN_KALIMA", "HAMZATAN_KALIMATAYN"]
    public static let imalahCode = "IMALAH_TAQLIL"

    public static func isHamzah(_ code: String?) -> Bool { code.map(hamzahCodes.contains) ?? false }
    public static func isImalah(_ code: String?) -> Bool { code == imalahCode }
    public static func isSpecial(_ code: String?) -> Bool { isHamzah(code) || isImalah(code) }
}

/// Port of `FarshFields.tsx`: the database enum behind each variant type the reviewer can pick.
public enum VariantType {
    public struct Item: Hashable, Sendable { public let code: String; public let label: String; public let dbEnum: String }

    public static let canonical: [Item] = [
        Item(code: "تشكيل", label: "تشكيل / حركة", dbEnum: "vowel"),
        Item(code: "حرف", label: "إبدال حرف", dbEnum: "consonant"),
        Item(code: "زيادة", label: "زيادة حرف/كلمة", dbEnum: "addition"),
        Item(code: "حذف", label: "حذف حرف/كلمة", dbEnum: "omission"),
        Item(code: "تقديم وتأخير", label: "تقديم وتأخير", dbEnum: "word_form"),
        Item(code: "أخرى", label: "أخرى", dbEnum: "other"),
    ]

    private static let table: [String: String] = {
        var t: [String: String] = [:]
        func add(_ value: String, _ keys: [String]) { keys.forEach { t[$0] = value } }
        add("vowel", ["vowel", "harakah", "تشكيل", "تشكيل / حركة", "حركة"])
        add("consonant", ["consonant", "letter", "حرف", "إبدال حرف", "إبدال"])
        add("addition", ["addition", "زيادة", "زيادة حرف/كلمة", "زيادة حرف"])
        add("omission", ["omission", "حذف", "حذف حرف/كلمة", "حذف حرف"])
        add("word_form", ["word_form", "تقديم وتأخير", "تقديم وتأخير / بنية الكلمة", "بنية الكلمة"])
        add("orthography", ["orthography", "رسم"])
        add("hamza", ["hamza", "hamz", "همز", "همزة"])
        add("madd", ["madd", "مد"])
        add("idgham", ["idgham", "إدغام"])
        add("ishmam", ["ishmam", "إشمام"])
        add("imalah", ["imalah", "إمالة"])
        add("taqlil", ["taqlil", "تقليل"])
        add("sakt", ["sakt", "سكت"])
        add("naql", ["naql", "نقل"])
        add("ikhfa", ["ikhfa", "إخفاء"])
        add("ghunnah", ["ghunnah", "غنة"])
        add("pronoun", ["pronoun", "ضمير"])
        add("grammar", ["grammar", "إعراب"])
        add("other", ["other", "أخرى"])
        return t
    }()

    public static func normalize(_ raw: String?) -> String {
        guard let raw, !raw.isEmpty else { return "other" }
        let trimmed = Arabic.trimJS(raw).lowercased()
        return table[trimmed] ?? trimmed
    }
}

/// Port of `facesSummary.ts`: «٣ أوجه: تحقيق (نافع)، …» for the faces recorded on a word.
public enum FacesSummary {
    public static func label(for row: ReviewRow) -> String {
        func trimmed(_ s: String?) -> String { s.map(Arabic.trimJS) ?? "" }
        if row.kind == .usul {
            let name = trimmed(row.categoryNameAr)
            return name.isEmpty ? "أصل" : name
        }
        let reading = trimmed(row.readingText)
        if !reading.isEmpty { return reading }
        let hafs = trimmed(row.hafsText)
        return hafs.isEmpty ? "فرش" : hafs
    }

    public static func summarize(_ rows: [ReviewRow]) -> String {
        let active = rows.filter { !$0.deleted }
        if active.isEmpty { return "" }
        let parts = active.map { row -> String in
            let label = label(for: row)
            let names = NarratorDisplay.text(row.narrators.map { NarratorRef(id: $0.id, nameAr: $0.nameAr) })
            let spanNote = row.endKey != row.startKey ? " مع الكلمة التالية" : ""
            return names.isEmpty ? "\(label)\(spanNote)" : "\(label) (\(names))\(spanNote)"
        }
        let noun = active.count == 1 ? "وجه واحد" : active.count == 2 ? "وجهان" : "\(active.count) أوجه"
        return "\(noun): \(parts.joined(separator: "، "))"
    }
}

/// The reviewer's in-progress values for one face (an existing row being edited or a new entry).
public struct ReviewDraftFields: Hashable, Sendable {
    public var kind: ReadingKind
    public var categoryCode: String?
    /// Extra أصول أبواب ticked next to the primary one; each becomes its own sibling entry when saved.
    public var extraCategoryCodes: [String]
    public var readingText: String
    public var variantType: String?
    public var rulingText: String?
    public var description: String?
    public var performanceNote: String?
    public var appliesWasl: Bool
    public var appliesWaqf: Bool
    public var hamzahDetail: HamzahDetail?
    public var narrators: [NarratorInput]

    public init(kind: ReadingKind, categoryCode: String? = nil, extraCategoryCodes: [String] = [],
                readingText: String = "", variantType: String? = nil, rulingText: String? = nil,
                description: String? = nil, performanceNote: String? = nil, appliesWasl: Bool = true,
                appliesWaqf: Bool = true, hamzahDetail: HamzahDetail? = nil, narrators: [NarratorInput] = []) {
        self.kind = kind; self.categoryCode = categoryCode; self.extraCategoryCodes = extraCategoryCodes
        self.readingText = readingText; self.variantType = variantType; self.rulingText = rulingText
        self.description = description; self.performanceNote = performanceNote
        self.appliesWasl = appliesWasl; self.appliesWaqf = appliesWaqf
        self.hamzahDetail = hamzahDetail; self.narrators = narrators
    }
}

public struct DraftIssue: Hashable, Sendable, Error {
    public let messageAr: String
}

public enum SaveStep: Hashable, Sendable {
    case create(CreateEntryInput)
    case update(EntryFields)
    case setNarrators([NarratorInput])
    case setStatus(ReviewStatus, note: String?)
    /// Marks the entry reviewed; skipped when the saved row already is.
    case approve
    case delete(note: String?)
    case restore
}

/// The steps for ONE entry, run in order; jobs sharing a `chainKey` run one after another.
public struct SaveJobPlan: Hashable, Sendable {
    public let label: String
    public let chainKey: String
    public let steps: [SaveStep]

    public init(label: String, chainKey: String, steps: [SaveStep]) {
        self.label = label; self.chainKey = chainKey; self.steps = steps
    }
}

/// Port of `useReviewEditorDraft.ts`: validation, dirty detection, categories and the save plan.
public enum ReviewDraft {
    // MARK: Loading

    public static func fields(from row: ReviewRow) -> ReviewDraftFields {
        let variant = row.variantType.flatMap { $0.isEmpty ? nil : VariantType.normalize($0) }
        return ReviewDraftFields(
            kind: row.kind, categoryCode: row.categoryCode,
            readingText: row.readingText ?? row.hafsText, variantType: variant, rulingText: row.rulingText,
            description: row.description, performanceNote: row.performanceNote,
            appliesWasl: row.appliesWasl, appliesWaqf: row.appliesWaqf, hamzahDetail: row.hamzahDetail,
            narrators: row.narrators.map {
                NarratorInput(id: $0.id, action: $0.action, wajhOrder: $0.wajhOrder, wajhNote: $0.wajhNote)
            })
    }

    public static func fields(from entry: CreateEntryInput) -> ReviewDraftFields {
        ReviewDraftFields(
            kind: entry.kind, categoryCode: entry.categoryCode,
            readingText: entry.readingText ?? entry.uthmaniText ?? "",
            variantType: entry.variantType.flatMap { $0.isEmpty ? nil : VariantType.normalize($0) } ?? "vowel",
            rulingText: entry.rulingText, description: entry.description, performanceNote: entry.performanceNote,
            narrators: entry.narrators)
    }

    // MARK: Validation

    public static func validate(_ f: ReviewDraftFields) -> DraftIssue? {
        if f.kind == .farsh && Arabic.trimJS(f.readingText).isEmpty {
            return DraftIssue(messageAr: "نص القراءة مطلوب لفرش الحروف")
        }
        if f.kind == .usul && (f.categoryCode ?? "").isEmpty {
            return DraftIssue(messageAr: "الباب / القاعدة مطلوبة لأصول القراءات")
        }
        if f.narrators.isEmpty { return DraftIssue(messageAr: "يجب اختيار راوٍ واحد على الأقل") }
        // Rule D8: Hafs is the baseline, so he only appears as a second wajh with a note.
        let hafsBreaks = f.narrators.contains {
            $0.id == CanonicalReaders.hafsId && (($0.wajhOrder ?? 1) < 2 || Arabic.trimJS($0.wajhNote ?? "").isEmpty)
        }
        if hafsBreaks { return DraftIssue(messageAr: ReviewErrorCode.ruleD8.defaultMessageAr) }
        if !f.appliesWasl && !f.appliesWaqf { return DraftIssue(messageAr: ReviewErrorCode.ruleWaslWaqf.defaultMessageAr) }
        return nil
    }

    // MARK: Categories

    public static func selectedCategoryCodes(_ f: ReviewDraftFields) -> [String] {
        f.categoryCode.map { [$0] + f.extraCategoryCodes } ?? []
    }

    /// Ticking a باب adds it, ticking a ticked one removes it. همزة and إمالة أبواب stay single-choice.
    public static func toggleCategory(_ code: String, in f: inout ReviewDraftFields) {
        guard let primary = f.categoryCode, !CategoryRules.isSpecial(code), !CategoryRules.isSpecial(primary) else {
            f.categoryCode = code
            f.extraCategoryCodes = []
            return
        }
        if code == primary {
            f.categoryCode = f.extraCategoryCodes.first
            f.extraCategoryCodes = Array(f.extraCategoryCodes.dropFirst())
            return
        }
        if let index = f.extraCategoryCodes.firstIndex(of: code) { f.extraCategoryCodes.remove(at: index) }
        else { f.extraCategoryCodes.append(code) }
    }

    // MARK: Dirty

    public static func isDirty(original: ReviewDraftFields, current: ReviewDraftFields) -> Bool {
        var a = original, b = current
        a.extraCategoryCodes = []
        b.extraCategoryCodes = []
        return a != b || !current.extraCategoryCodes.isEmpty
    }

    // MARK: Save plan

    private static func trimmedOrNil(_ s: String?) -> String? {
        guard let s else { return nil }
        let t = Arabic.trimJS(s)
        return t.isEmpty ? nil : t
    }

    /// The fields sent when an existing entry is saved (the same set the web sends).
    public static func entryFields(_ f: ReviewDraftFields) -> EntryFields {
        var fields = EntryFields()
        fields.kind = .set(f.kind)
        if f.kind == .farsh {
            fields.readingText = .set(Arabic.trimJS(f.readingText))
            if let variant = f.variantType, !variant.isEmpty { fields.variantType = .set(VariantType.normalize(variant)) }
            fields.description = .set(trimmedOrNil(f.description))
            fields.performanceNote = .set(trimmedOrNil(f.performanceNote))
        } else {
            if let reading = trimmedOrNil(f.readingText) { fields.readingText = .set(reading) }
            if let code = f.categoryCode, !code.isEmpty { fields.categoryCode = .set(code) }
            fields.rulingText = .set(trimmedOrNil(f.rulingText))
        }
        fields.appliesWasl = .set(f.appliesWasl)
        fields.appliesWaqf = .set(f.appliesWaqf)
        fields.hamzahDetail = .set(f.kind == .usul && CategoryRules.isHamzah(f.categoryCode) ? f.hamzahDetail : nil)
        return fields
    }

    /// The steps that create `entry`. The create RPC stores neither wasl/waqf nor the hamzah detail, so when
    /// they differ from the defaults a follow-up update writes them (exactly what the web's create does).
    public static func createSteps(for entry: CreateEntryInput) -> [SaveStep] {
        guard entry.appliesWasl == false || entry.appliesWaqf == false || entry.hamzahDetail != nil else {
            return [.create(entry)]
        }
        var follow = EntryFields()
        follow.appliesWasl = .set(entry.appliesWasl ?? true)
        follow.appliesWaqf = .set(entry.appliesWaqf ?? true)
        follow.hamzahDetail = .set(entry.hamzahDetail)
        return [.create(entry), .update(follow)]
    }

    private static func locationKey(_ surah: Int, _ ayah: Int, _ word: Int) -> String { "loc:\(surah):\(ayah):\(word)" }

    /// Existing row: `row` is set. New entry: `newEntry` is set (it carries the word position).
    public static func savePlan(draft: ReviewDraftFields, original: ReviewDraftFields, row: ReviewRow?,
                                newEntry: CreateEntryInput?, approve: Bool) -> [SaveJobPlan] {
        if let row {
            guard isDirty(original: original, current: draft) else {
                return approve ? [SaveJobPlan(label: "اعتماد", chainKey: "entry:\(row.entryId)", steps: [.approve])] : []
            }
            var plans = [SaveJobPlan(
                label: "حفظ التعديلات", chainKey: "entry:\(row.entryId)",
                steps: [.update(entryFields(draft)), .setNarrators(draft.narrators)] + (approve ? [.approve] : []))]
            if draft.kind == .usul {
                for code in draft.extraCategoryCodes {
                    let sibling = CreateEntryInput(
                        surah: row.surah, ayah: row.ayah, startWord: row.startWord,
                        endAyah: row.endAyah, endWord: row.endWord, kind: .usul,
                        readingText: trimmedOrNil(draft.readingText), uthmaniText: row.uthmaniText,
                        categoryCode: code, rulingText: trimmedOrNil(draft.rulingText),
                        narrators: draft.narrators, appliesWasl: draft.appliesWasl, appliesWaqf: draft.appliesWaqf)
                    plans.append(SaveJobPlan(label: "إضافة وجه", chainKey: locationKey(row.surah, row.ayah, row.startWord),
                                             steps: createSteps(for: sibling)))
                }
            }
            return plans
        }

        guard var entry = newEntry else { return [] }
        entry.kind = draft.kind
        entry.readingText = trimmedOrNil(draft.readingText)
        entry.categoryCode = draft.kind == .usul ? draft.categoryCode.flatMap { $0.isEmpty ? nil : $0 } : nil
        entry.variantType = draft.kind == .farsh ? draft.variantType.flatMap { $0.isEmpty ? nil : VariantType.normalize($0) } : nil
        entry.rulingText = draft.kind == .usul ? trimmedOrNil(draft.rulingText) : nil
        entry.description = trimmedOrNil(draft.description)
        entry.performanceNote = trimmedOrNil(draft.performanceNote)
        entry.narrators = draft.narrators
        entry.appliesWasl = draft.appliesWasl
        entry.appliesWaqf = draft.appliesWaqf
        entry.hamzahDetail = draft.kind == .usul && CategoryRules.isHamzah(draft.categoryCode) ? draft.hamzahDetail : nil

        var steps: [SaveStep] = [.create(entry)]
        if !draft.appliesWasl || !draft.appliesWaqf || entry.hamzahDetail != nil {
            var follow = EntryFields()
            follow.appliesWasl = .set(draft.appliesWasl)
            follow.appliesWaqf = .set(draft.appliesWaqf)
            follow.hamzahDetail = .set(entry.hamzahDetail)
            steps.append(.update(follow))
        }
        if approve { steps.append(.approve) }

        let key = locationKey(entry.surah, entry.ayah, entry.startWord)
        var plans = [SaveJobPlan(label: "إضافة وجه", chainKey: key, steps: steps)]
        if draft.kind == .usul {
            for code in draft.extraCategoryCodes {
                var sibling = entry
                sibling.categoryCode = code
                sibling.hamzahDetail = nil
                plans.append(SaveJobPlan(label: "إضافة وجه", chainKey: key, steps: createSteps(for: sibling)))
            }
        }
        return plans
    }
}

/// Port of the reader/narrator picking logic of `ReaderNarratorSelector.tsx`, as pure functions.
public enum NarratorSelection {
    public enum Preset: Sendable {
        case all, sabah, thalatha, kufis, madaniyan

        var ids: [String] {
            let readers = CanonicalReaders.all
            switch self {
            case .all: return CanonicalReaders.allNarratorIds
            case .sabah: return readers.prefix(7).flatMap { $0.narrators.map(\.id) }
            case .thalatha: return readers.suffix(3).flatMap { $0.narrators.map(\.id) }
            case .kufis: return readers.filter { ["Q05", "Q06", "Q07", "Q10"].contains($0.id) }.flatMap { $0.narrators.map(\.id) }
            case .madaniyan: return readers.filter { ["Q01", "Q08"].contains($0.id) }.flatMap { $0.narrators.map(\.id) }
            }
        }
    }

    private static func firstFace(_ id: String) -> NarratorInput {
        let hafs = id == CanonicalReaders.hafsId
        return NarratorInput(id: id, action: nil, wajhOrder: hafs ? 2 : 1, wajhNote: hafs ? "وجه ثانٍ لحفص" : nil)
    }

    public static func toggleNarrator(_ list: [NarratorInput], id: String) -> [NarratorInput] {
        list.contains { $0.id == id } ? list.filter { $0.id != id } : list + [firstFace(id)]
    }

    public static func toggleReader(_ list: [NarratorInput], readerId: String) -> [NarratorInput] {
        guard let reader = CanonicalReaders.all.first(where: { $0.id == readerId }) else { return list }
        let ids = reader.narrators.map(\.id)
        let has = ids.map { id in list.contains { $0.id == id } }
        if has.allSatisfy({ $0 }) { return list.filter { !ids.contains($0.id) } }
        var next = list
        for (id, present) in zip(ids, has) where !present { next.append(firstFace(id)) }
        return next
    }

    /// Keeps the faces of narrators in `ids` and adds the missing ones.
    public static func select(_ list: [NarratorInput], ids: [String]) -> [NarratorInput] {
        let wanted = Set(ids)
        var next = list.filter { wanted.contains($0.id) }
        for id in ids where !next.contains(where: { $0.id == id }) { next.append(firstFace(id)) }
        return next
    }

    public static func select(_ list: [NarratorInput], preset: Preset) -> [NarratorInput] {
        select(list, ids: preset.ids)
    }

    /// Another wajh for a narrator who already has one, flagged «بخلف عنه».
    public static func addFace(_ list: [NarratorInput], narratorId: String) -> [NarratorInput] {
        list + [NarratorInput(id: narratorId, action: nil, wajhOrder: WajhOrder.next(list, for: narratorId), wajhNote: "بخلف عنه")]
    }

    public static func addFaceForReader(_ list: [NarratorInput], readerId: String) -> [NarratorInput] {
        guard let reader = CanonicalReaders.all.first(where: { $0.id == readerId }) else { return list }
        return list + reader.narrators.map {
            NarratorInput(id: $0.id, action: nil, wajhOrder: WajhOrder.next(list, for: $0.id), wajhNote: "بخلف عنه")
        }
    }

    public static func removeFace(_ list: [NarratorInput], at index: Int) -> [NarratorInput] {
        list.indices.contains(index) ? list.enumerated().filter { $0.offset != index }.map(\.element) : list
    }
}
#endif
