package com.shazlka.qiraat.core

import java.io.File
import org.junit.Assert.*
import org.junit.Test

class QiraatAssetTest {
    private fun assetDirectory(): File {
        val root = File(requireNotNull(System.getProperty("user.dir")))
        return listOf(File(root, "app/src/main/assets/qiraat"), File(root, "src/main/assets/qiraat"))
            .first { it.isDirectory }
    }

    @Test fun bundledSnapshotDecodesRealCatalogAndPages() {
        val directory = assetDirectory()
        val store = QiraatStore.fromReader(reader = { File(directory, it).readText() })
        assertEquals(10, store.catalog.readers.size)
        assertEquals(20, store.catalog.narrators.size)
        assertEquals(604, store.catalog.pageCount)
        val first = requireNotNull(store.page(1))
        assertEquals(1, first.pageNumber)
        assertTrue(first.variants.isNotEmpty())
        assertTrue(first.rulings.isNotEmpty())
        assertNotNull(store.page(604))
    }

    @Test fun bundledMutoonAndReferencesDecode() {
        val assets = assetDirectory().parentFile!!
        val mutoon = File(assets, "qiraat_mutoon")
        val library = MatnLibrary.fromReader { File(mutoon, it).readText() }
        assertEquals(3, library.works.size)
        assertTrue(library.works.all { it.verseCount > 0 })
        assertFalse(library.search("مالك").isEmpty())
        val symbolCount = library.works.sumOf { work -> work.chapters.sumOf { chapter -> chapter.verses.sumOf { library.symbols(work.work, it.number).size } } }
        assertTrue("verified mutoon symbols should survive validation", symbolCount > 0)
        assertTrue("bundled sharh should resolve", library.works.any { work -> work.chapters.any { chapter -> chapter.verses.any { library.sharh(work.work, it.number) != null } } })
        val references = File(assets, "qiraat_references")
        val store = QiraatReferenceStore.fromReader { File(references, it).readText() }
        assertTrue(store.count > 0)
    }
}
