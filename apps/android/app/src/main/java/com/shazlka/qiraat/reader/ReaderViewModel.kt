package com.shazlka.qiraat.reader

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.shazlka.qiraat.core.MushafDatabase
import com.shazlka.qiraat.core.AyahKey
import com.shazlka.qiraat.core.MushafPage
import com.shazlka.qiraat.core.QcfFontStore
import com.shazlka.qiraat.core.ReadingPosition
import com.shazlka.qiraat.core.MatnLibrary
import com.shazlka.qiraat.core.QiraatFilter
import com.shazlka.qiraat.core.QiraatMarks
import com.shazlka.qiraat.core.QiraatPreferences
import com.shazlka.qiraat.core.QiraatReferenceStore
import com.shazlka.qiraat.core.QiraatSearchIndex
import com.shazlka.qiraat.core.QiraatStore
import com.shazlka.qiraat.core.UsulCategory
import com.shazlka.qiraat.core.UsulIndex
import com.shazlka.qiraat.mutshabehat.MutshabehatStore
import com.shazlka.qiraat.mutshabehat.SQLiteMutshabehatStore
import com.shazlka.qiraat.search.AyahSearchResult
import com.shazlka.qiraat.search.QuranSearchMode
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

sealed interface ReaderState {
    data object Loading : ReaderState
    data class Ready(val initialPage: Int) : ReaderState
    data class Failed(val message: String) : ReaderState
}

class ReaderViewModel(application: Application) : AndroidViewModel(application) {
    var state: ReaderState by mutableStateOf(ReaderState.Loading)
        private set
    var surahAyahCounts: Map<Int, Int> by mutableStateOf(emptyMap())
        private set
    var surahNames: Map<Int, String> by mutableStateOf(emptyMap())
        private set
    var qiraatEnabled by mutableStateOf(true)
        private set
    var qiraatFilter: QiraatFilter by mutableStateOf(QiraatFilter.All)
        private set
    var hidesUsul by mutableStateOf(false)
        private set
    var hiddenUsulCategories: Set<String> by mutableStateOf(emptySet())
        private set
    var usulCategories: List<UsulCategory> by mutableStateOf(emptyList())
        private set
    var searchIndex: QiraatSearchIndex? by mutableStateOf(null)
        private set

    val fontStore = QcfFontStore(application.assets)
    private val pageCache = object : LinkedHashMap<Int, MushafPage>(10, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<Int, MushafPage>?) = size > 10
    }
    private val preferences = application.getSharedPreferences("reader", 0)
    private val qiraatPreferences = QiraatPreferences(preferences)
    private var database: MushafDatabase? = null
    lateinit var qiraatStore: QiraatStore
        private set
    lateinit var matnLibrary: MatnLibrary
        private set
    lateinit var references: QiraatReferenceStore
        private set
    lateinit var mutshabehatStore: MutshabehatStore
        private set

    init {
        viewModelScope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    val db = MushafDatabase.open(MushafDatabase.installBundledDatabase(application))
                    val surahs = db.surahs()
                    database = db
                    surahAyahCounts = surahs.associate { it.number to it.ayahCount }
                    surahNames = surahs.associate { it.number to it.name }
                    qiraatStore = QiraatStore.fromAssets(application.assets)
                    matnLibrary = MatnLibrary.fromAssets(application.assets)
                    references = QiraatReferenceStore.fromAssets(application.assets)
                    mutshabehatStore = SQLiteMutshabehatStore.open(application)
                    qiraatEnabled = qiraatPreferences.enabled
                    qiraatFilter = qiraatPreferences.filter
                    hidesUsul = qiraatPreferences.hidesUsul
                    hiddenUsulCategories = qiraatPreferences.hiddenCategories
                    applyVisibility()
                }
            }.onSuccess {
                state = ReaderState.Ready(ReadingPosition(preferences).page)
            }.onFailure { error ->
                state = ReaderState.Failed(error.message ?: "تعذر فتح بيانات المصحف")
            }
        }
    }

    suspend fun page(number: Int): MushafPage = withContext(Dispatchers.IO) {
        synchronized(pageCache) { pageCache[number] } ?: synchronized(this@ReaderViewModel) {
            pageCache[number] ?: checkNotNull(database) { "Database is not ready" }.page(number).also {
                synchronized(pageCache) { pageCache[number] = it }
            }
        }
    }

    fun savePage(page: Int) { ReadingPosition(preferences).page = page }

    fun marks(page: Int): QiraatMarks? = if (!::qiraatStore.isInitialized) null else qiraatStore.page(page)?.let { QiraatMarks(qiraatStore.catalog, it) }

    fun updateQiraatEnabled(value: Boolean) { qiraatEnabled = value; qiraatPreferences.enabled = value }
    fun setFilter(value: QiraatFilter) { qiraatFilter = value; qiraatPreferences.filter = value }
    fun updateHidesUsul(value: Boolean) { hidesUsul = value; qiraatPreferences.hidesUsul = value; applyVisibility() }
    fun setCategoryVisible(code: String, visible: Boolean) {
        hiddenUsulCategories = if (visible) hiddenUsulCategories - code else hiddenUsulCategories + code
        qiraatPreferences.hiddenCategories = hiddenUsulCategories
        applyVisibility()
    }
    private fun applyVisibility() {
        if (!::qiraatStore.isInitialized) return
        qiraatStore.hidesUsul = hidesUsul
        qiraatStore.hiddenUsulCategories = hiddenUsulCategories
    }

    fun prepareHub() {
        if (searchIndex != null && usulCategories.isNotEmpty()) return
        viewModelScope.launch(Dispatchers.IO) {
            val db = database ?: return@launch
            val words = db.wordPageIndex()
            val search = QiraatSearchIndex(qiraatStore, words)
            val usul = UsulIndex.build(qiraatStore, words)
            withContext(Dispatchers.Main) { searchIndex = search; usulCategories = usul }
        }
    }

    suspend fun searchQuran(query: String, mode: QuranSearchMode): List<AyahSearchResult> = withContext(Dispatchers.IO) {
        database?.searchAyaat(query, mode, 100).orEmpty()
    }

    suspend fun ayahText(surah: Int, ayah: Int): String = withContext(Dispatchers.IO) {
        database?.ayahText(AyahKey(surah, ayah)).orEmpty()
    }

    suspend fun pageOf(surah: Int, ayah: Int): Int? = withContext(Dispatchers.IO) {
        database?.pageOf(AyahKey(surah, ayah))
    }

    override fun onCleared() {
        database?.close()
        if (::qiraatStore.isInitialized) qiraatStore.close()
        if (::mutshabehatStore.isInitialized) (mutshabehatStore as? java.io.Closeable)?.close()
        super.onCleared()
    }
}
