package com.shazlka.qiraat.core

data class AuthorityPill(val key: String, val name: String, val color: String, val kind: Kind) {
    enum class Kind { READER, NARRATOR, OTHER }
}

fun rollupAuthorityPills(ids: List<String>, catalog: QiraatCatalog): List<AuthorityPill> {
    val narrators = mutableMapOf<String, MutableSet<String>>()
    val readers = mutableSetOf<String>()
    val others = mutableListOf<String>()
    ids.filter { it.isNotEmpty() }.forEach { id ->
        val narrator = catalog.narrator(id)
        when {
            narrator != null -> narrators.getOrPut(narrator.readerId) { mutableSetOf() }.add(id)
            catalog.reader(id) != null -> readers += id
            id !in others -> others += id
        }
    }
    return buildList {
        catalog.readers.sortedBy { it.sortOrder }.forEach { reader ->
            val all = catalog.narrators(reader.id)
            val present = narrators[reader.id].orEmpty()
            if (reader.id in readers || all.isNotEmpty() && present.size >= all.size) {
                add(AuthorityPill(reader.id, "الإمام ${reader.nameArShort}", reader.color, AuthorityPill.Kind.READER))
            } else all.filter { it.id in present }.forEach {
                add(AuthorityPill(it.id, "الراوي ${it.nameAr}", it.color, AuthorityPill.Kind.NARRATOR))
            }
        }
        others.forEach { add(AuthorityPill(it, it, "#8a7c5c", AuthorityPill.Kind.OTHER)) }
    }
}

fun foldArabic(text: String): String = text
    .replace(Regex("[\\u064B-\\u065F\\u0670\\u0640]"), "")
    .replace(Regex("[ٱأإآ]"), "ا").replace(Regex("[\\s.،:؛-]+"), " ").trim()

fun distinctRulingText(text: String?, categoryAr: String, actions: List<String?>): String? {
    val folded = foldArabic(text.orEmpty())
    if (folded.isEmpty() || folded == foldArabic(categoryAr)) return null
    if (actions.any { a -> foldArabic(a.orEmpty()).let { it.isNotEmpty() && (folded == it || folded.contains(it) || it.contains(folded)) } }) return null
    return text?.trim()
}

fun isRedundantActionLabel(action: String?, categoryAr: String) = foldArabic(action.orEmpty()).let { it.isEmpty() || it == foldArabic(categoryAr) }

data class RulingActionGroup(val action: String, val entries: List<QiraatAttribution>)
fun groupAttribution(rows: List<QiraatAttribution>, fallback: String): List<RulingActionGroup> {
    val groups = linkedMapOf<String, MutableList<QiraatAttribution>>()
    rows.forEach { groups.getOrPut(it.action ?: fallback) { mutableListOf() }.add(it) }
    return groups.map { RulingActionGroup(it.key, it.value) }
}

object QiraatPageTint {
    const val WASH_AMOUNT = .05
    fun readerColor(filter: QiraatFilter, catalog: QiraatCatalog): QiraatColor? = when (filter) {
        QiraatFilter.All -> null
        is QiraatFilter.Reader -> catalog.reader(filter.id)?.color?.let(QiraatColor::parse)
        is QiraatFilter.Reading -> catalog.narrator(filter.id)?.color?.let(QiraatColor::parse)
    }
    fun mixed(paper: QiraatColor, tint: QiraatColor, amount: Double = WASH_AMOUNT) = QiraatColor(
        paper.red * (1 - amount) + tint.red * amount,
        paper.green * (1 - amount) + tint.green * amount,
        paper.blue * (1 - amount) + tint.blue * amount,
    )
}

object QiraatReadingForm {
    private val sukun = setOf(0x0652, 0x06E1)
    private val shortVowels = (0x064B..0x0650).toSet()
    private val hamzaLetters = setOf(0x0621, 0x0623, 0x0624, 0x0625, 0x0626)
    private val smallHamza = setOf(0x0654, 0x0655)
    private const val TATWEEL = 0x0640
    private const val SMALL_WAW = 0x06E5
    private const val DAMMA = 0x064F
    private const val MEEM = 0x0645
    private const val ROUNDED_ZERO = 0x06DF

