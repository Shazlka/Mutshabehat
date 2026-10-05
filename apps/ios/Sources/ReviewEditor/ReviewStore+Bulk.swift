#if DEBUG
import Foundation
import MushafCore

extension ReviewStore {
    /// A selection change must invalidate both completed previews and replies still in flight.
    func resetBulkSelection() {
        suggestionsTask?.cancel()
        suggestionRequest = UUID()
        suggestions = []
        addedSuggestionKeys = []
        sameWordRequest = UUID()
        sameWordKey = nil
        sameWordRow = nil
        sameWordMatches = []
        sameWordState = .idle
        previewMatch = nil
        occurrenceRequest = UUID()
        occurrenceSourceId = nil
        occurrences = []
        selectedOccurrences = []
        occurrencesState = .idle
        lastBulkResult = nil
    }

    func loadSuggestions() {
        suggestionsTask?.cancel()
        suggestionRequest = UUID()
        suggestions = []
        guard spanEndKey == nil, let key = selectedKey, let word = word(forKey: key) else { return }
        let request = suggestionRequest
        suggestionsTask = Task { [weak self, api] in
            do { try await Task.sleep(for: .milliseconds(250)) } catch { return }
            guard !Task.isCancelled else { return }
            let result = await api.suggestions(surah: word.surah, ayah: word.ayah, word: word.word)
            guard let self, !Task.isCancelled, suggestionRequest == request, selectedKey == key, spanEndKey == nil else { return }
            switch result {
            case .success(let list): suggestions = list.filter { !addedSuggestionKeys.contains($0.key) }
            case .failure(let error): notice = error.messageAr
            }
        }
    }

    func addSuggestion(_ suggestion: ReviewSuggestion) {
        guard let page, spanEndKey == nil, let key = selectedKey, let word = word(forKey: key),
              suggestions.contains(where: { $0.key == suggestion.key }), !addedSuggestionKeys.contains(suggestion.key),
              !SuggestionLogic.isBlocked(suggestion, wordRows: rows(forKey: key)) else { return }
        let entry = SuggestionLogic.createInput(for: suggestion, surah: word.surah, ayah: word.ayah, startWord: word.word)
        let id = nextTempId()
        let placeholder = ReviewPageEditing.placeholderRow(id: id, for: entry, in: page)
        let plan = SaveJobPlan(label: "إضافة مقترح", chainKey: "loc:\(word.surah):\(word.ayah):\(word.word)", steps: [.create(entry)])
        submit(plan, row: nil, placeholderId: id, onFail: { [weak self] in
            guard let self, selectedKey == key, spanEndKey == nil else { return }
            addedSuggestionKeys.remove(suggestion.key)
            if !suggestions.contains(where: { $0.key == suggestion.key }) { suggestions.append(suggestion) }
        }) { [weak self] in
            guard let self else { return }
            if selectedKey == key {
                addedSuggestionKeys.insert(suggestion.key)
                suggestions.removeAll { $0.key == suggestion.key }
            }
            if pageNumber == page.page { upsert(placeholder) }
        }
    }

    var visibleSameWordMatches: [ReviewRow] {
        sameWordVerifiedOnly ? SameWordLogic.verifiedSameCategory(matches: sameWordMatches, for: sameWordRow) : sameWordMatches
    }

    func loadSameWord(verifiedOnly: Bool) async {
        sameWordVerifiedOnly = verifiedOnly
        previewMatch = nil
        sameWordMatches = []
        sameWordRequest = UUID()
        guard let key = selectedKey, let word = word(forKey: key) else { return }
        // Use the explicit edit session when present; otherwise the first displayed face is the context.
        var row = session?.rowId.flatMap { id in page?.rows.first { $0.entryId == id } }
        if let session {
            if row == nil, let entry = session.newEntry, let page {
                row = ReviewPageEditing.placeholderRow(id: "same-word-draft", for: entry, in: page)
            }
            row?.kind = session.draft.kind
            row?.categoryCode = session.draft.categoryCode
        } else { row = rows(forKey: key).first }
        sameWordRow = row
        sameWordKey = key
        let request = sameWordRequest
        sameWordState = .loading
        let result = await api.findSameWord(surah: word.surah, ayah: word.ayah, word: word.word, excludeLocusId: row?.locationId)
        guard sameWordRequest == request, selectedKey == key else { return }
        switch result {
        case .success(let matches): sameWordMatches = matches; sameWordState = .idle
        case .failure(let error): sameWordState = .failed(error.messageAr); notice = error.messageAr
        }
    }

    /// Only the preview's confirmation button calls this. The API creates an independent unreviewed row.
    @discardableResult
    func confirmCopy() async -> Bool {
        guard !copying, let previewMatch, visibleSameWordMatches.contains(where: { $0.entryId == previewMatch.entryId }),
              let key = selectedKey, sameWordKey == key, let word = word(forKey: key) else { return false }
        let targetPage = pageNumber
        let request = sameWordRequest
        copying = true
        defer { copying = false }
        notice = nil
        switch await api.copyEntry(sourceEntryId: previewMatch.entryId, surah: word.surah, ayah: word.ayah, startWord: word.word) {
        case .success(let row):
            if pageNumber == targetPage { upsert(row) }
            if sameWordRequest == request { self.previewMatch = nil }
            liveRefresh(targetPage)
            return true
        case .failure(let error): notice = error.messageAr; return false
        }
    }

    func loadOccurrences(for row: ReviewRow) async {
        guard canEdit(row), !applyingOccurrences else { return }
        occurrenceRequest = UUID()
        let request = occurrenceRequest
        occurrenceSourceId = row.entryId
        occurrences = []
        selectedOccurrences = []
        lastBulkResult = nil
        occurrencesState = .loading
        let result = await api.findOccurrences(entryId: row.entryId)
        guard occurrenceRequest == request else { return }
        switch result {
        case .success(let list):
            occurrences = list
            selectedOccurrences = Set(list.filter { $0.status == .add }.map(\.canonicalKey))
            occurrencesState = .idle
        case .failure(let error): occurrencesState = .failed(error.messageAr); notice = error.messageAr
        }
    }

    func applyToSelected(sourceEntryId: String) async {
        guard !applyingOccurrences, sourceEntryId == occurrenceSourceId else { return }
        let targets = occurrences.filter { $0.status == .add && selectedOccurrences.contains($0.canonicalKey) }
            .map { (surah: $0.surah, ayah: $0.ayah, word: $0.word) }
        guard !targets.isEmpty else { return }
        let request = occurrenceRequest
        let targetPage = pageNumber
        applyingOccurrences = true
        defer { applyingOccurrences = false }
        notice = nil
        switch await api.bulkApply(sourceEntryId: sourceEntryId, targets: targets) {
        case .success(let result):
            if occurrenceRequest == request {
                lastBulkResult = result
                // A second tap cannot resubmit the just-applied selection.
                selectedOccurrences = []
            }
            await reloadSilent()
            liveRefresh(targetPage)
        case .failure(let error): notice = error.messageAr
        }
    }
}
#endif
