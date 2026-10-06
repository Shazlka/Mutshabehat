import MushafCore
import SwiftUI

struct SurahDetailView: View {
    let surah: Int
    let library: MushafLibrary
    let store: MemorizationStore
    let language: AppLanguage
    let openInMushaf: (Int, AyahKey?) -> Void
    let update: (MemorizationSelection) -> Void

    private func copy(_ ar: String, _ en: String) -> String { language == .arabic ? ar : en }
    private func number(_ value: Int) -> String { MemorizationTheme.number(value, language: language) }
    private func percent(_ value: Double) -> String { MemorizationTheme.percent(value, language: language) }

    private var surahName: String { library.surahNames[surah] ?? "\(surah)" }

    private var progress: MushafCore.SurahProgress {
        store.snapshot.surahs.first(where: { $0.surah == surah })
            ?? MushafCore.SurahProgress(
                surah: surah,
                ayahCount: store.index.ayahCount(surah: surah),
                counts: [:],
                strictPercent: 0,
                learningPercent: 0,
                state: .none,
                isCompleteIncludingErrors: false
            )
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                headlineCard
                stripCard
                countsCard
                metadataCard
                actionButtons
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 24)
        }
        .navigationTitle(copy("سورة \(surahName)", "Surah \(surahName)"))
        .navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("memo-surah-detail")
    }

    // MARK: Headline

    private var headlineCard: some View {
        VStack(spacing: 8) {
            Text(verbatim: copy("سورة \(surahName)", "Surah \(surahName)"))
                .font(.title2.weight(.bold))
            HStack(spacing: 24) {
                VStack(spacing: 4) {
                    Text(verbatim: percent(progress.strictPercent))
                        .font(.title.weight(.bold))
                        .monospacedDigit()
                        .foregroundStyle(MemorizationTheme.color(.mastered))
                        .accessibilityIdentifier("memo-detail-strict")
                    Text(verbatim: copy("الحفظ المتقن", "Mastered"))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                VStack(spacing: 4) {
                    Text(verbatim: percent(progress.learningPercent))
                        .font(.title.weight(.bold))
                        .monospacedDigit()
                        .foregroundStyle(MemorizationTheme.color(.memorizedWithErrors))
                        .accessibilityIdentifier("memo-detail-learning")
                    Text(verbatim: copy("تقدم الحفظ", "Learning progress"))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .frame(maxWidth: .infinity)
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color.secondary.opacity(0.1)))
    }

    // MARK: Ayah Strip

    private var stripCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(verbatim: copy("شريط الآيات", "Ayah strip"))
                .font(.subheadline)
                .foregroundStyle(.secondary)
            ayahStrip
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color.secondary.opacity(0.1)))
    }

    private var ayahStrip: some View {
        let runs = MemorizationStatisticsService.runs(forSurah: surah, records: store.allRecords, index: store.index)
        let total = max(1, store.index.ayahCount(surah: surah))
        return GeometryReader { proxy in
            HStack(spacing: 1) {
                ForEach(runs, id: \.from) { run in
                    let length = run.to - run.from + 1
                    let availableWidth = max(0, proxy.size.width - CGFloat(max(0, runs.count - 1)))
                    let width = max(1, availableWidth * CGFloat(length) / CGFloat(total))
                    Button {
                        let key = AyahKey(surah: surah, ayah: run.from)
                        let page = store.index.page(of: key) ?? 1
                        openInMushaf(page, key)
                    } label: {
                        Rectangle()
                            .fill(MemorizationTheme.color(run.status))
                    }
                    .buttonStyle(.plain)
                    .frame(width: width)
                    .accessibilityIdentifier("memo-strip-seg-\(run.from)")
                    .accessibilityLabel(stripSegmentLabel(run))
                }
            }
        }
        .frame(height: 28)
        .clipShape(RoundedRectangle(cornerRadius: 6))
        .accessibilityIdentifier("memo-detail-strip")
    }

    private func stripSegmentLabel(_ run: AyahRun) -> String {
        let status = MemorizationTheme.label(run.status, language: language)
        let from = number(run.from)
        let to = number(run.to)
        if run.from == run.to {
            return language == .arabic
                ? "\(status)، الآية \(from)"
                : "\(status), Ayah \(from)"
        } else {
            return language == .arabic
                ? "\(status)، الآيات \(from) إلى \(to)"
                : "\(status), Ayat \(from) to \(to)"
        }
    }

    // MARK: Counts

    private var countsCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(verbatim: copy("توزيع الآيات", "Ayah distribution"))
                .font(.subheadline)
                .foregroundStyle(.secondary)
            ForEach(MemorizationStatus.allCases, id: \.self) { status in
                HStack {
                    Text(verbatim: MemorizationTheme.shape(status))
                        .frame(width: 28)
                        .foregroundStyle(MemorizationTheme.color(status))
                    Text(verbatim: MemorizationTheme.label(status, language: language))
                    Spacer()
                    Text(verbatim: number(progress.counts[status, default: 0]))
                        .monospacedDigit()
                        .foregroundStyle(.secondary)
                }
                .font(.subheadline)
                .accessibilityIdentifier("memo-detail-count-\(status.rawValue)")
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color.secondary.opacity(0.1)))
    }

    // MARK: Metadata

    private var metadataCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(verbatim: copy("معلومات السورة", "Surah information"))
                .font(.subheadline)
                .foregroundStyle(.secondary)

            metadataRow(title: copy("الصفحات", "Pages"), value: pagesOccupiedText)
            metadataRow(title: copy("آخر مراجعة", "Last review"), value: lastReviewText)
            metadataRow(title: copy("قوة المراجعة", "Review strength"), value: displayedStrengthText)
            metadataRow(title: copy("آخر آية محفوظة", "Last memorized ayah"), value: lastMemorizedAyahText)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color.secondary.opacity(0.1)))
    }

    private func metadataRow(title: String, value: String) -> some View {
        HStack {
            Text(verbatim: title)
                .foregroundStyle(.secondary)
            Spacer()
            Text(verbatim: value)
                .fontWeight(.medium)
        }
        .font(.subheadline)
    }

    private var pagesOccupiedText: String {
        guard let pages = store.index.pages(ofSurah: surah) else { return "" }
        if pages.lowerBound == pages.upperBound {
            return copy("صفحة \(number(pages.lowerBound))", "Page \(number(pages.lowerBound))")
        } else {
            return copy("الصفحات \(number(pages.lowerBound))–\(number(pages.upperBound))",
                        "Pages \(number(pages.lowerBound))–\(number(pages.upperBound))")
        }
    }

    private var lastReviewText: String {
        let ayat = store.index.ayat(ofSurah: surah)
        let dates = ayat.compactMap { store.record(of: $0)?.lastReviewedAt }
        guard let latest = dates.max() else {
            return copy("لم تتم المراجعة", "Not reviewed")
        }
        return latest.formatted(date: .abbreviated, time: .omitted)
    }

    private var displayedStrengthText: String {
        let ayat = store.index.ayat(ofSurah: surah)
        let now = Date()
        let memorized = ayat.filter {
            let s = store.status(of: $0)
            return s == .mastered || s == .memorizedWithErrors
        }
        guard !memorized.isEmpty else {
            return copy("لم تتم المراجعة", "Not reviewed")
        }
        let weakest = memorized.compactMap { key -> ReviewStrength? in
            guard let record = store.record(of: key) else { return .notReviewed }
            return ReviewEngine.displayedStrength(of: record, now: now)
        }.max(by: { $0.rawValue < $1.rawValue }) ?? .notReviewed

        switch weakest {
        case .strong: return copy("قوي", "Strong")
        case .good: return copy("جيد", "Good")
        case .needsReview: return copy("يحتاج مراجعة", "Needs review")
        case .weak: return copy("ضعيف", "Weak")
        case .notReviewed: return copy("لم تتم المراجعة", "Not reviewed")
        }
    }

    private var lastMemorizedAyahText: String {
        let ayat = store.index.ayat(ofSurah: surah)
        let memorized = ayat.filter {
            let s = store.status(of: $0)
            return s == .mastered || s == .memorizedWithErrors
        }
        guard let highest = memorized.map(\.ayah).max() else {
            return copy("لا شيء بعد", "None yet")
        }
        return copy("الآية \(number(highest))", "Ayah \(number(highest))")
    }

    // MARK: Actions

    private var actionButtons: some View {
        VStack(spacing: 10) {
            Button {
                update(.surah(surah))
            } label: {
                Text(verbatim: copy("تحديث", "Update"))
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            }
            .buttonStyle(.borderedProminent)
            .tint(MemorizationTheme.color(.mastered))
            .accessibilityIdentifier("memo-detail-update")

            Button {
                let firstPage = store.index.pages(ofSurah: surah)?.lowerBound ?? 1
                openInMushaf(firstPage, AyahKey(surah: surah, ayah: 1))
            } label: {
                Text(verbatim: copy("فتح في المصحف", "Open in Mushaf"))
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            }
            .buttonStyle(.bordered)
            .accessibilityIdentifier("memo-detail-open")
        }
    }
}