    private fun isMark(value: Int) = value in 0x064B..0x065F || value == 0x0670 || value in 0x06D6..0x06ED && value != SMALL_WAW && value != 0x06E6
    private fun scalars(text: String) = text.codePoints().toArray().toMutableList()
    private fun string(values: List<Int>) = String(values.toIntArray(), 0, values.size)
    fun display(text: String) = string(scalars(text).filter { it != ROUNDED_ZERO })
    fun form(baseText: String, action: String, categoryCode: String, previousWord: String? = null, nextWord: String? = null): String? {
        val clean = display(baseText)
        val normalized = string(scalars(action).filter { it !in 0x064B..0x065F && it != 0x0670 && it != TATWEEL })
            .replace('أ', 'ا').replace('إ', 'ا').replace('ة', 'ه')
        val result = when {
            normalized.contains("صله ميم الجمع") || normalized.contains("ضم ميم الجمع") || normalized.contains("وصلها بواو") -> withSilat(clean)
            appliesNaql(normalized, categoryCode) -> withNaql(clean, previousWord, nextWord)
            else -> null
        }
        return result?.takeIf { it != clean }
    }
    private fun appliesNaql(action: String, code: String): Boolean {
        val continuing = action.substringBefore("وقف")
        return (continuing.contains("النقل") || continuing.contains("نقل حركه") || code == "USUL_NAQL" && continuing.contains("نقل")) &&
            !continuing.contains("ترك النقل") && !continuing.contains("بلا نقل")
    }
    private fun withSilat(text: String): String? {
        val values = scalars(text)
        var i = 0
        while (i < values.size) {
            var end = i
            while (end < values.size && values[end] != 0x20) end++
            var j = end - 1
            while (j >= i && (isMark(values[j]) || values[j] == 0x06DA)) j--
            if (j >= i && values[j] == MEEM) {
                val marks = values.subList(j + 1, end)
                if (marks.any { it == 0x0650 || it == 0x064E }) { i = end + 1; continue }
                val silent = (j + 1 until end).firstOrNull { values[it] in sukun }
                val damma = (j + 1 until end).firstOrNull { values[it] == DAMMA }
                when {
                    silent != null -> { values[silent] = DAMMA; values.add(silent + 1, SMALL_WAW) }
                    damma != null -> values.add(damma + 1, SMALL_WAW)
                    else -> { values.add(j + 1, DAMMA); values.add(j + 2, SMALL_WAW) }
                }
                return string(values)
            }
            i = end + 1
        }
        return null
    }
    private fun withNaql(text: String, previous: String?, next: String?): String? {
        val inside = withNaqlInside(text)
        if (inside != null) return inside
        return withNaqlAcross(text, previous?.let(::display), next?.let(::display))
    }
    private fun withNaqlInside(text: String): String? {
        val values = scalars(text); var i = 1
        while (i < values.size) {
            val isLetter = values[i] in hamzaLetters; val isSmall = values[i] in smallHamza
            if (!isLetter && !isSmall) { i++; continue }
            var carrier = i
            if (isSmall) { var k = i - 1; while (k > 0 && isMark(values[k])) k--; carrier = k }
            var p = carrier - 1; var sukunAt: Int? = null
            while (p >= 0 && isMark(values[p])) { if (values[p] in sukun) sukunAt = p; p-- }
            if (p < 0 || values[p] == 0x20 || sukunAt == null) { i++; continue }
            var vowel: Int? = null; var q = carrier + 1
            while (q < values.size && (isMark(values[q]) || values[q] in smallHamza)) {
                if (values[q] in shortVowels && vowel == null) vowel = values[q]
                q++
            }
            if (vowel == null) { i++; continue }
            repeat(q - carrier) { values.removeAt(carrier) }
            values[sukunAt] = vowel
            return string(values)
        }
        return null
    }
    private fun splitInitialHamza(word: String): Pair<Int, String>? {
        val values = scalars(word); var i = 0
        while (i < values.size && values[i] == 0x0671) i++
        if (i != 0 || i >= values.size || values[i] !in hamzaLetters && values[i] != 0x0622) return null
        var vowel: Int? = null; var q = i + 1
        while (q < values.size && isMark(values[q])) {
            if (values[q] in shortVowels && vowel == null && values[q] !in setOf(0x064B, 0x064C, 0x064D)) vowel = values[q]
            q++
        }
        if (values[i] == 0x0622) return 0x064E to string(listOf(0x0627) + values.drop(i + 1))
        return vowel?.let { it to string(values.drop(q)) }
    }
    private fun giveVowel(word: String, vowel: Int): String? {
        val values = scalars(word); var p = values.lastIndex; var sukunAt: Int? = null
        while (p >= 0 && (isMark(values[p]) || values[p] == 0x06DA)) { if (values[p] in sukun) sukunAt = p; p-- }
        if (p < 0 || sukunAt == null) return null
        values[sukunAt] = vowel
        return string(values)
    }
    private fun withNaqlAcross(text: String, previous: String?, next: String?): String? {
        val words = text.split(' ').filter { it.isNotEmpty() }.toMutableList()
        for (k in 0 until words.lastIndex) {
            val hamza = splitInitialHamza(words[k + 1]) ?: continue
            val moved = giveVowel(words[k], hamza.first) ?: continue
            words[k] = moved; words[k + 1] = hamza.second
            return words.joinToString(" ")
        }
        val last = words.lastOrNull() ?: return null; val first = words.firstOrNull() ?: return null
        if (next != null) splitInitialHamza(next)?.let { hamza -> giveVowel(last, hamza.first)?.let { return (words.dropLast(1) + listOf(it, hamza.second)).joinToString(" ") } }
        if (previous != null) splitInitialHamza(first)?.let { hamza -> giveVowel(previous, hamza.first)?.let { return (listOf(it, hamza.second) + words.drop(1)).joinToString(" ") } }
        return null
    }
}
