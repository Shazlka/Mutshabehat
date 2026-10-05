import Foundation

public enum ImalahType: String, Codable, Sendable, CaseIterable, Hashable {
    case imalah = "إمالة"
    case taqlil = "تقليل"
    case fath = "فتح"
    case imalahTaqlil = "إمالة وتقليل"
}

public enum FacePerformance: String, Codable, Sendable, CaseIterable, Hashable {
    case waslWaqf = "wasl_waqf"
    case waqfOnly = "waqf_only"
    case waslOnly = "wasl_only"

    /// The وصل / وقف switches this performance implies.
    public var waslWaqf: (wasl: Bool, waqf: Bool) {
        switch self {
        case .waslWaqf: (true, true)
        case .waqfOnly: (false, true)
        case .waslOnly: (true, false)
        }
    }

    var text: String { self == .waslWaqf ? "وصلاً ووقفاً" : self == .waqfOnly ? "وقفاً" : "وصلاً" }
}

public enum Khulf: String, Codable, Sendable, CaseIterable, Hashable {
    case qawlanWahidan = "qawlan_wahidan"
    case bikhulf
}

/// JavaScript's `String.includes`: exact UTF-16 substring search (Swift's `contains` compares Characters, so a
/// word followed by a vowel mark would not be found).
func jsIncludes(_ text: String, _ needle: String) -> Bool {
    (text as NSString).range(of: needle, options: .literal).location != NSNotFound
}

/// Port of `ImalahDetailFields.tsx` (the الممال والمقلل builder): the texts it writes and its narrator groups.
public enum ImalahBuilder {
    public struct Preset: Sendable { public let title: String; public let ids: [String] }

    public static let narratorIds = ["Q06-R01", "Q06-R02", "Q07-R01", "Q07-R02", "Q10-R01", "Q10-R02"]
    public static let taqlilIds = ["Q01-R02", "Q03-R01", "Q03-R02"]
    public static let warshId = "Q01-R02"

    public static let presets: [Preset] = [
        Preset(title: "أهل الإمالة (حمزة، الكسائي، خلف العاشر)", ids: narratorIds),
        Preset(title: "أهل التقليل (ورش، أبو عمرو)", ids: taqlilIds),
        Preset(title: "ورش فقط", ids: [warshId]),
        Preset(title: "الأخوان (حمزة والكسائي)", ids: ["Q06-R01", "Q06-R02", "Q07-R01", "Q07-R02"]),
        Preset(title: "أبو عمرو البصري", ids: ["Q03-R01", "Q03-R02"]),
    ]

    public static func rulingText(_ type: ImalahType, wasl: Bool, waqf: Bool) -> String {
        "\(type.rawValue) الألف \(wasl && waqf ? "وصلاً ووقفاً" : waqf ? "عند الوقف" : "عند الوصل")"
    }

    public static func faceActionText(_ type: ImalahType, _ performance: FacePerformance, _ khulf: Khulf) -> String {
        "\(type.rawValue) \(performance.text)\(khulf == .bikhulf ? " (بخلف عنه)" : "")"
    }

    public static func detectType(_ rulingText: String?) -> ImalahType? {
        guard let rulingText else { return nil }
        let text = Arabic.trimJS(rulingText)
        if jsIncludes(text, "إمالة") && jsIncludes(text, "تقليل") { return .imalahTaqlil }
        if jsIncludes(text, "تقليل") { return .taqlil }
        if jsIncludes(text, "إمالة") { return .imalah }
        if jsIncludes(text, "فتح") { return .fath }
        return nil
    }

    /// The ruling sentence the builder writes when the current one is empty or already about imalah/taqlil;
    /// nil leaves it alone (a reviewer's own text, or فتح, which has no sentence).
    public static func updatedRulingText(current: String?, type: ImalahType, performance: FacePerformance) -> String? {
        let text = current.map(Arabic.trimJS) ?? ""
        guard text.isEmpty || jsIncludes(text, "إمالة") || jsIncludes(text, "تقليل"), type != .fath else { return nil }
        return rulingText(type, wasl: performance != .waqfOnly, waqf: performance != .waslOnly)
    }
}

/// The parameters of the Hamzah builder; every one is optional, with the web's defaults.
public struct HamzahParams: Codable, Hashable, Sendable {
    public var kalimaFirst: HamzahTreatment?
    public var kalimaSecond: HamzahTreatment?
    public var kalimaIdkhal: Bool?
    public var kalimataynRelation: HarakahRelation?
    public var kalimataynFirst: HamzahTreatment?
    public var kalimataynSecond: HamzahTreatment?
    public var singleTreatment: HamzahTreatment?
    public var performance: FacePerformance = .waslWaqf
    public var khulf: Khulf = .qawlanWahidan

    public init() {}

