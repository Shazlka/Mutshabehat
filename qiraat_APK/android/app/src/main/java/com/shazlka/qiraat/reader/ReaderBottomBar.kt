package com.shazlka.qiraat.reader

import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shazlka.qiraat.core.QiraatCatalog
import com.shazlka.qiraat.core.QiraatFilter
import com.shazlka.qiraat.core.Surah
import com.shazlka.qiraat.core.filterName
import com.shazlka.qiraat.reading.BookmarkType
import com.shazlka.qiraat.reading.QuranBookmark

enum class FooterMenuSlot { QIRAAT, MORE }

/**
 * Exact port of iOS `ReaderBottomBar.swift` and `FooterTabBar.swift`:
 * A single floating capsule footer bar at the bottom of the reader paper.
 * Six action destinations laid out RTL:
 * [الفهرس | بحث | الفواصل | القراءات | المزيد | الإعدادات]
 */
@Composable
fun ReaderBottomBar(
    qiraatEnabled: Boolean,
    qiraatFilter: QiraatFilter,
    catalog: QiraatCatalog,
    modifier: Modifier = Modifier,
    onOpenIndex: () -> Unit,
    onOpenSearch: () -> Unit,
    onOpenBookmarks: () -> Unit,
    onToggleQiraatEnabled: () -> Unit,
    onOpenPicker: () -> Unit,
    onOpenSummary: () -> Unit,
    onOpenLegend: () -> Unit,
    onOpenPreferences: () -> Unit,
    onOpenUsul: () -> Unit,
    onOpenMutshabehat: () -> Unit,
    onOpenMemorization: () -> Unit,
    onOpenMutoon: () -> Unit,
    onOpenSettings: () -> Unit,
) {
    var openMenu by remember { mutableStateOf<FooterMenuSlot?>(null) }

    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
        Box(
            modifier = modifier.fillMaxWidth(),
            contentAlignment = Alignment.BottomCenter
        ) {
            // Popup menu scrim (tap outside to close)
            if (openMenu != null) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null,
                            onClick = { openMenu = null }
                        )
                )
            }

            // Floating Popup Menus anchored above footer capsule
            AnimatedVisibility(
                visible = openMenu == FooterMenuSlot.QIRAAT,
                enter = fadeIn(tween(180)) + slideInVertically(tween(180)) { it / 4 },
                exit = fadeOut(tween(140)) + slideOutVertically(tween(140)) { it / 4 }
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 74.dp, start = 16.dp, end = 16.dp),
                    contentAlignment = Alignment.BottomCenter
                ) {
                    QiraatGlassMenu(
                        qiraatEnabled = qiraatEnabled,
                        filterLabel = catalog.filterName(qiraatFilter),
                        onToggleEnabled = onToggleQiraatEnabled,
                        onOpenPicker = { openMenu = null; onOpenPicker() },
                        onOpenLegend = { openMenu = null; onOpenLegend() },
                        onOpenSummary = { openMenu = null; onOpenSummary() },
                        onOpenSearch = { openMenu = null; onOpenSearch() },
                        onOpenUsul = { openMenu = null; onOpenUsul() },
                        onOpenPreferences = { openMenu = null; onOpenPreferences() }
                    )
                }
            }

            AnimatedVisibility(
                visible = openMenu == FooterMenuSlot.MORE,
                enter = fadeIn(tween(180)) + slideInVertically(tween(180)) { it / 4 },
                exit = fadeOut(tween(140)) + slideOutVertically(tween(140)) { it / 4 }
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 74.dp, start = 16.dp, end = 16.dp),
                    contentAlignment = Alignment.BottomCenter
                ) {
                    MoreGlassMenu(
                        onOpenMutshabehat = { openMenu = null; onOpenMutshabehat() },
                        onOpenMemorization = { openMenu = null; onOpenMemorization() },
                        onOpenMutoon = { openMenu = null; onOpenMutoon() }
                    )
                }
            }

            // Single Footer Capsule Bar (iOS: height 62pt, floating capsule, 6 actions)
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 6.dp)
                    .height(62.dp)
                    .shadow(elevation = 6.dp, shape = RoundedCornerShape(32.dp)),
                shape = RoundedCornerShape(32.dp),
                color = MaterialTheme.colorScheme.surface.copy(alpha = 0.95f),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.45f))
            ) {
                Row(
                    modifier = Modifier.fillMaxSize(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceEvenly
                ) {
                    // Item 0: الفهرس (open-index)
                    FooterBarItem(
                        title = "الفهرس",
                        icon = Icons.Default.FormatListBulleted,
                        onClick = { openMenu = null; onOpenIndex() }
                    )

                    // Item 1: بحث (search-button)
                    FooterBarItem(
                        title = "بحث",
                        icon = Icons.Default.Search,
                        onClick = { openMenu = null; onOpenSearch() }
                    )

                    // Item 2: الفواصل (bookmarks-button)
                    FooterBarItem(
                        title = "الفواصل",
                        icon = Icons.Default.Bookmark,
                        onClick = { openMenu = null; onOpenBookmarks() }
                    )

                    // Item 3: القراءات (qiraat-button)
                    FooterBarItem(
                        title = "القراءات",
                        icon = Icons.Default.AutoStories,
                        isActive = qiraatEnabled,
                        onClick = {
                            openMenu = if (openMenu == FooterMenuSlot.QIRAAT) null else FooterMenuSlot.QIRAAT
                        }
                    )

                    // Item 4: المزيد (more-button)
                    FooterBarItem(
                        title = "المزيد",
                        icon = Icons.Default.MoreHoriz,
                        isActive = openMenu == FooterMenuSlot.MORE,
                        onClick = {
                            openMenu = if (openMenu == FooterMenuSlot.MORE) null else FooterMenuSlot.MORE
                        }
                    )

                    // Item 5: الإعدادات (settings-button)
                    FooterBarItem(
                        title = "الإعدادات",
                        icon = Icons.Default.Settings,
                        onClick = { openMenu = null; onOpenSettings() }
                    )
                }
            }
        }
    }
}

