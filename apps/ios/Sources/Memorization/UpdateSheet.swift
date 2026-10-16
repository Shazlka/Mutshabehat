import MushafCore
import SwiftUI

/// The fast way to change memorization: pick what (a surah, ayat, pages or a juz), tap a status, apply. Large
/// changes ask for confirmation first; the caller shows the undo toast afterwards.
struct UpdateSheet: View {
    let store: MemorizationStore
    let library: MushafLibrary
    let language: AppLanguage
    let onApplied: (MemorizationStore.ApplyResult, BatchPlan) -> Void

    @Environment(\.dismiss) private var dismiss

    enum Mode: Hashable { case surah, ayat, pages, juz, custom }

    @State private var mode: Mode = .surah
    @State private var custom: MemorizationSelection?
    @State private var surah = 1
    @State private var fromAyah = 1
    @State private var toAyah = 7
    @State private var fromPage = 1
    @State private var toPage = 1
    @State private var juz = 1
    @State private var status: MemorizationStatus?
    @State private var learning = false
    @State private var setCurrent = false
    @State private var search = ""
    @State private var pendingPlan: BatchPlan?
    @State private var errorMessage: String?
    /// Which text field has the keyboard (by its accessibility identifier); setting it to nil dismisses the keyboard.
    @FocusState private var focusedField: String?

    init(store: MemorizationStore, library: MushafLibrary, language: AppLanguage, initial: MemorizationSelection?,
         onApplied: @escaping (MemorizationStore.ApplyResult, BatchPlan) -> Void) {
        self.store = store
        self.library = library
        self.language = language
        self.onApplied = onApplied
        let values = initial.map(Self.initialValues(for:)) ?? Values()
        _mode = State(initialValue: values.mode)
        _custom = State(initialValue: values.custom)
        _surah = State(initialValue: values.surah)
        _fromAyah = State(initialValue: values.fromAyah)
        _toAyah = State(initialValue: values.toAyah)
        _fromPage = State(initialValue: values.fromPage)
        _toPage = State(initialValue: values.toPage)
        _juz = State(initialValue: values.juz)
    }

    // The initial values chosen from a preselected selection.
    private struct Values {
        var mode: Mode = .surah
        var custom: MemorizationSelection?
        var surah = 1, fromAyah = 1, toAyah = 7, fromPage = 1, toPage = 1, juz = 1
    }

