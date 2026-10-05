import MushafCore
import SwiftUI

struct MutshabehatGroupEditorView: View {
    @Environment(\.dismiss) private var dismiss
    let library: MushafLibrary?
    let initialGroup: PersonalGroup?
    let onSave: (PersonalGroup) -> Void
    let onDelete: ((String) -> Void)?

    @State private var title: String = ""
    @State private var colorHex: String = "#55b94f"
    @State private var status: String = "draft"
    @State private var favorite: Bool = false
    @State private var completed: Bool = false
    @State private var note: String = ""
    @State private var unote: String = ""
    @State private var verses: [PersonalVerse] = []

    @State private var expandedVerseId: String? = nil
    @State private var showQuranSearch: Bool = false
    @State private var showAutoColor: Bool = false
    @State private var showWordLinker: Bool = false
    @State private var showDeleteConfirm: Bool = false
    @State private var validationError: String? = nil

    private let db = MutshabehatDatabase.shared

    private let suggestedColors: [String] = [
        "#55b94f", "#4b63e6", "#c9a84c", "#7c3aed", "#15803d",
        "#2563eb", "#d92323", "#0f766e", "#9a5d00", "#1A4A6E"
    ]

    private let partTypes: [(key: String, label: String, style: MutshabehatPartStyle)] = [
        ("shared", "مشترك", .shared),
        ("diff", "اختلاف", .difference),
        ("diff2", "اختلاف ٢", .difference2),
        ("diff3", "اختلاف ٣", .difference3),
        ("addition", "زيادة", .addition),
        ("unique", "فريد", .unique),
        ("normal", "عادي", .blank)
    ]

    init(
        library: MushafLibrary? = nil,
        group: PersonalGroup? = nil,
        onSave: @escaping (PersonalGroup) -> Void,
        onDelete: ((String) -> Void)? = nil
    ) {
        self.library = library
        self.initialGroup = group
        self.onSave = onSave
        self.onDelete = onDelete
    }

    var body: some View {
        NavigationStack {
            Form {
                // Section: Basic Info
                Section {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("عنوان المتشابه")
                            .font(.caption.bold())
                            .foregroundStyle(.secondary)
                        TextField("مثال: الرجفة / الصيحة", text: $title)
                            .font(.headline)
                            .environment(\.layoutDirection, .rightToLeft)
                            .accessibilityIdentifier("mutshabehat-group-title-input")
                    }

                    // Color Picker
                    VStack(alignment: .leading, spacing: 8) {
                        Text("اللون المميّز")
                            .font(.caption.bold())
                            .foregroundStyle(.secondary)

                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(suggestedColors, id: \.self) { c in
                                    let isSelected = colorHex.lowercased() == c.lowercased()
                                    Circle()
                                        .fill(Color(hex: c))
                                        .frame(width: 32, height: 32)
                                        .overlay(
                                            Circle()
                                                .stroke(Color.primary, lineWidth: isSelected ? 3 : 0)
                                        )
                                        .scaleEffect(isSelected ? 1.15 : 1.0)
                                        .onTapGesture {
                                            colorHex = c
                                        }
                                }

                                Divider().frame(height: 24)

                                ColorPicker("مخصص", selection: Binding(
                                    get: { Color(hex: colorHex) },
                                    set: { newColor in
                                        if let hex = newColor.toHex() {
                                            colorHex = hex
                                        }
                                    }
                                ), supportsOpacity: false)
                                .labelsHidden()
                            }
                            .padding(.vertical, 4)
                        }
                    }

                    // Live Preview
                    HStack(spacing: 10) {
                        Circle()
                            .fill(Color(hex: colorHex))
                            .frame(width: 12, height: 12)
                        Text(title.trimmingCharacters(in: .whitespaces).isEmpty ? "عنوان المجموعة سيظهر هنا…" : title)
                            .font(.headline.bold())
                            .foregroundStyle(title.trimmingCharacters(in: .whitespaces).isEmpty ? .secondary : .primary)
                    }
                    .padding(.vertical, 4)
                } header: {
                    Text("بيانات المجموعة")
                }