@Composable
private fun RowScope.FooterBarItem(
    title: String,
    icon: ImageVector,
    isActive: Boolean = false,
    onClick: () -> Unit
) {
    val ink = MaterialTheme.colorScheme.onSurface
    val activeColor = MaterialTheme.colorScheme.primary

    Box(
        modifier = Modifier
            .weight(1f)
            .fillMaxHeight()
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Box(contentAlignment = Alignment.TopEnd) {
                Icon(
                    imageVector = icon,
                    contentDescription = title,
                    tint = if (isActive) activeColor else ink,
                    modifier = Modifier.size(22.dp)
                )
                if (isActive) {
                    Box(
                        modifier = Modifier
                            .size(6.dp)
                            .background(activeColor, CircleShape)
                    )
                }
            }
            Spacer(Modifier.height(3.dp))
            Text(
                text = title,
                fontSize = 11.sp,
                fontWeight = if (isActive) FontWeight.Bold else FontWeight.Medium,
                color = if (isActive) activeColor else ink,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

/**
 * Port of iOS `QiraatHubContent`:
 * The popup menu floating above the Qiraat button on the reader bottom bar.
 */
@Composable
private fun QiraatGlassMenu(
    qiraatEnabled: Boolean,
    filterLabel: String,
    onToggleEnabled: () -> Unit,
    onOpenPicker: () -> Unit,
    onOpenLegend: () -> Unit,
    onOpenSummary: () -> Unit,
    onOpenSearch: () -> Unit,
    onOpenUsul: () -> Unit,
    onOpenPreferences: () -> Unit
) {
    Surface(
        modifier = Modifier
            .widthIn(max = 330.dp)
            .shadow(elevation = 12.dp, shape = RoundedCornerShape(18.dp)),
        shape = RoundedCornerShape(18.dp),
        color = MaterialTheme.colorScheme.surface.copy(alpha = 0.98f),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
    ) {
        Column(
            modifier = Modifier.padding(vertical = 6.dp)
        ) {
            // Row 1: إظهار علامات القراءات with Switch
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable(onClick = onToggleEnabled)
                    .padding(horizontal = 18.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "إظهار علامات القراءات",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Switch(
                    checked = qiraatEnabled,
                    onCheckedChange = { onToggleEnabled() },
                    modifier = Modifier.scale(0.85f)
                )
            }

            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.3f))

            // Row 2: Reader filter button
            BarMenuRow(
                title = filterLabel,
                icon = Icons.Default.FilterList,
                enabled = qiraatEnabled,
                onClick = onOpenPicker
            )

            // Row 3: مفتاح الألوان
            BarMenuRow(
                title = "مفتاح الألوان",
                icon = Icons.Default.Palette,
                onClick = onOpenLegend
            )

            // Row 4: خلافات الصفحة
            BarMenuRow(
                title = "خلافات الصفحة",
                icon = Icons.Default.ReceiptLong,
                onClick = onOpenSummary
            )

            // Row 5: البحث في القراءات
            BarMenuRow(
                title = "البحث في القراءات",
                icon = Icons.Default.Search,
                onClick = onOpenSearch
            )

            // Row 6: أصول القراءات
            BarMenuRow(
                title = "أصول القراءات",
                icon = Icons.Default.MenuBook,
                onClick = onOpenUsul
            )

            // Row 7: تفضيلات القراءات
            BarMenuRow(
                title = "تفضيلات القراءات",
                icon = Icons.Default.Tune,
                onClick = onOpenPreferences
            )
        }
    }
}

/**
 * Port of iOS More Menu in `ReaderBottomBar.swift`:
 * Shows المتشابهات, الحفظ, المتون
 */
@Composable
private fun MoreGlassMenu(
    onOpenMutshabehat: () -> Unit,
    onOpenMemorization: () -> Unit,
    onOpenMutoon: () -> Unit
) {
    Surface(
        modifier = Modifier
            .widthIn(max = 280.dp)
            .shadow(elevation = 12.dp, shape = RoundedCornerShape(18.dp)),
        shape = RoundedCornerShape(18.dp),
        color = MaterialTheme.colorScheme.surface.copy(alpha = 0.98f),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
    ) {
        Column(
            modifier = Modifier.padding(vertical = 6.dp)
        ) {
            BarMenuRow(
                title = "المتشابهات",
                icon = Icons.Default.Layers,
                onClick = onOpenMutshabehat
            )
            BarMenuRow(
                title = "الحفظ",
                icon = Icons.Default.Book,
                onClick = onOpenMemorization
            )
            BarMenuRow(
                title = "المتون",
                icon = Icons.Default.LibraryBooks,
                onClick = onOpenMutoon
            )
        }
    }
}

@Composable
private fun BarMenuRow(
    title: String,
    icon: ImageVector,
    enabled: Boolean = true,
    onClick: () -> Unit
) {
    val alpha = if (enabled) 1f else 0.38f
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 18.dp, vertical = 13.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = title,
            fontSize = 15.sp,
            fontWeight = FontWeight.Medium,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = alpha),
            modifier = Modifier.weight(1f)
        )
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = alpha),
            modifier = Modifier.size(20.dp)
        )
    }
}

