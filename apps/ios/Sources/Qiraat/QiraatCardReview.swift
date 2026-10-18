#if DEBUG
import MushafCore
import SwiftUI

/// Keeps the one review store the word cards use alive for as long as the reader is: a save that is still
/// running when a card is closed must not be dropped with the card.
@MainActor
final class QiraatCardReviewHost {
    private var store: ReviewStore?

    func store(library: MushafLibrary) -> ReviewStore {
        if let store { return store }
        let created = ReviewEditorEntry.makeStore(library: library)
        store = created
        return created
    }
}

private struct QiraatCardReviewStoreKey: EnvironmentKey {
    nonisolated(unsafe) static let defaultValue: ReviewStore? = nil
}

extension EnvironmentValues {
    /// Set by the reader (DEBUG builds only); the word card shows its review section when it is present.
    var qiraatCardReviewStore: ReviewStore? {
        get { self[QiraatCardReviewStoreKey.self] }
        set { self[QiraatCardReviewStoreKey.self] = newValue }
    }
}

/// The review section of the word card: the faces recorded for this word with their review status, and the
/// actions that used to need a trip to the editor: approve, edit, delete, add a face. It works on the same
/// review store and web review API as the developer editor, so the server's rules and edit log apply, and a
/// saved change reaches the Mushaf page through `QiraatLiveSync` like any other.
struct QiraatCardReviewSection: View {
    @Environment(\.qiraatCardReviewStore) private var store: ReviewStore?
    let word: MushafWord

    var body: some View {
        if let store { Content(store: store, word: word) }
    }

    private struct Content: View {
        let store: ReviewStore
        let word: MushafWord

        @State private var editorOpen = false
        @State private var editorStep: ReviewWordSheet.Step = .faces
        @State private var deleting: ReviewRow?

        private var key: String? { ReviewWordKeys.key(for: word) }
        private var rows: [ReviewRow] { key.map(store.rows(forKey:)) ?? [] }
        private var waiting: [ReviewRow] { rows.filter { $0.reviewStatus != .reviewed } }
        /// The test runs that must never reach the live review API (the stub is the only allowed transport).
        private var blocked: Bool {
            ProcessInfo.processInfo.environment["QIRAAT_TEST_ISOLATION"] == "1" && !ReviewEditorEntry.usesStub
        }

