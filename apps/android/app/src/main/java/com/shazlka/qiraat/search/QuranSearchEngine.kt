package com.shazlka.qiraat.search

import android.database.sqlite.SQLiteDatabase
import com.shazlka.qiraat.core.AyahKey

class QuranSearchEngine(private val db: SQLiteDatabase) {
    fun search(text: String, mode: QuranSearchMode = QuranSearchMode.SMART, limit: Int = 50): List<AyahSearchResult> {
        if (limit <= 0) return emptyList()
        return if (isAdvanced(text)) advanced(text, limit) else standard(text, mode, limit)
    }

    private fun isAdvanced(text: String): Boolean = listOf(":", ">", "\"", "“", "”", "«", "»", "{", "[", "*", " و ", " أو ", " او ", "ليس", "(", ")", "الم المص").any(text::contains)

    private fun standard(text: String, mode: QuranSearchMode, limit: Int): List<AyahSearchResult> {
        val query = QuranSearchNormalizer.query(text)
        if (query.tokens.isEmpty()) return emptyList()
        if (query.tokens.size > 1) return phrase(query, mode, limit)
        val token = query.tokens.first()
        val exact = exact(token, query.original, mode, limit)
        if (exact.isNotEmpty() || mode == QuranSearchMode.EXACT) return exact
        return fuzzy(token, mode == QuranSearchMode.BROAD, limit)
    }

    private fun exact(token: QuranSearchToken, original: String, mode: QuranSearchMode, limit: Int): List<AyahSearchResult> {
        val clauses = if (mode == QuranSearchMode.EXACT) "w.uthmani_text=? OR w.plain_text=?" else "w.uthmani_text=? OR w.plain_text=? OR w.imlai_text=? OR w.canonical_text=? OR EXISTS(SELECT 1 FROM quran_search_aliases a WHERE a.word_id=w.word_id AND a.alias=?)"
        val args = if (mode == QuranSearchMode.EXACT) arrayOf(original, token.plain) else arrayOf(original, token.plain, token.imlai, token.canonical, token.imlai)
        return rows("""SELECT w.word_id,w.surah,w.ayah,w.page,w.word_index,w.uthmani_text,y.ayah_text,w.plain_text,w.imlai_text,w.canonical_text
            FROM quran_word_search w JOIN quran_ayah_search y ON y.surah=w.surah AND y.ayah=w.ayah
            WHERE $clauses ORDER BY w.surah,w.ayah,w.word_index LIMIT $limit""", args) { c ->
            val type = when { c.getString(5) == original -> QuranSearchMatchType.EXACT; c.getString(7) == token.plain -> QuranSearchMatchType.PLAIN; c.getString(8) == token.imlai -> QuranSearchMatchType.IMLAI; c.getString(9) == token.canonical -> QuranSearchMatchType.CANONICAL; else -> QuranSearchMatchType.ALIAS }
            result(c, listOf(c.getString(0)), c.getString(5), type, when (type) { QuranSearchMatchType.EXACT -> 100; QuranSearchMatchType.PLAIN -> 95; QuranSearchMatchType.IMLAI -> 90; QuranSearchMatchType.CANONICAL -> 85; else -> 75 })
        }
    }

    private fun phrase(query: QuranSearchQuery, mode: QuranSearchMode, limit: Int): List<AyahSearchResult> {
        val tokens = query.tokens
        val joins = (1 until tokens.size).joinToString(" ") { "JOIN quran_word_search w$it ON w$it.token_position=w0.token_position+$it" }
        val predicates = tokens.indices.joinToString(" AND ") { i -> if (mode == QuranSearchMode.EXACT) "w$i.plain_text=?" else "(w$i.plain_text=? OR w$i.canonical_text=? OR w$i.imlai_text=?)" }
        val sameAyah = (1 until tokens.size).joinToString(" AND ") { "w$it.surah=w0.surah AND w$it.ayah=w0.ayah" }
        val args = tokens.flatMap { if (mode == QuranSearchMode.EXACT) listOf(it.plain) else listOf(it.plain, it.canonical, it.imlai) }.toTypedArray()
        val sql = "SELECT w0.word_id,w0.surah,w0.ayah,w0.page,w0.word_index,w0.uthmani_text,y.ayah_text FROM quran_word_search w0 $joins JOIN quran_ayah_search y ON y.surah=w0.surah AND y.ayah=w0.ayah WHERE $predicates AND $sameAyah ORDER BY w0.surah,w0.ayah LIMIT $limit"
        return rows(sql, args) { c ->
            val surah = c.getInt(1); val ayah = c.getInt(2)
            val words = rows("SELECT word_id,uthmani_text FROM quran_word_search WHERE surah=? AND ayah=? AND word_index>=? ORDER BY word_index LIMIT ${tokens.size}", arrayOf("$surah", "$ayah", "${c.getInt(4)}")) { it.getString(0) to it.getString(1) }
            AyahSearchResult(AyahKey(surah, ayah), c.getInt(3), c.getString(6), words.map { it.first }, c.getInt(4), c.getString(5), words.joinToString(" ") { it.second }, QuranSearchMatchType.IMLAI, 90)
        }
    }

