package com.shazlka.qiraat.reader

import androidx.activity.compose.BackHandler
import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.PageSize
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.viewmodel.compose.viewModel
import com.shazlka.qiraat.core.MUSHAF_PAGE_COUNT
import com.shazlka.qiraat.core.MushafPage
import com.shazlka.qiraat.core.PageLayoutConstants
import com.shazlka.qiraat.core.QiraatPageSummary
import com.shazlka.qiraat.core.Rect
import com.shazlka.qiraat.core.Spread
import com.shazlka.qiraat.memorization.MemorizationDashboardScreen
import com.shazlka.qiraat.memorization.MemorizationStatus
import com.shazlka.qiraat.reading.KhatmaCelebrationDialog
import com.shazlka.qiraat.settings.SettingsScreen
import com.shazlka.qiraat.ui.QiraatTheme
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun ReaderScreen(model: ReaderViewModel = viewModel()) {
    when (val state = model.state) {
        ReaderState.Loading -> LoadingReader()
        is ReaderState.Failed -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text(state.message, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(24.dp))
        }
        is ReaderState.Ready -> QiraatTheme(appearance = model.appearance) {
            ReadyReader(model, state.initialPage)
        }
    }
}

@Composable
private fun LoadingReader() {
    Column(
        Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        CircularProgressIndicator(modifier = Modifier.size(42.dp))
        Spacer(Modifier.height(16.dp))
        Text("جارٍ تجهيز المصحف…")
    }
}

