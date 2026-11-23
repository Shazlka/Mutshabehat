import MushafCore
import SwiftUI

/// Optional goals: the list with progress, and a small sheet to add one. Only the definition is stored.
struct GoalsSection: View {
    let store: MemorizationStore
    let library: MushafLibrary
    let language: AppLanguage

    @State private var adding = false

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(verbatim: copy("الأهداف", "Goals")).font(.subheadline).foregroundStyle(.secondary)
            let goals = store.goals
            if goals.isEmpty {
                Text(verbatim: copy("لا توجد أهداف. الأهداف اختيارية.", "No goals yet. Goals are optional."))
                    .font(.footnote).foregroundStyle(.secondary)
            }
            ForEach(goals, id: \.id) { goal in
                goalRow(goal)
            }
            Button(copy("إضافة هدف", "Add a goal")) { adding = true }
                .font(.subheadline)
                .accessibilityIdentifier("memo-goal-add")
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color.secondary.opacity(0.1)))
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("memo-goals")
        .sheet(isPresented: $adding) {
            AddGoalSheet(store: store, library: library, language: language)
        }
    }

    private func goalRow(_ goal: GoalDefinition) -> some View {
        let progress = store.goalProgress(goal)
        return VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(verbatim: title(for: goal)).font(.subheadline.weight(.semibold))
                Spacer()
                Text(verbatim: MemorizationTheme.percent(progress.fraction * 100, language: language))
                    .font(.footnote).monospacedDigit()
                    .accessibilityIdentifier("memo-goal-fraction")
            }
            ProgressView(value: progress.fraction).tint(MemorizationTheme.color(.mastered))
            Text(verbatim: remaining(progress)).font(.caption).foregroundStyle(.secondary)
        }
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("memo-goal-\(goal.id.uuidString)")
        .contextMenu {
            Button(role: .destructive) { store.deleteGoal(goal.id) } label: { Text(verbatim: copy("حذف الهدف", "Delete goal")) }
        }
    }

    private func title(for goal: GoalDefinition) -> String {
        switch goal.kind {
        case let .ayatPerDay(count): copy("\(MemorizationTheme.number(count, language: language)) آية يومياً", "\(count) ayat a day")
        case let .pageEquivalentsPerWeek(pages): copy("\(MemorizationTheme.decimal(pages, language: language)) صفحة أسبوعياً", "\(pages) pages a week")
        case let .completeSurah(number): copy("إتمام سورة \(library.surahNames[number] ?? "\(number)")", "Complete surah \(library.surahNames[number] ?? "\(number)")")
        case let .completeJuz(number): copy("إتمام الجزء \(MemorizationTheme.number(number, language: language))", "Complete juz \(number)")
        case let .completeQuranBy(date): copy("إتمام القرآن بحلول \(date.formatted(date: .abbreviated, time: .omitted))",
                                              "Complete the Quran by \(date.formatted(date: .abbreviated, time: .omitted))")
        }
    }

    private func remaining(_ progress: GoalProgress) -> String {
        if progress.isReached { return copy("تم تحقيق الهدف", "Goal reached") }
        var parts: [String] = []
        if let days = progress.remainingDays { parts.append(copy("\(MemorizationTheme.number(days, language: language)) يوم", "\(days) days")) }
        if progress.remainingAyat > 0 { parts.append(copy("\(MemorizationTheme.number(progress.remainingAyat, language: language)) آية", "\(progress.remainingAyat) ayat")) }
        if progress.remainingPageEquivalents > 0.05 {
            parts.append(copy("\(MemorizationTheme.decimal(progress.remainingPageEquivalents, language: language)) صفحة", "\(MemorizationTheme.decimal(progress.remainingPageEquivalents, language: language)) pages"))
        }
        return copy("المتبقي: ", "Remaining: ") + parts.joined(separator: " · ")
    }

    private func copy(_ ar: String, _ en: String) -> String { language == .arabic ? ar : en }
}

private struct AddGoalSheet: View {
    let store: MemorizationStore
    let library: MushafLibrary
    let language: AppLanguage

    @Environment(\.dismiss) private var dismiss

    private enum Kind: Hashable { case ayatPerDay, pagesPerWeek, surah, juz, quran }

    @State private var kind: Kind = .ayatPerDay
    @State private var amount = 10
    @State private var surah = 78
    @State private var juz = 30
    @State private var date = Calendar.current.date(byAdding: .month, value: 1, to: Date()) ?? Date()
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Picker(copy("نوع الهدف", "Goal type"), selection: $kind) {
                    Text(verbatim: copy("آيات يومياً", "Ayat a day")).tag(Kind.ayatPerDay)
                    Text(verbatim: copy("صفحات أسبوعياً", "Pages a week")).tag(Kind.pagesPerWeek)
                    Text(verbatim: copy("إتمام سورة", "Complete a surah")).tag(Kind.surah)
                    Text(verbatim: copy("إتمام جزء", "Complete a juz")).tag(Kind.juz)
                    Text(verbatim: copy("إتمام القرآن بتاريخ", "Complete the Quran by a date")).tag(Kind.quran)
                }
                .accessibilityIdentifier("memo-goal-kind")
                switch kind {
                case .ayatPerDay, .pagesPerWeek:
                    Stepper(value: $amount, in: 1...200) {
                        Text(verbatim: "\(MemorizationTheme.number(amount, language: language))")
                    }
                    .accessibilityIdentifier("memo-goal-amount")
                case .surah:
                    Picker(copy("السورة", "Surah"), selection: $surah) {
                        ForEach(library.surahs) { entry in Text(verbatim: entry.name).tag(entry.number) }
                    }
                    .pickerStyle(.menu)
                case .juz:
                    Picker(copy("الجزء", "Juz"), selection: $juz) {
                        ForEach(1...30, id: \.self) { Text(verbatim: MemorizationTheme.number($0, language: language)).tag($0) }
                    }
                    .pickerStyle(.menu)
                case .quran:
                    DatePicker(copy("التاريخ", "Date"), selection: $date, in: Date()..., displayedComponents: .date)
                }
                Button(copy("حفظ الهدف", "Save goal"), action: save)
                    .accessibilityIdentifier("memo-goal-save")
            }
            .navigationTitle(copy("هدف جديد", "New goal"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button(copy("إلغاء", "Cancel")) { dismiss() } } }
            .alert(copy("تعذر الحفظ", "Could not save"),
                   isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
                Button(copy("حسنًا", "OK"), role: .cancel) {}
            } message: {
                Text(verbatim: errorMessage ?? "")
            }
        }
        .environment(\.layoutDirection, language.layoutDirection)
    }

    private func save() {
        let goalKind: GoalKind
        switch kind {
        case .ayatPerDay: goalKind = .ayatPerDay(amount)
        case .pagesPerWeek: goalKind = .pageEquivalentsPerWeek(Double(amount))
        case .surah: goalKind = .completeSurah(surah)
        case .juz: goalKind = .completeJuz(juz)
        case .quran: goalKind = .completeQuranBy(date)
        }
        do {
            try store.addGoal(goalKind)
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func copy(_ ar: String, _ en: String) -> String { language == .arabic ? ar : en }
}
