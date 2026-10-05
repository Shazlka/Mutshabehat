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
                                .font(.system(size: 13, weight: .medium))
                            Image(systemName: "chevron.down")
                                .font(.system(size: 10))
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
                                .foregroundColor(showFavoritesOnly ? .yellow : .secondary)
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
                            .font(.system(size: 14, weight: .bold))
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
                            .font(.system(size: 14))
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
            .onChange(of: selectedTab) { _ in loadData() }
            .onChange(of: searchText) { _ in loadData() }
            .onChange(of: selectedSurah) { _ in loadData() }
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
                        .font(.system(size: 40))
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
                        .font(.system(size: 40))
                        .foregroundColor(.secondary)
                    Text("لا توجد مجموعات آلية مخزنة")
                        .font(.system(size: 17, weight: .semibold))
                    Text("يمكنك استيراد ملف بيانات الآلية (JSON) بالضغط على زر استيراد في الأعلى.")
                        .font(.system(size: 14))
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)
                    Button {
                        showFileImporter = true
                    } label: {
                        Label("استيراد ملف الآلية (JSON)", systemImage: "square.and.arrow.down")
                            .font(.system(size: 14, weight: .bold))
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
                                .foregroundStyle(.purple)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Color.purple.opacity(0.12), in: Capsule())
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

// MARK: - Magazine View Theme & Layout Helpers

enum MagazineCardSize {
    case hero
    case tall
    case compact
}

struct MutshabehatMagazineTheme {
    static let palette: [Color] = [
        Color(hex: "#0F5132"), // Emerald green
        Color(hex: "#1D4ED8"), // Royal blue
        Color(hex: "#6D28D9"), // Deep purple / amethyst
        Color(hex: "#C2410C"), // Desert terracotta
        Color(hex: "#BE123C"), // Imperial ruby
        Color(hex: "#B45309"), // Warm amber / ochre
        Color(hex: "#0F766E"), // Byzantine teal
        Color(hex: "#4D7C0F"), // Olive bronze
        Color(hex: "#3730A3"), // Persian indigo
        Color(hex: "#831843"), // Antique rosewood
        Color(hex: "#78350F"), // Walnut brown
        Color(hex: "#0284C7"), // Mediterranean azure
    ]

    static func color(for id: String, customColor: String) -> Color {
        let trimmed = customColor.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if !trimmed.isEmpty && trimmed != "#55b94f" && trimmed != "55b94f" {
            return Color(hex: customColor)
        }
        let hash = abs(id.hashValue)
        return palette[hash % palette.count]
    }
}

private enum MagazineBlock<T>: Identifiable {
    case hero(T)
    case pair(T, T)
    case single(T)

    var id: String {
        switch self {
        case .hero(let item): return "hero-\(String(describing: item).hashValue)"
        case .pair(let a, let b): return "pair-\(String(describing: a).hashValue)-\(String(describing: b).hashValue)"
        case .single(let item): return "single-\(String(describing: item).hashValue)"
        }
    }
}

private func buildMagazineBlocks<T>(from items: [T]) -> [MagazineBlock<T>] {
    var blocks: [MagazineBlock<T>] = []
    var i = 0
    var step = 0
    while i < items.count {
        if step % 3 == 0 || i == items.count - 1 {
            blocks.append(.hero(items[i]))
            i += 1
        } else {
            if i + 1 < items.count {
                blocks.append(.pair(items[i], items[i + 1]))
                i += 2
            } else {
                blocks.append(.single(items[i]))
                i += 1
            }
        }
        step += 1
    }
    return blocks
}

extension Array where Element: Hashable {
    func removingDuplicates() -> [Element] {
        var seen = Set<Element>()
        return filter { seen.insert($0).inserted }
    }
}

// MARK: - Personal Magazine Feed & Card

private struct PersonalMagazineFeed: View {
    let groups: [PersonalGroup]
    let onToggleFavorite: (PersonalGroup) -> Void
    let onEdit: (PersonalGroup) -> Void
    let onSelect: (PersonalGroup) -> Void

