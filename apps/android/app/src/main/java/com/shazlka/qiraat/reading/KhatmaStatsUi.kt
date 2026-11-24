package com.shazlka.qiraat.reading

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.graphics.Paint
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBackIosNew
import androidx.compose.material.icons.filled.AutoStories
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Cancel
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Inbox
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.PanTool
import androidx.compose.material.icons.filled.Replay
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.TouchApp
import androidx.compose.material.icons.filled.UnfoldMore
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shazlka.qiraat.core.MushafDatabase
import com.shazlka.qiraat.core.Surah
import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.format.TextStyle as DateTextStyle
import java.util.Locale
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * The khatma statistics screen, laid out and coloured exactly like the iOS `ReadingStatisticsView`:
 * the same cards in the same order, the same palette, a tappable daily chart and compact surah rows.
 *
 * It reads only a narrow slice of the reading API (the tracker getters, `surahProgressList`,
 * `currentWeekReadingDays`, `markSurahCompleted`, the manual-session calls and `db.allReadingDays()`), so the same
 * compiled screen also runs inside the approved APK.
 */
@Composable
fun KhatmaStatsScreen(
    tracker: ReadingTracker,
    surahs: List<Surah>,
    surahAyahCounts: Map<Int, Int>,
    currentPage: Int,
    onNavigateToPage: (Int) -> Unit,
    onBack: () -> Unit,
) {
    val context = LocalContext.current
    val dark = MaterialTheme.colorScheme.surface.luminance() < 0.5f
    val c = remember(dark) { KhatmaStatsColors(dark) }
    var tick by remember { mutableIntStateOf(0) }
    var filter by remember { mutableStateOf(SurahProgressFilter.ALL) }
    var search by remember { mutableStateOf("") }
    var showAddSession by remember { mutableStateOf(false) }

    val khatmaId = tracker.activeKhatma.id
    val ayahsRead = tracker.totalAyahsRead
    val data = remember(khatmaId, ayahsRead, tick, tracker.currentStreak, tracker.totalReadingDays, surahs) {
        loadKhatmaStats(tracker, surahs)
    }
    val place = remember(currentPage, surahs) { currentPlace(context, currentPage, surahs) }

    val filtered = remember(data.surahs, filter, search) {
        val query = search.trim()
        data.surahs.filter { item ->
            val matchesSearch = query.isEmpty() || item.surahName.contains(query, ignoreCase = true) || item.surahNumber.toString() == query
            matchesSearch && when (filter) {
                SurahProgressFilter.ALL -> true
                SurahProgressFilter.REMAINING -> !item.isCompleted
                SurahProgressFilter.COMPLETED -> item.isCompleted
                SurahProgressFilter.STARTED -> item.isStarted
            }
        }
    }

    // The iPhone app keeps Arabic text in a left-to-right layout; do the same so the two screens match.
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
        Column(Modifier.fillMaxSize().background(c.background)) {
            StatsTopBar(c, onBack = onBack, onAdd = { showAddSession = true })
            LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(top = 4.dp, bottom = 28.dp)) {
                item { Gap { KhatmaSummary(c, data, tracker.activeKhatma.khatmaNumber) } }
                place?.let { here ->
                    item {
                        Gap {
                            ContinueBanner(c, here) {
                                onNavigateToPage(currentPage)
                                onBack()
                            }
                        }
                    }
                }
                item { Gap { WeeklyStreak(c, tracker.currentStreak, tracker.longestStreak, data.weekly) { showAddSession = true } } }
                item { Gap { DailyChart(c, data.days) } }
                if (data.days.isNotEmpty()) item { Gap { DailyHistory(c, data.days) } }
                item {
                    SurahSection(
                        c = c,
                        completedCount = data.surahs.count { it.isCompleted },
                        all = data.surahs,
                        search = search,
                        onSearch = { search = it },
                        filter = filter,
                        onFilter = { filter = it },
                    )
                }
                if (filtered.isEmpty()) {
                    item { EmptySurahs(c) }
                } else {
                    items(filtered, key = { it.surahNumber }) { progress ->
                        Box(Modifier.padding(horizontal = 16.dp).padding(bottom = 8.dp)) {
                            SwipeSurahRow(
                                c = c,
                                progress = progress,
                                onSelect = {
                                    onNavigateToPage(progress.firstPage)
                                    onBack()
                                },
                                onToggle = {
                                    tracker.markSurahCompleted(
                                        surahNumber = progress.surahNumber,
                                        completed = !progress.isCompleted,
                                        surahAyahCounts = surahAyahCounts,
                                        pageResolver = { s, _ -> surahs.firstOrNull { it.number == s }?.firstPage ?: 1 },
                                    )
                                    tick++
                                },
                            )
                        }
                    }
                }
            }
        }
    }

    if (showAddSession) {
        AddReadingSessionDialog(
            surahs = surahs,
            surahAyahCounts = surahAyahCounts,
            onDismiss = { showAddSession = false },
            onSaveSession = { fromSurah, fromAyah, toSurah, toAyah, duration ->
                tracker.recordManualSession(
                    fromSurah = fromSurah,
                    fromAyah = fromAyah,
                    toSurah = toSurah,
                    toAyah = toAyah,
                    sessionDate = Instant.now(),
                    durationMinutes = duration,
                    surahAyahCounts = surahAyahCounts,
                    pageResolver = { s, _ -> surahs.firstOrNull { it.number == s }?.firstPage ?: 1 },
                )
                showAddSession = false
                tick++
            },
            onSavePageSession = { fromPage, toPage, duration ->
                tracker.recordManualPageRangeSession(
                    fromPage = fromPage,
                    toPage = toPage,
                    sessionDate = Instant.now(),
                    durationMinutes = duration,
                    pageAyahsResolver = { emptyList() },
                )
                showAddSession = false
                tick++
            },
        )
    }
}

