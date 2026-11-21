package com.shazlka.qiraat.reading

import com.shazlka.qiraat.core.AyahKey
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import java.util.UUID

object ArabicDigits {
    fun format(number: Number): String {
        return number.toString().map { ch ->
            if (ch in '0'..'9') (ch - '0' + 0x0660).toChar() else if (ch == '.') '٫' else ch
        }.joinToString("")
    }

    fun formatWhole(number: Long): String {
        return number.toString().map { ch ->
            if (ch in '0'..'9') (ch - '0' + 0x0660).toChar() else ch
        }.joinToString("")
    }
}

enum class BookmarkType(val value: String, val title: String) {
    AYAH("ayah", "آية"),
    PAGE("page", "صفحة");

    companion object {
        fun from(value: String): BookmarkType = entries.firstOrNull { it.value == value } ?: AYAH
    }
}

data class QuranBookmark(
    val id: String = UUID.randomUUID().toString(),
    val type: BookmarkType,
    val surah: Int,
    val ayah: Int,
    val page: Int,
    val note: String? = null,
    val createdAt: Instant = Instant.now(),
) {
    val ayahKey: AyahKey get() = AyahKey(surah, ayah)
}

data class KhatmaRecord(
    val id: String = UUID.randomUUID().toString(),
    val khatmaNumber: Int,
    val startedAt: Instant = Instant.now(),
    val completedAt: Instant? = null,
    val status: String = "active", // "active", "completed"
    val percentComplete: Double = 0.0,
) {
    val isCompleted: Boolean get() = status == "completed"

    val durationInDays: Int
        get() {
            val startDay = startedAt.atZone(ZoneId.systemDefault()).toLocalDate().toEpochDay()
            val endDay = (completedAt ?: Instant.now()).atZone(ZoneId.systemDefault()).toLocalDate().toEpochDay()
            return maxOf(1, (endDay - startDay).toInt() + 1)
        }
}

data class ReadingDayRecord(
    val dateString: String, // YYYY-MM-DD
    val ayahsRead: Int,
    val pagesRead: Int,
    val secondsRead: Int = 0,
    val lastReadAt: Instant = Instant.now(),
)

data class SurahProgress(
    val surahNumber: Int,
    val surahName: String,
    val readAyahsCount: Int,
    val totalAyahsCount: Int,
    val firstPage: Int,
) {
    val percentage: Double
        get() = if (totalAyahsCount > 0) (readAyahsCount.toDouble() / totalAyahsCount.toDouble()) * 100.0 else 0.0

    val isCompleted: Boolean
        get() = totalAyahsCount > 0 && readAyahsCount >= totalAyahsCount

    val isStarted: Boolean
        get() = readAyahsCount > 0 && !isCompleted

    val remainingAyahsCount: Int
        get() = maxOf(0, totalAyahsCount - readAyahsCount)
}

enum class SurahProgressFilter(val id: String, val title: String) {
    ALL("all", "الكل"),
    REMAINING("remaining", "المتبقي"),
    COMPLETED("completed", "المكتمل"),
    STARTED("started", "قيد القراءة");
}

data class WeeklyDayStatus(
    val dateString: String,
    val dayNameAr: String,
    val dayNumber: String,
    val isRead: Boolean,
    val isToday: Boolean,
    val readingSeconds: Int = 0,
) {
    val formattedDuration: String
        get() {
            if (!isRead || readingSeconds <= 0) return "—"
            val hours = readingSeconds / 3600
            val minutes = (readingSeconds % 3600) / 60
            return if (hours > 0) {
                if (minutes > 0) {
                    "${ArabicDigits.format(hours)} س ${ArabicDigits.format(minutes)} د"
                } else {
                    "${ArabicDigits.format(hours)} س"
                }
            } else {
                val m = maxOf(1, minutes)
                "${ArabicDigits.format(m)} د"
            }
        }
}

data class ReadingStatsOverview(
    val currentKhatma: KhatmaRecord,
    val currentStreak: Int,
    val longestStreak: Int,
    val totalReadingDays: Int,
    val completedKhatmasCount: Int,
    val totalAyahsReadInCurrentKhatma: Int,
    val totalQuranAyahs: Int,
    val totalPagesReadInCurrentKhatma: Int,
    val completedSurahsCount: Int,
    val lifetimeAyahsRead: Int,
    val lifetimeReadingSeconds: Int,
)

enum class ReadingChartMetric(val id: String, val titleAr: String, val titleEn: String, val unitAr: String, val unitEn: String) {
    AYAHS("ayahs", "الآيات", "Ayahs", "آية", "ayahs"),
    PAGES("pages", "الصفحات", "Pages", "صفحة", "pages"),
    JUZ("juz", "الأجزاء", "Juz’", "جزء", "juz’");

    fun title(isArabic: Boolean = true) = if (isArabic) titleAr else titleEn
    fun unit(isArabic: Boolean = true) = if (isArabic) unitAr else unitEn

    val emptyAxisMaximum: Double
        get() = when (this) {
            AYAHS -> 50.0
            PAGES -> 10.0
            JUZ -> 1.0
        }

    fun formatted(value: Double, isArabic: Boolean = true): String {
        return "${number(value, isArabic)} ${unit(isArabic)}"
    }

    companion object {
        fun number(value: Double, isArabic: Boolean = true): String {
            val rounded = (value * 10).toLong() / 10.0
            val text = if (rounded == rounded.toLong().toDouble()) {
                rounded.toLong().toString()
            } else {
                String.format(Locale.US, "%.1f", rounded)
            }
            return if (isArabic) ArabicDigits.format(rounded) else text
        }
    }
}

enum class ReadingChartRange(val days: Int, val titleAr: String, val titleEn: String, val axisStride: Int) {
    DAYS_7(7, "٧ أيام", "7 Days", 1),
    DAYS_14(14, "١٤ يومًا", "14 Days", 2),
    DAYS_30(30, "٣٠ يومًا", "30 Days", 5);

    fun title(isArabic: Boolean = true) = if (isArabic) titleAr else titleEn
}

data class DailyReadingChartPoint(
    val date: LocalDate,
    val dateString: String,
    val ayahs: Int,
    val pages: Int,
    val seconds: Int,
) {
    val juz: Double
        get() = if (pages > 0) pages.toDouble() / (604.0 / 30.0)
        else if (ayahs > 0) ayahs.toDouble() / (6236.0 / 30.0)
        else 0.0

    fun value(metric: ReadingChartMetric): Double = when (metric) {
        ReadingChartMetric.AYAHS -> ayahs.toDouble()
        ReadingChartMetric.PAGES -> pages.toDouble()
        ReadingChartMetric.JUZ -> juz
    }

    companion object {
        fun points(
            range: ReadingChartRange,
            records: List<ReadingDayRecord>,
            today: LocalDate = LocalDate.now(),
        ): List<DailyReadingChartPoint> {
            val recordsByDay = records.associateBy { it.dateString }
            return (0 until range.days).reversed().map { daysAgo ->
                val day = today.minusDays(daysAgo.toLong())
                val key = day.format(DateTimeFormatter.ISO_LOCAL_DATE)
                val record = recordsByDay[key]
                DailyReadingChartPoint(
                    date = day,
                    dateString = key,
                    ayahs = record?.ayahsRead ?: 0,
                    pages = record?.pagesRead ?: 0,
                    seconds = record?.secondsRead ?: 0,
                )
            }
        }
    }
}
