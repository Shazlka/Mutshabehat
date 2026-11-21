package com.shazlka.qiraat.reader

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shazlka.qiraat.core.*

data class WordSelection(val word: MushafWord, val selection: QiraatSelection)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QiraatWordSheet(value: WordSelection, model: ReaderViewModel, onDismiss: () -> Unit, onCompare: () -> Unit) {
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp).padding(bottom = 28.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(value.word.textUthmani, fontSize = 29.sp, fontWeight = FontWeight.Bold, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
            Text("سورة ${model.surahNames[value.word.ayahKey.surah]} · الآية ${value.word.ayahKey.ayah}", color = MaterialTheme.colorScheme.primary)
            value.selection.variants.forEach { VariantCard(it, model.qiraatStore.catalog, model.references.references(it)) }
            value.selection.rulings.forEach { RulingCard(it, model.qiraatStore.catalog, model.qiraatFilter) }
            if (QiraatCompare.defaultPair(value.selection, model.qiraatStore.catalog) != null) Button(onClick = onCompare, modifier = Modifier.fillMaxWidth()) { Text("مقارنة القراءات") }
        }
    }
}

@Composable
private fun VariantCard(variant: QiraatVariant, catalog: QiraatCatalog, references: List<QiraatReference>) {
    ElevatedCard(Modifier.fillMaxWidth()) { Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(if (variant.isPerformanceOnly) "وجه أداء" else differenceTypeLabelAr(variant.differenceType), color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
        Text(variant.uthmaniText ?: if (variant.isPerformanceOnly) variant.hafsText else variant.variantText, fontSize = 24.sp)
        variant.description?.let { Text(it) }; variant.performanceNote?.let { Text(it) }
        PillFlow(rollupAuthorityPills(variant.readingIds, catalog))
        if (references.isNotEmpty()) Text("الشواهد: ${references.joinToString(" · ") { "${it.work.labelAr}${it.verse?.let { v -> " $v" } ?: ""}" }}", fontSize = 12.sp, color = MaterialTheme.colorScheme.secondary)
    } }
}

@Composable
private fun RulingCard(ruling: QiraatRuling, catalog: QiraatCatalog, filter: QiraatFilter) {
    ElevatedCard(Modifier.fillMaxWidth()) { Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
        Text(ruling.categoryAr, color = hexColor(ruling.color), fontWeight = FontWeight.Bold)
        val rows = ruling.attribution.filter { row -> when (filter) {
            QiraatFilter.All -> true
            is QiraatFilter.Reader -> row.authorityId == filter.id || catalog.readerId(row.authorityId) == filter.id
            is QiraatFilter.Reading -> row.authorityId == filter.id || row.authorityId == catalog.readerId(filter.id)
        } }
        groupAttribution(rows, ruling.categoryAr).forEach { group ->
            if (!isRedundantActionLabel(group.action, ruling.categoryAr)) Text(group.action, fontWeight = FontWeight.SemiBold)
            PillFlow(rollupAuthorityPills(group.entries.map { it.authorityId }, catalog))
            group.entries.mapNotNull { it.condition }.distinct().forEach { Text(it, fontSize = 13.sp) }
        }
        distinctRulingText(ruling.text, ruling.categoryAr, rows.map { it.action })?.let { Text(it) }
        ruling.notes?.let { Text(it, fontSize = 13.sp, color = MaterialTheme.colorScheme.secondary) }
    } }
}

@Composable
private fun PillFlow(pills: List<AuthorityPill>) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) { pills.chunked(3).forEach { row -> Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        row.forEach { pill -> Surface(color = hexColor(pill.color).copy(alpha = .14f), shape = MaterialTheme.shapes.large) { Text(pill.name, color = hexColor(pill.color), fontSize = 12.sp, modifier = Modifier.padding(horizontal = 9.dp, vertical = 5.dp)) } }
    } } }
}

@Composable
fun QiraatPickerDialog(model: ReaderViewModel, onDismiss: () -> Unit) {
    AlertDialog(onDismissRequest = onDismiss, confirmButton = { TextButton(onClick = onDismiss) { Text("تم") } }, title = { Text("القارئ والرواية") }, text = {
        LazyColumn(Modifier.heightIn(max = 480.dp)) {
            item { FilterRow("القراءات العشر", model.qiraatFilter == QiraatFilter.All) { model.setFilter(QiraatFilter.All) } }
            model.qiraatStore.catalog.readers.sortedBy { it.sortOrder }.forEach { reader ->
                item { FilterRow("الإمام ${reader.nameArShort}", model.qiraatFilter == QiraatFilter.Reader(reader.id)) { model.setFilter(QiraatFilter.Reader(reader.id)) } }
                items(model.qiraatStore.catalog.narrators(reader.id)) { narrator -> FilterRow("    ${narrator.nameAr}", model.qiraatFilter == QiraatFilter.Reading(narrator.id)) { model.setFilter(QiraatFilter.Reading(narrator.id)) } }
            }
        }
    })
}