// MARK: - Palette (the iOS AppColors, light and dark)

private class KhatmaStatsColors(val dark: Boolean) {
    val progress = if (dark) Color(0xFF5FD38D) else Color(0xFF1A7340)
    val progressFill = if (dark) Color(0xFF23854D) else Color(0xFF1A7340)
    val caution = if (dark) Color(0xFFF7A65E) else Color(0xFFA14D07)
    val cautionFill = if (dark) Color(0xFFA8530C) else Color(0xFFA14D07)
    val info = if (dark) Color(0xFF80B4FF) else Color(0xFF1B5FC1)
    val insight = if (dark) Color(0xFFC3A5F7) else Color(0xFF6A3DB0)
    val danger = if (dark) Color(0xFFFF8A8A) else Color(0xFFB4232A)

    val background = if (dark) Color(0xFF000000) else Color(0xFFF2F2F7)
    val card = if (dark) Color(0xFF1C1C1E) else Color(0xFFFFFFFF)
    val cardInset = if (dark) Color(0xFF2C2C2E) else Color(0xFFF2F2F7)
    val fill = if (dark) Color(0x3D767680) else Color(0x1F767680)
    val label = if (dark) Color(0xFFFFFFFF) else Color(0xFF000000)
    val secondary = if (dark) Color(0x99EBEBF5) else Color(0x993C3C43)
    val tertiary = if (dark) Color(0x4DEBEBF5) else Color(0x4D3C3C43)
    val separator = if (dark) Color(0x59545458) else Color(0x4A3C3C43)
    val segmentSelected = if (dark) Color(0xFF636366) else Color(0xFFFFFFFF)
}

private enum class KhatmaTier {
    LOW, MEDIUM, HIGH;

    fun color(c: KhatmaStatsColors) = when (this) { LOW -> c.danger; MEDIUM -> c.caution; HIGH -> c.progress }

    companion object {
        fun of(percentage: Double) = if (percentage >= 75.0) HIGH else if (percentage >= 34.0) MEDIUM else LOW
    }
}

private fun Modifier.glow(color: Color, radius: Dp, shape: Shape): Modifier =
    this.shadow(radius, shape, ambientColor = color, spotColor = color)

private fun Modifier.card(c: KhatmaStatsColors, radius: Int = 18, stroke: Color? = null): Modifier {
    val shape = RoundedCornerShape(radius.dp)
    val filled = this.clip(shape).background(c.card)
    return if (stroke != null) filled.border(BorderStroke(1.dp, stroke), shape) else filled
}

/** The 20 dp the iOS stack leaves between its cards. */
@Composable
private fun Gap(content: @Composable () -> Unit) {
    Column(Modifier.padding(bottom = 20.dp)) { content() }
}

@Composable
private fun StatsText(
    text: String,
    size: Float,
    color: Color,
    modifier: Modifier = Modifier,
    weight: FontWeight = FontWeight.Normal,
    maxLines: Int = Int.MAX_VALUE,
    align: TextAlign = TextAlign.Start,
) {
    val lineHeight = with(LocalDensity.current) { (size * 1.25f).sp.toDp() }
    // The Arabic font's own line box is about 1.7 times its size; a one-line text keeps the 1.25 line height the iOS
    // screen has, centred on its glyphs, so the cards come out the same height as on the iPhone.
    val box = if (maxLines == 1) modifier.height(lineHeight).wrapContentHeight(Alignment.CenterVertically, unbounded = true) else modifier
    Text(
        text = text,
        modifier = box,
        color = color,
        fontSize = size.sp,
        fontWeight = weight,
        maxLines = maxLines,
        overflow = TextOverflow.Ellipsis,
        textAlign = align,
        style = TextStyle(
            lineHeight = (size * 1.25f).sp,
            platformStyle = PlatformTextStyle(includeFontPadding = false),
            lineHeightStyle = LineHeightStyle(alignment = LineHeightStyle.Alignment.Center, trim = LineHeightStyle.Trim.Both),
        ),
    )
}

// MARK: - Formatting

private fun indic(value: Int): String = indic(value.toString())

private fun indic(text: String): String = text.map { if (it in '0'..'9') ('٠' + (it - '0')) else it }.joinToString("")

private fun number(value: Double): String {
    val rounded = (value * 10).roundToInt() / 10.0
    val text = if (rounded == floor(rounded)) rounded.toInt().toString() else String.format(Locale.US, "%.1f", rounded)
    return indic(text).replace('.', '٫')
}

private fun duration(seconds: Int): String {
    if (seconds <= 0) return "—"
    val hours = seconds / 3600
    val minutes = (seconds % 3600) / 60
    return when {
        hours > 0 && minutes > 0 -> "${indic(hours)} س ${indic(minutes)} د"
        hours > 0 -> "${indic(hours)} س"
        else -> "${indic(max(1, minutes))} د"
    }
}

private fun lifetimeDuration(seconds: Int): String {
    val hours = seconds / 3600
    val minutes = (seconds % 3600) / 60
    return when {
        hours > 0 && minutes > 0 -> "${indic(hours)} س و ${indic(minutes)} د"
        hours > 0 -> "${indic(hours)} ساعة"
        else -> "${indic(max(1, minutes))} دقيقة"
    }
}

private val arabicLocale = Locale("ar")

private fun fullDate(date: LocalDate): String =
    "${date.dayOfWeek.getDisplayName(DateTextStyle.FULL, arabicLocale)} ${date.dayOfMonth} ${date.month.getDisplayName(DateTextStyle.FULL, arabicLocale)}"

