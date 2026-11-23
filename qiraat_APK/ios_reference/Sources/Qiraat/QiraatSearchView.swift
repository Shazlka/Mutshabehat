import Foundation
import MushafCore
import SwiftUI

/// Present from the reader and route the selected source anchor through its navigation callback.
@MainActor
struct QiraatSearchView: View {
    let store: QiraatStore
    let databaseURL: URL
    let surahNames: [Int: String]
    let onOpen: (_ page: Int, _ surah: Int, _ ayah: Int, _ token: Int) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var search: QiraatSearch
    @State private var scope = Scope.authority
    @State private var text = ""
    @State private var authority: String?
    @State private var category: String?
    @State private var ignoreTashkeel = true
    @State private var choicesExpanded = true
    @State private var categories: [QiraatSearchCategory] = []
    @State private var groups: [QiraatSearchSurahGroup] = []
    @State private var loading = true
    @State private var missingPageCount = 0

    private enum Scope: String, CaseIterable, Identifiable {
        case authority = "قارئ/راوٍ", word = "كلمة", category = "باب"
        var id: String { rawValue }
    }

    init(store: QiraatStore, databaseURL: URL, surahNames: [Int: String],
         onOpen: @escaping (_ page: Int, _ surah: Int, _ ayah: Int, _ token: Int) -> Void) {
        self.store = store
        self.databaseURL = databaseURL
        self.surahNames = surahNames
        self.onOpen = onOpen
        _search = State(initialValue: QiraatSearchSession.service(for: store, databaseURL: databaseURL))
    }

    private var query: QiraatSearchQuery? {
        switch scope {
        case .authority: authority.map(QiraatSearchQuery.authority)
        case .word: text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? nil : .word(text, ignoreTashkeel: ignoreTashkeel)
        case .category: category.map(QiraatSearchQuery.category)
        }
    }

    private var fieldPrompt: String {
        switch scope {
        case .authority: "ابحث عن قارئ أو راوٍ"
        case .word: "ابحث في كلمات الخلاف"
        case .category: "ابحث عن باب"
        }
    }

