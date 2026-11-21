package com.shazlka.qiraat.reader

import android.graphics.Color as AndroidColor
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items as gridItems
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shazlka.qiraat.mutshabehat.*
import com.shazlka.qiraat.search.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.UUID

enum class AppTab(val title: String, val glyph: String) {
    READER("المصحف", "۞"), MUTSHABEHAT("المتشابهات", "م"), SEARCH("البحث", "⌕"), QIRAAT("القراءات", "ق")
}

@Composable
fun FooterNavigation(selected: AppTab, onSelect: (AppTab) -> Unit) {
    NavigationBar(tonalElevation = 7.dp) {
        AppTab.entries.forEach { tab -> NavigationBarItem(
            selected = selected == tab, onClick = { onSelect(tab) },
            icon = { Text(tab.glyph, fontSize = 20.sp, fontWeight = FontWeight.Bold) }, label = { Text(tab.title) },
        ) }
    }
}

@Composable
fun MutshabehatLibraryScreen(model: ReaderViewModel, onOpenAyah: (Int, Set<String>) -> Unit) {
    var groups by remember { mutableStateOf(emptyList<PersonalGroup>()) }
    var query by remember { mutableStateOf("") }
    var magazine by remember { mutableStateOf(true) }
    var selected by remember { mutableStateOf<PersonalGroup?>(null) }
    var editing by remember { mutableStateOf<PersonalGroup?>(null) }
    var creating by remember { mutableStateOf(false) }
    var revision by remember { mutableIntStateOf(0) }
    LaunchedEffect(query, revision) { groups = withContext(Dispatchers.IO) { model.mutshabehatStore.groups(query) } }

    if (editing != null || creating) {
        GroupEditorScreen(model, editing, onCancel = { editing = null; creating = false }, onSaved = { editing = null; creating = false; revision++ }, onDeleted = { editing = null; selected = null; revision++ })
        return
    }
    selected?.let { group -> GroupDetailScreen(model, group, onBack = { selected = null }, onEdit = { editing = group }, onOpenAyah = onOpenAyah); return }

    Column(Modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("المتشابهات", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Spacer(Modifier.weight(1f))
            TextButton(onClick = { magazine = !magazine }) { Text(if (magazine) "قائمة" else "مجلة") }
            Button(onClick = { creating = true }) { Text("مجموعة جديدة") }
        }
        OutlinedTextField(query, { query = it }, Modifier.fillMaxWidth().padding(horizontal = 12.dp), singleLine = true, label = { Text("ابحث في المجموعات والآيات") })
        Text("${groups.size} مجموعة", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(12.dp))
        if (magazine) LazyVerticalGrid(GridCells.Adaptive(170.dp), Modifier.fillMaxSize(), contentPadding = PaddingValues(10.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            gridItems(groups, key = { it.id }) { group -> GroupCard(group, true) { selected = group } }
        } else LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(10.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(groups, key = { it.id }) { group -> GroupCard(group, false) { selected = group } }
        }
    }
}

@Composable private fun GroupCard(group: PersonalGroup, magazine: Boolean, open: () -> Unit) {
    val color = safeColor(group.color)
    ElevatedCard(Modifier.fillMaxWidth().then(if (magazine) Modifier.heightIn(min = 145.dp) else Modifier).clickable(onClick = open)) {
        Column(Modifier.fillMaxWidth().padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(12.dp).background(color, RoundedCornerShape(50)))
                Spacer(Modifier.width(8.dp)); Text(group.title.ifBlank { "مجموعة بلا عنوان" }, fontWeight = FontWeight.Bold, maxLines = 2)
                Spacer(Modifier.weight(1f)); if (group.favorite) Text("★", color = Color(0xFFD69C00))
            }
            Spacer(Modifier.height(10.dp))
            group.verses.take(if (magazine) 3 else 1).forEach { verse -> Text("${verse.surah} ${verse.ayah}  ${verse.text}", maxLines = 2, fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            Spacer(Modifier.weight(1f)); Text("${group.verses.size} آيات", fontSize = 12.sp, color = color)
        }
    }
}

@Composable private fun GroupDetailScreen(model: ReaderViewModel, group: PersonalGroup, onBack: () -> Unit, onEdit: () -> Unit, onOpenAyah: (Int, Set<String>) -> Unit) {
    val scope = rememberCoroutineScope()
    Column(Modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = onBack) { Text("رجوع") }; Text(group.title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f)); Button(onClick = onEdit) { Text("تعديل") }
        }
        LazyColumn(contentPadding = PaddingValues(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            group.note?.takeIf(String::isNotBlank)?.let { item { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant) } }
            items(group.verses, key = { it.id }) { verse ->
                ElevatedCard(Modifier.fillMaxWidth().clickable {
                    advancedSurahMetadata.values.firstOrNull { it.name == verse.surah }?.let { metadata -> scope.launch { model.pageOf(metadata.number, verse.ayah)?.let { onOpenAyah(it, emptySet()) } } }
                }) { Column(Modifier.padding(16.dp)) {
                    Text(verse.label ?: "${verse.surah} · ${verse.ayah}", color = safeColor(group.color), fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(8.dp)); ColoredParts(verse.parts)
                } }
            }
        }
    }
}

