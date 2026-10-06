import Foundation
import MushafCore
import SwiftUI

/// Pure query logic for filtering ayat by status, review due date, or learning state.
enum AyahListQuery {
    static func keys(
        filter: AyahFilter,
        records: [AyahKey: AyahMemorizationRecord],
        index: QuranIndex,
        now: Date
    ) -> [AyahKey] {
        index.ayahKeys.filter { key in
            switch filter {
            case let .status(status):
                let currentStatus = records[key]?.status ?? .notMemorized
                return currentStatus == status
            case .dueForReview:
                guard let record = records[key] else { return false }
                return ReviewEngine.isDue(record, now: now)
            case .currentlyLearning:
                return records[key]?.isCurrentlyLearning == true
            }
        }
    }
}

/// A filterable list of ayat grouped by surah and Mushaf page, in Mushaf order.
struct AyahStatusListView: View {
    let initialFilter: AyahFilter
    let library: MushafLibrary
    let store: MemorizationStore
    let language: AppLanguage
    let openAyah: (Int, AyahKey) -> Void

    @State private var filter: AyahFilter

    init(initialFilter: AyahFilter, library: MushafLibrary, store: MemorizationStore,
         language: AppLanguage, openAyah: @escaping (Int, AyahKey) -> Void) {
        self.initialFilter = initialFilter
        self.library = library
        self.store = store
        self.language = language
        self.openAyah = openAyah
        _filter = State(initialValue: initialFilter)
    }

    private struct PageGroup: Identifiable {
        let page: Int
        var keys: [AyahKey]
        var id: Int { page }
    }

    private struct SurahGroup: Identifiable {
        let surah: Int
        var pages: [PageGroup]
        var id: Int { surah }
    }

    var body: some View {
        let keys = AyahListQuery.keys(filter: filter, records: store.allRecords, index: store.index, now: Date())
        let groups = groupedAyat(keys: keys)

        VStack(spacing: 0) {
            filterChipRow

            if groups.isEmpty {
                emptyState
            } else {
                List {
                    ForEach(groups) { surahGroup in
                        Section {
                            ForEach(surahGroup.pages) { pageGroup in
                                Text(verbatim: language == .arabic
                                     ? "صفحة \(MemorizationTheme.number(pageGroup.page, language: language))"
                                     : "Page \(pageGroup.page)")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(.secondary)

                                ForEach(pageGroup.keys, id: \.self) { key in
                                    ayahRow(key: key, page: pageGroup.page)
                                }
                            }
                        } header: {
                            Text(verbatim: surahName(surahGroup.surah))
                                .font(.headline)
                        }
                    }
                }
                .listStyle(.insetGrouped)
            }
        }
        .accessibilityIdentifier("memo-ayah-list")
        .navigationTitle(navigationTitle)
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Filters

    private var filterChipRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(MemorizationStatus.allCases, id: \.self) { status in
                    filterChip(
                        title: MemorizationTheme.label(status, language: language),
                        shape: MemorizationTheme.shape(status),
                        color: MemorizationTheme.color(status),
                        isSelected: filter == .status(status),
                        identifier: "memo-ayah-filter-\(status.rawValue)"
                    ) {
                        filter = .status(status)
                    }
                }

                filterChip(
                    title: language == .arabic ? "مستحقة للمراجعة" : "Due for review",
                    shape: nil,
                    color: .orange,
                    isSelected: filter == .dueForReview,
                    identifier: "memo-ayah-filter-due"
                ) {
                    filter = .dueForReview
                }

                filterChip(
                    title: language == .arabic ? "قيد الحفظ" : "Currently learning",
                    shape: nil,
                    color: .blue,
                    isSelected: filter == .currentlyLearning,
                    identifier: "memo-ayah-filter-learning"
                ) {
                    filter = .currentlyLearning
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
        }
        .accessibilityIdentifier("memo-ayah-filter")
    }

    private func filterChip(
        title: String,
        shape: String?,
        color: Color,
        isSelected: Bool,
        identifier: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 4) {
                if let shape {
                    Text(verbatim: shape)
                        .font(.caption2.weight(.bold))
                }
                Text(verbatim: title)
                    .font(.caption.weight(isSelected ? .semibold : .regular))
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .background(
                Capsule().fill(isSelected ? color.opacity(0.18) : Color.secondary.opacity(0.1))
            )
            .overlay(
                Capsule().strokeBorder(isSelected ? color : Color.clear, lineWidth: 1)
            )
            .foregroundStyle(isSelected ? color : .primary)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier)
    }

    // MARK: - Row

    private func ayahRow(key: AyahKey, page: Int) -> some View {
        let status = store.status(of: key)
        let name = surahName(key.surah)
        let num = MemorizationTheme.number(key.ayah, language: language)
        let pageText = language == .arabic
            ? "صفحة \(MemorizationTheme.number(page, language: language))"
            : "Page \(page)"

        return Button {
            openAyah(page, key)
        } label: {
            HStack(spacing: 12) {
                Text(verbatim: MemorizationTheme.shape(status))
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(MemorizationTheme.color(status))
                    .frame(width: 24, alignment: .leading)

                VStack(alignment: .leading, spacing: 2) {
                    Text(verbatim: "\(name) \(num)")
                        .font(.body.weight(.medium))
                        .foregroundStyle(.primary)
                    Text(verbatim: pageText)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                Image(systemName: "chevron.forward")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("memo-ayah-row-\(key.surah)-\(key.ayah)")
        .accessibilityLabel("\(name) \(num)، \(pageText)، \(MemorizationTheme.label(status, language: language))")
    }

    // MARK: - Empty State

    private var emptyState: some View {
        ContentUnavailableView {
            Label(language == .arabic ? "لا توجد آيات" : "No ayat", systemImage: "magnifyingglass")
        } description: {
            Text(verbatim: language == .arabic ? "لا توجد آيات تطابق هذا التصنيف." : "No ayat match this filter.")
        }
        .frame(maxHeight: .infinity)
    }

    // MARK: - Helpers

    private var navigationTitle: String {
        switch filter {
        case let .status(status):
            return MemorizationTheme.label(status, language: language)
        case .dueForReview:
            return language == .arabic ? "مستحقة للمراجعة" : "Due for review"
        case .currentlyLearning:
            return language == .arabic ? "قيد الحفظ" : "Currently learning"
        }
    }

    private func surahName(_ number: Int) -> String {
        library.surahNames[number] ?? "\(number)"
    }

    private func groupedAyat(keys: [AyahKey]) -> [SurahGroup] {
        var groups: [SurahGroup] = []
        for key in keys {
            let page = store.index.page(of: key) ?? 1
            if groups.last?.surah == key.surah {
                let sIndex = groups.count - 1
                if groups[sIndex].pages.last?.page == page {
                    let pIndex = groups[sIndex].pages.count - 1
                    groups[sIndex].pages[pIndex].keys.append(key)
                } else {
                    groups[sIndex].pages.append(PageGroup(page: page, keys: [key]))
                }
            } else {
                groups.append(SurahGroup(surah: key.surah, pages: [PageGroup(page: page, keys: [key])]))
            }
        }
        return groups
    }
}
