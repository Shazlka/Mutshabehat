package com.shazlka.qiraat.core

import android.content.res.AssetManager
import kotlinx.serialization.json.Json
import java.io.Closeable
import java.util.LinkedHashMap

data class QiraatUsulCategory(val code: String, val nameAr: String, val color: String)

/** Offline loader for the same catalog/page JSON snapshot used by iOS. */
class QiraatStore private constructor(
    private val readText: (String) -> String,
    capacity: Int = 16,
) : Closeable {
    private val json = Json { ignoreUnknownKeys = true; coerceInputValues = true }
    val catalog: QiraatCatalog = json.decodeFromString(readText("catalog.json"))
    private val pages = object : LinkedHashMap<Int, QiraatPageData>(capacity, .75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<Int, QiraatPageData>?) = size > capacity
    }
    @Volatile var hidesUsul = false
    @Volatile var hiddenUsulCategories: Set<String> = emptySet()

    @Synchronized
    fun page(number: Int): QiraatPageData? {
        if (number !in 1..MUSHAF_PAGE_COUNT) return null
        val raw = pages[number] ?: runCatching {
            json.decodeFromString<QiraatPageData>(readText("page-%03d.json".format(number)))
        }.getOrNull()?.also { if (it.pageNumber == number) pages[number] = it } ?: return null
        val hidden = hiddenUsulCategories
        if (!hidesUsul && hidden.isEmpty()) return raw
        return raw.copy(rulings = if (hidesUsul) emptyList() else raw.rulings.filterNot { it.category in hidden })
    }

    fun usulCategories(): List<QiraatUsulCategory> {
        val seen = linkedMapOf<String, QiraatUsulCategory>()
        for (number in 1..MUSHAF_PAGE_COUNT) page(number)?.rulings?.filter { it.wordAnchored }?.forEach {
            seen.putIfAbsent(it.category, QiraatUsulCategory(it.category, it.categoryAr, it.color))
        }
        return seen.values.toList()
    }

    override fun close() = synchronized(this) { pages.clear() }

    companion object {
        fun fromAssets(assets: AssetManager, root: String = "qiraat") = QiraatStore(
            readText = { name -> assets.open("$root/$name").bufferedReader().use { it.readText() } },
        )
        fun fromReader(reader: (String) -> String, capacity: Int = 16) = QiraatStore(reader, capacity)
    }
}

class QiraatPreferences(private val preferences: android.content.SharedPreferences) {
    var enabled: Boolean
        get() = preferences.getBoolean("qiraat.enabled", true)
        set(value) { preferences.edit().putBoolean("qiraat.enabled", value).apply() }
    var filter: QiraatFilter
        get() = QiraatFilter.fromStorage(preferences.getString("qiraat.filter", "all") ?: "all") ?: QiraatFilter.All
        set(value) { preferences.edit().putString("qiraat.filter", value.storageValue()).apply() }
    var hidesUsul: Boolean
        get() = preferences.getBoolean("qiraat.farsh-only", false)
        set(value) { preferences.edit().putBoolean("qiraat.farsh-only", value).apply() }
    var hiddenCategories: Set<String>
        get() = preferences.getStringSet("qiraat.hidden-usul", emptySet())?.toSet().orEmpty()
        set(value) { preferences.edit().putStringSet("qiraat.hidden-usul", value).apply() }
}
