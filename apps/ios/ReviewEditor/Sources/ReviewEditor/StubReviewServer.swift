#if DEBUG
import Foundation
import MushafCore

/// An in-memory fake of the web review API for UI tests and the `-review-stub` launch argument: it builds
/// synthetic faces on the real Mushaf words of a page and applies the writes it receives, so the whole
/// review flow runs with no network and no real data. It never talks to the real database.
final class StubReviewServer: @unchecked Sendable {
    private let lock = NSLock()
    private let database: MushafDatabase
    private var pages: [Int: [ReviewRow]] = [:]
    private var undoneTransactions: Set<Int> = [82]
    private var counter = 1
    private var received: [String] = []

    init(database: MushafDatabase) { self.database = database }

    /// `action` of every write received, in order (UI tests assert on it through the launch environment).
    var actions: [String] { lock.withLock { received } }

    static let categories: [ReviewCategory] = [
        ("USUL_TAHQIQ", "تحقيق"), ("USUL_NAQL", "النقل"), ("USUL_IBDAL", "الإبدال"), ("SILAT_HA", "صلة هاء الكناية"),
        ("TARQIQ_RA", "ترقيق الراءات"), ("TAGHLIZ_LAM", "تغليظ اللامات"), ("MADD_BADAL", "مد البدل"),
        ("MADD_LIN", "مد اللين المهموز"), ("IMALAH_TAQLIL", "الممال والمقلل"), ("IDGHAM_SAGHIR", "المدغم الصغير"),
        ("IDGHAM_KABIR", "المدغم الكبير"), ("TAGHYIR_HAMZ", "تغيير الهمز"), ("HAMZATAN_KALIMA", "الهمزتان من كلمة"),
        ("HAMZATAN_KALIMATAYN", "الهمزتان من كلمتين"), ("TARK_GHUNNA", "ترك الغنة"), ("IKHFA", "الإخفاء"),
        ("WAQF_HAMZA", "وقف حمزة"), ("WAQF_RASM", "الوقف على مرسوم الخط"), ("YAAT_IDAFA", "ياءات الإضافة"),
        ("YAAT_ZAWAID", "ياءات الزوائد"), ("BAYN_SURATAYN", "الأوجه بين السورتين"),
        ("MADD_QABL_IDGHAM", "المد قبل الإدغام الكبير"), ("USUL_MADD", "أصول المد"), ("USUL_MIM_JAM", "ميم الجمع"),
        ("USUL_SAKT", "السكت"),
    ].map { ReviewCategory(code: $0.0, nameAr: $0.1) }

    func transport() -> StubReviewTransport { StubReviewTransport { [self] in handle($0) } }

    // MARK: Data

    private func words(_ number: Int) -> [ReviewWord] {
        guard let page = try? database.page(number) else { return [] }
        return page.lines.flatMap(\.words).compactMap { word in
            guard let key = ReviewWordKeys.key(for: word) else { return nil }
            return ReviewWord(key: key, surah: word.ayahKey.surah, ayah: word.ayahKey.ayah, word: word.indexInAyah,
                              line: word.line, text: word.textUthmani)
        }
    }

    private func catalog() -> [CatalogNarrator] {
        CanonicalReaders.all.flatMap { reader in
            [catalogEntry(reader.id, reader.nameAr, nil, .reader, reader.color)]
                + reader.narrators.map { catalogEntry($0.id, $0.nameAr, reader.id, .narrator, reader.color) }
        }
    }

    private func catalogEntry(_ id: String, _ name: String, _ parent: String?, _ type: CatalogNarrator.Kind, _ color: String) -> CatalogNarrator {
        CatalogNarrator(id: id, nameAr: name, parentId: parent, type: type, color: color)
    }

    private func makeRow(_ id: String, _ w: ReviewWord, endWord: Int? = nil, kind: ReadingKind, status: ReviewStatus,
                         page: Int, narrators: [String], category: String = "USUL_TAHQIQ") -> ReviewRow {
        let end = endWord ?? w.word
        counter += 1
        return ReviewRow(
            entryId: id, locationId: "l-\(id)", version: "v\(counter)", kind: kind,
            categoryCode: kind == .usul ? category : nil,
            categoryNameAr: kind == .usul ? Self.categories.first { $0.code == category }?.nameAr : nil,
            surah: w.surah, ayah: w.ayah, startWord: w.word, endAyah: w.ayah, endWord: end,
            startKey: w.key, endKey: ReviewWordKeys.key(surah: w.surah, ayah: w.ayah, word: end), page: page,
            hafsText: w.text, readingText: kind == .farsh ? w.text + "ٌ" : nil, variantType: kind == .farsh ? "vowel" : nil,
            reviewStatus: status, locationReviewStatus: status, verificationStatus: "REVIEWED", entryOrder: 1,
            narrators: narrators.map { ReviewNarrator(id: $0, nameAr: CanonicalReaders.narratorName($0) ?? $0, action: "أداء") })
    }

