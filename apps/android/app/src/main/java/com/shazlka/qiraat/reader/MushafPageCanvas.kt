package com.shazlka.qiraat.reader

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.view.View
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.ViewConfiguration
import androidx.compose.ui.graphics.toArgb
import com.shazlka.qiraat.core.AyahKey
import com.shazlka.qiraat.core.LaidOutLineContent
import com.shazlka.qiraat.core.MushafPage
import com.shazlka.qiraat.core.PageLayout
import com.shazlka.qiraat.core.QcfFontStore
import com.shazlka.qiraat.core.Rect
import com.shazlka.qiraat.core.PageLayoutConstants
import com.shazlka.qiraat.core.Point
import com.shazlka.qiraat.core.QiraatColor
import com.shazlka.qiraat.core.QiraatFilter
import com.shazlka.qiraat.core.QiraatMarks
import com.shazlka.qiraat.core.QiraatPageTint
import com.shazlka.qiraat.core.QiraatUnderline
import com.shazlka.qiraat.core.WordMarks
import com.shazlka.qiraat.memorization.MemorizationStatus
import com.shazlka.qiraat.settings.MushafAppearance
import kotlin.math.abs
import kotlin.math.max

class MushafPageCanvas(context: Context) : View(context) {
    init {
        setLayerType(LAYER_TYPE_SOFTWARE, null)
    }
    var page: MushafPage? = null
        set(value) { field = value; invalidate() }
    var fontStore: QcfFontStore? = null
        set(value) { field = value; invalidate() }
    var surahAyahCounts: Map<Int, Int> = emptyMap()
        set(value) { field = value; invalidate() }
    var surahNames: Map<Int, String> = emptyMap()
        set(value) { field = value; invalidate() }
    var qiraatMarks: QiraatMarks? = null
        set(value) { field = value; invalidate() }
    var qiraatFilter: QiraatFilter = QiraatFilter.All
        set(value) { field = value; invalidate() }
    var qiraatEnabled: Boolean = true
        set(value) { field = value; invalidate() }
    var highlightedWordIDs: Set<String> = emptySet()
        set(value) { field = value; invalidate() }
    var appearance: MushafAppearance = MushafAppearance.SYSTEM
        set(value) { field = value; invalidate() }
    var isSystemDark: Boolean = false
        set(value) { field = value; invalidate() }
    var showsAyahMarker: Boolean = false
        set(value) { field = value; invalidate() }
    var ayahStatuses: Map<AyahKey, MemorizationStatus> = emptyMap()
        set(value) { field = value; invalidate() }
    var onWordTap: ((com.shazlka.qiraat.core.MushafWord) -> Unit)? = null
    var onWordLongPress: ((com.shazlka.qiraat.core.MushafWord) -> Unit)? = null

    private var currentLayout: PageLayout? = null
    private val markPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { strokeCap = Paint.Cap.ROUND }
    private var touchStartX = 0f
    private var touchStartY = 0f
    private var isDragging = false
    private val touchSlop = ViewConfiguration.get(context).scaledTouchSlop

    private val gestures = GestureDetector(context, object : GestureDetector.SimpleOnGestureListener() {
        override fun onDown(e: MotionEvent): Boolean = true
        override fun onSingleTapUp(e: MotionEvent): Boolean {
            currentLayout?.wordAt(Point(e.x, e.y))?.let { onWordTap?.invoke(it) }
            return true
        }
        override fun onLongPress(e: MotionEvent) {
            currentLayout?.wordAt(Point(e.x, e.y))?.let { onWordLongPress?.invoke(it) }
        }
    })

