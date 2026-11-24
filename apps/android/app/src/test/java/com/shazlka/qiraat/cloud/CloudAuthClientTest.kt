package com.shazlka.qiraat.cloud

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.io.IOException
import java.net.URI

/** Drives the in-app sign-in against a scripted server: no network, no browser. */
@RunWith(RobolectricTestRunner::class)
class CloudAuthClientTest {
    private class Call(val method: String, val url: String, val headers: Map<String, String>, val body: String?)

    private val calls = mutableListOf<Call>()
    private val loginRedirect = "https://sync.example.test/auth/sign-in?response_type=code&client_id=client-1&state=S1&utm=drop" +
        "&exp=9&ba_iat=8&ba_param=ba_iat&ba_param=ba_param&ba_param=client_id&ba_param=exp&ba_param=response_type" +
        "&ba_param=state&sig=abc%3D%3D"

    private fun json(vararg pairs: Pair<String, Any?>) = JSONObject(pairs.toMap().mapValues { it.value ?: JSONObject.NULL }).toString()

    private fun client(handler: (Call) -> HttpReply) = CloudAuthClient(
        "https://sync.example.test", "https://auth.example.test/db/auth", "client-1",
    ) { method, url, headers, body -> Call(method, url, headers, body).also(calls::add).let(handler) }

    private fun reply(status: Int, body: String = "", vararg headers: Pair<String, String>) =
        HttpReply(status, headers.groupBy({ it.first }, { it.second }), body)

    private fun failure(block: () -> Unit): CloudAuthError {
        try {
            block()
        } catch (error: CloudAuthException) {
            return error.error
        }
        fail("expected a CloudAuthException")
        throw AssertionError()
    }

    @Test
    fun signInRunsTheWholeFlowWithoutABrowser() {
        val code = client { call ->
            when {
                call.url.contains("oauth2/authorize") -> reply(302, "", "Location" to loginRedirect)
                call.url.endsWith("sign-in/email") -> reply(200, json("token" to "t"), "Set-Cookie" to "session_token=tok123; Path=/; Secure; HttpOnly")
                call.url.endsWith("oauth2/continue") ->
                    reply(200, json("redirect" to true, "url" to "https://sync.example.test/auth/mobile-callback?code=CODE9&state=S1"))
                else -> reply(404)
            }
        }.authorize("a@b.co", "12345678", create = false, challenge = "ch", state = "S1")
        assertEquals("CODE9", code)
        assertEquals(3, calls.size)
        assertTrue(calls[0].url.contains("code_challenge=ch") && calls[0].url.contains("code_challenge_method=S256"))
        assertEquals("https://sync.example.test", calls[1].headers["Origin"])
        assertNull(calls[1].headers["Cookie"])
        assertEquals("session_token=tok123", calls[2].headers["Cookie"])
        val body = JSONObject(calls[2].body!!)
        assertTrue(body.getBoolean("selected"))
        val query = body.getString("oauth_query")
        assertTrue(query.contains("sig=abc%3D%3D"))
        assertTrue(query.contains("client_id=client-1"))
        assertFalse("unsigned parameters must not be forwarded", query.contains("utm"))
    }

    @Test
    fun authorizeAnsweredWithJsonBodyInsteadOfRedirectStillWorks() {
        val code = client { call ->
            when {
                call.url.contains("oauth2/authorize") -> reply(200, json("redirect" to true, "url" to loginRedirect))
                call.url.endsWith("sign-up/email") -> reply(200, json("token" to "t"))
                else -> reply(200, json("redirect" to true, "url" to "https://sync.example.test/auth/mobile-callback?code=J1&state=S1"))
            }
        }.authorize("a@b.co", "12345678", create = true, challenge = "c", state = "S1")
        assertEquals("J1", code)
    }

    @Test
    fun signUpWithoutATokenAsksToVerifyEmail() {
        val error = failure {
            client { call ->
                if (call.url.contains("authorize")) reply(302, "", "Location" to loginRedirect) else reply(200, json("token" to null))
            }.authorize("a@b.co", "12345678", create = true, challenge = "c", state = "S1")
        }
        assertEquals(CloudAuthError.VERIFICATION_REQUIRED, error)
        assertTrue(calls.last().url.endsWith("sign-up/email"))
    }

