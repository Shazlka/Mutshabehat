package com.shazlka.qiraat.search

enum class QuranPartOfSpeech { NOUN, VERB, PARTICLE;
    companion object {
        fun from(text: String): QuranPartOfSpeech? = when (text.trim().lowercase()) {
            "اسم", "noun", "n" -> NOUN
            "فعل", "verb", "v" -> VERB
            "حرف", "particle", "p" -> PARTICLE
            else -> null
        }
    }
}

object AdvancedQuranMorphology {
    data class WordEntry(val word: String, val root: String, val pos: QuranPartOfSpeech)

    // Faithful data port of AdvancedQuranMorphology.swift.
    val wordEntries: List<WordEntry> = """
ملك|ملك|noun
ملكا|ملك|noun
الملك|ملك|noun
مالك|ملك|noun
مليك|ملك|noun
ملائكه|ملك|noun
الملائكه|ملك|noun
ملكوت|ملك|noun
ملك|ملك|verb
ملكت|ملك|verb
يملك|ملك|verb
يملكون|ملك|verb
تملك|ملك|verb
نملك|ملك|verb
لا يملكون|ملك|verb
قول|قول|noun
قولا|قول|noun
القول|قول|noun
اقاويل|قول|noun
قيل|قول|noun
قال|قول|verb
قالوا|قول|verb
يقول|قول|verb
يقولون|قول|verb
قل|قول|verb
قلنا|قول|verb
تقول|قول|verb
يقولوا|قول|verb
تقولون|قول|verb
سجد|سجد|verb
سجدوا|سجد|verb
يسجد|سجد|verb
يسجدون|سجد|verb
تسجدوا|سجد|verb
اسجد|سجد|verb
اسجدوا|سجد|verb
سجدا|سجد|noun
ساجد|سجد|noun
ساجدين|سجد|noun
ساجدون|سجد|noun
سجود|سجد|noun
سجودا|سجد|noun
مسجد|سجد|noun
مساجد|سجد|noun
المساجد|سجد|noun
سجده|سجد|noun
صبر|صبر|verb
صبروا|صبر|verb
يصبر|صبر|verb
اصبر|صبر|verb
اصبروا|صبر|verb
صابرو|صبر|verb
وتواصوا بالصبر|صبر|noun
صبر|صبر|noun
صبرا|صبر|noun
صابرين|صبر|noun
الصابرين|صبر|noun
صابرون|صبر|noun
الصابرون|صبر|noun
صبار|صبر|noun
صلي|صلو|verb
يصلون|صلو|verb
صل|صلو|verb
صلوا|صلو|verb
مصلي|صلو|noun
صلاه|صلو|noun
الصلاه|صلو|noun
صلوات|صلو|noun
الصلوات|صلو|noun
مصلين|صلو|noun
المصلين|صلو|noun
لعن|لعن|verb
لعنهم|لعن|verb
يلعن|لعن|verb
يلعنهم|لعن|verb
لعنا|لعن|noun
لعنه|لعن|noun
اللعنه|لعن|noun
ملعون|لعن|noun
ملعونين|لعن|noun
ملعونه|لعن|noun
تاب|توب|verb
يتوب|توب|verb
توبوا|توب|verb
تب|توب|verb
توبه|توب|noun
التوبه|توب|noun
تواب|توب|noun
التواب|توب|noun
تائبين|توب|noun
التائبون|توب|noun
غفر|غفر|verb
يغفر|غفر|verb
اغفر|غفر|verb
استغفر|غفر|verb
يستغفرون|غفر|verb
مغفره|غفر|noun
المغفره|غفر|noun
غفور|غفر|noun
الغفور|غفر|noun
غفار|غفر|noun
الغفار|غفر|noun
غافر|غفر|noun
استغفار|غفر|noun
زوج|زوج|noun
زوجك|زوج|noun
زوجه|زوج|noun
ازواج|زوج|noun
ازواجكم|زوج|noun
ازواجهم|زوج|noun
ازواجا|زوج|noun
زوجناهم|زوج|verb
زوجت|زوج|verb
يحب|حب|verb
يحبهم|حب|verb
يحبكم|حب|verb
يحبون|حب|verb
تحبون|حب|verb
احب|حب|verb
حب|حب|noun
حبه|حب|noun
محبه|حب|noun
خوف|خوف|noun
خوفا|خوف|noun
خوفهم|خوف|noun
يخاف|خوف|verb
يخافون|خوف|verb
تخف|خوف|verb
تخافوا|خوف|verb
خافوا|خوف|verb
يحزن|حزن|verb
يحزنون|حزن|verb
يحزنك|حزن|verb
تحزن|حزن|verb
تحزنوا|حزن|verb
حزن|حزن|noun
حزنا|حزن|noun
موسي|موسي|noun
بموسي|موسي|noun
لموسي|موسي|noun
موسى|موسي|noun
ادم|ادم|noun
لادم|ادم|noun
يادم|ادم|noun
ويادم|ادم|noun
اادم|ادم|noun
ءادم|ادم|noun
بني ادم|ادم|noun
الله|اله|noun
لله|اله|noun
والله|اله|noun
بالله|اله|noun
تالله|اله|noun
فالله|اله|noun
ابالله|اله|noun
اللهم|اله|noun
اله|اله|noun
الهكم|اله|noun
الهين|اله|noun
الهه|اله|noun
الهتنا|اله|noun
    """.trimIndent().lineSequence().filter(String::isNotBlank).map { line ->
        val values = line.split('|')
        WordEntry(values[0], values[1], QuranPartOfSpeech.valueOf(values[2].uppercase()))
    }.toList()

    fun derivatives(query: String, includeRootLevel: Boolean = false): List<String> {
        val clean = QuranSearchNormalizer.canonical(query).trim()
        val results = linkedSetOf(clean)
        wordEntries.forEach { entry ->
            if (entry.root == clean || entry.word == clean) {
                results += entry.word
                if (includeRootLevel) results += entry.root
            }
        }
        wordEntries.filter { it.word == clean }.map { it.root }.toSet().forEach { root ->
            wordEntries.filter { it.root == root }.forEach {
                results += it.word
                if (includeRootLevel) results += it.root
            }
        }
        if (results.size <= 1) {
            listOf("و", "ف", "ب", "ك", "ل", "ال", "وال", "فال", "بال", "ول", "فل").forEach { prefix ->
                results += prefix + clean
                if (clean.startsWith(prefix)) clean.removePrefix(prefix).takeIf { it.length >= 2 }?.let(results::add)
            }
        }
        return results.toList()
    }

    fun words(root: String, pos: QuranPartOfSpeech): List<String> {
        val clean = QuranSearchNormalizer.canonical(root).trim()
        return wordEntries.filter { it.root == clean && it.pos == pos }.map { it.word }.ifEmpty { listOf(clean) }
    }
}

