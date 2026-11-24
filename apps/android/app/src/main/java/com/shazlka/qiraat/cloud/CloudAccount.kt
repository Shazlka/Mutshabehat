package com.shazlka.qiraat.cloud

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.AtomicFile
import android.util.Base64
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.shazlka.qiraat.BuildConfig
import com.shazlka.qiraat.memorization.SQLiteMemorizationDatabase
import com.shazlka.qiraat.reader.ReaderViewModel
import com.shazlka.qiraat.reading.QuranReadingDatabase
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.security.MessageDigest
import java.security.SecureRandom

class CloudAccount private constructor(private val context: Context) {
    private val origin = BuildConfig.QIRAAT_CLOUD_ORIGIN.trimEnd('/')
    private val issuer = BuildConfig.QIRAAT_CLOUD_ISSUER.trimEnd('/')
    private val clientId = BuildConfig.QIRAAT_CLOUD_CLIENT_ID
    val configured = origin.startsWith("https://") && issuer.startsWith("https://") && clientId.isNotBlank()
    private val redirect = "$origin/auth/mobile-callback"
    private val credentials = CloudCredentials(context)
    private var session by mutableStateOf(restoreSession())
    private var pending: Pending? = null
    val id: String? get() = session?.id
    val directory: File? get() = id?.let {
        File(context.noBackupFilesDir, "cloud-accounts/${ProgressDataset.sha256("$issuer|$it")}")
    }
    var preparing by mutableStateOf(needsSetup())
        private set
    var busy by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(null)
        private set
    var lastSync by mutableStateOf<Long?>(null)
        private set
    var conflicts by mutableStateOf<Map<ProgressDataset, Int>>(emptyMap())
        private set

    enum class Resolution { DEVICE, CLOUD }
    private data class Pending(val verifier: String, val state: String)
    private data class Session(val id: String, val access: String, val refresh: String?, val expiry: Long)
    private data class Baseline(val revision: Int, val hash: String)

    private fun setupMarker() = directory?.let { File(it, "setup-completed") }

    private fun needsSetup() = setupMarker()?.exists() == false

    fun finishSetup() {
        if (busy) return
        val marker = setupMarker() ?: return
        try {
            marker.writeText("")
            preparing = false
        } catch (_: Exception) {
            error = "تعذر حفظ إعدادات الحساب."
        }
    }