    private static func initialValues(for selection: MemorizationSelection) -> Values {
        var values = Values()
        switch selection {
        case let .surah(number):
            values.mode = .surah; values.surah = number
        case let .ayahRange(surah, from, to):
            values.mode = .ayat; values.surah = surah; values.fromAyah = from; values.toAyah = to
        case let .pageRange(range):
            values.mode = .pages; values.fromPage = range.lowerBound; values.toPage = range.upperBound
        case let .juz(number):
            values.mode = .juz; values.juz = number
        case let .span(from, to) where from.surah == to.surah:
            values.mode = .ayat; values.surah = from.surah; values.fromAyah = min(from.ayah, to.ayah); values.toAyah = max(from.ayah, to.ayah)
        default:
            values.mode = .custom; values.custom = selection
        }
        return values
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField(copy("اكتب: يس · البقرة ٢٥٥ · صفحة ٥٨٢", "Type: Yasin · Baqarah 255 · page 582"), text: $search)
                        .onSubmit(applySearch)
                        .focused($focusedField, equals: "memo-update-search")
                        .accessibilityIdentifier("memo-update-search")
                }
                Section {
                    Picker(copy("النطاق", "Range"), selection: $mode) {
                        Text(verbatim: copy("سورة", "Surah")).tag(Mode.surah)
                        Text(verbatim: copy("آيات", "Ayat")).tag(Mode.ayat)
                        Text(verbatim: copy("صفحات", "Pages")).tag(Mode.pages)
                        Text(verbatim: copy("جزء", "Juz")).tag(Mode.juz)
                    }
                    .pickerStyle(.segmented)
                    .accessibilityIdentifier("memo-update-mode")
                    selectionControls
                }
                Section(copy("الحالة", "Status")) {
                    ForEach(MemorizationStatus.allCases, id: \.self) { candidate in
                        statusButton(candidate)
                    }
                    Toggle(copy("قيد الحفظ", "Currently memorizing"), isOn: $learning)
                        .accessibilityIdentifier("memo-update-learning")
                    Toggle(copy("اجعله موضع الحفظ الحالي", "Make this my current position"), isOn: $setCurrent)
                        .accessibilityIdentifier("memo-update-set-current")
                }
            }
            .safeAreaInset(edge: .bottom) {
                VStack(spacing: 8) {
                    Text(verbatim: countLine)
                        .font(.subheadline)
                        .accessibilityIdentifier("memo-update-count")
                    Button(action: applyTapped) {
                        Text(verbatim: copy("حفظ", "Save")).frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(MemorizationTheme.color(.mastered))
                    .disabled(status == nil || resolvedCount == 0)
                    .accessibilityIdentifier("memo-update-apply")
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(.regularMaterial)
            }
            .navigationTitle(copy("تحديث الحفظ", "Update memorization"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button(copy("إلغاء", "Cancel")) { dismiss() } }
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button(copy("تم", "Done")) {
                        // Focus state is what SwiftUI honours on iPad too; the responder-chain action did not
                        // reach the field there, so the keyboard stayed up.
                        focusedField = nil
                    }
                    .accessibilityIdentifier("memo-keyboard-done")
                }
            }
            .alert(confirmationTitle, isPresented: Binding(get: { pendingPlan != nil }, set: { if !$0 { pendingPlan = nil } })) {
                Button(copy("تأكيد", "Confirm")) { if let pendingPlan { commit(pendingPlan) } }
                Button(copy("إلغاء", "Cancel"), role: .cancel) { pendingPlan = nil }
            } message: {
                Text(verbatim: confirmationMessage)
            }
            .alert(copy("تعذر التحديث", "Could not update"),
                   isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
                Button(copy("حسنًا", "OK"), role: .cancel) {}
            } message: {
                Text(verbatim: errorMessage ?? "")
            }
        }
        .environment(\.layoutDirection, language.layoutDirection)
        .presentationDetents([.large])
        .presentationSizing(.page)
    }

    // MARK: Controls

    @ViewBuilder
    private var selectionControls: some View {
        switch mode {
        case .surah:
            surahPicker
        case .ayat:
            surahPicker
            HStack {
                numberField(copy("من آية", "From ayah"), $fromAyah, "memo-update-from")
                numberField(copy("إلى آية", "To ayah"), $toAyah, "memo-update-to")
            }
        case .pages:
            HStack {
                numberField(copy("من صفحة", "From page"), $fromPage, "memo-update-page-from")
                numberField(copy("إلى صفحة", "To page"), $toPage, "memo-update-page-to")
            }
        case .juz:
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 6), spacing: 8) {
                ForEach(1...30, id: \.self) { number in
                    Button { juz = number } label: {
                        Text(verbatim: MemorizationTheme.number(number, language: language))
                            .font(.subheadline)
                            .frame(maxWidth: .infinity, minHeight: 34)
                            .background(RoundedRectangle(cornerRadius: 8)
                                .fill(juz == number ? MemorizationTheme.color(.mastered).opacity(0.25) : Color.secondary.opacity(0.1)))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("memo-update-juz-\(number)")
                }
            }
        case .custom:
            Text(verbatim: selectionLabel).font(.subheadline)
        }
    }

    private var surahPicker: some View {
        Picker(copy("السورة", "Surah"), selection: $surah) {
            ForEach(library.surahs) { entry in
                Text(verbatim: "\(MemorizationTheme.number(entry.number, language: language)). \(entry.name)").tag(entry.number)
            }
        }
        .pickerStyle(.menu)
        .accessibilityIdentifier("memo-update-surah")
        .onChange(of: surah) { _, _ in
            let count = max(1, store.index.ayahCount(surah: surah))
            fromAyah = min(fromAyah, count)
            toAyah = min(max(toAyah, 1), count)
        }
    }

    private func numberField(_ title: String, _ value: Binding<Int>, _ identifier: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(verbatim: title).font(.caption).foregroundStyle(.secondary)
            TextField("", value: value, format: .number)
                .keyboardType(.numberPad)
                .textFieldStyle(.roundedBorder)
                .focused($focusedField, equals: identifier)
                .submitLabel(.done)
                .onSubmit { focusedField = nil }   // iPad's number keyboard has a Return key
                .accessibilityIdentifier(identifier)
        }
    }

    private func statusButton(_ candidate: MemorizationStatus) -> some View {
        Button { status = candidate } label: {
            HStack {
                Text(verbatim: MemorizationTheme.shape(candidate))
                    .frame(width: 30)
                    .foregroundStyle(MemorizationTheme.color(candidate))
                Text(verbatim: MemorizationTheme.label(candidate, language: language))
                Spacer()
                if status == candidate { Image(systemName: "checkmark.circle.fill").foregroundStyle(MemorizationTheme.color(candidate)) }
            }
            .padding(.vertical, 4)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("memo-status-\(candidate.rawValue)")
        .accessibilityAddTraits(status == candidate ? .isSelected : [])
    }

    // MARK: Selection

    private var selection: MemorizationSelection {
        switch mode {
        case .surah: .surah(surah)
        case .ayat: .ayahRange(surah: surah, from: fromAyah, to: toAyah)
        case .pages:
            .pageRange(min(clamp(fromPage), clamp(toPage))...max(clamp(fromPage), clamp(toPage)))
        case .juz: .juz(juz)
        case .custom: custom ?? .ayat([])
        }
    }

    private func clamp(_ page: Int) -> Int { min(max(page, 1), mushafPageCount) }

    private var resolvedCount: Int { selection.resolve(in: store.index).count }

    private func name(_ surah: Int) -> String { library.surahNames[surah] ?? "\(surah)" }

    private var selectionLabel: String {
        switch selection {
        case let .surah(n): return copy("سورة \(name(n))", "Surah \(name(n))")
        case let .ayahRange(s, f, t):
            let low = min(f, t), high = max(f, t)
            return "\(name(s)) \(MemorizationTheme.number(low, language: language))–\(MemorizationTheme.number(high, language: language))"
        case let .pageRange(range):
            return range.lowerBound == range.upperBound
                ? copy("صفحة \(MemorizationTheme.number(range.lowerBound, language: language))", "Page \(range.lowerBound)")
                : copy("صفحات \(MemorizationTheme.number(range.lowerBound, language: language))–\(MemorizationTheme.number(range.upperBound, language: language))",
                       "Pages \(range.lowerBound)–\(range.upperBound)")
        case let .juz(n): return copy("الجزء \(MemorizationTheme.number(n, language: language))", "Juz \(n)")
        case let .span(from, to): return "\(name(from.surah)) \(from.ayah) → \(name(to.surah)) \(to.ayah)"
        case .ayat: return copy("آيات محددة", "Selected ayat")
        }
    }

    private var countLine: String {
        let count = MemorizationTheme.number(resolvedCount, language: language)
        return copy("\(count) آية · \(selectionLabel)", "\(count) ayat · \(selectionLabel)")
    }

    private func applySelection(_ value: MemorizationSelection) {
        let values = Self.initialValues(for: value)
        mode = values.mode
        custom = values.custom
        surah = values.surah; fromAyah = values.fromAyah; toAyah = values.toAyah
        fromPage = values.fromPage; toPage = values.toPage; juz = values.juz
    }

    private func applySearch() {
        guard let target = SelectionParser.parse(search, surahNames: library.surahNames, index: store.index) else { return }
        applySelection(target.asSelection)
    }

    // MARK: Applying

    private func applyTapped() {
        guard let status else { return }
        let plan = store.plan(selection, label: selectionLabel, status: status, learning: learning ? true : nil)
        guard !plan.changes.isEmpty else {
            errorMessage = copy("لا يوجد تغيير: كل هذه الآيات بهذه الحالة بالفعل.", "Nothing to change: all these ayat already have this status.")
            return
        }
        if store.needsConfirmation(selection: selection, plan: plan) {
            pendingPlan = plan
        } else {
            commit(plan)
        }
    }

    private func commit(_ plan: BatchPlan) {
        pendingPlan = nil
        do {
            let result = try store.apply(plan)
            if setCurrent {
                let keys = selection.resolve(in: store.index)
                if let first = keys.first, let last = keys.last { store.currentPosition = (first, last) }
            }
            onApplied(result, plan)
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private var confirmationTitle: String { copy("تأكيد التحديث", "Confirm update") }

    private var confirmationMessage: String {
        guard let plan = pendingPlan, let status else { return "" }
        let changed = MemorizationTheme.number(plan.changes.count, language: language)
        let target = MemorizationTheme.label(status, language: language)
        var text = copy("سيتم تحديث \(changed) آية من \(selectionLabel) إلى «\(target)».",
                        "\(changed) ayat of \(selectionLabel) will be set to “\(target)”.")
        if plan.unchangedCount > 0 {
            let same = MemorizationTheme.number(plan.unchangedCount, language: language)
            text += copy(" (\(same) منها بهذه الحالة بالفعل)", " (\(same) already have it)")
        }
        return text
    }

    private func copy(_ ar: String, _ en: String) -> String { language == .arabic ? ar : en }
}