@Composable
private fun ReadyReader(model: ReaderViewModel, initialPage: Int) {
    val pagerState = rememberPagerState(initialPage = initialPage - 1, pageCount = { MUSHAF_PAGE_COUNT })
    val scope = rememberCoroutineScope()
    var selected by remember { mutableStateOf<WordSelection?>(null) }
    var peek by remember { mutableStateOf<WordSelection?>(null) }
    var showPicker by remember { mutableStateOf(false) }
    var showPreferences by remember { mutableStateOf(false) }
    var showLegend by remember { mutableStateOf(false) }
    var showSummary by remember { mutableStateOf(false) }
    var showCompare by remember { mutableStateOf<WordSelection?>(null) }
    var showQiraatHub by remember { mutableStateOf(false) }
    var showIndexDialog by remember { mutableStateOf(false) }
    var showBookmarksDialog by remember { mutableStateOf(false) }
    var tab by remember { mutableStateOf(AppTab.READER) }
    var highlightedWordIDs by remember { mutableStateOf(emptySet<String>()) }
    var currentMushafPage by remember { mutableStateOf<MushafPage?>(null) }
    val isDark = isSystemInDarkTheme()

    // Chrome visibility state: header and single bottom footer bar
    var chromeVisible by remember { mutableStateOf(true) }

    LaunchedEffect(pagerState.currentPage) {
        val page = pagerState.currentPage + 1
        model.savePage(page)
        model.fontStore.prewarm(com.shazlka.qiraat.core.QcfFontStore.neighbourhood(page))
    }

    LaunchedEffect(pagerState.isScrollInProgress) {
        if (!pagerState.isScrollInProgress && pagerState.currentPageOffsetFraction != 0f) {
            pagerState.scrollToPage(pagerState.currentPage)
        }
    }

    // Auto-hide chrome after 10 seconds of inactivity if enabled in settings
    LaunchedEffect(chromeVisible, pagerState.currentPage, model.autoHideFooter) {
        if (chromeVisible && model.autoHideFooter) {
            delay(10_000)
            chromeVisible = false
        }
    }

    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
        if (tab == AppTab.READER) {
            if (showQiraatHub) {
                QiraatHub(
                    model = model,
                    onClose = { showQiraatHub = false },
                    onNavigate = { page ->
                        showQiraatHub = false
                        scope.launch { pagerState.animateScrollToPage(page - 1) }
                    },
                )
            } else {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(MaterialTheme.colorScheme.background)
                        .statusBarsPadding()
                ) {
                    // Mushaf Paper & Pager Column
                    Column(Modifier.fillMaxSize()) {
                        var headerPage by remember { mutableStateOf<MushafPage?>(null) }
                        LaunchedEffect(pagerState.currentPage) {
                            headerPage = model.page(pagerState.currentPage + 1)
                        }
                        val bannerProgress = if (model.memorizationStore.showsBannerMark) {
                            model.memorizationStore.pageProgress(pagerState.currentPage + 1)
                        } else null
                        val bannerStatus = bannerProgress?.state
                        val bannerColor = bannerStatus?.let {
                            when (it) {
                                MemorizationStatus.MASTERED -> Color(0xFF2E7D32)
                                MemorizationStatus.MEMORIZED_WITH_ERRORS -> Color(0xFFF57C00)
                                MemorizationStatus.NEEDS_MUSHAF -> Color(0xFF1976D2)
                                MemorizationStatus.NOT_MEMORIZED -> Color(0xFF757575)
                            }
                        }

                        // Top Header (hides and shows with chrome)
                        AnimatedVisibility(
                            visible = chromeVisible,
                            enter = fadeIn(tween(200)) + expandVertically(tween(200)),
                            exit = fadeOut(tween(200)) + shrinkVertically(tween(200))
                        ) {
                            ReaderHeader(
                                page = headerPage,
                                isBookmarked = model.readingTracker.isPageBookmarked(pagerState.currentPage + 1),
                                bannerStatusText = bannerStatus?.titleAr,
                                bannerStatusColor = bannerColor,
                                onToggleBookmark = {
                                    model.togglePageBookmark(pagerState.currentPage + 1)
                                },
                            )
                        }

                        HorizontalPager(
                            state = pagerState,
                            pageSize = PageSize.Fill,
                            beyondViewportPageCount = 1,
                            modifier = Modifier
                                .weight(1f)
                                .fillMaxWidth()
                                .clipToBounds(),
                            key = { it + 1 },
                        ) { index ->
                            var page by remember(index) { mutableStateOf<MushafPage?>(null) }
                            LaunchedEffect(index) {
                                page = model.page(index + 1)
                                if (index == pagerState.currentPage) currentMushafPage = page
                            }
                            BoxWithConstraints(
                                Modifier
                                    .fillMaxSize()
                                    .clipToBounds(),
                                contentAlignment = Alignment.Center,
                            ) {
                                page?.let { loaded ->
                                    val isSpread = Spread.isSpread(maxWidth.value, maxHeight.value)
                                    val density = LocalDensity.current
                                    val (pageWidthDp, pageHeightDp) = if (isSpread) {
                                        with(density) {
                                            val area = Rect(0f, 0f, (maxWidth / 2).toPx(), maxHeight.toPx())
                                            val fitted = PageLayoutConstants.fittedPageRect(area, stretch = false)
                                            fitted.width.toDp() to fitted.height.toDp()
                                        }
                                    } else {
                                        with(density) {
                                            val area = Rect(0f, 0f, maxWidth.toPx(), maxHeight.toPx())
                                            val fitted = PageLayoutConstants.fittedPageRect(area, stretch = false)
                                            fitted.width.toDp() to fitted.height.toDp()
                                        }
                                    }

                                    AndroidView(
                                        factory = { context -> MushafPageCanvas(context) },
                                        update = { view ->
                                            view.page = loaded
                                            view.fontStore = model.fontStore
                                            view.surahAyahCounts = model.surahAyahCounts
                                            view.surahNames = model.surahNames
                                            view.qiraatEnabled = model.qiraatEnabled
                                            view.qiraatFilter = model.qiraatFilter
                                            view.qiraatMarks = model.marks(loaded.number)
                                            view.appearance = model.appearance
                                            view.isSystemDark = isDark
                                            view.showsAyahMarker = model.memorizationStore.showsAyahMarker
                                            view.ayahStatuses = model.memorizationStore.statuses(loaded.number)
                                            view.highlightedWordIDs = highlightedWordIDs
                                            view.onWordTap = { word ->
                                                view.qiraatMarks?.selection(word.ayahKey.surah, word.ayahKey.ayah, word.indexInAyah, model.qiraatFilter)?.let {
                                                    selected = WordSelection(word, it)
                                                }
                                            }
                                            view.onWordLongPress = { word ->
                                                view.qiraatMarks?.selection(word.ayahKey.surah, word.ayahKey.ayah, word.indexInAyah, model.qiraatFilter)?.let {
                                                    peek = WordSelection(word, it)
                                                }
                                            }
                                            view.onPageTap = {
                                                chromeVisible = !chromeVisible
                                            }
                                        },
                                        modifier = Modifier.size(pageWidthDp, pageHeightDp),
                                    )
                                } ?: CircularProgressIndicator(modifier = Modifier.size(28.dp))
                            }
                        }

                        // Bottom space under paper to guarantee bar never clips page content
                        Spacer(Modifier.height(70.dp))
                    }

                    // Single iOS-Exact Floating Capsule Footer Bar
                    AnimatedVisibility(
                        visible = chromeVisible,
                        enter = fadeIn(tween(200)) + slideInVertically(tween(200)) { it },
                        exit = fadeOut(tween(200)) + slideOutVertically(tween(200)) { it },
                        modifier = Modifier
                            .align(Alignment.BottomCenter)
                            .navigationBarsPadding()
                    ) {
                        ReaderBottomBar(
                            qiraatEnabled = model.qiraatEnabled,
                            qiraatFilter = model.qiraatFilter,
                            catalog = model.qiraatStore.catalog,
                            onOpenIndex = { showIndexDialog = true },
                            onOpenSearch = { tab = AppTab.SEARCH },
                            onOpenBookmarks = { showBookmarksDialog = true },
                            onToggleQiraatEnabled = { model.updateQiraatEnabled(!model.qiraatEnabled) },
                            onOpenPicker = { showPicker = true },
                            onOpenSummary = { showSummary = true },
                            onOpenLegend = { showLegend = true },
                            onOpenPreferences = { showPreferences = true },
                            onOpenUsul = { showQiraatHub = true },
                            onOpenMutshabehat = { tab = AppTab.MUTSHABEHAT },
                            onOpenMemorization = { tab = AppTab.MEMORIZATION },
                            onOpenMutoon = { showQiraatHub = true },
                            onOpenSettings = { tab = AppTab.SETTINGS }
                        )
                    }
                }
            }
        } else {
            // Sub-destinations: full-screen with clean top bar and return to Mushaf reader
            BackHandler { tab = AppTab.READER }

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .background(MaterialTheme.colorScheme.background)
                    .statusBarsPadding()
            ) {
                Surface(
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                    color = MaterialTheme.colorScheme.surface,
                    shadowElevation = 2.dp
                ) {
                    Row(
                        modifier = Modifier.fillMaxSize().padding(horizontal = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(onClick = { tab = AppTab.READER }) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = "عودة للمصحف",
                                tint = MaterialTheme.colorScheme.primary
                            )
                        }
                        Text(
                            text = when (tab) {
                                AppTab.MUTSHABEHAT -> "المتشابهات"
                                AppTab.MEMORIZATION -> "الحفظ"
                                AppTab.SEARCH -> "البحث"
                                AppTab.SETTINGS -> "الإعدادات"
                                else -> ""
                            },
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(Modifier.weight(1f))
                        TextButton(onClick = { tab = AppTab.READER }) {
                            Text("المصحف", fontWeight = FontWeight.Bold)
                        }
                    }
                }

                Box(Modifier.weight(1f).fillMaxWidth()) {
                    when (tab) {
                        AppTab.MUTSHABEHAT -> MutshabehatLibraryScreen(model) { page, ids ->
                            highlightedWordIDs = ids
                            tab = AppTab.READER
                            scope.launch { pagerState.animateScrollToPage(page - 1) }
                        }
                        AppTab.MEMORIZATION -> {
                            MemorizationDashboardScreen(
                                store = model.memorizationStore,
                                surahs = model.database?.surahs().orEmpty(),
                                onOpenInMushaf = { page ->
                                    tab = AppTab.READER
                                    scope.launch { pagerState.animateScrollToPage(page - 1) }
                                },
                                onOpenBackup = {
                                    tab = AppTab.SETTINGS
                                },
                            )
                        }
                        AppTab.SEARCH -> QuranSearchScreen(model) { result ->
                            highlightedWordIDs = result.matchedWordIDs.toSet()
                            tab = AppTab.READER
                            scope.launch { pagerState.animateScrollToPage(result.page - 1) }
                        }
                        AppTab.SETTINGS -> SettingsScreen(model) { page ->
                            tab = AppTab.READER
                            scope.launch { pagerState.animateScrollToPage(page - 1) }
                        }
                        else -> {}
                    }
                }
            }
        }

        // Sheets and Dialogs
        selected?.let { value ->
            QiraatWordSheet(value, model, { selected = null }, { showCompare = value; selected = null })
        }
        peek?.let { value ->
            QiraatPeekDialog(value, model.qiraatStore.catalog) { peek = null }
        }
        if (showPicker) QiraatPickerDialog(model) { showPicker = false }
        if (showPreferences) QiraatPreferencesDialog(model) { showPreferences = false }
        if (showLegend) QiraatLegendDialog(model) { showLegend = false }
        showCompare?.let { QiraatCompareDialog(it, model) { showCompare = null } }
        if (showSummary) {
            val page = currentMushafPage
            val data = page?.let { model.qiraatStore.page(it.number) }
            val marks = page?.let { model.marks(it.number) }
            val items = if (page != null && data != null && marks != null) {
                QiraatPageSummary.build(page.number, page.lines.flatMap { it.words }, data, marks, model.qiraatFilter)
            } else emptyList()
            PageSummaryDialog(
                items = items,
                onSelect = { item ->
                    selected = WordSelection(item.word, item.selection)
                    showSummary = false
                },
                onDismiss = { showSummary = false }
            )
        }
        if (showIndexDialog || showBookmarksDialog) {
            IndexDialog(
                surahs = model.database?.surahs().orEmpty(),
                juzStartPages = model.database?.juzStartPages().orEmpty(),
                bookmarks = model.readingTracker.allBookmarks(),
                onSelectPage = { page ->
                    tab = AppTab.READER
                    scope.launch { pagerState.animateScrollToPage(page - 1) }
                },
                onDismiss = {
                    showIndexDialog = false
                    showBookmarksDialog = false
                }
            )
        }
        if (model.readingTracker.showingKhatmaCelebration) {
            val record = model.readingTracker.completedKhatmaRecord ?: model.readingTracker.activeKhatma
            KhatmaCelebrationDialog(
                record = record,
                onStartNewKhatma = {
                    model.readingTracker.showingKhatmaCelebration = false
                },
                onViewStatistics = {
                    model.readingTracker.showingKhatmaCelebration = false
                    tab = AppTab.SETTINGS
                },
            )
        }
    }
}

