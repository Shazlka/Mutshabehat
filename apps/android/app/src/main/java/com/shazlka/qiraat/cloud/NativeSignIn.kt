package com.shazlka.qiraat.cloud

import android.content.Context
import android.content.ContextWrapper
import android.net.Uri
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.ComponentDialog
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.shazlka.qiraat.ui.QiraatTheme
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlin.coroutines.Continuation
import kotlin.coroutines.intrinsics.suspendCoroutineUninterceptedOrReturn

/**
 * In-app email/password sign-in and sign-up that replaces the browser hand-off of the approved account module.
 *
 * `CloudAccount.openSignIn` builds the PKCE values and authorize URI, then calls [start] where it used to open a
 * Custom Tab. [start] shows a native dialog, obtains the authorization code through [CloudAuthClient], and gives
 * the code to the account's own `finishSignIn`, so token exchange, session storage, account details and the
 * setup screen stay exactly as before. Google keeps the browser because the provider requires its own page.
 *
 * The account is taken as `Any` and reached by reflection so this class does not depend on the shape of the
 * account module it is patched into.
 */
object NativeSignIn {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    /** Returns true when the sign-in was handled natively; false means the caller should open the browser. */
    @JvmStatic
    fun start(account: Any, context: Context, mode: Enum<*>, uri: Uri): Boolean {
        val create = when (mode.name) {
            "SIGN_IN" -> false
            "SIGN_UP" -> true
            else -> return false
        }
        val activity = generateSequence(context) { (it as? ContextWrapper)?.baseContext }
            .filterIsInstance<ComponentActivity>().firstOrNull() ?: return false
        val challenge = uri.getQueryParameter("code_challenge") ?: return false
        val state = uri.getQueryParameter("state") ?: return false
        val client = runCatching {
            CloudAuthClient(text(account, "getOrigin"), text(account, "getIssuer"), text(account, "getClientId"))
        }.getOrNull() ?: return false

        val dialog = ComponentDialog(activity)
        dialog.window?.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)
        dialog.setContentView(ComposeView(activity).apply {
            setContent {
                QiraatTheme {
                    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
                        SignInForm(create, dialog::dismiss) { email, password, creating ->
                            submit(account, client, email, password, creating, challenge, state)
                        }
                    }
                }
            }
        })
        dialog.show()
        return true
    }

    /** Runs the exchange; returns an Arabic error message, or null when the account finished signing in. */
    private suspend fun submit(
        account: Any, client: CloudAuthClient, email: String, password: String, create: Boolean,
        challenge: String, state: String,
    ): String? {
        val code = try {
            withContext(Dispatchers.IO) { client.authorize(email.trim(), password, create, challenge, state) }
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (failure: CloudAuthException) {
            return failure.error.text
        } catch (_: Exception) {
            return CloudAuthError.REJECTED.text
        }
        val callback = Uri.Builder().scheme("com.shazlka.qiraat").authority("cloud").path("/callback")
            .appendQueryParameter("code", code).appendQueryParameter("state", state).build()
        return try {
            finish(account, callback)
            null
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            CloudAuthError.REJECTED.text
        }
    }

    private fun text(account: Any, getter: String): String = account.javaClass.getMethod(getter).invoke(account) as String

    private suspend fun finish(account: Any, callback: Uri) {
        val method = account.javaClass.getMethod("finishSignIn", Uri::class.java, Continuation::class.java)
        suspendCoroutineUninterceptedOrReturn<Any?> { continuation -> method.invoke(account, callback, continuation) }
    }

    @Composable
    private fun SignInForm(
        initialCreate: Boolean,
        onClose: () -> Unit,
        onSubmit: suspend (String, String, Boolean) -> String?,
    ) {
        var creating by remember { mutableStateOf(initialCreate) }
        var email by remember { mutableStateOf("") }
        var password by remember { mutableStateOf("") }
        var busy by remember { mutableStateOf(false) }
        var error by remember { mutableStateOf<String?>(null) }

        fun submit() {
            if (busy || email.isBlank() || password.isEmpty()) return
            busy = true
            error = null
            scope.launch {
                val failure = onSubmit(email, password, creating)
                busy = false
                if (failure == null) onClose() else error = failure
            }
        }

        Surface(shape = MaterialTheme.shapes.extraLarge, tonalElevation = 6.dp) {
            Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    if (creating) "إنشاء حساب جديد" else "تسجيل الدخول",
                    style = MaterialTheme.typography.titleLarge,
                )
                Text(
                    "سجّل مرة واحدة واستخدم الحساب نفسه على iPhone وAndroid لمزامنة الختمة والحفظ فورًا.",
                    style = MaterialTheme.typography.bodySmall,
                )
                OutlinedTextField(
                    value = email, onValueChange = { email = it }, singleLine = true, enabled = !busy,
                    modifier = Modifier.fillMaxWidth(), label = { Text("البريد الإلكتروني") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next),
                )
                OutlinedTextField(
                    value = password, onValueChange = { password = it }, singleLine = true, enabled = !busy,
                    modifier = Modifier.fillMaxWidth(), label = { Text("كلمة المرور (٨ أحرف على الأقل)") },
                    visualTransformation = PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Go),
                    keyboardActions = KeyboardActions(onGo = { submit() }),
                )
                error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
                Button(
                    onClick = { submit() }, modifier = Modifier.fillMaxWidth(),
                    enabled = !busy && email.isNotBlank() && password.isNotEmpty(),
                ) {
                    if (busy) CircularProgressIndicator(Modifier.padding(end = 8.dp), strokeWidth = 2.dp)
                    Text(if (creating) "إنشاء حساب" else "تسجيل الدخول")
                }
                TextButton(onClick = { creating = !creating; error = null }, enabled = !busy) {
                    Text(if (creating) "لديك حساب؟ سجّل الدخول" else "ليس لديك حساب؟ أنشئ حسابًا")
                }
                TextButton(onClick = onClose, enabled = !busy, modifier = Modifier.fillMaxWidth()) { Text("إلغاء") }
            }
        }
    }
}
