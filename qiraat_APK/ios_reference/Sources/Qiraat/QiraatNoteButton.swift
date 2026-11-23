import MushafCore
import SwiftUI

struct QiraatNoteButton: View {
    let word: MushafWord
    var store: QiraatNotesStore = .shared
    @State private var editing = false
    @State private var errorMessage: String?

    private var saved: QiraatNote? {
        store.note(surah: word.ayahKey.surah, ayah: word.ayahKey.ayah, token: word.indexInAyah)
    }

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack { favoriteButton; editButton }
            VStack(alignment: .leading) { favoriteButton; editButton }
        }
        .buttonStyle(.plain)
        .foregroundStyle(Color(uiColor: .mushafInk))
        .environment(\.layoutDirection, .rightToLeft)
        .sheet(isPresented: $editing) {
            QiraatNoteEditor(store: store, page: word.page, surah: word.ayahKey.surah,
                             ayah: word.ayahKey.ayah, token: word.indexInAyah,
                             wordText: word.textUthmani, initialText: saved?.note ?? "")
        }
        .alert("تعذر الحفظ", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
            Button("حسنًا", role: .cancel) { errorMessage = nil }
        } message: { Text(errorMessage ?? "") }
    }

    private var favoriteButton: some View {
        Button {
            do {
                try store.setFavorite(!(saved?.favorite ?? false), page: word.page,
                    surah: word.ayahKey.surah, ayah: word.ayahKey.ayah, token: word.indexInAyah)
            } catch { errorMessage = error.localizedDescription }
        } label: {
            Label(saved?.favorite == true ? "إزالة من المفضلة" : "إضافة إلى المفضلة",
                  systemImage: saved?.favorite == true ? "star.fill" : "star")
                .font(.body)
                .foregroundStyle(Color.favorite)
                .padding(.horizontal, 8)
                .frame(minWidth: 44, minHeight: 44)
                .contentShape(Rectangle())
        }
        .accessibilityIdentifier("qiraat-favorite-toggle")
        .accessibilityValue(saved?.favorite == true ? "في المفضلة" : "ليست في المفضلة")
        .accessibilityAddTraits(saved?.favorite == true ? .isSelected : [])
    }

    private var editButton: some View {
        Button { editing = true } label: {
            Label(saved?.note.isEmpty == false ? "تعديل الملاحظة" : "إضافة ملاحظة", systemImage: "square.and.pencil")
                .font(.body)
                .padding(.horizontal, 8)
                .frame(minWidth: 44, minHeight: 44)
                .contentShape(Rectangle())
        }
        .accessibilityIdentifier("qiraat-note-edit")
    }
}

/// Shared by the word sheet and saved-notes list. Cancelling never writes the draft.
struct QiraatNoteEditor: View {
    let store: QiraatNotesStore
    let page: Int
    let surah: Int
    let ayah: Int
    let token: Int
    var wordText: String = ""
    @State private var text: String
    @State private var errorMessage: String?
    @Environment(\.dismiss) private var dismiss

    init(store: QiraatNotesStore, page: Int, surah: Int, ayah: Int, token: Int,
         wordText: String = "", initialText: String) {
        self.store = store
        self.page = page
        self.surah = surah
        self.ayah = ayah
        self.token = token
        self.wordText = wordText
        _text = State(initialValue: initialText)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    if !wordText.isEmpty { Text(verbatim: wordText).font(.title2) }
                    Text("سورة \(surah) · آية \(ayah) · كلمة \(token) · صفحة \(page)").font(.callout)
                }
                Section {
                    TextEditor(text: $text)
                        .font(.body)
                        .scrollContentBackground(.hidden)
                        .frame(minHeight: 180)
                        .accessibilityLabel("ملاحظة شخصية")
                        .accessibilityIdentifier("qiraat-note-text")
                } header: {
                    Text("ملاحظة شخصية")
                } footer: {
                    Text("لحذف الملاحظة، امسح النص ثم احفظ. تبقى الكلمة في المفضلة إذا كانت النجمة مفعّلة.")
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color(uiColor: .mushafPaper))
            .foregroundStyle(Color(uiColor: .mushafInk))
            .navigationTitle("ملاحظة الكلمة")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("إلغاء") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("حفظ") {
                        do {
                            try store.setNote(text, page: page, surah: surah, ayah: ayah, token: token)
                            dismiss()
                        } catch { errorMessage = error.localizedDescription }
                    }
                    .accessibilityIdentifier("qiraat-note-save")
                }
            }
            .alert("تعذر الحفظ", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
                Button("حسنًا", role: .cancel) { errorMessage = nil }
            } message: { Text(errorMessage ?? "") }
        }
        .tint(Color(uiColor: .mushafBrown))
        .environment(\.layoutDirection, .rightToLeft)
    }
}