@Composable
private fun ReaderHeader(
    page: MushafPage?,
    isBookmarked: Boolean,
    bannerStatusText: String?,
    bannerStatusColor: Color?,
    onToggleBookmark: () -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .height(48.dp)
            .padding(horizontal = 16.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                page?.metadata?.surahNames?.joinToString(" · ") ?: "قراءات",
                fontWeight = FontWeight.SemiBold,
                fontSize = 16.sp,
            )
            if (bannerStatusText != null && bannerStatusColor != null) {
                Spacer(Modifier.width(8.dp))
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = bannerStatusColor.copy(alpha = 0.18f),
                ) {
                    Text(
                        bannerStatusText,
                        color = bannerStatusColor,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                    )
                }
            }
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                page?.metadata?.let { "الجزء ${it.juz}  ·  الحزب ${it.hizb}  ·  الربع ${it.rubInHizb}" } ?: "",
                color = MaterialTheme.colorScheme.primary,
                fontSize = 13.sp,
            )
            Spacer(Modifier.width(12.dp))
            IconButton(onClick = onToggleBookmark, modifier = Modifier.size(32.dp)) {
                Text(
                    text = if (isBookmarked) "★" else "☆",
                    fontSize = 18.sp,
                    color = if (isBookmarked) Color(0xFFD69C00) else MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}
