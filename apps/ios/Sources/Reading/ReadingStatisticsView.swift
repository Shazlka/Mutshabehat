import MushafCore
import SwiftUI

struct ReadingStatisticsView: View {
    let library: MushafLibrary
    let onSelectSurah: (Surah, Int) -> Void

    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var tracker = ReadingTracker.shared
    @State private var surahsProgress: [SurahProgress] = []
    @State private var overview: ReadingStatsOverview? = nil
    @State private var weeklyDays: [WeeklyDayStatus] = []
    @State private var recentDays: [ReadingDayRecord] = []
    @State private var selectedFilter: SurahProgressFilter = .all
    @State private var searchText: String = ""
    @State private var showingAddSessionSheet: Bool = CommandLine.arguments.contains("-open-add-session")

    private var currentPositionPage: Int {
        ReadingPosition().page
    }

    private var currentPositionSurah: Surah? {
        guard let p = library.page(currentPositionPage),
              let firstWord = p.lines.first?.words.first else {
            return library.surahs.first
        }
        return library.surahs.first { $0.number == firstWord.ayahKey.surah }
    }

    private var currentPositionAyah: Int {
        guard let p = library.page(currentPositionPage),
              let firstWord = p.lines.first?.words.first else {
            return 1
        }
        return firstWord.ayahKey.ayah
    }