    @Test
    fun consentIsAcceptedWhenTheServerAsksForIt() {
        val code = client { call ->
            when {
                call.url.contains("oauth2/authorize") -> reply(302, "", "Location" to loginRedirect)
                call.url.endsWith("sign-in/email") -> reply(200, json("token" to "t"))
                call.url.endsWith("oauth2/continue") ->
                    reply(200, json("redirect" to true, "url" to "/auth/consent?client_id=client-1&sig=zz&ba_param=client_id&ba_param=ba_param"))
                call.url.endsWith("oauth2/consent") ->
                    reply(200, json("redirect" to true, "url" to "https://sync.example.test/auth/mobile-callback?code=OK&state=S1"))
                else -> reply(404)
            }
        }.authorize("a@b.co", "12345678", create = false, challenge = "c", state = "S1")
        assertEquals("OK", code)
        assertTrue(JSONObject(calls.last().body!!).getBoolean("accept"))
    }

    @Test
    fun wrongPasswordIsReportedAndStopsTheFlow() {
        val error = failure {
            client { call ->
                if (call.url.contains("authorize")) reply(302, "", "Location" to loginRedirect)
                else reply(401, json("code" to "INVALID_EMAIL_OR_PASSWORD"))
            }.authorize("a@b.co", "wrong-pass", create = false, challenge = "c", state = "S1")
        }
        assertEquals(CloudAuthError.INVALID_CREDENTIALS, error)
        assertEquals("no continue request after a failed sign-in", 2, calls.size)
    }

    @Test
    fun existingEmailAndRateLimitAreMapped() {
        for ((status, code, expected) in listOf(
            Triple(422, "USER_ALREADY_EXISTS", CloudAuthError.EMAIL_TAKEN),
            Triple(429, "RATE_LIMIT", CloudAuthError.RATE_LIMITED),
        )) {
            val error = failure {
                client { call ->
                    if (call.url.contains("authorize")) reply(302, "", "Location" to loginRedirect) else reply(status, json("code" to code))
                }.authorize("a@b.co", "12345678", create = true, challenge = "c", state = "S1")
            }
            assertEquals(expected, error)
        }
    }

    @Test
    fun stateMismatchInTheFinalRedirectIsRejected() {
        val error = failure {
            client { call ->
                when {
                    call.url.contains("oauth2/authorize") -> reply(302, "", "Location" to loginRedirect)
                    call.url.endsWith("sign-in/email") -> reply(200, json("token" to "t"))
                    else -> reply(200, json("redirect" to true, "url" to "https://sync.example.test/auth/mobile-callback?code=X&state=OTHER"))
                }
            }.authorize("a@b.co", "12345678", create = false, challenge = "c", state = "S1")
        }
        assertEquals(CloudAuthError.REJECTED, error)
    }

    @Test
    fun networkFailureIsReportedAsConnection() {
        val error = failure {
            CloudAuthClient("https://sync.example.test", "https://auth.example.test/db/auth", "c") { _, _, _, _ -> throw IOException("offline") }
                .authorize("a@b.co", "12345678", create = false, challenge = "c", state = "S1")
        }
        assertEquals(CloudAuthError.CONNECTION, error)
    }

    @Test
    fun credentialsAreValidatedBeforeAnyRequest() {
        val cases = listOf(
            Triple("nope", "12345678", CloudAuthError.INVALID_EMAIL),
            Triple("a@b", "12345678", CloudAuthError.INVALID_EMAIL),
            Triple("a@b.co", "short", CloudAuthError.WEAK_PASSWORD),
        )
        for ((email, password, expected) in cases) {
            assertEquals(expected, failure {
                client { reply(500) }.authorize(email, password, create = false, challenge = "c", state = "s")
            })
        }
        assertTrue(calls.isEmpty())
    }

    @Test
    fun formEncodingMatchesUrlSearchParams() {
        assertEquals("a%3D=a+b%2Bc%26%C3%A9%7E*", CloudAuthClient.form(listOf("a=" to "a b+c&é~*")))
        assertNull(CloudAuthClient.signedQuery(URI("https://x.test/auth/sign-in?state=1")))
    }
}