    enum CodingKeys: String, CodingKey {
        case kalimaFirst, kalimaSecond, kalimaIdkhal, kalimataynRelation, kalimataynFirst, kalimataynSecond
        case singleTreatment, performance, khulf
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        kalimaFirst = try c.decodeIfPresent(HamzahTreatment.self, forKey: .kalimaFirst)
        kalimaSecond = try c.decodeIfPresent(HamzahTreatment.self, forKey: .kalimaSecond)
        kalimaIdkhal = try c.decodeIfPresent(Bool.self, forKey: .kalimaIdkhal)
        kalimataynRelation = try c.decodeIfPresent(HarakahRelation.self, forKey: .kalimataynRelation)
        kalimataynFirst = try c.decodeIfPresent(HamzahTreatment.self, forKey: .kalimataynFirst)
        kalimataynSecond = try c.decodeIfPresent(HamzahTreatment.self, forKey: .kalimataynSecond)
        singleTreatment = try c.decodeIfPresent(HamzahTreatment.self, forKey: .singleTreatment)
        performance = try c.decodeIfPresent(FacePerformance.self, forKey: .performance) ?? .waslWaqf
        khulf = try c.decodeIfPresent(Khulf.self, forKey: .khulf) ?? .qawlanWahidan
    }
}

/// Port of `HamzahDetailFields.tsx`: the action text and structured detail of a Hamzah face, and its presets.
public enum HamzahBuilder {
    public struct Preset: Sendable {
        public let title: String
        public let ids: [String]
        public let apply: @Sendable (inout HamzahParams) -> Void
    }

    static let kalimaTashilIdkhal = ["Q01-R01", "Q03-R01", "Q03-R02", "Q04-R01", "Q08-R01", "Q08-R02"]
    static let kalimaTashilNoIdkhal = ["Q01-R02", "Q02-R01", "Q02-R02", "Q09-R01"]
    static let kalimaTahqiq = ["Q04-R02", "Q05-R01", "Q05-R02", "Q06-R01", "Q06-R02", "Q07-R01", "Q07-R02",
                               "Q09-R02", "Q10-R01", "Q10-R02"]
    static let kalimataynIsqatFirst = ["Q03-R01", "Q03-R02"]
    static let kalimataynTashilFirst = ["Q01-R01", "Q02-R01"]
    static let kalimataynTashilSecond = ["Q01-R02", "Q02-R02", "Q08-R01", "Q08-R02", "Q09-R01"]
    static let kalimataynTahqiq = ["Q04-R01", "Q04-R02", "Q05-R01", "Q05-R02", "Q06-R01", "Q06-R02", "Q07-R01",
                                   "Q07-R02", "Q09-R02", "Q10-R01", "Q10-R02"]

    public static func defaultPerformance(for category: String) -> FacePerformance {
        category == "HAMZATAN_KALIMATAYN" ? .waslOnly : .waslWaqf
    }

    public static func faceActionText(category: String, params p: HamzahParams) -> String {
        let perf = p.performance.text
        let khulf = p.khulf == .bikhulf ? " (بخلف عنه)" : ""
        switch category {
        case "HAMZATAN_KALIMA":
            let first = p.kalimaFirst ?? .tahqiq, second = p.kalimaSecond ?? .tasheel
            let idkhal = p.kalimaIdkhal == true ? " مع الإدخال" : " بدون إدخال"
            if first == .tahqiq && second == .tahqiq { return "تحقيق الهمزتين\(idkhal) \(perf)\(khulf)" }
            if second == .tasheel { return "تسهيل الثانية\(idkhal) \(perf)\(khulf)" }
            if second == .ibdal { return "إبدال الثانية حرف مد\(idkhal) \(perf)\(khulf)" }
            if second == .isqat { return "إسقاط الثانية\(idkhal) \(perf)\(khulf)" }
            return "\(first.rawValue) الأولى و\(second.rawValue) الثانية\(idkhal) \(perf)\(khulf)"
        case "HAMZATAN_KALIMATAYN":
            let first = p.kalimataynFirst ?? .tahqiq, second = p.kalimataynSecond ?? .tasheel
            if first == .isqat { return "إسقاط الأولى \(perf)\(khulf)" }
            if first == .tasheel { return "تسهيل الأولى \(perf)\(khulf)" }
            if first == .tahqiq && second == .tahqiq { return "تحقيق الهمزتين \(perf)\(khulf)" }
            if second == .tasheel { return "تسهيل الثانية بين بين \(perf)\(khulf)" }
            if second == .ibdal { return "إبدال الثانية حرف مد \(perf)\(khulf)" }
            if second == .hadhf { return "حذف الثانية \(perf)\(khulf)" }
            return "\(first.rawValue) الأولى و\(second.rawValue) الثانية \(perf)\(khulf)"
        default:
            return "\((p.singleTreatment ?? .tasheel).rawValue) الهمزة \(perf)\(khulf)"
        }
    }

