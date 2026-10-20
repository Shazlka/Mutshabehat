import MushafCore
import SwiftUI

// MARK: - Khatma Summary

/// The current khatma as one figure and a bar, then the lifetime figures as a short list. Replaces a
/// 170 pt gradient ring plus a grid of identical number boxes: the same information, less to scan.
struct KhatmaSummaryCard: View {
    let stats: ReadingStatsOverview

    private var fraction: Double { max(0, min(1, stats.progressPercentage / 100)) }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 8) {
                Text("الختمة الحالية (\(ArabicDigits.string(stats.currentKhatma.khatmaNumber)))")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(fraction.formatted(.percent.precision(.fractionLength(0...1)).locale(Locale(identifier: "ar"))))
                        .font(.largeTitle.weight(.semibold))
                        .monospacedDigit()
                    Text("من القرآن")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                ProgressView(value: fraction)
                    .tint(.progress)
                    .accessibilityHidden(true)

                Text("\(ArabicDigits.string(stats.totalPagesReadInCurrentKhatma)) من ٦٠٤ صفحة، بقي \(ArabicDigits.string(stats.remainingPages)) · \(ArabicDigits.string(stats.totalAyahsReadInCurrentKhatma)) من \(ArabicDigits.string(stats.totalQuranAyahs)) آية")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            .accessibilityElement(children: .combine)

            Divider()

            VStack(spacing: 10) {
                SummaryFigure(title: "وقت التلاوة الكلي", value: stats.formattedLifetimeDuration)
                SummaryFigure(title: "أيام التلاوة", value: "\(ArabicDigits.string(stats.totalReadingDays)) يوم")
                SummaryFigure(title: "الآيات المقروءة", value: "\(ArabicDigits.string(stats.lifetimeAyahsRead)) آية")
                SummaryFigure(title: "الختمات المكتملة", value: ArabicDigits.string(stats.completedKhatmasCount))
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(uiColor: .secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14))
        .padding(.horizontal, 16)
    }
}

/// One label and its value on a line; it stacks when the text size is very large.
struct SummaryFigure: View {
    let title: String
    let value: String

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .firstTextBaseline) {
                Text(title).foregroundStyle(.secondary)
                Spacer(minLength: 12)
                Text(value).fontWeight(.semibold).monospacedDigit()
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(title).foregroundStyle(.secondary)
                Text(value).fontWeight(.semibold).monospacedDigit()
            }
        }
        .font(.subheadline)
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Continue Reading Banner

struct ContinueReadingBanner: View {
    let surahName: String
    let ayahNumber: Int
    let pageNumber: Int
    let onContinue: () -> Void