                // Section: Status & Flags
                Section {
                    Toggle("مفضّلة", isOn: $favorite)
                    Toggle("مكتملة", isOn: $completed)
                    Picker("الحالة", selection: $status) {
                        Text("مسودة").tag("draft")
                        Text("منشورة").tag("published")
                        Text("مقفلة").tag("locked")
                    }
                } header: {
                    Text("الحالة والفرز")
                }

                // Section: Verses
                Section {
                    // Verse Tools
                    HStack(spacing: 8) {
                        Button {
                            showQuranSearch = true
                        } label: {
                            HStack(spacing: 4) {
                                Image(systemName: "magnifyingglass")
                                Text("إضافة من القرآن")
                            }
                            .font(.caption.bold())
                        }
                        .buttonStyle(.borderedProminent)

                        Button {
                            addBlankVerse()
                        } label: {
                            HStack(spacing: 4) {
                                Image(systemName: "plus")
                                Text("إضافة آية")
                            }
                            .font(.caption.bold())
                        }
                        .buttonStyle(.bordered)

                        Spacer()

                        if verses.count >= 2 {
                            Menu {
                                Button {
                                    showAutoColor = true
                                } label: {
                                    Label("تلوين تلقائي", systemImage: "wand.and.stars")
                                }

                                Button {
                                    showWordLinker = true
                                } label: {
                                    Label("ربط وتلوين الكلمات", systemImage: "paintbrush")
                                }
                            } label: {
                                Image(systemName: "slider.horizontal.3")
                                    .font(.system(size: 16, weight: .bold))
                                    .padding(8)
                                    .background(Color(uiColor: .tertiarySystemFill))
                                    .clipShape(Circle())
                            }
                        }
                    }
                    .padding(.vertical, 4)

                    if verses.isEmpty {
                        Text("لا توجد آيات مضافة حتى الآن. يمكنك إضافة آيات من القرآن الكريم أو كتابتها يدوياً.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .padding(.vertical, 8)
                    } else {
                        ForEach(Array(verses.enumerated()), id: \.element.id) { vIndex, verse in
                            VerseEditorRow(
                                verse: verse,
                                isExpanded: expandedVerseId == verse.id,
                                partTypes: partTypes,
                                onToggleExpand: {
                                    withAnimation(.snappy(duration: 0.25)) {
                                        if expandedVerseId == verse.id {
                                            expandedVerseId = nil
                                        } else {
                                            expandedVerseId = verse.id
                                        }
                                    }
                                },
                                onUpdate: { updatedVerse in
                                    verses[vIndex] = updatedVerse
                                },
                                onMoveUp: vIndex > 0 ? {
                                    withAnimation {
                                        verses.swapAt(vIndex, vIndex - 1)
                                    }
                                } : nil,
                                onMoveDown: vIndex < verses.count - 1 ? {
                                    withAnimation {
                                        verses.swapAt(vIndex, vIndex + 1)
                                    }
                                } : nil,
                                onDelete: {
                                    withAnimation {
                                        verses.remove(at: vIndex)
                                    }
                                }
                            )
                        }
                    }
                } header: {
                    Text("الآيات (\(verses.count))")
                }

                // Section: Notes
                Section {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("ملاحظة عامة")
                            .font(.caption.bold())
                            .foregroundStyle(.secondary)
                        TextEditor(text: $note)
                            .frame(minHeight: 65)
                            .environment(\.layoutDirection, .rightToLeft)
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        HStack(spacing: 6) {
                            Circle()
                                .fill(Color(hex: "#6549A3"))
                                .frame(width: 8, height: 8)
                            Text("فائدة فريدة / إضافية")
                                .font(.caption.bold())
                                .foregroundStyle(Color(hex: "#6549A3"))
                        }
                        TextEditor(text: $unote)
                            .frame(minHeight: 65)
                            .environment(\.layoutDirection, .rightToLeft)
                    }
                } header: {
                    Text("الملاحظات والفوائد")
                }

