package com.shazlka.qiraat.reading

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.shazlka.qiraat.core.Surah
import java.time.Instant

@Composable
fun ReadingStatisticsScreen(
    tracker: ReadingTracker,
    surahs: List<Surah>,
    surahAyahCounts: Map<Int, Int>,
    currentPage: Int,
    onNavigateToPage: (Int) -> Unit,
    onBack: () -> Unit,
) {
    var selectedFilter by remember { mutableStateOf(SurahProgressFilter.ALL) }
    var searchQuery by remember { mutableStateOf("") }
    var showAddSessionDialog by remember { mutableStateOf(false) }

    val overview = remember(tracker.totalAyahsRead, tracker.activeKhatma.id) {
        tracker.readingStatsOverview()
    }
    val weeklyDays = remember(tracker.totalAyahsRead) {
        tracker.currentWeekReadingDays()
    }
    val recentDays = remember(tracker.totalAyahsRead) {
        tracker.db.allReadingDays()
    }
    val surahsProgress = remember(tracker.totalAyahsRead, tracker.activeKhatma.id) {
        tracker.surahProgressList(surahs)
    }

    val filteredSurahs = remember(surahsProgress, selectedFilter, searchQuery) {
        surahsProgress.filter { item ->
            val matchesSearch = if (searchQuery.isBlank()) true else {
                item.surahName.contains(searchQuery.trim()) || item.surahNumber.toString() == searchQuery.trim()
            }
            if (!matchesSearch) return@filter false
            when (selectedFilter) {
                SurahProgressFilter.ALL -> true
                SurahProgressFilter.REMAINING -> !item.isCompleted
                SurahProgressFilter.COMPLETED -> item.isCompleted
                SurahProgressFilter.STARTED -> item.isStarted
            }
        }
    }

    Scaffold(
        topBar = {
            Row(
                Modifier.fillMaxWidth().height(56.dp).padding(horizontal = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                TextButton(onClick = onBack) { Text("رجوع") }
                Text(
                    "إحصائيات القراءة والختمة",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.weight(1f),
                    textAlign = TextAlign.Center,
                )
                TextButton(onClick = { showAddSessionDialog = true }) { Text("+ تسجيل جلسة") }
            }
        },
    ) { padding ->
        LazyColumn(
            Modifier.fillMaxSize().padding(padding).padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            contentPadding = PaddingValues(vertical = 12.dp),
        ) {
            // 1. Khatma Summary Card
            item { KhatmaSummaryCard(overview, surahsProgress.count { it.isCompleted }) }

            // 2. Continue Reading Banner
            item {
                ContinueReadingBanner(currentPage) {
                    onNavigateToPage(currentPage)
                    onBack()
                }
            }

            // 3. Weekly Streak Tracker
            item {
                WeeklyStreakTrackerCard(
                    currentStreak = tracker.currentStreak,
                    longestStreak = tracker.longestStreak,
                    days = weeklyDays,
                    onAddSession = { showAddSessionDialog = true },
                )
            }

            // 4. Daily Reading Progress Chart
            item { DailyReadingProgressChartCard(recentDays) }

            // 5. Khatma by Surah Section Header & Filters
            item {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Column {
                            Text("الختم على حسب السورة", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                            Text("متابعة إنجاز كل سورة والمتبقي منها", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Text(
                            "${surahsProgress.count { it.isCompleted }} / 114",
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF2E7D32),
                        )
                    }

                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = { searchQuery = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("تصفية حسب الاسم أو الرقم…") },
                        singleLine = true,
                    )

                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        SurahProgressFilter.entries.forEach { filter ->
                            FilterChip(
                                selected = selectedFilter == filter,
                                onClick = { selectedFilter = filter },
                                label = { Text(filter.title) },
                            )
                        }
                    }
                }
            }

            // 6. Surahs Progress List
            items(filteredSurahs, key = { it.surahNumber }) { progress ->
                SurahProgressRow(
                    progress = progress,
                    onToggleComplete = { completed ->
                        tracker.markSurahCompleted(
                            surahNumber = progress.surahNumber,
                            completed = completed,
                            surahAyahCounts = surahAyahCounts,
                            pageResolver = { s, _ -> surahs.firstOrNull { it.number == s }?.firstPage ?: 1 },
                        )
                    },
                    onClick = {
                        onNavigateToPage(progress.firstPage)
                        onBack()
                    },
                )
            }
        }
    }

    if (showAddSessionDialog) {
        AddReadingSessionDialog(
            surahs = surahs,
            surahAyahCounts = surahAyahCounts,
            onDismiss = { showAddSessionDialog = false },
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
                showAddSessionDialog = false
            },
            onSavePageSession = { fromPage, toPage, duration ->
                tracker.recordManualPageRangeSession(
                    fromPage = fromPage,
                    toPage = toPage,
                    sessionDate = Instant.now(),
                    durationMinutes = duration,
                    pageAyahsResolver = { emptyList() },
                )
                showAddSessionDialog = false
            },
        )
    }
}

