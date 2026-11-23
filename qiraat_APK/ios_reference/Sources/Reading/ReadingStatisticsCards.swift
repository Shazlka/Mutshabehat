import MushafCore
import SwiftUI

// MARK: - Reading Progress Tier & Colors

enum ReadingProgressTier: Equatable {
    case low       // 0% - 33%
    case medium    // 34% - 74%
    case high      // 75% - 100%

    init(percentage: Double) {
        if percentage >= 75.0 {
            self = .high
        } else if percentage >= 34.0 {
            self = .medium
        } else {
            self = .low
        }
    }

    var color: Color {
        switch self {
        case .low:
            return .danger
        case .medium:
            return .caution
        case .high:
            return .progress
        }
    }

    var shadowColor: Color {
        color.opacity(0.38)
    }
}

// MARK: - Daily Reading Heat Level

enum DailyHeatLevel: Equatable {
    case none
    case light     // 1 - 10 mins (1 - 600s)
    case medium    // 10 - 30 mins (601 - 1800s)
    case high      // 30 - 60 mins (1801 - 3600s)
    case deep      // > 60 mins (> 3600s)

    init(seconds: Int, isRead: Bool) {
        guard isRead else {
            self = .none
            return
        }
        if seconds <= 600 {
            self = .light
        } else if seconds <= 1800 {
            self = .medium
        } else if seconds <= 3600 {
            self = .high
        } else {
            self = .deep
        }
    }

    var fillColor: Color {
        switch self {
        case .none:
            return .clear
        case .light:
            return Color.progress.opacity(0.32)
        case .medium:
            return Color.progress.opacity(0.65)
        case .high:
            return Color.progress
        case .deep:
            return Color.progressFill
        }
    }

    var textColor: Color {
        switch self {
        case .none:
            return .secondary
        case .light:
            return Color.primary
        case .medium, .high, .deep:
            return .white
        }
    }

    var shadowColor: Color {
        switch self {
        case .none:
            return .clear
        case .light:
            return Color.progress.opacity(0.18)
        case .medium:
            return Color.progress.opacity(0.32)
        case .high:
            return Color.progress.opacity(0.45)
        case .deep:
            return Color.progress.opacity(0.60)
        }
    }

    var shadowRadius: CGFloat {
        switch self {
        case .none: return 0
        case .light: return 1.5
        case .medium: return 3
        case .high: return 4
        case .deep: return 5
        }
    }
}

// MARK: - Khatma Summary

/// The current khatma as one figure and a bar, then the lifetime figures as a short list. Replaces a
/// 170 pt gradient ring plus a grid of identical number boxes: the same information, less to scan.
struct KhatmaSummaryCard: View {
    let stats: ReadingStatsOverview

    private var fraction: Double { max(0, min(1, stats.progressPercentage / 100)) }
    private var tier: ReadingProgressTier { ReadingProgressTier(percentage: stats.progressPercentage) }

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
                        .foregroundColor(tier.color)
                    Text("من القرآن")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                ProgressView(value: fraction)
                    .tint(tier.color)
                    .shadow(color: tier.shadowColor, radius: 4, x: 0, y: 1.5)
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

                Image(systemName: "chevron.forward")
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