                // Section: Danger Zone (Edit mode only)
                if initialGroup != nil {
                    Section {
                        Button(role: .destructive) {
                            showDeleteConfirm = true
                        } label: {
                            HStack {
                                Spacer()
                                Text("حذف هذه المجموعة نهائياً")
                                    .font(.subheadline.bold())
                                Spacer()
                            }
                        }
                    }
                }
            }
            .navigationTitle(initialGroup == nil ? "مجموعة جديدة" : "تعديل المجموعة")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("إلغاء") { dismiss() }
                        .accessibilityIdentifier("mutshabehat-group-cancel-button")
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("حفظ") {
                        saveGroup()
                    }
                    .font(.headline.bold())
                    .accessibilityIdentifier("mutshabehat-group-save-button")
                }
            }
            .sheet(isPresented: $showQuranSearch) {
                MutshabehatQuranSearchView(library: library) { newVerses in
                    verses.append(contentsOf: newVerses)
                }
            }
            .sheet(isPresented: $showAutoColor) {
                AutoColorPickerView(verses: verses) { aIdx, bIdx, partsA, partsB in
                    if aIdx < verses.count { verses[aIdx].parts = partsA }
                    if bIdx < verses.count { verses[bIdx].parts = partsB }
                }
            }
            .sheet(isPresented: $showWordLinker) {
                WordLinkerView(verses: verses) { updated in
                    verses = updated
                }
            }
            .alert("تأكيد الحذف", isPresented: $showDeleteConfirm) {
                Button("حذف", role: .destructive) {
                    if let gid = initialGroup?.id {
                        db.deletePersonalGroup(groupId: gid)
                        onDelete?(gid)
                        dismiss()
                    }
                }
                Button("إلغاء", role: .cancel) {}
            } message: {
                Text("هل أنت متأكد من حذف هذه المجموعة نهائياً؟ لا يمكن التراجع عن هذا الإجراء.")
            }
            .alert("تنبيه", isPresented: Binding(
                get: { validationError != nil },
                set: { if !$0 { validationError = nil } }
            )) {
                Button("حسناً", role: .cancel) {}
            } message: {
                Text(validationError ?? "")
            }
            .onAppear {
                loadInitialState()
            }
        }
    }

    private func loadInitialState() {
        if let g = initialGroup {
            title = g.title
            colorHex = g.color
            status = g.status
            favorite = g.favorite
            completed = g.completed
            note = g.note ?? ""
            unote = g.unote ?? ""
            verses = g.verses
        } else {
            colorHex = suggestedColors.randomElement() ?? "#55b94f"
        }
    }

    private func addBlankVerse() {
        let newVerse = PersonalVerse(
            id: UUID().uuidString,
            surah: "",
            ayah: 1,
            label: nil,
            sortOrder: verses.count,
            parts: [PersonalPart(id: UUID().uuidString, type: "normal", text: "", sortOrder: 0)]
        )
        verses.append(newVerse)
        expandedVerseId = newVerse.id
    }

    private func saveGroup() {
        let cleanTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanTitle.isEmpty else {
            validationError = "يرجى كتابة عنوان للمجموعة"
            return
        }

        let groupId = initialGroup?.id ?? UUID().uuidString
        let dateNow = ISO8601DateFormatter().string(from: Date())

        let savedGroup = PersonalGroup(
            id: groupId,
            title: cleanTitle,
            color: colorHex,
            status: status,
            favorite: favorite,
            completed: completed,
            note: note.trimmingCharacters(in: .whitespaces).isEmpty ? nil : note,
            unote: unote.trimmingCharacters(in: .whitespaces).isEmpty ? nil : unote,
            createdAt: initialGroup?.createdAt ?? dateNow,
            updatedAt: dateNow,
            verses: verses
        )

        db.savePersonalGroup(savedGroup)
        onSave(savedGroup)
        dismiss()
    }
}