    var body: some View {
        let blocks = buildMagazineBlocks(from: groups)
        LazyVStack(spacing: 12) {
            ForEach(blocks) { block in
                switch block {
                case .hero(let group):
                    PersonalMagazineCard(
                        group: group,
                        size: .hero,
                        color: MutshabehatMagazineTheme.color(for: group.id, customColor: group.color),
                        toggleFavorite: { onToggleFavorite(group) },
                        onEdit: { onEdit(group) },
                        onSelect: { onSelect(group) }
                    )
                case .pair(let first, let second):
                    HStack(alignment: .top, spacing: 12) {
                        PersonalMagazineCard(
                            group: first,
                            size: .tall,
                            color: MutshabehatMagazineTheme.color(for: first.id, customColor: first.color),
                            toggleFavorite: { onToggleFavorite(first) },
                            onEdit: { onEdit(first) },
                            onSelect: { onSelect(first) }
                        )
                        .frame(maxWidth: .infinity, alignment: .topLeading)

                        PersonalMagazineCard(
                            group: second,
                            size: .tall,
                            color: MutshabehatMagazineTheme.color(for: second.id, customColor: second.color),
                            toggleFavorite: { onToggleFavorite(second) },
                            onEdit: { onEdit(second) },
                            onSelect: { onSelect(second) }
                        )
                        .frame(maxWidth: .infinity, alignment: .topLeading)
                    }
                case .single(let group):
                    PersonalMagazineCard(
                        group: group,
                        size: .hero,
                        color: MutshabehatMagazineTheme.color(for: group.id, customColor: group.color),
                        toggleFavorite: { onToggleFavorite(group) },
                        onEdit: { onEdit(group) },
                        onSelect: { onSelect(group) }
                    )
                }
            }
        }
    }
}

private struct PersonalMagazineCard: View {
    let group: PersonalGroup
    let size: MagazineCardSize
    let color: Color
    let toggleFavorite: () -> Void
    let onEdit: () -> Void
    let onSelect: () -> Void

    var body: some View {
        Button(action: onSelect) {
            VStack(alignment: .leading, spacing: 8) {
                // Header: Surah tags and badges
                HStack(spacing: 6) {
                    let surahs = group.verses.map(\.surah).removingDuplicates()
                    if !surahs.isEmpty {
                        Text(surahs.joined(separator: " • "))
                            .font(.system(size: size == .compact ? 11 : 12, weight: .bold))
                            .foregroundStyle(color)
                            .lineLimit(1)
                    }

                    Spacer(minLength: 4)

                    Text("\(group.verses.count) مواضع")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color(uiColor: .tertiarySystemFill), in: Capsule())

                    Button(action: toggleFavorite) {
                        Image(systemName: group.favorite ? "star.fill" : "star")
                            .font(.system(size: 13))
                            .foregroundColor(group.favorite ? .yellow : .secondary)
                    }
                    .buttonStyle(.plain)
                }

                // Title
                Text(verbatim: group.title)
                    .font(.system(size: size == .hero ? 17 : (size == .tall ? 15 : 14), weight: .bold))
                    .foregroundStyle(.primary)
                    .lineLimit(size == .compact ? 2 : 3)
                    .multilineTextAlignment(.leading)

                // Preview excerpt with auto-color diff tags
                if let firstVerse = group.verses.first {
                    VStack(alignment: .leading, spacing: 4) {
                        ArabicDiffView(parts: firstVerse.parts)
                            .lineLimit(size == .hero ? 3 : 2)
                    }
                }

                // Bottom footer: More count indicator and chevron
                HStack {
                    if group.verses.count > 1 {
                        Text("+ \(group.verses.count - 1) مواضع أخرى")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Image(systemName: "chevron.left")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(color.opacity(0.8))
                }
                .padding(.top, 2)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .topLeading)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [color.opacity(0.14), color.opacity(0.06)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(color.opacity(0.38), lineWidth: 1.2)
            )
            .shadow(color: color.opacity(0.10), radius: 5, y: 2)
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button(action: onSelect) {
                Label("عرض كامل التفاصيل", systemImage: "arrow.up.left.and.arrow.down.right")
            }
            Button(action: onEdit) {
                Label("تعديل المجموعة", systemImage: "pencil")
            }
            Button(action: toggleFavorite) {
                Label(group.favorite ? "إزالة من المفضلة" : "إضافة إلى المفضلة", systemImage: group.favorite ? "star.slash" : "star")
            }
        }
    }
}

// MARK: - Automated Magazine Feed & Card

private struct AutomatedMagazineFeed: View {
    let groups: [AutomatedGroup]
    let onCopyToPersonal: (AutomatedGroup) -> Void
    let onSelect: (AutomatedGroup) -> Void

