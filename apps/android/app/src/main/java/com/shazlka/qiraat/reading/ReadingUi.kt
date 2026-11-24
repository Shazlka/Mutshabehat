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

/** The khatma statistics screen; the layout lives in `KhatmaStatsUi.kt` and matches the iOS screen. */
@Composable
fun ReadingStatisticsScreen(
    tracker: ReadingTracker,
    surahs: List<Surah>,
    surahAyahCounts: Map<Int, Int>,
    currentPage: Int,
    onNavigateToPage: (Int) -> Unit,
    onBack: () -> Unit,
) {
    KhatmaStatsScreen(tracker, surahs, surahAyahCounts, currentPage, onNavigateToPage, onBack)
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
