#if DEBUG
import MushafCore
import SwiftUI

struct ReviewHistoryView: View {
    @Bindable var store: ReviewStore
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                if case .loading = store.historyState {
                    ProgressView("جارٍ تحميل السجل…")
                }
                if case .failed(let message) = store.historyState {
                    Section {
                        Text(message).foregroundStyle(.secondary)
                        Button("إعادة المحاولة") { Task { await store.loadHistory() } }
                    } header: { Text("تعذّر تحميل السجل") }
                }
                if store.history.isEmpty && store.historyState == .idle {
                    ContentUnavailableView("لا توجد تعديلات مسجلة على هذه الصفحة بعد", systemImage: "clock.arrow.circlepath")
                }
                ForEach(store.history) { tx in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(HistorySummary.title(tx)).font(.headline)
                        Text(timestamp(tx.at)).font(.caption).foregroundStyle(.secondary)
                        Text("جهاز \(tx.deviceId.map { String($0.prefix(8)) } ?? "—")")
                            .font(.caption).foregroundStyle(.secondary)
                        ForEach(Array(HistorySummary.details(tx).dropFirst().enumerated()), id: \.offset) { _, detail in
                            Text(detail).font(.subheadline).foregroundStyle(.secondary)
                        }
                        if tx.undone { Text("تم التراجع").font(.caption).foregroundStyle(.secondary) }
                        Button("تراجع") { Task { await store.undo(tx) } }
                            .disabled(tx.undone || store.undoingTransaction != nil)
                            .accessibilityIdentifier("review-history-undo-\(tx.txid)")
                    }
                    .padding(.vertical, 4)
                }
            }
            .navigationTitle("سجل التعديلات — صفحة \(store.pageNumber)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("إغلاق") { dismiss() } } }
            .refreshable { await store.loadHistory() }
            .task(id: store.pageNumber) { await store.loadHistory() }
            .alert("تعذّر التراجع", isPresented: Binding(get: { store.notice != nil }, set: { if !$0 { store.notice = nil } })) {
                Button("حسنًا") { store.notice = nil }
            } message: { Text(store.notice ?? "") }
        }
        .environment(\.layoutDirection, .rightToLeft)
    }

    private func timestamp(_ text: String) -> String {
        let parser = ISO8601DateFormatter()
        parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let fractional = parser.date(from: text)
        parser.formatOptions = [.withInternetDateTime]
        guard let date = fractional ?? parser.date(from: text) else { return text }
        return date.formatted(.dateTime.locale(Locale(identifier: "ar")).day().month().year().hour().minute())
    }
}
#endif
