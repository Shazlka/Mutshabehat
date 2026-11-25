package com.shazlka.qiraat.cloud

import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.io.File
import java.io.IOException
import java.net.URLDecoder
import java.nio.file.Files
import java.util.concurrent.atomic.AtomicInteger

@RunWith(RobolectricTestRunner::class)
class SyncEngineTest {
    private val originalTransport = SyncEngine.transport

    @After
    fun restoreTransport() {
        SyncEngine.transport = originalTransport
    }

    class FakeSession(
        val id: String,
        val access: String,
        val refresh: String,
        val expiry: Long,
        val email: String? = "user@example.com",
        val name: String? = "User",
    )

    class FakeAccount(
        var session: FakeSession?,
        val origin: String = "https://sync.example.com",
        val issuer: String = "https://auth.example.com/neondb/auth",
        val clientId: String = "client-123",
        val directory: File = Files.createTempDirectory("qiraat-sync-test").toFile(),
    ) {
        var busy: Boolean = false
        var error: String? = null
        var lastSync: Long? = null
        var conflicts: Map<ProgressDataset, Any> = emptyMap()
        var signedOut: Boolean = false

        fun signOut() {
            if (busy) return
            signedOut = true
            session = null
            conflicts = emptyMap()
            error = null
        }

        @Suppress("unused")
        fun save(tokens: JSONObject, id: String, fallbackRefresh: String?, email: String?, name: String?) {
            val newRefresh = tokens.optString("refresh_token").ifBlank { fallbackRefresh.orEmpty() }
            val expiresIn = tokens.optLong("expires_in", 3600L)
            session = FakeSession(
                id = id,
                access = tokens.getString("access_token"),
                refresh = newRefresh,
                expiry = System.currentTimeMillis() + expiresIn * 1000L,
                email = email ?: session?.email,
                name = name ?: session?.name,
            )
        }
    }

    @Test
    fun `concurrent accessToken calls refresh only once with resource parameter`() = runBlocking {
        val expired = FakeSession("user-1", "stale-access", "rt-1", System.currentTimeMillis() - 5_000L)
        val account = FakeAccount(expired)
        val tokenCalls = AtomicInteger(0)
        val recordedForms = mutableListOf<Map<String, String>>()

        SyncEngine.transport = HttpTransport { _, url, _, body ->
            if (url.endsWith("/oauth2/token")) {
                tokenCalls.incrementAndGet()
                val form = parseForm(body.orEmpty())
                synchronized(recordedForms) { recordedForms.add(form) }
                Thread.sleep(40)
                HttpReply(
                    200,
                    emptyMap(),
                    """{"access_token":"fresh-access","refresh_token":"rt-2","expires_in":3600}""",
                )
            } else {
                HttpReply(404, emptyMap(), "")
            }
        }

        val results = (1..5).map {
            async {
                delay(it * 2L)
                SyncEngine.accessToken(account)
            }
        }.awaitAll()

        assertEquals(1, tokenCalls.get())
        assertEquals(List(5) { "fresh-access" }, results)
        assertEquals("rt-2", account.session?.refresh)
        val form = recordedForms.single()
        assertEquals("refresh_token", form["grant_type"])
        assertEquals("rt-1", form["refresh_token"])
        assertEquals("client-123", form["client_id"])
        assertEquals("https://sync.example.com", form["resource"])
    }

    @Test
    fun `invalid_grant clears dead session and surfaces expiry message`() = runBlocking {
        val expired = FakeSession("user-1", "stale-access", "dead-rt", System.currentTimeMillis() - 5_000L)
        val account = FakeAccount(expired).apply { busy = true }

        SyncEngine.transport = HttpTransport { _, _, _, _ ->
            HttpReply(400, emptyMap(), """{"error":"invalid_grant","error_description":"session not found"}""")
        }

        var thrown: Throwable? = null
        try {
            SyncEngine.accessToken(account)
        } catch (t: Throwable) {
            thrown = t
        }

        assertNotNull(thrown)
        assertTrue(account.signedOut)
        assertNull(account.session)
        assertFalse(account.busy)
        assertEquals("انتهت جلسة السحابة. يرجى تسجيل الدخول مرة أخرى.", account.error)
    }

    @Test
    fun `transient network failure during refresh preserves session`() = runBlocking {
        val expired = FakeSession("user-1", "stale-access", "good-rt", System.currentTimeMillis() - 5_000L)
        val account = FakeAccount(expired)

        SyncEngine.transport = HttpTransport { _, _, _, _ ->
            throw IOException("offline")
        }

        var thrown: Throwable? = null
        try {
            SyncEngine.accessToken(account)
        } catch (t: Throwable) {
            thrown = t
        }

        assertNotNull(thrown)
        assertFalse(account.signedOut)
        assertEquals("good-rt", account.session?.refresh)
    }

    @Test
    fun `requestWithRefresh retries once with forced refresh on 401`() = runBlocking {
        val active = FakeSession("user-1", "revoked-access", "rt-1", System.currentTimeMillis() + 3_600_000L)
        val account = FakeAccount(active)
        val progressCalls = AtomicInteger(0)

        SyncEngine.transport = HttpTransport { _, url, headers, _ ->
            when {
                url.endsWith("/oauth2/token") -> HttpReply(
                    200,
                    emptyMap(),
                    """{"access_token":"new-access","refresh_token":"rt-2","expires_in":3600}""",
                )
                url.contains("/v1/progress/khatma") -> {
                    val callIndex = progressCalls.incrementAndGet()
                    if (callIndex == 1) {
                        assertEquals("Bearer revoked-access", headers["Authorization"])
                        HttpReply(401, emptyMap(), """{"error":"invalid_token"}""")
                    } else {
                        assertEquals("Bearer new-access", headers["Authorization"])
                        HttpReply(200, emptyMap(), """{"revision":7,"unchanged":true}""")
                    }
                }
                else -> HttpReply(404, emptyMap(), "")
            }
        }

        val (reply, latestAccess) = SyncEngine.requestWithRefresh(account, "revoked-access", "https://sync.example.com/v1/progress/khatma?known=7")
        assertEquals(2, progressCalls.get())
        assertEquals("new-access", latestAccess)
        assertEquals(7, reply.getInt("revision"))
        assertEquals("rt-2", account.session?.refresh)
    }

    private fun parseForm(raw: String): Map<String, String> =
        raw.split('&').filter { it.isNotEmpty() }.associate {
            URLDecoder.decode(it.substringBefore('='), "UTF-8") to URLDecoder.decode(it.substringAfter('=', ""), "UTF-8")
        }
}
