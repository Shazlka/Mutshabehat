import MushafCore
import SwiftUI

/// «تحديث حفظ الصفحة»: the page's ayah mix, the four statuses applied to the whole page in one tap, and a
/// checklist to apply a status to only some of its ayat. Opened from the banner mark in the reader.
struct PageSheet: View {
    let page: Int
    let store: MemorizationStore
    let library: MushafLibrary
    let language: AppLanguage
    let onApplied: (MemorizationStore.ApplyResult, BatchPlan) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var picking = false
    @State private var selected: Set<AyahKey> = []
    @State private var pendingPlan: BatchPlan?
    @State private var pendingStatus: MemorizationStatus?
    @State private var errorMessage: String?

    private var progress: MemorizationPageProgress { store.pageProgress(page) }
    private var keys: [AyahKey] { store.index.ayat(onPage: page) }

    var body: some View {
        NavigationStack {
            List {
                summarySection
                statusSection
                if picking {
                    checklistSection
                } else {
                    Section {
                        Button(copy("تحديد آيات فقط", "Choose ayat only")) { picking = true }
                            .accessibilityIdentifier("memo-page-pick")
                    }
                }
            }
            .navigationTitle(copy("حفظ الصفحة \(MemorizationTheme.number(page, language: language))",
                                  "Page \(page) memorization"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button(copy("إغلاق", "Close")) { dismiss() } }
            }
            .alert(copy("تأكيد التحديث", "Confirm update"),
                   isPresented: Binding(get: { pendingPlan != nil }, set: { if !$0 { pendingPlan = nil } })) {
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

    // MARK: Sections

    private var summarySection: some View {
        Section {
            HStack {
                Text(verbatim: MemorizationTheme.shape(progress.state))
                    .foregroundStyle(MemorizationTheme.color(progress.state))
                Text(verbatim: MemorizationTheme.label(progress.state, language: language)).font(.headline)
            }
            MemorizationMixBar(fractions: progress.mix.fractions, height: 8)
            Text(verbatim: copy("\(MemorizationTheme.number(progress.mix.masteredAyahs, language: language)) من \(MemorizationTheme.number(progress.mix.ayahCount, language: language)) آيات متقنة",
                                "\(progress.mix.masteredAyahs) of \(progress.mix.ayahCount) ayat mastered"))
                .font(.footnote)
                .foregroundStyle(.secondary)
                .accessibilityIdentifier("memo-page-summary")
        }
    }

    private var checklistSection: some View {
        Section(copy("اختر الآيات", "Choose ayat")) {
            ForEach(keys, id: \.self) { key in
                Button {
                    if selected.contains(key) { selected.remove(key) } else { selected.insert(key) }
                } label: {
                    HStack {
                        Image(systemName: selected.contains(key) ? "checkmark.circle.fill" : "circle")
                        Text(verbatim: "\(library.surahNames[key.surah] ?? "") \(MemorizationTheme.number(key.ayah, language: language))")
                        Spacer()
                        Text(verbatim: MemorizationTheme.shape(store.status(of: key)))
                            .foregroundStyle(MemorizationTheme.color(store.status(of: key)))
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("memo-page-ayah-row-\(key.surah)-\(key.ayah)")
            }
        }
    }

    private var statusSection: some View {
        Section(picking ? copy("الحالة للآيات المحددة", "Status for the chosen ayat") : copy("الصفحة كلها", "The whole page")) {
            ForEach(MemorizationStatus.allCases, id: \.self) { status in
                Button { apply(status) } label: {
                    HStack {
                        Text(verbatim: MemorizationTheme.shape(status))
                            .frame(width: 30)
                            .foregroundStyle(MemorizationTheme.color(status))
                        Text(verbatim: MemorizationTheme.label(status, language: language))
                        Spacer()
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .disabled(picking && selected.isEmpty)
                .accessibilityIdentifier("memo-page-status-\(status.rawValue)")
            }
        }
    }

    // MARK: Applying

    private var selection: MemorizationSelection {
        picking ? .ayat(selected) : .pageRange(page...page)
    }

    private var pageLabel: String { copy("صفحة \(MemorizationTheme.number(page, language: language))", "Page \(page)") }

    private func apply(_ status: MemorizationStatus) {
        let plan = store.plan(selection, label: pageLabel, status: status)
        guard !plan.changes.isEmpty else {
            errorMessage = copy("لا يوجد تغيير: كل هذه الآيات بهذه الحالة بالفعل.", "Nothing to change: all these ayat already have this status.")
            return
        }
        if store.needsConfirmation(selection: selection, plan: plan) {
            pendingStatus = status
            pendingPlan = plan
        } else {
            commit(plan)
        }
    }

    private func commit(_ plan: BatchPlan) {
        pendingPlan = nil
        do {
            let result = try store.apply(plan)
            onApplied(result, plan)
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private var confirmationMessage: String {
        guard let plan = pendingPlan, let status = pendingStatus else { return "" }
        let count = MemorizationTheme.number(plan.changes.count, language: language)
        let label = MemorizationTheme.label(status, language: language)
        return copy("سيتم تحديث \(count) آية إلى «\(label)».", "\(count) ayat will be set to “\(label)”.")
    }

    private func copy(_ ar: String, _ en: String) -> String { language == .arabic ? ar : en }
}

struct PageSheetRequest: Identifiable {
    let page: Int
    var id: Int { page }
}
