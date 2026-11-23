#if DEBUG
import Foundation
import MushafCore
import SwiftUI

/// Editing a face: the draft, the guard against losing edits, saving (and approving) it, and adding a
/// reference group to it.
extension ReviewStore {
    // MARK: Session

    var hasUnsavedEdits: Bool {
        guard let session else { return false }
        return ReviewDraft.isDirty(original: session.original, current: session.draft)
    }

    func startEditing(_ row: ReviewRow) {
        guard canEdit(row) else { return }
        let fields = ReviewDraft.fields(from: row)
        session = EditSession(draft: fields, original: fields, rowId: row.entryId, newEntry: nil)
        pendingSuggestion = nil
    }

    /// A new face for the selected word (or the two-word span), starting from the Hafs text with no narrators.
    func startNewDraft() {
        guard let page, let key = selectedKey, let first = page.words.first(where: { $0.key == key }) else { return }
        var start = first, end = first
        if let spanKey = spanEndKey, let other = page.words.first(where: { $0.key == spanKey }) {
            (start, end) = first.key <= other.key ? (first, other) : (other, first)
        }
        let text = start.key == end.key ? start.text : "\(start.text) \(end.text)"
        let entry = CreateEntryInput(surah: start.surah, ayah: start.ayah, startWord: start.word,
                                     endAyah: end.ayah, endWord: end.word, kind: .farsh,
                                     readingText: text, uthmaniText: text, narrators: [])
        let fields = ReviewDraft.fields(from: entry)
        session = EditSession(draft: fields, original: fields, rowId: nil, newEntry: entry)
        pendingSuggestion = nil
    }

    func updateDraft(_ change: (inout ReviewDraftFields) -> Void) {
        guard var current = session else { return }
        change(&current.draft)
        session = current
    }

    /// A two-way binding to one field of the open draft (reads a default when no draft is open).
    func draftBinding<T>(_ keyPath: WritableKeyPath<ReviewDraftFields, T>, default fallback: T) -> Binding<T> {
        Binding(get: { self.session?.draft[keyPath: keyPath] ?? fallback },
                set: { value in self.updateDraft { $0[keyPath: keyPath] = value } })
    }

    func discardDraft() {
        session = nil
        pendingSuggestion = nil
    }

    // MARK: Guarded moves

    var hasPendingConfirmation: Bool { pendingSelection != nil || pendingPage != nil || pendingClose }

    func requestSelect(key: String?, extendingSpan: Bool = false) {
        if extendingSpan { select(key: key, extendingSpan: true); return }
        if hasUnsavedEdits && key != selectedKey {
            if let key { pendingSelection = key } else { pendingClose = true }
            return
        }
        select(key: key)
    }

    func requestPage(_ number: Int) {
        if hasUnsavedEdits { pendingPage = number; return }
        Task { await load(page: number) }
    }

    func confirmPendingSelection() {
        let word = pendingSelection, page = pendingPage, close = pendingClose
        cancelPendingSelection()
        discardDraft()
        if let word { select(key: word) }
        else if close { select(key: nil) }
        else if let page { Task { await load(page: page) } }
    }

    func cancelPendingSelection() {
        pendingSelection = nil
        pendingPage = nil
        pendingClose = false
    }

    // MARK: Saving

