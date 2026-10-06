import Charts
import MushafCore
import SwiftUI

/// «التقدم»: gains this week and month, the memorization streak, and the strict (and optionally learning)
/// percentage over time. Numbers come from `MemorizationStore`; this view only lays them out.
struct ProgressSection: View {
    let store: MemorizationStore
    let language: AppLanguage

    @State private var range: ProgressRange = .days30
    @State private var showsLearning = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(verbatim: copy("التقدم", "Progress")).font(.subheadline).foregroundStyle(.secondary)
            gainsRows
            streakRow
            Divider()
            chart
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color.secondary.opacity(0.1)))
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("memo-progress")
    }

    // MARK: Gains and streak

    private var gainsRows: some View {
        VStack(alignment: .leading, spacing: 6) {
            gainRow(title: copy("هذا الأسبوع", "This week"), gains: store.gains(since: store.weekStart),
                    identifier: "memo-gains-week")
            gainRow(title: copy("هذا الشهر", "This month"), gains: store.gains(since: store.monthStart),
                    identifier: "memo-gains-month")
        }
    }

    private func gainRow(title: String, gains: PeriodGains, identifier: String) -> some View {
        let ayat = MemorizationTheme.number(gains.newAyat, language: language)
        let pages = MemorizationTheme.decimal(gains.pageEquivalents, language: language)
        let surahs = MemorizationTheme.number(gains.surahsCompleted, language: language)
        let text = copy("+\(ayat) آية · \(pages) صفحة تقريباً · \(surahs) سورة مكتملة",
                        "+\(ayat) ayat · \(pages) pages · \(surahs) surahs completed")
        return HStack {
            Text(verbatim: title).font(.subheadline)
            Spacer()
            Text(verbatim: text).font(.footnote).foregroundStyle(.secondary).multilineTextAlignment(.trailing)
        }
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier(identifier)
    }

    private var streakRow: some View {
        let days = store.streak.current
        return HStack {
            Text(verbatim: copy("سلسلة الحفظ", "Memorization streak")).font(.subheadline)
            Spacer()
            Text(verbatim: copy("\(MemorizationTheme.number(days, language: language)) يوم", "\(days) days"))
                .font(.footnote).monospacedDigit()
                .accessibilityIdentifier("memo-streak")
        }
    }

    // MARK: Chart

    private var chart: some View {
        let points = store.series(range)
        return VStack(alignment: .leading, spacing: 8) {
            Picker(copy("المدة", "Range"), selection: $range) {
                Text(verbatim: copy("٧ أيام", "7 days")).tag(ProgressRange.days7)
                Text(verbatim: copy("٣٠ يوم", "30 days")).tag(ProgressRange.days30)
                Text(verbatim: copy("٣ أشهر", "3 months")).tag(ProgressRange.months3)
                Text(verbatim: copy("٦ أشهر", "6 months")).tag(ProgressRange.months6)
                Text(verbatim: copy("سنة", "Year")).tag(ProgressRange.year)
                Text(verbatim: copy("الكل", "All")).tag(ProgressRange.all)
            }
            .pickerStyle(.menu)
            .accessibilityIdentifier("memo-chart-range")

            Chart {
                ForEach(points, id: \.date) { point in
                    LineMark(x: .value("date", point.date), y: .value("strict", point.strictPercent),
                             series: .value("series", "strict"))
                        .foregroundStyle(MemorizationTheme.color(.mastered))
                }
                if showsLearning {
                    ForEach(points, id: \.date) { point in
                        LineMark(x: .value("date", point.date), y: .value("learning", point.learningPercent),
                                 series: .value("series", "learning"))
                            .foregroundStyle(MemorizationTheme.color(.memorizedWithErrors))
                    }
                }
            }
            .chartYScale(domain: 0...max(1, (points.map(\.strictPercent) + (showsLearning ? points.map(\.learningPercent) : [])).max() ?? 1))
            .frame(height: 140)
            .accessibilityIdentifier("memo-chart")
            .accessibilityLabel(chartSummary(points))

            Toggle(copy("إظهار تقدم الحفظ", "Show learning progress"), isOn: $showsLearning)
                .font(.footnote)
                .accessibilityIdentifier("memo-chart-learning")
        }
    }

    private func chartSummary(_ points: [ProgressPoint]) -> String {
        guard let first = points.first, let last = points.last else { return copy("لا توجد بيانات", "No data") }
        return copy("الحفظ المتقن من \(MemorizationTheme.percent(first.strictPercent, language: language)) إلى \(MemorizationTheme.percent(last.strictPercent, language: language))",
                    "Mastered from \(MemorizationTheme.percent(first.strictPercent, language: language)) to \(MemorizationTheme.percent(last.strictPercent, language: language))")
    }

    private func copy(_ ar: String, _ en: String) -> String { language == .arabic ? ar : en }
}