private fun Modifier.scale(ratio: Float): Modifier = this.then(Modifier.size((52 * ratio).dp, (32 * ratio).dp))

/**
 * Port of iOS `IndexSheet`:
 * Allows navigating directly to any Surah (1-114), Juz (1-30), or Bookmark.
 */
@Composable
fun IndexDialog(
    surahs: List<Surah>,
    juzStartPages: Map<Int, Int>,
    bookmarks: List<QuranBookmark>,
    onSelectPage: (Int) -> Unit,
    onDismiss: () -> Unit
) {
    var selectedTab by remember { mutableIntStateOf(0) }
    var searchQuery by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(onClick = onDismiss) { Text("إغلاق") }
        },
        title = {
            Column(Modifier.fillMaxWidth()) {
                Text(
                    text = "الفهرس",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.fillMaxWidth(),
                    textAlign = TextAlign.Center
                )
                Spacer(Modifier.height(8.dp))
                PrimaryTabRow(
                    selectedTabIndex = selectedTab,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Tab(
                        selected = selectedTab == 0,
                        onClick = { selectedTab = 0 },
                        text = { Text("السور") }
                    )
                    Tab(
                        selected = selectedTab == 1,
                        onClick = { selectedTab = 1 },
                        text = { Text("الأجزاء") }
                    )
                    Tab(
                        selected = selectedTab == 2,
                        onClick = { selectedTab = 2 },
                        text = { Text("الفواصل (${bookmarks.size})") }
                    )
                }
            }
        },
        text = {
            Column(Modifier.fillMaxWidth().height(440.dp)) {
                if (selectedTab == 0) {
                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = { searchQuery = it },
                        modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
                        placeholder = { Text("ابحث في السور…") },
                        singleLine = true
                    )
                    val filtered = remember(searchQuery, surahs) {
                        if (searchQuery.isBlank()) surahs
                        else surahs.filter { it.name.contains(searchQuery.trim()) || it.number.toString() == searchQuery.trim() }
                    }
                    LazyColumn(Modifier.fillMaxSize()) {
                        items(filtered, key = { it.number }) { surah ->
                            ListItem(
                                headlineContent = { Text(surah.name, fontWeight = FontWeight.Bold) },
                                supportingContent = { Text("${surah.ayahCount} آية · ص ${surah.firstPage}") },
                                leadingContent = {
                                    Surface(
                                        shape = CircleShape,
                                        color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f),
                                        modifier = Modifier.size(32.dp)
                                    ) {
                                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                            Text(
                                                text = surah.number.toString(),
                                                fontSize = 12.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = MaterialTheme.colorScheme.primary
                                            )
                                        }
                                    }
                                },
                                modifier = Modifier.clickable {
                                    onSelectPage(surah.firstPage)
                                    onDismiss()
                                }
                            )
                            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.2f))
                        }
                    }
                } else if (selectedTab == 1) {
                    LazyColumn(Modifier.fillMaxSize()) {
                        items(30) { index ->
                            val juzNum = index + 1
                            val page = juzStartPages[juzNum] ?: (juzNum * 20 - 18).coerceIn(1, 604)
                            ListItem(
                                headlineContent = { Text("الجزء $juzNum", fontWeight = FontWeight.Bold) },
                                supportingContent = { Text("يبدأ من صفحة $page") },
                                leadingContent = {
                                    Surface(
                                        shape = CircleShape,
                                        color = MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.5f),
                                        modifier = Modifier.size(32.dp)
                                    ) {
                                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                            Text(
                                                text = juzNum.toString(),
                                                fontSize = 12.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = MaterialTheme.colorScheme.secondary
                                            )
                                        }
                                    }
                                },
                                modifier = Modifier.clickable {
                                    onSelectPage(page)
                                    onDismiss()
                                }
                            )
                            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.2f))
                        }
                    }
                } else {
                    if (bookmarks.isEmpty()) {
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Text(
                                text = "لا توجد فواصل محفوظة",
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    } else {
                        LazyColumn(Modifier.fillMaxSize()) {
                            items(bookmarks, key = { it.id }) { bm ->
                                val label = if (bm.type == BookmarkType.PAGE) "فاصلة صفحة ${bm.page}"
                                else "سورة ${bm.surah} · آية ${bm.ayah}"
                                ListItem(
                                    headlineContent = { Text(label, fontWeight = FontWeight.Bold) },
                                    supportingContent = { Text("صفحة ${bm.page}") },
                                    leadingContent = {
                                        Icon(
                                            imageVector = Icons.Default.Bookmark,
                                            contentDescription = null,
                                            tint = Color(0xFFD69C00)
                                        )
                                    },
                                    modifier = Modifier.clickable {
                                        onSelectPage(bm.page)
                                        onDismiss()
                                    }
                                )
                                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.2f))
                            }
                        }
                    }
                }
            }
        }
    )
}
