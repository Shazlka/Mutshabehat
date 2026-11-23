package com.shazlka.qiraat.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import com.shazlka.qiraat.settings.MushafAppearance

private val LightColors = lightColorScheme(
    primary = Color(0xFF725C36),
    onPrimary = Color.White,
    background = Color(0xFFFFFDF5),
    onBackground = Color(0xFF171717),
    surface = Color(0xFFFFFCF5),
    onSurface = Color(0xFF171717),
    outline = Color(0xFF9C835A),
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFFD1BD8C),
    onPrimary = Color(0xFF1C1B17),
    background = Color(0xFF1C1B17),
    onBackground = Color(0xFFEBE8DC),
    surface = Color(0xFF24231E),
    onSurface = Color(0xFFEBE8DC),
    outline = Color(0xFF706550),
)

private val SepiaColors = lightColorScheme(
    primary = Color(0xFF725C36),
    onPrimary = Color.White,
    background = Color(0xFFF4ECD8),
    onBackground = Color(0xFF2B2114),
    surface = Color(0xFFF9F4E8),
    onSurface = Color(0xFF2B2114),
    outline = Color(0xFF9C835A),
)

private val WhitePageColors = lightColorScheme(
    primary = Color(0xFF333333),
    onPrimary = Color.White,
    background = Color.White,
    onBackground = Color.Black,
    surface = Color(0xFFFBFBFB),
    onSurface = Color.Black,
    outline = Color(0xFFB88C33),
)

private val BlackPageColors = darkColorScheme(
    primary = Color(0xFFC7C7C7),
    onPrimary = Color.Black,
    background = Color.Black,
    onBackground = Color.White,
    surface = Color(0xFF111111),
    onSurface = Color.White,
    outline = Color(0xFFD9B861),
)

@Composable
fun QiraatTheme(
    appearance: MushafAppearance = MushafAppearance.SYSTEM,
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val colorScheme = when (appearance) {
        MushafAppearance.SYSTEM -> if (darkTheme) DarkColors else LightColors
        MushafAppearance.LIGHT -> LightColors
        MushafAppearance.DARK -> DarkColors
        MushafAppearance.SEPIA -> SepiaColors
        MushafAppearance.WHITE_PAGE -> WhitePageColors
        MushafAppearance.BLACK_PAGE -> BlackPageColors
    }
    MaterialTheme(colorScheme = colorScheme, content = content)
}
