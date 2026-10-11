import SwiftUI

struct QiraatNotesView: View {
    var store: QiraatNotesStore = .shared
    /// Receives page, surah, ayah, token in that order; the host handles reader navigation and dismissal.
    let onOpen: (_ page: Int, _ surah: Int, _ ayah: Int, _ token: Int) -> Void
    @State private var editing: QiraatNote?
    @State private var deleting: QiraatNote?
    @State private var errorMessage: String?

    var body: some View {
        List {
            if let error = store.loadError {
                ContentUnavailableView("تعذر تحميل الملاحظات", systemImage: "exclamationmark.triangle", description: Text(error))
            } else if store.notes.isEmpty {
                ContentUnavailableView("لا توجد كلمات محفوظة", systemImage: "star",
                    description: Text("أضف نجمة أو ملاحظة من تفاصيل كلمة في القراءات العشر."))
            } else {
                ForEach(store.notes) { note in
                    VStack(alignment: .leading, spacing: 8) {
                        Button { onOpen(note.page, note.surah, note.ayah, note.token) } label: {
                            VStack(alignment: .leading, spacing: 6) {
                                Label("سورة \(note.surah) · آية \(note.ayah) · كلمة \(note.token)",
                                      systemImage: note.favorite ? "star.fill" : "note.text")
                                    .font(.headline)
                                Text("صفحة \(note.page)").font(.callout)
                                if !note.note.isEmpty { Text(verbatim: note.note).font(.body).lineLimit(3) }
                            }
                            .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("qiraat-note-open-\(note.surah)-\(note.ayah)-\(note.token)")
                        ViewThatFits(in: .horizontal) {
                            HStack { actions(note) }
                            VStack(alignment: .leading) { actions(note) }
                        }
                    }
                    .listRowBackground(Color(uiColor: .mushafPaper))
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(Color(uiColor: .mushafPaper))
        .foregroundStyle(Color(uiColor: .mushafInk))
        .tint(Color(uiColor: .mushafBrown))
        .navigationTitle("مفضلة وملاحظات القراءات")
        .environment(\.layoutDirection, .rightToLeft)
        .sheet(item: $editing) { note in
            QiraatNoteEditor(store: store, page: note.page, surah: note.surah, ayah: note.ayah,
                             token: note.token, initialText: note.note)
        }
        .confirmationDialog("حذف الكلمة المحفوظة وملاحظتها؟", isPresented: Binding(
            get: { deleting != nil }, set: { if !$0 { deleting = nil } }), titleVisibility: .visible) {
                Button("حذف", role: .destructive) {
                    guard let note = deleting else { return }
                    do { try store.delete(id: note.id) } catch { errorMessage = error.localizedDescription }
                    deleting = nil
                }
                Button("إلغاء", role: .cancel) { deleting = nil }
            }
        .alert("تعذر الحفظ", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
            Button("حسنًا", role: .cancel) { errorMessage = nil }
        } message: { Text(errorMessage ?? "") }
    }

    @ViewBuilder private func actions(_ note: QiraatNote) -> some View {
        Button {
            do {
                try store.setFavorite(!note.favorite, page: note.page, surah: note.surah, ayah: note.ayah, token: note.token)
            } catch { errorMessage = error.localizedDescription }
        } label: {
            Label(note.favorite ? "إزالة النجمة" : "إضافة نجمة", systemImage: note.favorite ? "star.fill" : "star")
                .foregroundStyle(Color.favorite)
                .frame(minWidth: 44, minHeight: 44)
        }
        .buttonStyle(.borderless)
        Button { editing = note } label: {
            Label("تعديل", systemImage: "square.and.pencil").frame(minWidth: 44, minHeight: 44)
        }
        .buttonStyle(.borderless)
        Button { deleting = note } label: {
            Label("حذف", systemImage: "trash").foregroundStyle(Color.danger).frame(minWidth: 44, minHeight: 44)
        }
        .buttonStyle(.borderless)
    }
}