// MARK: - Verse Editor Row

private struct VerseEditorRow: View {
    let verse: PersonalVerse
    let isExpanded: Bool
    let partTypes: [(key: String, label: String, style: MutshabehatPartStyle)]
    let onToggleExpand: () -> Void
    let onUpdate: (PersonalVerse) -> Void
    let onMoveUp: (() -> Void)?
    let onMoveDown: (() -> Void)?
    let onDelete: () -> Void

    @State private var surah: String = ""
    @State private var ayah: Int = 1
    @State private var label: String = ""
    @State private var parts: [PersonalPart] = []

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Verse Header Row (Clickable to expand/collapse)
            HStack(spacing: 8) {
                Button(action: onToggleExpand) {
                    HStack(spacing: 6) {
                        Image(systemName: isExpanded ? "chevron.down.circle.fill" : "chevron.left.circle")
                            .foregroundColor(.accentColor)
                            .font(.system(size: 15))

                        Text(surah.isEmpty ? "سورة جديدة" : surah)
                            .font(.caption.bold())
                            .foregroundColor(.primary)

                        Text("— آية \(ayah)")
                            .font(.caption.monospacedDigit())
                            .foregroundColor(.secondary)

                        if !label.isEmpty {
                            Text("(\(label))")
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                    }
                }
                .buttonStyle(.plain)

                Spacer()

                // Reordering & Deletion
                HStack(spacing: 4) {
                    if let onMoveUp = onMoveUp {
                        Button(action: onMoveUp) {
                            Image(systemName: "arrow.up")
                                .font(.system(size: 11, weight: .bold))
                                .padding(4)
                        }
                        .buttonStyle(.plain)
                    }

                    if let onMoveDown = onMoveDown {
                        Button(action: onMoveDown) {
                            Image(systemName: "arrow.down")
                                .font(.system(size: 11, weight: .bold))
                                .padding(4)
                        }
                        .buttonStyle(.plain)
                    }

                    Button(action: onDelete) {
                        Image(systemName: "trash")
                            .font(.system(size: 11))
                            .foregroundColor(.red)
                            .padding(4)
                    }
                    .buttonStyle(.plain)
                }
            }

            // Live Preview of parts
            ArabicDiffView(parts: parts)
                .padding(8)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(uiColor: .tertiarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .onTapGesture(perform: onToggleExpand)

            // Expanded Editor Form
            if isExpanded {
                VStack(alignment: .leading, spacing: 10) {
                    Divider()

                    // Surah, Ayah, Label inputs
                    HStack(spacing: 8) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("السورة")
                                .font(.caption2.bold())
                                .foregroundStyle(.secondary)
                            TextField("اسم السورة", text: $surah)
                                .textFieldStyle(.roundedBorder)
                                .environment(\.layoutDirection, .rightToLeft)
                                .onChange(of: surah) { notifyUpdate() }
                        }

                        VStack(alignment: .leading, spacing: 4) {
                            Text("رقم الآية")
                                .font(.caption2.bold())
                                .foregroundStyle(.secondary)
                            TextField("رقم الآية", value: $ayah, format: .number)
                                .textFieldStyle(.roundedBorder)
                                .keyboardType(.numberPad)
                                .onChange(of: ayah) { notifyUpdate() }
                        }
                        .frame(width: 75)

                        VStack(alignment: .leading, spacing: 4) {
                            Text("ملاحظة")
                                .font(.caption2.bold())
                                .foregroundStyle(.secondary)
                            TextField("اختياري", text: $label)
                                .textFieldStyle(.roundedBorder)
                                .environment(\.layoutDirection, .rightToLeft)
                                .onChange(of: label) { notifyUpdate() }
                        }
                    }

                    // Parts Editor
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text("أجزاء الآية")
                                .font(.caption.bold())
                                .foregroundStyle(.secondary)
                            Spacer()
                            Button {
                                addPart()
                            } label: {
                                HStack(spacing: 2) {
                                    Image(systemName: "plus")
                                    Text("جزء")
                                }
                                .font(.caption.bold())
                            }
                        }

                        ForEach(Array(parts.enumerated()), id: \.element.id) { pIndex, part in
                            HStack(alignment: .top, spacing: 6) {
                                // Part Type Menu
                                Menu {
                                    ForEach(partTypes, id: \.key) { t in
                                        Button(t.label) {
                                            parts[pIndex].type = t.key
                                            notifyUpdate()
                                        }
                                    }
                                } label: {
                                    let style = MutshabehatPartStyle(rawType: part.type)
                                    let title = partTypes.first(where: { $0.key == part.type })?.label ?? "عادي"
                                    HStack(spacing: 4) {
                                        Circle()
                                            .fill(style != nil ? Color(uiColor: style!.foreground) : Color.gray)
                                            .frame(width: 8, height: 8)
                                        Text(title)
                                            .font(.caption2.bold())
                                    }
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 7)
                                    .background(style != nil ? Color(uiColor: style!.background) : Color(uiColor: .tertiarySystemFill))
                                    .clipShape(RoundedRectangle(cornerRadius: 6))
                                }

                                // Text input for part
                                TextField("نص الجزء...", text: Binding(
                                    get: { part.text },
                                    set: { newText in
                                        parts[pIndex].text = newText
                                        notifyUpdate()
                                    }
                                ))
                                .font(.custom("KFGQPCUthmanicScriptHAFS", size: 19, relativeTo: .body))
                                .environment(\.layoutDirection, .rightToLeft)
                                .textFieldStyle(.roundedBorder)

                                // Up/Down/Delete Part
                                HStack(spacing: 2) {
                                    if pIndex > 0 {
                                        Button {
                                            parts.swapAt(pIndex, pIndex - 1)
                                            notifyUpdate()
                                        } label: {
                                            Image(systemName: "arrow.up")
                                                .font(.system(size: 10))
                                                .padding(4)
                                        }
                                    }
                                    if pIndex < parts.count - 1 {
                                        Button {
                                            parts.swapAt(pIndex, pIndex + 1)
                                            notifyUpdate()
                                        } label: {
                                            Image(systemName: "arrow.down")
                                                .font(.system(size: 10))
                                                .padding(4)
                                        }
                                    }
                                    Button {
                                        parts.remove(at: pIndex)
                                        notifyUpdate()
                                    } label: {
                                        Image(systemName: "xmark")
                                            .font(.system(size: 10, weight: .bold))
                                            .foregroundColor(.red)
                                            .padding(4)
                                    }
                                }
                                .padding(.top, 4)
                            }
                        }
                    }
                }
                .padding(.top, 4)
            }
        }
        .padding(.vertical, 4)
        .onAppear {
            surah = verse.surah
            ayah = verse.ayah
            label = verse.label ?? ""
            parts = verse.parts
        }
        .onChange(of: verse) { _, newVerse in
            surah = newVerse.surah
            ayah = newVerse.ayah
            label = newVerse.label ?? ""
            parts = newVerse.parts
        }
    }

    private func addPart() {
        parts.append(PersonalPart(id: UUID().uuidString, type: "normal", text: "", sortOrder: parts.count))
        notifyUpdate()
    }

    private func notifyUpdate() {
        var updated = verse
        updated.surah = surah
        updated.ayah = ayah
        updated.label = label.trimmingCharacters(in: .whitespaces).isEmpty ? nil : label
        updated.parts = parts
        onUpdate(updated)
    }
}

// Extension to extract Hex string from SwiftUI Color
extension Color {
    func toHex() -> String? {
        let uic = UIColor(self)
        guard let components = uic.cgColor.components, components.count >= 3 else {
            return nil
        }
        let r = Float(components[0])
        let g = Float(components[1])
        let b = Float(components[2])
        return String(format: "#%02lX%02lX%02lX", lroundf(r * 255), lroundf(g * 255), lroundf(b * 255))
    }
}
