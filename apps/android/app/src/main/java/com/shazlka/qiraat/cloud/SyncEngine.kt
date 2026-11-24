package com.shazlka.qiraat.cloud

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.lang.reflect.InvocationTargetException
import java.lang.reflect.Method
import kotlin.coroutines.Continuation
import kotlin.coroutines.intrinsics.suspendCoroutineUninterceptedOrReturn

/**
 * The account's progress sync, with the same algorithm the iOS app and the source build use.
 *
 * The approved account module is compiled without source, and its own sync failed for real accounts (it ordered
 * `reading_deletions` by a column that does not exist, wrote an empty baseline hash, and flagged a conflict on a
 * first sync). Its `CloudAccount.sync` now hands over to [sync], which drives the same observable state the screen
 * already shows (busy, error, conflicts, last sync) and the same baseline files, so the screens are unchanged.
 *
 * A dataset is synced like this: ask the cloud for its revision; if nothing changed on either side do nothing; if only
 * the cloud changed take it; if only this device changed upload it; if both changed keep both and ask the person.
 *
 * The account and view model are reached by reflection so this class does not depend on the shape of the module it
 * is patched into.
 */
object SyncEngine {
    private const val CHANGED = "تغيّرت البيانات أثناء المزامنة. أعد المحاولة."
    private const val SIGN_IN = "تعذر تسجيل الدخول. حاول مرة أخرى."
    private const val FAILED = "تعذر مزامنة التقدم. بياناتك محفوظة على الجهاز."

    /** The cloud revision each open conflict was raised against, so a choice only applies to what the person saw. */
    private val conflictRevisions = mutableMapOf<String, Int>()

    private class Baseline(val revision: Int, val hash: String)

