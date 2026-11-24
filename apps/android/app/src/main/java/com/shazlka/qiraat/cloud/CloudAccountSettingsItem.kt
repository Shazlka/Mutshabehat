package com.shazlka.qiraat.cloud

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.shazlka.qiraat.reader.ReaderViewModel

fun addCloudAccountSettingsItem(scope: LazyListScope, model: ReaderViewModel) {
    scope.item(key = "cloud-account") {
        var showingAccount by rememberSaveable { mutableStateOf(false) }
        ElevatedCard(
            onClick = { showingAccount = true },
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("الحساب والمزامنة", modifier = Modifier.padding(16.dp))
        }
        if (showingAccount) {
            Dialog(
                onDismissRequest = { showingAccount = false },
                properties = DialogProperties(usePlatformDefaultWidth = false),
            ) {
                Surface(modifier = Modifier.fillMaxSize()) {
                    CloudAccountScreen(model) { showingAccount = false }
                }
            }
        }
    }
}
