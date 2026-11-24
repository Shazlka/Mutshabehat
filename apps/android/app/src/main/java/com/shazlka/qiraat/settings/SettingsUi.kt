package com.shazlka.qiraat.settings

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shazlka.qiraat.backup.BackupSettingsScreen
import com.shazlka.qiraat.cloud.CloudAccountScreen
import com.shazlka.qiraat.core.QiraatFilter
import com.shazlka.qiraat.core.UsulCategory
import com.shazlka.qiraat.memorization.MemorizationHistoryScreen
import com.shazlka.qiraat.reader.QiraatPickerDialog
import com.shazlka.qiraat.reader.ReaderViewModel
import com.shazlka.qiraat.reading.BookmarksScreen
import com.shazlka.qiraat.reading.ReadingStatisticsScreen

private enum class SettingsSubScreen {
    NONE,
    READING_STATS,
    BOOKMARKS,
    MEMORIZATION_HISTORY,
    BACKUP,
    CLOUD_ACCOUNT,
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    model: ReaderViewModel,
    onNavigateToPage: (Int) -> Unit,
) {
    var subScreen by remember { mutableStateOf(SettingsSubScreen.NONE) }
    var showAppearanceDialog by remember { mutableStateOf(false) }
    var showLanguageDialog by remember { mutableStateOf(false) }
    var showQiraatPicker by remember { mutableStateOf(false) }
    var showUsulCategoriesDialog by remember { mutableStateOf(false) }

    when (subScreen) {
        SettingsSubScreen.READING_STATS -> {
            ReadingStatisticsScreen(
                tracker = model.readingTracker,
                surahs = model.database?.surahs().orEmpty(),
                surahAyahCounts = model.surahAyahCounts,
                currentPage = model.currentPageNumber,
                onNavigateToPage = { page ->
                    subScreen = SettingsSubScreen.NONE
                    onNavigateToPage(page)
                },
                onBack = { subScreen = SettingsSubScreen.NONE },
            )
            return
        }
        SettingsSubScreen.BOOKMARKS -> {
            BookmarksScreen(
                tracker = model.readingTracker,
                surahNames = model.surahNames,
                onSelectBookmark = { bookmark ->
                    subScreen = SettingsSubScreen.NONE
                    onNavigateToPage(bookmark.page)
                },
                onBack = { subScreen = SettingsSubScreen.NONE },
            )
            return
        }
        SettingsSubScreen.MEMORIZATION_HISTORY -> {
            MemorizationHistoryScreen(
                store = model.memorizationStore,
                onBack = { subScreen = SettingsSubScreen.NONE },
            )
            return
        }
        SettingsSubScreen.BACKUP -> {
            BackupSettingsScreen(
                backupService = model.backupService,
                onBack = { subScreen = SettingsSubScreen.NONE },
            )
            return
        }
        SettingsSubScreen.CLOUD_ACCOUNT -> {
            CloudAccountScreen(model) { subScreen = SettingsSubScreen.NONE }
            return
        }
        SettingsSubScreen.NONE -> Unit
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("الإعدادات", fontWeight = FontWeight.Bold) },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                ),
            )
        },
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            item {
                ElevatedCard(shape = RoundedCornerShape(12.dp)) {
                    SettingsNavRow(
                        title = "الحساب والمزامنة",
                        subtitle = "مزامنة الختمة والحفظ بين أجهزتك",
                        onClick = { subScreen = SettingsSubScreen.CLOUD_ACCOUNT },
                    )
                }
            }

            // 1. Quran Reading & Khatma
            item {
                SettingsSectionHeader("قراءة القرآن والختمة")
                ElevatedCard(shape = RoundedCornerShape(12.dp)) {
                    Column {
                        SettingsNavRow(
                            title = "إحصائيات القراءة والختمة",
                            subtitle = "متابعة الصفحات، الساعات، وسجلات الأيام",
                            onClick = { subScreen = SettingsSubScreen.READING_STATS },
                        )
                        HorizontalDivider()
                        SettingsNavRow(
                            title = "الفواصل والعلامات",
                            subtitle = "${model.readingTracker.bookmarkedPages.size + model.readingTracker.bookmarkedAyahs.size} فاصلة محفوظة",
                            onClick = { subScreen = SettingsSubScreen.BOOKMARKS },
                        )
                        HorizontalDivider()
                        SettingsSwitchRow(
                            title = "إبقاء الشاشة مضاءة أثناء القراءة",
                            checked = model.keepScreenAwake,
                            onCheckedChange = { model.updateKeepScreenAwake(it) },
                        )
                        HorizontalDivider()
                        SettingsSwitchRow(
                            title = "إخفاء الشريط السفلي تلقائيًا بعد ١٠ ثوانٍ",
                            checked = model.autoHideFooter,
                            onCheckedChange = { model.updateAutoHideFooter(it) },
                        )
                    }
                }
            }

            // 2. Ten Qira'at
            item {
                SettingsSectionHeader("القراءات العشر")
                ElevatedCard(shape = RoundedCornerShape(12.dp)) {
                    Column {
                        SettingsSwitchRow(
                            title = "تفعيل عرض القراءات",
                            checked = model.qiraatEnabled,
                            onCheckedChange = { model.toggleQiraatEnabled() },
                        )
                        if (model.qiraatEnabled) {
                            HorizontalDivider()
                            val filterSubtitle = when (val filter = model.qiraatFilter) {
                                QiraatFilter.All -> "القراءات العشر"
                                is QiraatFilter.Reader -> model.qiraatStore.catalog.reader(filter.id)?.nameAr ?: filter.id
                                is QiraatFilter.Reading -> model.qiraatStore.catalog.narrator(filter.id)?.nameAr ?: filter.id
                            }
                            SettingsNavRow(
                                title = "اختيار القارئ أو الراوي",
                                subtitle = filterSubtitle,
                                onClick = { showQiraatPicker = true },
                            )
                            HorizontalDivider()
                            SettingsSwitchRow(
                                title = "فرش الحروف فقط (إخفاء الأصول)",
                                checked = model.hidesUsul,
                                onCheckedChange = { model.updateHidesUsul(it) },
                            )
                            HorizontalDivider()
                            val hiddenCount = model.hiddenUsulCategories.size
                            SettingsNavRow(
                                title = "أبواب الأصول",
                                subtitle = if (hiddenCount > 0) "$hiddenCount مخفية" else "جميع الأبواب ظاهرة",
                                enabled = !model.hidesUsul,
                                onClick = { showUsulCategoriesDialog = true },
                            )
                        }
                    }
                }
            }

            // 3. Memorization
            item {
                SettingsSectionHeader("حفظ القرآن")
                ElevatedCard(shape = RoundedCornerShape(12.dp)) {
                    Column {
                        var bannerMark by remember { mutableStateOf(model.memorizationStore.showsBannerMark) }
                        var ayahMarker by remember { mutableStateOf(model.memorizationStore.showsAyahMarker) }
                        SettingsSwitchRow(
                            title = "إظهار حالة الحفظ في الشريط العلوي",
                            checked = bannerMark,
                            onCheckedChange = {
                                bannerMark = it
                                model.memorizationStore.showsBannerMark = it
                            },
                        )
                        HorizontalDivider()
                        SettingsSwitchRow(
                            title = "إظهار علامات الحفظ على المصحف",
                            checked = ayahMarker,
                            onCheckedChange = {
                                ayahMarker = it
                                model.memorizationStore.showsAyahMarker = it
                            },
                        )
                        HorizontalDivider()
                        SettingsNavRow(
                            title = "سجل تغييرات الحفظ",
                            subtitle = "عرض التحديثات والمراجعات السابقة مع إمكانية التراجع",
                            onClick = { subScreen = SettingsSubScreen.MEMORIZATION_HISTORY },
                        )
                    }
                }
            }

            // 4. Preferences (Appearance & Language)
            item {
                SettingsSectionHeader("التفضيلات")
                ElevatedCard(shape = RoundedCornerShape(12.dp)) {
                    Column {
                        SettingsNavRow(
                            title = "المظهر",
                            subtitle = model.appearance.titleAr,
                            onClick = { showAppearanceDialog = true },
                        )
                        HorizontalDivider()
                        SettingsNavRow(
                            title = "اللغة",
                            subtitle = model.language.title,
                            onClick = { showLanguageDialog = true },
                        )
                    }
                }
            }

            // 5. Backup & Restore
            item {
                SettingsSectionHeader("النسخ الاحتياطي والاستعادة")
                ElevatedCard(shape = RoundedCornerShape(12.dp)) {
                    Column {
                        SettingsNavRow(
                            title = "النسخ الاحتياطي المحلي (JSON)",
                            subtitle = "تصدير أو استيراد ملف حفظ القرآن بصيغة متوافقة",
                            onClick = { subScreen = SettingsSubScreen.BACKUP },
                        )
                    }
                }
            }

            // 6. About
            item {
                SettingsSectionHeader("معلومات التطبيق")
                ElevatedCard(shape = RoundedCornerShape(12.dp)) {
                    Column {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 14.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text("الإصدار", fontWeight = FontWeight.Medium)
                            Text("0.4.0 (Phase 4)", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
                Spacer(Modifier.height(24.dp))
            }
        }
    }

    if (showAppearanceDialog) {
        AppearanceSelectionDialog(
            current = model.appearance,
            onSelect = {
                model.updateAppearance(it)
                showAppearanceDialog = false
            },
            onDismiss = { showAppearanceDialog = false },
        )
    }

    if (showLanguageDialog) {
        LanguageSelectionDialog(
            current = model.language,
            onSelect = {
                model.updateLanguage(it)
                showLanguageDialog = false
            },
            onDismiss = { showLanguageDialog = false },
        )
    }

    if (showQiraatPicker) {
        QiraatPickerDialog(
            model = model,
            onDismiss = { showQiraatPicker = false },
        )
    }

    if (showUsulCategoriesDialog) {
        UsulCategoriesDialog(
            categories = model.usulCategories,
            hiddenCategories = model.hiddenUsulCategories,
            onToggleCategory = { code, hide ->
                val current = model.hiddenUsulCategories.toMutableSet()
                if (hide) current.add(code) else current.remove(code)
                model.updateHiddenUsulCategories(current)
            },
            onDismiss = { showUsulCategoriesDialog = false },
        )
    }
}

