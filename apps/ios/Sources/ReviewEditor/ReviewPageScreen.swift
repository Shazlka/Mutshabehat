#if DEBUG
import MushafCore
import SwiftUI

/// One Mushaf page for review: tap a word to open its sheet; words are tinted by review status.
struct ReviewPageScreen: View {
    @Bindable var store: ReviewStore
    let library: MushafLibrary
    let initialPage: Int
    @AppStorage("review:last-page:v1") private var lastPage = 1

    @State private var showingHistory = false
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    /// Regular width (iPad): the word's steps sit beside the page instead of in a sheet over it.
    private var sideBySide: Bool { horizontalSizeClass == .regular }

    private var selectedKeys: Set<String> {
        var keys: Set<String> = []
        if let a = store.selectedKey { keys.insert(a) }
        if let b = store.spanEndKey { keys.insert(b) }
        return keys
    }

    private var title: String {
        let names = store.mushaf?.metadata.surahNames.joined(separator: " · ") ?? ""
        return names.isEmpty ? "الصفحة \(store.pageNumber)" : names
    }

    var body: some View {
        Group {
            if sideBySide {
                HStack(spacing: 0) {
                    pageColumn
                    Divider()
                    sidePanel.frame(width: 440)
                }
            } else {
                pageColumn
            }
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showingHistory = true } label: {
                    Label("سجل التعديلات", systemImage: "clock.arrow.circlepath")
                }
                .accessibilityIdentifier("review-history-button")
            }
        }
        .sheet(isPresented: $showingHistory) { ReviewHistoryView(store: store) }
        .task(id: initialPage) {
            lastPage = initialPage
            await store.load(page: initialPage)
        }
        .sheet(isPresented: Binding(get: { !sideBySide && store.selectedKey != nil },
                                    set: { if !$0 { store.requestSelect(key: nil) } })) {
            ReviewWordSheet(store: store)
                .presentationDetents([.medium, .large])
                .presentationBackgroundInteraction(.enabled(upThrough: .medium))
                .presentationDragIndicator(.visible)
                .environment(\.layoutDirection, .rightToLeft)
        }
    }

    @ViewBuilder private var sidePanel: some View {
        if store.selectedKey != nil {
            ReviewWordSheet(store: store, embedded: true)
                .environment(\.layoutDirection, .rightToLeft)
        } else {
            ContentUnavailableView("اختر كلمة من الصفحة", systemImage: "hand.tap",
                                   description: Text("تظهر هنا أوجهها والمراجع وخطوات التحرير."))
                .accessibilityIdentifier("review-side-placeholder")
        }
    }

    private var pageColumn: some View {
        VStack(spacing: 0) {
            pageHeader
            ZStack {
                if let mushaf = store.mushaf {
                    ReviewPageCanvas(page: mushaf, library: library, statusFor: { store.status(forKey: $0) },
                                     selectedKeys: selectedKeys) { key in store.tapWord(key) }
                        .aspectRatio(PageLayoutConstants.pageAspect, contentMode: .fit)
                        .padding(.horizontal, 10)
                        .accessibilityIdentifier("review-page-canvas")
                } else {
                    switch store.loadState {
                    case .failed(let message):
                        ContentUnavailableView {
                            Label("تعذّر تحميل الصفحة", systemImage: "wifi.exclamationmark")
                        } description: {
                            Text(message)
                        } actions: {
                            Button("إعادة المحاولة") { Task { await store.load(page: store.pageNumber) } }
                                .buttonStyle(.borderedProminent)
                        }
                    default:
                        ProgressView("جارٍ تحميل الصفحة…")
                    }
                }
            }
            .frame(maxHeight: .infinity)
            ReviewStatsBar(store: store)
            ReviewSaveStatusBar(store: store)
            actionBar
        }
    }

    /// RTL book order: the previous page sits on the right (leading), the next page on the left (trailing).
    private var pageHeader: some View {
        HStack {
            Button { go(store.pageNumber - 1) } label: { Image(systemName: "chevron.backward").frame(width: 44, height: 36) }
                .disabled(store.pageNumber <= 1)
                .accessibilityLabel("الصفحة السابقة")
                .accessibilityIdentifier("review-previous-page")
            Spacer()
            VStack(spacing: 1) {
                Text("الصفحة \(store.pageNumber)").font(.headline).accessibilityIdentifier("review-page-title")
                if let m = store.mushaf?.metadata { Text("الجزء \(m.juz) · الحزب \(m.hizb)").font(.caption).foregroundStyle(.secondary) }
            }
            Spacer()
            Button { go(store.pageNumber + 1) } label: { Image(systemName: "chevron.forward").frame(width: 44, height: 36) }
                .disabled(store.pageNumber >= mushafPageCount)
                .accessibilityLabel("الصفحة التالية")
                .accessibilityIdentifier("review-next-page")
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 4)
    }

    private var actionBar: some View {
        HStack(spacing: 12) {
            Button {
                if let key = store.nextReviewKey(after: store.selectedKey) {
                    store.requestSelect(key: key)
                } else if let page = store.nextPageNeedingReview() {
                    go(page)
                }
            } label: {
                Label("التالي غير المراجَع", systemImage: "arrow.turn.down.left").frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .accessibilityIdentifier("review-next-unreviewed")
            Button { store.linkingNext.toggle() } label: {
                Label("ربط بالكلمة التالية", systemImage: "link").frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .tint(store.linkingNext ? .blue : .secondary)
            .disabled(store.selectedKey == nil)
            .accessibilityValue(store.linkingNext ? "مفعّل" : "غير مفعّل")
            .accessibilityIdentifier("review-link-next")
            Button { if let page = store.nextFlaggedPage() { go(page) } } label: {
                Label("المعلَّم", systemImage: "flag").frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .disabled(store.nextFlaggedPage() == nil)
        }
        .controlSize(.large)
        .padding(.horizontal, 16)
        .padding(.bottom, 8)
    }

    private func go(_ page: Int) {
        let target = min(mushafPageCount, max(1, page))
        lastPage = target
        store.requestPage(target)
    }
}
#endif
