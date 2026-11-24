package com.shazlka.qiraat.cloud

import kotlinx.coroutines.CancellationException
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.net.URLDecoder
import java.net.URLEncoder

/** Failures a person can act on while signing in or creating an account. */
enum class CloudAuthError(val text: String) {
    INVALID_EMAIL("اكتب بريدًا إلكترونيًا صحيحًا."),
    WEAK_PASSWORD("كلمة المرور يجب أن تكون ٨ أحرف على الأقل."),
    INVALID_CREDENTIALS("البريد الإلكتروني أو كلمة المرور غير صحيحة."),
    EMAIL_TAKEN("هذا البريد مسجّل بالفعل. سجّل الدخول بدلًا من إنشاء حساب."),
    VERIFICATION_REQUIRED("أرسلنا رسالة تأكيد إلى بريدك. افتحها ثم سجّل الدخول."),
    RATE_LIMITED("محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة."),
    CONNECTION("تعذر الاتصال. تأكد من الإنترنت وأعد المحاولة."),
    REJECTED("تعذر تسجيل الدخول. حاول مرة أخرى."),
}

class CloudAuthException(val error: CloudAuthError) : Exception(error.text)

internal class HttpReply(val status: Int, val headers: Map<String, List<String>>, val body: String) {
    fun header(name: String): String? = headers.entries.firstOrNull { it.key.equals(name, true) }?.value?.firstOrNull()
    fun cookies(): List<Pair<String, String>> = headers.entries.filter { it.key.equals("Set-Cookie", true) }
        .flatMap { it.value }.mapNotNull { line ->
            val pair = line.substringBefore(';')
            val name = pair.substringBefore('=').trim()
            if (name.isEmpty() || '=' !in pair) null else name to pair.substringAfter('=').trim()
        }
}

internal fun interface HttpTransport {
    fun execute(method: String, url: String, headers: Map<String, String>, body: String?): HttpReply
}

internal object UrlConnectionTransport : HttpTransport {
    override fun execute(method: String, url: String, headers: Map<String, String>, body: String?): HttpReply {
        val connection = URL(url).openConnection() as HttpURLConnection
        try {
            connection.instanceFollowRedirects = false
            connection.connectTimeout = 20_000
            // A full khatma is several megabytes and the server takes a while to store it.
            connection.readTimeout = 120_000
            connection.requestMethod = method
            headers.forEach { (name, value) -> connection.setRequestProperty(name, value) }
            body?.let {
                val bytes = it.toByteArray()
                connection.doOutput = true
                // Stream the body instead of buffering a second copy in memory.
                connection.setFixedLengthStreamingMode(bytes.size)
                connection.outputStream.use { stream -> stream.write(bytes) }
            }
            val status = connection.responseCode
            val stream = if (status >= 400) connection.errorStream else connection.inputStream
            val text = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            return HttpReply(status, connection.headerFields.filterKeys { it != null }, text)
        } finally {
            connection.disconnect()
        }
    }
}

/**
 * Signs a person in or registers them inside the app and returns an OAuth authorization code.
 *
 * It talks to the same Better Auth endpoints the hosted sign-in page uses, so no browser opens and the server
 * needs no change. Cookies live in memory for this one exchange; the password is never stored. The caller
 * exchanges the returned code for tokens with its own PKCE verifier.
 */