    var body: some View {
        let blocks = buildMagazineBlocks(from: groups)
        LazyVStack(spacing: 12) {
            ForEach(blocks) { block in
                switch block {
                case .hero(let group):
                    AutomatedMagazineCard(
                        group: group,
                        size: .hero,
                        color: MutshabehatMagazineTheme.color(for: String(group.id), customColor: group.color),
                        copyToPersonal: { onCopyToPersonal(group) },
                        onSelect: { onSelect(group) }
                    )
                case .pair(let first, let second):
                    HStack(alignment: .top, spacing: 12) {
                        AutomatedMagazineCard(
                            group: first,
                            size: .tall,
                            color: MutshabehatMagazineTheme.color(for: String(first.id), customColor: first.color),
                            copyToPersonal: { onCopyToPersonal(first) },
                            onSelect: { onSelect(first) }
                        )
                        .frame(maxWidth: .infinity, alignment: .topLeading)

                        AutomatedMagazineCard(
                            group: second,
                            size: .tall,
                            color: MutshabehatMagazineTheme.color(for: String(second.id), customColor: second.color),
                            copyToPersonal: { onCopyToPersonal(second) },
                            onSelect: { onSelect(second) }
                        )
                        .frame(maxWidth: .infinity, alignment: .topLeading)
                    }
                case .single(let group):
                    AutomatedMagazineCard(
                        group: group,
                        size: .hero,
                        color: MutshabehatMagazineTheme.color(for: String(group.id), customColor: group.color),
                        copyToPersonal: { onCopyToPersonal(group) },
                        onSelect: { onSelect(group) }
                    )
                }
            }
        }
    }
}

private struct AutomatedMagazineCard: View {
    let group: AutomatedGroup
    let size: MagazineCardSize
    let color: Color
    let copyToPersonal: () -> Void
    let onSelect: () -> Void

    var body: some View {
        Button(action: onSelect) {
            VStack(alignment: .leading, spacing: 8) {
                // Header: Surah tags and badges
                HStack(spacing: 6) {
                    if !group.surahs.isEmpty {
                        Text(group.surahs.joined(separator: " • "))
                            .font(.system(size: size == .compact ? 11 : 12, weight: .bold))
                            .foregroundStyle(color)
                            .lineLimit(1)
                    }

                    Spacer(minLength: 4)

                    Text("\(group.verses.count) مواضع")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color(uiColor: .tertiarySystemFill), in: Capsule())

                    if group.copied {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.green)
                            .font(.system(size: 13))
                    }
                }

                // Title
                Text(verbatim: group.title)
                    .font(.system(size: size == .hero ? 17 : (size == .tall ? 15 : 14), weight: .bold))
                    .foregroundStyle(.primary)
                    .lineLimit(size == .compact ? 2 : 3)
                    .multilineTextAlignment(.leading)

                // Preview excerpt with auto-color diff tags
                if let firstVerse = group.verses.first {
                    VStack(alignment: .leading, spacing: 4) {
                        ArabicDiffView(parts: firstVerse.parts)
                            .lineLimit(size == .hero ? 3 : 2)
                    }
                }

                // Bottom footer: More count indicator and chevron
                HStack {
                    if group.verses.count > 1 {
                        Text("+ \(group.verses.count - 1) مواضع أخرى")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Image(systemName: "chevron.left")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(color.opacity(0.8))
                }
                .padding(.top, 2)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .topLeading)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [color.opacity(0.14), color.opacity(0.06)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(color.opacity(0.38), lineWidth: 1.2)
            )
            .shadow(color: color.opacity(0.10), radius: 5, y: 2)
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button(action: onSelect) {
                Label("عرض كامل التفاصيل", systemImage: "arrow.up.left.and.arrow.down.right")
            }
            Button(action: copyToPersonal) {
                Label("نسخ إلى مجموعاتي الخاصة", systemImage: "plus.square.on.square")
            }
        }
    }
}

// MARK: - Full Page Detail Sheets

