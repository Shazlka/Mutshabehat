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
                    // 1. Circular Completion Ring Header
                    KhatmaCircularRingCard(stats: stats)

                    // 2. Summary Grid (Total Pages, Pages Remaining, Khatmas, Cumulative Ayahs & Time)
                    KhatmaPagesScorecard(stats: stats)

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
                                .font(.system(size: 19, weight: .bold))
                                .foregroundColor(.primary)
                            Text("متابعة إنجاز كل سورة والمتبقي منها")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        Spacer()
                        Text("\(surahsProgress.filter(\.isCompleted).count) / 114")
                            .font(.subheadline.bold())
                            .foregroundColor(.green)
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

                                Button {
                                    withAnimation(.easeInOut(duration: 0.2)) {
                                        selectedFilter = f
                                    }
                                } label: {
                                    HStack(spacing: 6) {
                                        Text(f.title)
                                            .font(.caption.bold())
                                        Text("(\(count))")
                                            .font(.caption2)
                                    }
                                    .padding(.horizontal, 14)
                                    .padding(.vertical, 8)
                                    .background(selectedFilter == f ? Color.green : Color(uiColor: .secondarySystemGroupedBackground))
                                    .foregroundColor(selectedFilter == f ? .white : .primary)
                                    .clipShape(Capsule())
                                    .shadow(color: Color.black.opacity(selectedFilter == f ? 0.08 : 0.02), radius: 2, y: 1)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal, 16)
                    }

                    // Surah List
                    LazyVStack(spacing: 8) {
                        if filteredSurahs.isEmpty {
                            VStack(spacing: 8) {
                                Image(systemName: "tray")
                                    .font(.system(size: 32))
                                    .foregroundColor(.secondary)
                                Text("لا توجد سور مطابقة للتصفية")
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 32)
                        } else {
                            ForEach(filteredSurahs) { item in
                                Button {
                                    if let surah = library.surahs.first(where: { $0.number == item.surahNumber }) {
                                        let targetPage = tracker.nextUnreadPage(for: surah, library: library)
                                        onSelectSurah(surah, targetPage)
                                        dismiss()
                                    }
                                } label: {
                                    SurahProgressItemRow(progress: item)
                                }
                                .buttonStyle(.plain)
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
                        .foregroundColor(.green)
                }
            }
        }
        .sheet(isPresented: $showingAddSessionSheet) {
            AddReadingSessionView(library: library) {
                loadData()
            }
        }
        .onAppear(perform: loadData)
    }

    private func loadData() {
        overview = tracker.statsOverview(library: library)
        surahsProgress = tracker.allSurahProgress(library: library)
        weeklyDays = tracker.currentWeekReadingDays()
        recentDays = QuranReadingDatabase.shared.allReadingDays()
    }
}

// MARK: - Circular Progress Ring Card

private struct KhatmaCircularRingCard: View {
    let stats: ReadingStatsOverview

