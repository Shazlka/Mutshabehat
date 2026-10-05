#if DEBUG
import MushafCore
import SwiftUI

/// Step 1 — the faces recorded for the selected word, with the quick actions (approve, flag, delete).
struct FacesStepView: View {
    let store: ReviewStore
    let openEditor: () -> Void

    private var key: String { store.selectedKey ?? "" }

    var body: some View {
        List {
            if let deleted = store.lastDeleted {
                Section {
                    HStack {
                        Label("حُذف وجه", systemImage: "trash").foregroundStyle(.secondary)
                        Spacer()
                        Button("تراجع") { store.restore(deleted) }.buttonStyle(.borderedProminent).controlSize(.small)
                            .accessibilityIdentifier("review-undo-delete")
                    }
                }
            }
            Section {
                Button { store.startNewDraft(); openEditor() } label: { Label("وجه جديد", systemImage: "plus.circle.fill") }
                    .accessibilityIdentifier("review-new-face")
            }
            Section {
                let rows = store.rows(forKey: key)
                if rows.isEmpty {
                    Label("لا وجه مسجّل لهذه الكلمة — أضف وجهًا من «المراجع» أو ابدأ وجهًا جديدًا.", systemImage: "text.badge.plus")
                        .font(.footnote).foregroundStyle(.secondary)
                } else {
                    ForEach(rows) { row in
                        FaceRow(row: row, catalog: store.page?.narrators ?? [])
                            .contentShape(Rectangle())
                            .onTapGesture { store.startEditing(row); openEditor() }
                            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                if row.reviewStatus != .reviewed {
                                    Button { store.approve(row) } label: { Label("اعتماد", systemImage: "checkmark") }.tint(.green)
                                }
                                Button { store.flag(row, note: nil) } label: { Label("تعليم", systemImage: "flag") }.tint(.orange)
                            }
                            .swipeActions(edge: .leading) {
                                Button(role: .destructive) { store.delete(row) } label: { Label("حذف", systemImage: "trash") }
                            }
                            .accessibilityIdentifier("review-face-\(row.entryId)")
                    }
                }
            } header: {
                Text(FacesSummary.summarize(store.rows(forKey: key)).isEmpty ? "الأوجه المسجلة" : FacesSummary.summarize(store.rows(forKey: key)))
            }
        }
        .listStyle(.insetGrouped)
    }
}

private struct FaceRow: View {
    let row: ReviewRow
    let catalog: [CatalogNarrator]

    private var chips: [NarratorDisplayItem] {
        NarratorDisplay.describe(row.narrators.map { NarratorRef(id: $0.id, nameAr: $0.nameAr) })
    }

    private var status: (label: String, color: Color, symbol: String) {
        switch row.reviewStatus {
        case .reviewed: ("معتمد", .green, "checkmark.circle.fill")
        case .unreviewed: ("بانتظار الاعتماد", .orange, "circle.dashed")
        case .flagged: ("معلَّم", .red, "flag.fill")
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Text(row.kind == .usul ? "أصول" : "فرش").font(.caption2.weight(.bold))
                    .padding(.horizontal, 7).padding(.vertical, 2)
                    .background(Color.accentColor.opacity(0.14), in: Capsule())
                Text(FacesSummary.label(for: row)).font(.headline).lineLimit(2)
                if row.endKey != row.startKey { Text("مع الكلمة التالية").font(.caption).foregroundStyle(.secondary) }
                Spacer(minLength: 4)
                Label(status.label, systemImage: status.symbol).font(.caption.weight(.semibold)).foregroundStyle(status.color)
                    .labelStyle(.titleAndIcon)
            }
            if !chips.isEmpty { NarratorChipsView(items: chips) }
            if let text = row.readingText, row.kind == .farsh, !text.isEmpty {
                Text(text).font(.custom("KFGQPCUthmanicScriptHAFS", size: 22)).foregroundStyle(.primary)
            }
            if row.reviewStatus != .reviewed, ReviewPageEditing.isPlaceholder(row) {
                Label("جارٍ الحفظ…", systemImage: "arrow.triangle.2.circlepath").font(.caption).foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}
#endif