internal class CloudAuthClient(
    private val origin: String,
    private val issuer: String,
    private val clientId: String,
    private val transport: HttpTransport = UrlConnectionTransport,
) {
    private val redirect = "$origin/auth/mobile-callback"

    fun authorizeUrl(challenge: String, state: String): String = "$issuer/oauth2/authorize?" + form(
        listOf(
            "client_id" to clientId, "redirect_uri" to redirect, "response_type" to "code",
            "scope" to "openid profile email offline_access", "resource" to origin,
            "code_challenge" to challenge, "code_challenge_method" to "S256", "state" to state,
        ),
    )

    fun authorize(email: String, password: String, create: Boolean, challenge: String, state: String): String {
        validate(email, password)
        val jar = linkedMapOf<String, String>()

        // 1. Start without a session: the server answers with the signed query its login page would receive.
        val started = send("GET", authorizeUrl(challenge, state), null, jar, json = false)
        // Depending on request headers the server answers with a 302 Location or a 200 `{redirect, url}` body.
        val location = when (started.status) {
            in 300..399 -> started.header("Location")
            200 -> redirectOf(started)?.toString()
            else -> null
        }
        val signed = location?.let { signedQuery(resolve(it)) }
        signed ?: throw CloudAuthException(CloudAuthError.REJECTED)

        // 2. Create the account or sign in; the response sets the session cookie.
        val credentials = JSONObject().put("email", email).put("password", password)
        if (create) credentials.put("name", email.substringBefore('@'))
        val auth = post(if (create) "sign-up/email" else "sign-in/email", credentials, jar)
        if (create && runCatching { JSONObject(auth.body).optString("token") }.getOrDefault("").let { it.isBlank() || it == "null" }) {
            throw CloudAuthException(CloudAuthError.VERIFICATION_REQUIRED)
        }

        // 3. Resume the authorization with that session, accepting consent for our own first-party app.
        var next = post("oauth2/continue", JSONObject().put("selected", true).put("oauth_query", signed), jar)
        repeat(4) {
            val target = redirectOf(next) ?: throw CloudAuthException(CloudAuthError.REJECTED)
            if (target.toString().startsWith(redirect)) return code(target, state)
            val query = if (target.path.orEmpty().endsWith("/consent")) signedQuery(target) else null
            query ?: throw CloudAuthException(CloudAuthError.REJECTED)
            next = post("oauth2/consent", JSONObject().put("accept", true).put("oauth_query", query), jar)
        }
        throw CloudAuthException(CloudAuthError.REJECTED)
    }

    private fun post(path: String, body: JSONObject, jar: MutableMap<String, String>): HttpReply {
        val reply = send("POST", "$issuer/$path", body.toString(), jar, json = true)
        if (reply.status != 200) throw failure(reply)
        return reply
    }

    private fun send(method: String, url: String, body: String?, jar: MutableMap<String, String>, json: Boolean): HttpReply {
        val headers = linkedMapOf("Accept" to "application/json")
        if (json) {
            headers["Content-Type"] = "application/json"
            // The auth server checks that state-changing requests come from a trusted origin: our Function's.
            headers["Origin"] = origin
        }
        if (jar.isNotEmpty()) headers["Cookie"] = jar.entries.sortedBy { it.key }.joinToString("; ") { "${it.key}=${it.value}" }
        val reply = try {
            transport.execute(method, url, headers, body)
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: IOException) {
            throw CloudAuthException(CloudAuthError.CONNECTION)
        }
        for ((name, value) in reply.cookies()) if (value.isEmpty()) jar.remove(name) else jar[name] = value
        return reply
    }

    private fun failure(reply: HttpReply): CloudAuthException {
        if (reply.status == 429) return CloudAuthException(CloudAuthError.RATE_LIMITED)
        val code = runCatching { JSONObject(reply.body).optString("code") }.getOrDefault("").uppercase()
        return CloudAuthException(
            when (code) {
                "INVALID_EMAIL_OR_PASSWORD", "INVALID_PASSWORD", "USER_NOT_FOUND" -> CloudAuthError.INVALID_CREDENTIALS
                "USER_ALREADY_EXISTS", "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" -> CloudAuthError.EMAIL_TAKEN
                "PASSWORD_TOO_SHORT", "PASSWORD_TOO_LONG" -> CloudAuthError.WEAK_PASSWORD
                "INVALID_EMAIL" -> CloudAuthError.INVALID_EMAIL
                "EMAIL_NOT_VERIFIED" -> CloudAuthError.VERIFICATION_REQUIRED
                else -> if (reply.status == 401) CloudAuthError.INVALID_CREDENTIALS else CloudAuthError.REJECTED
            },
        )
    }

    private fun resolve(value: String): URI = URI(origin).resolve(value)

    private fun redirectOf(reply: HttpReply): URI? =
        runCatching { resolve(JSONObject(reply.body).getString("url")) }.getOrNull()

    private fun code(url: URI, state: String): String {
        val items = parse(url.rawQuery)
        if (items.any { it.first == "error" } || items.firstOrNull { it.first == "state" }?.second != state) {
            throw CloudAuthException(CloudAuthError.REJECTED)
        }
        return items.firstOrNull { it.first == "code" }?.second?.takeIf { it.isNotEmpty() }
            ?: throw CloudAuthException(CloudAuthError.REJECTED)
    }

    companion object {
        const val MINIMUM_PASSWORD_LENGTH = 8

        fun validate(email: String, password: String) {
            val at = email.indexOf('@')
            val domain = email.substring(at + 1)
            val valid = at > 0 && email.indexOf('@', at + 1) < 0 && '.' in domain && !domain.startsWith('.') &&
                !domain.endsWith('.') && ' ' !in email
            if (!valid) throw CloudAuthException(CloudAuthError.INVALID_EMAIL)
            if (password.length < MINIMUM_PASSWORD_LENGTH) throw CloudAuthException(CloudAuthError.WEAK_PASSWORD)
        }

        /** The part of the login redirect's query the server signed: `sig`, `ba_param`, and the names it lists. */
        fun signedQuery(url: URI): String? {
            val items = parse(url.rawQuery)
            if (items.none { it.first == "sig" }) return null
            val signed = items.filter { it.first == "ba_param" }.map { it.second }.toSet()
            if (signed.isEmpty()) return null
            return form(items.filter { it.first == "sig" || it.first == "ba_param" || it.first in signed })
        }

        private fun parse(query: String?): List<Pair<String, String>> = query.orEmpty().split('&').filter { it.isNotEmpty() }.map {
            URLDecoder.decode(it.substringBefore('='), "UTF-8") to URLDecoder.decode(it.substringAfter('=', ""), "UTF-8")
        }

        /** `application/x-www-form-urlencoded`, matching JavaScript's `URLSearchParams`. */
        fun form(items: List<Pair<String, String>>): String = items.joinToString("&") {
            "${URLEncoder.encode(it.first, "UTF-8")}=${URLEncoder.encode(it.second, "UTF-8")}"
        }
    }
}