@Composable private fun ColoredParts(parts: List<PersonalPart>) {
    Text(buildAnnotatedString {
        parts.sortedBy { it.sortOrder }.forEachIndexed { index, part ->
            if (index > 0) append(" ")
            val color = Color(partColors[part.type] ?: partColors.getValue("normal"))
            pushStyle(SpanStyle(color = color, fontWeight = if (part.type == "normal") FontWeight.Normal else FontWeight.Bold)); append(part.text); pop()
        }
    }, fontSize = 20.sp, lineHeight = 34.sp)
}

private data class DraftVerse(val id: String = UUID.randomUUID().toString(), val surah: String = "", val ayah: String = "1", val text: String = "", val parts: List<PersonalPart> = emptyList())

@Composable private fun GroupEditorScreen(model: ReaderViewModel, original: PersonalGroup?, onCancel: () -> Unit, onSaved: () -> Unit, onDeleted: () -> Unit) {
    val scope = rememberCoroutineScope()
    var title by remember { mutableStateOf(original?.title.orEmpty()) }
    var color by remember { mutableStateOf(original?.color ?: "#55b94f") }
    var note by remember { mutableStateOf(original?.note.orEmpty()) }
    var verses by remember { mutableStateOf(original?.verses?.map { DraftVerse(it.id, it.surah, "${it.ayah}", it.text, it.parts) } ?: listOf(DraftVerse())) }
    var error by remember { mutableStateOf<String?>(null) }
    fun save() {
        if (title.isBlank() || verses.none { it.text.isNotBlank() }) { error = "أدخل عنواناً وآية واحدة على الأقل"; return }
        val id = original?.id ?: UUID.randomUUID().toString()
        val stored = verses.filter { it.text.isNotBlank() }.mapIndexed { index, draft -> PersonalVerse(
            draft.id, id, draft.surah, draft.ayah.toIntOrNull() ?: 1, "${draft.surah} ${draft.ayah}", index,
            draft.parts.ifEmpty { listOf(PersonalPart(type = "normal", text = draft.text)) },
        ) }
        scope.launch { withContext(Dispatchers.IO) { model.mutshabehatStore.save(PersonalGroup(id, title, color, original?.status ?: "draft", original?.favorite ?: false, original?.completed ?: false, note, original?.unote, original?.createdAt, verses = stored)) }; onSaved() }
    }
    Column(Modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) { TextButton(onClick = onCancel) { Text("إلغاء") }; Text(if (original == null) "مجموعة جديدة" else "تعديل المجموعة", style = MaterialTheme.typography.titleLarge, modifier = Modifier.weight(1f)); Button(onClick = ::save) { Text("حفظ") } }
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            item { OutlinedTextField(title, { title = it }, Modifier.fillMaxWidth(), label = { Text("العنوان") }); OutlinedTextField(color, { color = it }, Modifier.fillMaxWidth(), label = { Text("اللون المميّز") }); OutlinedTextField(note, { note = it }, Modifier.fillMaxWidth(), label = { Text("ملاحظة") }) }
            items(verses, key = { it.id }) { verse ->
                val index = verses.indexOfFirst { it.id == verse.id }
                ElevatedCard { Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("الآية ${index + 1}", fontWeight = FontWeight.Bold)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(verse.surah, { value -> verses = verses.toMutableList().also { it[index] = verse.copy(surah = value) } }, Modifier.weight(1f), label = { Text("السورة") })
                        OutlinedTextField(verse.ayah, { value -> verses = verses.toMutableList().also { it[index] = verse.copy(ayah = value.filter(Char::isDigit)) } }, Modifier.width(92.dp), label = { Text("رقم") })
                    }
                    OutlinedTextField(verse.text, { value -> verses = verses.toMutableList().also { it[index] = verse.copy(text = value, parts = listOf(PersonalPart(type = "normal", text = value))) } }, Modifier.fillMaxWidth(), label = { Text("نص الآية") }, minLines = 2)
                    Row { TextButton(onClick = {
                        val surah = advancedSurahMetadata.values.firstOrNull { it.name == verse.surah }?.number ?: return@TextButton
                        scope.launch { val text = model.ayahText(surah, verse.ayah.toIntOrNull() ?: 1); verses = verses.toMutableList().also { it[index] = verse.copy(text = text, parts = listOf(PersonalPart(type = "normal", text = text))) } }
                    }) { Text("جلب من المصحف") }; Spacer(Modifier.weight(1f)); if (verses.size > 1) TextButton(onClick = { verses = verses.filterNot { it.id == verse.id } }) { Text("حذف") } }
                } }
            }
            if (verses.size >= 2 && verses[0].text.isNotBlank() && verses[1].text.isNotBlank()) item {
                val pair = ArabicDiff.autoColorPair(verses[0].text, verses[1].text)
                Text("المقارنة الحية", fontWeight = FontWeight.Bold); ColoredParts(pair.first); ColoredParts(pair.second)
                TextButton(onClick = { verses = verses.toMutableList().also { it[0] = it[0].copy(parts = pair.first); it[1] = it[1].copy(parts = pair.second) } }) { Text("تطبيق التلوين على الآيتين") }
            }
            item { TextButton(onClick = { verses = verses + DraftVerse() }) { Text("+ إضافة آية") }; error?.let { Text(it, color = MaterialTheme.colorScheme.error) }; if (original != null) TextButton(onClick = { scope.launch { withContext(Dispatchers.IO) { model.mutshabehatStore.delete(original.id) }; onDeleted() } }) { Text("حذف هذه المجموعة نهائياً", color = MaterialTheme.colorScheme.error) } }
        }
    }
}

