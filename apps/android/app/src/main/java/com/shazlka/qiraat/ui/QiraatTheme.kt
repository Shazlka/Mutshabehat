package com.shazlka.qiraat.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val QiraatColors = lightColorScheme(
    primary = Color(0xFF725C36),
    onPrimary = Color.White,
    background = Color(0xFFF3EBDD),
    onBackground = Color(0xFF2B241A),
    surface = Color(0xFFFFFCF5),
    onSurface = Color(0xFF2B241A),
    outline = Color(0xFF9C835A),
)

@Composable
fun QiraatTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = QiraatColors, content = content)
}
