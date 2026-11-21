package com.shazlka.qiraat.reader

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.viewmodel.compose.viewModel
import com.shazlka.qiraat.core.MUSHAF_PAGE_COUNT
import com.shazlka.qiraat.core.MushafPage
import com.shazlka.qiraat.core.PageLayoutConstants
import com.shazlka.qiraat.core.Rect
import com.shazlka.qiraat.core.QiraatPageSummary
import kotlinx.coroutines.launch

@Composable
fun ReaderScreen(model: ReaderViewModel = viewModel()) {
    when (val state = model.state) {
        ReaderState.Loading -> LoadingReader()
        is ReaderState.Failed -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text(state.message, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(24.dp))
        }
        is ReaderState.Ready -> ReadyReader(model, state.initialPage)
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
    var tab by remember { mutableStateOf(AppTab.READER) }
    var highlightedWordIDs by remember { mutableStateOf(emptySet<String>()) }
    var currentMushafPage by remember { mutableStateOf<MushafPage?>(null) }
    LaunchedEffect(pagerState.currentPage) {
        val page = pagerState.currentPage + 1
        model.savePage(page)
        model.fontStore.prewarm(com.shazlka.qiraat.core.QcfFontStore.neighbourhood(page))
    }
    androidx.compose.runtime.CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
        Column(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
            Box(Modifier.weight(1f).fillMaxWidth()) {
                when (tab) {
                    AppTab.READER -> Column(Modifier.fillMaxSize()) {
                        var headerPage by remember { mutableStateOf<MushafPage?>(null) }
                        LaunchedEffect(pagerState.currentPage) { headerPage = model.page(pagerState.currentPage + 1) }
                        ReaderHeader(headerPage)
                        HorizontalPager(
                            state = pagerState, beyondViewportPageCount = 1,
                            modifier = Modifier.weight(1f).fillMaxWidth(), key = { it + 1 },
                        ) { index ->
                            var page by remember(index) { mutableStateOf<MushafPage?>(null) }
                            LaunchedEffect(index) { page = model.page(index + 1); if (index == pagerState.currentPage) currentMushafPage = page }
                            BoxWithConstraints(Modifier.fillMaxSize().padding(horizontal = 6.dp, vertical = 2.dp), contentAlignment = Alignment.Center) {
                                page?.let { loaded ->
                                    val density = LocalDensity.current
                                    val fitted = with(density) { PageLayoutConstants.fittedPageRect(Rect(0f, 0f, maxWidth.toPx(), maxHeight.toPx()), stretch = true) }
                                    AndroidView(factory = { context -> MushafPageCanvas(context) }, update = { view ->
                                        view.page = loaded; view.fontStore = model.fontStore; view.surahAyahCounts = model.surahAyahCounts; view.surahNames = model.surahNames
                                        view.qiraatEnabled = model.qiraatEnabled; view.qiraatFilter = model.qiraatFilter; view.qiraatMarks = model.marks(loaded.number)
                                        view.highlightedWordIDs = highlightedWordIDs
                                        view.onWordTap = { word -> view.qiraatMarks?.selection(word.ayahKey.surah, word.ayahKey.ayah, word.indexInAyah, model.qiraatFilter)?.let { selected = WordSelection(word, it) } }
                                        view.onWordLongPress = { word -> view.qiraatMarks?.selection(word.ayahKey.surah, word.ayahKey.ayah, word.indexInAyah, model.qiraatFilter)?.let { peek = WordSelection(word, it) } }
                                    }, modifier = with(density) { Modifier.size(fitted.width.toDp(), fitted.height.toDp()) })
                                } ?: CircularProgressIndicator(modifier = Modifier.size(28.dp))
                            }
                        }
                        QiraatToolbar(onHub = { tab = AppTab.QIRAAT }, onPicker = { showPicker = true }, onSummary = { showSummary = true }, onLegend = { showLegend = true }, onPreferences = { showPreferences = true })
                    }
                    AppTab.MUTSHABEHAT -> MutshabehatLibraryScreen(model) { page, ids -> highlightedWordIDs = ids; tab = AppTab.READER; scope.launch { pagerState.animateScrollToPage(page - 1) } }
                    AppTab.SEARCH -> QuranSearchScreen(model) { result -> highlightedWordIDs = result.matchedWordIDs.toSet(); tab = AppTab.READER; scope.launch { pagerState.animateScrollToPage(result.page - 1) } }
                    AppTab.QIRAAT -> QiraatHub(model, onClose = { tab = AppTab.READER }, onNavigate = { page -> tab = AppTab.READER; scope.launch { pagerState.animateScrollToPage(page - 1) } })
                }
            }
            FooterNavigation(tab) { tab = it }
        }
        selected?.let { value -> QiraatWordSheet(value, model, { selected = null }, { showCompare = value; selected = null }) }
        peek?.let { value -> QiraatPeekDialog(value, model.qiraatStore.catalog) { peek = null } }
        if (showPicker) QiraatPickerDialog(model) { showPicker = false }
        if (showPreferences) QiraatPreferencesDialog(model) { showPreferences = false }
        if (showLegend) QiraatLegendDialog(model) { showLegend = false }
        showCompare?.let { QiraatCompareDialog(it, model) { showCompare = null } }
        if (showSummary) {
            val page = currentMushafPage
            val data = page?.let { model.qiraatStore.page(it.number) }
            val marks = page?.let { model.marks(it.number) }
            val items = if (page != null && data != null && marks != null) QiraatPageSummary.build(page.number, page.lines.flatMap { it.words }, data, marks, model.qiraatFilter) else emptyList()
            PageSummaryDialog(items, { item -> selected = WordSelection(item.word, item.selection); showSummary = false }, { showSummary = false })
        }
    }
}

@Composable
private fun QiraatToolbar(onHub: () -> Unit, onPicker: () -> Unit, onSummary: () -> Unit, onLegend: () -> Unit, onPreferences: () -> Unit) {
    Surface(shadowElevation = 5.dp) { Row(Modifier.fillMaxWidth().height(56.dp), horizontalArrangement = Arrangement.SpaceEvenly, verticalAlignment = Alignment.CenterVertically) {
        TextButton(onClick = onHub) { Text("القراءات") }
        TextButton(onClick = onPicker) { Text("القارئ") }
        TextButton(onClick = onSummary) { Text("الخلاصة") }
        TextButton(onClick = onLegend) { Text("المفتاح") }
        TextButton(onClick = onPreferences) { Text("التفضيلات") }
    } }
}

@Composable
private fun ReaderHeader(page: MushafPage?) {
    Row(
        Modifier.fillMaxWidth().height(48.dp).padding(horizontal = 16.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(page?.metadata?.surahNames?.joinToString(" · ") ?: "قراءات", fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
        Text(
            page?.metadata?.let { "الجزء ${it.juz}  ·  الحزب ${it.hizb}  ·  الربع ${it.rubInHizb}" } ?: "",
            color = Color(0xFF725C36), fontSize = 13.sp,
        )
    }
}