@Composable
fun QuranSearchScreen(model: ReaderViewModel, onResult: (AyahSearchResult) -> Unit) {
    val scope = rememberCoroutineScope(); var query by remember { mutableStateOf("") }; var mode by remember { mutableStateOf(QuranSearchMode.SMART) }; var results by remember { mutableStateOf(emptyList<AyahSearchResult>()) }; var searched by remember { mutableStateOf(false) }; var working by remember { mutableStateOf(false) }
    fun search() { if (query.isBlank()) return; working = true; scope.launch { results = model.searchQuran(query, mode); searched = true; working = false } }
    Column(Modifier.fillMaxSize()) {
        Text("البحث في القرآن", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, modifier = Modifier.padding(16.dp))
        Row(Modifier.padding(horizontal = 12.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) { QuranSearchMode.entries.forEach { item -> FilterChip(mode == item, { mode = item; if (searched) search() }, { Text(when(item) { QuranSearchMode.SMART -> "ذكي"; QuranSearchMode.EXACT -> "مطابق"; QuranSearchMode.BROAD -> "موسع" }) }) } }
        OutlinedTextField(query, { query = it }, Modifier.fillMaxWidth().padding(12.dp), singleLine = true, label = { Text("ابحث في القرآن الكريم…") }, trailingIcon = { TextButton(onClick = ::search) { Text("بحث") } }, keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search), keyboardActions = KeyboardActions(onSearch = { search() }))
        when { working -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            !searched -> SearchGuide { query = it; search() }
            results.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text("لا توجد نتائج — جرّب البحث الموسع أو راجع كتابة الكلمة") }
            else -> LazyColumn(contentPadding = PaddingValues(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) { item { Text("إجمالي الآيات في نتائج البحث: ${results.size}", color = MaterialTheme.colorScheme.onSurfaceVariant) }; items(results, key = { "${it.ayah}-${it.wordIndex}" }) { result -> ElevatedCard(Modifier.fillMaxWidth().clickable { onResult(result) }) { Column(Modifier.padding(14.dp)) { Text("${model.surahNames[result.ayah.surah]} · ${result.ayah.ayah} · ص ${result.page}", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary); Spacer(Modifier.height(6.dp)); Text(result.text, fontSize = 19.sp, lineHeight = 31.sp); Text(matchLabel(result.matchType), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) } } } }
        }
    }
}

