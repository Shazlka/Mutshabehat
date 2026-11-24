import Charts
import MushafCore
import SwiftUI

// MARK: - Chart Metric Type

enum ReadingChartMetric: String, CaseIterable, Identifiable {
    case ayahs
    case pages
    case juz

    var id: String { rawValue }

    func title(isArabic: Bool) -> String {
        switch self {
        case .ayahs: isArabic ? "الآيات" : "Ayahs"
        case .pages: isArabic ? "الصفحات" : "Pages"
        case .juz: isArabic ? "الأجزاء" : "Juz’"
        }
    }

    func unit(isArabic: Bool) -> String {
        switch self {
        case .ayahs: isArabic ? "آية" : "ayahs"
        case .pages: isArabic ? "صفحة" : "pages"
        case .juz: isArabic ? "جزء" : "juz’"
        }
    }

    var tintColor: Color {
        switch self {
        case .ayahs: .progress
        case .pages: .info
        case .juz: .insight
        }
    }

    /// The Y axis height used when the period has no reading at all.
    var emptyAxisMaximum: Double {
        switch self {
        case .ayahs: 50
        case .pages: 10
        case .juz: 1
        }
    }

    /// A number with its unit, e.g. "٣٢ صفحة" or "1.6 juz’". Whole values show no decimal.
    func formatted(_ value: Double, isArabic: Bool) -> String {
        "\(Self.number(value, isArabic: isArabic)) \(unit(isArabic: isArabic))"
    }

    /// A number rounded to one decimal place, in Arabic-Indic digits when `isArabic`.
    static func number(_ value: Double, isArabic: Bool) -> String {
        let rounded = (value * 10).rounded() / 10
        let text = rounded == rounded.rounded()
            ? String(Int(rounded))
            : String(format: "%.1f", locale: Locale(identifier: "en_US_POSIX"), rounded)
        guard isArabic else { return text }
        return String(text.unicodeScalars.map { scalar -> Character in
            if let digit = Int(String(scalar)) { return Character(UnicodeScalar(0x0660 + digit)!) }
            return scalar == "." ? "٫" : Character(scalar)
        })
    }
}

// MARK: - Chart Time Range

enum ReadingChartRange: Int, CaseIterable, Identifiable {
    case days7 = 7
    case days14 = 14
    case days30 = 30

    var id: Int { rawValue }

    func title(isArabic: Bool) -> String {
        switch self {
        case .days7: isArabic ? "٧ أيام" : "7 Days"
        case .days14: isArabic ? "١٤ يومًا" : "14 Days"
        case .days30: isArabic ? "٣٠ يومًا" : "30 Days"
        }
    }

    /// One X axis label every this many days, so labels never collide.
    var axisStride: Int {
        switch self {
        case .days7: 1
        case .days14: 2
        case .days30: 5
        }
    }
}

// MARK: - Chart Data Point

struct DailyReadingChartPoint: Identifiable, Equatable {
    /// Pages per juz’ in the 604-page Madinah Mushaf.
    static let pagesPerJuz = 604.0 / 30.0
    /// Ayahs per juz’ on average (6236 / 30), used only for a day logged without pages.
    static let ayahsPerJuz = 6236.0 / 30.0

    var id: String { dateString }
    let date: Date
    let dateString: String
    let ayahs: Int
    let pages: Int
    let seconds: Int

    var juz: Double {
        if pages > 0 { return Double(pages) / Self.pagesPerJuz }
        if ayahs > 0 { return Double(ayahs) / Self.ayahsPerJuz }
        return 0
    }

    func value(for metric: ReadingChartMetric) -> Double {
        switch metric {
        case .ayahs: Double(ayahs)
        case .pages: Double(pages)
        case .juz: juz
        }
    }

