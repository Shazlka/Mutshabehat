package com.shazlka.qiraat.core

sealed interface VariantStyle {
    data object Unresolved : VariantStyle
    data object Performance : VariantStyle
    data class Single(val color: String) : VariantStyle
    data class MultiReader(val colors: List<String>) : VariantStyle
}
data class VariantMarker(val style: VariantStyle, val variants: List<QiraatVariant>)
data class RulingMarker(val color: String, val rulings: List<QiraatRuling>, val multiple: Boolean, val hasAlternate: Boolean)
data class ImalahTaqlilMarker(val color: String, val filled: Boolean)
sealed interface QiraatUnderline { data class Solid(val color: String) : QiraatUnderline; data class Segments(val colors: List<String>) : QiraatUnderline }
data class WordMarks(
    val textColor: String,
    val underline: QiraatUnderline? = null,
    val dottedUnderlineColor: String? = null,
    val alternateUnderline: QiraatUnderline? = null,
    val familyDotColor: String? = null,
    val imalahDot: ImalahTaqlilMarker? = null,
) { val dottedUnderline get() = alternateUnderline ?: dottedUnderlineColor?.let(QiraatUnderline::Solid) }

/** Direct port of QiraatMarks.swift and the web qiraatWordMarker rules. */
class QiraatMarks(val catalog: QiraatCatalog, val page: QiraatPageData) {
    private fun key(s: Int, a: Int) = s * 1000 + a
    private val variantsByAyah = page.variants.groupBy { key(it.surah, it.ayah) }
    private val rulingsByAyah = buildMap<Int, MutableList<QiraatRuling>> {
        page.rulings.filter { it.wordAnchored }.forEach { ruling ->
            val last = maxOf(ruling.endAyah ?: ruling.ayah, ruling.ayah).coerceAtMost(ruling.ayah + 300)
            for (ayah in ruling.ayah..last) getOrPut(key(ruling.surah, ayah)) { mutableListOf() }.add(ruling)
        }
    }

    fun variants(surah: Int, ayah: Int, token: Int) = variantsByAyah[key(surah, ayah)].orEmpty()
        .filter { token in it.startToken..it.endToken }

    fun matches(variant: QiraatVariant, filter: QiraatFilter) = when (filter) {
        QiraatFilter.All -> true
        is QiraatFilter.Reader -> variant.readingIds.any { catalog.readerId(it) == filter.id }
        is QiraatFilter.Reading -> filter.id in variant.readingIds
    }

    fun matches(ruling: QiraatRuling, filter: QiraatFilter) = when (filter) {
        QiraatFilter.All -> true
        is QiraatFilter.Reader -> ruling.readings.any { catalog.readerId(it.readingId) == filter.id }
        is QiraatFilter.Reading -> ruling.readings.any { it.readingId == filter.id }
    }

    fun variantMarker(surah: Int, ayah: Int, token: Int, filter: QiraatFilter): VariantMarker? {
        val filtered = variants(surah, ayah, token).filter { matches(it, filter) }
        if (filtered.isEmpty()) return null
        val known = filtered.flatMap { it.readingIds }.distinct().filter { catalog.narrator(it) != null }
        if (known.isEmpty()) return VariantMarker(VariantStyle.Unresolved, filtered)
        if (filtered.all { it.isPerformanceOnly }) return VariantMarker(VariantStyle.Performance, filtered)
        val scoped = when (filter) {
            QiraatFilter.All -> known
            is QiraatFilter.Reader -> known.filter { catalog.readerId(it) == filter.id }
            is QiraatFilter.Reading -> known.filter { it == filter.id }
        }
        return attributionStyle(scoped)?.let { VariantMarker(it, filtered) }
    }

    private fun attributionStyle(readingIds: List<String>): VariantStyle? {
        val narrators = readingIds.mapNotNull(catalog::narrator)
        val readerIds = narrators.map { it.readerId }.distinct()
        val first = readerIds.firstOrNull() ?: return null
        if (readerIds.size == 1) {
            return if (narrators.size >= catalog.narrators(first).size) VariantStyle.Single(catalog.reader(first)!!.color)
            else VariantStyle.Single(narrators.first().color)
        }
        return VariantStyle.MultiReader(catalog.readers.sortedBy { it.sortOrder }.filter { it.id in readerIds }.map { it.color })
    }

