import MushafCore
import SwiftUI
import UniformTypeIdentifiers

struct MutshabehatView: View {
    @Environment(\.dismiss) private var dismiss
    let library: MushafLibrary?

    @State private var selectedTab: Mode = .personal
    @State private var searchText: String = ""
    @State private var selectedSurah: String = ""
    @State private var showFavoritesOnly: Bool = false

    @State private var personalGroups: [PersonalGroup] = []
    @State private var automatedGroups: [AutomatedGroup] = []
    @State private var surahs: [String] = []

    @State private var navigationPath = NavigationPath()
    @State private var isCreatingNewGroup: Bool = false
    @State private var groupToEdit: PersonalGroup? = nil

    @State private var showFileImporter: Bool = false
    @State private var importMessage: String?
    @State private var showImportAlert: Bool = false

    enum Mode: String, CaseIterable, Identifiable {
        case personal
        case automated

        var id: String { rawValue }

        var title: LocalizedStringKey {
            switch self {
            case .personal: "الشخصية"
            case .automated: "الآلية"
            }
        }
    }

    private let db = MutshabehatDatabase.shared

    init(library: MushafLibrary? = nil) {
        self.library = library
    }

    var body: some View {
        NavigationStack(path: $navigationPath) {
            VStack(spacing: 0) {
                // Segmented Mode Picker
                Picker("النوع", selection: $selectedTab) {
                    ForEach(Mode.allCases) { mode in
                        Text(mode.title).tag(mode)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)
                .padding(.vertical, 8)

                // Search & Filter Bar
                HStack(spacing: 8) {
                    HStack {
                        Image(systemName: "magnifyingglass")
                            .foregroundColor(.secondary)
                        TextField("بحث في المجموعات أو الآيات...", text: $searchText)
                            .environment(\.layoutDirection, .rightToLeft)
                            .textFieldStyle(.plain)
                        if !searchText.isEmpty {
                            Button(action: { searchText = "" }) {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                    .padding(8)
                    .background(Color(UIColor.secondarySystemBackground))
                    .cornerRadius(10)

                    // Surah Filter Menu
                    Menu {
                        Button("كل السور") { selectedSurah = "" }
                        ForEach(surahs, id: \.self) { s in
                            Button(s) { selectedSurah = s }
                        }
                    } label: {
                        HStack(spacing: 4) {
                            Group {
                                if selectedSurah.isEmpty {
                                    Text("السورة")
                                } else {
                                    Text(verbatim: selectedSurah)
                                }
                            }
                                .font(.footnote.weight(.medium))
                            Image(systemName: "chevron.down")
                                .font(.caption2)
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 8)
                        .background(Color(UIColor.secondarySystemBackground))
                        .cornerRadius(10)
                    }

                    if selectedTab == .personal {
                        Button(action: {
                            showFavoritesOnly.toggle()
                            loadData()
                        }) {
                            Image(systemName: showFavoritesOnly ? "star.fill" : "star")
                                .foregroundColor(showFavoritesOnly ? .favorite : .secondary)
                                .padding(8)
                                .background(Color(UIColor.secondarySystemBackground))
                                .cornerRadius(10)
                        }
                    }
                }
                .padding(.horizontal)
                .padding(.bottom, 8)

                Divider()

                // Color Legend matching web app (ColorLegend.tsx)
                MutshabehatColorLegendView()

                // Content
                if selectedTab == .personal {
                    personalList
                } else {
                    automatedList
                }
            }
            .navigationTitle("المتشابهات")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("إغلاق") { dismiss() }
                        .accessibilityIdentifier("close-mutshabehat-button")
                }
                if selectedTab == .personal {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button {
                            isCreatingNewGroup = true
                        } label: {
                            HStack(spacing: 4) {
                                Image(systemName: "plus")
                                Text("إضافة")
                            }
                            .font(.subheadline.weight(.bold))
                        }
                        .accessibilityIdentifier("add-mutshabehat-group-button")
                    }
                } else if selectedTab == .automated {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button {
                            showFileImporter = true
                        } label: {
                            HStack(spacing: 4) {
                                Image(systemName: "square.and.arrow.down")
                                Text("استيراد")
                            }
                            .font(.subheadline)
                        }
                    }
                }
            }
            .sheet(isPresented: $isCreatingNewGroup) {
                MutshabehatGroupEditorView(library: library, group: nil, onSave: { _ in
                    loadData()
                })
            }
            .sheet(item: $groupToEdit) { grp in
                MutshabehatGroupEditorView(library: library, group: grp, onSave: { _ in
                    loadData()
                }, onDelete: { _ in
                    loadData()
                })
            }
            .navigationDestination(for: PersonalGroup.self) { group in
                PersonalGroupDetailView(
                    group: group,
                    library: library,
                    onEdit: { grp in
                        groupToEdit = grp
                    },
                    onToggleFavorite: { grp in
                        db.toggleFavorite(groupId: grp.id)
                        loadData()
                    }
                )
            }
            .navigationDestination(for: AutomatedGroup.self) { group in
                AutomatedGroupDetailView(
                    group: group,
                    library: library,
                    onCopyToPersonal: { grp in
                        db.copyAutomatedToPersonal(automatedId: grp.id)
                        loadData()
                    }
                )
            }
            .fileImporter(
                isPresented: $showFileImporter,
                allowedContentTypes: [.json],
                allowsMultipleSelection: false
            ) { result in
                handleImport(result: result)
            }
            .alert(isPresented: $showImportAlert) {
                Alert(
                    title: Text("استيراد القاعدة الآلية"),
                    message: Text(importMessage ?? ""),
                    dismissButton: .default(Text("حسناً"))
                )
            }
            .onAppear {
                surahs = db.allSurahNames()
                loadData()
            }
            .onChange(of: selectedTab) { loadData() }
            .onChange(of: searchText) { loadData() }
            .onChange(of: selectedSurah) { loadData() }
            .onReceive(NotificationCenter.default.publisher(for: .mutshabehatDatabaseDidUpdate)) { _ in
                surahs = db.allSurahNames()
                loadData()
            }
        }
    }