    /// One point per calendar day for the `range` ending at `today`, oldest first.
    /// Days without a record are zero, so the chart always shows the whole period.
    static func points(
        for range: ReadingChartRange,
        from records: [ReadingDayRecord],
        today: Date = Date(),
        calendar: Calendar = .autoupdatingCurrent
    ) -> [DailyReadingChartPoint] {
        let end = calendar.startOfDay(for: today)
        let recordsByDay = Dictionary(records.map { ($0.dateString, $0) }, uniquingKeysWith: { first, _ in first })
        return (0..<range.rawValue).reversed().compactMap { daysAgo in
            guard let day = calendar.date(byAdding: .day, value: -daysAgo, to: end) else { return nil }
            let key = QuranReadingDatabase.dayFormatter.string(from: day)
            let record = recordsByDay[key]
            return DailyReadingChartPoint(
                date: day,
                dateString: key,
                ayahs: record?.ayahsRead ?? 0,
                pages: record?.pagesRead ?? 0,
                seconds: record?.secondsRead ?? 0
            )
        }
    }
}

/// Totals for the visible period in one metric.
struct ReadingChartSummary: Equatable {
    let total: Double
    let average: Double
    let peak: Double

    init(points: [DailyReadingChartPoint], metric: ReadingChartMetric) {
        let values = points.map { $0.value(for: metric) }
        total = values.reduce(0, +)
        average = values.isEmpty ? 0 : total / Double(values.count)
        peak = values.max() ?? 0
    }

    /// Top of the Y axis: the peak plus headroom, or a default when nothing was read.
    func axisMaximum(for metric: ReadingChartMetric) -> Double {
        guard peak > 0 else { return metric.emptyAxisMaximum }
        switch metric {
        case .juz: return max(1, (peak * 1.15 * 2).rounded(.up) / 2)
        case .ayahs, .pages: return max(5, (peak * 1.15).rounded(.up))
        }
    }
}

// MARK: - Daily Reading Progress Chart Card

struct DailyReadingProgressChartCard: View {
    let days: [ReadingDayRecord]

    @AppStorage(AppLanguage.storageKey) private var languageRaw: String = AppLanguage.defaultCode
    @AppStorage("reading.chart.metric") private var selectedMetric: ReadingChartMetric = .pages
    @AppStorage("reading.chart.range") private var selectedRange: ReadingChartRange = .days7
    /// The inspected day, kept until the reader taps it again or resets.
    @State private var selectedDay: String?

    private var isArabic: Bool {
        (AppLanguage(rawValue: languageRaw) ?? .arabic) == .arabic
    }

    var body: some View {
        let points = DailyReadingChartPoint.points(for: selectedRange, from: days)
        let summary = ReadingChartSummary(points: points, metric: selectedMetric)
        let selectedPoint = points.first { $0.dateString == selectedDay }

        VStack(spacing: 16) {
            header

            // One `Text` per option: a segmented picker turns every child view into its own segment.
            Picker(isArabic ? "وحدة القياس" : "Unit", selection: $selectedMetric) {
                ForEach(ReadingChartMetric.allCases) { metric in
                    Text(verbatim: metric.title(isArabic: isArabic)).tag(metric)
                }
            }
            .pickerStyle(.segmented)
            .accessibilityIdentifier("reading-chart-metric")

            Group {
                if let selectedPoint {
                    dayCallout(selectedPoint)
                } else {
                    periodSummary(summary)
                }
            }
            // Same height for both, so the chart does not jump when a day is picked.
            .frame(minHeight: 64)
            .animation(.easeInOut(duration: 0.2), value: selectedDay)

            chart(points: points, summary: summary, selectedPoint: selectedPoint)
                .frame(height: 190)
                .animation(.easeInOut(duration: 0.25), value: selectedMetric)
                .animation(.easeInOut(duration: 0.25), value: selectedRange)

            footer(hasSelection: selectedPoint != nil)
        }
        .padding(16)
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .padding(.horizontal, 16)
    }

    // MARK: - Header