private fun shortWeekday(day: DayOfWeek): String = day.getDisplayName(DateTextStyle.SHORT, arabicLocale)

// MARK: - Data

private class KhatmaStatsData(
    val totalQuranAyahs: Int,
    val ayahsRead: Int,
    val pagesRead: Int,
    val percent: Double,
    val lifetimeAyahs: Int,
    val lifetimeSeconds: Int,
    val completedKhatmas: Int,
    val totalDays: Int,
    val weekly: List<WeeklyDayStatus>,
    val days: List<ReadingDayRecord>,
    val surahs: List<SurahProgress>,
)

private const val TOTAL_PAGES = 604

/** The Mushaf page count of the khatma, from the page stored with each read ayah (the iOS `readPagesCount`). */
private fun readPagesCount(tracker: ReadingTracker, khatmaId: String, ayahsRead: Int): Int = try {
    SQLiteDatabase.openDatabase(tracker.db.databaseFile.path, null, SQLiteDatabase.OPEN_READONLY).use { database ->
        database.rawQuery("SELECT COUNT(DISTINCT page) FROM khatma_read_ayahs WHERE khatma_id = ?", arrayOf(khatmaId)).use { cursor ->
            if (cursor.moveToFirst()) cursor.getInt(0) else 0
        }
    }
} catch (_: Exception) {
    ayahsRead * TOTAL_PAGES / 6236
}

/** 0…100 counted in Mushaf pages, and below 100 until every ayah has been read (the iOS `KhatmaProgress.percent`). */
internal fun khatmaPercent(pagesRead: Int, allAyahsRead: Boolean): Double =
    if (allAyahsRead) 100.0 else min(min(max(pagesRead, 0), TOTAL_PAGES).toDouble() / TOTAL_PAGES * 100, 99.0)

private fun loadKhatmaStats(tracker: ReadingTracker, surahs: List<Surah>): KhatmaStatsData {
    val khatma = tracker.activeKhatma
    val ayahsRead = tracker.totalAyahsRead
    val total = surahs.sumOf { it.ayahCount }.takeIf { it > 0 } ?: 6236
    val pages = readPagesCount(tracker, khatma.id, ayahsRead)
    val percent = khatmaPercent(pages, ayahsRead >= total)
    return KhatmaStatsData(
        totalQuranAyahs = total,
        ayahsRead = ayahsRead,
        pagesRead = pages,
        percent = percent,
        lifetimeAyahs = max(ayahsRead, tracker.db.lifetimeReadAyahsCount()),
        lifetimeSeconds = tracker.db.lifetimeReadingSeconds(),
        completedKhatmas = tracker.completedKhatmasCount,
        totalDays = tracker.totalReadingDays,
        weekly = tracker.currentWeekReadingDays(),
        days = tracker.db.allReadingDays().sortedByDescending { it.dateString },
        surahs = tracker.surahProgressList(surahs),
    )
}

private class KhatmaPlace(val surahName: String, val ayah: Int?, val page: Int)

private fun currentPlace(context: Context, page: Int, surahs: List<Surah>): KhatmaPlace? {
    val fallback = surahs.lastOrNull { it.firstPage <= page } ?: surahs.firstOrNull() ?: return null
    return try {
        MushafDatabase.open(MushafDatabase.installBundledDatabase(context)).use { database ->
            val first = database.page(page).metadata.firstAyah
            val surah = surahs.firstOrNull { it.number == first.surah } ?: fallback
            KhatmaPlace(surah.name, first.ayah, page)
        }
    } catch (_: Exception) {
        KhatmaPlace(fallback.name, null, page)
    }
}

// MARK: - Top bar

@Composable
private fun StatsTopBar(c: KhatmaStatsColors, onBack: () -> Unit, onAdd: () -> Unit) {
    Box(Modifier.fillMaxWidth().height(60.dp).padding(horizontal = 16.dp)) {
        BarButton(c, Icons.Filled.ArrowBackIosNew, "رجوع", c.label, 18.dp, Modifier.align(Alignment.CenterStart), onBack)
        StatsText("إحصائيات القراءة والختمة", 17f, c.label, Modifier.align(Alignment.Center), FontWeight.SemiBold, 1)
        BarButton(c, Icons.Filled.Add, "أضف جلسة", c.progress, 22.dp, Modifier.align(Alignment.CenterEnd), onAdd)
    }
}

@Composable
private fun BarButton(c: KhatmaStatsColors, icon: ImageVector, description: String, tint: Color, iconSize: Dp, modifier: Modifier, onClick: () -> Unit) {
    Box(
        modifier.size(44.dp).shadow(2.dp, CircleShape).clip(CircleShape).background(c.card).clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, description, tint = tint, modifier = Modifier.size(iconSize))
    }
}

// MARK: - Progress bar

@Composable
private fun StatsProgress(c: KhatmaStatsColors, fraction: Double, color: Color, glowRadius: Dp, modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(50)
    Box(modifier.fillMaxWidth().height(4.dp).clip(shape).background(c.fill)) {
        val f = fraction.coerceIn(0.0, 1.0).toFloat()
        if (f > 0f) {
            Box(Modifier.fillMaxWidth(f).fillMaxHeight().clip(shape).background(color))
        }
    }
}

// MARK: - Summary

