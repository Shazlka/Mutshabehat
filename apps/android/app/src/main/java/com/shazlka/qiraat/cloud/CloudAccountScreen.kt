package com.shazlka.qiraat.cloud

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.FilterChip
import androidx.compose.material3.OutlinedTextField
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.shazlka.qiraat.reader.ReaderViewModel
import kotlinx.coroutines.launch
import java.text.DateFormat
import java.util.Date

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CloudAccountScreen(model: ReaderViewModel, isSetup: Boolean = false, onBack: () -> Unit) {
    val account = model.cloudAccount
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var confirmingCopy by remember { mutableStateOf(false) }
    var creating by remember { mutableStateOf(false) }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    fun submit() {
        if (account.busy || email.isBlank() || password.isEmpty()) return
        val (address, secret, create) = Triple(email, password, creating)
        scope.launch {
            account.signIn(address, secret, create)
            if (account.id != null) password = ""
        }
    }
    BackHandler(enabled = !isSetup, onBack = onBack)
    Scaffold(topBar = {
        TopAppBar(
            title = { Text("الحساب والمزامنة") },
            navigationIcon = { if (!isSetup) TextButton(onClick = onBack) { Text("رجوع") } },
        )
    }) { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            when {
                !account.configured -> Text("خدمة المزامنة غير مهيأة في هذا الإصدار.")
                account.id == null -> {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FilterChip(selected = !creating, onClick = { creating = false }, label = { Text("تسجيل الدخول") })
                        FilterChip(selected = creating, onClick = { creating = true }, label = { Text("حساب جديد") })
                    }
                    OutlinedTextField(
                        value = email, onValueChange = { email = it }, singleLine = true, modifier = Modifier.fillMaxWidth(),
                        label = { Text("البريد الإلكتروني") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next),
                    )
                    OutlinedTextField(
                        value = password, onValueChange = { password = it }, singleLine = true, modifier = Modifier.fillMaxWidth(),
                        label = { Text("كلمة المرور (٨ أحرف على الأقل)") },
                        visualTransformation = PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Go),
                        keyboardActions = KeyboardActions(onGo = { submit() }),
                    )
                    Button(
                        onClick = { submit() }, modifier = Modifier.fillMaxWidth(),
                        enabled = !account.busy && email.isNotBlank() && password.isNotEmpty(),
                    ) { Text(if (creating) "إنشاء حساب" else "تسجيل الدخول") }
                    Text("سجّل مرة واحدة واستخدم الحساب نفسه على iPhone وAndroid لمزامنة الختمة والحفظ فورًا. لا يُفتح المتصفح، وكلمة المرور لا تُحفظ على الجهاز.",
                        style = MaterialTheme.typography.bodySmall)
                    TextButton(onClick = { account.openSignIn(context) }, enabled = !account.busy) {
                        Text("المتابعة بحساب Google")
                    }
                    Text("Google فقط يفتح صفحة تسجيل الدخول من Google.", style = MaterialTheme.typography.bodySmall)
                }
                else -> {
                    if (isSetup) {
                        Text("يمكنك نسخ تقدّم الضيف قبل فتح المصحف. إذا كان لديك تقدّم على جهاز آخر، اختر المتابعة لمزامنته.")
                        Button(onClick = model::finishCloudSetup, enabled = !account.busy) { Text("متابعة") }
                    }
                    Button(onClick = { scope.launch { account.sync(model) } }, enabled = !account.busy) {
                        Text("مزامنة الآن")
                    }
                    account.lastSync?.let { Text(DateFormat.getDateTimeInstance().format(Date(it))) }
                    TextButton(onClick = { confirmingCopy = true }, enabled = !account.busy) {
                        Text("نسخ تقدّم الضيف إلى الحساب")
                    }
                    Text("يمكن نسخ تقدّم الضيف إلى قسم فارغ في الحساب. تبقى نسخة الضيف على الجهاز.")
                    for (dataset in ProgressDataset.entries) {
                        if (dataset !in account.conflicts) continue
                        Text(dataset.title, style = MaterialTheme.typography.titleMedium)
                        Text("تغيّر التقدّم على الجهاز وفي السحابة. اختر النسخة التي تريد الاحتفاظ بها.")
                        TextButton(onClick = {
                            scope.launch { account.sync(model, dataset, CloudAccount.Resolution.DEVICE) }
                        }, enabled = !account.busy) { Text("استخدام تقدّم هذا الجهاز") }
                        TextButton(onClick = {
                            scope.launch { account.sync(model, dataset, CloudAccount.Resolution.CLOUD) }
                        }, enabled = !account.busy) { Text("استخدام تقدّم السحابة") }
                    }
                    TextButton(onClick = account::signOut, enabled = !account.busy) { Text("تسجيل الخروج") }
                }
            }
            if (account.busy) LinearProgressIndicator()
            account.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        }
    }
    if (confirmingCopy) {
        AlertDialog(
            onDismissRequest = { confirmingCopy = false },
            title = { Text("نسخ تقدّم الضيف إلى هذا الحساب؟") },
            confirmButton = {
                TextButton(onClick = {
                    confirmingCopy = false
                    scope.launch { account.sync(model, importGuest = true) }
                }) { Text("نسخ التقدّم") }
            },
            dismissButton = { TextButton(onClick = { confirmingCopy = false }) { Text("إلغاء") } },
        )
    }
}