struct PersonalGroupDetailView: View {
    let group: PersonalGroup
    let library: MushafLibrary?
    let onEdit: (PersonalGroup) -> Void
    let onToggleFavorite: (PersonalGroup) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                // Header card
                VStack(alignment: .leading, spacing: 12) {
                    HStack(spacing: 8) {
                        let surahs = group.verses.map(\.surah).removingDuplicates()
                        if !surahs.isEmpty {
                            Text(surahs.joined(separator: " • "))
                                .font(.headline.bold())
                                .foregroundStyle(MutshabehatMagazineTheme.color(for: group.id, customColor: group.color))
                        }
                        Spacer()
                        Text("\(group.verses.count) مواضع")
                            .font(.caption.bold())
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .background(Color(uiColor: .tertiarySystemFill), in: Capsule())

                        Button {
                            onToggleFavorite(group)
                        } label: {
                            Image(systemName: group.favorite ? "star.fill" : "star")
                                .foregroundColor(group.favorite ? .yellow : .secondary)
                                .font(.system(size: 18))
                        }
                    }

                    Text(verbatim: group.title)
                        .font(.title2.bold())
                        .foregroundStyle(.primary)

                    if let note = group.note, !note.trimmingCharacters(in: .whitespaces).isEmpty {
                        HStack(alignment: .top, spacing: 8) {
                            Image(systemName: "note.text")
                                .foregroundColor(.secondary)
                            Text(note)
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }
                        .padding(10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color(uiColor: .tertiarySystemFill).opacity(0.6), in: RoundedRectangle(cornerRadius: 10))
                    }
                }
                .padding(18)
                .background(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .fill(MutshabehatMagazineTheme.color(for: group.id, customColor: group.color).opacity(0.12))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .stroke(MutshabehatMagazineTheme.color(for: group.id, customColor: group.color).opacity(0.35), lineWidth: 1.2)
                )

                // Verses Section
                VStack(alignment: .leading, spacing: 14) {
                    Text("المواضع والآيات المتشابهة")
                        .font(.headline.bold())
                        .foregroundColor(.primary)

                    ForEach(group.verses) { verse in
                        VStack(alignment: .leading, spacing: 10) {
                            HStack {
                                Label("\(verse.surah) - آية \(toArabicIndic(verse.ayah))", systemImage: "book.fill")
                                    .font(.subheadline.bold())
                                    .foregroundColor(MutshabehatMagazineTheme.color(for: group.id, customColor: group.color))

                                Spacer()

                                if let label = verse.label, !label.isEmpty {
                                    Text(label)
                                        .font(.caption2.bold())
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 3)
                                        .background(Color(uiColor: .tertiarySystemFill), in: Capsule())
                                }
                            }

                            Divider()

                            ArabicDiffView(parts: verse.parts)
                                .padding(.vertical, 2)
                        }
                        .padding(16)
                        .background(Color(uiColor: .secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
                    }
                }
            }
            .padding(16)
        }
        .background(Color(uiColor: .systemGroupedBackground))
        .navigationTitle(group.title.isEmpty ? "تفاصيل المتشابهة" : group.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    onEdit(group)
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "pencil")
                        Text("تعديل")
                    }
                }
            }
        }
    }

    private func toArabicIndic(_ value: Int) -> String {
        let digits = ["0": "٠", "1": "١", "2": "٢", "3": "٣", "4": "٤",
                      "5": "٥", "6": "٦", "7": "٧", "8": "٨", "9": "٩"]
        return String(value).compactMap { digits[String($0)] }.joined()
    }
}

struct AutomatedGroupDetailView: View {
    let group: AutomatedGroup
    let library: MushafLibrary?
    let onCopyToPersonal: (AutomatedGroup) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                // Header card
                VStack(alignment: .leading, spacing: 12) {
                    HStack(spacing: 8) {
                        if !group.surahs.isEmpty {
                            Text(group.surahs.joined(separator: " • "))
                                .font(.headline.bold())
                                .foregroundStyle(MutshabehatMagazineTheme.color(for: String(group.id), customColor: group.color))
                        }
                        Spacer()
                        Text("\(group.verses.count) مواضع")
                            .font(.caption.bold())
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .background(Color(uiColor: .tertiarySystemFill), in: Capsule())

                        if group.copied {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundColor(.green)
                        }
                    }

                    Text(verbatim: group.title)
                        .font(.title2.bold())
                        .foregroundStyle(.primary)

                    HStack {
                        Label("قاعدة آلية رسمية", systemImage: "sparkles")
                            .font(.caption.bold())
                            .foregroundColor(.purple)
                        Spacer()
                        Button {
                            onCopyToPersonal(group)
                        } label: {
                            Label(group.copied ? "تم النسخ" : "نسخ للمجموعات الخاصة", systemImage: "plus.square.on.square")
                                .font(.caption.bold())
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.purple)
                    }
                }
                .padding(18)
                .background(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .fill(MutshabehatMagazineTheme.color(for: String(group.id), customColor: group.color).opacity(0.12))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .stroke(MutshabehatMagazineTheme.color(for: String(group.id), customColor: group.color).opacity(0.35), lineWidth: 1.2)
                )

