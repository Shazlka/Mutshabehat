#if DEBUG
import MushafCore
import SwiftUI

/// One Mushaf page for review: tap a word to open its sheet; words are tinted by review status.
struct ReviewPageScreen: View {
    @Bindable var store: ReviewStore
    let library: MushafLibrary
    let initialPage: Int
    @AppStorage("review:last-page:v1") private var lastPage = 1

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
        VStack(spacing: 0) {
            pageHeader
            ZStack {
                if let mushaf = store.mushaf {
                    ReviewPageCanvas(page: mushaf, library: library, statusFor: { store.status(forKey: $0) },
                                     selectedKeys: selectedKeys) { key in store.requestSelect(key: key) }
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
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .task(id: initialPage) {
            lastPage = initialPage
            await store.load(page: initialPage)
        }
        .sheet(isPresented: Binding(get: { store.selectedKey != nil }, set: { if !$0 { store.requestSelect(key: nil) } })) {
            ReviewWordSheet(store: store)
                .presentationDetents([.medium, .large])
                .presentationBackgroundInteraction(.enabled(upThrough: .medium))
                .presentationDragIndicator(.visible)
                .environment(\.layoutDirection, .rightToLeft)
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