@Composable
private fun KhatmaSummary(c: KhatmaStatsColors, d: KhatmaStatsData, khatmaNumber: Int) {
    val tier = KhatmaTier.of(d.percent)
    val fraction = (d.percent / 100).coerceIn(0.0, 1.0)
    Column(Modifier.padding(horizontal = 16.dp).fillMaxWidth().card(c, 14).padding(18.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            StatsText("الختمة الحالية (${indic(khatmaNumber)})", 15f, c.secondary)
            Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                StatsText("${number(fraction * 100)}٪", 34f, tier.color(c), weight = FontWeight.SemiBold)
                StatsText("من القرآن", 15f, c.secondary, Modifier.padding(bottom = 5.dp))
            }
            StatsProgress(c, fraction, tier.color(c), 4.dp)
            StatsText(
                "${indic(d.pagesRead)} من ٦٠٤ صفحة، بقي ${indic(max(0, TOTAL_PAGES - d.pagesRead))} · ${indic(d.ayahsRead)} من ${indic(d.totalQuranAyahs)} آية",
                13f,
                c.secondary,
            )
        }
        HorizontalDivider(color = c.separator, thickness = 0.5.dp)
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Figure(c, "وقت التلاوة الكلي", lifetimeDuration(d.lifetimeSeconds))
            Figure(c, "أيام التلاوة", "${indic(d.totalDays)} يوم")
            Figure(c, "الآيات المقروءة", "${indic(d.lifetimeAyahs)} آية")
            Figure(c, "الختمات المكتملة", indic(d.completedKhatmas))
        }
    }
}

@Composable
private fun Figure(c: KhatmaStatsColors, title: String, value: String) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        StatsText(title, 15f, c.secondary, Modifier.weight(1f))
        StatsText(value, 15f, c.label, weight = FontWeight.SemiBold, maxLines = 1)
    }
}

// MARK: - Continue reading

@Composable
private fun ContinueBanner(c: KhatmaStatsColors, place: KhatmaPlace, onClick: () -> Unit) {
    val line = buildString {
        append("سورة ${place.surahName}")
        place.ayah?.let { append("، آية $it") }
        append(" • ص ${place.page}")
    }
    Row(
        Modifier.padding(horizontal = 16.dp).fillMaxWidth().card(c, 16, c.progress.copy(alpha = 0.25f)).clickable(onClick = onClick).padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Box(Modifier.size(44.dp).clip(CircleShape).background(c.progress.copy(alpha = 0.18f)), contentAlignment = Alignment.Center) {
            Icon(Icons.Filled.AutoStories, null, tint = c.progress, modifier = Modifier.size(22.dp))
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            StatsText("تابع القراءة", 16f, c.label, weight = FontWeight.Bold)
            StatsText(line, 12f, c.secondary)
        }
        Icon(Icons.Filled.ChevronRight, null, tint = c.secondary, modifier = Modifier.size(18.dp))
    }
}

// MARK: - Weekly streak

private enum class KhatmaHeat {
    NONE, LIGHT, MEDIUM, HIGH, DEEP;

    fun fill(c: KhatmaStatsColors) = when (this) {
        NONE -> Color.Transparent
        LIGHT -> c.progress.copy(alpha = 0.32f)
        MEDIUM -> c.progress.copy(alpha = 0.65f)
        HIGH -> c.progress
        DEEP -> c.progressFill
    }

    fun text(c: KhatmaStatsColors) = if (this == NONE) c.secondary else if (this == LIGHT) c.label else Color.White

    fun shadow(c: KhatmaStatsColors) = when (this) {
        NONE -> Color.Transparent
        LIGHT -> c.progress.copy(alpha = 0.18f)
        MEDIUM -> c.progress.copy(alpha = 0.32f)
        HIGH -> c.progress.copy(alpha = 0.45f)
        DEEP -> c.progress.copy(alpha = 0.60f)
    }

    val radius: Dp get() = when (this) { NONE -> 0.dp; LIGHT -> 1.5.dp; MEDIUM -> 3.dp; HIGH -> 4.dp; DEEP -> 5.dp }

    companion object {
        fun of(seconds: Int, isRead: Boolean) = when {
            !isRead -> NONE
            seconds <= 600 -> LIGHT
            seconds <= 1800 -> MEDIUM
            seconds <= 3600 -> HIGH
            else -> DEEP
        }
    }
}

@Composable
private fun WeeklyStreak(c: KhatmaStatsColors, current: Int, longest: Int, days: List<WeeklyDayStatus>, onAdd: () -> Unit) {
    Column(Modifier.padding(horizontal = 16.dp).fillMaxWidth().card(c, 18).padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Filled.LocalFireDepartment, null, tint = c.caution, modifier = Modifier.size(28.dp))
            Spacer(Modifier.width(8.dp))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                StatsText("$current يوم مداومة", 17f, c.label, weight = FontWeight.Bold)
                StatsText("أطول مدة مداومة: $longest يوم", 12f, c.secondary)
            }
            Row(
                Modifier.clip(CircleShape).background(c.progress.copy(alpha = 0.14f)).clickable(onClick = onAdd).padding(horizontal = 12.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Icon(Icons.Filled.Add, null, tint = c.progress, modifier = Modifier.size(14.dp))
                StatsText("جلسة", 12f, c.progress, weight = FontWeight.Bold)
            }
        }
        Row(Modifier.fillMaxWidth().padding(top = 4.dp)) {
            days.forEach { day ->
                val heat = KhatmaHeat.of(day.readingSeconds, day.isRead)
                Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    StatsText(day.dayNameAr.take(3), 11f, if (day.isToday) c.progress else c.secondary, weight = FontWeight.Medium, maxLines = 1)
                    Box(Modifier.size(32.dp), contentAlignment = Alignment.Center) {
                        if (day.isRead) {
                            Box(Modifier.size(32.dp).glow(heat.shadow(c), heat.radius, CircleShape).clip(CircleShape).background(heat.fill(c)))
                            StatsText(day.dayNumber, 12f, heat.text(c), weight = FontWeight.Bold, maxLines = 1)
                        } else {
                            Box(Modifier.size(32.dp).border(1.5.dp, if (day.isToday) c.progress else c.fill, CircleShape))
                            StatsText(day.dayNumber, 12f, if (day.isToday) c.progress else c.secondary, weight = if (day.isToday) FontWeight.Bold else FontWeight.Normal, maxLines = 1)
                        }
                    }
                    Box(Modifier.size(4.dp).clip(CircleShape).background(if (day.isToday) c.progress else Color.Transparent))
                    StatsText(
                        day.formattedDuration,
                        11f,
                        if (day.isRead) c.label else c.secondary.copy(alpha = 0.5f),
                        weight = if (day.isRead) FontWeight.Bold else FontWeight.Normal,
                        maxLines = 1,
                    )
                }
            }
        }
    }
}

