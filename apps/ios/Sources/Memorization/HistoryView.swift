import Foundation
import MushafCore
import SwiftUI

/// Pure summary helper for finding the dominant status transition of a batch.
enum MemorizationHistorySummary {
    static func dominantTransition(events: [ChangeEvent]) -> (from: MemorizationStatus, to: MemorizationStatus)? {
        guard !events.isEmpty else { return nil }

        struct Pair: Hashable {
            let from: MemorizationStatus
            let to: MemorizationStatus
        }

        var counts: [Pair: Int] = [:]
        for event in events {
            let from = event.before?.status ?? .notMemorized
            let to = event.after.status
            counts[Pair(from: from, to: to), default: 0] += 1
        }

        var bestPair: Pair?
        var bestCount = -1

        for (pair, count) in counts {
            if count > bestCount {
                bestPair = pair
                bestCount = count
            } else if count == bestCount, let current = bestPair {
                if pair.from.rawValue < current.from.rawValue {
                    bestPair = pair
                } else if pair.from.rawValue == current.from.rawValue && pair.to.rawValue < current.to.rawValue {
                    bestPair = pair
                }
            }
        }

        guard let best = bestPair else { return nil }
        return (best.from, best.to)
    }
}

/// History screen showing previous update and review batches grouped by day, with undo capabilities.
struct HistoryView: View {
    let library: MushafLibrary
    let store: MemorizationStore
    let language: AppLanguage

    @State private var refreshTrigger = 0
    @State private var conflictState: ConflictState?
    @State private var errorMessage: String?

    private struct ConflictState: Identifiable {
        let id = UUID()
        let batchID: UUID
        let newer: [BatchRecord]
    }

    private struct DayBatches: Identifiable {
        let day: Date
        let indexedBatches: [(index: Int, batch: BatchRecord)]
        var id: Date { day }
    }

    /// Reading `refreshTrigger` makes the list reload after an undo.
    private func loadBatches() -> [BatchRecord] {
        _ = refreshTrigger
        return store.batches(limit: 200)
    }