@Composable
private fun SettingsSectionHeader(title: String) {
    Text(
        text = title,
        fontWeight = FontWeight.Bold,
        fontSize = 14.sp,
        color = MaterialTheme.colorScheme.primary,
        modifier = Modifier.padding(horizontal = 4.dp, vertical = 6.dp),
    )
}

@Composable
private fun SettingsNavRow(
    title: String,
    subtitle: String? = null,
    enabled: Boolean = true,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                fontWeight = FontWeight.Medium,
                color = if (enabled) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.38f),
            )
            if (subtitle != null) {
                Text(
                    text = subtitle,
                    fontSize = 12.sp,
                    color = if (enabled) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.38f),
                )
            }
        }
        Text(
            text = "‹",
            fontSize = 18.sp,
            color = if (enabled) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.38f),
        )
    }
}

@Composable
private fun SettingsSwitchRow(
    title: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(text = title, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
        Switch(checked = checked, onCheckedChange = onCheckedChange)
    }
}

@Composable
private fun AppearanceSelectionDialog(
    current: MushafAppearance,
    onSelect: (MushafAppearance) -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("اختيار المظهر") },
        text = {
            Column {
                MushafAppearance.entries.forEach { appearance ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .selectable(
                                selected = current == appearance,
                                onClick = { onSelect(appearance) },
                            )
                            .padding(vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        RadioButton(
                            selected = current == appearance,
                            onClick = { onSelect(appearance) },
                        )
                        Spacer(Modifier.width(8.dp))
                        Text("${appearance.titleAr} (${appearance.titleEn})")
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) { Text("إغلاق") }
        },
    )
}

@Composable
private fun LanguageSelectionDialog(
    current: AppLanguage,
    onSelect: (AppLanguage) -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("اختيار اللغة") },
        text = {
            Column {
                AppLanguage.entries.forEach { lang ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .selectable(
                                selected = current == lang,
                                onClick = { onSelect(lang) },
                            )
                            .padding(vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        RadioButton(
                            selected = current == lang,
                            onClick = { onSelect(lang) },
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(lang.title)
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) { Text("إغلاق") }
        },
    )
}

@Composable
private fun UsulCategoriesDialog(
    categories: List<UsulCategory>,
    hiddenCategories: Set<String>,
    onToggleCategory: (String, Boolean) -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("أبواب الأصول") },
        text = {
            LazyColumn(modifier = Modifier.fillMaxWidth().heightIn(max = 350.dp)) {
                items(categories.size) { index ->
                    val cat = categories[index]
                    val isHidden = cat.code in hiddenCategories
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 6.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(cat.categoryAr, modifier = Modifier.weight(1f))
                        Checkbox(
                            checked = !isHidden,
                            onCheckedChange = { visible -> onToggleCategory(cat.code, !visible) },
                        )
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) { Text("تم") }
        },
    )
}
