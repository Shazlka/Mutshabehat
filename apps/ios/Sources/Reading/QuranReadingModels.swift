import Foundation
import MushafCore

public enum BookmarkType: String, Codable, Sendable, CaseIterable {
    case ayah
    case page

    public var title: String {
        switch self {
        case .ayah: "آية"
        case .page: "صفحة"
        }
    }
}

public struct QuranBookmark: Identifiable, Hashable, Sendable {
    public let id: String
    public let type: BookmarkType
    public let surah: Int
    public let ayah: Int
    public let page: Int
    public let note: String?
    public let createdAt: Date

    public init(
        id: String = UUID().uuidString,
        type: BookmarkType,
        surah: Int,
        ayah: Int,
        page: Int,
        note: String? = nil,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.type = type
        self.surah = surah
        self.ayah = ayah
        self.page = page
        self.note = note
        self.createdAt = createdAt
    }

    public var ayahKey: AyahKey {
        AyahKey(surah: surah, ayah: ayah)
    }
}

public struct KhatmaRecord: Identifiable, Hashable, Sendable {
    public let id: String
    public let khatmaNumber: Int
    public let startedAt: Date
    public let completedAt: Date?
    public let status: String // "active", "completed"
    public let percentComplete: Double

    public init(
        id: String = UUID().uuidString,
        khatmaNumber: Int,
        startedAt: Date = Date(),
        completedAt: Date? = nil,
        status: String = "active",
        percentComplete: Double = 0.0
    ) {
        self.id = id
        self.khatmaNumber = khatmaNumber
        self.startedAt = startedAt
        self.completedAt = completedAt
        self.status = status
        self.percentComplete = percentComplete
    }

    public var isCompleted: Bool {
        status == "completed"
    }

    public var durationInDays: Int {
        let end = completedAt ?? Date()
        let diff = Calendar.current.dateComponents([.day], from: startedAt, to: end).day ?? 0
        return max(1, diff + 1)
    }
}

public struct ReadingDayRecord: Identifiable, Hashable, Sendable {
    public var id: String { dateString }
    public let dateString: String // YYYY-MM-DD
    public let ayahsRead: Int
    public let pagesRead: Int
    public let secondsRead: Int
    public let lastReadAt: Date

    public init(dateString: String, ayahsRead: Int, pagesRead: Int, secondsRead: Int = 0, lastReadAt: Date) {
        self.dateString = dateString
        self.ayahsRead = ayahsRead
        self.pagesRead = pagesRead
        self.secondsRead = secondsRead
        self.lastReadAt = lastReadAt
    }
}

public struct SurahProgress: Identifiable, Hashable, Sendable {
    public var id: Int { surahNumber }
    public let surahNumber: Int
    public let surahName: String
    public let readAyahsCount: Int
    public let totalAyahsCount: Int
    public let firstPage: Int

    public var percentage: Double {
        guard totalAyahsCount > 0 else { return 0 }
        return (Double(readAyahsCount) / Double(totalAyahsCount)) * 100.0
    }

    public var isCompleted: Bool {
        readAyahsCount >= totalAyahsCount && totalAyahsCount > 0
    }

    public var isStarted: Bool {
        readAyahsCount > 0 && !isCompleted
    }

    public var remainingAyahsCount: Int {
        max(0, totalAyahsCount - readAyahsCount)
    }
}

public enum SurahProgressFilter: String, CaseIterable, Identifiable, Sendable {
    case all = "all"
    case remaining = "remaining"
    case completed = "completed"
    case started = "started"

    public var id: String { rawValue }

    public var title: String {
        switch self {
        case .all: "الكل"
        case .remaining: "المتبقي"
        case .completed: "المكتمل"
        case .started: "قيد القراءة"
        }
    }
}

public struct WeeklyDayStatus: Identifiable, Hashable, Sendable {
    public var id: String { dateString }
    public let dateString: String
    public let dayNameAr: String // السبت، الأحد، ...
    public let dayNumber: String // ١، ٢، ...
    public let isRead: Bool
    public let isToday: Bool
    public let readingSeconds: Int

