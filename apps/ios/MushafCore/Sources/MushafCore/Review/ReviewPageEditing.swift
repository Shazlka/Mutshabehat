#if DEBUG
import Foundation

/// Optimistic edits of a review page (ports of the web's `pageStats`, `buildTempRow`, `applyFieldsToRow`).
/// A save shows its result at once and finishes in the background; these build the row the reviewer sees
/// meanwhile. The server's row replaces it when the request returns.
public enum ReviewPageEditing {
    public static let placeholderPrefix = "tmp-"

    public static func isPlaceholder(_ row: ReviewRow) -> Bool { row.entryId.hasPrefix(placeholderPrefix) }

    public static func stats(for rows: [ReviewRow]) -> PageStats {
        let live = rows.filter { !$0.deleted }
        return PageStats(
            total: live.count,
            unreviewed: live.filter { $0.reviewStatus == .unreviewed }.count,
            reviewed: live.filter { $0.reviewStatus == .reviewed }.count,
            flagged: live.filter { $0.reviewStatus == .flagged }.count,
            deleted: rows.count - live.count)
    }

    /// Replaces the row with the same id (or the placeholder it stands for), else appends; refreshes stats.
    public static func upsert(_ row: ReviewRow, replacing placeholderId: String? = nil, into page: inout ReviewPage) {
        let index = placeholderId.flatMap { id in page.rows.firstIndex { $0.entryId == id } }
            ?? page.rows.firstIndex { $0.entryId == row.entryId }
        if let index { page.rows[index] = row } else { page.rows.append(row) }
        page.stats = stats(for: page.rows)
    }

    public static func remove(entryId: String, from page: inout ReviewPage) {
        page.rows.removeAll { $0.entryId == entryId }
        page.stats = stats(for: page.rows)
    }

    static func reviewNarrators(_ inputs: [NarratorInput], catalog: [CatalogNarrator]) -> [ReviewNarrator] {
        inputs.map { input in
            let known = catalog.first { $0.id == input.id }
            return ReviewNarrator(id: input.id, code: known?.code,
                                  nameAr: known?.nameAr ?? CanonicalReaders.narratorName(input.id) ?? input.id,
                                  action: input.action, wajhOrder: input.wajhOrder ?? 1, wajhNote: input.wajhNote)
        }
    }

    public static func placeholderRow(id: String, for entry: CreateEntryInput, in page: ReviewPage) -> ReviewRow {
        let endAyah = entry.endAyah ?? entry.ayah
        let endWord = entry.endWord ?? entry.startWord
        let startKey = ReviewWordKeys.key(surah: entry.surah, ayah: entry.ayah, word: entry.startWord)
        let endKey = ReviewWordKeys.key(surah: entry.surah, ayah: endAyah, word: endWord)
        let hafsText = page.words.filter { $0.key >= startKey && $0.key <= endKey }.map(\.text).joined(separator: " ")
        return ReviewRow(
            entryId: id, kind: entry.kind, categoryCode: entry.categoryCode,
            categoryNameAr: page.categories.first { $0.code == entry.categoryCode }?.nameAr,
            surah: entry.surah, ayah: entry.ayah, startWord: entry.startWord, endAyah: endAyah, endWord: endWord,
            startKey: startKey, endKey: endKey, page: page.page, hafsText: hafsText,
            readingText: entry.readingText, uthmaniText: entry.uthmaniText, description: entry.description,
            performanceNote: entry.performanceNote, variantType: entry.variantType, rulingText: entry.rulingText,
            notes: entry.notes, verificationStatus: "REVIEWED", entryOrder: 9999,
            appliesWasl: entry.appliesWasl ?? true, appliesWaqf: entry.appliesWaqf ?? true,
            hamzahDetail: entry.hamzahDetail, narrators: reviewNarrators(entry.narrators, catalog: page.narrators))
    }

    /// The row as it will look once `fields` and `narrators` are saved (the server assigns the new version).
    public static func applying(_ fields: EntryFields, narrators: [NarratorInput], to row: ReviewRow,
                                in page: ReviewPage) -> ReviewRow {
        var next = row
        next.narrators = reviewNarrators(narrators, catalog: page.narrators)
        if case .set(let value?) = fields.kind { next.kind = value }
        if case .set(let value) = fields.readingText { next.readingText = value }
        if case .set(let value) = fields.uthmaniText { next.uthmaniText = value }
        if case .set(let value) = fields.description { next.description = value }
        if case .set(let value) = fields.performanceNote { next.performanceNote = value }
        if case .set(let value) = fields.variantType { next.variantType = value }
        if case .set(let value) = fields.rulingText { next.rulingText = value }
        if case .set(let value?) = fields.appliesWasl { next.appliesWasl = value }
        if case .set(let value?) = fields.appliesWaqf { next.appliesWaqf = value }
        if case .set(let value) = fields.hamzahDetail { next.hamzahDetail = value }
        if case .set(let value) = fields.categoryCode {
            next.categoryCode = value
            next.categoryNameAr = page.categories.first { $0.code == value }?.nameAr ?? row.categoryNameAr
        }
        return next
    }
}
#endif