    private var authorityName: String {
        guard let authority else { return "اختر القارئ أو الراوي" }
        return store.catalog.reader(authority)?.nameAr ?? store.catalog.narrator(authority)?.nameAr ?? authority
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 12) {
                Picker("نطاق البحث", selection: $scope) {
                    ForEach(Scope.allCases) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)
                .frame(minHeight: 44)
                .padding(.horizontal)

                TextField(fieldPrompt, text: $text)
                    .textFieldStyle(.roundedBorder)
                    .font(.body)
                    .frame(minHeight: 44)
                    .padding(.horizontal)
                    .autocorrectionDisabled()
                    .accessibilityIdentifier("qiraat-search-field")

                List {
                    controls
                    if missingPageCount > 0 {
                        Text("الفهرس غير مكتمل: \(missingPageCount) صفحة غير متاحة")
                            .foregroundStyle(Color.caution)
                    }
                    if query == nil {
                        Text(scope == .word ? "اكتب كلمة للبحث في مواضع الخلاف" : "اختر من القائمة لعرض المواضع")
                    } else if groups.isEmpty {
                        if loading {
                            ProgressView("جارٍ تجهيز النتائج")
                        } else {
                            Text("لا توجد نتائج")
                        }
                    } else {
                        Text("\(groups.reduce(0) { $0 + $1.pages.reduce(0) { $0 + $1.results.count } }) موضع")
                            .font(.subheadline)
                        if loading {
                            ProgressView("جارٍ تحديث النتائج")
                                .controlSize(.small)
                        }
                        resultSections
                    }
                }
                .scrollContentBackground(.hidden)
                .listStyle(.insetGrouped)
            }
            .padding(.top, 8)
            .background(Color(uiColor: .mushafPaper))
            .foregroundStyle(Color(uiColor: .mushafInk))
            .tint(.info)
            .navigationTitle("البحث في القراءات")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("إغلاق") { dismiss() }.frame(minWidth: 44, minHeight: 44)
                }
            }
            .onChange(of: scope) { _, _ in
                text = ""
                choicesExpanded = true
            }
            .onChange(of: text) { _, _ in
                if scope != .word { choicesExpanded = true }
            }
            .task(id: query) { await updateResults() }
        }
        .environment(\.layoutDirection, .rightToLeft)
        .accessibilityIdentifier("qiraat-search")
    }

    @ViewBuilder private var controls: some View {
        switch scope {
        case .authority:
            Section {
                DisclosureGroup(authorityName, isExpanded: $choicesExpanded) {
                    ForEach(store.catalog.readers.sorted { $0.sortOrder < $1.sortOrder }) { reader in
                        if matchesName(reader.nameAr) {
                            authorityButton(id: reader.id, name: reader.nameAr, color: reader.color)
                        }
                        ForEach(store.catalog.narrators(of: reader.id)) { narrator in
                            if matchesName(narrator.nameAr) || matchesName(reader.nameAr) {
                                authorityButton(id: narrator.id, name: narrator.nameAr, color: narrator.color)
                                    .padding(.leading, 16)
                            }
                        }
                    }
                }
                .frame(minHeight: 44)
            }
            .listRowBackground(Color(uiColor: .mushafPaper))
        case .word:
            Toggle("تجاهل التشكيل", isOn: $ignoreTashkeel)
                .frame(minHeight: 44)
                .listRowBackground(Color(uiColor: .mushafPaper))
        case .category:
            Section {
                DisclosureGroup(categories.first { $0.id == category }?.nameAr ?? "اختر الباب",
                                isExpanded: $choicesExpanded) {
                    ForEach(categories.filter { matchesName($0.nameAr) }) { item in
                        Button {
                            withMotion { category = item.id; choicesExpanded = false }
                        } label: {
                            HStack {
                                Text(verbatim: item.nameAr)
                                Spacer()
                                Text("\(item.rulingCount) حكم").font(.caption)
                                if category == item.id { Image(systemName: "checkmark") }
                            }
                            .frame(minHeight: 44)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityAddTraits(category == item.id ? .isSelected : [])
                    }
                }
                .frame(minHeight: 44)
            }
            .listRowBackground(Color(uiColor: .mushafPaper))
        }
    }

    private func authorityButton(id: String, name: String, color: String) -> some View {
        Button {
            withMotion { authority = id; choicesExpanded = false }
        } label: {
            HStack(spacing: 12) {
                Circle().fill(Color(qiraatHex: color)).frame(width: 14, height: 14)
                    .accessibilityHidden(true)
                Text(verbatim: name)
                Spacer()
                if authority == id { Image(systemName: "checkmark") }
            }
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(authority == id ? .isSelected : [])
    }

    private var resultSections: some View {
        ForEach(groups) { group in
            Section {
                ForEach(group.pages) { page in
                    ForEach(page.results) { result in
                        Button {
                            onOpen(result.page, result.surah, result.ayah, result.token)
                            dismiss()
                        } label: {
                            VStack(alignment: .leading, spacing: 6) {
                                // A few bundled rulings carry no word text; show the position only.
                                Text(verbatim: result.displayText.isEmpty ? "كلمة \(result.token)" : result.displayText)
                                    .font(Font(MushafLibrary.mushafFont(size: 22)))
                                Text("صفحة \(result.page) · آية \(result.ayah) · كلمة \(result.token)")
                                    .font(.caption)
                                Text(verbatim: result.kinds.map(\.rawValue).joined(separator: " · "))
                                    .font(.caption)
                            }
                            .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("qiraat-search-result-\(result.id)")
                    }
                }
            } header: {
                Text(surahNames[group.surah] ?? "سورة \(group.surah)")
                    .foregroundStyle(Color(uiColor: .mushafInk))
            }
            .listRowBackground(Color(uiColor: .mushafPaper))
        }
    }

    private func matchesName(_ name: String) -> Bool {
        let needle = QuranSearchNormalizer.canonical(text)
        return needle.isEmpty || QuranSearchNormalizer.canonical(name).contains(needle)
    }

    @MainActor private func updateResults() async {
        loading = true
        let requestedQuery = query
        let index = await search.index()
        guard !Task.isCancelled else { return }
        categories = index.categories
        missingPageCount = index.missingPages.count
        if let requestedQuery {
            let found = await search.search(requestedQuery)
            guard !Task.isCancelled else { return }
            groups = found
        } else {
            groups = []
        }
        loading = false
    }
}

/// Reopening search reuses the index; importing a replacement store starts a fresh snapshot.
@MainActor private enum QiraatSearchSession {
    private static var current: (store: QiraatStore, databasePath: String, search: QiraatSearch)?

    static func service(for store: QiraatStore, databaseURL: URL) -> QiraatSearch {
        let databasePath = databaseURL.standardizedFileURL.path
        if let current, current.store === store, current.databasePath == databasePath { return current.search }
        let search = QiraatSearch(store: store, databaseURL: databaseURL)
        current = (store, databasePath, search)
        return search
    }
}