@Composable private fun FilterRow(label: String, selected: Boolean, click: () -> Unit) = Row(Modifier.fillMaxWidth().clickable(onClick = click).padding(vertical = 9.dp), verticalAlignment = Alignment.CenterVertically) { RadioButton(selected, click); Text(label) }

@Composable
fun QiraatPreferencesDialog(model: ReaderViewModel, onDismiss: () -> Unit) {
    LaunchedEffect(Unit) { model.prepareHub() }
    val installed = model.usulCategories
    AlertDialog(onDismissRequest = onDismiss, confirmButton = { TextButton(onClick = onDismiss) { Text("تم") } }, title = { Text("تفضيلات القراءات") }, text = {
        Column(Modifier.verticalScroll(rememberScrollState())) {
            SwitchRow("إظهار علامات القراءات", model.qiraatEnabled, model::updateQiraatEnabled)
            SwitchRow("فرش فقط", model.hidesUsul, model::updateHidesUsul)
            if (!model.hidesUsul && installed.isEmpty()) LinearProgressIndicator(Modifier.fillMaxWidth())
            if (!model.hidesUsul) installed.forEach { category -> SwitchRow(category.categoryAr, category.code !in model.hiddenUsulCategories) { model.setCategoryVisible(category.code, it) } }
        }
    })
}

@Composable
fun QiraatPeekDialog(value: WordSelection, catalog: QiraatCatalog, onDismiss: () -> Unit) {
    AlertDialog(onDismissRequest = onDismiss, confirmButton = { TextButton(onClick = onDismiss) { Text("إغلاق") } },
        title = { Text(value.word.textUthmani, fontSize = 27.sp) }, text = {
            Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                value.selection.variants.forEach { variant ->
                    Text(variant.uthmaniText ?: variant.variantText, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                    PillFlow(rollupAuthorityPills(variant.readingIds, catalog))
                }
                value.selection.rulings.forEach { ruling -> Text("${ruling.categoryAr}: ${ruling.attribution.firstOrNull()?.action ?: ruling.text.orEmpty()}", color = hexColor(ruling.color)) }
            }
        })
}
@Composable private fun SwitchRow(label: String, checked: Boolean, change: (Boolean) -> Unit) = Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) { Text(label, modifier = Modifier.weight(1f)); Switch(checked, change) }

@Composable
fun QiraatLegendDialog(model: ReaderViewModel, onDismiss: () -> Unit) {
    AlertDialog(onDismissRequest = onDismiss, confirmButton = { TextButton(onClick = onDismiss) { Text("تم") } }, title = { Text("مفتاح علامات القراءات") }, text = {
        Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("الخط المتصل تحت الكلمة: فرش القراءة")
            Text("الخط المنقّط: للوجه الثاني (بخلف)")
            Text("النقطة: اجتماع أكثر من باب من أصول القراءة")
            model.qiraatStore.catalog.readers.sortedBy { it.sortOrder }.forEach { Text("● ${it.nameArShort}", color = hexColor(it.color)) }
        }
    })
}

@Composable
fun QiraatCompareDialog(value: WordSelection, model: ReaderViewModel, onDismiss: () -> Unit) {
    val catalog = model.qiraatStore.catalog
    val pair = QiraatCompare.defaultPair(value.selection, catalog)
    val locus = QiraatCompare.loci(value.selection).firstOrNull()
    AlertDialog(onDismissRequest = onDismiss, confirmButton = { TextButton(onClick = onDismiss) { Text("تم") } }, title = { Text("مقارنة القراءات") }, text = {
        if (pair == null || locus == null) Text("لا تتوفر مقارنة لهذا الموضع") else Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(pair.first, pair.second).forEach { id -> Column(Modifier.weight(1f)) {
                QiraatCompare.voice(id, locus, value.word, catalog).forEach { voice ->
                    Text(voice.name, color = hexColor(voice.color), fontWeight = FontWeight.Bold)
                    voice.texts.forEach { Text(it, fontSize = 21.sp) }; voice.usul.forEach { Text(it, fontSize = 13.sp) }
                }
            } }
        }
    })
}

@Composable
fun PageSummaryDialog(items: List<QiraatSummaryItem>, onSelect: (QiraatSummaryItem) -> Unit, onDismiss: () -> Unit) {
    AlertDialog(onDismissRequest = onDismiss, confirmButton = { TextButton(onClick = onDismiss) { Text("تم") } }, title = { Text("خلاصة الصفحة") }, text = {
        if (items.isEmpty()) Text("لا توجد مواضع ظاهرة في هذه الصفحة") else LazyColumn(Modifier.heightIn(max = 500.dp)) { items(items) { item ->
            ListItem(headlineContent = { Text(item.word.textUthmani, fontSize = 20.sp) }, supportingContent = { Text("${item.selection.variants.size} فرش · ${item.selection.rulings.size} أصول") }, modifier = Modifier.clickable { onSelect(item) })
        } }
    })
}

