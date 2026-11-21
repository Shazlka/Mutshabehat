package com.shazlka.qiraat.search

sealed interface AdvancedQueryNode {
    data class And(val children: List<AdvancedQueryNode>) : AdvancedQueryNode
    data class Or(val children: List<AdvancedQueryNode>) : AdvancedQueryNode
    data class Not(val child: AdvancedQueryNode) : AdvancedQueryNode
    data class SurahNumber(val range: IntRange) : AdvancedQueryNode
    data class AyahNumber(val range: IntRange) : AdvancedQueryNode
    data class SurahType(val makkiyah: Boolean) : AdvancedQueryNode
    data class Sajdah(val required: Boolean, val obligatoryOnly: Boolean?) : AdvancedQueryNode
    data class WordCount(val range: IntRange) : AdvancedQueryNode
    data class LetterCount(val range: IntRange) : AdvancedQueryNode
    data class SurahAyahCount(val range: IntRange) : AdvancedQueryNode
    data class TermFrequency(val count: Int) : AdvancedQueryNode
    data class ExactPhrase(val text: String) : AdvancedQueryNode
    data class Wildcard(val pattern: String) : AdvancedQueryNode
    data class PartialDiacritics(val text: String) : AdvancedQueryNode
    data class WordDerivatives(val word: String, val rootLevel: Boolean) : AdvancedQueryNode
    data class WordProperty(val root: String, val pos: QuranPartOfSpeech) : AdvancedQueryNode
    data class PlainWord(val word: String) : AdvancedQueryNode
}

object AdvancedQuranQueryParser {
    private sealed interface Token {
        data object Open : Token; data object Close : Token; data object And : Token; data object Or : Token; data object Not : Token
        data class Field(val name: String, val value: String) : Token
        data class Property(val root: String, val pos: String) : Token
        data class Phrase(val text: String) : Token
        data class Wildcard(val text: String) : Token
        data class Derivative(val word: String, val root: Boolean) : Token
        data class Diacritics(val text: String) : Token
        data class Word(val text: String) : Token
    }

    fun parse(input: String): AdvancedQueryNode? {
        val clean = input.trim().replace('”', '"').replace('“', '"').replace('«', '"').replace('»', '"')
        if (clean.isEmpty()) return null
        return Parser(lex(clean)).expression()
    }

    private fun ordered(a: Int, b: Int) = minOf(a, b)..maxOf(a, b)
    private fun range(text: String): IntRange? {
        val stripped = text.removePrefix("[").removeSuffix("]").replace("إلى", "الى").replace("to", "الى").replace("..", "الى").replace("-", "الى")
        val values = stripped.split("الى").map(String::trim)
        return if (values.size == 2) values[0].toIntOrNull()?.let { a -> values[1].toIntOrNull()?.let { b -> ordered(a, b) } }
        else stripped.toIntOrNull()?.let { it..it }
    }

    private fun lex(input: String): List<Token> {
        val result = mutableListOf<Token>(); var i = 0
        while (i < input.length) {
            if (input[i].isWhitespace()) { i++; continue }
            when (input[i]) {
                '(' -> { result += Token.Open; i++ }
                ')' -> { result += Token.Close; i++ }
                '"' -> { val end = input.indexOf('"', i + 1).let { if (it < 0) input.length else it }; result += Token.Phrase(input.substring(i + 1, end).trim()); i = minOf(end + 1, input.length) }
                '{' -> { val end = input.indexOf('}', i + 1).let { if (it < 0) input.length else it }; val parts = input.substring(i + 1, end).split(',', '،').map(String::trim); result += if (parts.size >= 2) Token.Property(parts[0], parts[1]) else Token.Word(parts[0]); i = minOf(end + 1, input.length) }
                '[' -> { val end = input.indexOf(']', i + 1).let { if (it < 0) input.length - 1 else it }; result += Token.Field("رقم_الآية", input.substring(i, end + 1)); i = end + 1 }
                else -> {
                    val start = i
                    while (i < input.length && !input[i].isWhitespace() && input[i] !in "()\"{}[]") i++
                    var word = input.substring(start, i)
                    if (word.contains(":")) {
                        val field = word.substringBefore(':'); var value = word.substringAfter(':')
                        if (value.isEmpty() && i < input.length && input[i] == '[') { val end = input.indexOf(']', i).let { if (it < 0) input.length - 1 else it }; value = input.substring(i, end + 1); i = end + 1 }
                        result += if (field == "آية_") Token.Diacritics(value) else Token.Field(field, value)
                    } else result += when {
                        word == "و" || word.equals("and", true) -> Token.And
                        word in listOf("أو", "او") || word.equals("or", true) -> Token.Or
                        word in listOf("وليس", "ليس") || word.equals("not", true) -> Token.Not
                        '*' in word -> Token.Wildcard(word.replace("*", ""))
                        word.startsWith("><") || word.startsWith(">>") -> Token.Derivative(word.drop(2), true)
                        word.startsWith('>') -> Token.Derivative(word.drop(1), false)
                        else -> Token.Word(word)
                    }
                }
            }
        }
        return result
    }

