import MushafCore
import SwiftUI

/// Where the module can navigate to from the dashboard.
enum MemorizationRoute: Hashable {
    case surahList
    case surahDetail(Int)
    case pageGrid
    case ayahList(AyahFilter)
    case history
}

enum AyahFilter: Hashable {
    case status(MemorizationStatus)
    case dueForReview
    case currentlyLearning
}

/// The memorization module, opened full-screen from the reader's top bar: a dashboard with detail screens
/// pushed on a navigation stack and one bottom button to update the memorization.
struct MemorizationView: View {
    let library: MushafLibrary
    let store: MemorizationStore
    /// Closes the module and shows this page (and ayah) in the Mushaf.
    let onOpenInMushaf: (Int, AyahKey?) -> Void

    @Environment(\.dismiss) private var dismiss
    @AppStorage("app:language:v1") private var languageRaw = AppLanguage.arabic.rawValue
    @State private var path: [MemorizationRoute] = []
    @State private var updateRequest: UpdateRequest?
    @State private var toast: ToastState?

    private var language: AppLanguage { AppLanguage(rawValue: languageRaw) ?? .arabic }

    struct UpdateRequest: Identifiable {
        let id = UUID()
        var selection: MemorizationSelection?
    }

    var body: some View {
        NavigationStack(path: $path) {
            DashboardView(library: library, store: store, language: language,
                          navigate: { path.append($0) },
                          update: { updateRequest = UpdateRequest(selection: $0) },
                          openInMushaf: openInMushaf)
                .navigationTitle(language == .arabic ? "الحفظ" : "Memorization")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button(language == .arabic ? "إغلاق" : "Close") { dismiss() }
                            .accessibilityIdentifier("memo-close")
                    }
                }
                .navigationDestination(for: MemorizationRoute.self) { route in
                    destination(route)
                }
                .safeAreaInset(edge: .bottom) { updateButton }
                .memorizationToast($toast, store: store, library: library, language: language,
                                   undoFailed: { path.append(.history) })   // the history screen explains and offers "undo anyway"
        }
        .environment(\.layoutDirection, language.layoutDirection)
        .sheet(item: $updateRequest) { request in
            UpdateSheet(store: store, library: library, language: language, initial: request.selection) { result, plan in
                showToast(result: result, plan: plan)
            }
        }
    }

    // MARK: Pieces

    private var updateButton: some View {
        Button {
            updateRequest = UpdateRequest(selection: nil)
        } label: {
            Text(language == .arabic ? "تحديث الحفظ" : "Update memorization")
                .font(.headline)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
        }
        .buttonStyle(.borderedProminent)
        .tint(MemorizationTheme.color(.mastered))
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(.regularMaterial)
        .accessibilityIdentifier("memo-update-button")
    }

    @ViewBuilder
    private func destination(_ route: MemorizationRoute) -> some View {
        switch route {
        case .surahList: ComingSoonView(title: language == .arabic ? "السور" : "Surahs", identifier: "memo-surah-list")
        case .surahDetail: ComingSoonView(title: language == .arabic ? "السورة" : "Surah", identifier: "memo-surah-detail")
        case .pageGrid: ComingSoonView(title: language == .arabic ? "الصفحات" : "Pages", identifier: "memo-page-grid")
        case .ayahList: ComingSoonView(title: language == .arabic ? "الآيات" : "Ayat", identifier: "memo-ayah-list")
        case .history: ComingSoonView(title: language == .arabic ? "آخر التحديثات" : "History", identifier: "memo-history")
        }
    }

    private func openInMushaf(_ page: Int, _ ayah: AyahKey?) {
        dismiss()
        onOpenInMushaf(page, ayah)
    }

    private func showToast(result: MemorizationStore.ApplyResult, plan: BatchPlan) {
        toast = ToastState(result: result, plan: plan)
    }
}

private struct ComingSoonView: View {
    let title: String
    let identifier: String

    var body: some View {
        Text(verbatim: title)
            .navigationTitle(title)
            .accessibilityIdentifier(identifier)
    }
}