@Composable
fun KhatmaSummaryCard(overview: ReadingStatsOverview, completedSurahs: Int) {
    ElevatedCard(Modifier.fillMaxWidth(), colors = CardDefaults.elevatedCardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column {
                    Text("الختمة رقم ${ArabicDigits.formatWhole(overview.currentKhatma.khatmaNumber.toLong())}", fontWeight = FontWeight.Bold, fontSize = 20.sp)
                    Text("${ArabicDigits.formatWhole(overview.currentKhatma.durationInDays.toLong())} يوم منذ البدء", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Text("${ArabicDigits.format(overview.currentKhatma.percentComplete)}%", fontWeight = FontWeight.ExtraBold, fontSize = 24.sp, color = Color(0xFF2E7D32))
            }

            LinearProgressIndicator(
                progress = { (overview.totalAyahsReadInCurrentKhatma.toFloat() / overview.totalQuranAyahs.coerceAtLeast(1).toFloat()).coerceIn(0f, 1f) },
                modifier = Modifier.fillMaxWidth().height(10.dp),
                color = Color(0xFF2E7D32),
                trackColor = MaterialTheme.colorScheme.surfaceVariant,
            )

            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                StatPill("الآيات المقروءة", "${ArabicDigits.formatWhole(overview.totalAyahsReadInCurrentKhatma.toLong())} / ${ArabicDigits.formatWhole(overview.totalQuranAyahs.toLong())}")
                StatPill("السور المكتملة", "${ArabicDigits.formatWhole(completedSurahs.toLong())} / ١١٤")
                StatPill("الختمات السابقة", ArabicDigits.formatWhole(overview.completedKhatmasCount.toLong()))
            }
        }
    }
}