@Composable
fun QiraatHub(model: ReaderViewModel, onClose: () -> Unit, onNavigate: (Int) -> Unit) {
    var tab by remember { mutableIntStateOf(0) }; var query by remember { mutableStateOf("") }; var matn by remember { mutableStateOf<QiraatMatn?>(null) }
    LaunchedEffect(Unit) { model.prepareHub() }
    Surface(Modifier.fillMaxSize()) { Column {
        Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) { Text("مركز القراءات", fontSize = 22.sp, fontWeight = FontWeight.Bold); TextButton(onClick = onClose) { Text("عودة للمصحف") } }
        PrimaryTabRow(tab) { listOf("الأصول", "البحث", "المتون", "المراجع").forEachIndexed { i, label -> Tab(tab == i, { tab = i }, text = { Text(label) }) } }
        when (tab) {
            0 -> if (model.usulCategories.isEmpty()) Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() } else LazyColumn { items(model.usulCategories) { category ->
                var expanded by remember(category.code) { mutableStateOf(false) }
                ListItem(headlineContent = { Text(category.categoryAr, color = hexColor(category.color)) }, trailingContent = { Text(category.count.toString()) }, modifier = Modifier.clickable { expanded = !expanded })
                if (expanded) category.places.take(200).forEach { place -> ListItem(headlineContent = { Text(place.baseText.ifEmpty { "${place.surah}:${place.ayah}" }) }, supportingContent = { Text("صفحة ${place.page} · ${place.surah}:${place.ayah}") }, modifier = Modifier.clickable { onNavigate(place.page) }) }
            } }
            1 -> Column { OutlinedTextField(query, { query = it }, label = { Text("ابحث في القراءات") }, modifier = Modifier.fillMaxWidth().padding(12.dp)); val results = remember(query, model.searchIndex) { model.searchIndex?.word(query).orEmpty() }; LazyColumn { items(results) { result -> ListItem(headlineContent = { Text(result.displayText.ifEmpty { "موضع قراءة" }) }, supportingContent = { Text("صفحة ${result.page} · ${result.surah}:${result.ayah}") }, modifier = Modifier.clickable { onNavigate(result.page) }) } } }
            2 -> if (matn == null) LazyColumn { items(QiraatMatn.entries) { work -> val loaded = model.matnLibrary.work(work); ListItem(headlineContent = { Text(work.labelAr) }, supportingContent = { Text(loaded?.let { "${it.title} · ${it.verseCount} بيت" } ?: "غير متوفر") }, modifier = Modifier.clickable(enabled = loaded != null) { matn = work }) } } else MatnViewer(model.matnLibrary, matn!!) { matn = null }
            else -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text("${model.references.count} شاهدًا مرتبطًا بمواضع الفرش\nتظهر الشواهد داخل بطاقة الكلمة.", textAlign = TextAlign.Center) }
        }
    } }
}

@Composable private fun MatnViewer(library: MatnLibrary, work: QiraatMatn, back: () -> Unit) {
    var q by remember { mutableStateOf("") }; var selected by remember { mutableStateOf<Pair<String, MatnVerse>?>(null) }
    Column { TextButton(onClick = back) { Text("رجوع") }; OutlinedTextField(q, { q = it }, label = { Text("بحث في ${work.labelAr}") }, modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp)); val verses = if (q.isBlank()) library.work(work)?.chapters?.flatMap { c -> c.verses.map { c.title to it } }.orEmpty() else library.search(q).filter { it.work == work }.map { it.chapter to it.verse }; LazyColumn { items(verses.take(500)) { item -> val (chapter, verse) = item; ListItem(headlineContent = { Text("${verse.number} · ${verse.lines.joinToString("  ◇  ")}") }, supportingContent = { Text(chapter) }, modifier = Modifier.clickable { selected = item }) } } }
    selected?.let { (chapter, verse) ->
        val marks = library.symbols(work, verse.number); val sharh = library.sharh(work, verse.number)
        AlertDialog(onDismissRequest = { selected = null }, confirmButton = { TextButton(onClick = { selected = null }) { Text("تم") } }, title = { Text("${work.labelAr} · البيت ${verse.number}") }, text = {
            Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(chapter, color = MaterialTheme.colorScheme.primary); verse.lines.forEach { Text(it, fontSize = 20.sp) }
                if (marks.isNotEmpty()) { HorizontalDivider(); Text("رموز القراء", fontWeight = FontWeight.Bold); marks.forEach { Text("${it.text} (${it.symbol}) · ${it.readingIds.joinToString("، ")}") } }
                sharh?.let { (workSharh, entry) -> HorizontalDivider(); Text(workSharh.title, fontWeight = FontWeight.Bold); Text(workSharh.author, fontSize = 12.sp); Text(entry.text); if (entry.pages.isNotEmpty()) Text("الصفحات: ${entry.pages.joinToString("، ")}", fontSize = 12.sp) }
            }
        })
    }
}

private fun hexColor(value: String) = runCatching { Color(android.graphics.Color.parseColor(value)) }.getOrDefault(Color.Gray)