        var body: some View {
            if key != nil, !blocked {
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Label("المراجعة والتحرير", systemImage: "checkmark.seal")
                            .font(.subheadline.bold()).foregroundStyle(Color(uiColor: .mushafBrown))
                            .accessibilityAddTraits(.isHeader)
                        Spacer()
                        if waiting.count > 1 {
                            Button { store.approveAllForSelectedWordKey(key) } label: {
                                Label("اعتماد الكل (\(waiting.count))", systemImage: "checkmark.seal.fill").font(.footnote.bold())
                            }
                            .buttonStyle(.borderedProminent).tint(.green).controlSize(.small)
                            .accessibilityIdentifier("qiraat-card-approve-all")
                        }
                    }
                    content
                    ReviewSaveStatusBar(store: store)
                }
                .padding(12)
                .background(Color(uiColor: .secondarySystemBackground).opacity(0.7), in: RoundedRectangle(cornerRadius: 12))
                .accessibilityElement(children: .contain)
                .accessibilityIdentifier("qiraat-card-review")
                .task(id: word.id) { await ensureLoaded() }
                .sheet(isPresented: $editorOpen, onDismiss: { store.requestSelect(key: nil) }) {
                    ReviewWordSheet(store: store, initialStep: editorStep)
                        .presentationDetents([.medium, .large])
                        .presentationDragIndicator(.visible)
                        .environment(\.layoutDirection, .rightToLeft)
                }
                .onChange(of: store.selectedKey) { _, new in if new == nil { editorOpen = false } }
                .confirmationDialog("حذف هذا الوجه؟", isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }),
                                    titleVisibility: .visible, presenting: deleting) { row in
                    Button("حذف", role: .destructive) { store.delete(row) }
                        .accessibilityIdentifier("qiraat-card-confirm-delete")
                } message: { row in
                    Text("«\(FacesSummary.label(for: row))» — يمكنك التراجع بعد الحذف.")
                }
            }
        }

        @ViewBuilder private var content: some View {
            if store.page == nil || store.pageNumber != word.page {
                switch store.loadState {
                case .failed(let message):
                    VStack(alignment: .leading, spacing: 6) {
                        Label("تعذّر تحميل أوجه الصفحة", systemImage: "wifi.exclamationmark").font(.footnote.bold())
                        Text(message).font(.caption).foregroundStyle(.secondary)
                        Button("إعادة المحاولة") { Task { await ensureLoaded(force: true) } }
                            .buttonStyle(.bordered).controlSize(.small)
                    }
                default:
                    ProgressView("جارٍ تحميل حالة المراجعة…").font(.footnote)
                }
            } else {
                if let deleted = store.lastDeleted, deleted.startKey <= (key ?? ""), (key ?? "") <= deleted.endKey {
                    HStack {
                        Label("حُذف وجه", systemImage: "trash").font(.footnote).foregroundStyle(.secondary)
                        Spacer()
                        Button("تراجع") { store.restore(deleted) }.buttonStyle(.borderedProminent).controlSize(.small)
                            .accessibilityIdentifier("qiraat-card-undo-delete")
                    }
                }
                if rows.isEmpty {
                    Text("لا وجه مسجّل لهذه الكلمة في قاعدة المراجعة.")
                        .font(.footnote).foregroundStyle(.secondary)
                }
                ForEach(rows) { row in
                    FaceCard(row: row, store: store,
                             approve: { store.approve(row) },
                             edit: { open(row) },
                             delete: { deleting = row })
                }
                Button { openNew() } label: { Label("وجه جديد", systemImage: "plus.circle.fill").frame(maxWidth: .infinity) }
                    .buttonStyle(.bordered)
                    .accessibilityIdentifier("qiraat-card-new-face")
            }
        }

        private func ensureLoaded(force: Bool = false) async {
            if !force, store.page != nil, store.pageNumber == word.page { return }
            await store.load(page: word.page)
        }

        private func open(_ row: ReviewRow) {
            guard let key, store.canEdit(row) else { return }
            store.requestSelect(key: key)
            store.startEditing(row)
            editorStep = .edit
            editorOpen = true
        }

        private func openNew() {
            guard let key else { return }
            store.requestSelect(key: key)
            store.startNewDraft()
            editorStep = .edit
            editorOpen = true
        }
    }

    /// One recorded face with its status and the three quick actions.
    private struct FaceCard: View {
        let row: ReviewRow
        let store: ReviewStore
        let approve: () -> Void
        let edit: () -> Void
        let delete: () -> Void

        private var status: (label: String, color: Color, symbol: String) {
            switch row.reviewStatus {
            case .reviewed: ("معتمد", .green, "checkmark.circle.fill")
            case .unreviewed: ("بانتظار الاعتماد", .orange, "circle.dashed")
            case .flagged: ("معلَّم", .red, "flag.fill")
            }
        }

        private var chips: [NarratorDisplayItem] {
            NarratorDisplay.describe(row.narrators.map { NarratorRef(id: $0.id, nameAr: $0.nameAr) })
        }

        var body: some View {
            let saving = ReviewPageEditing.isPlaceholder(row)
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 8) {
                    Text(row.kind == .usul ? "أصول" : "فرش").font(.caption2.weight(.bold))
                        .padding(.horizontal, 7).padding(.vertical, 2)
                        .background(Color.accentColor.opacity(0.14), in: Capsule())
                    Text(FacesSummary.label(for: row)).font(.headline).lineLimit(2)
                    if row.endKey != row.startKey { Text("مع الكلمة التالية").font(.caption).foregroundStyle(.secondary) }
                    Spacer(minLength: 4)
                    Label(saving ? "جارٍ الحفظ…" : status.label, systemImage: saving ? "arrow.triangle.2.circlepath" : status.symbol)
                        .font(.caption.weight(.semibold)).foregroundStyle(saving ? Color.secondary : status.color)
                        .accessibilityElement(children: .combine)
                        .accessibilityIdentifier("qiraat-card-status-\(row.entryId)")
                }
                if !chips.isEmpty { NarratorChipsView(items: chips) }
                if let text = row.readingText, row.kind == .farsh, !text.isEmpty {
                    Text(text).font(.custom("KFGQPCUthmanicScriptHAFS", size: 22))
                }
                HStack(spacing: 8) {
                    if row.reviewStatus != .reviewed {
                        Button(action: approve) { Label("اعتماد", systemImage: "checkmark.seal.fill").frame(maxWidth: .infinity) }
                            .buttonStyle(.borderedProminent).tint(.green)
                            .accessibilityIdentifier("qiraat-card-approve-\(row.entryId)")
                    }
                    Button(action: edit) { Label("تعديل", systemImage: "pencil").frame(maxWidth: .infinity) }
                        .buttonStyle(.bordered)
                        .accessibilityIdentifier("qiraat-card-edit-\(row.entryId)")
                    Button(role: .destructive, action: delete) { Label("حذف", systemImage: "trash").frame(maxWidth: .infinity) }
                        .buttonStyle(.bordered)
                        .accessibilityIdentifier("qiraat-card-delete-\(row.entryId)")
                }
                .controlSize(.regular)
                .disabled(saving)
            }
            .padding(10)
            .background(Color(uiColor: .systemBackground).opacity(0.8), in: RoundedRectangle(cornerRadius: 10))
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("qiraat-card-face-\(row.entryId)")
        }
    }
}

extension ReviewStore {
    /// Approves every face of the word `key` that is not reviewed yet. Unlike `approveAllForSelectedWord`
    /// it needs no selection and does not move the editor on to the next word.
    func approveAllForSelectedWordKey(_ key: String?) {
        for row in key.map(rows(forKey:)) ?? [] where row.reviewStatus != .reviewed { approve(row) }
    }
}
#endif