    fun textColor(marker: VariantMarker) = when (val style = marker.style) {
        VariantStyle.Unresolved -> catalog.unresolvedColor
        VariantStyle.Performance -> catalog.performanceColor
        is VariantStyle.Single -> style.color
        is VariantStyle.MultiReader -> catalog.multiReaderColor
    }

    private fun alternateUnderline(marker: VariantMarker, filter: QiraatFilter): QiraatUnderline? {
        val ids = marker.variants.flatMap { variant ->
            val rowIds = variant.alternateAuthorityIds.flatMap { id ->
                if (catalog.reader(id) != null) catalog.narrators(id).map { it.id } else listOf(id)
            }.filter { it in variant.readingIds }
            if (rowIds.isNotEmpty()) rowIds else if (variant.mentionsAlternate || variant.alternateAuthorityIds.isNotEmpty()) variant.readingIds else emptyList()
        }.distinct().filter { catalog.narrator(it) != null }
        val scoped = when (filter) {
            QiraatFilter.All -> ids
            is QiraatFilter.Reader -> ids.filter { catalog.readerId(it) == filter.id }
            is QiraatFilter.Reading -> ids.filter { it == filter.id }
        }
        return when (val style = attributionStyle(scoped)) {
            is VariantStyle.Single -> QiraatUnderline.Solid(style.color)
            is VariantStyle.MultiReader -> QiraatUnderline.Segments(style.colors)
            else -> null
        }
    }

    fun rulingMarker(surah: Int, ayah: Int, token: Int, filter: QiraatFilter): RulingMarker? {
        val matched = rulingsByAyah[key(surah, ayah)].orEmpty().filter { it.touches(surah, ayah, token) && matches(it, filter) }
        val first = matched.firstOrNull() ?: return null
        val alternate = matched.any { ruling ->
            ruling.hasAlternate && when (filter) {
                QiraatFilter.All -> true
                is QiraatFilter.Reader -> ruling.readings.any { catalog.readerId(it.readingId) == filter.id && !it.isDefault } ||
                    ruling.attribution.any { it.authorityId == filter.id && it.condition?.contains("بخلف") == true }
                is QiraatFilter.Reading -> ruling.readings.any { it.readingId == filter.id && !it.isDefault }
            }
        }
        return RulingMarker(first.color, matched, matched.map { it.color }.distinct().size > 1, alternate)
    }

    fun imalahTaqlilMarker(surah: Int, ayah: Int, token: Int, filter: QiraatFilter): ImalahTaqlilMarker? {
        val matched = rulingsByAyah[key(surah, ayah)].orEmpty().filter {
            it.category == "IMALAH_TAQLIL" && it.touches(surah, ayah, token) && matches(it, filter)
        }
        val first = matched.firstOrNull() ?: return null
        val actions = matched.flatMap { it.readings }.map { it.action }
        val imalah = actions.any { "إمالة" in it }
        if (!imalah && actions.none { "تقليل" in it }) return null
        return ImalahTaqlilMarker(first.color, imalah)
    }

    fun wordMarks(word: MushafWord, filter: QiraatFilter): WordMarks? = if (word.charType != CharType.WORD) null else
        wordMarks(word.ayahKey.surah, word.ayahKey.ayah, word.indexInAyah, filter)

    fun wordMarks(surah: Int, ayah: Int, token: Int, filter: QiraatFilter): WordMarks? {
        val variant = variantMarker(surah, ayah, token, filter)
        val ruling = rulingMarker(surah, ayah, token, filter)
        if (variant == null && ruling == null) return null
        val variantColor = variant?.let(::textColor)
        val underline = variant?.let {
            if (it.style is VariantStyle.MultiReader) QiraatUnderline.Segments(it.style.colors) else QiraatUnderline.Solid(variantColor!!)
        }
        return WordMarks(
            textColor = variantColor ?: ruling!!.color,
            underline = underline,
            dottedUnderlineColor = ruling?.takeIf { it.hasAlternate }?.color,
            alternateUnderline = variant?.let { alternateUnderline(it, filter) },
            familyDotColor = ruling?.takeIf { it.multiple }?.color,
            imalahDot = imalahTaqlilMarker(surah, ayah, token, filter),
        )
    }

    fun selection(surah: Int, ayah: Int, token: Int, filter: QiraatFilter): QiraatSelection? {
        val variants = variants(surah, ayah, token).filter { matches(it, filter) }
        val rulings = rulingMarker(surah, ayah, token, filter)?.rulings.orEmpty()
        return if (variants.isEmpty() && rulings.isEmpty()) null else QiraatSelection(variants, rulings)
    }
}