    public init(dateString: String, dayNameAr: String, dayNumber: String, isRead: Bool, isToday: Bool, readingSeconds: Int = 0) {
        self.dateString = dateString
        self.dayNameAr = dayNameAr
        self.dayNumber = dayNumber
        self.isRead = isRead
        self.isToday = isToday
        self.readingSeconds = readingSeconds
    }

    public var formattedDuration: String {
        guard isRead, readingSeconds > 0 else { return "—" }
        let hours = readingSeconds / 3600
        let minutes = (readingSeconds % 3600) / 60
        let digits = ["0": "٠", "1": "١", "2": "٢", "3": "٣", "4": "٤",
                      "5": "٥", "6": "٦", "7": "٧", "8": "٨", "9": "٩"]
        let formatIndic: (Int) -> String = { val in
            String(val).compactMap { digits[String($0)] }.joined()
        }
        if hours > 0 {
            if minutes > 0 {
                return "\(formatIndic(hours)) س \(formatIndic(minutes)) د"
            } else {
                return "\(formatIndic(hours)) س"
            }
        } else {
            let m = max(1, minutes)
            return "\(formatIndic(m)) د"
        }
    }
}

public struct ReadingStatsOverview: Sendable {
    public let currentKhatma: KhatmaRecord
    public let currentStreak: Int
    public let longestStreak: Int
    public let totalReadingDays: Int
    public let completedKhatmasCount: Int
    public let totalAyahsReadInCurrentKhatma: Int
    public let totalQuranAyahs: Int
    public let totalPagesReadInCurrentKhatma: Int
    public let completedSurahsCount: Int
    public let lifetimeAyahsRead: Int
    public let lifetimeReadingSeconds: Int

    public init(
        currentKhatma: KhatmaRecord,
        currentStreak: Int,
        longestStreak: Int,
        totalReadingDays: Int,
        completedKhatmasCount: Int,
        totalAyahsReadInCurrentKhatma: Int,
        totalQuranAyahs: Int,
        totalPagesReadInCurrentKhatma: Int,
        completedSurahsCount: Int,
        lifetimeAyahsRead: Int,
        lifetimeReadingSeconds: Int = 0
    ) {
        self.currentKhatma = currentKhatma
        self.currentStreak = currentStreak
        self.longestStreak = longestStreak
        self.totalReadingDays = totalReadingDays
        self.completedKhatmasCount = completedKhatmasCount
        self.totalAyahsReadInCurrentKhatma = totalAyahsReadInCurrentKhatma
        self.totalQuranAyahs = totalQuranAyahs
        self.totalPagesReadInCurrentKhatma = totalPagesReadInCurrentKhatma
        self.completedSurahsCount = completedSurahsCount
        self.lifetimeAyahsRead = lifetimeAyahsRead
        self.lifetimeReadingSeconds = lifetimeReadingSeconds
    }

    public var lifetimeHours: Int {
        lifetimeReadingSeconds / 3600
    }

    public var lifetimeMinutes: Int {
        (lifetimeReadingSeconds % 3600) / 60
    }

    public var formattedLifetimeDuration: String {
        let digits = ["0": "٠", "1": "١", "2": "٢", "3": "٣", "4": "٤",
                      "5": "٥", "6": "٦", "7": "٧", "8": "٨", "9": "٩"]
        let formatIndic: (Int) -> String = { val in
            String(val).compactMap { digits[String($0)] }.joined()
        }
        let h = lifetimeHours
        let m = lifetimeMinutes
        if h > 0 {
            if m > 0 {
                return "\(formatIndic(h)) س و \(formatIndic(m)) د"
            } else {
                return "\(formatIndic(h)) ساعة"
            }
        } else {
            return "\(formatIndic(max(1, m))) دقيقة"
        }
    }

    public var progressPercentage: Double {
        guard totalQuranAyahs > 0 else { return 0 }
        return (Double(totalAyahsReadInCurrentKhatma) / Double(totalQuranAyahs)) * 100.0
    }

    public var remainingAyahs: Int {
        max(0, totalQuranAyahs - totalAyahsReadInCurrentKhatma)
    }

    public var remainingPages: Int {
        max(0, 604 - totalPagesReadInCurrentKhatma)
    }
}
