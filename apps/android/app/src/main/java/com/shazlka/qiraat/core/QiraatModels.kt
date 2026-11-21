package com.shazlka.qiraat.core

import kotlinx.serialization.Serializable

@Serializable
data class QiraatAttribution(
    val authorityId: String,
    val action: String? = null,
    val condition: String? = null,
    val wajhOrder: Int? = null,
    val wajhNote: String? = null,
)

@Serializable
data class QiraatRulingReading(val readingId: String, val action: String = "", val isDefault: Boolean = true)

@Serializable
data class QiraatVariant(
    val id: String,
    val surah: Int,
    val ayah: Int,
    val startToken: Int,
    val endToken: Int = startToken,
    val operation: String? = null,
    val hafsText: String = "",
    val variantText: String = hafsText,
    val uthmaniText: String? = null,
    val description: String? = null,
    val performanceNote: String? = null,
    val differenceType: String? = null,
    val verificationStatus: String = "REVIEWED",
    val readingIds: List<String> = emptyList(),
    val notes: String? = null,
    val attribution: List<QiraatAttribution> = emptyList(),
) {
    val isPerformanceOnly get() = variantText == hafsText
    val mentionsAlternate get() = listOf(description, performanceNote, notes).any { it?.contains("بخلف") == true }
    val alternateAuthorityIds get() = attribution.filter { row ->
        listOf(row.action, row.condition, row.wajhNote).any { it?.contains("بخلف") == true }
    }.map { it.authorityId }
}

@Serializable
data class QiraatRuling(
    val id: String,
    val category: String = "OTHER",
    val categoryAr: String = category,
    val color: String = "#64748B",
    val wordAnchored: Boolean = true,
    val surah: Int,
    val ayah: Int,
    val startToken: Int,
    val endToken: Int = startToken,
    val endAyah: Int? = null,
    val baseText: String = "",
    val verificationStatus: String = "REVIEWED",
    val hasAlternate: Boolean = false,
    val attribution: List<QiraatAttribution> = emptyList(),
    val readings: List<QiraatRulingReading> = emptyList(),
    val text: String? = null,
    val subCategory: String? = null,
    val condition: String? = null,
    val countSchools: List<String>? = null,
    val notes: String? = null,
    val sourceNotes: List<String>? = null,
) {
    fun touches(s: Int, a: Int, token: Int): Boolean {
        if (s != surah) return false
        val last = endAyah ?: ayah
        if (last < ayah || a !in ayah..last) return false
        return when {
            ayah == last -> token in startToken..endToken
            a == ayah -> token >= startToken
            a == last -> token <= endToken
            else -> true
        }
    }
}

@Serializable
data class QiraatPageRule(
    val id: String,
    val category: String? = null,
    val text: String? = null,
    val reading: String? = null,
    val attributionLabel: String? = null,
    val options: List<String>? = null,
    val readingIds: List<String>? = null,
    val notes: String? = null,
)

@Serializable
data class QiraatPageData(
    val pageNumber: Int,
    val variants: List<QiraatVariant> = emptyList(),
    val rulings: List<QiraatRuling> = emptyList(),
    val rules: List<QiraatPageRule> = emptyList(),
)

@Serializable
data class QiraatCatalog(
    val schemaVersion: Int,
    val source: String,
    val sourceUrl: String? = null,
    val fetchedAt: String,
    val pageCount: Int,
    val readers: List<Reader>,
    val narrators: List<Narrator>,
    val multiReaderColor: String,
    val performanceColor: String,
    val unresolvedColor: String,
) {
    @Serializable data class Reader(val id: String, val nameAr: String, val nameArShort: String, val color: String, val sortOrder: Int)
    @Serializable data class Narrator(val id: String, val readerId: String, val nameAr: String, val color: String, val sortOrder: Int)
    fun reader(id: String) = readers.firstOrNull { it.id == id }
    fun narrator(id: String) = narrators.firstOrNull { it.id == id }
    fun readerId(readingId: String) = narrator(readingId)?.readerId
    fun narrators(readerId: String) = narrators.filter { it.readerId == readerId }.sortedBy { it.sortOrder }
}

data class QiraatColor(val red: Double, val green: Double, val blue: Double) {
    fun toArgb(alpha: Int = 255): Int = (alpha shl 24) or ((red * 255).toInt() shl 16) or
        ((green * 255).toInt() shl 8) or (blue * 255).toInt()
    companion object {
        fun parse(hex: String): QiraatColor? {
            val digits = hex.removePrefix("#")
            val value = digits.takeIf { it.length == 6 }?.toIntOrNull(16) ?: return null
            return QiraatColor(((value shr 16) and 255) / 255.0, ((value shr 8) and 255) / 255.0, (value and 255) / 255.0)
        }
    }
}

sealed interface QiraatFilter {
    data object All : QiraatFilter
    data class Reader(val id: String) : QiraatFilter
    data class Reading(val id: String) : QiraatFilter

    fun storageValue() = when (this) { All -> "all"; is Reader -> "reader:$id"; is Reading -> "reading:$id" }
    companion object {
        fun fromStorage(value: String): QiraatFilter? = when {
            value == "all" -> All
            value.startsWith("reader:") && value.length > 7 -> Reader(value.substringAfter(':'))
            value.startsWith("reading:") && value.length > 8 -> Reading(value.substringAfter(':'))
            else -> null
        }
    }
}

data class QiraatSelection(val variants: List<QiraatVariant> = emptyList(), val rulings: List<QiraatRuling> = emptyList())

fun differenceTypeLabelAr(type: String?) = when (type) {
    "HARAKAH" -> "تشكيل"; "LETTER" -> "إبدال حرف"; "ADDITION" -> "زيادة حرف أو كلمة"
    "OMISSION" -> "حذف حرف أو كلمة"; "MADD" -> "مد"; "HAMZ" -> "همز"; "IMALAH" -> "إمالة"
    "IDGHAM" -> "إدغام"; "WAQF" -> "وقف"; "NAQL" -> "نقل"; "SILAH" -> "صلة"
    "ORTHOGRAPHY" -> "خلاف في الرسم"; "WORD_FORM", "REORDER" -> "تقديم وتأخير"
    "WORD_CHANGE" -> "اختلاف كلمة"; "SAKT" -> "سكت"; else -> "غير مصنَّف"
}