    private class Parser(private val tokens: List<Token>) {
        private var current = 0
        fun expression(): AdvancedQueryNode? = parseOr()
        private fun parseOr(): AdvancedQueryNode? {
            var left = parseAnd() ?: return null
            while (peek() == Token.Or) { current++; val right = parseAnd() ?: continue; left = AdvancedQueryNode.Or((left as? AdvancedQueryNode.Or)?.children.orEmpty() + if (left is AdvancedQueryNode.Or) listOf(right) else listOf(left, right)) }
            return left
        }
        private fun parseAnd(): AdvancedQueryNode? {
            var left = parseNot() ?: return null
            while (peek() == Token.And || peek() == Token.Not || implicit(peek())) {
                val negated = peek() == Token.Not
                if (peek() == Token.And || negated) current++
                val right = (if (negated) primary()?.let(AdvancedQueryNode::Not) else parseNot()) ?: continue
                left = when {
                    !negated && ((diacritic(left) && diacritic(right)) || (muqattaat(left) && muqattaat(right))) -> AdvancedQueryNode.Or(flatOr(left) + right)
                    !negated && left is AdvancedQueryNode.And && root(right) != null && left.children.any { root(it) == root(right) } -> {
                        val targetRoot = root(right)
                        AdvancedQueryNode.And(left.children.map { child -> if (root(child) == targetRoot) AdvancedQueryNode.Or(flatOr(child) + right) else child })
                    }
                    !negated && root(left) != null && root(left) == root(right) -> AdvancedQueryNode.Or(flatOr(left) + right)
                    else -> AdvancedQueryNode.And(flatAnd(left) + right)
                }
            }
            return left
        }
        private fun parseNot() = if (peek() == Token.Not) { current++; primary()?.let(AdvancedQueryNode::Not) } else primary()
        private fun primary(): AdvancedQueryNode? {
            val token = tokens.getOrNull(current++) ?: return null
            return when (token) {
                Token.Open -> expression().also { if (peek() == Token.Close) current++ }
                is Token.Field -> field(token.name, token.value)
                is Token.Property -> QuranPartOfSpeech.from(token.pos)?.let { AdvancedQueryNode.WordProperty(token.root, it) } ?: AdvancedQueryNode.PlainWord(token.root)
                is Token.Phrase -> AdvancedQueryNode.ExactPhrase(token.text)
                is Token.Wildcard -> AdvancedQueryNode.Wildcard(token.text)
                is Token.Diacritics -> AdvancedQueryNode.PartialDiacritics(token.text)
                is Token.Derivative -> AdvancedQueryNode.WordDerivatives(token.word, token.root)
                is Token.Word -> AdvancedQueryNode.PlainWord(token.text)
                else -> null
            }
        }
        private fun field(name: String, value: String): AdvancedQueryNode? = when (name.trim()) {
            "رقم_السورة", "سورة" -> range(value)?.let(AdvancedQueryNode::SurahNumber) ?: AdvancedSearchData.surahByName(value)?.let { AdvancedQueryNode.SurahNumber(it..it) }
            "رقم_الآية", "آية", "رقم_الاية" -> range(value)?.let(AdvancedQueryNode::AyahNumber)
            "نوع_السورة" -> when { "مكي" in value -> AdvancedQueryNode.SurahType(true); "مدن" in value -> AdvancedQueryNode.SurahType(false); else -> null }
            "سجدة", "سجده" -> AdvancedQueryNode.Sajdah(value in listOf("نعم", "yes", "1"), null)
            "نوع_السجدة", "نوع_السجده" -> when { "واجب" in value -> AdvancedQueryNode.Sajdah(true, true); "مستحب" in value -> AdvancedQueryNode.Sajdah(true, false); else -> null }
            "ك_آ", "كلمات_الآية" -> range(value)?.let(AdvancedQueryNode::WordCount)
            "ح_آ", "حروف_الآية" -> range(value)?.let(AdvancedQueryNode::LetterCount)
            "آ_س", "ايات_السورة" -> range(value)?.let(AdvancedQueryNode::SurahAyahCount)
            "ج_آ", "تكرار" -> value.toIntOrNull()?.let(AdvancedQueryNode::TermFrequency)
            else -> AdvancedQueryNode.PlainWord("${name.trim()}:${value.trim()}")
        }
        private fun peek() = tokens.getOrNull(current)
        private fun implicit(token: Token?) = token is Token.Word || token is Token.Phrase || token is Token.Wildcard || token is Token.Diacritics || token is Token.Derivative || token is Token.Property || token is Token.Field || token == Token.Open
        private fun flatAnd(node: AdvancedQueryNode) = (node as? AdvancedQueryNode.And)?.children ?: listOf(node)
        private fun flatOr(node: AdvancedQueryNode) = (node as? AdvancedQueryNode.Or)?.children ?: listOf(node)
        private fun root(node: AdvancedQueryNode): String? { val word = when (node) { is AdvancedQueryNode.PlainWord -> node.word; is AdvancedQueryNode.WordDerivatives -> node.word; else -> return null }; val clean = QuranSearchNormalizer.canonical(word); return AdvancedQuranMorphology.wordEntries.firstOrNull { it.word == clean }?.root }
        private fun diacritic(node: AdvancedQueryNode): Boolean = node is AdvancedQueryNode.PartialDiacritics || node is AdvancedQueryNode.Or && node.children.all(::diacritic)
        private fun muqattaat(node: AdvancedQueryNode): Boolean = node is AdvancedQueryNode.PlainWord && node.word in AdvancedSearchData.muqattaat || node is AdvancedQueryNode.Or && node.children.all(::muqattaat)
    }
}

