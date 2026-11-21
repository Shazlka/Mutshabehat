package com.shazlka.qiraat.settings

import android.content.SharedPreferences
import androidx.compose.ui.graphics.Color

enum class AppLanguage(val code: String, val title: String) {
    ARABIC("ar", "العربية"),
    ENGLISH("en", "English");

    companion object {
        const val STORAGE_KEY = "app:language:v1"
        fun from(code: String): AppLanguage = entries.firstOrNull { it.code == code } ?: ARABIC
    }
}

enum class MushafAppearance(
    val code: String,
    val titleAr: String,
    val titleEn: String,
    val paperColor: Color,
    val inkColor: Color,
    val brownColor: Color,
    val goldColor: Color,
) {
    SYSTEM(
        "system", "تلقائي", "System",
        paperColor = Color(0xFFFFFDF5),
        inkColor = Color(0xFF171717),
        brownColor = Color(0xFF59461D),
        goldColor = Color(0xFFC79E3D),
    ),
    LIGHT(
        "light", "فاتح", "Light",
        paperColor = Color(0xFFFFFDF5),
        inkColor = Color(0xFF171717),
        brownColor = Color(0xFF59461D),
        goldColor = Color(0xFFC79E3D),
    ),
    DARK(
        "dark", "داكن", "Dark",
        paperColor = Color(0xFF1C1B17),
        inkColor = Color(0xFFEBE8DC),
        brownColor = Color(0xFFD1BD8C),
        goldColor = Color(0xFFE0BF6B),
    ),
    SEPIA(
        "sepia", "بني دافئ", "Sepia",
        paperColor = Color(0xFFF4ECD8),
        inkColor = Color(0xFF2B2114),
        brownColor = Color(0xFF59461D),
        goldColor = Color(0xFFC79E3D),
    ),
    WHITE_PAGE(
        "whitePage", "صفحة بيضاء", "White Page",
        paperColor = Color.White,
        inkColor = Color.Black,
        brownColor = Color(0xFF333333),
        goldColor = Color(0xFFB88C33),
    ),
    BLACK_PAGE(
        "blackPage", "صفحة سوداء", "Black Page",
        paperColor = Color.Black,
        inkColor = Color.White,
        brownColor = Color(0xFFC7C7C7),
        goldColor = Color(0xFFD9B861),
    );

    companion object {
        const val STORAGE_KEY = "mushaf1441:theme:v1"
        fun from(code: String): MushafAppearance = entries.firstOrNull { it.code == code } ?: SYSTEM
    }
}

class SettingsPreferences(private val prefs: SharedPreferences) {
    companion object {
        const val KEEP_SCREEN_AWAKE_KEY = "reader:keep-screen-awake"
        const val AUTO_HIDE_FOOTER_KEY = "reader:auto-hide-footer"
    }

    var appearance: MushafAppearance
        get() = MushafAppearance.from(prefs.getString(MushafAppearance.STORAGE_KEY, MushafAppearance.SYSTEM.code) ?: MushafAppearance.SYSTEM.code)
        set(value) = prefs.edit().putString(MushafAppearance.STORAGE_KEY, value.code).apply()

    var language: AppLanguage
        get() = AppLanguage.from(prefs.getString(AppLanguage.STORAGE_KEY, AppLanguage.ARABIC.code) ?: AppLanguage.ARABIC.code)
        set(value) = prefs.edit().putString(AppLanguage.STORAGE_KEY, value.code).apply()

    var keepScreenAwake: Boolean
        get() = prefs.getBoolean(KEEP_SCREEN_AWAKE_KEY, true)
        set(value) = prefs.edit().putBoolean(KEEP_SCREEN_AWAKE_KEY, value).apply()

    var autoHideFooter: Boolean
        get() = prefs.getBoolean(AUTO_HIDE_FOOTER_KEY, false)
        set(value) = prefs.edit().putBoolean(AUTO_HIDE_FOOTER_KEY, value).apply()
}
