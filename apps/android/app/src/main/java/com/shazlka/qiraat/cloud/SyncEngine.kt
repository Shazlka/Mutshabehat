package com.shazlka.qiraat.cloud

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.io.IOException
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
    private const val SIGN_IN_EXPIRED = "انتهت جلسة السحابة. يرجى تسجيل الدخول مرة أخرى."
    private const val UNAVAILABLE = "تعذر الاتصال بالسحابة. بياناتك محفوظة على الجهاز."
    private const val FAILED = "تعذر مزامنة التقدم. بياناتك محفوظة على الجهاز."
    private const val TAG = "QiraatSync"

    internal var transport: HttpTransport = UrlConnectionTransport

    /** The cloud revision each open conflict was raised against, so a choice only applies to what the person saw. */
    private val conflictRevisions = mutableMapOf<String, Int>()

    /** A cheap fingerprint of each dataset's database files (size and modification time) at the last completed pass. */
    private val stamps = mutableMapOf<String, Long?>()

    private fun stamp(model: Any, item: ProgressDataset): Long? = runCatching {
        val context = model.javaClass.getMethod("getApplication").invoke(model) as android.content.Context
        val database = context.getDatabasePath(if (item == ProgressDataset.KHATMA) "mushaf_reading.sqlite" else "mushaf_memorization.sqlite")
        listOf(database, File(database.path + "-wal")).sumOf { it.lastModified() * 31 + it.length() }
    }.getOrNull()

    private class Baseline(val revision: Int, val hash: String)

    private val running = Mutex()

    /** A one-line trace of what a pass decided (dataset, revisions, branch). It carries no tokens or progress data. */
    private fun trace(item: ProgressDataset, message: String) = android.util.Log.d("QiraatSync", "${item.path}: $message")

    /** A person's request (the sync button, a conflict choice): waits for a pass in progress instead of being dropped. */
    @JvmStatic
    suspend fun sync(account: Any, model: Any, dataset: Any?, resolution: Any?, force: Boolean): Boolean =
        running.withLock { pass(account, model, dataset, resolution, force) }

    /** The periodic pass: skipped when another pass is already running. */
    suspend fun background(account: Any, model: Any): Boolean {
        if (!running.tryLock()) return false
        return try {
            pass(account, model, null, null, false)
        } finally {
            running.unlock()
        }
    }

    private suspend fun pass(account: Any, model: Any, dataset: Any?, resolution: Any?, force: Boolean): Boolean {
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
                } catch (error: Throwable) {
                    android.util.Log.w(TAG, "${item.path} failed: ${error.javaClass.simpleName}")
                    failure = (error as? SyncFailure)?.text ?: (error.cause as? SyncFailure)?.text ?: detailed(error)
                    if (call(account, "getSession") == null) break
                }
            }
        } finally {
            setState(account, "setError", String::class.java, failure)
            setState(account, "setBusy", java.lang.Boolean.TYPE, false)
        }
        return failure == null
    }

    private class SyncFailure(val text: String) : Exception(text)

    /** The generic message plus the kind of failure, so a report from a phone says what went wrong. */
    private fun detailed(error: Throwable): String {
        val cause = (error as? InvocationTargetException)?.cause ?: error
        val reason = cause.message?.take(80)?.let { ": $it" }.orEmpty()
        return "$FAILED (${cause.javaClass.simpleName}$reason)"
    }

    private val refreshMutex = Mutex()

    private suspend fun syncOne(account: Any, model: Any, item: ProgressDataset, choice: String?, force: Boolean, directory: File) {
        var access = accessToken(account)
        val endpoint = "${call(account, "getOrigin")}/v1/progress/${item.path}"
        val file = File(directory, "${item.path}-baseline.json")
        val base = readBaseline(file)
        // While a conflict waits for an answer, only ask whether the cloud moved; do not download it again.
        val openConflict = conflictRevisions[item.path]
        val known = when {
            force || choice != null -> 0
            openConflict != null -> openConflict
            else -> base?.revision ?: 0
        }
        val (remote, currentAccess) = requestWithRefresh(account, access, "$endpoint?known=$known")
        access = currentAccess
        val remoteRevision = remote.getInt("revision")
        trace(item, "cloud revision $remoteRevision, unchanged=${remote.optBoolean("unchanged")}, base=${base?.revision}, known=$known")

        // Nothing new in the cloud and nothing written on this device since the last pass: no need to read the whole
        // database (a full khatma is tens of thousands of rows) every few seconds.
        val stamp = stamp(model, item)
        if (!force && choice == null && remote.optBoolean("unchanged") && stamp != null && stamps[item.path] == stamp &&
            (base != null || openConflict != null)) {
            trace(item, "nothing new in the cloud or on the device")
            if (openConflict == null) touch(account)
            return
        }

        val local = withContext(Dispatchers.IO) { snapshot(account, model, item, null) }
        trace(item, "read ${local.values.sumOf { it.size }} local rows")
        val hash = withContext(Dispatchers.Default) { item.fingerprint(local) }
        trace(item, "fingerprinted")
        val incoming = withContext(Dispatchers.Default) { remote.optJSONObject("snapshot")?.let(item::decode) }
        trace(item, "decoded the cloud copy")
        if (incoming != null) rememberDeletions(directory, item, incoming)
        val hasChanges = base?.let { it.hash != hash } ?: item.hasProgress(local)
        trace(item, "device changed=$hasChanges, local rows=${local.values.sumOf { it.size }}, incoming=${incoming != null}")

        if (remote.optBoolean("unchanged") && !hasChanges) {
            stamps[item.path] = stamp
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
                trace(item, "taking the cloud copy")
                if (snapshot(account, model, item, null) != local) throw SyncFailure(CHANGED)
                snapshot(account, model, item, incoming)
                appliedHash = item.fingerprint(snapshot(account, model, item, null))
            }
            revision == 0 || decision == "DEVICE" || base?.revision == revision -> {
                if (!hasChanges && revision == 0) { trace(item, "empty on both sides"); return }
                trace(item, "uploading the device copy")
                revision = upload(account, item, withCloudDeletions(model, directory, item, local), revision, endpoint, access)
            }
            else -> {
                trace(item, "conflict raised")
                conflictRevisions[item.path] = remoteRevision
                stamps[item.path] = stamp
                setConflict(account, item, incoming ?: emptyMap<String, List<List<String?>>>())
                return
            }
        }
        writeBaseline(file, revision, appliedHash)
        stamps[item.path] = stamp(model, item)
        clearConflict(account, item)
        touch(account)
    }

    private suspend fun upload(
        account: Any,
        item: ProgressDataset,
        snapshot: ProgressSnapshot,
        revision: Int,
        endpoint: String,
        access: String,
    ): Int {
        val body = withContext(Dispatchers.Default) {
            JSONObject().put("revision", revision).put("snapshot", item.encode(snapshot)).toString()
        }
        return requestWithRefresh(account, access, endpoint, "PUT", body).first.getInt("revision")
    }

    internal suspend fun requestWithRefresh(
        account: Any,
        initialAccess: String,
        url: String,
        method: String = "GET",
        body: String? = null,
    ): Pair<JSONObject, String> {
        return try {
            request(url, initialAccess, method, body) to initialAccess
        } catch (unauthorized: UnauthorizedException) {
            android.util.Log.w(TAG, "$method $url returned 401; forcing token refresh")
            val refreshed = accessToken(account, forceRefresh = true)
            try {
                request(url, refreshed, method, body) to refreshed
            } catch (_: UnauthorizedException) {
                throw SyncFailure(SIGN_IN)
            }
        }
    }

    private class UnauthorizedException : Exception()

    private suspend fun request(url: String, access: String, method: String = "GET", body: String? = null): JSONObject =
        withContext(Dispatchers.IO) {
            val headers = linkedMapOf("Authorization" to "Bearer $access", "Accept" to "application/json")
            if (body != null) headers["Content-Type"] = "application/json"
            val reply = transport.execute(method, url, headers, body)
            when (reply.status) {
                200 -> JSONObject(reply.body)
                401 -> throw UnauthorizedException()
                400 -> {
                    android.util.Log.w(TAG, "$method ${endpointPath(url)} returned 400")
                    throw SyncFailure(FAILED)
                }
                409 -> throw SyncFailure(CHANGED)
                else -> {
                    android.util.Log.w(TAG, "$method ${endpointPath(url)} returned ${reply.status}")
                    throw SyncFailure(FAILED)
                }
            }
        }

    // MARK: Deletion records
    //
    // Some Android installs keep deletion records in an older, different table (see SnapshotIO), so they read as empty here.
    // The cloud's records (written by iPhone) are remembered from what was last downloaded and sent back unchanged, so an
    // upload from such a device does not erase them.

    private fun deletionsFile(directory: File) = File(directory, "khatma-deletions.json")

    private fun rememberDeletions(directory: File, item: ProgressDataset, incoming: ProgressSnapshot) {
        if (item != ProgressDataset.KHATMA) return
        runCatching { deletionsFile(directory).writeText(JSONObject().put("rows", item.encode(incoming).getJSONArray("reading_deletions")).toString()) }
    }

    private fun withCloudDeletions(model: Any, directory: File, item: ProgressDataset, local: ProgressSnapshot): ProgressSnapshot {
        if (item != ProgressDataset.KHATMA || !local["reading_deletions"].isNullOrEmpty()) return local
        if (holdsDeletions(model)) return local
        val cached = runCatching {
            val rows = JSONObject(deletionsFile(directory).readText()).getJSONArray("rows")
            List(rows.length()) { index ->
                val row = rows.getJSONArray(index)
                List(row.length()) { column -> if (row.isNull(column)) null else row.getString(column) }
            }
        }.getOrNull() ?: return local
        return local + ("reading_deletions" to cached)
    }

    /** Whether this device's own deletion table has the shared shape (it then reports its own rows). */
    private fun holdsDeletions(model: Any): Boolean = runCatching {
        val context = model.javaClass.getMethod("getApplication").invoke(model) as android.content.Context
        android.database.sqlite.SQLiteDatabase.openDatabase(
            context.getDatabasePath("mushaf_reading.sqlite").path, null, android.database.sqlite.SQLiteDatabase.OPEN_READONLY,
        ).use { SnapshotIO.usable(it, "reading_deletions") }
    }.getOrDefault(true)

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

    internal suspend fun accessToken(account: Any, forceRefresh: Boolean = false): String = refreshMutex.withLock {
        val session = call(account, "getSession") ?: throw SyncFailure(SIGN_IN)
        val access = (call(session, "getAccess") as? String).orEmpty()
        val refresh = (call(session, "getRefresh") as? String).orEmpty()
        val expiry = (call(session, "getExpiry") as? Long) ?: 0L
        val id = (call(session, "getId") as? String).orEmpty()
        if (id.isBlank()) throw SyncFailure(SIGN_IN)

        val now = System.currentTimeMillis()
        if (!forceRefresh && access.isNotBlank() && expiry - now > 60_000L) {
            return@withLock access
        }
        if (refresh.isBlank()) {
            if (!forceRefresh && access.isNotBlank() && expiry > now) {
                return@withLock access
            }
            invalidateExpiredSession(account)
            throw SyncFailure(SIGN_IN_EXPIRED)
        }

        val refreshed = refreshAccessToken(account, session, id, refresh)
        if (refreshed != null) return@withLock refreshed

        // Fall back to the legacy CloudAccount.accessToken only if our direct refresh path was bypassed.
        val method = account.javaClass.getMethod("accessToken", Continuation::class.java)
        try {
            val fallback = suspendCoroutineUninterceptedOrReturn<Any?> { continuation -> method.invoke(account, continuation) } as? String
            if (!fallback.isNullOrBlank()) return@withLock fallback
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (error: Exception) {
            android.util.Log.w(TAG, "legacy accessToken failed", error)
        }
        throw SyncFailure(SIGN_IN)
    }

    private suspend fun refreshAccessToken(account: Any, session: Any, userId: String, refreshToken: String): String? {
        val issuer = (optionalCall(account, "getIssuer") as? String)?.trimEnd('/') ?: return null
        val clientId = (optionalCall(account, "getClientId") as? String).orEmpty()
        val origin = (optionalCall(account, "getOrigin") as? String).orEmpty()
        if (issuer.isBlank() || clientId.isBlank()) return null

        val params = buildList {
            add("grant_type" to "refresh_token")
            add("refresh_token" to refreshToken)
            add("client_id" to clientId)
            if (origin.isNotBlank()) add("resource" to origin)
        }
        val reply = withContext(Dispatchers.IO) {
            try {
                transport.execute(
                    method = "POST",
                    url = "$issuer/oauth2/token",
                    headers = mapOf(
                        "Content-Type" to "application/x-www-form-urlencoded",
                        "Accept" to "application/json",
                    ),
                    body = CloudAuthClient.form(params),
                )
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (io: IOException) {
                android.util.Log.w(TAG, "token refresh network error", io)
                throw SyncFailure(UNAVAILABLE)
            }
        }

        if (reply.status in 200..299) {
            val tokens = try {
                JSONObject(reply.body)
            } catch (error: Exception) {
                android.util.Log.w(TAG, "token refresh invalid json", error)
                throw SyncFailure(UNAVAILABLE)
            }
            val newAccess = tokens.optString("access_token")
            if (newAccess.isBlank()) {
                android.util.Log.w(TAG, "token refresh response missing access_token")
                throw SyncFailure(UNAVAILABLE)
            }
            val email = optionalCall(session, "getEmail") as? String
            val name = optionalCall(session, "getName") as? String
            persistSession(account, tokens, userId, refreshToken, email, name)
            android.util.Log.d(TAG, "refreshed access token cleanly")
            return newAccess
        }

        val errorCode = runCatching { JSONObject(reply.body).optString("error").lowercase() }.getOrDefault("")
        android.util.Log.w(TAG, "token refresh failed status=${reply.status} error=$errorCode")
        if ((reply.status == 400 || reply.status == 401) &&
            (errorCode == "invalid_grant" || errorCode == "invalid_client" || errorCode == "unauthorized_client")
        ) {
            invalidateExpiredSession(account)
            throw SyncFailure(SIGN_IN_EXPIRED)
        }
        throw SyncFailure(UNAVAILABLE)
    }

    private fun optionalCall(target: Any, name: String): Any? =
        target.javaClass.methods.firstOrNull { it.name == name && it.parameterTypes.isEmpty() }?.invoke(target)
            ?: target.javaClass.declaredMethods.firstOrNull { it.name == name && it.parameterTypes.isEmpty() }?.run {
                isAccessible = true
                invoke(target)
            }

    private fun endpointPath(url: String): String = runCatching { java.net.URI(url).path.orEmpty() }.getOrDefault("")

    private suspend fun onMain(block: () -> Unit) {
        val hasMain = runCatching { android.os.Looper.getMainLooper() != null }.getOrDefault(false)
        if (hasMain) withContext(Dispatchers.Main.immediate) { block() } else block()
    }

    private suspend fun persistSession(
        account: Any,
        tokens: JSONObject,
        userId: String,
        fallbackRefresh: String,
        email: String?,
        name: String?,
    ) {
        onMain {
            val save = runCatching {
                account.javaClass.getDeclaredMethod(
                    "save",
                    JSONObject::class.java,
                    String::class.java,
                    String::class.java,
                    String::class.java,
                    String::class.java,
                )
            }.getOrNull()
            if (save != null) {
                save.isAccessible = true
                save.invoke(account, tokens, userId, fallbackRefresh, email, name)
            } else {
                val threeArg = account.javaClass.getDeclaredMethod(
                    "save",
                    JSONObject::class.java,
                    String::class.java,
                    String::class.java,
                )
                threeArg.isAccessible = true
                threeArg.invoke(account, tokens, userId, fallbackRefresh)
            }
        }
    }

    private suspend fun invalidateExpiredSession(account: Any) {
        onMain {
            runCatching { setState(account, "setBusy", java.lang.Boolean.TYPE, false) }
            runCatching { account.javaClass.getMethod("signOut").invoke(account) }
            runCatching { setState(account, "setError", String::class.java, SIGN_IN_EXPIRED) }
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
