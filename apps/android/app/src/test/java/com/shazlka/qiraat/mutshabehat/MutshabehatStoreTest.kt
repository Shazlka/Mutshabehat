package com.shazlka.qiraat.mutshabehat

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.io.File

@RunWith(RobolectricTestRunner::class)
class MutshabehatStoreTest {
    @Test fun transactionalCRUDAndLiteralSearch() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val file = File(context.cacheDir, "mut-${System.nanoTime()}.sqlite")
        val store = SQLiteMutshabehatStore.open(file)
        val group = PersonalGroup(title = "100% نور", verses = listOf(PersonalVerse(surah = "الكهف", ayah = 1, parts = listOf(PersonalPart(text = "الحمد لله")))))
        store.save(group)
        assertEquals("100% نور", store.group(group.id)?.title)
        assertEquals(1, store.groups("%").size)
        assertTrue(store.groups("_").isEmpty())
        store.toggleFavorite(group.id)
        assertTrue(store.group(group.id)!!.favorite)
        store.delete(group.id)
        assertNull(store.group(group.id))
        store.close(); file.delete()
    }
}
