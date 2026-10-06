import MushafCore
import SwiftUI

/// The module's opening screen: how much is truly memorized, the three tiles, where I am now, and the
/// short sections that lead to the detail screens. Every figure comes from `store.snapshot`.
struct DashboardView: View {
    let library: MushafLibrary
    let store: MemorizationStore
    let language: AppLanguage
    let navigate: (MemorizationRoute) -> Void
    let update: (MemorizationSelection?) -> Void
    let openInMushaf: (Int, AyahKey?) -> Void
    let startReview: (MemorizationSelection, String) -> Void

    @State private var searchText = ""
    @State private var searchResult: SelectionTarget?

    private var snapshot: MemorizationSnapshot { store.snapshot }

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                searchField
                headline
                tiles
                currentCard
                statusSection
                suggestionSection
                progressSection
                reviewSection
                activitySection
                GoalsSection(store: store, library: library, language: language)
                backupSection
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 24)
        }
        .scrollDismissesKeyboard(.interactively)
    }

    private func copy(_ ar: String, _ en: String) -> String { language == .arabic ? ar : en }
    private func number(_ value: Int) -> String { MemorizationTheme.number(value, language: language) }
    private func percent(_ value: Double) -> String { MemorizationTheme.percent(value, language: language) }
    private func surahName(_ number: Int) -> String { library.surahNames[number] ?? "\(number)" }

    // MARK: Search

    private var searchField: some View {
        VStack(alignment: .leading, spacing: 6) {
            TextField(copy("ابحث: البقرة ٢٥٥ · صفحة ٤٢ · الجزء ٣٠", "Search: Baqarah 255 · page 42 · juz 30"),
                      text: $searchText)
                .textFieldStyle(.roundedBorder)
                .submitLabel(.search)
                .onSubmit(runSearch)
                .accessibilityIdentifier("memo-search")
            if let target = searchResult {
                searchResultRow(target)
            }
        }
    }

    private func runSearch() {
        searchResult = SelectionParser.parse(searchText, surahNames: library.surahNames, index: store.index)
    }

    @ViewBuilder
    private func searchResultRow(_ target: SelectionTarget) -> some View {
        let title = describe(target)
        Button {
            switch target {
            case let .page(page): openInMushaf(page, nil)
            case let .ayah(key): openInMushaf(store.index.page(of: key) ?? 1, key)
            case let .surahDetail(number): navigate(.surahDetail(number))
            case .juz, .selection: update(target.asSelection)
            }
        } label: {
            HStack {
                Text(verbatim: title).font(.subheadline.weight(.semibold))
                Spacer()
                Image(systemName: "chevron.forward").font(.caption)
            }
            .padding(10)
            .background(RoundedRectangle(cornerRadius: 10).fill(Color.secondary.opacity(0.1)))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("memo-search-result")
        .accessibilityLabel(title)
    }

    private func describe(_ target: SelectionTarget) -> String {
        switch target {
        case let .surahDetail(n): copy("سورة \(surahName(n))", "Surah \(surahName(n))")
        case let .page(n): copy("صفحة \(number(n))", "Page \(number(n))")
        case let .ayah(key): "\(surahName(key.surah)) \(number(key.ayah))"
        case let .juz(n): copy("الجزء \(number(n))", "Juz \(number(n))")
        case .selection: copy("تحديد", "Selection")
        }
    }

    // MARK: Headline

    private var headline: some View {
        let total = max(1, snapshot.totalAyahs)
        let recite = Double(snapshot.canReciteCount) / Double(total) * 100
        return VStack(spacing: 6) {
            if let completed = store.quranCompletedAt, snapshot.counts[.mastered] == snapshot.totalAyahs {
                Text(verbatim: copy("تم حفظ القرآن كاملاً", "Quran memorized in full"))
                    .font(.headline)
                    .foregroundStyle(MemorizationTheme.color(.mastered))
                    .accessibilityIdentifier("memo-completed")
                Text(verbatim: completed.formatted(date: .abbreviated, time: .omitted))
                    .font(.caption).foregroundStyle(.secondary)
            }
            Text(verbatim: copy("الحفظ المتقن", "Mastered"))
                .font(.subheadline).foregroundStyle(.secondary)
            Text(verbatim: percent(snapshot.strictPercent))
                .font(.system(size: 54, weight: .semibold, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(MemorizationTheme.color(.mastered))
                .accessibilityIdentifier("memo-strict")
                .accessibilityLabel(copy("الحفظ المتقن \(percent(snapshot.strictPercent))",
                                         "Mastered \(percent(snapshot.strictPercent))"))
            HStack(spacing: 18) {
                labeled(copy("تقدم الحفظ", "Learning progress"), percent(snapshot.learningPercent), "memo-learning")
                labeled(copy("قادر على التلاوة", "Can recite"), percent(recite), "memo-recite")
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 6)
    }

    private func labeled(_ title: String, _ value: String, _ identifier: String) -> some View {
        VStack(spacing: 2) {
            Text(verbatim: value).font(.title3.weight(.semibold)).monospacedDigit()
            Text(verbatim: title).font(.caption).foregroundStyle(.secondary)
        }
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier(identifier)
    }

    // MARK: Tiles

    private var tiles: some View {
        HStack(spacing: 10) {
            tile(title: copy("السور", "Surahs"),
                 value: "\(number(snapshot.completedSurahs)) / \(number(snapshot.surahs.count))",
                 detail: copy("جزئي: \(number(snapshot.partialSurahs))", "Partial: \(number(snapshot.partialSurahs))"),
                 identifier: "memo-tile-surahs") { navigate(.surahList) }
            tile(title: copy("الصفحات", "Pages"),
                 value: "\(number(snapshot.pagesFullyMastered)) / \(number(snapshot.pages.count))",
                 detail: "≈ " + MemorizationTheme.decimal(snapshot.pageEquivalentMastered, language: language),
                 identifier: "memo-tile-pages") { navigate(.pageGrid) }
            tile(title: copy("الآيات", "Ayat"),
                 value: "\(number(snapshot.counts[.mastered] ?? 0)) / \(number(snapshot.totalAyahs))",
                 detail: copy("تلاوة: \(number(snapshot.canReciteCount))", "Recite: \(number(snapshot.canReciteCount))"),
                 identifier: "memo-tile-ayat") { navigate(.ayahList(.status(.mastered))) }
        }
    }

    private func tile(title: String, value: String, detail: String, identifier: String,
                      action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Text(verbatim: title).font(.caption).foregroundStyle(.secondary)
                Text(verbatim: value).font(.headline).monospacedDigit().minimumScaleFactor(0.7).lineLimit(1)
                Text(verbatim: detail).font(.caption2).foregroundStyle(.secondary).minimumScaleFactor(0.7).lineLimit(1)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(RoundedRectangle(cornerRadius: 12).fill(Color.secondary.opacity(0.1)))
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier(identifier)
    }

    // MARK: Current position

    private var currentCard: some View {
        Group {
            if let range = store.currentPosition {
                let keys = store.index.ayat(from: range.from, to: range.to)
                let mastered = keys.filter { store.status(of: $0) == .mastered }.count
                VStack(alignment: .leading, spacing: 8) {
                    Text(verbatim: copy("الحفظ الحالي", "Currently memorizing")).font(.subheadline).foregroundStyle(.secondary)
                    Text(verbatim: rangeText(range)).font(.headline)
                        .accessibilityIdentifier("memo-current-range")
                    ProgressView(value: Double(mastered), total: Double(max(1, keys.count)))
                        .tint(MemorizationTheme.color(.mastered))
                    Text(verbatim: "\(number(mastered)) / \(number(keys.count)) " + copy("آيات", "ayat"))
                        .font(.caption).foregroundStyle(.secondary)
                    HStack {
                        Button(copy("فتح في المصحف", "Open in Mushaf")) {
                            openInMushaf(store.index.page(of: range.from) ?? 1, range.from)
                        }
                        Spacer()
                        Button(copy("تحديث الحفظ", "Update")) {
                            update(.span(from: range.from, to: range.to))
                        }
                    }
                    .font(.subheadline)
                }
            } else {
                VStack(alignment: .leading, spacing: 4) {
                    Text(verbatim: copy("الحفظ الحالي", "Currently memorizing")).font(.subheadline).foregroundStyle(.secondary)
                    Text(verbatim: copy("لم تحدد موضع الحفظ الحالي بعد. اختره من «تحديث الحفظ».",
                                        "No current position yet. Choose one in “Update memorization”."))
                        .font(.footnote).foregroundStyle(.secondary)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color.secondary.opacity(0.1)))
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("memo-current")
    }

    private func rangeText(_ range: (from: AyahKey, to: AyahKey)) -> String {
        if range.from.surah == range.to.surah {
            return "\(surahName(range.from.surah)) \(number(range.from.ayah))–\(number(range.to.ayah))"
        }
        return "\(surahName(range.from.surah)) \(number(range.from.ayah)) → \(surahName(range.to.surah)) \(number(range.to.ayah))"
    }

    // MARK: Status bar

    private var statusSection: some View {
        let total = max(1, snapshot.totalAyahs)
        return VStack(alignment: .leading, spacing: 10) {
            GeometryReader { proxy in
                HStack(spacing: 1) {
                    ForEach(MemorizationStatus.allCases, id: \.self) { status in
                        let count = snapshot.counts[status] ?? 0
                        Button { navigate(.ayahList(.status(status))) } label: {
                            Rectangle()
                                .fill(MemorizationTheme.color(status).opacity(status == .notMemorized ? 0.35 : 0.9))
                        }
                        .buttonStyle(.plain)
                        .frame(width: max(0, proxy.size.width * CGFloat(count) / CGFloat(total)))
                        .accessibilityIdentifier("memo-status-seg-\(status.rawValue)")
                        .accessibilityLabel(MemorizationTheme.label(status, language: language))
                    }
                }
            }
            .frame(height: 12)
            .clipShape(Capsule())
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("memo-status-bar")

            ForEach(MemorizationStatus.allCases, id: \.self) { status in
                Button { navigate(.ayahList(.status(status))) } label: {
                    HStack {
                        Text(verbatim: MemorizationTheme.shape(status))
                            .frame(width: 28)
                            .foregroundStyle(MemorizationTheme.color(status))
                        Text(verbatim: MemorizationTheme.label(status, language: language))
                        Spacer()
                        Text(verbatim: number(snapshot.counts[status] ?? 0)).monospacedDigit().foregroundStyle(.secondary)
                    }
                    .font(.subheadline)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("memo-status-row-\(status.rawValue)")
            }
        }
    }

    // MARK: Progress, review, activity

    private var progressSection: some View {
        ProgressSection(store: store, language: language)
    }

    @ViewBuilder
    private var suggestionSection: some View {
        if let suggestion = store.suggestion {
            SuggestionCard(suggestion: suggestion, library: library, language: language,
                           openSurah: { navigate(.surahDetail($0)) },
                           startReview: { startReview(.surah($0), copy("مراجعة سورة \(surahName($0))", "Review \(surahName($0))")) })
        }
    }

    private var reviewSection: some View {
        let now = Date()
        let due = DueReview.dueAyat(records: store.allRecords, now: now)
        let overdue = DueReview.mostOverdueSurahs(records: store.allRecords, now: now, limit: 3)
        return sectionCard(title: copy("يحتاج مراجعة", "Needs review"), identifier: "memo-review") {
            Button { navigate(.ayahList(.dueForReview)) } label: {
                HStack {
                    Text(verbatim: copy("آيات مستحقة للمراجعة", "Ayat due for review"))
                    Spacer()
                    Text(verbatim: number(due.count)).monospacedDigit()
                }
                .font(.subheadline)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(copy("آيات مستحقة للمراجعة", "Ayat due for review"))
            .accessibilityValue(number(due.count))
            .accessibilityIdentifier("memo-due-count")
            ForEach(overdue, id: \.surah) { row in
                HStack {
                    Text(verbatim: surahName(row.surah))
                    Spacer()
                    Text(verbatim: number(row.dueCount)).monospacedDigit().foregroundStyle(.secondary)
                }
                .font(.footnote)
                .accessibilityElement(children: .combine)
                .accessibilityIdentifier("memo-due-row-\(row.surah)")
            }
            Button(copy("ابدأ المراجعة", "Start review")) {
                startReview(.ayat(Set(due)), copy("مراجعة", "Review"))
            }
            .disabled(due.isEmpty)
            .accessibilityIdentifier("memo-review-start")
        }
    }

    private var activitySection: some View {
        let recent = store.batches(limit: 3)
        return sectionCard(title: copy("آخر النشاط", "Recent activity"), identifier: "memo-activity") {
            if recent.isEmpty {
                Text(verbatim: copy("لا توجد تحديثات بعد.", "No updates yet.")).font(.footnote).foregroundStyle(.secondary)
            } else {
                ForEach(recent, id: \.id) { batch in
                    HStack {
                        Text(verbatim: batch.undoneAt == nil ? batch.label : batch.label + " ⟲").lineLimit(1)
                        Spacer()
                        Text(verbatim: number(batch.ayahCount)).monospacedDigit().foregroundStyle(.secondary)
                    }
                    .font(.subheadline)
                }
                Button(copy("عرض الكل", "Show all")) { navigate(.history) }
                    .font(.footnote)
                    .accessibilityIdentifier("memo-history-link")
            }
        }
    }

    @ViewBuilder
    private var backupSection: some View {
        if let controller = library.backupController {
            sectionCard(title: copy("النسخ الاحتياطي", "Backup"), identifier: "memo-backup-section") {
                if controller.needsAttention {
                    Text(verbatim: controller.folderAvailable
                         ? copy("لم تتم نسخة احتياطية منذ أكثر من سبعة أيام", "No backup for over seven days")
                         : copy("لم يُحدَّد مجلد iCloud للنسخ الاحتياطي", "No iCloud backup folder is set"))
                        .font(.footnote).foregroundStyle(.orange)
                        .accessibilityIdentifier("memo-backup-banner")
                }
                Button(copy("إعدادات النسخ الاحتياطي والاستعادة", "Backup and restore")) { navigate(.backup) }
                    .font(.subheadline)
                    .accessibilityIdentifier("memo-backup-link")
            }
        }
    }

    private func sectionCard(title: String, identifier: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(verbatim: title).font(.subheadline).foregroundStyle(.secondary)
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color.secondary.opacity(0.1)))
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier(identifier)
    }
}