@Composable
private fun StatPill(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, fontWeight = FontWeight.Bold, fontSize = 14.sp)
        Text(label, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
fun ContinueReadingBanner(page: Int, onClick: () -> Unit) {
    OutlinedCard(Modifier.fillMaxWidth().clickable(onClick = onClick)) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
            Column {
                Text("متابعة القراءة", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                Text("الصفحة ${ArabicDigits.formatWhole(page.toLong())}", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Text("فتح المصحف ←", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
        }
    }
}

@Composable
fun WeeklyStreakTrackerCard(
    currentStreak: Int,
    longestStreak: Int,
    days: List<WeeklyDayStatus>,
    onAddSession: () -> Unit,
) {
    ElevatedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column {
                    Text("سلسلة القراءة اليومية", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    Text("أطول سلسلة: ${ArabicDigits.formatWhole(longestStreak.toLong())} يوم", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("🔥", fontSize = 20.sp)
                    Text("${ArabicDigits.formatWhole(currentStreak.toLong())} يوم", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = Color(0xFFE65100))
                }
            }

            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                days.forEach { day ->
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(day.dayNameAr.take(3), fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Box(
                            Modifier.size(34.dp).background(
                                color = if (day.isRead) Color(0xFF2E7D32) else if (day.isToday) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant,
                                shape = CircleShape,
                            ),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                day.dayNumber,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (day.isRead) Color.White else MaterialTheme.colorScheme.onSurface,
                            )
                        }
                        Text(day.formattedDuration, fontSize = 9.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
    }
}

@Composable
fun DailyReadingProgressChartCard(days: List<ReadingDayRecord>) {
    var selectedMetric by remember { mutableStateOf(ReadingChartMetric.AYAHS) }
    var selectedRange by remember { mutableStateOf(ReadingChartRange.DAYS_7) }

    val points = remember(days, selectedRange) {
        DailyReadingChartPoint.points(selectedRange, days)
    }

    ElevatedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("مخطط القراءة اليومي", fontWeight = FontWeight.Bold, fontSize = 16.sp)

                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    ReadingChartRange.entries.forEach { r ->
                        val selected = selectedRange == r
                        Text(
                            r.titleAr,
                            fontSize = 11.sp,
                            fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                            color = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.clickable { selectedRange = r }.padding(4.dp),
                        )
                    }
                }
            }

            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ReadingChartMetric.entries.forEach { m ->
                    FilterChip(
                        selected = selectedMetric == m,
                        onClick = { selectedMetric = m },
                        label = { Text(m.titleAr, fontSize = 12.sp) },
                    )
                }
            }

            val maxValue = points.maxOfOrNull { it.value(selectedMetric) }?.coerceAtLeast(selectedMetric.emptyAxisMaximum) ?: selectedMetric.emptyAxisMaximum

            // Simple custom bar chart
            Box(Modifier.fillMaxWidth().height(140.dp)) {
                Canvas(Modifier.fillMaxSize()) {
                    val barWidth = size.width / (points.size * 1.5f)
                    val spacing = barWidth * 0.5f
                    val heightRatio = if (maxValue > 0) (size.height - 20.dp.toPx()) / maxValue.toFloat() else 0f

                    points.forEachIndexed { i, pt ->
                        val value = pt.value(selectedMetric).toFloat()
                        val barHeight = (value * heightRatio).coerceAtLeast(2.dp.toPx())
                        val x = i * (barWidth + spacing) + spacing / 2
                        val y = size.height - 20.dp.toPx() - barHeight

                        drawRoundRect(
                            color = if (value > 0) Color(0xFF2E7D32) else Color(0xFFCCCCCC),
                            topLeft = Offset(x, y),
                            size = Size(barWidth, barHeight),
                            cornerRadius = CornerRadius(4.dp.toPx(), 4.dp.toPx()),
                        )
                    }
                }
            }

            // Summary text
            val total = points.sumOf { it.value(selectedMetric) }
            val avg = if (points.isNotEmpty()) total / points.size else 0.0
            Text(
                "المجموع: ${selectedMetric.formatted(total)} · المعدل: ${selectedMetric.formatted(avg)} / يوم",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
fun SurahProgressRow(
    progress: SurahProgress,
    onToggleComplete: (Boolean) -> Unit,
    onClick: () -> Unit,
) {
    ElevatedCard(Modifier.fillMaxWidth().clickable(onClick = onClick)) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(
                Modifier.size(36.dp).background(
                    if (progress.isCompleted) Color(0xFF2E7D32) else MaterialTheme.colorScheme.primaryContainer,
                    CircleShape,
                ),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    ArabicDigits.formatWhole(progress.surahNumber.toLong()),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (progress.isCompleted) Color.White else MaterialTheme.colorScheme.onPrimaryContainer,
                )
            }

            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(progress.surahName, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                    Text(
                        "${ArabicDigits.formatWhole(progress.readAyahsCount.toLong())} / ${ArabicDigits.formatWhole(progress.totalAyahsCount.toLong())}",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }

                LinearProgressIndicator(
                    progress = { (progress.percentage / 100.0).toFloat().coerceIn(0f, 1f) },
                    modifier = Modifier.fillMaxWidth().height(6.dp),
                    color = Color(0xFF2E7D32),
                    trackColor = MaterialTheme.colorScheme.surfaceVariant,
                )
            }

            IconButton(onClick = { onToggleComplete(!progress.isCompleted) }) {
                Text(if (progress.isCompleted) "✓" else "○", fontSize = 20.sp, color = if (progress.isCompleted) Color(0xFF2E7D32) else MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
fun BookmarksScreen(
    tracker: ReadingTracker,
    surahNames: Map<Int, String>,
    onSelectBookmark: (QuranBookmark) -> Unit,
    onBack: () -> Unit,
) {
    var selectedFilter by remember { mutableStateOf<BookmarkType?>(null) }
    var searchQuery by remember { mutableStateOf("") }
    var bookmarks by remember(tracker.bookmarksVersion, selectedFilter, searchQuery) {
        mutableStateOf(tracker.allBookmarks(selectedFilter, searchQuery))
    }

    Scaffold(
        topBar = {
            Row(
                Modifier.fillMaxWidth().height(56.dp).padding(horizontal = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                TextButton(onClick = onBack) { Text("رجوع") }
                Text(
                    "الفواصل المحفوظة",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.weight(1f),
                    textAlign = TextAlign.Center,
                )
                Spacer(Modifier.width(48.dp))
            }
        },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = selectedFilter == null,
                    onClick = { selectedFilter = null },
                    label = { Text("الكل") },
                )
                FilterChip(
                    selected = selectedFilter == BookmarkType.AYAH,
                    onClick = { selectedFilter = BookmarkType.AYAH },
                    label = { Text("الآيات") },
                )
                FilterChip(
                    selected = selectedFilter == BookmarkType.PAGE,
                    onClick = { selectedFilter = BookmarkType.PAGE },
                    label = { Text("الصفحات") },
                )
            }

            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text("بحث في الفواصل...") },
                singleLine = true,
            )

            if (bookmarks.isEmpty()) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("لا توجد فواصل محفوظة", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            } else {
                LazyColumn(
                    Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    contentPadding = PaddingValues(vertical = 8.dp),
                ) {
                    items(bookmarks, key = { it.id }) { bm ->
                        ElevatedCard(Modifier.fillMaxWidth().clickable { onSelectBookmark(bm) }) {
                            Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                                        Surface(
                                            color = if (bm.type == BookmarkType.PAGE) MaterialTheme.colorScheme.secondaryContainer else MaterialTheme.colorScheme.tertiaryContainer,
                                            shape = RoundedCornerShape(4.dp),
                                        ) {
                                            Text(bm.type.title, fontSize = 11.sp, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
                                        }
                                        val sName = surahNames[bm.surah] ?: "سورة ${bm.surah}"
                                        Text("$sName · آية ${bm.ayah}", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                                    }
                                    Text("صفحة ${bm.page}", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    bm.note?.let { Text(it, fontSize = 13.sp, color = MaterialTheme.colorScheme.primary) }
                                }
                                IconButton(onClick = { tracker.removeBookmark(bm.id) }) {
                                    Text("✕", color = MaterialTheme.colorScheme.error)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun AddReadingSessionDialog(
    surahs: List<Surah>,
    surahAyahCounts: Map<Int, Int>,
    onDismiss: () -> Unit,
    onSaveSession: (Int, Int, Int, Int, Int) -> Unit,
    onSavePageSession: (Int, Int, Int) -> Unit,
) {
    var modeBySurah by remember { mutableStateOf(true) }
    var startSurah by remember { mutableIntStateOf(1) }
    var startAyah by remember { mutableIntStateOf(1) }
    var endSurah by remember { mutableIntStateOf(1) }
    var endAyah by remember { mutableIntStateOf(7) }
    var startPage by remember { mutableIntStateOf(1) }
    var endPage by remember { mutableIntStateOf(1) }
    var durationMinutes by remember { mutableIntStateOf(15) }

    Dialog(onDismissRequest = onDismiss) {
        Surface(shape = RoundedCornerShape(16.dp), tonalElevation = 6.dp) {
            Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Text("تسجيل جلسة قراءة", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)

                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                    FilterChip(selected = modeBySurah, onClick = { modeBySurah = true }, label = { Text("حسب السورة") })
                    FilterChip(selected = !modeBySurah, onClick = { modeBySurah = false }, label = { Text("حسب الصفحة") })
                }

                if (modeBySurah) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = startSurah.toString(),
                            onValueChange = { startSurah = it.toIntOrNull() ?: 1 },
                            label = { Text("من سورة") },
                            modifier = Modifier.weight(1f),
                        )
                        OutlinedTextField(
                            value = startAyah.toString(),
                            onValueChange = { startAyah = it.toIntOrNull() ?: 1 },
                            label = { Text("من آية") },
                            modifier = Modifier.weight(1f),
                        )
                    }
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = endSurah.toString(),
                            onValueChange = { endSurah = it.toIntOrNull() ?: 1 },
                            label = { Text("إلى سورة") },
                            modifier = Modifier.weight(1f),
                        )
                        OutlinedTextField(
                            value = endAyah.toString(),
                            onValueChange = { endAyah = it.toIntOrNull() ?: 1 },
                            label = { Text("إلى آية") },
                            modifier = Modifier.weight(1f),
                        )
                    }
                } else {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = startPage.toString(),
                            onValueChange = { startPage = it.toIntOrNull() ?: 1 },
                            label = { Text("من صفحة") },
                            modifier = Modifier.weight(1f),
                        )
                        OutlinedTextField(
                            value = endPage.toString(),
                            onValueChange = { endPage = it.toIntOrNull() ?: 1 },
                            label = { Text("إلى صفحة") },
                            modifier = Modifier.weight(1f),
                        )
                    }
                }

                OutlinedTextField(
                    value = durationMinutes.toString(),
                    onValueChange = { durationMinutes = it.toIntOrNull() ?: 15 },
                    label = { Text("المدة بالدقائق") },
                    modifier = Modifier.fillMaxWidth(),
                )

                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    TextButton(onClick = onDismiss) { Text("إلغاء") }
                    Button(onClick = {
                        if (modeBySurah) {
                            onSaveSession(startSurah, startAyah, endSurah, endAyah, durationMinutes)
                        } else {
                            onSavePageSession(startPage, endPage, durationMinutes)
                        }
                    }) { Text("حفظ الجلسة") }
                }
            }
        }
    }
}

@Composable
fun KhatmaCelebrationDialog(
    record: KhatmaRecord,
    onStartNewKhatma: () -> Unit,
    onViewStatistics: () -> Unit,
) {
    Dialog(onDismissRequest = onStartNewKhatma) {
        Surface(shape = RoundedCornerShape(20.dp), tonalElevation = 8.dp) {
            Column(
                Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Text("🎉", fontSize = 48.sp)
                Text(
                    "مبارك إتمام الختمة!",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFFD4AF37),
                    textAlign = TextAlign.Center,
                )
                Text(
                    "أتممت الختمة رقم ${ArabicDigits.formatWhole(record.khatmaNumber.toLong())} في ${ArabicDigits.formatWhole(record.durationInDays.toLong())} يومًا.\nتقبل الله طاعتكم وبارك في قرآنكم.",
                    textAlign = TextAlign.Center,
                    fontSize = 15.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )

                Button(
                    onClick = onStartNewKhatma,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2E7D32)),
                ) {
                    Text("بدء ختمة جديدة")
                }

                OutlinedButton(
                    onClick = onViewStatistics,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("عرض الإحصائيات")
                }
            }
        }
    }
}