    @JvmStatic
    suspend fun sync(account: Any, model: Any, dataset: Any?, resolution: Any?, force: Boolean): Boolean {
        if (flag(account, "getBusy")) return false
        val directory = call(account, "getDirectory") as? File ?: return false
        if (call(account, "getSession") == null) return false
        setState(account, "setBusy", java.lang.Boolean.TYPE, true)
        setState(account, "setError", String::class.java, null)
        var failure: String? = null
        try {
            val items = (dataset as? ProgressDataset)?.let(::listOf) ?: ProgressDataset.values().toList()
            for (item in items) {
                try {
                    syncOne(account, model, item, (resolution as? Enum<*>)?.name, force, directory)
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (error: Exception) {
                    failure = (error as? SyncFailure)?.text ?: (error.cause as? SyncFailure)?.text ?: FAILED
                }
            }
        } finally {
            setState(account, "setError", String::class.java, failure)
            setState(account, "setBusy", java.lang.Boolean.TYPE, false)
        }
        return failure == null
    }

    private class SyncFailure(val text: String) : Exception(text)

    private suspend fun syncOne(account: Any, model: Any, item: ProgressDataset, choice: String?, force: Boolean, directory: File) {
        val access = accessToken(account)
        val endpoint = "${call(account, "getOrigin")}/v1/progress/${item.path}"
        val local = snapshot(account, model, item, null)
        val hash = item.fingerprint(local)
        val file = File(directory, "${item.path}-baseline.json")
        val base = readBaseline(file)
        val remote = request(if (force) endpoint else "$endpoint?known=${base?.revision ?: 0}", access)
        val remoteRevision = remote.getInt("revision")
        val incoming = remote.optJSONObject("snapshot")?.let(item::decode)
        val hasChanges = base?.let { it.hash != hash } ?: item.hasProgress(local)

        if (remote.optBoolean("unchanged") && !hasChanges) {
            clearConflict(account, item)
            touch(account)
            return
        }
        val decision = choice?.takeIf { conflictRevisions[item.path] == remoteRevision }
        var revision = remoteRevision
        var appliedHash = hash
        when {
            incoming != null && incoming == local -> Unit
            incoming != null && (decision == "CLOUD" || !hasChanges) -> {
                if (snapshot(account, model, item, null) != local) throw SyncFailure(CHANGED)
                snapshot(account, model, item, incoming)
                appliedHash = item.fingerprint(snapshot(account, model, item, null))
            }
            revision == 0 || decision == "DEVICE" || base?.revision == revision -> {
                if (!hasChanges && revision == 0) return
                revision = upload(item, local, revision, endpoint, access)
            }
            else -> {
                conflictRevisions[item.path] = remoteRevision
                setConflict(account, item, incoming ?: emptyMap<String, List<List<String?>>>())
                return
            }
        }
        writeBaseline(file, revision, appliedHash)
        clearConflict(account, item)
        touch(account)
    }

    private suspend fun upload(item: ProgressDataset, snapshot: ProgressSnapshot, revision: Int, endpoint: String, access: String): Int {
        val body = JSONObject().put("revision", revision).put("snapshot", item.encode(snapshot))
        return request(endpoint, access, "PUT", body.toString()).getInt("revision")
    }

    private suspend fun request(url: String, access: String, method: String = "GET", body: String? = null): JSONObject =
        withContext(Dispatchers.IO) {
            val headers = linkedMapOf("Authorization" to "Bearer $access", "Accept" to "application/json")
            if (body != null) headers["Content-Type"] = "application/json"
            val reply = UrlConnectionTransport.execute(method, url, headers, body)
            when (reply.status) {
                200 -> JSONObject(reply.body)
                400, 401 -> throw SyncFailure(SIGN_IN)
                409 -> throw SyncFailure(CHANGED)
                else -> throw SyncFailure(FAILED)
            }
        }

    // MARK: Baseline

    private fun readBaseline(file: File): Baseline? = runCatching {
        val value = JSONObject(file.readText())
        val hash = value.optString("hash").ifEmpty { value.optString("fingerprint") }
        Baseline(value.getInt("revision"), hash)
    }.getOrNull()

    private fun writeBaseline(file: File, revision: Int, hash: String) {
        file.parentFile?.mkdirs()
        val temporary = File(file.parentFile, file.name + ".tmp")
        temporary.writeText(JSONObject().put("revision", revision).put("hash", hash).toString())
        if (!temporary.renameTo(file)) {
            file.delete()
            check(temporary.renameTo(file)) { "baseline not saved" }
        }
    }

    // MARK: The account module (reflection)

    private fun method(target: Any, name: String, count: Int): Method =
        target.javaClass.methods.firstOrNull { it.name == name && it.parameterTypes.size == count }
            ?: target.javaClass.declaredMethods.first { it.name == name && it.parameterTypes.size == count }.apply { isAccessible = true }

    private fun call(target: Any, name: String): Any? = method(target, name, 0).invoke(target)

    private fun flag(target: Any, name: String): Boolean = call(target, name) as? Boolean ?: false

    private fun setState(target: Any, name: String, type: Class<*>, value: Any?) {
        val setter = target.javaClass.getDeclaredMethod(name, type).apply { isAccessible = true }
        try {
            setter.invoke(target, value)
        } catch (error: InvocationTargetException) {
            throw error.cause ?: error
        }
    }

    @Suppress("UNCHECKED_CAST")
    private fun conflicts(account: Any): Map<ProgressDataset, Any> = call(account, "getConflicts") as Map<ProgressDataset, Any>

    private fun setConflict(account: Any, item: ProgressDataset, cloud: Any) =
        setState(account, "setConflicts", Map::class.java, conflicts(account) + (item to cloud))

    private fun clearConflict(account: Any, item: ProgressDataset) {
        conflictRevisions.remove(item.path)
        if (item in conflicts(account)) setState(account, "setConflicts", Map::class.java, conflicts(account) - item)
    }

    private fun touch(account: Any) = setState(account, "setLastSync", java.lang.Long::class.java, System.currentTimeMillis())

    private suspend fun accessToken(account: Any): String {
        val method = account.javaClass.getMethod("accessToken", Continuation::class.java)
        return try {
            suspendCoroutineUninterceptedOrReturn<Any?> { continuation -> method.invoke(account, continuation) } as String
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            throw SyncFailure(SIGN_IN)
        }
    }

    /** Captures the dataset, or replaces it with [replacement] and returns the result. */
    @Suppress("UNCHECKED_CAST")
    private fun snapshot(account: Any, model: Any, item: ProgressDataset, replacement: ProgressSnapshot?): ProgressSnapshot {
        val method = account.javaClass.methods.first { it.name == "snapshot" && it.parameterTypes.size == 3 }
        return try {
            method.invoke(account, model, item, replacement) as ProgressSnapshot
        } catch (error: InvocationTargetException) {
            throw error.cause ?: error
        }
    }
}
