package com.shazlka.qiraat.reader

import android.graphics.Typeface
import androidx.compose.animation.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.shazlka.qiraat.core.*

data class WordSelection(val word: MushafWord, val selection: QiraatSelection)

object QiraatThemeColors {
    val mushafBrown = Color(0xFF8D6E63)
    val cardStroke = Color(0x1F000000)
    val cardFillLight = Color(0x08000000)
    val badgeInk = Color(0xFF8A6D3B)
    val badgeFill = Color(0x1A8A6D3B)
    val reviewInk = Color(0xFFC2410C)
    val reviewFill = Color(0x1FC2410C)
    val progressGreen = Color(0xFF16A34A)
    val cautionOrange = Color(0xFFEA580C)
}

/**
 * Loads the bundled KFGQPC Uthmanic Script HAFS font for true Arabic Quran typography.
 */
@Composable
fun rememberUthmanicFont(): FontFamily {
    val context = LocalContext.current
    return remember {
        runCatching {
            FontFamily(Typeface.createFromAsset(context.assets, "fonts/uthmanic_hafs.otf"))
        }.getOrDefault(FontFamily.Default)
    }
}

/**
 * Loads the QCF page-specific glyph font from assets.
 */
@Composable
fun rememberPageFont(model: ReaderViewModel, page: Int): FontFamily {
    return remember(page) {
        runCatching {
            FontFamily(model.fontStore.font(page))
        }.getOrDefault(FontFamily.Default)
    }
}

// MARK: - Qiraat Word Sheet (Exact port of iOS QiraatSheet.swift)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QiraatWordSheet(
    value: WordSelection,
    model: ReaderViewModel,
    onDismiss: () -> Unit,
    onCompare: () -> Unit
) {
    val uthmanicFont = rememberUthmanicFont()
    val pageFont = rememberPageFont(model, value.word.page)
    val catalog = model.qiraatStore.catalog
    val filter = model.qiraatFilter
    val surahName = model.surahNames[value.word.ayahKey.surah] ?: "سورة ${value.word.ayahKey.surah}"
    val canCompare = QiraatCompare.defaultPair(value.selection, catalog) != null

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = false),
        containerColor = MaterialTheme.colorScheme.surface
    ) {
        CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp)
                    .padding(bottom = 32.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                // Top Sheet Navigation Bar: Title + Close
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "القراءات العشر",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    TextButton(onClick = onDismiss) {
                        Text(
                            text = "إغلاق",
                            fontWeight = FontWeight.SemiBold,
                            color = QiraatThemeColors.mushafBrown
                        )
                    }
                }

                // Word Header: Surah, Ayah & Word Info on Right, Word Glyph on Left
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.3f))
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Text(
                                text = "سورة $surahName",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = QiraatThemeColors.mushafBrown
                            )
                            Text(
                                text = "الآية ${value.word.ayahKey.ayah} · الكلمة ${value.word.indexInAyah}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }

                        // Word glyph rendered in QCF / Uthmani font
                        Text(
                            text = value.word.textUthmani,
                            fontFamily = pageFont,
                            fontSize = 32.sp,
                            color = MaterialTheme.colorScheme.onSurface,
                            textAlign = TextAlign.Center
                        )
                    }
                }

                // Sheet Actions: Compare button if comparison available
                if (canCompare) {
                    OutlinedButton(
                        onClick = onCompare,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.outlinedButtonColors(
                            contentColor = MaterialTheme.colorScheme.primary
                        ),
                        border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.5f))
                    ) {
                        Icon(
                            imageVector = Icons.Default.CompareArrows,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(
                            text = "مقارنة القراءات",
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp
                        )
                    }
                }

                // Section 1: الفرش (Variant Cards)
                if (value.selection.variants.isNotEmpty()) {
                    Text(
                        text = "الفرش",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.padding(top = 4.dp)
                    )
                    value.selection.variants.forEach { variant ->
                        VariantCard(
                            variant = variant,
                            catalog = catalog,
                            filter = filter,
                            references = model.references.references(variant),
                            uthmanicFont = uthmanicFont
                        )
                    }
                }

                // Section 2: الأصول (Ruling Cards)
                if (value.selection.rulings.isNotEmpty()) {
                    Text(
                        text = "الأصول",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.padding(top = 4.dp)
                    )
                    value.selection.rulings.forEach { ruling ->
                        RulingCard(
                            ruling = ruling,
                            catalog = catalog,
                            filter = filter,
                            uthmanicFont = uthmanicFont
                        )
                    }
                }

                if (value.selection.variants.isEmpty() && value.selection.rulings.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 32.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "لا توجد خلافات مسجلة لهذه الكلمة في القراءات العشر",
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }
        }
    }
}

// MARK: - Variant Card (Exact port of iOS VariantCard.swift)

