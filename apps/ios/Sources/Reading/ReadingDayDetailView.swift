import MushafCore
import SwiftUI

struct SelectedReadingDay: Identifiable, Hashable {
    let id: String // YYYY-MM-DD
}

struct ReadingDayDetailView: View {
    let dateString: String
    let library: MushafLibrary
    let onSavedAndSynced: () -> Void

    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var tracker: ReadingTracker
    @AppStorage(AppLanguage.storageKey) private var languageRaw: String = AppLanguage.defaultCode

    @State private var detail: ReadingDayDetail
    @State private var removedSurahNumbers: Set<Int> = []
    @State private var removedEventIDs: Set<String> = []
    @State private var removeLegacyActivity: Bool = false
    @State private var pendingAdditions: [PendingDayReadingAddition] = []

    @State private var showingAddSheet = false
    @State private var isSaving = false
    @State private var statusMessage: String?
    @State private var statusIsError = false
    @State private var hasCommittedLocalSave = false

    init(dateString: String, library: MushafLibrary, onSavedAndSynced: @escaping () -> Void) {
        self.dateString = dateString
        self.library = library
        self.onSavedAndSynced = onSavedAndSynced
        let t = library.readingTracker
        _tracker = ObservedObject(wrappedValue: t)
        _detail = State(initialValue: t.dayDetail(for: dateString))
    }

    private var isArabic: Bool {
        (AppLanguage(rawValue: languageRaw) ?? .arabic) == .arabic
    }

    private var dayDate: Date {
        let parsed = QuranReadingDatabase.dayFormatter.date(from: dateString) ?? Date()
        return Calendar.autoupdatingCurrent.date(bySettingHour: 12, minute: 0, second: 0, of: parsed) ?? parsed
    }

    private var formattedDayTitle: String {
        let f = DateFormatter()
        f.locale = Locale(identifier: isArabic ? "ar" : "en_US")
        f.calendar = Calendar(identifier: .gregorian)
        f.dateFormat = "EEEE d MMMM yyyy"
        return f.string(from: dayDate)
    }

    private var visibleSurahs: [CompletedSurahDayItem] {
        detail.completedSurahs.filter { !removedSurahNumbers.contains($0.surahNumber) }
    }

    private var visibleEvents: [ReadingActivityEventRecord] {
        detail.activityEvents.filter { !removedEventIDs.contains($0.id) }
    }

    private var visibleLegacy: ReadingDayRecord? {
        removeLegacyActivity ? nil : detail.legacyActivity
    }

    private var hasUnsavedChanges: Bool {
        !removedSurahNumbers.isEmpty || !removedEventIDs.isEmpty || removeLegacyActivity || !pendingAdditions.isEmpty
    }

    private var previewTotals: (ayahs: Int, pages: Int, seconds: Int) {
        var ayahs = detail.summary?.ayahsRead ?? 0
        var pages = detail.summary?.pagesRead ?? 0
        var seconds = detail.summary?.secondsRead ?? 0

        if !removedEventIDs.isEmpty || removeLegacyActivity {
            ayahs = visibleEvents.reduce(0) { $0 + $1.ayahsRead } + (visibleLegacy?.ayahsRead ?? 0)
            pages = visibleEvents.reduce(0) { $0 + $1.pagesRead } + (visibleLegacy?.pagesRead ?? 0)
            seconds = visibleEvents.reduce(0) { $0 + $1.secondsRead } + (visibleLegacy?.secondsRead ?? 0)
        } else if !removedSurahNumbers.isEmpty {
            let cutAyahs = detail.completedSurahs
                .filter { removedSurahNumbers.contains($0.surahNumber) }
                .reduce(0) { $0 + $1.ayahs.count }
            let cutPages = detail.completedSurahs
                .filter { removedSurahNumbers.contains($0.surahNumber) }
                .reduce(0) { $0 + $1.pages.count }
            let prevAyahs = max(1, ayahs)
            let nextAyahs = max(0, ayahs - cutAyahs)
            seconds = ayahs > 0 ? Int((Double(seconds) * (Double(nextAyahs) / Double(prevAyahs))).rounded()) : 0
            ayahs = nextAyahs
            pages = max(0, pages - cutPages)
        }

        for add in pendingAdditions {
            ayahs += add.items.count
            pages += add.pageCount
            seconds += max(60, add.durationMinutes * 60)
        }

        return (ayahs: ayahs, pages: pages, seconds: seconds)
    }

