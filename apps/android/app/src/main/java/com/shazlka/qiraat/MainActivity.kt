package com.shazlka.qiraat

import android.content.Intent
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.compose.runtime.snapshotFlow
import androidx.core.view.WindowCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.shazlka.qiraat.cloud.CloudAccount
import com.shazlka.qiraat.cloud.CloudAccountScreen
import com.shazlka.qiraat.reader.ReaderScreen
import com.shazlka.qiraat.reader.ReaderState
import com.shazlka.qiraat.reader.ReaderViewModel
import com.shazlka.qiraat.ui.QiraatTheme
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    private val cloudAccount by lazy { CloudAccount.get(applicationContext) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        WindowCompat.setDecorFitsSystemWindows(window, true)
        handleCallback(intent)
        setContent {
            val accountId = cloudAccount.id
            val owner = remember(accountId) {
                object : ViewModelStoreOwner {
                    override val viewModelStore = ViewModelStore()
                }
            }
            DisposableEffect(owner) {
                onDispose { owner.viewModelStore.clear() }
            }
            val model: ReaderViewModel = viewModel(
                viewModelStoreOwner = owner,
                factory = ViewModelProvider.AndroidViewModelFactory.getInstance(application),
            )
            val preparing = cloudAccount.preparing
            LaunchedEffect(model, preparing) {
                if (accountId == null || preparing) return@LaunchedEffect
                repeatOnLifecycle(Lifecycle.State.RESUMED) {
                    snapshotFlow { model.state }.first { it is ReaderState.Ready }
                    while (isActive) {
                        cloudAccount.sync(model)
                        delay(CloudAccount.LIVE_SYNC_INTERVAL_MS)
                    }
                }
            }
            key(accountId) {
                QiraatTheme {
                    if (preparing && model.state is ReaderState.Ready) {
                        CloudAccountScreen(model, isSetup = true, onBack = {})
                    } else {
                        ReaderScreen(model)
                    }
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleCallback(intent)
    }

    private fun handleCallback(intent: Intent) {
        val uri = intent.data ?: return
        lifecycleScope.launch { cloudAccount.finishSignIn(uri) }
        setIntent(Intent(this, MainActivity::class.java))
    }
}