// MARK: - Daily chart

private enum class KhatmaChartMetric(val title: String, val unit: String, val emptyMaximum: Double) {
    AYAHS("الآيات", "آية", 50.0), PAGES("الصفحات", "صفحة", 10.0), JUZ("الأجزاء", "جزء", 1.0);

    fun tint(c: KhatmaStatsColors) = when (this) { AYAHS -> c.progress; PAGES -> c.info; JUZ -> c.insight }

    fun formatted(value: Double) = "${number(value)} $unit"
}

private enum class KhatmaChartRange(val days: Int, val title: String, val stride: Int) {
    D7(7, "٧ أيام", 1), D14(14, "١٤ يومًا", 2), D30(30, "٣٠ يومًا", 5)
}

private class KhatmaChartPoint(val date: LocalDate, val key: String, val ayahs: Int, val pages: Int, val seconds: Int) {
    val juz: Double
        get() = when {
            pages > 0 -> pages / (604.0 / 30.0)
            ayahs > 0 -> ayahs / (6236.0 / 30.0)
            else -> 0.0
        }

    fun value(metric: KhatmaChartMetric): Double = when (metric) {
        KhatmaChartMetric.AYAHS -> ayahs.toDouble()
        KhatmaChartMetric.PAGES -> pages.toDouble()
        KhatmaChartMetric.JUZ -> juz
    }
}

/** One point per calendar day of the range ending today, oldest first; days without a record are zero. */
private fun chartPoints(range: KhatmaChartRange, records: List<ReadingDayRecord>, today: LocalDate = LocalDate.now()): List<KhatmaChartPoint> {
    val byDay = records.associateBy { it.dateString }
    return (range.days - 1 downTo 0).map { ago ->
        val day = today.minusDays(ago.toLong())
        val key = day.toString()
        val record = byDay[key]
        KhatmaChartPoint(day, key, record?.ayahsRead ?: 0, record?.pagesRead ?: 0, record?.secondsRead ?: 0)
    }
}

private fun axisMaximum(points: List<KhatmaChartPoint>, metric: KhatmaChartMetric): Double {
    val peak = points.maxOfOrNull { it.value(metric) } ?: 0.0
    if (peak <= 0) return metric.emptyMaximum
    return when (metric) {
        KhatmaChartMetric.JUZ -> max(1.0, ceil(peak * 1.15 * 2) / 2)
        else -> max(5.0, ceil(peak * 1.15))
    }
}

private fun axisStep(maximum: Double): Double {
    val steps = doubleArrayOf(0.5, 1.0, 2.0, 2.5, 5.0, 10.0, 20.0, 25.0, 50.0, 100.0, 200.0, 500.0)
    return steps.firstOrNull { maximum / it <= 4.5 } ?: 1000.0
}