    /// Synthetic faces on the first words of the page: unreviewed usul, unreviewed farsh, reviewed usul and a
    /// flagged two-word face.
    private func seed(_ number: Int) -> [ReviewRow] {
        let w = words(number)
        guard w.count >= 6 else { return [] }
        return [
            makeRow("r-\(number)-1", w[0], kind: .usul, status: .unreviewed, page: number, narrators: ["Q06-R01", "Q06-R02"]),
            makeRow("r-\(number)-2", w[1], kind: .farsh, status: .unreviewed, page: number, narrators: ["Q01-R02"]),
            makeRow("r-\(number)-3", w[2], kind: .usul, status: .reviewed, page: number, narrators: ["Q08-R01", "Q08-R02"]),
            makeRow("r-\(number)-4", w[4], endWord: w[5].word, kind: .usul, status: .flagged, page: number, narrators: ["Q03-R02"]),
        ] + (w.count > 6 ? [makeRow("r-\(number)-5", w[6], kind: .usul, status: .unreviewed, page: number,
                                    narrators: ["Q06-R01"], category: "IMALAH_TAQLIL")] : [])
    }

    private func rows(_ number: Int) -> [ReviewRow] {
        if pages[number] == nil { pages[number] = seed(number) }
        return pages[number] ?? []
    }

    // MARK: Requests

    func handle(_ request: URLRequest) -> (status: Int, body: String) {
        lock.withLock {
            let encoder = JSONEncoder()
            func json<T: Encodable>(_ value: T) -> (Int, String) {
                (200, String(decoding: (try? encoder.encode(value)) ?? Data("null".utf8), as: UTF8.self))
            }
            let query = request.url?.query ?? ""
            if request.httpMethod == "GET" {
                if query.contains("overview=1") { return overview(json) }
                if query.contains("history=1") {
                    return (200, """
                    [{"txid":81,"at":"2026-10-05T10:00:00Z","deviceId":"review-stub-device","undone":\(undoneTransactions.contains(81)),
                      "changes":[{"table":"qiraat_entries","op":"UPDATE","field":"review_status","old":"unreviewed","new":"reviewed"}]},
                     {"txid":82,"at":"2026-10-05T09:00:00Z","deviceId":"review-stub-device","undone":true,
                      "changes":[{"table":"qiraat_entries","op":"INSERT"}]}]
                    """)
                }
                let number = query.split(separator: "&").compactMap { $0.hasPrefix("page=") ? Int($0.dropFirst(5)) : nil }.first ?? 1
                let live = rows(number)
                let page = ReviewPage(page: number, words: words(number), rows: live, stats: ReviewPageEditing.stats(for: live),
                                      narrators: catalog(), categories: Self.categories,
                                      variantTypes: VariantType.canonical.map(\.dbEnum))
                return json(page)
            }
            let body = (try? JSONSerialization.jsonObject(with: request.httpBody ?? Data()) as? [String: Any]) ?? [:]
            let action = body["action"] as? String ?? ""
            received.append(action)
            if request.httpMethod == "PATCH" { return patch(action, body, json) }
            return post(action, body, json)
        }
    }

    private func overview(_ json: (ReviewOverview) -> (Int, String)) -> (Int, String) {
        let progress = (1...12).map { number -> PageProgress in
            let live = rows(number).filter { $0.isActive }
            return PageProgress(page: number, total: live.count,
                                unreviewed: live.filter { $0.reviewStatus == .unreviewed }.count,
                                reviewed: live.filter { $0.reviewStatus == .reviewed }.count,
                                flagged: live.filter { $0.reviewStatus == .flagged }.count)
        }
        return json(ReviewOverview(isEditor: true, pages: progress))
    }

    private func locate(_ id: String) -> (page: Int, index: Int)? {
        for number in pages.keys.sorted() { if let index = pages[number]?.firstIndex(where: { $0.entryId == id }) { return (number, index) } }
        return nil
    }