    private var header: some View {
        HStack(alignment: .center) {
            HStack(spacing: 8) {
                Image(systemName: "chart.bar.xaxis")
                    .foregroundStyle(selectedMetric.tintColor)
                    .font(.headline)
                    .accessibilityHidden(true)

                VStack(alignment: .leading, spacing: 2) {
                    Text(verbatim: isArabic ? "معدل القراءة اليومي" : "Daily Reading Progress")
                        .font(.headline.weight(.bold))
                        .foregroundStyle(.primary)

                    Text(verbatim: isArabic ? "ما قرأته كل يوم بالآيات أو الصفحات أو الأجزاء" : "What you read each day, in ayahs, pages or juz’")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }

            Spacer()

            Menu {
                Picker(isArabic ? "المدة" : "Range", selection: $selectedRange) {
                    ForEach(ReadingChartRange.allCases) { range in
                        Text(verbatim: range.title(isArabic: isArabic)).tag(range)
                    }
                }
            } label: {
                HStack(spacing: 4) {
                    Text(verbatim: selectedRange.title(isArabic: isArabic))
                        .font(.caption.weight(.semibold))
                    Image(systemName: "chevron.up.chevron.down")
                        .font(.caption2)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(Color(uiColor: .tertiarySystemGroupedBackground))
                .foregroundStyle(.secondary)
                .clipShape(Capsule())
            }
            .accessibilityLabel(Text(verbatim: isArabic ? "المدة" : "Range"))
            .accessibilityValue(Text(verbatim: selectedRange.title(isArabic: isArabic)))
            .accessibilityIdentifier("reading-chart-range")
        }
    }

    // MARK: - Summary

    private func dayCallout(_ point: DailyReadingChartPoint) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(verbatim: Self.fullDateFormatter(isArabic: isArabic).string(from: point.date))
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)

                Text(verbatim: selectedMetric.formatted(point.value(for: selectedMetric), isArabic: isArabic))
                    .font(.title3.weight(.bold))
                    .foregroundStyle(selectedMetric.tintColor)
            }

            Spacer()