@Composable private fun SearchGuide(select: (String) -> Unit) {
    val guides = listOf(
        Triple("البحث بالعبارة", "\"رب العالمين\"", "الكلمات بين علامات الاقتباس تُبحث كعبارة كاملة."),
        Triple("المعاملات المنطقية", "الصلاة و الزكاة", "يعرض الآيات التي تحتوي الكلمات معاً."),
        Triple("جزء من كلمة", "*نبي*", "النجمة تحل محل أي عدد من الحروف."),
        Triple("حقول البحث", "نوع_السورة:مكية و >صلاة", "اجمع الحقول مع المشتقات."),
        Triple("المجالات والنطاقات", "رقم_السورة:[1 الى 5] و الله", "استخدم نطاقاً بدل رقم واحد."),
        Triple("التشكيل الجزئي", "آية_:بَنِيَّ", "يحافظ حقل آية_ على التشكيل الجزئي."),
        Triple("خصائص الكلمة", "{ملك،اسم}", "الجذر ثم نوع الكلمة داخل الأقواس."),
        Triple("المشتقات والجذور", ">>موسى", "> للمشتقات و >> للجذر."),
        Triple("آيات السجدة", "(سجدة:نعم)", "الخمسة عشر موضعاً."),
        Triple("آية الدين", "ك_آ:[129 الى 200]", "البحث بعدد كلمات الآية."),
    ) + listOf(
        "الآية الأكثر ذكراً لاسم الجلالة (الله)" to "(ج_آ:7) و >الله",
        "أطول آية في القرآن الكريم (آية الدَّيْن)" to "(ح_آ:[400 الى 900])",
        "أطول كلمة في القرآن الكريم" to "فأسقيناكموه",
        "السور التي عدد آياتها أكثر من 200 آية" to "آ_س:[200 الى 286] و رقم_الآية:200",
        "أول آية أمرت بالسجود" to ">سجد",
        "السور التي تحتوي على سجدة واجبة (العزائم)" to "(سجدة:نعم) و نوع_السجدة:واجبة",
        "سور القرآن مرتبة حسب ترتيب النزول" to "رقم_السورة:[1 الى 114] و رقم_الآية:1",
        "السور المدنية في القرآن الكريم" to "نوع_السورة:مدنية و رقم_الآية:1",
        "آيات التوبة والاستغفار" to "(><توب) و (><غفر)",
        "أكثر الأنبياء ذكراً في القرآن الكريم (موسى عليه السلام)" to ">>موسى",
        "نداء الأب لأبنائه (بَنِيَّ / بُنَيَّ)" to "آية_:بَنِيَّ آية_:بُنَيَّ",
        "الحروف المقطعة في أوائل السور" to "الم المص الر المر كهيعص طه طسم طس يس ص حم عسق ق ن",
        "الآيات ذات الكلمة الواحدة وليست حروفاً مقطعة" to "(ك_آ:1) وليس (الم المص الر المر كهيعص طه طسم طس يس ص حم عسق ق ن)",
        "من هم الذين لا يحبهم الله" to "\"لا يحب\"",
        "آيات التحدي والإعجاز في القرآن" to "(فأتوا و *سور*) أو (بمثل و القرآن) أو (فليأتوا و بحديث) أو (فأتوا و بكتاب)",
        "الصلاة في أوائل ما نزل من القرآن" to ">>صلاة",
        "اسم حواء لم يُذكر صراحة وإنما ذُكرت كزوج آدم" to "آدم و *زوج*",
        "الذين لا خوف عليهم ولا هم يحزنون" to "خوف و يحزنون",
        "آيات اللعن والملعونين" to ">لعن",
        "الصبر على البلاء وجزاء الصابرين" to ">>صبر",
        "صفات الذين يحبهم الله" to "يحبكم >الله و يحب وليس لا",
    ).map { Triple(it.first, it.second, "مثال من دليل البحث المتقدم") }
    LazyColumn(contentPadding = PaddingValues(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { item { Text("دليل البحث المتقدم", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold) }; items(guides) { guide -> OutlinedCard(Modifier.fillMaxWidth().clickable { select(guide.second) }) { Column(Modifier.padding(12.dp)) { Text(guide.first, fontWeight = FontWeight.Bold); Text(guide.second, color = MaterialTheme.colorScheme.primary); Text(guide.third, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) } } } }
}

private fun safeColor(hex: String) = Color(runCatching { AndroidColor.parseColor(hex) }.getOrDefault(AndroidColor.GRAY))
private fun matchLabel(type: QuranSearchMatchType) = when(type) { QuranSearchMatchType.EXACT -> "مطابقة تامة"; QuranSearchMatchType.PLAIN -> "بدون تشكيل"; QuranSearchMatchType.IMLAI -> "رسم إملائي"; QuranSearchMatchType.CANONICAL -> "صيغة موحّدة"; QuranSearchMatchType.ALIAS -> "صيغة بديلة"; QuranSearchMatchType.FUZZY -> "تقريب ذكي"; QuranSearchMatchType.RASM -> "تقارب الرسم" }