    var body: some View {
        VStack(spacing: 16) {
            ZStack {
                // Background Track Ring
                Circle()
                    .stroke(Color.green.opacity(0.15), lineWidth: 16)
                    .frame(width: 170, height: 170)

                // Animated Progress Ring with emerald gradient
                Circle()
                    .trim(from: 0, to: max(0.001, min(1.0, CGFloat(stats.progressPercentage / 100.0))))
                    .stroke(
                        LinearGradient(
                            colors: [Color.green, Color(red: 0.18, green: 0.82, blue: 0.55)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        style: StrokeStyle(lineWidth: 16, lineCap: .round)
                    )
                    .rotationEffect(.degrees(-90))
                    .frame(width: 170, height: 170)

                // Percentage & Title in Center
                VStack(spacing: 4) {
                    Text(String(format: "%.1f%%", stats.progressPercentage))
                        .font(.system(size: 34, weight: .bold, design: .rounded))
                        .foregroundColor(.primary)

                    Text("ختم القرآن")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(.secondary)
                }
            }
            .padding(.top, 8)

            Text("الختمة الحالية (#\(stats.currentKhatma.khatmaNumber)) • \(stats.totalAyahsReadInCurrentKhatma) من \(stats.totalQuranAyahs) آية")
                .font(.footnote)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(20)
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .cornerRadius(20)
        .padding(.horizontal, 16)
    }
}

// MARK: - Pages Scorecard

private func formatArabicIndic(_ number: Int) -> String {
    let digits = ["0": "٠", "1": "١", "2": "٢", "3": "٣", "4": "٤",
                  "5": "٥", "6": "٦", "7": "٧", "8": "٨", "9": "٩"]
    return String(number).compactMap { digits[String($0)] }.joined()
}

private struct KhatmaPagesScorecard: View {
    let stats: ReadingStatsOverview

    var body: some View {
        VStack(spacing: 12) {
            // Prominent Hero Card for Cumulative Reading Duration (Hours and Minutes)
            HStack(spacing: 14) {
                ZStack {
                    Circle()
                        .fill(Color.blue.opacity(0.12))
                        .frame(width: 46, height: 46)
                    Image(systemName: "clock.badge.checkmark.fill")
                        .font(.system(size: 20, weight: .bold))
                        .foregroundColor(.blue)
                }

                VStack(alignment: .leading, spacing: 3) {
                    Text("إجمالي وقت التلاوة (تراكمي)")
                        .font(.caption.bold())
                        .foregroundColor(.secondary)
                    HStack(alignment: .firstTextBaseline, spacing: 4) {
                        Text(stats.formattedLifetimeDuration)
                            .font(.system(size: 24, weight: .bold, design: .rounded))
                            .foregroundColor(.primary)
                    }
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 2) {
                    Text("أيام التلاوة")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                    HStack(spacing: 4) {
                        Image(systemName: "calendar")
                            .foregroundColor(.blue)
                            .font(.caption)
                        Text(formatArabicIndic(stats.totalReadingDays))
                            .font(.headline.bold())
                            .foregroundColor(.blue)
                        Text("يوم")
                            .font(.caption2.bold())
                            .foregroundColor(.secondary)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(Color(uiColor: .secondarySystemGroupedBackground))
            .cornerRadius(18)

            // Prominent Hero Card for Cumulative Ayahs Read
            HStack(spacing: 14) {
                ZStack {
                    Circle()
                        .fill(Color.purple.opacity(0.12))
                        .frame(width: 46, height: 46)
                    Image(systemName: "sparkles")
                        .font(.system(size: 20, weight: .bold))
                        .foregroundColor(.purple)
                }

                VStack(alignment: .leading, spacing: 3) {
                    Text("مجموع الآيات المقروءة (تراكمي)")
                        .font(.caption.bold())
                        .foregroundColor(.secondary)
                    HStack(alignment: .firstTextBaseline, spacing: 4) {
                        Text(formatArabicIndic(stats.lifetimeAyahsRead))
                            .font(.system(size: 26, weight: .bold, design: .rounded))
                            .foregroundColor(.primary)
                        Text("آية")
                            .font(.subheadline.bold())
                            .foregroundColor(.purple)
                    }
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 2) {
                    Text("الختمات المكتملة")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                    HStack(spacing: 4) {
                        Image(systemName: "checkmark.seal.fill")
                            .foregroundColor(.green)
                            .font(.caption)
                        Text(formatArabicIndic(stats.completedKhatmasCount))
                            .font(.headline.bold())
                            .foregroundColor(.green)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(Color(uiColor: .secondarySystemGroupedBackground))
            .cornerRadius(18)

            // Grid for Pages Status
            HStack(spacing: 10) {
                ScorecardBox(
                    title: "إجمالي الصفحات",
                    value: "٦٠٤",
                    icon: "book.pages",
                    tint: .blue
                )

                ScorecardBox(
                    title: "الصفحات المتبقية",
                    value: formatArabicIndic(stats.remainingPages),
                    icon: "bookmark.slash",
                    tint: .orange
                )

                ScorecardBox(
                    title: "الصفحات المنجزة",
                    value: formatArabicIndic(stats.totalPagesReadInCurrentKhatma),
                    icon: "checkmark.circle.fill",
                    tint: .green
                )
            }
        }
        .padding(.horizontal, 16)
    }
}

private struct ScorecardBox: View {
    let title: String
    let value: String
    let icon: String
    let tint: Color

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .foregroundColor(tint)
                .font(.system(size: 20))

            Text(value)
                .font(.system(size: 22, weight: .bold, design: .rounded))
                .foregroundColor(.primary)

            Text(title)
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .padding(.horizontal, 6)
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .cornerRadius(16)
    }
}

// MARK: - Continue Reading Banner

private struct ContinueReadingBanner: View {
    let surahName: String
    let ayahNumber: Int
    let pageNumber: Int
    let onContinue: () -> Void

    var body: some View {
        Button(action: onContinue) {
            HStack(spacing: 14) {
                ZStack {
                    Circle()
                        .fill(Color.green.opacity(0.18))
                        .frame(width: 44, height: 44)
                    Image(systemName: "book.fill")
                        .foregroundColor(.green)
                        .font(.system(size: 20))
                }

                VStack(alignment: .leading, spacing: 3) {
                    Text("تابع القراءة")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(.primary)
                    Text("سورة \(surahName)، آية \(ayahNumber) • ص \(pageNumber)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer()

                Image(systemName: "chevron.left")
                    .foregroundColor(.secondary)
                    .font(.footnote.bold())
            }
            .padding(14)
            .background(Color(uiColor: .secondarySystemGroupedBackground))
            .cornerRadius(16)
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(Color.green.opacity(0.25), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 16)
    }
}

// MARK: - Weekly Streak Tracker Card

private struct WeeklyStreakTrackerCard: View {
    let currentStreak: Int
    let longestStreak: Int
    let days: [WeeklyDayStatus]
    let onAddSession: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            HStack {
                HStack(spacing: 8) {
                    Image(systemName: "flame.fill")
                        .foregroundColor(.orange)
                        .font(.system(size: 22))

                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(currentStreak) يوم مداومة")
                            .font(.system(size: 17, weight: .bold))
                            .foregroundColor(.primary)
                        Text("أطول مدة مداومة: \(longestStreak) يوم")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }

                Spacer()

                Button(action: onAddSession) {
                    HStack(spacing: 4) {
                        Image(systemName: "plus")
                        Text("جلسة")
                            .font(.caption.bold())
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Color.green.opacity(0.14))
                    .foregroundColor(.green)
                    .clipShape(Capsule())
                }
            }

            // 7 Days of the Week
            HStack(spacing: 0) {
                ForEach(days) { day in
                    VStack(spacing: 6) {
                        Text(day.dayNameAr.prefix(3))
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(day.isToday ? .green : .secondary)

                        ZStack {
                            if day.isRead {
                                Circle()
                                    .fill(Color.green)
                                    .frame(width: 32, height: 32)
                                Image(systemName: "checkmark")
                                    .font(.system(size: 13, weight: .bold))
                                    .foregroundColor(.white)
                            } else {
                                Circle()
                                    .stroke(day.isToday ? Color.green : Color(uiColor: .tertiarySystemFill), lineWidth: 1.5)
                                    .frame(width: 32, height: 32)
                                Text(day.dayNumber)
                                    .font(.system(size: 12, weight: day.isToday ? .bold : .regular))
                                    .foregroundColor(day.isToday ? .green : .secondary)
                            }
                        }

                        if day.isToday {
                            Circle()
                                .fill(Color.green)
                                .frame(width: 4, height: 4)
                        } else {
                            Circle()
                                .fill(Color.clear)
                                .frame(width: 4, height: 4)
                        }

                        // Daily duration (hours and minutes)
                        Text(day.formattedDuration)
                            .font(.system(size: 10, weight: day.isRead ? .bold : .regular, design: .rounded))
                            .foregroundColor(day.isRead ? .primary : .secondary.opacity(0.5))
                            .lineLimit(1)
                            .minimumScaleFactor(0.75)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .padding(.top, 4)
        }
        .padding(16)
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .cornerRadius(18)
        .padding(.horizontal, 16)
    }
}

// MARK: - Surah Progress Row Item

private struct SurahProgressItemRow: View {
    let progress: SurahProgress

    var body: some View {
        HStack(spacing: 12) {
            // Surah Number
            Text("\(progress.surahNumber)")
                .font(.caption.monospacedDigit())
                .foregroundColor(.secondary)
                .frame(width: 26, alignment: .leading)

            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(progress.surahName)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(.primary)

                    Spacer()

                    Text("\(progress.readAyahsCount)/\(progress.totalAyahsCount)")
                        .font(.caption.monospacedDigit())
                        .foregroundColor(.secondary)

                    Text("\(Int(progress.percentage))%")
                        .font(.caption.bold())
                        .foregroundColor(progress.isCompleted ? .green : .primary)
                }

                // Progress Bar
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule()
                            .fill(Color(uiColor: .tertiarySystemFill))
                            .frame(height: 5)
                        Capsule()
                            .fill(progress.isCompleted ? Color.green : Color(red: 0.18, green: 0.82, blue: 0.55))
                            .frame(
                                width: max(0, min(geo.size.width, geo.size.width * CGFloat(progress.percentage / 100.0))),
                                height: 5
                            )
                    }
                }
                .frame(height: 5)

                // Subtitle: Remaining Ayahs
                HStack {
                    if progress.isCompleted {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 10))
                            .foregroundColor(.green)
                        Text("مكتملة • لم يبقَ شيء")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(.green)
                    } else {
                        Text("المتبقي: \(progress.remainingAyahsCount) آية")
                            .font(.system(size: 11))
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                }
            }

            Image(systemName: "chevron.left")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(Color(uiColor: .tertiaryLabel))
        }
        .padding(12)
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .cornerRadius(14)
    }
}

// MARK: - Daily Reading Duration History

private struct DailyReadingHistoryCard: View {
    let days: [ReadingDayRecord]

    var body: some View {
        if !days.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Image(systemName: "calendar.badge.clock")
                        .foregroundColor(.blue)
                        .font(.headline)
                    Text("سجل القراءة اليومي")
                        .font(.system(size: 17, weight: .bold))
                        .foregroundColor(.primary)
                    Spacer()
                    Text("\(days.count) يوم")
                        .font(.caption.bold())
                        .foregroundColor(.secondary)
                }

                VStack(spacing: 8) {
                    ForEach(days.prefix(7)) { day in
                        HStack(spacing: 10) {
                            Text(formatDate(day.dateString))
                                .font(.subheadline.weight(.medium))
                                .foregroundColor(.primary)

                            Spacer()

                            HStack(spacing: 4) {
                                Image(systemName: "clock")
                                    .font(.caption2)
                                    .foregroundColor(.blue)
                                Text(formatDuration(day.secondsRead))
                                    .font(.subheadline.bold())
                                    .foregroundColor(.blue)
                            }

                            Text("• \(formatArabicIndic(day.pagesRead)) ص • \(formatArabicIndic(day.ayahsRead)) آية")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        .padding(.vertical, 8)
                        .padding(.horizontal, 12)
                        .background(Color(uiColor: .tertiarySystemGroupedBackground))
                        .cornerRadius(10)
                    }
                }
            }
            .padding(16)
            .background(Color(uiColor: .secondarySystemGroupedBackground))
            .cornerRadius(18)
            .padding(.horizontal, 16)
        }
    }

    private func formatDate(_ dateStr: String) -> String {
        let inFormatter = DateFormatter()
        inFormatter.dateFormat = "yyyy-MM-dd"
        guard let d = inFormatter.date(from: dateStr) else { return dateStr }
        let outFormatter = DateFormatter()
        outFormatter.locale = Locale(identifier: "ar")
        outFormatter.dateFormat = "EEEE d MMMM"
        return outFormatter.string(from: d)
    }

    private func formatDuration(_ seconds: Int) -> String {
        guard seconds > 0 else { return "—" }
        let hours = seconds / 3600
        let minutes = (seconds % 3600) / 60
        if hours > 0 {
            if minutes > 0 {
                return "\(formatArabicIndic(hours)) س \(formatArabicIndic(minutes)) د"
            } else {
                return "\(formatArabicIndic(hours)) س"
            }
        } else {
            return "\(formatArabicIndic(max(1, minutes))) د"
        }
    }
}