    var body: some View {
        NavigationStack {
            List {
                summarySection
                completedSurahsSection
                sessionsSection
                pendingAdditionsSection
                saveAndSyncSection
            }
            .listStyle(.insetGrouped)
            .navigationTitle(isArabic ? "تفاصيل اليوم" : "Day Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(isArabic ? "إغلاق" : "Close") {
                        dismiss()
                    }
                    .disabled(isSaving)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showingAddSheet = true
                    } label: {
                        Label(isArabic ? "إضافة" : "Add", systemImage: "plus")
                            .fontWeight(.semibold)
                            .foregroundColor(.progress)
                    }
                    .disabled(isSaving)
                    .accessibilityIdentifier("day-detail-add-button")
                }
            }
            .sheet(isPresented: $showingAddSheet) {
                AddReadingSessionView(
                    library: library,
                    initialDate: dayDate,
                    onStageAddition: { addition in
                        pendingAdditions.append(addition)
                        statusMessage = nil
                        statusIsError = false
                    }
                )
            }
        }
    }

    // MARK: - Sections

    private var summarySection: some View {
        let totals = previewTotals
        let juz = totals.pages > 0
            ? Double(totals.pages) / DailyReadingChartPoint.pagesPerJuz
            : Double(totals.ayahs) / DailyReadingChartPoint.ayahsPerJuz

        return Section {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text(formattedDayTitle)
                        .font(.headline.weight(.bold))
                        .foregroundColor(.primary)
                    Spacer()
                    if hasUnsavedChanges {
                        Text(isArabic ? "تعديلات غير محفوظة" : "Unsaved")
                            .font(.caption2.bold())
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color.caution.opacity(0.16), in: Capsule())
                            .foregroundColor(.caution)
                    }
                }

                HStack(spacing: 8) {
                    metricTile(
                        title: isArabic ? "الآيات" : "Ayahs",
                        value: formatNumber(Double(totals.ayahs)),
                        tint: .progress
                    )
                    metricTile(
                        title: isArabic ? "الصفحات" : "Pages",
                        value: formatNumber(Double(totals.pages)),
                        tint: .info
                    )
                    metricTile(
                        title: isArabic ? "الأجزاء" : "Juz’",
                        value: formatNumber(juz),
                        tint: .insight
                    )
                    metricTile(
                        title: isArabic ? "الوقت" : "Time",
                        value: formatDuration(totals.seconds),
                        tint: .secondary
                    )
                }
            }
            .padding(.vertical, 4)
        }
    }

    private func metricTile(title: String, value: String, tint: Color) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.subheadline.weight(.bold).monospacedDigit())
                .foregroundColor(tint)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(title)
                .font(.caption2)
                .foregroundColor(.secondary)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(Color(uiColor: .tertiarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 10))
    }

    private var completedSurahsSection: some View {
        Section {
            if visibleSurahs.isEmpty {
                HStack(spacing: 10) {
                    Image(systemName: "book.closed")
                        .foregroundColor(.secondary)
                    Text(isArabic ? "لا توجد سور مكتملة مسجلة في هذا اليوم" : "No completed surah portions recorded for this day")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                .padding(.vertical, 4)
            } else {
                ForEach(visibleSurahs) { item in
                    let surahName = library.surahs.first { $0.number == item.surahNumber }?.name ?? "\(item.surahNumber)"
                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(isArabic ? "سورة \(surahName)" : "Surah \(surahName)")
                                .font(.body.weight(.semibold))
                                .foregroundColor(.primary)

                            let ayahRange = item.formattedAyahRanges(isArabic: isArabic)
                            let countStr = isArabic ? ArabicDigits.string(item.ayahs.count) : "\(item.ayahs.count)"
                            let pageStr = item.minPage == item.maxPage
                                ? (isArabic ? "ص \(ArabicDigits.string(item.minPage))" : "p. \(item.minPage)")
                                : (isArabic ? "ص \(ArabicDigits.string(item.minPage))–\(ArabicDigits.string(item.maxPage))" : "pp. \(item.minPage)–\(item.maxPage)")

                            Text(isArabic
                                 ? "الآيات \(ayahRange) (\(countStr) آية) • \(pageStr)"
                                 : "Ayahs \(ayahRange) (\(countStr)) • \(pageStr)")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        Spacer()
                        Button(role: .destructive) {
                            withMotion {
                                removedSurahNumbers.insert(item.surahNumber)
                                statusMessage = nil
                            }
                        } label: {
                            Image(systemName: "trash")
                                .foregroundColor(.danger)
                                .minimumHitTarget(overhang: 10)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(Text(isArabic ? "حذف سورة \(surahName) من هذا اليوم" : "Delete \(surahName) from day"))
                    }
                    .padding(.vertical, 2)
                }
            }

            Button {
                showingAddSheet = true
            } label: {
                Label(isArabic ? "إضافة قراءة لهذا اليوم" : "Add reading to this day", systemImage: "plus.circle.fill")
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(.progress)
            }
            .disabled(isSaving)
        } header: {
            HStack {
                Text(isArabic ? "المكتمل في هذا اليوم" : "Completed This Day")
                Spacer()
                if !removedSurahNumbers.isEmpty {
                    Button(isArabic ? "تراجع عن الحذف" : "Undo removals") {
                        withMotion { removedSurahNumbers.removeAll() }
                    }
                    .font(.caption.bold())
                    .textCase(nil)
                }
            }
        }
    }

    @ViewBuilder
    private var sessionsSection: some View {
        if !visibleEvents.isEmpty || visibleLegacy != nil {
            Section {
                ForEach(visibleEvents) { event in
                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(event.recordedAt.formatted(date: .omitted, time: .shortened))
                                .font(.subheadline.weight(.semibold))
                            Text(isArabic
                                 ? "\(ArabicDigits.string(event.ayahsRead)) آية • \(ArabicDigits.string(event.pagesRead)) ص • \(formatDuration(event.secondsRead))"
                                 : "\(event.ayahsRead) ayahs • \(event.pagesRead) pp • \(formatDuration(event.secondsRead))")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        Spacer()
                        Button(role: .destructive) {
                            withMotion {
                                removedEventIDs.insert(event.id)
                                statusMessage = nil
                            }
                        } label: {
                            Image(systemName: "trash")
                                .foregroundColor(.danger)
                                .minimumHitTarget(overhang: 10)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(Text(isArabic ? "حذف الجلسة" : "Delete session"))
                    }
                }

                if let legacy = visibleLegacy {
                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(isArabic ? "نشاط مسجل سابقًا" : "Previous recorded activity")
                                .font(.subheadline.weight(.semibold))
                            Text(isArabic
                                 ? "\(ArabicDigits.string(legacy.ayahsRead)) آية • \(ArabicDigits.string(legacy.pagesRead)) ص • \(formatDuration(legacy.secondsRead))"
                                 : "\(legacy.ayahsRead) ayahs • \(legacy.pagesRead) pp • \(formatDuration(legacy.secondsRead))")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        Spacer()
                        Button(role: .destructive) {
                            withMotion {
                                removeLegacyActivity = true
                                statusMessage = nil
                            }
                        } label: {
                            Image(systemName: "trash")
                                .foregroundColor(.danger)
                                .minimumHitTarget(overhang: 10)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(Text(isArabic ? "حذف النشاط" : "Delete activity"))
                    }
                }
            } header: {
                HStack {
                    Text(isArabic ? "الجلسات المسجلة" : "Logged Sessions")
                    Spacer()
                    if !removedEventIDs.isEmpty || removeLegacyActivity {
                        Button(isArabic ? "تراجع" : "Undo") {
                            withMotion {
                                removedEventIDs.removeAll()
                                removeLegacyActivity = false
                            }
                        }
                        .font(.caption.bold())
                        .textCase(nil)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var pendingAdditionsSection: some View {
        if !pendingAdditions.isEmpty {
            Section {
                ForEach(pendingAdditions) { item in
                    HStack(spacing: 10) {
                        Image(systemName: "plus.circle.fill")
                            .foregroundColor(.progress)
                        Text(item.label)
                            .font(.subheadline.weight(.medium))
                        Spacer()
                        Button {
                            withMotion {
                                pendingAdditions.removeAll { $0.id == item.id }
                            }
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundColor(.secondary)
                                .minimumHitTarget(overhang: 10)
                        }
                        .buttonStyle(.plain)
                    }
                }
            } header: {
                Text(isArabic ? "إضافات بانتظار الحفظ" : "Pending Additions")
            }
        }
    }

    private var saveAndSyncSection: some View {
        Section {
            Button {
                Task { await saveAndSync() }
            } label: {
                HStack(spacing: 8) {
                    Spacer()
                    if isSaving {
                        ProgressView()
                            .tint(.white)
                    } else {
                        Image(systemName: "icloud.and.arrow.up.fill")
                    }
                    Text(isSaving
                         ? (isArabic ? "جاري الحفظ والمزامنة..." : "Saving & syncing...")
                         : (isArabic ? "حفظ ومزامنة مع السحابة" : "Save & Sync with Cloud"))
                        .font(.headline)
                    Spacer()
                }
                .foregroundColor(.white)
                .padding(.vertical, 6)
            }
            .listRowBackground((isSaving || (!hasUnsavedChanges && !hasCommittedLocalSave)) ? Color.progressFill.opacity(0.65) : Color.progressFill)
            .disabled(isSaving)
            .accessibilityIdentifier("day-detail-save-sync")

            if let statusMessage {
                Text(statusMessage)
                    .font(.caption)
                    .foregroundColor(statusIsError ? .danger : .progress)
            }
        }
    }

    // MARK: - Save & Sync

    @MainActor
    private func saveAndSync() async {
        guard !isSaving else { return }
        isSaving = true
        statusMessage = nil
        statusIsError = false
        defer { isSaving = false }

        if hasUnsavedChanges {
            let removedSurahItems: [(surah: Int, ayahs: [Int], pageCount: Int)] = detail.completedSurahs
                .filter { removedSurahNumbers.contains($0.surahNumber) }
                .map { (surah: $0.surahNumber, ayahs: $0.ayahs, pageCount: $0.pages.count) }

            let saved = tracker.applyDayEdits(
                dateString: dateString,
                removedSurahAyahs: removedSurahItems,
                removedEventIds: Array(removedEventIDs),
                removeLegacy: removeLegacyActivity,
                additions: pendingAdditions,
                on: dayDate,
                pushToICloud: true
            )

            guard saved else {
                statusIsError = true
                statusMessage = isArabic ? "تعذر حفظ التعديلات محليًا. حاول مرة أخرى." : "Could not save changes locally."
                UINotificationFeedbackGenerator().notificationOccurred(.error)
                return
            }

            hasCommittedLocalSave = true
            removedSurahNumbers.removeAll()
            removedEventIDs.removeAll()
            removeLegacyActivity = false
            pendingAdditions.removeAll()
            detail = tracker.dayDetail(for: dateString)
            NotificationCenter.default.post(name: .readingDatabaseDidUpdate, object: nil)
            onSavedAndSynced()
        }

        if let account = library.cloudAccount, account.accountID != nil {
            await account.sync(library: library, dataset: .khatma)
            if let syncError = account.error {
                statusIsError = true
                statusMessage = isArabic
                    ? "تم الحفظ محليًا، وتعذرت المزامنة مع السحابة: \(syncError)"
                    : "Saved locally, cloud sync failed: \(syncError)"
                UINotificationFeedbackGenerator().notificationOccurred(.warning)
                return
            }
            if account.conflicts[.khatma] != nil {
                statusIsError = true
                statusMessage = isArabic
                    ? "تم الحفظ محليًا. يوجد تعارض في السحابة، راجع إعدادات الحساب والمزامنة."
                    : "Saved locally. Cloud conflict detected in Account & Sync."
                UINotificationFeedbackGenerator().notificationOccurred(.warning)
                return
            }
        } else {
            ICloudDatabaseSyncService.shared.pushReadingToICloud()
        }

        UINotificationFeedbackGenerator().notificationOccurred(.success)
        statusIsError = false
        statusMessage = isArabic ? "تم الحفظ والمزامنة بنجاح" : "Saved and synced with cloud"
        dismiss()
    }

    // MARK: - Helpers

    private func formatNumber(_ value: Double) -> String {
        ReadingChartMetric.number(value, isArabic: isArabic)
    }

    private func formatDuration(_ seconds: Int) -> String {
        guard seconds > 0 else { return "—" }
        let hours = seconds / 3600
        let minutes = (seconds % 3600) / 60
        func num(_ v: Int) -> String { isArabic ? ArabicDigits.string(v) : "\(v)" }
        if hours > 0 {
            let hText = isArabic ? "\(num(hours)) س" : "\(num(hours))h"
            guard minutes > 0 else { return hText }
            return isArabic ? "\(hText) \(num(minutes)) د" : "\(hText) \(num(minutes))m"
        }
        return isArabic ? "\(num(max(1, minutes))) د" : "\(num(max(1, minutes)))m"
    }
}