object AdvancedSearchData {
    data class Sajdah(val surah: Int, val ayah: Int, val obligatory: Boolean)
    val sajdah = listOf(7 to 206, 13 to 15, 16 to 50, 17 to 109, 19 to 58, 22 to 18, 22 to 77, 25 to 60, 27 to 26, 32 to 15, 38 to 24, 41 to 38, 53 to 62, 84 to 21, 96 to 19).map { Sajdah(it.first, it.second, it in setOf(32 to 15, 41 to 38, 53 to 62, 96 to 19)) }
    val muqattaat = setOf("الم", "المص", "الر", "المر", "كهيعص", "طه", "طسم", "طس", "يس", "ص", "حم", "عسق", "ق", "ن")
    private val names = listOf("الفاتحة","البقرة","آل عمران","النساء","المائدة","الأنعام","الأعراف","الأنفال","التوبة","يونس","هود","يوسف","الرعد","إبراهيم","الحجر","النحل","الإسراء","الكهف","مريم","طه","الأنبياء","الحج","المؤمنون","النور","الفرقان","الشعراء","النمل","القصص","العنكبوت","الروم","لقمان","السجدة","الأحزاب","سبإ","فاطر","يس","الصافات","ص","الزمر","غافر","فصلت","الشورى","الزخرف","الدخان","الجاثية","الأحقاف","محمد","الفتح","الحجرات","ق","الذاريات","الطور","النجم","القمر","الرحمن","الواقعة","الحديد","المجادلة","الحشر","الممتحنة","الصف","الجمعة","المنافقون","التغابن","الطلاق","التحريم","الملك","القلم","الحاقة","المعارج","نوح","الجن","المزمل","المدثر","القيامة","الإنسان","المرسلات","النبإ","النازعات","عبس","التكوير","الانفطار","المطففين","الانشقاق","البروج","الطارق","الأعلى","الغاشية","الفجر","البلد","الشمس","الليل","الضحى","الشرح","التين","العلق","القدر","البينة","الزلزلة","العاديات","القارعة","التكاثر","العصر","الهمزة","الفيل","قريش","الماعون","الكوثر","الكافرون","النصر","المسد","الإخلاص","الفلق","الناس")
    fun surahByName(value: String) = names.indexOfFirst { it == value.trim() || value.contains(it) }.takeIf { it >= 0 }?.plus(1)
}