                // Verses Section
                VStack(alignment: .leading, spacing: 14) {
                    Text("المواضع والآيات المتشابهة")
                        .font(.headline.bold())
                        .foregroundColor(.primary)

                    ForEach(Array(group.verses.enumerated()), id: \.offset) { _, verse in
                        VStack(alignment: .leading, spacing: 10) {
                            HStack {
                                Label("\(verse.surah) - آية \(toArabicIndic(verse.ayah))", systemImage: "book.fill")
                                    .font(.subheadline.bold())
                                    .foregroundColor(MutshabehatMagazineTheme.color(for: String(group.id), customColor: group.color))

                                Spacer()

                                if let label = verse.label, !label.isEmpty {
                                    Text(label)
                                        .font(.caption2.bold())
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 3)
                                        .background(Color(uiColor: .tertiarySystemFill), in: Capsule())
                                }
                            }

                            Divider()

                            ArabicDiffView(parts: verse.parts)
                                .padding(.vertical, 2)
                        }
                        .padding(16)
                        .background(Color(uiColor: .secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
                    }
                }
            }
            .padding(16)
        }
        .background(Color(uiColor: .systemGroupedBackground))
        .navigationTitle(group.title.isEmpty ? "تفاصيل المتشابهة الآلية" : group.title)
        .navigationBarTitleDisplayMode(.inline)
    }

    private func toArabicIndic(_ value: Int) -> String {
        let digits = ["0": "٠", "1": "١", "2": "٢", "3": "٣", "4": "٤",
                      "5": "٥", "6": "٦", "7": "٧", "8": "٨", "9": "٩"]
        return String(value).compactMap { digits[String($0)] }.joined()
    }
}

// MARK: - Mutshabehat Card Shell

private struct MutshabehatCardShell<Content: View>: View {
    let color: Color
    let isShowingDetails: Bool
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            content
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(color.opacity(isShowingDetails ? 0.16 : 0.22))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(color.opacity(0.65), lineWidth: 1.5)
        )
        .shadow(color: color.opacity(0.12), radius: 4, y: 2)
    }
}

// MARK: - Mutshabehat Card Title

private struct MutshabehatCardTitle: View {
    let title: String
    let color: Color
    let isShowingDetails: Bool

    var body: some View {
        HStack(spacing: 10) {
            Circle()
                .fill(color)
                .frame(width: 11, height: 11)

            Text(verbatim: title)
                .font(.headline.bold())
                .foregroundStyle(.primary)
                .multilineTextAlignment(.leading)

            Spacer(minLength: 8)

            Image(systemName: isShowingDetails ? "chevron.up.circle.fill" : "chevron.down.circle.fill")
                .font(.title3)
                .foregroundStyle(color)
        }
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel(title)
        .accessibilityHint(isShowingDetails ? "إخفاء تفاصيل المجموعة" : "إظهار تفاصيل المجموعة")
        .accessibilityValue(isShowingDetails ? "مفتوحة" : "مغلقة")
    }
}

// MARK: - Mutshabehat Verse Detail

private struct MutshabehatVerseDetail: View {
    let surah: String
    let ayah: Int
    let label: String?
    let parts: [PersonalPart]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Text(surah)
                    .font(.caption.bold())
                    .foregroundStyle(Color.accentColor)

                Text("— آية \(toArabicDigits(ayah))")
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.secondary)

                if let label, !label.isEmpty {
                    Text("(\(label))")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                Spacer()
            }

            ArabicDiffView(parts: parts)
        }
        .padding(12)
        .background(Color(uiColor: .secondarySystemBackground).opacity(0.85), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    private func toArabicDigits(_ number: Int) -> String {
        let digits = ["0": "٠", "1": "١", "2": "٢", "3": "٣", "4": "٤",
                      "5": "٥", "6": "٦", "7": "٧", "8": "٨", "9": "٩"]
        return String(number).compactMap { digits[String($0)] }.joined()
    }
}

// MARK: - Color Hex Extension

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 85, 185, 79)
        }

        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