    fun openSignIn(activity: Context) {
        if (!configured || busy || session != null) return
        error = null
        val verifier = random()
        val state = random()
        pending = Pending(verifier, state)
        val challenge = encode(MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray()))
        val uri = Uri.parse("$issuer/oauth2/authorize").buildUpon()
            .appendQueryParameter("client_id", clientId)
            .appendQueryParameter("redirect_uri", redirect)
            .appendQueryParameter("response_type", "code")
            .appendQueryParameter("scope", "openid profile email offline_access")
            .appendQueryParameter("resource", origin)
            .appendQueryParameter("code_challenge", challenge)
            .appendQueryParameter("code_challenge_method", "S256")
            .appendQueryParameter("state", state)
            .build()
        runCatching { activity.startActivity(Intent(Intent.ACTION_VIEW, uri)) }.onFailure {
            pending = null
            error = SIGN_IN_ERROR
        }
    }

    suspend fun finishSignIn(callback: Uri) {
        if (callback.scheme != "com.shazlka.qiraat" || callback.host != "cloud" || callback.path != "/callback") return
        val flow = pending ?: return
        if (busy || session != null || callback.getQueryParameter("state") != flow.state) return
        pending = null
        val code = callback.getQueryParameter("code")
        if (code.isNullOrBlank()) {
            error = SIGN_IN_ERROR
            return
        }
        busy = true
        try {
            val tokens = token(mapOf("grant_type" to "authorization_code", "code" to code,
                "code_verifier" to flow.verifier, "redirect_uri" to redirect))
            val identity = request("$origin/v1/account", tokens.getString("access_token"))
            save(tokens, identity.getString("id"))
            preparing = needsSetup()
            error = null
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            error = SIGN_IN_ERROR
        } finally {
            busy = false
        }
    }

    /** Signs in or registers with email and password entirely inside the app. No browser is opened. */
    suspend fun signIn(email: String, password: String, create: Boolean) {
        if (!configured || busy || session != null) return
        busy = true
        error = null
        try {
            val verifier = random()
            val state = random()
            val challenge = encode(MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray()))
            val code = withContext(Dispatchers.IO) {
                CloudAuthClient(origin, issuer, clientId).authorize(email.trim(), password, create, challenge, state)
            }
            val tokens = token(mapOf("grant_type" to "authorization_code", "code" to code,
                "code_verifier" to verifier, "redirect_uri" to redirect))
            val identity = request("$origin/v1/account", tokens.getString("access_token"))
            save(tokens, identity.getString("id"))
            preparing = needsSetup()
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (failure: CloudAuthException) {
            error = failure.error.text
        } catch (_: Exception) {
            error = SIGN_IN_ERROR
        } finally {
            busy = false
        }
    }

    /** Best effort: tells the server to forget the refresh token. Signing out never waits for or depends on it. */
    private fun revoke(refresh: String?) {
        if (refresh == null) return
        val form = mapOf("token" to refresh, "token_type_hint" to "refresh_token", "client_id" to clientId)
            .entries.joinToString("&") { (key, value) -> "$key=${URLEncoder.encode(value, "UTF-8")}" }
        Thread {
            runCatching {
                UrlConnectionTransport.execute("POST", "$issuer/oauth2/revoke",
                    mapOf("Content-Type" to "application/x-www-form-urlencoded"), form)
            }
        }.start()
    }

    fun signOut() {
        if (busy) return
        revoke(session?.refresh)
        credentials.clear()
        session = null
        preparing = false
        error = null
        lastSync = null
        conflicts = emptyMap()
    }

    suspend fun sync(model: ReaderViewModel, dataset: ProgressDataset? = null, resolution: Resolution? = null,
                     importGuest: Boolean = false) {
        val localDirectory = directory ?: return
        if (busy || localDirectory != model.cloudDirectory) return
        busy = true
        error = null
        try {
            for (item in dataset?.let(::listOf) ?: ProgressDataset.entries) {
                try {
                    val access = accessToken()
                    val endpoint = "$origin/v1/progress/${item.path}"
                    val local = snapshot(model, item)
                    val hash = item.fingerprint(local)
                    val file = AtomicFile(File(localDirectory, "${item.path}-baseline.json"))
                    val base = runCatching {
                        val value = JSONObject(String(file.readFully(), Charsets.UTF_8))
                        Baseline(value.getInt("revision"), value.getString("fingerprint"))
                    }.getOrNull()
                    val lookup = if (importGuest) endpoint else "$endpoint?known=${base?.revision ?: 0}"
                    val remote = request(lookup, access)
                    val remoteRevision = remote.getInt("revision")
                    val incoming = remote.optJSONObject("snapshot")?.let(item::decode)
                    val hasChanges = base?.let { it.hash != hash } ?: item.hasProgress(local)
                    if (remote.optBoolean("unchanged") && !hasChanges) {
                        conflicts = conflicts - item
                        lastSync = System.currentTimeMillis()
                        continue
                    }
                    val choice = resolution.takeIf { conflicts[item] == remoteRevision }
                    var revision = remoteRevision
                    var appliedHash = hash
                    when {
                        importGuest -> {
                            if (incoming != null || hasChanges) throw IllegalStateException(CHANGED_ERROR)
                            val guest = guestSnapshot(item)
                            if (!item.hasProgress(guest)) continue
                            if (snapshot(model, item) != local) throw IllegalStateException(CHANGED_ERROR)
                            appliedHash = item.fingerprint(snapshot(model, item, guest))
                            revision = upload(item, guest, revision, endpoint, access)
                        }
                        incoming == local -> Unit
                        incoming != null && (choice == Resolution.CLOUD || !hasChanges) -> {
                            if (snapshot(model, item) != local) throw IllegalStateException(CHANGED_ERROR)
                            appliedHash = item.fingerprint(snapshot(model, item, incoming))
                        }
                        revision == 0 || choice == Resolution.DEVICE || base?.revision == revision -> {
                            if (!hasChanges && revision == 0) continue
                            revision = upload(item, local, revision, endpoint, access)
                        }
                        else -> {
                            conflicts = conflicts + (item to revision)
                            continue
                        }
                    }
                    val output = file.startWrite()
                    try {
                        output.write(JSONObject().put("revision", revision).put("fingerprint", appliedHash).toString().toByteArray())
                        file.finishWrite(output)
                    } catch (failure: Exception) {
                        file.failWrite(output)
                        throw failure
                    }
                    conflicts = conflicts - item
                    lastSync = System.currentTimeMillis()
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (failure: Exception) {
                    error = when (failure.message) {
                        CHANGED_ERROR, SIGN_IN_ERROR -> failure.message
                        else -> "تعذر مزامنة التقدّم. بياناتك محفوظة على الجهاز."
                    }
                }
            }
        } finally {
            busy = false
        }
    }

    private fun snapshot(model: ReaderViewModel, item: ProgressDataset, replacement: ProgressSnapshot? = null): ProgressSnapshot =
        when (item) {
            ProgressDataset.KHATMA -> model.readingDb.cloudSnapshot(replacement).also {
                if (replacement != null) model.readingTracker.reloadFromDatabase()
            }
            ProgressDataset.MEMORIZATION -> model.memorizationDb.cloudSnapshot(replacement).also {
                if (replacement != null) model.memorizationStore.reloadFromDatabase()
            }
        }

    private fun guestSnapshot(item: ProgressDataset): ProgressSnapshot = when (item) {
        ProgressDataset.KHATMA -> QuranReadingDatabase.open(context.getDatabasePath("mushaf_reading.sqlite")).use {
            it.cloudSnapshot()
        }
        ProgressDataset.MEMORIZATION -> SQLiteMemorizationDatabase.open(context.getDatabasePath("mushaf_memorization.sqlite")).use {
            it.cloudSnapshot()
        }
    }

    private suspend fun upload(item: ProgressDataset, snapshot: ProgressSnapshot, revision: Int,
                               endpoint: String, access: String): Int {
        val body = JSONObject().put("revision", revision).put("snapshot", item.encode(snapshot))
        return request(endpoint, access, "PUT", body.toString()).getInt("revision")
    }

    private suspend fun accessToken(): String {
        val current = session ?: throw IllegalStateException(SIGN_IN_ERROR)
        if (current.expiry > System.currentTimeMillis() + 60_000) return current.access
        val refresh = current.refresh ?: throw IllegalStateException(SIGN_IN_ERROR)
        val tokens = token(mapOf("grant_type" to "refresh_token", "refresh_token" to refresh))
        save(tokens, current.id, refresh)
        return tokens.getString("access_token")
    }

    private suspend fun token(fields: Map<String, String>): JSONObject {
        val form = fields + mapOf("client_id" to clientId, "resource" to origin)
        return request("$issuer/oauth2/token", method = "POST", contentType = "application/x-www-form-urlencoded",
            body = form.entries.joinToString("&") { (key, value) -> "$key=${URLEncoder.encode(value, "UTF-8")}" })
    }

    private fun save(tokens: JSONObject, id: String, fallbackRefresh: String? = null) {
        val refresh = tokens.optString("refresh_token").ifBlank { fallbackRefresh }
        val saved = Session(id, tokens.getString("access_token"), refresh,
            System.currentTimeMillis() + tokens.getLong("expires_in") * 1000)
        credentials.write(JSONObject().put("issuer", issuer).put("id", id).put("access", saved.access)
            .put("refresh", refresh).put("expiry", saved.expiry).toString())
        session = saved
    }

    private fun restoreSession(): Session? = if (!configured) null else runCatching {
        val value = JSONObject(credentials.read() ?: return null)
        if (value.getString("issuer") != issuer) return null
        Session(value.getString("id"), value.getString("access"), value.optString("refresh").ifBlank { null },
            value.getLong("expiry"))
    }.getOrNull()

    private suspend fun request(url: String, access: String? = null, method: String = "GET", body: String? = null,
                                contentType: String = "application/json"): JSONObject = withContext(Dispatchers.IO) {
        val connection = URL(url).openConnection() as HttpURLConnection
        try {
            connection.instanceFollowRedirects = false
            connection.connectTimeout = 15_000
            connection.readTimeout = 30_000
            connection.requestMethod = method
            access?.let { connection.setRequestProperty("Authorization", "Bearer $it") }
            body?.let {
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", contentType)
                connection.outputStream.use { stream -> stream.write(it.toByteArray()) }
            }
            when (connection.responseCode) {
                200 -> connection.inputStream.bufferedReader(Charsets.UTF_8).use { JSONObject(it.readText()) }
                400, 401 -> throw IllegalStateException(SIGN_IN_ERROR)
                409 -> throw IllegalStateException(CHANGED_ERROR)
                else -> throw IllegalStateException("HTTP ${connection.responseCode}")
            }
        } finally {
            connection.disconnect()
        }
    }

    private fun random(): String = encode(ByteArray(32).apply { SecureRandom().nextBytes(this) })
    private fun encode(bytes: ByteArray): String = Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)

    companion object {
        /** Foreground sync cadence. An unchanged check is one tiny request, so changes made on another device
         *  appear within this window and local changes upload within it. */
        const val LIVE_SYNC_INTERVAL_MS = 5_000L
        private const val SIGN_IN_ERROR = "تعذر تسجيل الدخول. حاول مرة أخرى."
        private const val CHANGED_ERROR = "تغيّرت البيانات أثناء المزامنة. أعد المحاولة."
        private var instance: CloudAccount? = null

        @Synchronized
        fun get(context: Context): CloudAccount =
            instance ?: CloudAccount(context.applicationContext).also { instance = it }
    }
}