            // 7 Days Heat Map
            HStack(spacing: 0) {
                ForEach(days) { day in
                    let heat = DailyHeatLevel(seconds: day.readingSeconds, isRead: day.isRead)
                    VStack(spacing: 6) {
                        Text(day.dayNameAr.prefix(3))
                            .font(.caption2.weight(.medium))
                            .foregroundColor(day.isToday ? .progress : .secondary)

                        ZStack {
                            if day.isRead {
                                Circle()
                                    .fill(heat.fillColor)
                                    .frame(width: 32, height: 32)
                                    .shadow(color: heat.shadowColor, radius: heat.shadowRadius, x: 0, y: 1.5)

                                Text(day.dayNumber)
                                    .font(.caption.weight(.bold))
                                    .foregroundColor(heat.textColor)
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
                    .accessibilityElement(children: .combine)
                    .accessibilityLabel("\(day.dayNameAr)، \(day.isRead ? day.formattedDuration : "لم يُقرأ")")
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

// MARK: - Horizontal pan

/// A UIKit pan that begins only when the finger moves mostly sideways. A vertical drag never starts it, so the
/// surrounding scroll view keeps every vertical gesture to itself and is never left waiting on this row.
struct HorizontalPanGesture: UIGestureRecognizerRepresentable {
    /// Horizontal translation since the pan began.
    let onChanged: (CGFloat) -> Void
    /// Called once when the pan ends; `committed` is false when the system cancelled it.
    let onEnded: (_ committed: Bool) -> Void

    final class Coordinator: NSObject, UIGestureRecognizerDelegate {
        func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
            guard let pan = gestureRecognizer as? UIPanGestureRecognizer else { return true }
            let velocity = pan.velocity(in: pan.view)
            return abs(velocity.x) > abs(velocity.y) * 1.5
        }

        func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer,
                               shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool {
            true
        }
    }

    func makeCoordinator(converter: CoordinateSpaceConverter) -> Coordinator { Coordinator() }

    func makeUIGestureRecognizer(context: Context) -> UIPanGestureRecognizer {
        let pan = UIPanGestureRecognizer()
        pan.delegate = context.coordinator
        pan.maximumNumberOfTouches = 1
        return pan
    }

    func handleUIGestureRecognizerAction(_ recognizer: UIPanGestureRecognizer, context: Context) {
        switch recognizer.state {
        case .changed:
            onChanged(recognizer.translation(in: recognizer.view).x)
        case .ended:
            onEnded(true)
        case .cancelled, .failed:
            onEnded(false)
        default:
            break
        }
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
                .gesture(
                    HorizontalPanGesture(
                        onChanged: { translation in
                            dragOffset = min(130, max(-130, translation))
                            if abs(dragOffset) >= actionThreshold && !hasPassedThreshold {
                                hasPassedThreshold = true
                                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                            } else if abs(dragOffset) < actionThreshold && hasPassedThreshold {
                                hasPassedThreshold = false
                            }
                        },
                        onEnded: { committed in
                            let triggered = committed && abs(dragOffset) >= actionThreshold
                            withMotion {
                                dragOffset = 0
                                hasPassedThreshold = false
                            }
                            if triggered {
                                UINotificationFeedbackGenerator().notificationOccurred(.success)
                                // After the pan has fully ended, so the row is never re-rendered or removed mid-gesture.
                                DispatchQueue.main.async { onToggleCompleted() }
                            }
                        }
                    )
                )
                .onTapGesture {
                    if dragOffset == 0 {
                        onSelect()
                    } else {
                        withMotion { dragOffset = 0 }
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

    private var tier: ReadingProgressTier {
        ReadingProgressTier(percentage: progress.percentage)
    }

    private var fraction: Double {
        max(0.0, min(1.0, progress.percentage / 100.0))
    }

    var body: some View {
        HStack(spacing: 12) {
            // Surah Number
            ZStack {
                Circle()
                    .fill(progress.isCompleted ? tier.color.opacity(0.18) : Color(uiColor: .tertiarySystemFill))
                    .frame(width: 28, height: 28)
                Text("\(progress.surahNumber)")
                    .font(.caption.weight(progress.isCompleted ? .bold : .medium).monospacedDigit())
                    .foregroundColor(progress.isCompleted ? tier.color : .secondary)
            }

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
                        .foregroundColor(progress.readAyahsCount > 0 ? tier.color : .secondary)
                }

                // Progress Bar with Red, Yellow, Green and glowing shadow
                ProgressView(value: fraction)
                    .tint(tier.color)
                    .shadow(color: tier.shadowColor, radius: 2.5, x: 0, y: 1)
                    .accessibilityHidden(true)

                // Subtitle: Remaining Ayahs
                HStack(spacing: 5) {
                    if progress.isCompleted {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.caption2)
                            .foregroundColor(.progress)
                        Text("مكتملة • لم يبقَ شيء")
                            .font(.caption2.weight(.medium))
                            .foregroundColor(.progress)
                    } else if progress.isStarted {
                        Circle()
                            .fill(tier.color)
                            .frame(width: 6, height: 6)
                            .shadow(color: tier.shadowColor, radius: 2)
                        Text("المتبقي: \(progress.remainingAyahsCount) آية")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    } else {
                        Text("المتبقي: \(progress.remainingAyahsCount) آية")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                }
            }

            Image(systemName: "chevron.forward")
                .font(.caption.weight(.semibold))
                .foregroundColor(Color(uiColor: .tertiaryLabel))
        }
        .padding(12)
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .cornerRadius(14)
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(progress.isCompleted ? tier.color.opacity(0.32) : (progress.isStarted ? tier.color.opacity(0.14) : Color.clear), lineWidth: 1)
        )
        .shadow(
            color: progress.readAyahsCount > 0 ? tier.shadowColor.opacity(progress.isCompleted ? 0.35 : 0.18) : Color.clear,
            radius: progress.isCompleted ? 4 : 2,
            x: 0,
            y: 1.5
        )
    }
}

// MARK: - Daily Reading Duration History

struct DailyReadingHistoryCard: View {
    let days: [ReadingDayRecord]

    private static let inFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    private static let outFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "ar")
        f.dateFormat = "EEEE d MMMM"
        return f
    }()

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
        guard let d = Self.inFormatter.date(from: dateStr) else { return dateStr }
        return Self.outFormatter.string(from: d)
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
