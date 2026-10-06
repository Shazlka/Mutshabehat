import MushafCore
import SwiftUI

public enum SurahSortOrder: String, CaseIterable, Sendable {
    case mushafOrder
    case mostMemorized
    case leastMemorized
}

public enum SurahFilter: String, CaseIterable, Sendable {
    case all
    case complete
    case incomplete
    case currentlyLearning
    case needsReview
}

public enum SurahListQuery: Sendable {
    public static func apply(
        surahs: [Surah],
        progress: [Int: SurahProgress],
        records: [AyahKey: AyahMemorizationRecord],
        searchText: String,
        sort: SurahSortOrder,
        filter: SurahFilter,
        now: Date = Date()
    ) -> [Surah] {
        var filtered = surahs

        let trimmedSearch = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedSearch.isEmpty {
            let canonicalQuery = QuranSearchNormalizer.canonical(trimmedSearch)
            filtered = filtered.filter { surah in
                let canonicalName = QuranSearchNormalizer.canonical(surah.name)
                return canonicalName.contains(canonicalQuery)
            }
        }

        switch filter {
        case .all:
            break
        case .complete:
            filtered = filtered.filter { surah in
                progress[surah.number]?.state == .complete
            }
        case .incomplete:
            filtered = filtered.filter { surah in
                progress[surah.number]?.state != .complete
            }
        case .currentlyLearning:
            let learningSurahs = Set(records.values.filter(\.isCurrentlyLearning).map(\.surah))
            filtered = filtered.filter { surah in
                learningSurahs.contains(surah.number)
            }
        case .needsReview:
            let dueSurahs = Set(records.values.filter { ReviewEngine.isDue($0, now: now) }.map(\.surah))
            filtered = filtered.filter { surah in
                dueSurahs.contains(surah.number)
            }
        }

        switch sort {
        case .mushafOrder:
            filtered.sort { $0.number < $1.number }
        case .mostMemorized:
            filtered.sort { a, b in
                let pA = progress[a.number]?.strictPercent ?? 0
                let pB = progress[b.number]?.strictPercent ?? 0
                if pA != pB { return pA > pB }
                return a.number < b.number
            }
        case .leastMemorized:
            filtered.sort { a, b in
                let pA = progress[a.number]?.strictPercent ?? 0
                let pB = progress[b.number]?.strictPercent ?? 0
                if pA != pB { return pA < pB }
                return a.number < b.number
            }
        }

        return filtered
    }

    public static func apply(
        surahs: [Surah],
        progress: [SurahProgress],
        records: [AyahKey: AyahMemorizationRecord],
        searchText: String,
        sort: SurahSortOrder,
        filter: SurahFilter,
        now: Date = Date()
    ) -> [Surah] {
        apply(
            surahs: surahs,
            progress: Dictionary(uniqueKeysWithValues: progress.map { ($0.surah, $0) }),
            records: records,
            searchText: searchText,
            sort: sort,
            filter: filter,
            now: now
        )
    }
}

struct SurahMixBar: View {
    let counts: [MemorizationStatus: Int]
    let total: Int
    var height: CGFloat = 3

    private static let order: [MemorizationStatus] = [.mastered, .memorizedWithErrors, .needsMushaf, .notMemorized]

    var body: some View {
        GeometryReader { proxy in
            HStack(spacing: 0) {
                ForEach(Self.order, id: \.self) { status in
                    let count = counts[status] ?? 0
                    let share = total > 0 ? CGFloat(count) / CGFloat(total) : 0
                    Rectangle()
                        .fill(MemorizationTheme.color(status).opacity(status == .notMemorized ? 0.35 : 0.9))
                        .frame(width: proxy.size.width * share)
                }
            }
        }
        .frame(height: height)
        .clipShape(Capsule())
        .accessibilityHidden(true)
    }
}

struct SurahListView: View {
    let library: MushafLibrary
    let store: MemorizationStore
    let language: AppLanguage
    let openSurah: (Int) -> Void

    @State private var searchText = ""
    @State private var sortOrder: SurahSortOrder = .mushafOrder
    @State private var filter: SurahFilter = .all

    private func copy(_ ar: String, _ en: String) -> String { language == .arabic ? ar : en }
    private func number(_ value: Int) -> String { MemorizationTheme.number(value, language: language) }

    private var progressMap: [Int: SurahProgress] {
        Dictionary(uniqueKeysWithValues: store.snapshot.surahs.map { ($0.surah, $0) })
    }

