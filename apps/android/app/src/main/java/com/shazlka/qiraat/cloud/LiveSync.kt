package com.shazlka.qiraat.cloud

import java.lang.ref.WeakReference
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay

/**
 * Keeps the account synced while the app is in the foreground.
 *
 * The approved account module synced once each time the app resumed. `MainActivity` runs that call inside
 * `repeatOnLifecycle(RESUMED)`, so replacing it with [loop] gives a sync every [INTERVAL_MS] while the app is
 * open and stops it the moment the app leaves the foreground. An unchanged check is one small request, so
 * changes made on another device appear within the interval and local changes upload within it.
 */
object LiveSync {
    const val INTERVAL_MS = 5_000L

    @Volatile
    private var activeAccount: WeakReference<Any>? = null

    @Volatile
    private var activeModel: WeakReference<Any>? = null

    /** Pushes/syncs the khatma dataset immediately after user edits (when signed in). */
    suspend fun syncKhatmaNow(): Pair<Boolean, String?> {
        val account = activeAccount?.get() ?: return false to null
        val model = activeModel?.get() ?: return false to null
        if (!SyncEngine.isSignedIn(account)) return false to null
        val ok = SyncEngine.sync(account, model, ProgressDataset.KHATMA, null, false)
        return ok to SyncEngine.lastError(account)
    }

    /** The reader opens its databases after the screen starts; syncing earlier fails and shows a false error. */
    private suspend fun waitUntilReady(model: Any) {
        val getters = listOf("getReadingDb", "getMemorizationDb").mapNotNull {
            runCatching { model.javaClass.getMethod(it) }.getOrNull()
        }
        while (getters.any { runCatching { it.invoke(model) }.isFailure }) delay(250)
    }

    /** Never returns normally; it ends when the surrounding lifecycle block is cancelled. */
    @JvmStatic
    suspend fun loop(account: Any, model: Any): Boolean {
        activeAccount = WeakReference(account)
        activeModel = WeakReference(model)
        waitUntilReady(model)
        while (true) {
            try {
                SyncEngine.background(account, model)
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Throwable) {
                // The next tick tries again; the engine already reported the failure on the account.
            }
            delay(INTERVAL_MS)
        }
    }
}