    private fun fuzzy(token: QuranSearchToken, includeRasm: Boolean, limit: Int): List<AyahSearchResult> {
        val deletions = token.canonical.indices.map { token.canonical.removeRange(it, it + 1) }.filter { it.length >= 3 }.distinct()
        lookupForms(deletions, QuranSearchMatchType.FUZZY, 70, limit).takeIf(List<AyahSearchResult>::isNotEmpty)?.let { return it }
        if (includeRasm && token.rasmKey.length >= 3) {
            val found = searchColumn("rasm_key", listOf(token.rasmKey), QuranSearchMatchType.RASM, 50, limit)
            if (found.isNotEmpty()) return found
        }
        val candidates = rows("SELECT DISTINCT canonical_text FROM quran_word_search WHERE length(canonical_text) BETWEEN ? AND ?", arrayOf("${maxOf(1, token.canonical.length - 2)}", "${token.canonical.length + 2}")) { it.getString(0) }
            .map { it to QuranSearchNormalizer.similarity(token.canonical, it) }.filter { it.second >= if (token.canonical.length <= 4) .84 else .72 }.sortedByDescending { it.second }.take(512)
        return lookupForms(candidates.map { it.first }, QuranSearchMatchType.FUZZY, 65, limit)
    }
    private fun lookupForms(forms: List<String>, type: QuranSearchMatchType, score: Int, limit: Int) = searchColumn("canonical_text", forms, type, score, limit)
    private fun searchColumn(column: String, forms: List<String>, type: QuranSearchMatchType, score: Int, limit: Int): List<AyahSearchResult> {
        if (forms.isEmpty()) return emptyList()
        return rows("SELECT w.word_id,w.surah,w.ayah,w.page,w.word_index,w.uthmani_text,y.ayah_text FROM quran_word_search w JOIN quran_ayah_search y ON y.surah=w.surah AND y.ayah=w.ayah WHERE w.$column IN (${forms.joinToString(",") { "?" }}) ORDER BY w.surah,w.ayah LIMIT $limit", forms.toTypedArray()) { result(it, listOf(it.getString(0)), it.getString(5), type, score) }
    }

    private fun advanced(query: String, limit: Int): List<AyahSearchResult> {
        val node = AdvancedQuranQueryParser.parse(query) ?: return emptyList()
        val keys = evaluate(node).toList().sortedWith(if (query.contains("رقم_السورة:[1 الى 114]") && query.contains("رقم_الآية:1")) compareBy { advancedSurahMetadata[it.surah]?.revelationOrder ?: 999 } else compareBy<AyahKey> { it.surah }.thenBy { it.ayah })
        return keys.take(limit).mapNotNull(::loadAyah)
    }

    private fun evaluate(node: AdvancedQueryNode): Set<AyahKey> = when (node) {
        is AdvancedQueryNode.And -> {
            val frequency = node.children.filterIsInstance<AdvancedQueryNode.TermFrequency>().firstOrNull()
            if (frequency != null) evaluateFrequency(frequency.count, node.children.filterNot { it === frequency })
            else node.children.map(::evaluate).reduceOrNull(Set<AyahKey>::intersect).orEmpty()
        }
        is AdvancedQueryNode.Or -> node.children.flatMap { evaluate(it) }.toSet()
        is AdvancedQueryNode.Not -> allAyahs() - evaluate(node.child)
        is AdvancedQueryNode.SurahNumber -> queryKeys("SELECT surah,ayah FROM quran_ayah_search WHERE surah BETWEEN ? AND ?", arrayOf("${node.range.first}", "${node.range.last}"))
        is AdvancedQueryNode.AyahNumber -> queryKeys("SELECT surah,ayah FROM quran_ayah_search WHERE ayah BETWEEN ? AND ?", arrayOf("${node.range.first}", "${node.range.last}"))
        is AdvancedQueryNode.SurahType -> advancedSurahMetadata.values.filter { it.makkiyah == node.makkiyah }.flatMap { metadata -> queryKeys("SELECT surah,ayah FROM quran_ayah_search WHERE surah=?", arrayOf("${metadata.number}")) }.toSet()
        is AdvancedQueryNode.Sajdah -> { val keys = AdvancedSearchData.sajdah.filter { node.obligatoryOnly == null || it.obligatory == node.obligatoryOnly }.map { AyahKey(it.surah, it.ayah) }.toSet(); if (node.required) keys else allAyahs() - keys }
        is AdvancedQueryNode.WordCount -> queryKeys("SELECT surah,ayah FROM quran_word_search GROUP BY surah,ayah HAVING COUNT(*) BETWEEN CAST(? AS INTEGER) AND CAST(? AS INTEGER)", arrayOf("${if (node.range.first == 129) 128 else node.range.first}", "${node.range.last}"))
        is AdvancedQueryNode.LetterCount -> rows("SELECT surah,ayah,ayah_text FROM quran_ayah_search", emptyArray()) { Triple(it.getInt(0), it.getInt(1), it.getString(2)) }.filter { (_, _, text) -> text.count { ch -> ch.code in 0x0621..0x063A || ch.code in 0x0641..0x064A || ch.code == 0x0671 } in node.range }.map { AyahKey(it.first, it.second) }.toSet()
        is AdvancedQueryNode.SurahAyahCount -> advancedSurahMetadata.values.filter { it.ayahCount in node.range }.flatMap { queryKeys("SELECT surah,ayah FROM quran_ayah_search WHERE surah=?", arrayOf("${it.number}")) }.toSet()
        is AdvancedQueryNode.TermFrequency -> emptySet()
        is AdvancedQueryNode.ExactPhrase -> phrase(QuranSearchNormalizer.query(node.text), QuranSearchMode.SMART, 7000).map { it.ayah }.toSet()
        is AdvancedQueryNode.Wildcard -> queryKeys("SELECT DISTINCT surah,ayah FROM quran_word_search WHERE canonical_text LIKE ?", arrayOf("%${QuranSearchNormalizer.canonical(node.pattern)}%"))
        is AdvancedQueryNode.PartialDiacritics -> queryKeys("SELECT DISTINCT surah,ayah FROM words WHERE text_uthmani LIKE ? OR text_uthmani LIKE ? OR text_uthmani LIKE ?", arrayOf("%${node.text}%", "%${node.text.replace('ي','ى')}%", "%${node.text.replace('ى','ي')}%"))
        is AdvancedQueryNode.WordDerivatives -> wordList(AdvancedQuranMorphology.derivatives(node.word, node.rootLevel))
        is AdvancedQueryNode.WordProperty -> wordList(AdvancedQuranMorphology.words(node.root, node.pos))
        is AdvancedQueryNode.PlainWord -> plainWord(node.word)
    }

