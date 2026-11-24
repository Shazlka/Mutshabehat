package com.shazlka.qiraat.reader

import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.MutableState
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput

/**
 * A tap on the empty strip under the page shows or hides the footer, so the footer can always be brought back.
 * The strip is a plain `Spacer` (it keeps the page clear of the footer); in a Column it is only as wide as it is told,
 * which was nothing, so the tap target is made full width first.
 */
object ReaderChromeTap {
    @JvmStatic
    fun tapTarget(modifier: Modifier, chromeVisible: MutableState<Boolean>): Modifier =
        modifier.fillMaxWidth().pointerInput(chromeVisible) {
            detectTapGestures { chromeVisible.value = !chromeVisible.value }
        }
}