    private var filteredSurahs: [SurahProgress] {
        surahsProgress.filter { item in
            // 1. Text Search Filter
            let matchesSearch: Bool
            if searchText.trimmingCharacters(in: .whitespaces).isEmpty {
                matchesSearch = true
            } else {
                let q = searchText.trimmingCharacters(in: .whitespaces)
                matchesSearch = item.surahName.localizedCaseInsensitiveContains(q) || "\(item.surahNumber)" == q
            }
            guard matchesSearch else { return false }

            // 2. Category Filter (All, Remaining, Completed, Started)
            switch selectedFilter {
            case .all:
                return true
            case .remaining:
                return !item.isCompleted
            case .completed:
                return item.isCompleted
            case .started:
                return item.isStarted
            }
        }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                if let stats = overview {
                    // 1. The current khatma and the lifetime figures, in one section
                    KhatmaSummaryCard(stats: stats)

                    // 3. Continue Reading Banner
                    if let surah = currentPositionSurah {
                        ContinueReadingBanner(
                            surahName: surah.name,
                            ayahNumber: currentPositionAyah,
                            pageNumber: currentPositionPage
                        ) {
                            onSelectSurah(surah, currentPositionPage)
                            dismiss()
                        }
                    }

                    // 4. 7-Day Weekly Streak Card
                    WeeklyStreakTrackerCard(
                        currentStreak: stats.currentStreak,
                        longestStreak: stats.longestStreak,
                        days: weeklyDays,
                        onAddSession: { showingAddSessionSheet = true }
                    )

                    // 5. Daily Reading History (Hours and minutes per day)
                    DailyReadingHistoryCard(days: recentDays)
                }

                // 6. Khatma by Surah Section with Remaining/Completed Filters
                VStack(alignment: .leading, spacing: 14) {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("الختم على حسب السورة")
                                .font(.title3.weight(.bold))
                                .foregroundColor(.primary)
                            Text("متابعة إنجاز كل سورة والمتبقي منها")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        Spacer()
                        Text("\(surahsProgress.filter(\.isCompleted).count) / 114")
                            .font(.subheadline.bold())
                            .foregroundColor(.progress)
                    }
                    .padding(.horizontal, 16)

                    // Search Bar
                    HStack {
                        Image(systemName: "magnifyingglass")
                            .foregroundColor(.secondary)
                        TextField("تصفية حسب الاسم أو الرقم...", text: $searchText)
                            .textFieldStyle(.plain)
                        if !searchText.isEmpty {
                            Button {
                                searchText = ""
                            } label: {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                    .padding(10)
                    .background(Color(uiColor: .secondarySystemGroupedBackground))
                    .cornerRadius(12)
                    .padding(.horizontal, 16)

                    // Filter Chips (All, Remaining, Completed, Started)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(SurahProgressFilter.allCases) { f in
                                let count: Int = {
                                    switch f {
                                    case .all: return surahsProgress.count
                                    case .remaining: return surahsProgress.filter { !$0.isCompleted }.count
                                    case .completed: return surahsProgress.filter(\.isCompleted).count
                                    case .started: return surahsProgress.filter(\.isStarted).count
                                    }
                                }()

                                FilterChip(isSelected: selectedFilter == f,
                                           unselectedFill: Color(uiColor: .secondarySystemGroupedBackground)) {
                                    withAnimation(.easeInOut(duration: 0.2)) {
                                        selectedFilter = f
                                    }
                                } label: {
                                    HStack(spacing: 6) {
                                        Text(f.title)
                                        Text("(\(ArabicDigits.string(count)))")
                                            .font(.caption2)
                                    }
                                }
                            }
                        }
                        .padding(.horizontal, 16)
                    }

                    // Swipe Instruction Capsule
                    HStack(spacing: 6) {
                        Image(systemName: "hand.draw")
                            .font(.caption)
                        Text("اسحب أي سورة لليمين لإكمالها أو إلغائها في الختمة")
                            .font(.caption2)
                    }
                    .foregroundColor(.secondary)
                    .padding(.horizontal, 16)

                    // Surah List
                    LazyVStack(spacing: 8) {
                        if filteredSurahs.isEmpty {
                            VStack(spacing: 8) {
                                Image(systemName: "tray")
                                    .scaledFont(size: 32)
                                    .foregroundColor(.secondary)
                                Text("لا توجد سور مطابقة للتصفية")
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 32)
                        } else {
                            ForEach(filteredSurahs, id: \.surahNumber) { item in
                                SwipeableSurahProgressRow(
                                    progress: item,
                                    onSelect: {
                                        if let surah = library.surahs.first(where: { $0.number == item.surahNumber }) {
                                            let targetPage = tracker.nextUnreadPage(for: surah, library: library)
                                            onSelectSurah(surah, targetPage)
                                            dismiss()
                                        }
                                    },
                                    onToggleCompleted: {
                                        toggleSurahCompletion(for: item.surahNumber)
                                    }
                                )
                            }
                        }
                    }
                    .padding(.horizontal, 16)
                }
                .padding(.top, 4)
            }
            .padding(.vertical, 16)
        }
        .background(Color(uiColor: .systemGroupedBackground))
        .navigationTitle("إحصائيات القراءة والختمة")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showingAddSessionSheet = true
                } label: {
                    Label("أضف جلسة", systemImage: "plus")
                        .font(.body.bold())
                        .foregroundColor(.progress)
                }
            }
        }
        .sheet(isPresented: $showingAddSessionSheet) {
            AddReadingSessionView(library: library) {
                loadData()
            }
        }
        .onAppear {
            loadData()
            if ICloudDatabaseSyncService.shared.autoSyncEnabled {
                Task {
                    await ICloudDatabaseSyncService.shared.automaticSync(library: library)
                    loadData()
                }
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .readingDatabaseDidUpdate)) { _ in
            loadData()
        }
    }

    private func toggleSurahCompletion(for surahNumber: Int) {
        guard let idx = surahsProgress.firstIndex(where: { $0.surahNumber == surahNumber }) else { return }
        let current = surahsProgress[idx]
        let willComplete = !current.isCompleted
        let updated = SurahProgress(
            surahNumber: current.surahNumber,
            surahName: current.surahName,
            readAyahsCount: willComplete ? current.totalAyahsCount : 0,
            totalAyahsCount: current.totalAyahsCount,
            firstPage: current.firstPage
        )
        withMotion {
            surahsProgress[idx] = updated
        }

        Task {
            tracker.markSurahCompleted(surahNumber, completed: willComplete, library: library)
            overview = tracker.statsOverview(library: library)
            weeklyDays = tracker.currentWeekReadingDays()
            recentDays = QuranReadingDatabase.shared.allReadingDays()
        }
    }

    private func loadData() {
        overview = tracker.statsOverview(library: library)
        surahsProgress = tracker.allSurahProgress(library: library)
        weeklyDays = tracker.currentWeekReadingDays()
        recentDays = QuranReadingDatabase.shared.allReadingDays()
    }
}