    private val glyphPaint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.SUBPIXEL_TEXT_FLAG).apply {
        color = Color.rgb(34, 29, 22)
        hinting = Paint.HINTING_OFF
    }
    private val decorationPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(82, 65, 39)
        textAlign = Paint.Align.CENTER
    }
    private val linePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(145, 116, 67)
        style = Paint.Style.STROKE
        strokeWidth = resources.displayMetrics.density
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val isDark = when (appearance) {
            MushafAppearance.SYSTEM -> isSystemDark
            MushafAppearance.DARK, MushafAppearance.BLACK_PAGE -> true
            MushafAppearance.LIGHT, MushafAppearance.SEPIA, MushafAppearance.WHITE_PAGE -> false
        }
        val basePaper = if (appearance == MushafAppearance.SYSTEM) {
            if (isDark) MushafAppearance.DARK.paperColor else MushafAppearance.LIGHT.paperColor
        } else {
            appearance.paperColor
        }
        val baseInk = if (appearance == MushafAppearance.SYSTEM) {
            if (isDark) MushafAppearance.DARK.inkColor else MushafAppearance.LIGHT.inkColor
        } else {
            appearance.inkColor
        }
        val baseBrown = if (appearance == MushafAppearance.SYSTEM) {
            if (isDark) MushafAppearance.DARK.brownColor else MushafAppearance.LIGHT.brownColor
        } else {
            appearance.brownColor
        }
        val baseGold = if (appearance == MushafAppearance.SYSTEM) {
            if (isDark) MushafAppearance.DARK.goldColor else MushafAppearance.LIGHT.goldColor
        } else {
            appearance.goldColor
        }

        val paper = QiraatColor(basePaper.red.toDouble(), basePaper.green.toDouble(), basePaper.blue.toDouble())
        val tint = if (qiraatEnabled) qiraatMarks?.catalog?.let { QiraatPageTint.readerColor(qiraatFilter, it) } else null
        val currentPaperColor = (tint?.let { QiraatPageTint.mixed(paper, it) } ?: paper).toArgb()
        canvas.drawColor(currentPaperColor)
        val currentPage = page ?: return
        val fonts = fontStore ?: return
        if (width <= 0 || height <= 0) return

        val layout = PageLayout(currentPage, width.toFloat(), height.toFloat(), surahAyahCounts) { word, size ->
            fonts.measureToken(word.glyph, currentPage.number, size, glyphPaint)
        }
        currentLayout = layout
        glyphPaint.textSize = layout.fontSize
        val defaultInkArgb = baseInk.toArgb()
        decorationPaint.color = baseBrown.toArgb()
        linePaint.color = baseGold.toArgb()

        layout.lines.forEach { line ->
            when (val content = line.content) {
                is LaidOutLineContent.Words -> content.boxes.forEach { box ->
                    val wordMarks = if (qiraatEnabled) qiraatMarks?.wordMarks(box.word, qiraatFilter) else null
                    if (box.word.id in highlightedWordIDs) {
                        markPaint.color = Color.argb(92, 255, 193, 7)
                        markPaint.style = Paint.Style.FILL
                        canvas.drawRoundRect(RectF(box.frame.left, box.frame.top, box.frame.right, box.frame.bottom), layout.fontSize * .08f, layout.fontSize * .08f, markPaint)
                    }

                    // Memorization status marker on Mushaf if enabled
                    if (showsAyahMarker && ayahStatuses.isNotEmpty()) {
                        val status = ayahStatuses[box.word.ayahKey]
                        if (status != null && status != MemorizationStatus.NOT_MEMORIZED) {
                            markPaint.color = statusColor(status)
                            markPaint.style = Paint.Style.FILL
                            markPaint.alpha = 45
                            canvas.drawRect(box.frame.left, box.frame.bottom - layout.fontSize * 0.05f, box.frame.right, box.frame.bottom, markPaint)
                            markPaint.alpha = 255
                        }
                    }

                    glyphPaint.color = wordMarks?.textColor?.let(::parseColor) ?: defaultInkArgb
                    val natural = fonts.measureToken(box.word.glyph, currentPage.number, layout.fontSize, glyphPaint)
                    val scale = box.frame.width / max(natural, 1f)
                    val metrics = glyphPaint.fontMetrics
                    val baseline = line.rect.centerY - (metrics.ascent + metrics.descent) / 2
                    canvas.save()
                    canvas.scale(scale, 1f, box.frame.right, baseline)
                    fonts.drawToken(canvas, box.word.glyph, currentPage.number, box.frame.right - natural, baseline, glyphPaint)
                    canvas.restore()
                    wordMarks?.let { drawMarks(canvas, box.frame, it, layout.fontSize) }
                }
                is LaidOutLineContent.SurahHeader -> drawSurahHeader(canvas, content.surah, line.rect, layout.fontSize, currentPaperColor)
                LaidOutLineContent.Basmala -> drawBasmala(canvas, line.rect, layout.fontSize, fonts)
                LaidOutLineContent.Empty -> Unit
            }
        }

        decorationPaint.textSize = width * 0.028f
        canvas.drawText(toArabicDigits(currentPage.number), width / 2f, height - width * 0.012f, decorationPaint)
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                touchStartX = event.x
                touchStartY = event.y
                isDragging = false
                parent?.requestDisallowInterceptTouchEvent(true)
                gestures.onTouchEvent(event)
                return true
            }
            MotionEvent.ACTION_MOVE -> {
                if (!isDragging) {
                    val dx = abs(event.x - touchStartX)
                    val dy = abs(event.y - touchStartY)
                    if (dx > touchSlop || dy > touchSlop) {
                        isDragging = true
                        parent?.requestDisallowInterceptTouchEvent(false)
                        return false
                    }
                } else {
                    return false
                }
            }
            MotionEvent.ACTION_UP -> {
                if (isDragging) {
                    isDragging = false
                    return false
                }
                return gestures.onTouchEvent(event) || super.onTouchEvent(event)
            }
            MotionEvent.ACTION_CANCEL -> {
                isDragging = false
                return super.onTouchEvent(event)
            }
        }
        return gestures.onTouchEvent(event) || super.onTouchEvent(event)
    }

    private fun statusColor(status: MemorizationStatus): Int = when (status) {
        MemorizationStatus.MASTERED -> Color.rgb(46, 125, 50)
        MemorizationStatus.MEMORIZED_WITH_ERRORS -> Color.rgb(245, 124, 0)
        MemorizationStatus.NEEDS_MUSHAF -> Color.rgb(25, 118, 210)
        MemorizationStatus.NOT_MEMORIZED -> Color.rgb(117, 117, 117)
    }

    private fun drawMarks(canvas: Canvas, frame: Rect, marks: WordMarks, fontSize: Float) {
        val thickness = max(1.2f, fontSize * 0.06f)
        val dot = max(3f, fontSize * 0.16f)

        marks.underline?.let { drawUnderline(canvas, frame, frame.bottom + thickness / 2f, it, false, thickness) }
        marks.dottedUnderline?.let {
            drawUnderline(canvas, frame, frame.bottom + thickness * 2.6f, it, true, thickness)
        }
        marks.familyDotColor?.let {
            markPaint.color = parseColor(it)
            markPaint.style = Paint.Style.FILL
            val radius = dot / 2f
            canvas.drawCircle(frame.left - dot * 0.2f, frame.top + dot * 0.5f, radius, markPaint)
        }
        marks.imalahDot?.let {
            val color = parseColor(it.color)
            markPaint.color = color
            val radius = dot / 2f
            val cx = frame.left - dot * 0.2f
            val cy = frame.bottom + thickness * 3.6f + dot * 0.5f
            if (it.filled) {
                markPaint.style = Paint.Style.FILL
                canvas.drawCircle(cx, cy, radius, markPaint)
            } else {
                markPaint.style = Paint.Style.STROKE
                markPaint.strokeWidth = max(1f, dot * 0.28f)
                canvas.drawCircle(cx, cy, radius - markPaint.strokeWidth / 2f, markPaint)
            }
        }
    }

    private fun drawUnderline(canvas: Canvas, frame: Rect, y: Float, underline: QiraatUnderline, dotted: Boolean, thickness: Float) {
        markPaint.style = Paint.Style.STROKE
        markPaint.strokeWidth = if (dotted) thickness * 0.9f else thickness
        markPaint.pathEffect = if (dotted) android.graphics.DashPathEffect(floatArrayOf(thickness, thickness * 1.3f), 0f) else null
        when (underline) {
            is QiraatUnderline.Solid -> {
                markPaint.color = parseColor(underline.color)
                canvas.drawLine(frame.left, y, frame.right, y, markPaint)
            }
            is QiraatUnderline.Segments -> {
                val segment = frame.width / max(underline.colors.size, 1)
                underline.colors.forEachIndexed { i, color ->
                    markPaint.color = parseColor(color)
                    canvas.drawLine(frame.left + i * segment, y, frame.left + (i + 1) * segment, y, markPaint)
                }
            }
        }
        markPaint.pathEffect = null
    }

    private fun parseColor(hex: String) = runCatching { Color.parseColor(hex) }.getOrDefault(Color.GRAY)

    private fun drawSurahHeader(canvas: Canvas, surah: Int, rect: Rect, fontSize: Float, paperColor: Int) {
        val outerInset = fontSize * 0.08f
        val banner = RectF(rect.left + outerInset, rect.top + outerInset, rect.right - outerInset, rect.bottom - outerInset)
        val cornerRadius = banner.height() * 0.18f

        // Outer rounded border
        val outerStroke = max(1.4f, width * 0.003f)
        linePaint.strokeWidth = outerStroke
        linePaint.style = Paint.Style.STROKE
        canvas.drawRoundRect(banner, cornerRadius, cornerRadius, linePaint)

        // Inner rounded border
        val innerInsetX = outerStroke * 2.2f
        val innerInsetY = outerStroke * 2.0f
        val innerBanner = RectF(banner.left + innerInsetX, banner.top + innerInsetY, banner.right - innerInsetX, banner.bottom - innerInsetY)
        linePaint.strokeWidth = max(0.8f, outerStroke * 0.6f)
        canvas.drawRoundRect(innerBanner, cornerRadius * 0.7f, cornerRadius * 0.7f, linePaint)

        // Surah title
        val title = "سُورَةُ ${surahNames[surah] ?: surah}"
        decorationPaint.textSize = fontSize * 0.66f
        val textWidth = decorationPaint.measureText(title)
        val textPad = fontSize * 0.45f
        val cartoucheWidth = max(banner.width() * 0.45f, textWidth + textPad * 2)
        val cartouche = RectF(
            banner.centerX() - cartoucheWidth / 2f,
            innerBanner.top + 1f,
            banner.centerX() + cartoucheWidth / 2f,
            innerBanner.bottom - 1f,
        )

        // Side decoration lines (flanking the cartouche, never passing through the text)
        val lineY = banner.centerY()
        val lineLeftEnd = cartouche.left - fontSize * 0.2f
        val lineRightStart = cartouche.right + fontSize * 0.2f
        val lineMargin = fontSize * 0.35f
        if (lineLeftEnd > innerBanner.left + lineMargin) {
            canvas.drawLine(innerBanner.left + lineMargin, lineY, lineLeftEnd, lineY, linePaint)
            canvas.drawCircle(lineLeftEnd, lineY, max(1.5f, fontSize * 0.04f), linePaint)
        }
        if (lineRightStart < innerBanner.right - lineMargin) {
            canvas.drawLine(lineRightStart, lineY, innerBanner.right - lineMargin, lineY, linePaint)
            canvas.drawCircle(lineRightStart, lineY, max(1.5f, fontSize * 0.04f), linePaint)
        }

        // Cartouche: filled with opaque paper background and stroked with gold border
        markPaint.style = Paint.Style.FILL
        markPaint.color = paperColor
        val cartoucheRadius = cartouche.height() * 0.35f
        canvas.drawRoundRect(cartouche, cartoucheRadius, cartoucheRadius, markPaint)
        linePaint.strokeWidth = max(1f, outerStroke * 0.85f)
        canvas.drawRoundRect(cartouche, cartoucheRadius, cartoucheRadius, linePaint)

        // Centred title text
        val metrics = decorationPaint.fontMetrics
        val baseline = banner.centerY() - (metrics.ascent + metrics.descent) / 2
        canvas.drawText(title, banner.centerX(), baseline, decorationPaint)
    }

    private fun drawBasmala(canvas: Canvas, rect: Rect, fontSize: Float, fonts: QcfFontStore) {
        val size = fontSize * 1.05f
        val glyphs = listOf("\uFC41", "\uFC42", "\uFC43", "\uFC44")
        glyphPaint.textSize = size
        val widths = glyphs.map { fonts.measureToken(it, 1, size, glyphPaint) }
        val gap = fontSize * com.shazlka.qiraat.core.PageLayoutConstants.CENTRED_GAP_EM
        var x = rect.centerX + (widths.sum() + gap * (glyphs.size - 1)) / 2
        val metrics = glyphPaint.fontMetrics
        val baseline = rect.centerY - (metrics.ascent + metrics.descent) / 2
        glyphs.forEachIndexed { index, glyph ->
            fonts.drawToken(canvas, glyph, 1, x - widths[index], baseline, glyphPaint)
            x -= widths[index] + gap
        }
    }

    private fun toArabicDigits(number: Int): String = number.toString().map { "٠١٢٣٤٥٦٧٨٩"[it.digitToInt()] }.joinToString("")
}