@Composable
private fun DailyChart(c: KhatmaStatsColors, days: List<ReadingDayRecord>) {
    val context = LocalContext.current
    val preferences = remember { context.getSharedPreferences("reading_chart", Context.MODE_PRIVATE) }
    var metric by remember { mutableStateOf(KhatmaChartMetric.entries.firstOrNull { it.name == preferences.getString("metric", null) } ?: KhatmaChartMetric.PAGES) }
    var range by remember { mutableStateOf(KhatmaChartRange.entries.firstOrNull { it.name == preferences.getString("range", null) } ?: KhatmaChartRange.D7) }
    var selected by remember { mutableStateOf<String?>(null) }

    val points = remember(range, days) { chartPoints(range, days) }
    val selectedPoint = points.firstOrNull { it.key == selected }
    val tint = metric.tint(c)
    val total = points.sumOf { it.value(metric) }
    val average = if (points.isEmpty()) 0.0 else total / points.size
    val peak = points.maxOfOrNull { it.value(metric) } ?: 0.0

    Column(Modifier.padding(horizontal = 16.dp).fillMaxWidth().card(c, 18).padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Filled.BarChart, null, tint = tint, modifier = Modifier.size(22.dp))
            Spacer(Modifier.width(8.dp))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                StatsText("معدل القراءة اليومي", 17f, c.label, weight = FontWeight.Bold)
                StatsText("ما قرأته كل يوم بالآيات أو الصفحات أو الأجزاء", 11f, c.secondary)
            }
            var menu by remember { mutableStateOf(false) }
            Box {
                Row(
                    Modifier.clip(CircleShape).background(c.cardInset).clickable { menu = true }.padding(horizontal = 10.dp, vertical = 5.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    StatsText(range.title, 12f, c.secondary, weight = FontWeight.SemiBold, maxLines = 1)
                    Icon(Icons.Filled.UnfoldMore, null, tint = c.secondary, modifier = Modifier.size(13.dp))
                }
                DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                    KhatmaChartRange.entries.forEach { option ->
                        DropdownMenuItem(
                            text = { Text((if (option == range) "✓  " else "     ") + option.title) },
                            onClick = {
                                range = option
                                selected = null
                                preferences.edit().putString("range", option.name).apply()
                                menu = false
                            },
                        )
                    }
                }
            }
        }

        Segmented(c, KhatmaChartMetric.entries.map { it.title }, metric.ordinal) {
            metric = KhatmaChartMetric.entries[it]
            preferences.edit().putString("metric", metric.name).apply()
        }

        Box(Modifier.fillMaxWidth().height(64.dp)) {
            if (selectedPoint != null) {
                Row(
                    Modifier.fillMaxSize().clip(RoundedCornerShape(12.dp)).background(tint.copy(alpha = 0.08f))
                        .border(1.dp, tint.copy(alpha = 0.28f), RoundedCornerShape(12.dp)).padding(10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        StatsText(fullDate(selectedPoint.date), 12f, c.secondary, weight = FontWeight.SemiBold, maxLines = 1)
                        StatsText(metric.formatted(selectedPoint.value(metric)), 20f, tint, weight = FontWeight.Bold, maxLines = 1)
                    }
                    if (selectedPoint.seconds > 0) {
                        Row(
                            Modifier.clip(RoundedCornerShape(8.dp)).background(c.info.copy(alpha = 0.12f)).padding(horizontal = 8.dp, vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                        ) {
                            Icon(Icons.Filled.Schedule, null, tint = c.info, modifier = Modifier.size(12.dp))
                            StatsText(duration(selectedPoint.seconds), 12f, c.info, weight = FontWeight.Bold, maxLines = 1)
                        }
                    }
                }
            } else {
                Row(
                    Modifier.fillMaxSize().clip(RoundedCornerShape(12.dp)).background(c.cardInset).padding(vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    SummaryColumn(c, "المعدل اليومي", metric.formatted(average), tint, Modifier.weight(1f))
                    Box(Modifier.width(0.5.dp).height(28.dp).background(c.separator))
                    SummaryColumn(c, "الإجمالي", metric.formatted(total), c.label, Modifier.weight(1f))
                    Box(Modifier.width(0.5.dp).height(28.dp).background(c.separator))
                    SummaryColumn(c, "أعلى يوم", metric.formatted(peak), c.secondary, Modifier.weight(1f))
                }
            }
        }

        BarChart(c, points, metric, range, selected, tint) { selected = if (it == selected) null else it }

        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Filled.TouchApp, null, tint = c.secondary, modifier = Modifier.size(13.dp))
            Spacer(Modifier.width(6.dp))
            StatsText(
                if (selectedPoint != null) "المس العمود مرة أخرى لإلغاء التحديد" else "المس أي عمود لعرض تفاصيل ذلك اليوم",
                11f,
                c.secondary,
                Modifier.weight(1f),
            )
            if (selectedPoint != null) {
                Text("إلغاء التحديد", color = tint, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.clickable { selected = null })
            }
        }
    }
}

@Composable
private fun SummaryColumn(c: KhatmaStatsColors, title: String, value: String, color: Color, modifier: Modifier) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        StatsText(title, 11f, c.secondary, maxLines = 1)
        StatsText(value, 15f, color, weight = FontWeight.Bold, maxLines = 1)
    }
}

@Composable
private fun Segmented(c: KhatmaStatsColors, options: List<String>, selected: Int, onSelect: (Int) -> Unit) {
    Row(Modifier.fillMaxWidth().height(32.dp).clip(RoundedCornerShape(9.dp)).background(c.fill).padding(2.dp)) {
        options.forEachIndexed { index, title ->
            val on = index == selected
            Box(
                Modifier.weight(1f).fillMaxHeight().then(
                    if (on) Modifier.shadow(1.dp, RoundedCornerShape(7.dp)).clip(RoundedCornerShape(7.dp)).background(c.segmentSelected)
                    else Modifier.clip(RoundedCornerShape(7.dp)),
                ).clickable { onSelect(index) },
                contentAlignment = Alignment.Center,
            ) {
                StatsText(title, 13f, c.label, weight = if (on) FontWeight.SemiBold else FontWeight.Normal, maxLines = 1, align = TextAlign.Center)
            }
        }
    }
}