    /// The structured detail saved with the face (the web stores it as opaque JSON).
    public static func detail(category: String, params p: HamzahParams, wordKeys: HamzahDetail.WordKeys?) -> HamzahDetail {
        switch category {
        case "HAMZATAN_KALIMA":
            return .kalima(first: p.kalimaFirst ?? .tahqiq, second: p.kalimaSecond ?? .tasheel, idkhalAlif: p.kalimaIdkhal ?? false)
        case "HAMZATAN_KALIMATAYN":
            let first = p.kalimataynFirst ?? .tahqiq, second = p.kalimataynSecond ?? .tasheel
            return .kalimatayn(harakahRelation: p.kalimataynRelation ?? .mutafiqatan, firstTreatment: first, secondTreatment: second,
                               isqatFirst: first == .isqat, isqatSecond: second == .hadhf, ibdalMadd: second == .ibdal,
                               wordKeys: wordKeys)
        default:
            return .single(treatment: p.singleTreatment ?? .tasheel)
        }
    }

    public static func presets(for category: String) -> [Preset] {
        switch category {
        case "HAMZATAN_KALIMA":
            return [
                Preset(title: "أهل التسهيل مع الإدخال (قالون، أبو عمرو، هشام، أبو جعفر)", ids: kalimaTashilIdkhal) { $0.kalimaSecond = .tasheel; $0.kalimaIdkhal = true },
                Preset(title: "أهل التسهيل بدون إدخال (ورش، ابن كثير، رويس)", ids: kalimaTashilNoIdkhal) { $0.kalimaSecond = .tasheel; $0.kalimaIdkhal = false },
                Preset(title: "ورش (إبدال حرف مد)", ids: ["Q01-R02"]) { $0.kalimaSecond = .ibdal; $0.kalimaIdkhal = false },
                Preset(title: "أهل التحقيق (الكوفيون، ابن عامر، روح)", ids: kalimaTahqiq) { $0.kalimaSecond = .tahqiq; $0.kalimaIdkhal = false },
            ]
        case "HAMZATAN_KALIMATAYN":
            return [
                Preset(title: "أبو عمرو البصري (إسقاط الأولى وصلاً)", ids: kalimataynIsqatFirst) { $0.kalimataynFirst = .isqat; $0.kalimataynSecond = .tahqiq },
                Preset(title: "قالون والبزي (تسهيل / إسقاط الأولى وصلاً)", ids: kalimataynTashilFirst) { $0.kalimataynFirst = .tasheel; $0.kalimataynSecond = .tahqiq },
                Preset(title: "ورش وقنبل وأبو جعفر ورويس (تسهيل / إبدال الثانية وصلاً)", ids: kalimataynTashilSecond) { $0.kalimataynFirst = .tahqiq; $0.kalimataynSecond = .tasheel },
                Preset(title: "المحققون (الكوفيون وابن عامر وروح)", ids: kalimataynTahqiq) { $0.kalimataynFirst = .tahqiq; $0.kalimataynSecond = .tahqiq },
            ]
        default:
            return [
                Preset(title: "ورش (إبدال الفاء الساكنة)", ids: ["Q01-R02"]) { $0.singleTreatment = .ibdal },
                Preset(title: "أبو جعفر (إبدال الهمز الساكن ومفتوح بعد ضم)", ids: ["Q08-R01", "Q08-R02"]) { $0.singleTreatment = .ibdal },
                Preset(title: "السوسي عن أبي عمرو (إبدال الهمز الساكن)", ids: ["Q03-R02"]) { $0.singleTreatment = .ibdal },
                Preset(title: "حمزة (تغيير الهمز وقفاً)", ids: ["Q06-R01", "Q06-R02"]) { $0.singleTreatment = .tasheel; $0.performance = .waqfOnly },
            ]
        }
    }

    /// The ruling sentence the builder writes when the current one is empty or already about hamz.
    public static func updatedRulingText(current: String?, action: String) -> String? {
        let text = current.map(Arabic.trimJS) ?? ""
        let own = ["الهمز", "تسهيل", "تحقيق", "إبدال"].contains { jsIncludes(text, $0) }
        return text.isEmpty || own ? action : nil
    }
}

/// Adding a configured face to the selected narrators: one entry each, numbered after their latest wajh.
public enum FaceBuilder {
    public static func addFace(to narrators: [NarratorInput], ids: [String], action: String,
                               performance: FacePerformance, khulf: Khulf) -> [NarratorInput] {
        var current = narrators
        for id in ids {
            let existing = current.filter { $0.id == id }
            let wajhOrder = WajhOrder.next(current, for: id)
            var finalAction = action
            if existing.contains(where: { Arabic.trimJS($0.action ?? "") == Arabic.trimJS(finalAction) }) {
                finalAction = "\(finalAction) (وجه \(wajhOrder))"
            }
            let note: String? = khulf == .bikhulf ? "بخلف عنه" : performance == .waqfOnly ? "عند الوقف"
                : performance == .waslOnly ? "عند الوصل" : nil
            current.append(NarratorInput(id: id, action: finalAction, wajhOrder: wajhOrder,
                                         wajhNote: note ?? (id == CanonicalReaders.hafsId ? "وجه ثانٍ لحفص" : nil)))
        }
        return current
    }
}