    private func patch(_ action: String, _ body: [String: Any], _ json: (ReviewRow) -> (Int, String)) -> (Int, String) {
        guard let id = body["entryId"] as? String, let at = locate(id) else { return (404, #"{"error":"not_found"}"#) }
        var row = pages[at.page]![at.index]
        if let version = body["version"] as? String, version != row.version { return (409, #"{"error":"VERSION_CONFLICT"}"#) }
        switch action {
        case "status":
            let status = ReviewStatus(rawValue: body["status"] as? String ?? "") ?? row.reviewStatus
            row.reviewStatus = status
            row.locationReviewStatus = status
        case "delete": row.deleted = true
        case "restore": row.deleted = false
        case "narrators":
            let inputs = (body["narrators"] as? [[String: Any]]) ?? []
            row.narrators = inputs.map {
                let id = $0["id"] as? String ?? ""
                return ReviewNarrator(id: id, nameAr: CanonicalReaders.narratorName(id) ?? id, action: $0["action"] as? String,
                                      wajhOrder: $0["wajhOrder"] as? Int ?? 1, wajhNote: $0["wajhNote"] as? String)
            }
        case "update": apply(fields: body["fields"] as? [String: Any] ?? [:], to: &row)
        default: return (400, #"{"error":"bad_request"}"#)
        }
        counter += 1
        row.version = "v\(counter)"
        pages[at.page]![at.index] = row
        return json(row)
    }

    private func apply(fields: [String: Any], to row: inout ReviewRow) {
        func text(_ key: String) -> String?? { fields[key].map { ($0 as? String) } }
        if let kind = (fields["kind"] as? String).flatMap(ReadingKind.init(rawValue:)) { row.kind = kind }
        if let v = text("readingText") { row.readingText = v }
        if let v = text("description") { row.description = v }
        if let v = text("performanceNote") { row.performanceNote = v }
        if let v = text("variantType") { row.variantType = v }
        if let v = text("rulingText") { row.rulingText = v }
        if let v = text("categoryCode") {
            row.categoryCode = v
            row.categoryNameAr = Self.categories.first { $0.code == v }?.nameAr
        }
        if let v = fields["appliesWasl"] as? Bool { row.appliesWasl = v }
        if let v = fields["appliesWaqf"] as? Bool { row.appliesWaqf = v }
        if fields.keys.contains("hamzahDetail") {
            let object = fields["hamzahDetail"]
            row.hamzahDetail = (object is NSNull || object == nil) ? nil
                : (try? JSONSerialization.data(withJSONObject: object!)).flatMap { try? JSONDecoder().decode(HamzahDetail.self, from: $0) }
        }
    }

    private func bulkReply(_ object: Any) -> (Int, String) {
        guard let data = try? JSONSerialization.data(withJSONObject: object) else { return (500, #"{"error":"unavailable"}"#) }
        return (200, String(decoding: data, as: UTF8.self))
    }

    private func copy(_ body: [String: Any], _ json: (ReviewRow) -> (Int, String)) -> (Int, String) {
        guard let sourceId = body["sourceEntryId"] as? String,
              let source = sameWordSources[sourceId] ?? locate(sourceId).flatMap({ pages[$0.page]?[$0.index] }),
              let surah = body["surah"] as? Int, let ayah = body["ayah"] as? Int,
              let word = body["startWord"] as? Int else { return (400, #"{"error":"bad_request"}"#) }
        let entry = CreateEntryInput(surah: surah, ayah: ayah, startWord: word,
            endAyah: body["endAyah"] as? Int, endWord: body["endWord"] as? Int, kind: source.kind,
            readingText: source.readingText, uthmaniText: source.uthmaniText, description: source.description,
            performanceNote: source.performanceNote, variantType: source.variantType, categoryCode: source.categoryCode,
            rulingText: source.rulingText, narrators: source.narrators.map {
                NarratorInput(id: $0.id, action: $0.action, wajhOrder: $0.wajhOrder, wajhNote: $0.wajhNote)
            }, appliesWasl: source.appliesWasl, appliesWaqf: source.appliesWaqf, hamzahDetail: source.hamzahDetail)
        guard let data = try? JSONEncoder().encode(entry),
              let object = try? JSONSerialization.jsonObject(with: data) else { return (400, #"{"error":"bad_request"}"#) }
        return post("create", ["entry": object], json)
    }

    private var sameWordSources: [String: ReviewRow] = [:]

    private func post(_ action: String, _ body: [String: Any], _ json: (ReviewRow) -> (Int, String)) -> (Int, String) {
        switch action {
        case "create":
            guard let data = (body["entry"]).flatMap({ try? JSONSerialization.data(withJSONObject: $0) }),
                  let entry = try? JSONDecoder().decode(CreateEntryInput.self, from: data) else { return (400, #"{"error":"bad_request"}"#) }
            let number = ((try? database.page(of: AyahKey(surah: entry.surah, ayah: entry.ayah))) ?? nil) ?? 1
            var page = ReviewPage(page: number, words: words(number), rows: rows(number), stats: ReviewPageEditing.stats(for: rows(number)),
                                  narrators: catalog(), categories: Self.categories, variantTypes: [])
            counter += 1
            var row = ReviewPageEditing.placeholderRow(id: "r-new-\(counter)", for: entry, in: page)
            row.version = "v\(counter)"
            row.locationId = "l-new-\(counter)"
            row.entryOrder = rows(number).count + 1
            ReviewPageEditing.upsert(row, into: &page)
            pages[number] = page.rows
            return json(row)
        case "undo":
            guard let txid = body["txid"] as? Int, txid == 81, !undoneTransactions.contains(txid) else {
                return (409, #"{"error":"UNDO_REFUSED"}"#)
            }
            undoneTransactions.insert(txid)
            return (200, #"{"undone":1}"#)
        case "bulkDelete": return (200, #"{"deleted":[]}"#)
        case "suggest", "findSameWord":
            guard let surah = body["surah"] as? Int, let ayah = body["ayah"] as? Int,
                  let word = body["word"] as? Int,
                  let number = try? database.page(of: AyahKey(surah: surah, ayah: ayah)),
                  let first = words(number).first else { return (200, "[]") }
            if action == "suggest" {
                guard first.surah == surah, first.ayah == ayah, first.word == word else { return (200, "[]") }
                return bulkReply([["key": "stub-exact", "tier": "exact", "support": 2,
                                   "sourceEntryId": "stub-source", "sources": ["2:25:28"],
                                   "config": ["kind": "farsh", "readingText": first.text, "variantType": "vowel",
                                              "appliesWasl": true, "appliesWaqf": true,
                                              "narrators": [["id": "Q01-R02", "nameAr": "ورش عن نافع", "wajhOrder": 1]]]]])
            }
            let match = makeRow("same-word-\(number)", first, kind: .usul, status: .reviewed,
                                page: number, narrators: ["Q06-R01", "Q06-R02"])
            sameWordSources[match.entryId] = match
            let reply = json(match)
            return (reply.0, "[\(reply.1)]")
        case "copyEntry": return copy(body, json)
        case "findOccurrences":
            guard let id = body["entryId"] as? String, let at = locate(id) else { return (200, "[]") }
            let row = pages[at.page]![at.index]
            guard let other = words(at.page).first(where: { $0.key != row.startKey }) else { return (200, "[]") }
            return bulkReply([
                ["surah": row.surah, "ayah": row.ayah, "word": row.startWord, "page": at.page,
                 "canonicalKey": row.startKey, "text": row.hafsText, "status": "exists", "existingEntryId": id],
                ["surah": other.surah, "ayah": other.ayah, "word": other.word, "page": at.page,
                 "canonicalKey": other.key, "text": other.text, "status": "add"]
            ])
        case "bulkApply":
            guard let sourceId = body["sourceEntryId"] as? String, let at = locate(sourceId) else {
                return (404, #"{"error":"not_found"}"#)
            }
            let source = pages[at.page]![at.index]
            var added: [[String: Any]] = [], skipped: [[String: Any]] = [], errors: [[String: Any]] = []
            for target in body["targets"] as? [[String: Int]] ?? [] {
                guard let surah = target["surah"], let ayah = target["ayah"], let word = target["word"] else { continue }
                var result: [String: Any] = ["surah": surah, "ayah": ayah, "word": word]
                let existing = pages.values.flatMap { $0 }.first {
                    !$0.deleted && $0.surah == surah && $0.ayah == ayah && $0.startWord == word
                        && $0.kind == source.kind && $0.categoryCode == source.categoryCode && $0.narrators == source.narrators
                }
                if let existing {
                    result["existingEntryId"] = existing.entryId
                    skipped.append(result)
                } else {
                    let reply = copy(["sourceEntryId": sourceId, "surah": surah, "ayah": ayah, "startWord": word], json)
                    if reply.0 == 200, let row = try? JSONDecoder().decode(ReviewRow.self, from: Data(reply.1.utf8)) {
                        result["entryId"] = row.entryId
                        added.append(result)
                    } else {
                        result["message"] = "تعذر نسخ الوجه"
                        errors.append(result)
                    }
                }
            }
            return bulkReply(["sourceEntryId": sourceId, "added": added, "skipped": skipped, "errors": errors])
        default: return (400, #"{"error":"bad_request"}"#)
        }
    }
}
#endif