    /// Saves the draft (and approves it when asked) as queued jobs: the page updates at once, the requests
    /// run in the background. Returns false, with a message, when the draft is not valid.
    @discardableResult
    func saveDraft(approve: Bool) -> Bool {
        guard let session, let page else { return false }
        if let issue = ReviewDraft.validate(session.draft) { notice = issue.messageAr; return false }
        let row = session.rowId.flatMap { id in page.rows.first { $0.entryId == id } }
        if session.rowId != nil, row == nil { notice = "لم يعد هذا الوجه موجودًا — أعد تحميل الصفحة"; return false }
        if let row, !canEdit(row) { return false }

        let plans = ReviewDraft.savePlan(draft: session.draft, original: session.original, row: row,
                                         newEntry: session.newEntry, approve: approve)
        let draft = session.draft
        for (index, plan) in plans.enumerated() {
            if case .create(let entry)? = plan.steps.first {
                let tempId = nextTempId()
                var temp = ReviewPageEditing.placeholderRow(id: tempId, for: entry, in: page)
                if approve && index == 0 { temp.reviewStatus = .reviewed; temp.locationReviewStatus = .reviewed }
                // If the create fails the reviewer gets the inputs back, as long as they are still on this word.
                let snapshot = EditSession(draft: session.draft, original: session.original, rowId: nil, newEntry: session.newEntry)
                let wordKey = selectedKey
                submit(plan, row: nil, placeholderId: tempId, onFail: { [weak self] in
                    guard let self, index == 0, selectedKey == wordKey, self.session == nil else { return }
                    self.session = snapshot
                }) { [weak self] in self?.upsert(temp) }
            } else if let row {
                var optimistic = ReviewPageEditing.applying(ReviewDraft.entryFields(draft), narrators: draft.narrators, to: row, in: page)
                if approve { optimistic.reviewStatus = .reviewed; optimistic.locationReviewStatus = .reviewed }
                submit(plan, row: row) { [weak self] in self?.upsert(optimistic) }
            }
        }
        self.session = nil
        pendingSuggestion = nil
        if approve { advanceAfterApproval() }
        return true
    }

    /// Approves every face of the selected word that is not reviewed yet, then moves on.
    func approveAllForSelectedWord() {
        for row in selectedKey.map(rows(forKey:)) ?? [] where row.reviewStatus != .reviewed { approve(row) }
        advanceAfterApproval()
    }

    /// After an approval: on to the next face waiting for review, or close the sheet when the page is done.
    func advanceAfterApproval() {
        if let next = nextReviewKey(after: selectedKey) {
            select(key: next)
        } else {
            select(key: nil)
            notice = "انتهت مراجعة هذه الصفحة"
        }
    }

    // MARK: References

    func decision(for group: ReferenceGroup) -> ReferenceDecision {
        ReferenceDecider.propose(narratorIds: group.narratorIds, rows: selectedKey.map(rows(forKey:)) ?? [])
    }

    func isInDraft(_ group: ReferenceGroup) -> Bool {
        guard let session else { return false }
        return ReferenceDecider.isGroupInDraft(narratorIds: group.narratorIds, draftNarratorIds: session.draft.narrators.map(\.id))
    }

    /// ➕ on a reference group: adds its narrators (with the description as «الأداء») to the open draft,
    /// starting a new draft first when none is open. Nothing is saved until the reviewer saves.
    func applyReference(_ group: ReferenceGroup, source: ReferenceSource) {
        if session == nil { startNewDraft() }
        guard let current = session else { return }
        let others = (selectedKey.map(rows(forKey:)) ?? []).filter { $0.kind == .farsh && $0.entryId != current.rowId }
            .flatMap { row in row.narrators.map { ApplyContext.FarshNarrator(id: $0.id, wajhOrder: $0.wajhOrder) } }
        let context = ApplyContext(
            narrators: current.draft.narrators, readingText: current.draft.readingText,
            defaultReadingText: current.newEntry?.readingText ?? "", kind: current.draft.kind,
            categoryCode: current.draft.categoryCode,
            isFreshDraft: current.newEntry != nil && current.draft.narrators.isEmpty, otherFarshNarrators: others)
        let plan = ReferenceApply.plan(source: source, group: group, context: context)
        updateDraft { draft in
            draft.narrators = plan.narrators
            if let reading = plan.readingText { draft.readingText = reading }
            if let kind = plan.kind { draft.kind = kind }
            if let wasl = plan.appliesWasl { draft.appliesWasl = wasl }
            if let waqf = plan.appliesWaqf { draft.appliesWaqf = waqf }
            if let code = plan.categoryCode { draft.categoryCode = code }
        }
        pendingSuggestion = plan.pendingSuggestion
    }

    /// Taps the leftover suggestion chip: applies its kind and (for أصول) its باب.
    func applyPendingSuggestion() {
        guard let suggestion = pendingSuggestion else { return }
        updateDraft { draft in
            draft.kind = suggestion.kind
            if suggestion.kind == .usul, let code = suggestion.categoryCode { draft.categoryCode = code }
        }
        pendingSuggestion = nil
    }
}
#endif
