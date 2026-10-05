import MushafCore
import SwiftUI

struct MutshabehatQuranSearchView: View {
    @Environment(\.dismiss) private var dismiss
    let library: MushafLibrary?
    let onAddVerses: ([PersonalVerse]) -> Void

    @State private var query: String = ""
    @State private var results: [AyahSearchResult] = []
    @State private var selectedKeys: Set<String> = [] // "surah:ayah"
    @State private var isSearching: Bool = false
    @State private var searchMode: QuranSearchMode = .smart

    init(library: MushafLibrary? = nil, onAddVerses: @escaping ([PersonalVerse]) -> Void) {
        self.library = library
        self.onAddVerses = onAddVerses
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Search Input & Mode Bar
                VStack(spacing: 8) {
                    HStack(spacing: 8) {
                        Image(systemName: "magnifyingglass")
                            .foregroundColor(.secondary)
                        TextField("ابحث عن آية أو كلمة من القرآن...", text: $query)
                            .environment(\.layoutDirection, .rightToLeft)
                            .textFieldStyle(.plain)
                            .onSubmit { performSearch() }
                        if !query.isEmpty {
                            Button(action: {
                                query = ""
                                results = []
                                selectedKeys.removeAll()
                            }) {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                    .padding(10)
                    .background(Color(uiColor: .secondarySystemBackground))
                    .cornerRadius(10)

                    Picker("نمط البحث", selection: $searchMode) {
                        Text("ذكي").tag(QuranSearchMode.smart)
                        Text("مطابق").tag(QuranSearchMode.exact)
                        Text("موسع").tag(QuranSearchMode.broad)
                    }
                    .pickerStyle(.segmented)
                    .onChange(of: searchMode) { performSearch() }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)

                Divider()

                // Results List
                if isSearching {
                    Spacer()
                    ProgressView("جارٍ البحث في القرآن الكريم...")
                    Spacer()
                } else if results.isEmpty {
                    if query.trimmingCharacters(in: .whitespaces).isEmpty {
                        AdvancedSearchGuideView(bottomPadding: 30) { selectedQuery in
                            query = selectedQuery
                            performSearch()
                        }
                    } else {
                        VStack(spacing: 12) {
                            Spacer()
                            Image(systemName: "magnifyingglass")
                                .font(.system(size: 40))
                                .foregroundColor(.secondary)
                            Text("لا توجد نتائج مطابقة")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                            Spacer()
                        }
                        .padding()
                    }
                } else {
                    List {
                        Section {
                            ForEach(results) { result in
                                let key = "\(result.ayah.surah):\(result.ayah.ayah)"
                                let isSelected = selectedKeys.contains(key)
                                let surahName = library?.surahNames[result.ayah.surah] ?? "سورة \(result.ayah.surah)"

                                Button {
                                    toggleSelection(key)
                                } label: {
                                    HStack(alignment: .top, spacing: 12) {
                                        Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                                            .font(.title3)
                                            .foregroundColor(isSelected ? .accentColor : .secondary)
                                            .padding(.top, 4)

                                        VStack(alignment: .leading, spacing: 6) {
                                            HStack(spacing: 6) {
                                                Text(surahName)
                                                    .font(.caption.bold())
                                                    .foregroundColor(.accentColor)
                                                Text("— آية \(result.ayah.ayah)")
                                                    .font(.caption.monospacedDigit())
                                                    .foregroundColor(.secondary)
                                                Spacer()
                                            }

                                            Text(result.text)
                                                .font(.custom("KFGQPCUthmanicScriptHAFS", size: 21, relativeTo: .body))
                                                .multilineTextAlignment(.leading)
                                                .environment(\.layoutDirection, .rightToLeft)
                                                .lineSpacing(8)
                                                .foregroundColor(.primary)
                                        }
                                    }
                                    .padding(.vertical, 4)
                                }
                                .buttonStyle(.plain)
                            }
                        } header: {
                            Text("\(results.count) نتيجة بحث")
                                .font(.caption.bold())
                        }
                    }
                    .listStyle(.plain)
                }

                // Bottom Action Bar when items selected
                if !selectedKeys.isEmpty {
                    VStack(spacing: 0) {
                        Divider()
                        HStack {
                            Text("تم تحديد \(selectedKeys.count) آية")
                                .font(.subheadline.bold())
                            Spacer()
                            Button {
                                addSelectedVerses()
                            } label: {
                                HStack(spacing: 6) {
                                    Image(systemName: "plus.circle.fill")
                                    Text("إضافة للمجموعة")
                                }
                                .font(.headline.bold())
                                .foregroundColor(.white)
                                .padding(.horizontal, 20)
                                .padding(.vertical, 10)
                                .background(Color.accentColor)
                                .clipShape(Capsule())
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                        .background(Color(uiColor: .systemBackground))
                    }
                }
            }
            .navigationTitle("إضافة آيات من القرآن")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("إلغاء") { dismiss() }
                }
            }
            .onChange(of: query) { _, newQuery in
                if newQuery.trimmingCharacters(in: .whitespaces).isEmpty {
                    results = []
                } else {
                    performSearch()
                }
            }
        }
    }

    private func performSearch() {
        let trimmed = query.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else {
            results = []
            return
        }

        isSearching = true
        let lib = library ?? (try? MushafLibrary())
        if let lib = lib {
            results = lib.searchAyaat(matching: trimmed, mode: searchMode)
        }
        isSearching = false
    }

    private func toggleSelection(_ key: String) {
        if selectedKeys.contains(key) {
            selectedKeys.remove(key)
        } else {
            selectedKeys.insert(key)
        }
    }

    private func addSelectedVerses() {
        let lib = library ?? (try? MushafLibrary())
        var newVerses: [PersonalVerse] = []

        // Maintain selection in result order
        for result in results {
            let key = "\(result.ayah.surah):\(result.ayah.ayah)"
            if selectedKeys.contains(key) {
                let surahName = lib?.surahNames[result.ayah.surah] ?? "سورة \(result.ayah.surah)"
                let part = PersonalPart(
                    id: UUID().uuidString,
                    type: "normal",
                    text: result.text.trimmingCharacters(in: .whitespaces),
                    sortOrder: 0
                )
                let verse = PersonalVerse(
                    id: UUID().uuidString,
                    surah: surahName,
                    ayah: result.ayah.ayah,
                    label: nil,
                    sortOrder: newVerses.count,
                    parts: [part]
                )
                newVerses.append(verse)
            }
        }

        onAddVerses(newVerses)
        dismiss()
    }
}
