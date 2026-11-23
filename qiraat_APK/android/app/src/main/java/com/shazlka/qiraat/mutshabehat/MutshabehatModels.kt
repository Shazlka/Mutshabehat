package com.shazlka.qiraat.mutshabehat

import java.util.UUID

data class PersonalPart(
    val id: String = UUID.randomUUID().toString(),
    val type: String = "normal",
    val text: String = "",
    val sortOrder: Int = 0,
)

data class PersonalVerse(
    val id: String = UUID.randomUUID().toString(),
    val groupId: String = "",
    val surah: String = "",
    val ayah: Int = 1,
    val label: String? = null,
    val sortOrder: Int = 0,
    val parts: List<PersonalPart> = emptyList(),
) {
    val text: String get() = parts.sortedBy { it.sortOrder }.joinToString(" ") { it.text }.trim()
}

data class PersonalGroup(
    val id: String = UUID.randomUUID().toString(),
    val title: String = "",
    val color: String = "#55b94f",
    val status: String = "draft",
    val favorite: Boolean = false,
    val completed: Boolean = false,
    val note: String? = null,
    val unote: String? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null,
    val verses: List<PersonalVerse> = emptyList(),
)

val partColors = mapOf(
    "shared" to 0xFF1D6835,
    "diff" to 0xFF8A6000,
    "diff2" to 0xFF6549A3,
    "diff3" to 0xFF157171,
    "addition" to 0xFF0C60A3,
    "unique" to 0xFFAB413E,
    "blank" to 0xFF173485,
    "normal" to 0xFF222222,
)
