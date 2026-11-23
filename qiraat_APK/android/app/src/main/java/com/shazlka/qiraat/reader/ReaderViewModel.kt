package com.shazlka.qiraat.reader

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.shazlka.qiraat.backup.BackupService
import com.shazlka.qiraat.core.AyahKey
import com.shazlka.qiraat.core.MatnLibrary
import com.shazlka.qiraat.core.MushafDatabase
import com.shazlka.qiraat.core.MushafPage
import com.shazlka.qiraat.core.QcfFontStore
import com.shazlka.qiraat.core.QiraatFilter
import com.shazlka.qiraat.core.QiraatMarks
import com.shazlka.qiraat.core.QiraatPreferences
import com.shazlka.qiraat.core.QiraatReferenceStore
import com.shazlka.qiraat.core.QiraatSearchIndex
import com.shazlka.qiraat.core.QiraatStore
import com.shazlka.qiraat.core.ReadingPosition
import com.shazlka.qiraat.core.UsulCategory
import com.shazlka.qiraat.core.UsulIndex
import com.shazlka.qiraat.memorization.MemorizationStore
import com.shazlka.qiraat.memorization.QuranIndex
import com.shazlka.qiraat.memorization.SQLiteMemorizationDatabase
import com.shazlka.qiraat.mutshabehat.MutshabehatStore
import com.shazlka.qiraat.mutshabehat.SQLiteMutshabehatStore
import com.shazlka.qiraat.reading.QuranReadingDatabase
import com.shazlka.qiraat.reading.ReadingTracker
import com.shazlka.qiraat.search.AyahSearchResult
import com.shazlka.qiraat.search.QuranSearchMode
import com.shazlka.qiraat.settings.AppLanguage
import com.shazlka.qiraat.settings.MushafAppearance
import com.shazlka.qiraat.settings.SettingsPreferences
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

    // Phase 4 Settings & Preferences
    var appearance: MushafAppearance by mutableStateOf(MushafAppearance.SYSTEM)
        private set
    var language: AppLanguage by mutableStateOf(AppLanguage.ARABIC)
        private set
    var keepScreenAwake: Boolean by mutableStateOf(true)
        private set
    var autoHideFooter: Boolean by mutableStateOf(false)
        private set
    var isCurrentPageBookmarked: Boolean by mutableStateOf(false)
        private set
    var currentPageNumber: Int by mutableStateOf(1)
        private set

    val fontStore = QcfFontStore(application.assets)
    private val pageCache = object : LinkedHashMap<Int, MushafPage>(10, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<Int, MushafPage>?) = size > 10
    }
    private val preferences = application.getSharedPreferences("reader", 0)
    private val qiraatPreferences = QiraatPreferences(preferences)
    lateinit var settingsPreferences: SettingsPreferences
        private set

    var database: MushafDatabase? = null
        private set
    lateinit var qiraatStore: QiraatStore
        private set
    lateinit var matnLibrary: MatnLibrary
        private set
    lateinit var references: QiraatReferenceStore
        private set
    lateinit var mutshabehatStore: MutshabehatStore
        private set

    // Phase 4 Stores & Services
    lateinit var readingDb: QuranReadingDatabase
        private set
    lateinit var readingTracker: ReadingTracker
        private set
    lateinit var quranIndex: QuranIndex
        private set
    lateinit var memorizationDb: SQLiteMemorizationDatabase
        private set
    lateinit var memorizationStore: MemorizationStore
        private set
    lateinit var backupService: BackupService
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

                    // Phase 4 Services Initialization
                    settingsPreferences = SettingsPreferences(application.getSharedPreferences("reader_settings", 0))
                    appearance = settingsPreferences.appearance
                    language = settingsPreferences.language
                    keepScreenAwake = settingsPreferences.keepScreenAwake
                    autoHideFooter = settingsPreferences.autoHideFooter

                    readingDb = QuranReadingDatabase.open(application.getDatabasePath("mushaf_reading.sqlite"))
                    quranIndex = QuranIndex.load(db)
                    readingTracker = ReadingTracker(readingDb, viewModelScope)
                    memorizationDb = SQLiteMemorizationDatabase.open(application.getDatabasePath("mushaf_memorization.sqlite"))
                    memorizationStore = MemorizationStore(memorizationDb, quranIndex)
                    backupService = BackupService(memorizationStore, readingDb, mutshabehatStore)
                }
            }.onSuccess {
                val initialPage = ReadingPosition(preferences).page
                currentPageNumber = initialPage
                state = ReaderState.Ready(initialPage)
                onPageSelected(initialPage)
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

    fun savePage(page: Int) {
        ReadingPosition(preferences).page = page
        onPageSelected(page)
    }

    private fun onPageSelected(page: Int) {
        currentPageNumber = page
        if (::readingTracker.isInitialized) {
            val ayahsOnPage = database?.ayahLayout()?.filter { it.page == page }?.map { it.key }.orEmpty()
            readingTracker.pageDidChange(page, ayahsOnPage)
            isCurrentPageBookmarked = readingTracker.isPageBookmarked(page)
        }
    }

    fun togglePageBookmark(page: Int) {
        if (!::readingTracker.isInitialized) return
        val ayah = database?.ayahLayout()?.firstOrNull { it.page == page }?.key ?: AyahKey(1, 1)
        readingTracker.togglePageBookmark(page, ayah.surah, ayah.ayah)
        isCurrentPageBookmarked = readingTracker.isPageBookmarked(page)
    }

    fun updateAppearance(newAppearance: MushafAppearance) {
        appearance = newAppearance
        settingsPreferences.appearance = newAppearance
    }

    fun updateLanguage(newLanguage: AppLanguage) {
        language = newLanguage
        settingsPreferences.language = newLanguage
    }

    fun updateKeepScreenAwake(awake: Boolean) {
        keepScreenAwake = awake
        settingsPreferences.keepScreenAwake = awake
    }

    fun updateAutoHideFooter(autoHide: Boolean) {
        autoHideFooter = autoHide
        settingsPreferences.autoHideFooter = autoHide
    }

    fun marks(page: Int): QiraatMarks? = if (!::qiraatStore.isInitialized) null else qiraatStore.page(page)?.let { QiraatMarks(qiraatStore.catalog, it) }

    fun toggleQiraatEnabled() {
        val next = !qiraatEnabled
        qiraatEnabled = next
        qiraatPreferences.enabled = next
    }

    fun updateQiraatEnabled(value: Boolean) { qiraatEnabled = value; qiraatPreferences.enabled = value }
    fun setFilter(value: QiraatFilter) { qiraatFilter = value; qiraatPreferences.filter = value }
    fun updateHidesUsul(value: Boolean) { hidesUsul = value; qiraatPreferences.hidesUsul = value; applyVisibility() }
    fun setCategoryVisible(code: String, visible: Boolean) {
        hiddenUsulCategories = if (visible) hiddenUsulCategories - code else hiddenUsulCategories + code
        qiraatPreferences.hiddenCategories = hiddenUsulCategories
        applyVisibility()
    }
    fun updateHiddenUsulCategories(categories: Set<String>) {
        hiddenUsulCategories = categories
        qiraatPreferences.hiddenCategories = categories
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
        if (::readingTracker.isInitialized) {
            readingTracker.flushCurrentPageDwell()
        }
        database?.close()
        if (::qiraatStore.isInitialized) qiraatStore.close()
        if (::mutshabehatStore.isInitialized) (mutshabehatStore as? java.io.Closeable)?.close()
        if (::readingDb.isInitialized) readingDb.close()
        if (::memorizationDb.isInitialized) memorizationDb.close()
        super.onCleared()
    }
}
