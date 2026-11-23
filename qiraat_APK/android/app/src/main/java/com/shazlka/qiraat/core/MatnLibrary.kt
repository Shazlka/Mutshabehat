package com.shazlka.qiraat.core

import android.content.res.AssetManager
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import java.text.BreakIterator
import java.util.Locale

@Serializable enum class QiraatMatn { @SerialName("shatibiyyah") SHATIBIYYAH, @SerialName("durrah") DURRAH, @SerialName("tayyibah") TAYYIBAH;
    val labelAr get() = when (this) { SHATIBIYYAH -> "الشاطبية"; DURRAH -> "الدرة"; TAYYIBAH -> "طيبة النشر" }
}
@Serializable data class MatnVerse(val number: Int, val lines: List<String>, val printedPage: String? = null, val pageId: Int? = null)
@Serializable data class MatnChapter(val title: String, val farsh: Boolean, val verses: List<MatnVerse>)
@Serializable data class MatnWork(val work: QiraatMatn, val title: String, val author: String, val bookId: Int? = null, val chapters: List<MatnChapter>) { val verseCount get() = chapters.sumOf { it.verses.size } }
@Serializable private data class MatnFile(val schemaVersion: Int, val works: List<MatnWork>)
data class MatnSearchHit(val work: QiraatMatn, val chapter: String, val verse: MatnVerse)

@Serializable enum class MatnSymbolKind { @SerialName("reader") READER, @SerialName("narrator") NARRATOR, @SerialName("group") GROUP }
@Serializable enum class MatnSymbolStatus { @SerialName("extracted") EXTRACTED, @SerialName("reviewed") REVIEWED, @SerialName("verified") VERIFIED }
@Serializable data class MatnSymbolAnnotation(
    val work: QiraatMatn, val verse: Int, val line: Int, val start: Int, val end: Int, val text: String,
    val symbol: String, val kind: MatnSymbolKind, val readingIds: List<String>, val note: String = "",
    val source: String = "", val status: MatnSymbolStatus,
)
@Serializable private data class SymbolFile(val schemaVersion: Int, val annotations: List<MatnSymbolAnnotation> = emptyList())

@Serializable data class MatnSharhEntry(val text: String, val pages: List<String> = emptyList())
@Serializable data class MatnWorkSharh(val title: String, val author: String, val bookId: Int? = null, val verses: Map<String, MatnSharhEntry>)
@Serializable private data class SharhFile(val schemaVersion: Int, val commentaries: Map<String, MatnWorkSharh>)

