package com.shazlka.qiraat.core

data class QiraatSummaryItem(val word: MushafWord, val selection: QiraatSelection)
object QiraatPageSummary {
    fun build(page: Int, words: List<MushafWord>, data: QiraatPageData, marks: QiraatMarks, filter: QiraatFilter): List<QiraatSummaryItem> {
        if (page != data.pageNumber || page != marks.page.pageNumber) return emptyList()
        val seen = mutableSetOf<String>()
        return words.filter { it.page == page }.sortedWith(compareBy({ it.line }, { it.indexInLine })).mapNotNull { word ->
            if (marks.wordMarks(word, filter) == null) return@mapNotNull null
            val key = "${word.ayahKey}:${word.indexInAyah}"
            if (!seen.add(key)) return@mapNotNull null
            marks.selection(word.ayahKey.surah, word.ayahKey.ayah, word.indexInAyah, filter)?.let { QiraatSummaryItem(word, it) }
        }
    }
}

data class UsulPlace(val id: String, val page: Int, val surah: Int, val ayah: Int, val startToken: Int, val endAyah: Int, val endToken: Int, val baseText: String, val rulings: List<QiraatRuling>)
data class UsulCategory(val code: String, val categoryAr: String, val color: String, val places: List<UsulPlace>) { val count get() = places.size }
object UsulIndex {
    private data class Locus(val surah: Int, val ayah: Int, val start: Int, val endAyah: Int, val end: Int)
    fun build(store: QiraatStore, wordPages: Map<MushafWordCoordinate, Int>): List<UsulCategory> {
        data class Acc(var name: String, var color: String, val loci: LinkedHashMap<Locus, MutableList<QiraatRuling>> = linkedMapOf())
        val categories = linkedMapOf<String, Acc>()
        for (number in 1..MUSHAF_PAGE_COUNT) store.page(number)?.rulings?.forEach { ruling ->
            val coordinate = MushafWordCoordinate(ruling.surah, ruling.ayah, ruling.startToken)
            if (coordinate !in wordPages) return@forEach
            val acc = categories.getOrPut(ruling.category) { Acc(ruling.categoryAr, ruling.color) }
            val locus = Locus(ruling.surah, ruling.ayah, ruling.startToken, ruling.endAyah ?: ruling.ayah, ruling.endToken)
            acc.loci.getOrPut(locus) { mutableListOf() }.add(ruling)
        }
        return categories.map { (code, acc) ->
            val places = acc.loci.map { (locus, rulings) ->
                val page = wordPages.getValue(MushafWordCoordinate(locus.surah, locus.ayah, locus.start))
                UsulPlace("$code-${locus.surah}-${locus.ayah}-${locus.start}-${locus.endAyah}-${locus.end}", page,
                    locus.surah, locus.ayah, locus.start, locus.endAyah, locus.end, rulings.firstOrNull { it.baseText.isNotEmpty() }?.baseText.orEmpty(), rulings.sortedBy { it.id })
            }.sortedWith(compareBy({ it.page }, { it.surah }, { it.ayah }, { it.startToken }, { it.endAyah }, { it.endToken }))
            UsulCategory(code, acc.name, acc.color, places)
        }.sortedWith(compareByDescending<UsulCategory> { it.count }.thenBy { it.code })
    }
}

enum class QiraatSearchKind { FARSH, USUL }
data class QiraatSearchResult(val page: Int, val surah: Int, val ayah: Int, val token: Int, val displayText: String, val kinds: Set<QiraatSearchKind>, val recordCount: Int)
class QiraatSearchIndex(store: QiraatStore, wordPages: Map<MushafWordCoordinate, Int>) {
    private data class Entry(val page: Int, val surah: Int, val ayah: Int, val token: Int, val text: String, val alternatives: List<String>, val kind: QiraatSearchKind, val authorities: Set<String>, val category: String?)
    private val entries = buildList {
        for (number in 1..MUSHAF_PAGE_COUNT) store.page(number)?.let { page ->
            page.variants.forEach { v ->
                val coordinate = MushafWordCoordinate(v.surah, v.ayah, v.startToken)
                val p = wordPages[coordinate] ?: return@forEach
                val authorities = v.readingIds.flatMap { listOfNotNull(it, store.catalog.readerId(it)) }.toSet()
                add(Entry(p, v.surah, v.ayah, v.startToken, v.hafsText, listOf(v.variantText), QiraatSearchKind.FARSH, authorities, null))
            }
            page.rulings.filter { it.wordAnchored }.forEach { r ->
                val coordinate = MushafWordCoordinate(r.surah, r.ayah, r.startToken)
                val p = wordPages[coordinate] ?: return@forEach
                val ids = r.readings.map { it.readingId }.flatMap { listOfNotNull(it, store.catalog.readerId(it)) }.toSet()
                add(Entry(p, r.surah, r.ayah, r.startToken, r.baseText, emptyList(), QiraatSearchKind.USUL, ids, r.category))
            }
        }
    }
    fun word(text: String): List<QiraatSearchResult> = results(entries.filter { entry ->
        val needle = foldArabic(text)
        needle.isNotEmpty() && (listOf(entry.text) + entry.alternatives).any { foldArabic(it).contains(needle) }
    })
    fun authority(id: String) = results(entries.filter { id in it.authorities })
    fun category(code: String) = results(entries.filter { it.category == code })
    private fun results(matches: List<Entry>) = matches.groupBy { listOf(it.page, it.surah, it.ayah, it.token) }.values.map { group ->
        val first = group.firstOrNull { it.text.isNotEmpty() } ?: group.first()
        QiraatSearchResult(first.page, first.surah, first.ayah, first.token, first.text, group.map { it.kind }.toSet(), group.size)
    }.sortedWith(compareBy({ it.surah }, { it.page }, { it.ayah }, { it.token }))
}