@Composable
fun VariantCard(
    variant: QiraatVariant,
    catalog: QiraatCatalog,
    filter: QiraatFilter,
    references: List<QiraatReference>,
    uthmanicFont: FontFamily
) {
    val performanceOnly = variant.isPerformanceOnly && variant.performanceNote != null
    val text = variant.uthmaniText ?: if (performanceOnly) variant.hafsText else variant.variantText

    val scopedReadingIds = remember(variant, filter) {
        when (filter) {
            QiraatFilter.All -> variant.readingIds
            is QiraatFilter.Reader -> variant.readingIds.filter { catalog.readerId(it) == filter.id }
            is QiraatFilter.Reading -> variant.readingIds.filter { it == filter.id }
        }.ifEmpty { variant.readingIds }
    }

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            // Top: Classification Line / Sub-category badge
            QiraatClassificationLine(variant = variant)

            // Split Matrix Row: 38% Word column on Right (RTL), 1.dp hairline divider, 62% Readers column on Left
            QiraatMatrixRow(
                wordColumn = {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(5.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        if (variant.endToken > variant.startToken) {
                            Text(
                                text = "الكلمات محل الخلاف",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = QiraatThemeColors.mushafBrown
                            )
                        }
                        variant.description?.trim()?.takeIf { it.isNotEmpty() }?.let { desc ->
                            QiraatDescriptorPill(text = desc)
                        }
                        Text(
                            text = text,
                            fontFamily = uthmanicFont,
                            fontSize = if (text.contains(" ")) 26.sp else 34.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface,
                            textAlign = TextAlign.Center,
                            lineHeight = 42.sp,
                            modifier = Modifier.fillMaxWidth()
                        )
                        val note = variant.performanceNote?.trim()
                        if (!note.isNullOrEmpty() && note != variant.description) {
                            Text(
                                text = note,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                },
                readersColumn = {
                    val groups = remember(variant, scopedReadingIds) {
                        variant.attributionByAction(scopedReadingIds, catalog)
                    }
                    if (groups.isEmpty()) {
                        val pills = remember(scopedReadingIds) {
                            rollupAuthorityPills(scopedReadingIds, catalog)
                        }
                        QiraatAttributionGrid(pills = pills, catalog = catalog)
                    } else {
                        val label = variant.performanceNote ?: differenceTypeLabelAr(variant.differenceType)
                        Column(
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            groups.forEach { group ->
                                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    val pills = remember(group) {
                                        rollupAuthorityPills(group.entries.map { it.authorityId }, catalog)
                                    }
                                    QiraatAttributionGrid(pills = pills, catalog = catalog)
                                    QiraatGroupPerformance(group = group, categoryAr = label)
                                }
                            }
                        }
                    }
                }
            )

            // References Row
            QiraatReferencesRow(references = references)

            // Needs Review Badge
            if (variant.verificationStatus == "NEEDS_MANUAL_REVIEW") {
                QiraatNeedsReviewBadge()
            }
        }
    }
}

// MARK: - Ruling Card (Exact port of iOS RulingCard.swift)