class MatnLibrary private constructor(
    val works: List<MatnWork>,
    private val symbols: Map<String, List<MatnSymbolAnnotation>>,
    private val sharh: Map<String, MatnWorkSharh>,
) {
    val isEmpty get() = works.isEmpty()
    fun work(id: QiraatMatn) = works.firstOrNull { it.work == id }
    fun verse(work: QiraatMatn, number: Int): Pair<String, MatnVerse>? = this.work(work)?.chapters?.firstNotNullOfOrNull { chapter -> chapter.verses.firstOrNull { it.number == number }?.let { chapter.title to it } }
    fun symbols(work: QiraatMatn, verse: Int) = symbols["${work.name}:$verse"].orEmpty()
    fun sharh(work: QiraatMatn, verse: Int): Pair<MatnWorkSharh, MatnSharhEntry>? = sharh[work.serialName()]?.let { s -> s.verses[verse.toString()]?.let { s to it } }
    fun search(query: String, limit: Int = 200): List<MatnSearchHit> {
        val q = normalize(query)
        if (q.isBlank()) return emptyList()
        val number = query.map { if (it in '٠'..'٩') "٠١٢٣٤٥٦٧٨٩".indexOf(it).digitToChar() else it }.joinToString("").trim().toIntOrNull()
        return works.flatMap { work -> work.chapters.flatMap { chapter -> chapter.verses.mapNotNull { verse ->
            if (number == verse.number || normalize(verse.lines.joinToString(" ")).contains(q)) MatnSearchHit(work.work, chapter.title, verse) else null
        } } }.take(limit)
    }
    companion object {
        private val json = Json { ignoreUnknownKeys = true; coerceInputValues = true }
        fun fromAssets(assets: AssetManager, root: String = "qiraat_mutoon") = fromReader { name -> assets.open("$root/$name").bufferedReader().use { it.readText() } }
        fun fromReader(read: (String) -> String): MatnLibrary = runCatching {
            val file = json.decodeFromString<MatnFile>(read("mutoon.json")); require(file.schemaVersion == 1)
            val symbolRows = runCatching { json.parseToJsonElement(read("mutoon-symbols.json")).jsonObject["annotations"]?.jsonArray.orEmpty() }.getOrDefault(emptyList())
            val decodedSymbols = symbolRows.mapNotNull { runCatching { json.decodeFromJsonElement<MatnSymbolAnnotation>(it) }.getOrNull() }
            val validSymbols = decodedSymbols.filter { mark ->
                mark.status == MatnSymbolStatus.VERIFIED && file.works.firstOrNull { it.work == mark.work }?.chapters
                    ?.flatMap { it.verses }?.firstOrNull { it.number == mark.verse }?.lines?.getOrNull(mark.line)?.let { line ->
                        val chars = graphemes(line); mark.start >= 0 && mark.end <= chars.size && mark.start < mark.end &&
                            chars.subList(mark.start, mark.end).joinToString("") == mark.text
                    } == true
            }.groupBy { "${it.work.name}:${it.verse}" }
            val sharhFile = runCatching { json.decodeFromString<SharhFile>(read("mutoon-sharh.json")) }.getOrNull()
            MatnLibrary(file.works, validSymbols, sharhFile?.takeIf { it.schemaVersion == 1 }?.commentaries.orEmpty())
        }.getOrElse { MatnLibrary(emptyList(), emptyMap(), emptyMap()) }
        private fun normalize(text: String) = foldArabic(text).replace('ى', 'ي').replace('ة', 'ه')
        private fun graphemes(text: String): List<String> {
            val iterator = BreakIterator.getCharacterInstance(Locale.ROOT); iterator.setText(text)
            val result = mutableListOf<String>(); var start = iterator.first(); var end = iterator.next()
            while (end != BreakIterator.DONE) { result += text.substring(start, end); start = end; end = iterator.next() }
            return result
        }
        private fun QiraatMatn.serialName() = when (this) { QiraatMatn.SHATIBIYYAH -> "shatibiyyah"; QiraatMatn.DURRAH -> "durrah"; QiraatMatn.TAYYIBAH -> "tayyibah" }
    }
}

@Serializable data class QiraatReference(
    val variantId: String? = null, val variantKey: String, val work: QiraatMatn, val verse: Int? = null,
    val lines: List<String>, val symbolText: String? = null, val side: String, val readingIds: List<String>,
    val printedPage: String? = null, val sourceBookId: Int? = null, val sourceUrl: String? = null,
    val status: String, val note: String? = null,
)
@Serializable private data class ReferenceFile(val schemaVersion: Int, val entries: List<QiraatReference>)
class QiraatReferenceStore private constructor(private val entries: List<QiraatReference>) {
    fun references(variant: QiraatVariant) = entries.filter { it.variantId == variant.id || it.variantKey == key(variant) }
    val count get() = entries.size
    companion object {
        fun key(variant: QiraatVariant) = "${variant.surah}:${variant.ayah}:${variant.startToken}-${variant.endToken}:${variant.variantText}"
        fun fromAssets(assets: AssetManager, root: String = "qiraat_references") = fromReader { name -> assets.open("$root/$name").bufferedReader().use { it.readText() } }
        fun fromReader(read: (String) -> String) = runCatching {
            val json = Json { ignoreUnknownKeys = true; coerceInputValues = true }
            val file = json.decodeFromString<ReferenceFile>(read("references.json"))
            QiraatReferenceStore(file.entries.takeIf { file.schemaVersion == 1 }.orEmpty())
        }.getOrElse { QiraatReferenceStore(emptyList()) }
    }
}