    private var displayedSurahs: [Surah] {
        SurahListQuery.apply(
            surahs: library.surahs,
            progress: progressMap,
            records: store.allRecords,
            searchText: searchText,
            sort: sortOrder,
            filter: filter,
            now: Date()
        )
    }

    var body: some View {
        VStack(spacing: 0) {
            headerControls
            surahList
        }
        .navigationTitle(copy("السور", "Surahs"))
        .navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("memo-surah-list")
    }

    private var headerControls: some View {
        VStack(spacing: 8) {
            TextField(copy("ابحث عن سورة...", "Search surah..."), text: $searchText)
                .textFieldStyle(.roundedBorder)
                .accessibilityIdentifier("memo-surah-search")

            HStack {
                sortMenu
                Spacer()
                filterMenu
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
    }

    private var sortTitle: String {
        switch sortOrder {
        case .mushafOrder: copy("ترتيب المصحف", "Mushaf order")
        case .mostMemorized: copy("الأكثر حفظاً", "Most memorized")
        case .leastMemorized: copy("الأقل حفظاً", "Least memorized")
        }
    }

    private var filterTitle: String {
        switch filter {
        case .all: copy("الكل", "All")
        case .complete: copy("المكتمل", "Complete")
        case .incomplete: copy("غير المكتمل", "Incomplete")
        case .currentlyLearning: copy("قيد الحفظ", "Currently learning")
        case .needsReview: copy("يحتاج مراجعة", "Needs review")
        }
    }

    private var sortMenu: some View {
        Menu {
            Button(language == .arabic ? "ترتيب المصحف" : "Mushaf order") { sortOrder = .mushafOrder }
            Button(language == .arabic ? "الأكثر حفظاً" : "Most memorized") { sortOrder = .mostMemorized }
            Button(language == .arabic ? "الأقل حفظاً" : "Least memorized") { sortOrder = .leastMemorized }
        } label: {
            HStack(spacing: 4) {
                Image(systemName: "arrow.up.arrow.down")
                Text(verbatim: copy("الترتيب: \(sortTitle)", "Sort: \(sortTitle)"))
            }
            .font(.subheadline)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(RoundedRectangle(cornerRadius: 8).fill(Color.secondary.opacity(0.12)))
        }
        .accessibilityIdentifier("memo-surah-sort")
    }

    private var filterMenu: some View {
        Menu {
            Button(language == .arabic ? "الكل" : "All") { filter = .all }
            Button(language == .arabic ? "المكتمل" : "Complete") { filter = .complete }
            Button(language == .arabic ? "غير المكتمل" : "Incomplete") { filter = .incomplete }
            Button(language == .arabic ? "قيد الحفظ" : "Currently learning") { filter = .currentlyLearning }
            Button(language == .arabic ? "يحتاج مراجعة" : "Needs review") { filter = .needsReview }
        } label: {
            HStack(spacing: 4) {
                Image(systemName: "line.3.horizontal.decrease")
                Text(verbatim: copy("تصفية: \(filterTitle)", "Filter: \(filterTitle)"))
            }
            .font(.subheadline)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(RoundedRectangle(cornerRadius: 8).fill(Color.secondary.opacity(0.12)))
        }
        .accessibilityIdentifier("memo-surah-filter")
    }

    private var surahList: some View {
        List(displayedSurahs) { surah in
            surahRow(surah)
                .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
        }
        .listStyle(.plain)
    }

    private func surahRow(_ surah: Surah) -> some View {
        let p = progressMap[surah.number]
        let strict = p?.strictPercent ?? 0
        let masteredCount = p?.counts[.mastered, default: 0] ?? 0
        let masteredText = number(masteredCount)
        let totalText = number(surah.ayahCount)
        let ratioLabel = copy("متقن: \(masteredText) / \(totalText)", "Mastered: \(masteredText) / \(totalText)")

        return Button {
            openSurah(surah.number)
        } label: {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(verbatim: "\(number(surah.number)). \(surah.name)")
                        .font(.headline)
                        .foregroundStyle(.primary)
                    Spacer()
                    Text(verbatim: MemorizationTheme.percent(strict, language: language))
                        .font(.subheadline.weight(.semibold))
                        .monospacedDigit()
                        .foregroundStyle(MemorizationTheme.color(.mastered))
                }
                HStack {
                    Text(verbatim: ratioLabel)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Spacer()
                }
                SurahMixBar(counts: p?.counts ?? [:], total: surah.ayahCount, height: 3)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("memo-surah-row-\(surah.number)")
    }
}