    var body: some View {
        let batches = loadBatches()
        let groups = groupedBatches(batches)

        Group {
            if batches.isEmpty {
                emptyState
            } else {
                List {
                    ForEach(groups) { group in
                        Section {
                            ForEach(group.indexedBatches, id: \.batch.id) { item in
                                row(index: item.index, batch: item.batch)
                            }
                        } header: {
                            Text(verbatim: dayHeader(group.day))
                                .font(.subheadline.weight(.semibold))
                        }
                    }
                }
                .listStyle(.insetGrouped)
            }
        }
        .accessibilityIdentifier("memo-history")
        .navigationTitle(language == .arabic ? "آخر التحديثات" : "History")
        .navigationBarTitleDisplayMode(.inline)
        .alert(
            language == .arabic ? "توجد تغييرات أحدث" : "Newer changes exist",
            isPresented: Binding(get: { conflictState != nil }, set: { if !$0 { conflictState = nil } }),
            presenting: conflictState
        ) { state in
            Button(language == .arabic ? "تراجع على أي حال" : "Undo anyway", role: .destructive) {
                performUndo(batchID: state.batchID, force: true)
            }
            Button(language == .arabic ? "إلغاء" : "Cancel", role: .cancel) {
                conflictState = nil
            }
        } message: { state in
            let list = state.newer.map(\.label).joined(separator: "\n")
            Text(verbatim: list)
        }
        .alert(
            language == .arabic ? "خطأ" : "Error",
            isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })
        ) {
            Button(language == .arabic ? "حسناً" : "OK", role: .cancel) {
                errorMessage = nil
            }
        } message: {
            if let msg = errorMessage {
                Text(verbatim: msg)
            }
        }
    }

    // MARK: - Row

    private func row(index: Int, batch: BatchRecord) -> some View {
        let isUndone = batch.undoneAt != nil
        let isUndoable = !isUndone && (batch.kind == .update || batch.kind == .review)

        return HStack(alignment: .center, spacing: 10) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(verbatim: batch.label)
                        .font(.body.weight(.medium))
                        .strikethrough(isUndone, color: .secondary)
                        .foregroundStyle(isUndone ? .secondary : .primary)

                    if isUndone {
                        Text(verbatim: language == .arabic ? "تم التراجع" : "Undone")
                            .font(.caption2.weight(.medium))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Capsule().fill(Color.secondary.opacity(0.15)))
                            .foregroundStyle(.secondary)
                    }

                    if batch.kind == .review {
                        Text(verbatim: language == .arabic ? "مراجعة" : "Review")
                            .font(.caption2.weight(.medium))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Capsule().fill(Color.blue.opacity(0.15)))
                            .foregroundStyle(Color.blue)
                    } else if batch.kind == .undo {
                        Text(verbatim: language == .arabic ? "تراجع" : "Undo")
                            .font(.caption2.weight(.medium))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Capsule().fill(Color.orange.opacity(0.15)))
                            .foregroundStyle(Color.orange)
                    }
                }

                HStack(spacing: 6) {
                    let ayahText = language == .arabic
                        ? "\(MemorizationTheme.number(batch.ayahCount, language: language)) آية"
                        : "\(batch.ayahCount) ayat"
                    Text(verbatim: ayahText)
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    Text(verbatim: "·")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    Text(verbatim: batch.createdAt.formatted(date: .omitted, time: .shortened))
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    if let trans = transitionText(batch) {
                        Text(verbatim: "·")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text(verbatim: trans)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            Spacer()

            if isUndoable {
                Button {
                    performUndo(batchID: batch.id, force: false)
                } label: {
                    Text(verbatim: language == .arabic ? "تراجع" : "Undo")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Color.red)
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
                .accessibilityIdentifier("memo-history-undo-\(index)")
            }
        }
        .padding(.vertical, 2)
        .accessibilityIdentifier("memo-history-row-\(index)")
    }

    // MARK: - Actions

    private func performUndo(batchID: UUID, force: Bool) {
        do {
            try store.undo(batchID: batchID, force: force)
            refreshTrigger += 1
        } catch let error as MemorizationError {
            switch error {
            case let .hasNewerChanges(newer):
                conflictState = ConflictState(batchID: batchID, newer: newer)
            default:
                errorMessage = error.localizedDescription
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Helpers

    private func transitionText(_ batch: BatchRecord) -> String? {
        let events = store.events(batchID: batch.id)
        guard let transition = MemorizationHistorySummary.dominantTransition(events: events) else { return nil }
        let from = MemorizationTheme.label(transition.from, language: language)
        let to = MemorizationTheme.label(transition.to, language: language)
        return language == .arabic ? "\(from) ← \(to)" : "\(from) → \(to)"
    }

    private func dayHeader(_ date: Date) -> String {
        let calendar = Calendar.current
        if calendar.isDateInToday(date) {
            return language == .arabic ? "اليوم" : "Today"
        } else if calendar.isDateInYesterday(date) {
            return language == .arabic ? "أمس" : "Yesterday"
        } else {
            return date.formatted(date: .abbreviated, time: .omitted)
        }
    }

    private func groupedBatches(_ batches: [BatchRecord]) -> [DayBatches] {
        var groups: [DayBatches] = []
        let calendar = Calendar.current
        var currentDay: Date?
        var currentList: [(index: Int, batch: BatchRecord)] = []

        for (index, batch) in batches.enumerated() {
            let day = calendar.startOfDay(for: batch.createdAt)
            if let curr = currentDay, curr == day {
                currentList.append((index, batch))
            } else {
                if let curr = currentDay {
                    groups.append(DayBatches(day: curr, indexedBatches: currentList))
                }
                currentDay = day
                currentList = [(index, batch)]
            }
        }
        if let curr = currentDay {
            groups.append(DayBatches(day: curr, indexedBatches: currentList))
        }
        return groups
    }

    private var emptyState: some View {
        ContentUnavailableView {
            Label(language == .arabic ? "لا توجد تحديثات" : "No history", systemImage: "clock")
        } description: {
            Text(verbatim: language == .arabic ? "لا توجد دفعات تحديث سابقة." : "No previous updates recorded.")
        }
    }
}