@Composable
fun RulingCard(
    ruling: QiraatRuling,
    catalog: QiraatCatalog,
    filter: QiraatFilter,
    uthmanicFont: FontFamily
) {
    val categoryColor = hexColor(ruling.color)
    val distinct = distinctRulingText(
        ruling.text,
        ruling.categoryAr,
        ruling.attribution(filter, catalog).map { it.action }
    )
    val scopedGroups = remember(ruling, filter) {
        ruling.attributionByAction(filter, catalog)
    }

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        color = categoryColor.copy(alpha = 0.06f),
        border = BorderStroke(1.dp, categoryColor)
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            // Top: Classification line + condition
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                QiraatClassificationLine(ruling = ruling)
                ruling.condition?.takeIf { it.isNotBlank() }?.let { cond ->
                    Text(
                        text = cond,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            // Split Matrix Row: 38% Word column on Right (RTL), 1.dp hairline divider, 62% Readers column on Left
            QiraatMatrixRow(
                wordColumn = {
                    if (ruling.baseText.isNotEmpty()) {
                        val shown = QiraatReadingForm.display(ruling.baseText)
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(5.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            if (ruling.endToken > ruling.startToken) {
                                Text(
                                    text = "الكلمات محل الخلاف",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = QiraatThemeColors.mushafBrown
                                )
                            }
                            if (distinct != null) {
                                QiraatDescriptorPill(text = distinct)
                            }
                            Text(
                                text = shown,
                                fontFamily = uthmanicFont,
                                fontSize = if (shown.contains(" ")) 26.sp else 34.sp,
                                fontWeight = FontWeight.Bold,
                                color = categoryColor,
                                textAlign = TextAlign.Center,
                                lineHeight = 42.sp,
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                    } else if (distinct != null) {
                        QiraatDescriptorPill(text = distinct)
                    }
                },
                readersColumn = {
                    Column(
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        scopedGroups.forEach { group ->
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                val pills = remember(group) {
                                    rollupAuthorityPills(group.entries.map { it.authorityId }, catalog)
                                }
                                QiraatAttributionGrid(pills = pills, catalog = catalog)
                                QiraatGroupPerformance(group = group, categoryAr = ruling.categoryAr)
                                // Show changed reading form if applicable
                                val changedForm = QiraatReadingForm.form(
                                    baseText = ruling.baseText,
                                    action = group.action,
                                    categoryCode = ruling.category
                                )
                                if (changedForm != null && changedForm != ruling.baseText) {
                                    Text(
                                        text = changedForm,
                                        fontFamily = uthmanicFont,
                                        fontSize = 18.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = categoryColor,
                                        modifier = Modifier.padding(top = 2.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            )

            // Alternate Reading Badge
            if (ruling.hasAlternateReading(filter, catalog)) {
                Surface(
                    shape = RoundedCornerShape(6.dp),
                    color = QiraatThemeColors.badgeFill
                ) {
                    Text(
                        text = "ذو وجهين (بخلف عنه) — الوجه الآخر جائز أيضًا",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = QiraatThemeColors.badgeInk,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }

            // Notes
            ruling.notes?.takeIf { it.isNotBlank() }?.let { notes ->
                Text(
                    text = notes,
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            // Needs Review Badge
            if (ruling.verificationStatus == "NEEDS_MANUAL_REVIEW") {
                QiraatNeedsReviewBadge()
            }
        }
    }
}

// MARK: - Split Matrix Layout (Exact 38% / Hairline / 62% proportional split)

@Composable
fun QiraatMatrixRow(
    wordColumn: @Composable () -> Unit,
    readersColumn: @Composable () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(IntrinsicSize.Min)
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Leading Column (Right in RTL): 38%
        Box(
            modifier = Modifier
                .weight(0.38f)
                .fillMaxHeight(),
            contentAlignment = Alignment.Center
        ) {
            wordColumn()
        }

        // Hairline Divider: 1.dp
        Spacer(Modifier.width(6.dp))
        Box(
            modifier = Modifier
                .width(1.dp)
                .fillMaxHeight()
                .background(MaterialTheme.colorScheme.onSurface.copy(alpha = 0.08f))
        )
        Spacer(Modifier.width(6.dp))

        // Trailing Column (Left in RTL): 62%
        Box(
            modifier = Modifier
                .weight(0.62f)
                .fillMaxHeight(),
            contentAlignment = Alignment.CenterStart
        ) {
            readersColumn()
        }
    }
}

// MARK: - Classification Line and Badges

@Composable
fun QiraatClassificationLine(variant: QiraatVariant) {
    val sub = QiraatClassification.subCategory(variant)
    Row(
        horizontalArrangement = Arrangement.spacedBy(5.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        QiraatBadge(text = sub)
    }
}

@Composable
fun QiraatClassificationLine(ruling: QiraatRuling) {
    val color = hexColor(ruling.color)
    val subDetail = QiraatClassification.usulSubCategory(ruling)
    Row(
        horizontalArrangement = Arrangement.spacedBy(5.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        QiraatBadge(text = ruling.categoryAr, background = color, foreground = Color.White)
        if (!subDetail.isNullOrBlank()) {
            Text(
                text = "›",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            QiraatBadge(text = subDetail)
        }
    }
}

@Composable
fun QiraatBadge(
    text: String,
    background: Color = QiraatThemeColors.badgeFill,
    foreground: Color = QiraatThemeColors.badgeInk
) {
    Surface(
        color = background,
        shape = CircleShape
    ) {
        Text(
            text = text,
            color = foreground,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
        )
    }
}

@Composable
fun QiraatDescriptorPill(text: String) {
    Surface(
        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.06f),
        shape = RoundedCornerShape(10.dp)
    ) {
        Text(
            text = text,
            color = QiraatThemeColors.mushafBrown,
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
        )
    }
}

@Composable
fun QiraatNeedsReviewBadge() {
    Surface(
        color = QiraatThemeColors.reviewFill,
        shape = CircleShape,
        border = BorderStroke(1.dp, QiraatThemeColors.reviewInk.copy(alpha = 0.6f))
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(5.dp)
        ) {
            Icon(
                imageVector = Icons.Default.Warning,
                contentDescription = null,
                tint = QiraatThemeColors.reviewInk,
                modifier = Modifier.size(12.dp)
            )
            Text(
                text = "تحتاج مراجعة يدوية",
                color = QiraatThemeColors.reviewInk,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

// MARK: - Attribution Grid & Chips (Exact port of iOS QiraatPills.swift)

@Composable
fun QiraatAttributionGrid(
    pills: List<AuthorityPill>,
    catalog: QiraatCatalog
) {
    Column(
        verticalArrangement = Arrangement.spacedBy(6.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        pills.chunked(2).forEach { row ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                row.forEach { pill ->
                    Box(modifier = Modifier.weight(1f)) {
                        QiraatAttributionChip(
                            pill = pill,
                            parentName = parentNameOf(pill, catalog)
                        )
                    }
                }
                if (row.size == 1) {
                    Spacer(modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
fun QiraatAttributionChip(
    pill: AuthorityPill,
    parentName: String?
) {
    val pillColor = hexColor(pill.color)
    val isNarrator = pill.kind == AuthorityPill.Kind.NARRATOR
    val bg = if (isNarrator) MaterialTheme.colorScheme.surface.copy(alpha = 0.95f) else pillColor.copy(alpha = 0.14f)
    val strokeColor = pillColor.copy(alpha = if (isNarrator) 0.85f else 0.45f)

    Surface(
        shape = CircleShape,
        color = bg,
        border = BorderStroke(1.dp, strokeColor),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(start = 4.dp, end = 8.dp, top = 3.dp, bottom = 3.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(5.dp)
        ) {
            // Initial circle: solid for reader, bordered for narrator
            Box(
                modifier = Modifier
                    .size(20.dp)
                    .background(
                        color = if (isNarrator) pillColor.copy(alpha = 0.12f) else pillColor,
                        shape = CircleShape
                    )
                    .then(if (isNarrator) Modifier.border(1.2.dp, pillColor, CircleShape) else Modifier),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = pill.initial,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (isNarrator) pillColor else Color.White
                )
            }

            Column(verticalArrangement = Arrangement.Center) {
                Text(
                    text = pill.cleanName,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                if (parentName != null) {
                    Text(
                        text = "عن $parentName",
                        fontSize = 9.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
        }
    }
}

@Composable
fun QiraatGroupPerformance(
    group: RulingActionGroup,
    categoryAr: String
) {
    val actionText = group.action.trim()
    val showAction = actionText.isNotEmpty() && !isRedundantActionLabel(actionText, categoryAr)
    val wajhs = group.entries.mapNotNull { it.wajhOrder }.filter { it > 1 }.distinct()

    if (showAction || wajhs.isNotEmpty()) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(5.dp),
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 2.dp)
        ) {
            if (showAction) {
                Text(
                    text = actionText,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface
                )
            }
            wajhs.forEach { wajh ->
                QiraatBadge(text = "الوجه $wajh")
            }
        }
    }

    // Show conditions if any
    group.entries.mapNotNull { it.condition?.trim() }.filter { it.isNotEmpty() }.distinct().forEach { cond ->
        Text(
            text = cond,
            fontSize = 10.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(horizontal = 2.dp)
        )
    }
}

// MARK: - References Row (Exact port of iOS QiraatReferencesRow.swift)

@Composable
fun QiraatReferencesRow(references: List<QiraatReference>) {
    if (references.isEmpty()) return
    var expanded by remember { mutableStateOf(false) }

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(10.dp),
        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.04f)
    ) {
        Column(
            modifier = Modifier.padding(8.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            // Header button with expand / collapse chevron
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { expanded = !expanded }
                    .padding(vertical = 2.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = "المصادر",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = QiraatThemeColors.mushafBrown
                    )
                    Icon(
                        imageVector = if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                        contentDescription = null,
                        tint = QiraatThemeColors.mushafBrown,
                        modifier = Modifier.size(16.dp)
                    )
                }

                // Reference Chips summary
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    references.forEach { ref ->
                        Surface(
                            shape = CircleShape,
                            color = QiraatThemeColors.mushafBrown.copy(alpha = 0.12f)
                        ) {
                            Text(
                                text = "${ref.work.labelAr}${ref.verse?.let { " $it" } ?: ""}",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = QiraatThemeColors.mushafBrown,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                    }
                }
            }

            // Expanded Lines from Matn
            AnimatedVisibility(visible = expanded) {
                Column(
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier.padding(top = 4.dp)
                ) {
                    references.forEach { ref ->
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = MaterialTheme.colorScheme.surface.copy(alpha = 0.7f),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(
                                modifier = Modifier.padding(8.dp),
                                verticalArrangement = Arrangement.spacedBy(3.dp)
                            ) {
                                Text(
                                    text = "${ref.work.labelAr}${ref.verse?.let { " — البيت $it" } ?: ""}",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = QiraatThemeColors.mushafBrown
                                )
                                ref.lines.forEach { line ->
                                    Text(
                                        text = line,
                                        fontSize = 12.sp,
                                        color = MaterialTheme.colorScheme.onSurface
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

// MARK: - Word Peek View (Exact port of iOS QiraatWordPeekView.swift)

@Composable
fun QiraatPeekDialog(
    value: WordSelection,
    catalog: QiraatCatalog,
    onDismiss: () -> Unit
) {
    val uthmanicFont = rememberUthmanicFont()

    Dialog(onDismissRequest = onDismiss) {
        CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = MaterialTheme.colorScheme.surface.copy(alpha = 0.98f),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.35f)),
                shadowElevation = 10.dp,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(8.dp)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // Mushaf word
                    Text(
                        text = value.word.textUthmani,
                        fontFamily = uthmanicFont,
                        fontSize = 26.sp,
                        fontWeight = FontWeight.Bold,
                        color = QiraatThemeColors.mushafBrown,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth()
                    )

                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.3f))

                    // Up to 3 variants
                    val variants = value.selection.variants.take(3)
                    variants.forEach { variant ->
                        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Text(
                                    text = variant.uthmaniText ?: variant.variantText,
                                    fontFamily = uthmanicFont,
                                    fontSize = 20.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.onSurface
                                )
                                variant.performanceNote?.takeIf { it.isNotBlank() }?.let { note ->
                                    Text(
                                        text = note,
                                        fontSize = 11.sp,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }

                            // Inline authority dots line: ● نافع   ● ابن كثير
                            val pills = rollupAuthorityPills(variant.readingIds, catalog)
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                pills.forEach { pill ->
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(3.dp)
                                    ) {
                                        Box(
                                            modifier = Modifier
                                                .size(8.dp)
                                                .background(hexColor(pill.color), CircleShape)
                                        )
                                        Text(
                                            text = pill.cleanName,
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Medium,
                                            color = MaterialTheme.colorScheme.onSurface
                                        )
                                    }
                                }
                            }
                        }
                    }
                    if (value.selection.variants.size > 3) {
                        Text(
                            text = "و${value.selection.variants.size - 3} أخرى",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    // Up to 2 ruling groups
                    val rulings = value.selection.rulings.take(2)
                    rulings.forEach { ruling ->
                        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Text(
                                text = ruling.categoryAr,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = hexColor(ruling.color)
                            )
                            ruling.attribution.firstOrNull()?.action?.let { action ->
                                Text(
                                    text = action,
                                    fontSize = 11.sp,
                                    color = MaterialTheme.colorScheme.onSurface
                                )
                            }
                        }
                    }
                    if (value.selection.rulings.size > 2) {
                        Text(
                            text = "و${value.selection.rulings.size - 2} أبواب أخرى",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    Spacer(Modifier.height(4.dp))
                    TextButton(
                        onClick = onDismiss,
                        modifier = Modifier.align(Alignment.End)
                    ) {
                        Text("إغلاق", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

// MARK: - Compare View (Exact port of iOS QiraatCompareView.swift)

@Composable
fun QiraatCompareDialog(
    value: WordSelection,
    model: ReaderViewModel,
    onDismiss: () -> Unit
) {
    val catalog = model.qiraatStore.catalog
    val loci = remember(value.selection) { QiraatCompare.loci(value.selection) }
    var selectedLocusIndex by remember { mutableIntStateOf(0) }
    val locus = loci.getOrNull(selectedLocusIndex) ?: loci.firstOrNull()
    val pair = remember(value.selection, catalog) {
        QiraatCompare.defaultPair(value.selection, catalog) ?: (QiraatCompare.HAFS_READING_ID to "Q01")
    }
    var firstSelection by remember { mutableStateOf(pair.first) }
    var secondSelection by remember { mutableStateOf(pair.second) }
    val uthmanicFont = rememberUthmanicFont()

    Dialog(onDismissRequest = onDismiss) {
        CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = MaterialTheme.colorScheme.surface,
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 560.dp),
                shadowElevation = 12.dp
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(16.dp)
                ) {
                    // Header
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = "مقارنة القراءتين",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        TextButton(onClick = onDismiss) { Text("إغلاق") }
                    }

                    if (locus == null) {
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Text("لا تتوفر مقارنة لهذا الموضع")
                        }
                    } else {
                        val voices1 = remember(firstSelection, locus) {
                            QiraatCompare.voice(firstSelection, locus, value.word, catalog)
                        }
                        val voices2 = remember(secondSelection, locus) {
                            QiraatCompare.voice(secondSelection, locus, value.word, catalog)
                        }
                        val isSame = voices1.flatMap { it.texts } == voices2.flatMap { it.texts } &&
                            voices1.flatMap { it.usul } == voices2.flatMap { it.usul }

                        // Locus picker if multiple
                        if (loci.size > 1) {
                            ScrollableTabRow(
                                selectedTabIndex = selectedLocusIndex,
                                edgePadding = 0.dp,
                                modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)
                            ) {
                                loci.forEachIndexed { idx, _ ->
                                    Tab(
                                        selected = selectedLocusIndex == idx,
                                        onClick = { selectedLocusIndex = idx },
                                        text = { Text("الموضع ${idx + 1}") }
                                    )
                                }
                            }
                        }

                        // Verdict (Label: تتفقان في هذه الكلمة / تختلفان في هذه الكلمة)
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            modifier = Modifier.padding(vertical = 8.dp)
                        ) {
                            Icon(
                                imageVector = if (isSame) Icons.Default.CheckCircle else Icons.Default.CompareArrows,
                                contentDescription = null,
                                tint = if (isSame) QiraatThemeColors.progressGreen else QiraatThemeColors.cautionOrange,
                                modifier = Modifier.size(18.dp)
                            )
                            Text(
                                text = if (isSame) "تتفقان في هذه الكلمة" else "تختلفان في هذه الكلمة",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (isSame) QiraatThemeColors.progressGreen else QiraatThemeColors.cautionOrange
                            )
                        }

                        // Side by side columns: first on Right (RTL), second on Left
                        Row(
                            modifier = Modifier
                                .weight(1f)
                                .fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            CompareColumn(
                                modifier = Modifier.weight(1f),
                                selection = firstSelection,
                                onSelect = { firstSelection = it },
                                voices = voices1,
                                catalog = catalog,
                                uthmanicFont = uthmanicFont
                            )
                            CompareColumn(
                                modifier = Modifier.weight(1f),
                                selection = secondSelection,
                                onSelect = { secondSelection = it },
                                voices = voices2,
                                catalog = catalog,
                                uthmanicFont = uthmanicFont
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CompareColumn(
    modifier: Modifier = Modifier,
    selection: String,
    onSelect: (String) -> Unit,
    voices: List<ComparedVoice>,
    catalog: QiraatCatalog,
    uthmanicFont: FontFamily
) {
    var expandedMenu by remember { mutableStateOf(false) }
    val currentName = remember(selection) {
        catalog.narrator(selection)?.let { "الراوي ${it.nameAr}" }
            ?: catalog.reader(selection)?.let { "الإمام ${it.nameArShort}" }
            ?: selection
    }
    val currentColor = remember(selection) {
        catalog.narrator(selection)?.color ?: catalog.reader(selection)?.color ?: "#2563EB"
    }

    Surface(
        modifier = modifier.fillMaxHeight(),
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(10.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Authority selector dropdown button
            Box {
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = MaterialTheme.colorScheme.surface,
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f)),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { expandedMenu = true }
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(5.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(10.dp)
                                    .background(hexColor(currentColor), CircleShape)
                            )
                            Text(
                                text = currentName,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                        Icon(
                            imageVector = Icons.Default.ArrowDropDown,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }

                DropdownMenu(
                    expanded = expandedMenu,
                    onDismissRequest = { expandedMenu = false },
                    modifier = Modifier.heightIn(max = 320.dp)
                ) {
                    catalog.readers.sortedBy { it.sortOrder }.forEach { reader ->
                        DropdownMenuItem(
                            text = { Text("الإمام ${reader.nameArShort}", fontWeight = FontWeight.Bold) },
                            leadingIcon = {
                                Box(
                                    modifier = Modifier
                                        .size(10.dp)
                                        .background(hexColor(reader.color), CircleShape)
                                )
                            },
                            onClick = {
                                onSelect(reader.id)
                                expandedMenu = false
                            }
                        )
                        catalog.narrators(reader.id).forEach { narrator ->
                            DropdownMenuItem(
                                text = { Text("  الراوي ${narrator.nameAr}", fontSize = 13.sp) },
                                leadingIcon = {
                                    Box(
                                        modifier = Modifier
                                            .size(8.dp)
                                            .background(hexColor(narrator.color), CircleShape)
                                    )
                                },
                                onClick = {
                                    onSelect(narrator.id)
                                    expandedMenu = false
                                }
                            )
                        }
                    }
                }
            }

            // Voices output
            if (voices.isEmpty()) {
                Text(
                    text = "لا توجد بيانات لهذا الاختيار",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            } else {
                voices.forEach { voice ->
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(5.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(8.dp)
                                    .background(hexColor(voice.color), CircleShape)
                            )
                            Text(
                                text = voice.name,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                        }
                        voice.texts.forEach { txt ->
                            Text(
                                text = txt,
                                fontFamily = uthmanicFont,
                                fontSize = 22.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurface,
                                textAlign = TextAlign.Center,
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                        voice.usul.forEach { u ->
                            Text(
                                text = u,
                                fontSize = 11.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.2f))
                }
            }
        }
    }
}

// MARK: - Dialogs: Picker, Preferences, Legend, Page Summary, Hub

@Composable
fun QiraatPickerDialog(model: ReaderViewModel, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = { TextButton(onClick = onDismiss) { Text("تم") } },
        title = { Text("القارئ والرواية") },
        text = {
            LazyColumn(Modifier.heightIn(max = 480.dp)) {
                item {
                    FilterRow("القراءات العشر (الكل)", model.qiraatFilter == QiraatFilter.All) {
                        model.setFilter(QiraatFilter.All)
                    }
                }
                model.qiraatStore.catalog.readers.sortedBy { it.sortOrder }.forEach { reader ->
                    item {
                        FilterRow(
                            "الإمام ${reader.nameArShort}",
                            model.qiraatFilter == QiraatFilter.Reader(reader.id),
                            color = hexColor(reader.color)
                        ) {
                            model.setFilter(QiraatFilter.Reader(reader.id))
                        }
                    }
                    items(model.qiraatStore.catalog.narrators(reader.id)) { narrator ->
                        FilterRow(
                            "    الراوي ${narrator.nameAr}",
                            model.qiraatFilter == QiraatFilter.Reading(narrator.id),
                            color = hexColor(narrator.color)
                        ) {
                            model.setFilter(QiraatFilter.Reading(narrator.id))
                        }
                    }
                }
            }
        }
    )
}

@Composable
private fun FilterRow(
    label: String,
    selected: Boolean,
    color: Color? = null,
    click: () -> Unit
) = Row(
    Modifier
        .fillMaxWidth()
        .clickable(onClick = click)
        .padding(vertical = 6.dp),
    verticalAlignment = Alignment.CenterVertically
) {
    RadioButton(selected = selected, onClick = click)
    Spacer(Modifier.width(6.dp))
    color?.let {
        Box(
            modifier = Modifier
                .size(10.dp)
                .background(it, CircleShape)
        )
        Spacer(Modifier.width(6.dp))
    }
    Text(
        text = label,
        fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal
    )
}

@Composable
fun QiraatPreferencesDialog(model: ReaderViewModel, onDismiss: () -> Unit) {
    LaunchedEffect(Unit) { model.prepareHub() }
    val installed = model.usulCategories
    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = { TextButton(onClick = onDismiss) { Text("تم") } },
        title = { Text("تفضيلات القراءات") },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState())) {
                SwitchRow("إظهار علامات القراءات", model.qiraatEnabled, model::updateQiraatEnabled)
                SwitchRow("فرش فقط", model.hidesUsul, model::updateHidesUsul)
                if (!model.hidesUsul && installed.isEmpty()) LinearProgressIndicator(Modifier.fillMaxWidth())
                if (!model.hidesUsul) {
                    installed.forEach { category ->
                        SwitchRow(
                            category.categoryAr,
                            category.code !in model.hiddenUsulCategories
                        ) { model.setCategoryVisible(category.code, it) }
                    }
                }
            }
        }
    )
}

@Composable
private fun SwitchRow(label: String, checked: Boolean, change: (Boolean) -> Unit) = Row(
    Modifier
        .fillMaxWidth()
        .padding(vertical = 6.dp),
    verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.SpaceBetween
) {
    Text(label, modifier = Modifier.weight(1f))
    Switch(checked, change)
}

@Composable
fun QiraatLegendDialog(model: ReaderViewModel, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = { TextButton(onClick = onDismiss) { Text("تم") } },
        title = { Text("مفتاح علامات القراءات") },
        text = {
            Column(
                modifier = Modifier
                    .verticalScroll(rememberScrollState())
                    .padding(vertical = 4.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text("أنواع العلامات على الكلمات:", fontWeight = FontWeight.Bold)
                Text("• الخط المتصل الملوّن: فرش القراءة، بلون القارئ أو الرواية.")
                Text("• الخط المنقّط: للوجه الثاني (بخلف عنه).")
                Text("• النقطة الدائرية: اجتماع أكثر من باب من أصول القراءة.")
                Text("• الخط الرمادي: اشتراك أكثر من قارئين في الوجه.")

                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
                Text("ألوان القراء العشرة:", fontWeight = FontWeight.Bold)
                model.qiraatStore.catalog.readers.sortedBy { it.sortOrder }.forEach { reader ->
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(12.dp)
                                .background(hexColor(reader.color), CircleShape)
                        )
                        Text(
                            text = "الإمام ${reader.nameArShort} (روايتاه: ${model.qiraatStore.catalog.narrators(reader.id).joinToString("، ") { it.nameAr }})",
                            fontSize = 13.sp
                        )
                    }
                }
            }
        }
    )
}

@Composable
fun PageSummaryDialog(
    items: List<QiraatSummaryItem>,
    onSelect: (QiraatSummaryItem) -> Unit,
    onDismiss: () -> Unit
) {
    val uthmanicFont = rememberUthmanicFont()
    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = { TextButton(onClick = onDismiss) { Text("تم") } },
        title = { Text("خلافات الصفحة") },
        text = {
            if (items.isEmpty()) {
                Text("لا توجد مواضع قراءة في هذه الصفحة")
            } else {
                LazyColumn(Modifier.heightIn(max = 480.dp)) {
                    items(items) { item ->
                        ListItem(
                            headlineContent = {
                                Text(
                                    text = item.word.textUthmani,
                                    fontFamily = uthmanicFont,
                                    fontSize = 22.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            },
                            supportingContent = {
                                Text("${item.selection.variants.size} فرش · ${item.selection.rulings.size} أصول")
                            },
                            modifier = Modifier.clickable { onSelect(item) }
                        )
                        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.2f))
                    }
                }
            }
        }
    )
}

@Composable
fun QiraatHub(model: ReaderViewModel, onClose: () -> Unit, onNavigate: (Int) -> Unit) {
    var tab by remember { mutableIntStateOf(0) }
    var query by remember { mutableStateOf("") }
    var matn by remember { mutableStateOf<QiraatMatn?>(null) }
    LaunchedEffect(Unit) { model.prepareHub() }

    Surface(Modifier.fillMaxSize()) {
        Column {
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text("مركز القراءات", fontSize = 22.sp, fontWeight = FontWeight.Bold)
                TextButton(onClick = onClose) { Text("عودة للمصحف") }
            }
            PrimaryTabRow(tab) {
                listOf("الأصول", "البحث", "المتون", "المراجع").forEachIndexed { i, label ->
                    Tab(tab == i, { tab = i }, text = { Text(label) })
                }
            }
            when (tab) {
                0 -> if (model.usulCategories.isEmpty()) {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
                } else {
                    LazyColumn {
                        items(model.usulCategories) { category ->
                            var expanded by remember(category.code) { mutableStateOf(false) }
                            ListItem(
                                headlineContent = { Text(category.categoryAr, color = hexColor(category.color)) },
                                trailingContent = { Text(category.count.toString()) },
                                modifier = Modifier.clickable { expanded = !expanded }
                            )
                            if (expanded) {
                                category.places.take(200).forEach { place ->
                                    ListItem(
                                        headlineContent = { Text(place.baseText.ifEmpty { "${place.surah}:${place.ayah}" }) },
                                        supportingContent = { Text("صفحة ${place.page} · ${place.surah}:${place.ayah}") },
                                        modifier = Modifier.clickable { onNavigate(place.page) }
                                    )
                                }
                            }
                        }
                    }
                }
                1 -> Column {
                    OutlinedTextField(
                        query,
                        { query = it },
                        label = { Text("ابحث في القراءات") },
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp)
                    )
                    val results = remember(query, model.searchIndex) { model.searchIndex?.word(query).orEmpty() }
                    LazyColumn {
                        items(results) { result ->
                            ListItem(
                                headlineContent = { Text(result.displayText.ifEmpty { "موضع قراءة" }) },
                                supportingContent = { Text("صفحة ${result.page} · ${result.surah}:${result.ayah}") },
                                modifier = Modifier.clickable { onNavigate(result.page) }
                            )
                        }
                    }
                }
                2 -> if (matn == null) {
                    LazyColumn {
                        items(QiraatMatn.entries) { work ->
                            val loaded = model.matnLibrary.work(work)
                            ListItem(
                                headlineContent = { Text(work.labelAr) },
                                supportingContent = { Text(loaded?.let { "${it.title} · ${it.verseCount} بيت" } ?: "غير متوفر") },
                                modifier = Modifier.clickable(enabled = loaded != null) { matn = work }
                            )
                        }
                    }
                } else MatnViewer(model.matnLibrary, matn!!) { matn = null }
                else -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(
                        "${model.references.count} شاهدًا مرتبطًا بمواضع الفرش\nتظهر الشواهد داخل بطاقة الكلمة.",
                        textAlign = TextAlign.Center
                    )
                }
            }
        }
    }
}

@Composable
private fun MatnViewer(library: MatnLibrary, work: QiraatMatn, back: () -> Unit) {
    var q by remember { mutableStateOf("") }
    var selected by remember { mutableStateOf<Pair<String, MatnVerse>?>(null) }

    Column {
        TextButton(onClick = back) { Text("رجوع") }
        OutlinedTextField(
            q,
            { q = it },
            label = { Text("بحث في ${work.labelAr}") },
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp)
        )
        val verses = if (q.isBlank()) library.work(work)?.chapters?.flatMap { c -> c.verses.map { c.title to it } }.orEmpty()
        else library.search(q).filter { it.work == work }.map { it.chapter to it.verse }
        LazyColumn {
            items(verses.take(500)) { item ->
                val (chapter, verse) = item
                ListItem(
                    headlineContent = { Text("${verse.number} · ${verse.lines.joinToString("  ◇  ")}") },
                    supportingContent = { Text(chapter) },
                    modifier = Modifier.clickable { selected = item }
                )
            }
        }
    }
    selected?.let { (chapter, verse) ->
        val marks = library.symbols(work, verse.number)
        val sharh = library.sharh(work, verse.number)
        AlertDialog(
            onDismissRequest = { selected = null },
            confirmButton = { TextButton(onClick = { selected = null }) { Text("تم") } },
            title = { Text("${work.labelAr} · البيت ${verse.number}") },
            text = {
                Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(chapter, color = MaterialTheme.colorScheme.primary)
                    verse.lines.forEach { Text(it, fontSize = 20.sp) }
                    if (marks.isNotEmpty()) {
                        HorizontalDivider()
                        Text("رموز القراء", fontWeight = FontWeight.Bold)
                        marks.forEach { Text("${it.text} (${it.symbol}) · ${it.readingIds.joinToString("، ")}") }
                    }
                    sharh?.let { (workSharh, entry) ->
                        HorizontalDivider()
                        Text(workSharh.title, fontWeight = FontWeight.Bold)
                        Text(workSharh.author, fontSize = 12.sp)
                        Text(entry.text)
                        if (entry.pages.isNotEmpty()) Text("الصفحات: ${entry.pages.joinToString("، ")}", fontSize = 12.sp)
                    }
                }
            }
        )
    }
}

fun hexColor(value: String): Color = runCatching { Color(android.graphics.Color.parseColor(value)) }.getOrDefault(Color.Gray)