    // MARK: - Personal List

    private var personalList: some View {
        Group {
            let filtered = showFavoritesOnly ? personalGroups.filter { $0.favorite } : personalGroups
            if filtered.isEmpty {
                VStack(spacing: 12) {
                    Spacer()
                    Image(systemName: "doc.text.magnifyingglass")
                        .scaledFont(size: 40)
                        .foregroundColor(.secondary)
                    Text("لا توجد مجموعات تطابق البحث")
                        .foregroundColor(.secondary)
                    Spacer()
                }
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        HStack {
                            Text("\(filtered.count) مجموعة في عرض المجلة")
                                .font(.caption.bold())
                                .foregroundStyle(.secondary)
                            Spacer()
                            Label("عرض مجلّاتي", systemImage: "magazine.fill")
                                .font(.caption2.bold())
                                .foregroundStyle(Color.accentColor)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Color.accentColor.opacity(0.12), in: Capsule())
                        }
                        .padding(.horizontal, 16)
                        .padding(.top, 8)

                        PersonalMagazineFeed(
                            groups: filtered,
                            onToggleFavorite: { group in
                                db.toggleFavorite(groupId: group.id)
                                loadData()
                            },
                            onEdit: { group in
                                groupToEdit = group
                            },
                            onSelect: { group in
                                navigationPath.append(group)
                            }
                        )
                        .padding(.horizontal, 16)
                        .padding(.bottom, 32)
                    }
                }
            }
        }
    }

    // MARK: - Automated List

    private var automatedList: some View {
        Group {
            if automatedGroups.isEmpty {
                VStack(spacing: 16) {
                    Spacer()
                    Image(systemName: "sparkles")
                        .scaledFont(size: 40)
                        .foregroundColor(.secondary)
                    Text("لا توجد مجموعات آلية مخزنة")
                        .font(.headline)
                    Text("يمكنك استيراد ملف بيانات الآلية (JSON) بالضغط على زر استيراد في الأعلى.")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)
                    Button {
                        showFileImporter = true
                    } label: {
                        Label("استيراد ملف الآلية (JSON)", systemImage: "square.and.arrow.down")
                            .font(.subheadline.weight(.bold))
                    }
                    .buttonStyle(.borderedProminent)
                    Spacer()
                }
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        HStack {
                            Text("\(automatedGroups.count) مجموعة في عرض المجلة")
                                .font(.caption.bold())
                                .foregroundStyle(.secondary)
                            Spacer()
                            Label("قاعدة آلية", systemImage: "sparkles")
                                .font(.caption2.bold())
                                .foregroundStyle(.insight)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Color.insight.opacity(0.12), in: Capsule())
                        }
                        .padding(.horizontal, 16)
                        .padding(.top, 8)

                        AutomatedMagazineFeed(
                            groups: automatedGroups,
                            onCopyToPersonal: { group in
                                db.copyAutomatedToPersonal(automatedId: group.id)
                                loadData()
                            },
                            onSelect: { group in
                                navigationPath.append(group)
                            }
                        )
                        .padding(.horizontal, 16)
                        .padding(.bottom, 32)
                    }
                }
            }
        }
    }

    // MARK: - Helpers

    private func loadData() {
        if selectedTab == .personal {
            personalGroups = db.fetchPersonalGroups(
                surah: selectedSurah.isEmpty ? nil : selectedSurah,
                query: searchText.isEmpty ? nil : searchText
            )
            if CommandLine.arguments.contains("-open-mutshabehat-group"),
               let first = personalGroups.first,
               navigationPath.isEmpty {
                navigationPath.append(first)
            }
        } else {
            automatedGroups = db.fetchAutomatedGroups(
                surah: selectedSurah.isEmpty ? nil : selectedSurah,
                query: searchText.isEmpty ? nil : searchText
            )
        }
    }

    private func handleImport(result: Result<[URL], Error>) {
        switch result {
        case .success(let urls):
            guard let url = urls.first else { return }
            guard url.startAccessingSecurityScopedResource() else {
                importMessage = "تعذر الوصول للملف المحدد"
                showImportAlert = true
                return
            }
            defer { url.stopAccessingSecurityScopedResource() }

            do {
                let data = try Data(contentsOf: url)
                let count = try db.importAutomatedJSON(data: data)
                importMessage = "تم استيراد \(count) مجموعة آلية بنجاح إلى قاعدة البيانات المحلية."
                showImportAlert = true
                loadData()
            } catch {
                importMessage = "حدث خطأ أثناء قراءة الملف: \(error.localizedDescription)"
                showImportAlert = true
            }
        case .failure(let error):
            importMessage = "فشل فتح الملف: \(error.localizedDescription)"
            showImportAlert = true
        }
    }
}

// MARK: - Color Legend View (matches web ColorLegend.tsx)

private struct MutshabehatColorLegendView: View {
    private let items: [MutshabehatPartStyle] = [
        .shared, .difference, .difference2, .difference3, .addition, .unique
    ]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                Text("الألوان:")
                    .font(.caption2.bold())
                    .foregroundStyle(.secondary)
                    .padding(.leading, 4)

                ForEach(items, id: \.self) { item in
                    Text(item.title)
                        .font(.caption2.bold())
                        .foregroundStyle(Color(uiColor: item.foreground))
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(Color(uiColor: item.background))
                        .clipShape(RoundedRectangle(cornerRadius: 5, style: .continuous))
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 6)
        }
        .background(Color(uiColor: .secondarySystemBackground).opacity(0.55))
    }
}