            if point.seconds > 0 {
                HStack(spacing: 4) {
                    Image(systemName: "clock")
                        .font(.caption2)
                    Text(verbatim: formatDuration(point.seconds))
                        .font(.caption.bold())
                }
                .foregroundStyle(Color.info)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.info.opacity(0.12))
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            }
        }
        .padding(10)
        .background(selectedMetric.tintColor.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(selectedMetric.tintColor.opacity(0.28), lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("reading-chart-day")
    }

    private func periodSummary(_ summary: ReadingChartSummary) -> some View {
        HStack(spacing: 0) {
            statColumn(
                title: isArabic ? "المعدل اليومي" : "Daily Average",
                value: selectedMetric.formatted(summary.average, isArabic: isArabic),
                color: selectedMetric.tintColor
            )
            Divider().frame(height: 28)
            statColumn(
                title: isArabic ? "الإجمالي" : "Period Total",
                value: selectedMetric.formatted(summary.total, isArabic: isArabic),
                color: .primary
            )
            Divider().frame(height: 28)
            statColumn(
                title: isArabic ? "أعلى يوم" : "Peak Day",
                value: selectedMetric.formatted(summary.peak, isArabic: isArabic),
                color: .secondary
            )
        }
        .padding(.vertical, 6)
        .background(Color(uiColor: .tertiarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .accessibilityIdentifier("reading-chart-summary")
    }

    private func statColumn(title: String, value: String, color: Color) -> some View {
        VStack(spacing: 2) {
            Text(verbatim: title)
                .font(.caption2)
                .foregroundStyle(.secondary)
            Text(verbatim: value)
                .font(.subheadline.weight(.bold))
                .foregroundStyle(color)
        }
        .lineLimit(1)
        .minimumScaleFactor(0.7)
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
    }

    // MARK: - Bar Chart

    private func chart(
        points: [DailyReadingChartPoint],
        summary: ReadingChartSummary,
        selectedPoint: DailyReadingChartPoint?
    ) -> some View {
        let tint = selectedMetric.tintColor
        return Chart(points) { point in
            let value = point.value(for: selectedMetric)
            BarMark(
                x: .value("Date", point.date, unit: .day),
                y: .value("Value", value)
            )
            .foregroundStyle(
                selectedPoint == nil
                    ? AnyShapeStyle(tint.gradient)
                    : AnyShapeStyle(tint.opacity(selectedPoint == point ? 1 : 0.35))
            )
            .cornerRadius(selectedRange == .days30 ? 2.5 : 5)
            .accessibilityLabel(Text(verbatim: Self.fullDateFormatter(isArabic: isArabic).string(from: point.date)))
            .accessibilityValue(Text(verbatim: selectedMetric.formatted(value, isArabic: isArabic)))
        }
        .chartYScale(domain: 0...summary.axisMaximum(for: selectedMetric))
        .chartYAxis {
            AxisMarks(position: .leading, values: .automatic(desiredCount: 4)) { value in
                AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5, dash: [2, 3]))
                    .foregroundStyle(Color.secondary.opacity(0.2))
                AxisValueLabel {
                    if let number = value.as(Double.self) {
                        Text(verbatim: ReadingChartMetric.number(number, isArabic: isArabic))
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
        .chartXAxis {
            AxisMarks(values: .stride(by: .day, count: selectedRange.axisStride)) { value in
                AxisValueLabel {
                    if let date = value.as(Date.self) {
                        Text(verbatim: Self.axisFormatter(isArabic: isArabic, weekday: selectedRange == .days7).string(from: date))
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
        // A tap, not a drag, picks the day: the card sits in a scroll view and a drag must keep scrolling.
        .chartGesture { proxy in
            SpatialTapGesture().onEnded { tap in
                guard let date = proxy.value(atX: tap.location.x, as: Date.self) else { return }
                let calendar = Calendar.autoupdatingCurrent
                let tapped = points.first { calendar.isDate($0.date, inSameDayAs: date) }?.dateString
                selectedDay = tapped == selectedDay ? nil : tapped
            }
        }
        .accessibilityIdentifier("reading-chart")
    }

    // MARK: - Footer

    private func footer(hasSelection: Bool) -> some View {
        HStack(spacing: 6) {
            Image(systemName: "hand.tap")
                .accessibilityHidden(true)
            Text(verbatim: hasSelection
                ? (isArabic ? "المس العمود مرة أخرى لإلغاء التحديد" : "Tap the bar again to clear it")
                : (isArabic ? "المس أي عمود لعرض تفاصيل ذلك اليوم" : "Tap a bar to see that day"))
            Spacer()
            if hasSelection {
                Button {
                    selectedDay = nil
                } label: {
                    Text(verbatim: isArabic ? "إلغاء التحديد" : "Clear")
                        .fontWeight(.bold)
                }
                .foregroundStyle(selectedMetric.tintColor)
            }
        }
        .font(.caption2)
        .foregroundStyle(.secondary)
    }

    // MARK: - Formatting

    private static let formatters: [String: DateFormatter] = {
        var result: [String: DateFormatter] = [:]
        for language in ["ar", "en_US"] {
            for (name, format) in [("full", "EEEE d MMMM"), ("weekday", "EEE"), ("day", "d")] {
                let formatter = DateFormatter()
                formatter.locale = Locale(identifier: language)
                formatter.calendar = Calendar(identifier: .gregorian)
                formatter.dateFormat = format
                result["\(language).\(name)"] = formatter
            }
        }
        return result
    }()

    private static func fullDateFormatter(isArabic: Bool) -> DateFormatter {
        formatters["\(isArabic ? "ar" : "en_US").full"]!
    }

    private static func axisFormatter(isArabic: Bool, weekday: Bool) -> DateFormatter {
        formatters["\(isArabic ? "ar" : "en_US").\(weekday ? "weekday" : "day")"]!
    }

    private func formatDuration(_ seconds: Int) -> String {
        let hours = seconds / 3600
        let minutes = (seconds % 3600) / 60
        func number(_ value: Int) -> String { isArabic ? ArabicDigits.string(value) : "\(value)" }
        if hours > 0 {
            let hourText = isArabic ? "\(number(hours)) س" : "\(number(hours))h"
            guard minutes > 0 else { return hourText }
            return isArabic ? "\(hourText) \(number(minutes)) د" : "\(hourText) \(number(minutes))m"
        }
        return isArabic ? "\(number(max(1, minutes))) د" : "\(number(max(1, minutes)))m"
    }
}
