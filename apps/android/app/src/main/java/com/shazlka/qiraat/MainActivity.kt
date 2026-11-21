package com.shazlka.qiraat

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.core.view.WindowCompat
import com.shazlka.qiraat.reader.ReaderScreen
import com.shazlka.qiraat.ui.QiraatTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, true)
        setContent { QiraatTheme { ReaderScreen() } }
    }
}