data class QiraatComparisonLocus(val surah: Int, val ayah: Int, val startToken: Int, val endAyah: Int, val endToken: Int, val selection: QiraatSelection)
data class ComparedVoice(val authorityId: String, val name: String, val color: String, val texts: List<String>, val usul: List<String>)
object QiraatCompare {
    const val HAFS_READING_ID = "Q05-R02"
    fun loci(selection: QiraatSelection): List<QiraatComparisonLocus> {
        data class Key(val s: Int, val a: Int, val start: Int, val ea: Int, val end: Int)
        val keys = (selection.variants.map { Key(it.surah, it.ayah, it.startToken, it.ayah, it.endToken) } +
            selection.rulings.map { Key(it.surah, it.ayah, it.startToken, it.endAyah ?: it.ayah, it.endToken) }).distinct()
            .sortedWith(compareBy({ it.s }, { it.a }, { it.start }, { it.ea }, { it.end }))
        return keys.map { key -> QiraatComparisonLocus(key.s, key.a, key.start, key.ea, key.end,
            QiraatSelection(selection.variants.filter { it.surah == key.s && it.ayah == key.a && it.startToken == key.start && it.endToken == key.end && key.ea == key.a },
                selection.rulings.filter { it.surah == key.s && it.ayah == key.a && it.startToken == key.start && (it.endAyah ?: it.ayah) == key.ea && it.endToken == key.end })) }
    }
    fun voice(id: String, locus: QiraatComparisonLocus, word: MushafWord, catalog: QiraatCatalog): List<ComparedVoice> {
        val narrators = catalog.narrator(id)?.let(::listOf) ?: catalog.reader(id)?.let { catalog.narrators(it.id) }.orEmpty()
        val voices = narrators.map { narrator ->
            val variants = locus.selection.variants.filter { narrator.id in it.readingIds }
            val texts = if (variants.isEmpty()) listOf(locus.selection.variants.firstOrNull()?.hafsText ?: locus.selection.rulings.firstOrNull()?.baseText ?: word.textUthmani)
            else variants.map { it.uthmaniText ?: if (it.isPerformanceOnly) it.hafsText else it.variantText }.distinct()
            val usul = locus.selection.rulings.flatMap { ruling ->
                ruling.attribution.filter { it.authorityId == narrator.id || it.authorityId == narrator.readerId }.map { it.action ?: ruling.categoryAr }
            }.distinct()
            ComparedVoice(narrator.id, "الراوي ${narrator.nameAr}", narrator.color, texts, usul)
        }
        val reader = catalog.reader(id)
        return if (reader != null && voices.isNotEmpty() && voices.map { it.texts to it.usul }.distinct().size == 1)
            listOf(ComparedVoice(reader.id, "الإمام ${reader.nameArShort}", reader.color, voices.first().texts, voices.first().usul)) else voices
    }
    fun defaultPair(selection: QiraatSelection, catalog: QiraatCatalog): Pair<String, String>? {
        val named = selection.variants.flatMap { it.readingIds } + selection.rulings.flatMap { r -> r.attribution.map { it.authorityId } + r.readings.map { it.readingId } }
        val hafsReader = catalog.readerId(HAFS_READING_ID)
        return named.firstOrNull { it != HAFS_READING_ID && it != hafsReader && (catalog.narrator(it) != null || catalog.reader(it) != null) }?.let { HAFS_READING_ID to it }
    }
}