    var body: some View {
        Button(action: onContinue) {
            HStack(spacing: 14) {
                ZStack {
                    Circle()
                        .fill(Color.progress.opacity(0.18))
                        .frame(width: 44, height: 44)
                    Image(systemName: "book.fill")
                        .foregroundColor(.progress)
                        .font(.title3)
                }

                VStack(alignment: .leading, spacing: 3) {
                    Text("تابع القراءة")
                        .font(.callout.weight(.bold))
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
                    .stroke(Color.progress.opacity(0.25), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 16)
    }
}

// MARK: - Weekly Streak Tracker Card

struct WeeklyStreakTrackerCard: View {
    let currentStreak: Int
    let longestStreak: Int
    let days: [WeeklyDayStatus]
    let onAddSession: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            HStack {
                HStack(spacing: 8) {
                    Image(systemName: "flame.fill")
                        .foregroundColor(.caution)
                        .font(.title2)

                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(currentStreak) يوم مداومة")
                            .font(.headline.weight(.bold))
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
                    .background(Color.progress.opacity(0.14))
                    .foregroundColor(.progress)
                    .clipShape(Capsule())
                }
            }

            // 7 Days of the Week
            HStack(spacing: 0) {
                ForEach(days) { day in
                    VStack(spacing: 6) {
                        Text(day.dayNameAr.prefix(3))
                            .font(.caption2.weight(.medium))
                            .foregroundColor(day.isToday ? .progress : .secondary)

                        ZStack {
                            if day.isRead {
                                Circle()
                                    .fill(Color.progressFill)
                                    .frame(width: 32, height: 32)
                                Image(systemName: "checkmark")
                                    .font(.footnote.weight(.bold))
                                    .foregroundColor(.white)
                            } else {
                                Circle()
                                    .stroke(day.isToday ? Color.progress : Color(uiColor: .tertiarySystemFill), lineWidth: 1.5)
                                    .frame(width: 32, height: 32)
                                Text(day.dayNumber)
                                    .font(.caption.weight(day.isToday ? .bold : .regular))
                                    .foregroundColor(day.isToday ? .progress : .secondary)
                            }
                        }

                        if day.isToday {
                            Circle()
                                .fill(Color.progress)
                                .frame(width: 4, height: 4)
                        } else {
                            Circle()
                                .fill(Color.clear)
                                .frame(width: 4, height: 4)
                        }

                        // Daily duration (hours and minutes)
                        Text(day.formattedDuration)
                            .font(.system(.caption2, design: .rounded, weight: day.isRead ? .bold : .regular))
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

// MARK: - Swipeable Surah Progress Row Item

struct SwipeableSurahProgressRow: View {
    let progress: SurahProgress
    let onSelect: () -> Void
    let onToggleCompleted: () -> Void

    @State private var dragOffset: CGFloat = 0
    @State private var hasPassedThreshold: Bool = false

    private let actionThreshold: CGFloat = 75

    var body: some View {
        ZStack {
            // Background Action (revealed as card slides horizontally)
            RoundedRectangle(cornerRadius: 14)
                .fill(progress.isCompleted ? Color.cautionFill : Color.progressFill)
                .overlay(
                    HStack(spacing: 8) {
                        if dragOffset > 0 {
                            // Card moved right -> action revealed on the left side
                            HStack(spacing: 6) {
                                Image(systemName: progress.isCompleted ? "arrow.uturn.backward.circle.fill" : "checkmark.circle.fill")
                                    .font(.headline.weight(.bold))
                                Text(progress.isCompleted ? "إلغاء الإكمال" : "إكمال في الختمة")
                                    .font(.footnote.weight(.bold))
                            }
                            .foregroundColor(.white)
                            .padding(.horizontal, 16)
                            Spacer()
                        } else if dragOffset < 0 {
                            // Card moved left -> action revealed on the right side
                            Spacer()
                            HStack(spacing: 6) {
                                Text(progress.isCompleted ? "إلغاء الإكمال" : "إكمال في الختمة")
                                    .font(.footnote.weight(.bold))
                                Image(systemName: progress.isCompleted ? "arrow.uturn.backward.circle.fill" : "checkmark.circle.fill")
                                    .font(.headline.weight(.bold))
                            }
                            .foregroundColor(.white)
                            .padding(.horizontal, 16)
                        }
                    }
                )

            // Foreground Surah Card
            SurahProgressItemRow(progress: progress)
                .offset(x: dragOffset)
                .contentShape(Rectangle())
                .simultaneousGesture(
                    DragGesture(minimumDistance: 20)
                        .onChanged { value in
                            let isHorizontal = abs(value.translation.width) > abs(value.translation.height) * 1.5
                            if isHorizontal || dragOffset != 0 {
                                if value.translation.width > 0 {
                                    dragOffset = min(130, value.translation.width)
                                } else {
                                    dragOffset = max(-130, value.translation.width)
                                }

                                if abs(dragOffset) >= actionThreshold && !hasPassedThreshold {
                                    hasPassedThreshold = true
                                    UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                                } else if abs(dragOffset) < actionThreshold && hasPassedThreshold {
                                    hasPassedThreshold = false
                                }
                            }
                        }
                        .onEnded { value in
                            let triggered = abs(dragOffset) >= actionThreshold
                            withMotion {
                                dragOffset = 0
                                hasPassedThreshold = false
                            }
                            if triggered {
                                UINotificationFeedbackGenerator().notificationOccurred(.success)
                                onToggleCompleted()
                            }
                        }
                )
                .onTapGesture {
                    if dragOffset == 0 {
                        onSelect()
                    } else {
                        withMotion {
                            dragOffset = 0
                        }
                    }
                }
        }
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("surah-progress-row-\(progress.surahNumber)")
        .accessibilityAddTraits(.isButton)
        .accessibilityAction { onSelect() }
        .accessibilityAction(named: progress.isCompleted ? "إلغاء إكمال السورة في الختمة" : "إكمال السورة في الختمة") {
            onToggleCompleted()
        }
        .contextMenu {
            Button {
                onToggleCompleted()
            } label: {
                Label(
                    progress.isCompleted ? "إلغاء إكمال السورة في الختمة" : "إكمال السورة في الختمة",
                    systemImage: progress.isCompleted ? "arrow.uturn.backward" : "checkmark.circle"
                )
            }

            Button {
                onSelect()
            } label: {
                Label("متابعة القراءة", systemImage: "book")
            }
        }
    }
}

// MARK: - Surah Progress Row Item

struct SurahProgressItemRow: View {
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
                        .font(.callout.weight(.semibold))
                        .foregroundColor(.primary)

                    Spacer()

                    Text("\(progress.readAyahsCount)/\(progress.totalAyahsCount)")
                        .font(.caption.monospacedDigit())
                        .foregroundColor(.secondary)

                    Text("\(Int(progress.percentage))%")
                        .font(.caption.bold())
                        .foregroundColor(progress.isCompleted ? .progress : .primary)
                }

                // Progress Bar
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule()
                            .fill(Color(uiColor: .tertiarySystemFill))
                            .frame(height: 5)
                        Capsule()
                            .fill(progress.isCompleted ? Color.progress : Color.progress.opacity(0.55))
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
                            .font(.caption2)
                            .foregroundColor(.progress)
                        Text("مكتملة • لم يبقَ شيء")
                            .font(.caption2.weight(.medium))
                            .foregroundColor(.progress)
                    } else {
                        Text("المتبقي: \(progress.remainingAyahsCount) آية")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                }
            }

            Image(systemName: "chevron.left")
                .font(.caption.weight(.semibold))
                .foregroundColor(Color(uiColor: .tertiaryLabel))
        }
        .padding(12)
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .cornerRadius(14)
    }
}

// MARK: - Daily Reading Duration History

struct DailyReadingHistoryCard: View {
    let days: [ReadingDayRecord]

    var body: some View {
        if !days.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Image(systemName: "calendar.badge.clock")
                        .foregroundColor(.info)
                        .font(.headline)
                    Text("سجل القراءة اليومي")
                        .font(.headline.weight(.bold))
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
                                    .foregroundColor(.info)
                                Text(formatDuration(day.secondsRead))
                                    .font(.subheadline.bold())
                                    .foregroundColor(.info)
                            }

                            Text("• \(ArabicDigits.string(day.pagesRead)) ص • \(ArabicDigits.string(day.ayahsRead)) آية")
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
                return "\(ArabicDigits.string(hours)) س \(ArabicDigits.string(minutes)) د"
            } else {
                return "\(ArabicDigits.string(hours)) س"
            }
        } else {
            return "\(ArabicDigits.string(max(1, minutes))) د"
        }
    }
}
