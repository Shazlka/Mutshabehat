import MushafCore
import SwiftUI

struct AyahSheetTarget: Identifiable {
    let page: MushafPage
    let ayah: AyahKey
    var id: String { ayah.description }
}

/// What a long-press on an ayah offers: the two bookmark actions (as before), the ayah's memorization status,
/// the "currently learning" flag, the whole page, and the start of a range of ayat.
struct AyahSheet: View {
    let target: AyahSheetTarget
    let library: MushafLibrary
    let store: MemorizationStore
    let language: AppLanguage
    let isAyahBookmarked: Bool
    let isPageBookmarked: Bool
    let toggleAyahBookmark: () -> Void
    let togglePageBookmark: () -> Void
    let startRange: () -> Void
    let openPageSheet: () -> Void
    let onApplied: (MemorizationStore.ApplyResult, BatchPlan) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var errorMessage: String?

    private var key: AyahKey { target.ayah }
    private var current: AyahMemorizationRecord? { store.record(of: key) }
    private var surahName: String { library.surahNames[key.surah] ?? "\(key.surah)" }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text(verbatim: copy("\(surahName) - آية \(MemorizationTheme.number(key.ayah, language: language)) (صفحة \(MemorizationTheme.number(target.page.number, language: language)))",
                                        "\(surahName) - Ayah \(key.ayah) (Page \(target.page.number))"))
                        .font(.subheadline)
                }

                Section(copy("الفواصل", "Bookmarks")) {
                    Button(isAyahBookmarked ? copy("إزالة فاصل الآية", "Remove Ayah Bookmark") : copy("حفظ فاصل للآية", "Bookmark Ayah")) {
                        toggleAyahBookmark()
                        dismiss()
                    }
                    .accessibilityIdentifier("ayah-sheet-bookmark-ayah")
                    Button(isPageBookmarked ? copy("إزالة فاصل الصفحة", "Remove Page Bookmark") : copy("حفظ فاصل للصفحة", "Bookmark Page")) {
                        togglePageBookmark()
                        dismiss()
                    }
                    .accessibilityIdentifier("ayah-sheet-bookmark-page")
                }

                Section(copy("حالة الحفظ", "Memorization status")) {
                    ForEach(MemorizationStatus.allCases, id: \.self) { status in
                        Button { apply(status) } label: {
                            HStack {
                                Text(verbatim: MemorizationTheme.shape(status))
                                    .frame(width: 30)
                                    .foregroundStyle(MemorizationTheme.color(status))
                                Text(verbatim: MemorizationTheme.label(status, language: language))
                                Spacer()
                                if store.status(of: key) == status {
                                    Image(systemName: "checkmark").foregroundStyle(MemorizationTheme.color(status))
                                }
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("memo-ayah-status-\(status.rawValue)")
                    }
                    Toggle(copy("قيد الحفظ", "Currently memorizing"), isOn: Binding(
                        get: { current?.isCurrentlyLearning ?? false },
                        set: { setLearning($0) }))
                        .accessibilityIdentifier("memo-ayah-learning")
                }

                Section {
                    Button(copy("تحديد من هنا", "Start a range here")) {
                        startRange()
                        dismiss()
                    }
                    .accessibilityIdentifier("memo-range-start")
                    Button(copy("تحديث حفظ الصفحة كلها", "Update the whole page")) {
                        dismiss()
                        openPageSheet()
                    }
                    .accessibilityIdentifier("memo-ayah-page-all")
                }
            }
            .navigationTitle(copy("خيارات الآية", "Ayah options"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button(copy("إغلاق", "Close")) { dismiss() } } }
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

    private func apply(_ status: MemorizationStatus) {
        let plan = store.plan(.ayahRange(surah: key.surah, from: key.ayah, to: key.ayah), label: "\(surahName) \(key.ayah)",
                              status: status)
        guard !plan.changes.isEmpty else { dismiss(); return }
        do {
            let result = try store.apply(plan)
            onApplied(result, plan)
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func setLearning(_ value: Bool) {
        let status = store.status(of: key)
        let plan = store.plan(.ayahRange(surah: key.surah, from: key.ayah, to: key.ayah), label: "\(surahName) \(key.ayah)",
                              status: status, learning: value)
        guard !plan.changes.isEmpty else { return }
        do {
            let result = try store.apply(plan)
            onApplied(result, plan)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func copy(_ ar: String, _ en: String) -> String { language == .arabic ? ar : en }
}

/// Shown at the bottom of the reader while the start of a range is stored: «من البقرة ١٢ — اختر آية النهاية».
struct RangePill: View {
    let start: AyahKey
    let library: MushafLibrary
    let language: AppLanguage
    let cancel: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            let name = library.surahNames[start.surah] ?? "\(start.surah)"
            Text(verbatim: language == .arabic
                 ? "من \(name) \(MemorizationTheme.number(start.ayah, language: language)) — اختر آية النهاية"
                 : "From \(name) \(start.ayah) — choose the last ayah")
                .font(.subheadline.weight(.semibold))
                .accessibilityIdentifier("memo-range-pill")
            Button(language == .arabic ? "إلغاء" : "Cancel", action: cancel)
                .font(.subheadline.weight(.bold))
                .accessibilityIdentifier("memo-range-cancel")
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(.thickMaterial, in: Capsule())
        .overlay(Capsule().strokeBorder(Color.primary.opacity(0.12), lineWidth: 0.5))
        .shadow(color: .black.opacity(0.12), radius: 8, y: 2)
        .environment(\.layoutDirection, language.layoutDirection)
    }
}

struct RangeRequest: Identifiable {
    let id = UUID()
    let selection: MemorizationSelection
}