@Composable
private fun BarChart(
    c: KhatmaStatsColors,
    points: List<KhatmaChartPoint>,
    metric: KhatmaChartMetric,
    range: KhatmaChartRange,
    selected: String?,
    tint: Color,
    onTap: (String) -> Unit,
) {
    val density = LocalDensity.current
    val maximum = axisMaximum(points, metric)
    val step = axisStep(maximum)
    val labelPaint = remember(c.dark, density.density) {
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = c.secondary.toArgb()
            textSize = 11f * density.density
        }
    }
    val leftPad = with(density) { 34.dp.toPx() }
    Canvas(
        Modifier.fillMaxWidth().height(190.dp).pointerInput(points, selected) {
            detectTapGestures { offset ->
                val slot = (size.width - leftPad) / points.size
                val index = floor((offset.x - leftPad) / slot).toInt()
                if (index in points.indices) onTap(points[index].key)
            }
        },
    ) {
        val top = 6.dp.toPx()
        val bottom = size.height - 22.dp.toPx()
        val plotHeight = bottom - top
        val slot = (size.width - leftPad) / points.size
        val native = drawContext.canvas.nativeCanvas

        // Dashed grid lines and the value axis.
        var tick = 0.0
        while (tick <= maximum + 1e-9) {
            val y = bottom - (tick / maximum * plotHeight).toFloat()
            drawLine(
                color = c.secondary.copy(alpha = 0.2f),
                start = Offset(leftPad, y),
                end = Offset(size.width, y),
                strokeWidth = 0.5.dp.toPx(),
                pathEffect = PathEffect.dashPathEffect(floatArrayOf(2.dp.toPx(), 3.dp.toPx())),
            )
            labelPaint.textAlign = Paint.Align.RIGHT
            native.drawText(number(tick), leftPad - 6.dp.toPx(), y + 4.dp.toPx(), labelPaint)
            tick += step
        }

        // Bars: the picked day stays solid, the others fade.
        val barWidth = slot * if (range == KhatmaChartRange.D30) 0.62f else 0.66f
        val radius = if (range == KhatmaChartRange.D30) 2.5.dp.toPx() else 5.dp.toPx()
        points.forEachIndexed { index, point ->
            val value = point.value(metric)
            if (value > 0) {
                val h = (value / maximum * plotHeight).toFloat()
                val x = leftPad + slot * index + (slot - barWidth) / 2
                val alpha = if (selected == null || selected == point.key) 1f else 0.35f
                drawRoundRect(
                    brush = Brush.verticalGradient(listOf(tint.copy(alpha = alpha), tint.copy(alpha = alpha * 0.78f)), startY = bottom - h, endY = bottom),
                    topLeft = Offset(x, bottom - h),
                    size = Size(barWidth, h),
                    cornerRadius = CornerRadius(radius, radius),
                )
            }
        }

        // Day labels.
        labelPaint.textAlign = Paint.Align.CENTER
        points.forEachIndexed { index, point ->
            if (index % range.stride == 0) {
                val text = if (range == KhatmaChartRange.D7) shortWeekday(point.date.dayOfWeek) else point.date.dayOfMonth.toString()
                native.drawText(text, leftPad + slot * index + slot / 2, size.height - 4.dp.toPx(), labelPaint)
            }
        }
    }
}

// MARK: - History

@Composable
private fun DailyHistory(c: KhatmaStatsColors, days: List<ReadingDayRecord>) {
    Column(Modifier.padding(horizontal = 16.dp).fillMaxWidth().card(c, 18).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Filled.CalendarMonth, null, tint = c.info, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(8.dp))
            StatsText("سجل القراءة اليومي", 17f, c.label, Modifier.weight(1f), FontWeight.Bold)
            StatsText("${days.size} يوم", 12f, c.secondary, weight = FontWeight.Bold)
        }
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            days.take(7).forEach { day ->
                Row(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(c.cardInset).padding(vertical = 8.dp, horizontal = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    StatsText(
                        runCatching { fullDate(LocalDate.parse(day.dateString)) }.getOrDefault(day.dateString),
                        15f, c.label, Modifier.weight(1f), FontWeight.Medium, 1,
                    )
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Icon(Icons.Filled.Schedule, null, tint = c.info, modifier = Modifier.size(12.dp))
                        StatsText(duration(day.secondsRead), 15f, c.info, weight = FontWeight.Bold, maxLines = 1)
                    }
                    StatsText("• ${indic(day.pagesRead)} ص • ${indic(day.ayahsRead)} آية", 12f, c.secondary, maxLines = 1)
                }
            }
        }
    }
}

// MARK: - Surah section