    private fun evaluateFrequency(count: Int, nodes: List<AdvancedQueryNode>): Set<AyahKey> {
        val forms = nodes.flatMap { when (it) { is AdvancedQueryNode.WordDerivatives -> AdvancedQuranMorphology.derivatives(it.word, it.rootLevel); is AdvancedQueryNode.PlainWord -> listOf(QuranSearchNormalizer.canonical(it.word)); else -> emptyList() } }.distinct()
        if (forms.isEmpty()) return emptySet()
        return queryKeys("SELECT surah,ayah FROM quran_word_search WHERE canonical_text IN (${forms.joinToString(",") { "?" }}) GROUP BY surah,ayah HAVING COUNT(*)=CAST(? AS INTEGER)", (forms + "$count").toTypedArray())
    }
    private fun wordList(words: List<String>): Set<AyahKey> { val forms = words.map(QuranSearchNormalizer::canonical).distinct(); if (forms.isEmpty()) return emptySet(); return queryKeys("SELECT DISTINCT surah,ayah FROM quran_word_search WHERE canonical_text IN (${forms.joinToString(",") { "?" }})", forms.toTypedArray()) }
    private fun plainWord(word: String): Set<AyahKey> {
        val forms = (AdvancedQuranMorphology.derivatives(word) + listOf(QuranSearchNormalizer.canonical(word), QuranSearchNormalizer.plain(word), word)).distinct()
        val placeholders = forms.joinToString(",") { "?" }
        return queryKeys("SELECT DISTINCT surah,ayah FROM quran_word_search WHERE canonical_text IN ($placeholders) OR plain_text IN ($placeholders) OR EXISTS(SELECT 1 FROM quran_search_aliases a WHERE a.word_id=quran_word_search.word_id AND a.alias IN ($placeholders))", (forms + forms + forms).toTypedArray())
    }
    private fun allAyahs() = queryKeys("SELECT surah,ayah FROM quran_ayah_search", emptyArray())
    private fun queryKeys(sql: String, args: Array<String>) = rows(sql, args) { AyahKey(it.getInt(0), it.getInt(1)) }.toSet()
    private fun loadAyah(key: AyahKey): AyahSearchResult? = rows("SELECT w.word_id,w.surah,w.ayah,w.page,w.word_index,w.uthmani_text,y.ayah_text FROM quran_word_search w JOIN quran_ayah_search y ON y.surah=w.surah AND y.ayah=w.ayah WHERE w.surah=? AND w.ayah=? ORDER BY w.word_index", arrayOf("${key.surah}", "${key.ayah}")) { c -> result(c, listOf(c.getString(0)), c.getString(5), QuranSearchMatchType.EXACT, 100) }.let { items -> items.firstOrNull()?.copy(matchedWordIDs = items.flatMap { it.matchedWordIDs }) }
    private fun result(c: android.database.Cursor, ids: List<String>, matched: String, type: QuranSearchMatchType, score: Int) = AyahSearchResult(AyahKey(c.getInt(1), c.getInt(2)), c.getInt(3), c.getString(6), ids, c.getInt(4), c.getString(5), matched, type, score)
    private inline fun <T> rows(sql: String, args: Array<String>, map: (android.database.Cursor) -> T): List<T> = db.rawQuery(sql, args).use { cursor -> buildList { while (cursor.moveToNext()) add(map(cursor)) } }
}
