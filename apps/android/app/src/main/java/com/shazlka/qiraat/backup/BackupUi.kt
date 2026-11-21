package com.shazlka.qiraat.backup

import android.content.Context
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@Composable
fun BackupSettingsScreen(
    backupService: BackupService,
    onBack: () -> Unit,
) {
    val context = LocalContext.current
    var message by remember { mutableStateOf<String?>(null) }
    var pendingImportJson by remember { mutableStateOf<String?>(null) }
    var showImportChoiceDialog by remember { mutableStateOf(false) }

    val createDocLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.CreateDocument("application/json"),
    ) { uri: Uri? ->
        if (uri != null) {
            runCatching {
                val json = backupService.exportMemorizationToJson()
                context.contentResolver.openOutputStream(uri)?.use { stream ->
                    stream.write(json.toByteArray(Charsets.UTF_8))
                }
                message = "تم تصدير ملف الحفظ بنجاح"
            }.onFailure {
                message = "تعذر تصدير الملف: ${it.message}"
            }
        }
    }

    val openDocLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument(),
    ) { uri: Uri? ->
        if (uri != null) {
            runCatching {
                val content = context.contentResolver.openInputStream(uri)?.use { stream ->
                    stream.bufferedReader(Charsets.UTF_8).readText()
                } ?: ""
                backupService.parseExport(content) // validate
                pendingImportJson = content
                showImportChoiceDialog = true
            }.onFailure {
                message = "الملف غير صالح كنسخة احتياطية"
            }
        }
    }

    Scaffold(
        topBar = {
            Row(
                Modifier.fillMaxWidth().height(56.dp).padding(horizontal = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                TextButton(onClick = onBack) { Text("رجوع") }
                Text(
                    "النسخ الاحتياطي والاستعادة",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.weight(1f),
                    textAlign = TextAlign.Center,
                )
                Spacer(Modifier.width(48.dp))
            }
        },
    ) { padding ->
        LazyColumn(
            Modifier.fillMaxSize().padding(padding).padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            contentPadding = PaddingValues(vertical = 12.dp),
        ) {
            // Status Card
            item {
                ElevatedCard(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text("حالة البيانات المحلية", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("بيانات الحفظ", fontSize = 14.sp)
                            Text("${backupService.memorizationStore.allRecords.size} آية مسجلة", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold)
                        }
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("سجل القراءة", fontSize = 14.sp)
                            Text("الختمة ${backupService.readingStore.getOrCreateActiveKhatma().khatmaNumber}", color = Color(0xFF2E7D32), fontWeight = FontWeight.SemiBold)
                        }
                        Text(
                            "يتم حفظ جميع التغييرات تلقائيًا ومحليًا في التخزين الخاص بالتطبيق بدون الحاجة لاتصال بالإنترنت.",
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }

            // Export / Import Memorization JSON
            item {
                ElevatedCard(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text("تصدير واستيراد الحفظ (JSON)", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        Text(
                            "يتيح لك ملف JSON نقل تقدم الحفظ وسجل المراجعة بين أجهزتك أو الاحتفاظ بنسخة مستقلة.",
                            fontSize = 13.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )

                        Button(
                            onClick = {
                                val dateStr = DateTimeFormatter.ofPattern("yyyy-MM-dd").withZone(ZoneId.systemDefault()).format(java.time.Instant.now())
                                createDocLauncher.launch("quran-memorization-$dateStr.json")
                            },
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Text("تصدير ملف الحفظ (JSON)")
                        }

                        OutlinedButton(
                            onClick = {
                                openDocLauncher.launch(arrayOf("application/json", "*/*"))
                            },
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Text("استيراد ملف الحفظ (JSON)")
                        }
                    }
                }
            }
        }
    }

    if (showImportChoiceDialog && pendingImportJson != null) {
        val json = pendingImportJson!!
        AlertDialog(
            onDismissRequest = {
                showImportChoiceDialog = false
                pendingImportJson = null
            },
            title = { Text("طريقة الاستيراد") },
            text = {
                Text("كيف ترغب في تطبيق بيانات الحفظ المستوردة؟")
            },
            confirmButton = {
                Button(onClick = {
                    showImportChoiceDialog = false
                    pendingImportJson = null
                    runCatching {
                        backupService.importMemorizationJson(json, MemorizationRestoreMode.MERGE)
                        message = "تم دمج بيانات الحفظ بنجاح"
                    }.onFailure {
                        message = "تعذر استيراد البيانات: ${it.message}"
                    }
                }) { Text("دمج مع الحالي (الأحدث يفوز)") }
            },
            dismissButton = {
                Row {
                    TextButton(onClick = {
                        showImportChoiceDialog = false
                        pendingImportJson = null
                    }) { Text("إلغاء") }
                    TextButton(onClick = {
                        showImportChoiceDialog = false
                        pendingImportJson = null
                        runCatching {
                            backupService.importMemorizationJson(json, MemorizationRestoreMode.REPLACE)
                            message = "تم استبدال بيانات الحفظ بالكامل"
                        }.onFailure {
                            message = "تعذر استبدال البيانات: ${it.message}"
                        }
                    }) { Text("استبدال الحالي", color = MaterialTheme.colorScheme.error) }
                }
            },
        )
    }

    message?.let { msg ->
        AlertDialog(
            onDismissRequest = { message = null },
            title = { Text("النسخ الاحتياطي") },
            text = { Text(msg) },
            confirmButton = { TextButton(onClick = { message = null }) { Text("حسنًا") } },
        )
    }
}