@Composable
private fun SurahSection(
    c: KhatmaStatsColors,
    completedCount: Int,
    all: List<SurahProgress>,
    search: String,
    onSearch: (String) -> Unit,
    filter: SurahProgressFilter,
    onFilter: (SurahProgressFilter) -> Unit,
) {
    Column(Modifier.padding(top = 4.dp, bottom = 14.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Row(Modifier.padding(horizontal = 16.dp).fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                StatsText("الختم على حسب السورة", 20f, c.label, weight = FontWeight.Bold)
                StatsText("متابعة إنجاز كل سورة والمتبقي منها", 12f, c.secondary)
            }
            StatsText("$completedCount / 114", 15f, c.progress, weight = FontWeight.Bold)
        }

        Row(
            Modifier.padding(horizontal = 16.dp).fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(c.card).padding(10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Icon(Icons.Filled.Search, null, tint = c.secondary, modifier = Modifier.size(20.dp))
            Box(Modifier.weight(1f)) {
                if (search.isEmpty()) StatsText("تصفية حسب الاسم أو الرقم...", 17f, c.tertiary, maxLines = 1)
                BasicTextField(
                    value = search,
                    onValueChange = onSearch,
                    singleLine = true,
                    textStyle = TextStyle(color = c.label, fontSize = 17.sp),
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            if (search.isNotEmpty()) {
                Icon(Icons.Filled.Cancel, "مسح التصفية", tint = c.secondary, modifier = Modifier.size(20.dp).clickable { onSearch("") })
            }
        }

        Row(Modifier.padding(horizontal = 16.dp).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            SurahProgressFilter.entries.forEach { option ->
                val count = when (option) {
                    SurahProgressFilter.ALL -> all.size
                    SurahProgressFilter.REMAINING -> all.count { !it.isCompleted }
                    SurahProgressFilter.COMPLETED -> all.count { it.isCompleted }
                    SurahProgressFilter.STARTED -> all.count { it.isStarted }
                }
                val on = option == filter
                Row(
                    Modifier.weight(1f).clip(CircleShape).background(if (on) c.progressFill else c.card).clickable { onFilter(option) }
                        .padding(horizontal = 6.dp, vertical = 7.dp),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    StatsText(option.title, 12f, if (on) Color.White else c.label, weight = FontWeight.Bold, maxLines = 1)
                    Spacer(Modifier.width(3.dp))
                    StatsText("(${indic(count)})", 11f, if (on) Color.White else c.label, weight = FontWeight.Bold, maxLines = 1)
                }
            }
        }

        Row(Modifier.padding(horizontal = 16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Icon(Icons.Filled.PanTool, null, tint = c.secondary, modifier = Modifier.size(12.dp))
            StatsText("اسحب أي سورة لليمين لإكمالها أو إلغائها في الختمة", 11f, c.secondary)
        }
    }
}

@Composable
private fun EmptySurahs(c: KhatmaStatsColors) {
    Column(Modifier.fillMaxWidth().padding(vertical = 32.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Icon(Icons.Filled.Inbox, null, tint = c.secondary, modifier = Modifier.size(32.dp))
        StatsText("لا توجد سور مطابقة للتصفية", 15f, c.secondary, align = TextAlign.Center)
    }
}

@Composable
private fun SwipeSurahRow(c: KhatmaStatsColors, progress: SurahProgress, onSelect: () -> Unit, onToggle: () -> Unit) {
    val density = LocalDensity.current
    val haptic = LocalHapticFeedback.current
    val threshold = with(density) { 75.dp.toPx() }
    val limit = with(density) { 130.dp.toPx() }
    var drag by remember { mutableFloatStateOf(0f) }
    var passed by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(14.dp)
    val label = if (progress.isCompleted) "إلغاء الإكمال" else "إكمال في الختمة"
    val icon = if (progress.isCompleted) Icons.Filled.Replay else Icons.Filled.CheckCircle

    Box(Modifier.fillMaxWidth().clip(shape)) {
        Box(Modifier.matchParentSize().background(if (progress.isCompleted) c.cautionFill else c.progressFill)) {
            if (drag != 0f) {
                Row(
                    Modifier.align(if (drag > 0) Alignment.CenterStart else Alignment.CenterEnd).padding(horizontal = 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    if (drag > 0) {
                        Icon(icon, null, tint = Color.White, modifier = Modifier.size(20.dp))
                        StatsText(label, 13f, Color.White, weight = FontWeight.Bold, maxLines = 1)
                    } else {
                        StatsText(label, 13f, Color.White, weight = FontWeight.Bold, maxLines = 1)
                        Icon(icon, null, tint = Color.White, modifier = Modifier.size(20.dp))
                    }
                }
            }
        }
        Box(
            Modifier.offset { IntOffset(drag.roundToInt(), 0) }
                .pointerInput(progress.surahNumber, progress.isCompleted) {
                    detectHorizontalDragGestures(
                        onDragStart = { passed = false },
                        onDragEnd = {
                            val triggered = abs(drag) >= threshold
                            drag = 0f
                            passed = false
                            if (triggered) onToggle()
                        },
                        onDragCancel = {
                            drag = 0f
                            passed = false
                        },
                    ) { change, delta ->
                        change.consume()
                        drag = (drag + delta).coerceIn(-limit, limit)
                        val over = abs(drag) >= threshold
                        if (over && !passed) haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                        passed = over
                    }
                }
                .clickable { if (drag == 0f) onSelect() else drag = 0f },
        ) {
            SurahRowContent(c, progress)
        }
    }
}

@Composable
private fun SurahRowContent(c: KhatmaStatsColors, progress: SurahProgress) {
    val tier = KhatmaTier.of(progress.percentage)
    val tierColor = tier.color(c)
    val shape = RoundedCornerShape(14.dp)
    val stroke = when {
        progress.isCompleted -> tierColor.copy(alpha = 0.32f)
        progress.isStarted -> tierColor.copy(alpha = 0.14f)
        else -> Color.Transparent
    }
    Row(
        Modifier.fillMaxWidth().background(c.card).border(1.dp, stroke, shape).padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            Modifier.size(28.dp).clip(CircleShape).background(if (progress.isCompleted) tierColor.copy(alpha = 0.18f) else c.fill),
            contentAlignment = Alignment.Center,
        ) {
            StatsText(
                progress.surahNumber.toString(), 12f, if (progress.isCompleted) tierColor else c.secondary,
                weight = if (progress.isCompleted) FontWeight.Bold else FontWeight.Medium, maxLines = 1, align = TextAlign.Center,
            )
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                StatsText(progress.surahName, 16f, c.label, Modifier.weight(1f), FontWeight.SemiBold, 1)
                StatsText("${progress.readAyahsCount}/${progress.totalAyahsCount}", 12f, c.secondary, maxLines = 1)
                StatsText("${progress.percentage.toInt()}%", 12f, if (progress.readAyahsCount > 0) tierColor else c.secondary, weight = FontWeight.Bold, maxLines = 1)
            }
            StatsProgress(c, progress.percentage / 100.0, tierColor, 2.5.dp)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                when {
                    progress.isCompleted -> {
                        Icon(Icons.Filled.CheckCircle, null, tint = c.progress, modifier = Modifier.size(11.dp))
                        StatsText("مكتملة • لم يبقَ شيء", 11f, c.progress, weight = FontWeight.Medium)
                    }
                    progress.isStarted -> {
                        Box(Modifier.size(6.dp).clip(CircleShape).background(tierColor))
                        StatsText("المتبقي: ${progress.remainingAyahsCount} آية", 11f, c.secondary)
                    }
                    else -> StatsText("المتبقي: ${progress.remainingAyahsCount} آية", 11f, c.secondary)
                }
            }
        }
        Icon(Icons.Filled.ChevronRight, null, tint = c.tertiary, modifier = Modifier.size(16.dp))
    }
}
