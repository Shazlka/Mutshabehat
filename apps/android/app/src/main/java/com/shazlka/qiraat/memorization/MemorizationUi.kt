package com.shazlka.qiraat.memorization

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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.shazlka.qiraat.core.AyahKey
import com.shazlka.qiraat.core.Surah
import com.shazlka.qiraat.reading.ArabicDigits
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.UUID

@Composable
fun MemorizationDashboardScreen(
    store: MemorizationStore,
    surahs: List<Surah>,
    onOpenInMushaf: (Int) -> Unit,
    onOpenBackup: () -> Unit,
) {
    var showUpdateSheet by remember { mutableStateOf(false) }
    var showHistory by remember { mutableStateOf(false) }
    var selectedTab by remember { mutableIntStateOf(0) } // 0 = Surahs, 1 = Juz
    var milestoneMessage by remember { mutableStateOf<String?>(null) }

    val snapshot = store.snapshot
    val streak = store.streak
    val suggestion = store.suggestion

    if (showHistory) {
        MemorizationHistoryScreen(
            store = store,
            onBack = { showHistory = false },
        )
        return
    }

    Scaffold(
        topBar = {
            Row(
                Modifier.fillMaxWidth().height(56.dp).padding(horizontal = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    "حفظ القرآن الكريم",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    TextButton(onClick = { showHistory = true }) { Text("السجل") }
                    TextButton(onClick = onOpenBackup) { Text("النسخ") }
                }
            }
        },
        bottomBar = {
            Surface(tonalElevation = 6.dp) {
                Row(
                    Modifier.fillMaxWidth().padding(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Button(
                        onClick = { showUpdateSheet = true },
                        modifier = Modifier.fillMaxWidth().height(48.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2E7D32)),
                    ) {
                        Text("تحديث الحفظ", fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        },
    ) { padding ->
        LazyColumn(
            Modifier.fillMaxSize().padding(padding).padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
            contentPadding = PaddingValues(vertical = 12.dp),
        ) {
            // 1. Overall Progress Card
            item {
                MemorizationOverviewCard(snapshot)
            }

            // 2. Streak & Suggestion
            item {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    StreakCard(streak, Modifier.weight(1f))
                    SuggestionCard(suggestion, surahs, Modifier.weight(1f)) { surahNum ->
                        store.index.pagesOfSurah(surahNum)?.first?.let { onOpenInMushaf(it) }
                    }
                }
            }

            // 3. Tab Switcher: السور / الأجزاء
            item {
                TabRow(selectedTabIndex = selectedTab) {
                    Tab(selected = selectedTab == 0, onClick = { selectedTab = 0 }, text = { Text("السور (١١٤)") })
                    Tab(selected = selectedTab == 1, onClick = { selectedTab = 1 }, text = { Text("الأجزاء (٣٠)") })
                }
            }

            // 4. Breakdown Items
            if (selectedTab == 0) {
                items(snapshot.surahs, key = { it.surah }) { surahProg ->
                    val surahObj = surahs.firstOrNull { it.number == surahProg.surah }
                    SurahMemorizationRow(
                        surahProgress = surahProg,
                        surahName = surahObj?.name ?: "سورة ${surahProg.surah}",
                        onClick = {
                            surahObj?.firstPage?.let { onOpenInMushaf(it) }
                        },
                    )
                }
            } else {
                items(snapshot.juz, key = { it.juz }) { juzProg ->
                    JuzMemorizationRow(
                        juzProgress = juzProg,
                        onClick = {
                            store.index.pagesOfJuz(juzProg.juz)?.first?.let { onOpenInMushaf(it) }
                        },
                    )
                }
            }
        }
    }

    if (showUpdateSheet) {
        MemorizationUpdateSheet(
            store = store,
            surahs = surahs,
            onDismiss = { showUpdateSheet = false },
            onApplied = { result ->
                showUpdateSheet = false
                if (result.milestones.isNotEmpty()) {
                    milestoneMessage = "تهانينا! حققت إنجازًا جديدًا في الحفظ 🎉"
                }
            },
        )
    }

    milestoneMessage?.let { msg ->
        AlertDialog(
            onDismissRequest = { milestoneMessage = null },
            title = { Text("إنجاز جديد! 🎉") },
            text = { Text(msg) },
            confirmButton = {
                TextButton(onClick = { milestoneMessage = null }) { Text("تم") }
            },
        )
    }
}

@Composable
fun MemorizationOverviewCard(snapshot: MemorizationSnapshot) {
    ElevatedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column {
                    Text("إجمالي الإتقان", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    Text(
                        "${ArabicDigits.formatWhole((snapshot.counts[MemorizationStatus.MASTERED] ?: 0).toLong())} من ${ArabicDigits.formatWhole(snapshot.totalAyahs.toLong())} آية",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Text(
                    "${ArabicDigits.format(snapshot.strictPercent)}%",
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 26.sp,
                    color = Color(0xFF2E7D32),
                )
            }

            LinearProgressIndicator(
                progress = { (snapshot.strictPercent / 100.0).toFloat().coerceIn(0f, 1f) },
                modifier = Modifier.fillMaxWidth().height(10.dp),
                color = Color(0xFF2E7D32),
                trackColor = MaterialTheme.colorScheme.surfaceVariant,
            )

            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                StatusStatPill("متقن", snapshot.counts[MemorizationStatus.MASTERED] ?: 0, Color(0xFF2E7D32))
                StatusStatPill("بأخطاء", snapshot.counts[MemorizationStatus.MEMORIZED_WITH_ERRORS] ?: 0, Color(0xFFF57C00))
                StatusStatPill("يحتاج مصحف", snapshot.counts[MemorizationStatus.NEEDS_MUSHAF] ?: 0, Color(0xFF1976D2))
                StatusStatPill("غير محفوظ", snapshot.counts[MemorizationStatus.NOT_MEMORIZED] ?: 0, Color(0xFF757575))
            }
        }
    }
}

@Composable
private fun StatusStatPill(title: String, count: Int, color: Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(ArabicDigits.formatWhole(count.toLong()), fontWeight = FontWeight.Bold, fontSize = 14.sp, color = color)
        Text(title, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
fun StreakCard(streak: StreakSummary, modifier: Modifier = Modifier) {
    ElevatedCard(modifier) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("سلسلة الحفظ", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("🔥", fontSize = 18.sp)
                Text("${ArabicDigits.formatWhole(streak.current.toLong())} يوم", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = Color(0xFFE65100))
            }
            Text("الأطول: ${ArabicDigits.formatWhole(streak.longest.toLong())}", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
fun SuggestionCard(
    suggestion: Suggestion?,
    surahs: List<Surah>,
    modifier: Modifier = Modifier,
    onNavigate: (Int) -> Unit,
) {
    ElevatedCard(modifier.clickable {
        when (suggestion) {
            is Suggestion.ContinueLearning -> onNavigate(suggestion.surah)
            is Suggestion.Review -> onNavigate(suggestion.surah)
            null -> {}
        }
    }) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("التالي", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            when (suggestion) {
                is Suggestion.ContinueLearning -> {
                    val name = surahs.firstOrNull { it.number == suggestion.surah }?.name ?: "سورة ${suggestion.surah}"
                    Text("متابعة حفظ $name", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = Color(0xFF2E7D32))
                    Text("متبقي ${ArabicDigits.formatWhole(suggestion.remaining.toLong())} آية", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                is Suggestion.Review -> {
                    val name = surahs.firstOrNull { it.number == suggestion.surah }?.name ?: "سورة ${suggestion.surah}"
                    Text("مراجعة $name", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = Color(0xFF1976D2))
                    val days = suggestion.daysSinceReview?.let { "${ArabicDigits.formatWhole(it.toLong())} يوم" } ?: "اليوم"
                    Text("منذ $days", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                null -> {
                    Text("ابدأ بحفظ سورة جديدة", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    Text("اضغط تحديث الحفظ", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}

@Composable
fun SurahMemorizationRow(
    surahProgress: SurahProgress,
    surahName: String,
    onClick: () -> Unit,
) {
    ElevatedCard(Modifier.fillMaxWidth().clickable(onClick = onClick)) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Box(
                Modifier.size(32.dp).background(
                    if (surahProgress.state == SurahState.COMPLETE) Color(0xFF2E7D32) else MaterialTheme.colorScheme.surfaceVariant,
                    CircleShape,
                ),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    ArabicDigits.formatWhole(surahProgress.surah.toLong()),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (surahProgress.state == SurahState.COMPLETE) Color.White else MaterialTheme.colorScheme.onSurface,
                )
            }

            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(surahName, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    Text("${ArabicDigits.format(surahProgress.strictPercent)}%", fontSize = 12.sp, color = Color(0xFF2E7D32))
                }
                LinearProgressIndicator(
                    progress = { (surahProgress.strictPercent / 100.0).toFloat().coerceIn(0f, 1f) },
                    modifier = Modifier.fillMaxWidth().height(5.dp),
                    color = Color(0xFF2E7D32),
                    trackColor = MaterialTheme.colorScheme.surfaceVariant,
                )
            }
        }
    }
}

@Composable
fun JuzMemorizationRow(
    juzProgress: JuzProgress,
    onClick: () -> Unit,
) {
    ElevatedCard(Modifier.fillMaxWidth().clickable(onClick = onClick)) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Box(
                Modifier.size(32.dp).background(
                    if (juzProgress.isComplete) Color(0xFF2E7D32) else MaterialTheme.colorScheme.surfaceVariant,
                    CircleShape,
                ),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    ArabicDigits.formatWhole(juzProgress.juz.toLong()),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (juzProgress.isComplete) Color.White else MaterialTheme.colorScheme.onSurface,
                )
            }

            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("الجزء ${ArabicDigits.formatWhole(juzProgress.juz.toLong())}", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    Text("${ArabicDigits.format(juzProgress.strictPercent)}%", fontSize = 12.sp, color = Color(0xFF2E7D32))
                }
                LinearProgressIndicator(
                    progress = { (juzProgress.strictPercent / 100.0).toFloat().coerceIn(0f, 1f) },
                    modifier = Modifier.fillMaxWidth().height(5.dp),
                    color = Color(0xFF2E7D32),
                    trackColor = MaterialTheme.colorScheme.surfaceVariant,
                )
            }
        }
    }
}

@Composable
fun MemorizationUpdateSheet(
    store: MemorizationStore,
    surahs: List<Surah>,
    onDismiss: () -> Unit,
    onApplied: (MemorizationStore.ApplyResult) -> Unit,
) {
    var scopeType by remember { mutableIntStateOf(0) } // 0 = Surah, 1 = AyahRange, 2 = Page, 3 = Juz
    var selectedSurah by remember { mutableIntStateOf(1) }
    var fromAyah by remember { mutableIntStateOf(1) }
    var toAyah by remember { mutableIntStateOf(7) }
    var selectedPage by remember { mutableIntStateOf(1) }
    var selectedJuz by remember { mutableIntStateOf(1) }
    var selectedStatus by remember { mutableStateOf(MemorizationStatus.MASTERED) }
    var isLearning by remember { mutableStateOf(false) }
    var showConfirmDialog by remember { mutableStateOf(false) }
    var pendingPlan by remember { mutableStateOf<BatchPlan?>(null) }

    fun buildSelection(): MemorizationSelection = when (scopeType) {
        0 -> MemorizationSelection.Surah(selectedSurah)
        1 -> MemorizationSelection.AyahRange(selectedSurah, fromAyah, toAyah)
        2 -> MemorizationSelection.PageRange(selectedPage..selectedPage)
        else -> MemorizationSelection.Juz(selectedJuz)
    }

    fun buildLabel(): String = when (scopeType) {
        0 -> surahs.firstOrNull { it.number == selectedSurah }?.name ?: "سورة $selectedSurah"
        1 -> "${surahs.firstOrNull { it.number == selectedSurah }?.name ?: "سورة $selectedSurah"} ($fromAyah - $toAyah)"
        2 -> "صفحة $selectedPage"
        else -> "الجزء $selectedJuz"
    }

    fun executeApply(plan: BatchPlan) {
        val result = store.apply(plan)
        onApplied(result)
    }

    fun onCommitClick() {
        val selection = buildSelection()
        val plan = store.plan(selection, buildLabel(), selectedStatus, isLearning)
        if (store.needsConfirmation(selection, plan)) {
            pendingPlan = plan
            showConfirmDialog = true
        } else {
            executeApply(plan)
        }
    }

    Dialog(onDismissRequest = onDismiss) {
        Surface(shape = RoundedCornerShape(16.dp), tonalElevation = 6.dp) {
            Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Text("تحديث حالة الحفظ", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)

                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    FilterChip(selected = scopeType == 0, onClick = { scopeType = 0 }, label = { Text("سورة") })
                    FilterChip(selected = scopeType == 1, onClick = { scopeType = 1 }, label = { Text("آيات") })
                    FilterChip(selected = scopeType == 2, onClick = { scopeType = 2 }, label = { Text("صفحة") })
                    FilterChip(selected = scopeType == 3, onClick = { scopeType = 3 }, label = { Text("جزء") })
                }

                when (scopeType) {
                    0 -> {
                        OutlinedTextField(
                            value = selectedSurah.toString(),
                            onValueChange = { selectedSurah = it.toIntOrNull() ?: 1 },
                            label = { Text("رقم السورة (١ - ١١٤)") },
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                    1 -> {
                        OutlinedTextField(
                            value = selectedSurah.toString(),
                            onValueChange = { selectedSurah = it.toIntOrNull() ?: 1 },
                            label = { Text("رقم السورة") },
                            modifier = Modifier.fillMaxWidth(),
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(
                                value = fromAyah.toString(),
                                onValueChange = { fromAyah = it.toIntOrNull() ?: 1 },
                                label = { Text("من آية") },
                                modifier = Modifier.weight(1f),
                            )
                            OutlinedTextField(
                                value = toAyah.toString(),
                                onValueChange = { toAyah = it.toIntOrNull() ?: 1 },
                                label = { Text("إلى آية") },
                                modifier = Modifier.weight(1f),
                            )
                        }
                    }
                    2 -> {
                        OutlinedTextField(
                            value = selectedPage.toString(),
                            onValueChange = { selectedPage = it.toIntOrNull() ?: 1 },
                            label = { Text("رقم الصفحة (١ - ٦٠٤)") },
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                    3 -> {
                        OutlinedTextField(
                            value = selectedJuz.toString(),
                            onValueChange = { selectedJuz = it.toIntOrNull() ?: 1 },
                            label = { Text("رقم الجزء (١ - ٣٠)") },
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                }

                Text("الحالة الجديدة:", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    MemorizationStatus.entries.forEach { st ->
                        Row(
                            Modifier.fillMaxWidth().clickable { selectedStatus = st }.padding(vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            RadioButton(selected = selectedStatus == st, onClick = { selectedStatus = st })
                            Spacer(Modifier.width(8.dp))
                            Text(st.titleAr, fontSize = 14.sp)
                        }
                    }
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = isLearning, onCheckedChange = { isLearning = it })
                    Spacer(Modifier.width(8.dp))
                    Text("قيد التكرار والحفظ الآن", fontSize = 13.sp)
                }

                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    TextButton(onClick = onDismiss) { Text("إلغاء") }
                    Button(onClick = ::onCommitClick) { Text("تطبيق") }
                }
            }
        }
    }

    if (showConfirmDialog && pendingPlan != null) {
        val plan = pendingPlan!!
        AlertDialog(
            onDismissRequest = { showConfirmDialog = false },
            title = { Text("تأكيد التحديث") },
            text = {
                Text("أنت على وشك تحديث ${ArabicDigits.formatWhole(plan.selectionCount.toLong())} آية دفعة واحدة. هل تريد المتابعة؟")
            },
            confirmButton = {
                Button(onClick = {
                    showConfirmDialog = false
                    executeApply(plan)
                }) { Text("تأكيد") }
            },
            dismissButton = {
                TextButton(onClick = { showConfirmDialog = false }) { Text("إلغاء") }
            },
        )
    }
}

@Composable
fun MemorizationHistoryScreen(
    store: MemorizationStore,
    onBack: () -> Unit,
) {
    var batches by remember(store.version) { mutableStateOf(store.database.batches(100, 0)) }
    var conflictBatch by remember { mutableStateOf<Pair<UUID, List<BatchRecord>>?>(null) }
    var alertMessage by remember { mutableStateOf<String?>(null) }

    Scaffold(
        topBar = {
            Row(
                Modifier.fillMaxWidth().height(56.dp).padding(horizontal = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                TextButton(onClick = onBack) { Text("رجوع") }
                Text(
                    "سجل الحفظ والتراجع",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.weight(1f),
                    textAlign = TextAlign.Center,
                )
                Spacer(Modifier.width(48.dp))
            }
        },
    ) { padding ->
        if (batches.isEmpty()) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                Text("لا توجد عمليات سابقة", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        } else {
            LazyColumn(
                Modifier.fillMaxSize().padding(padding).padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
                contentPadding = PaddingValues(vertical = 12.dp),
            ) {
                items(batches, key = { it.id }) { batch ->
                    ElevatedCard(Modifier.fillMaxWidth()) {
                        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                                    Text(batch.label, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                                    if (batch.undoneAt != null) {
                                        Surface(color = MaterialTheme.colorScheme.errorContainer, shape = RoundedCornerShape(4.dp)) {
                                            Text("تم التراجع", fontSize = 10.sp, modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp), color = MaterialTheme.colorScheme.onErrorContainer)
                                        }
                                    }
                                }
                                val formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm").withZone(ZoneId.systemDefault())
                                Text(formatter.format(batch.createdAt), fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Text("${ArabicDigits.formatWhole(batch.ayahCount.toLong())} آية · الزيادة: ${ArabicDigits.formatWhole(batch.gainAyahs.toLong())}", fontSize = 12.sp)
                            }

                            if (batch.undoneAt == null && batch.kind != BatchKind.UNDO) {
                                Button(
                                    onClick = {
                                        try {
                                            store.undo(batch.id, force = false)
                                            batches = store.database.batches(100, 0)
                                        } catch (e: MemorizationException.HasNewerChanges) {
                                            conflictBatch = Pair(batch.id, e.conflicts)
                                        } catch (e: Exception) {
                                            alertMessage = e.message
                                        }
                                    },
                                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                                ) {
                                    Text("تراجع", fontSize = 12.sp)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    conflictBatch?.let { (batchId, conflicts) ->
        AlertDialog(
            onDismissRequest = { conflictBatch = null },
            title = { Text("تنبيه: تغييرات أحدث") },
            text = {
                Text("هناك ${ArabicDigits.formatWhole(conflicts.size.toLong())} دفعات أحدث عدلت نفس الآيات. هل تريد التراجع بالقوة؟")
            },
            confirmButton = {
                Button(
                    onClick = {
                        store.undo(batchId, force = true)
                        conflictBatch = null
                        batches = store.database.batches(100, 0)
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                ) { Text("تراجع بالقوة") }
            },
            dismissButton = {
                TextButton(onClick = { conflictBatch = null }) { Text("إلغاء") }
            },
        )
    }

    alertMessage?.let { msg ->
        AlertDialog(
            onDismissRequest = { alertMessage = null },
            title = { Text("تعذر التراجع") },
            text = { Text(msg) },
            confirmButton = { TextButton(onClick = { alertMessage = null }) { Text("حسنًا") } },
        )
    }
}
