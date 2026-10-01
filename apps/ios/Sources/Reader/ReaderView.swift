import MushafCore
import SwiftUI

struct ReaderView: View {
    let library: MushafLibrary
    @State private var page = ReadingPosition().page
    @State private var chromeVisible = false
    @State private var showingIndex = false
    @State private var sliderPage = 1.0

    var body: some View {
        GeometryReader { geometry in
            let spread = Spread.isSpread(width: geometry.size.width, height: geometry.size.height)
            ZStack {
                Color(uiColor: .mushafDesk).ignoresSafeArea()
                MushafPager(library: library, page: $page, spread: spread) {
                    withAnimation(.easeInOut(duration: 0.2)) { chromeVisible.toggle() }
                }
                .id(spread)  // single ↔ spread needs a different spine: rebuild the pager, keep the page
                .ignoresSafeArea()
                if chromeVisible { chrome.transition(.opacity) }
            }
        }
        .onChange(of: page) { _, newPage in ReadingPosition().page = newPage }
        .sheet(isPresented: $showingIndex) {
            IndexSheet(library: library, currentPage: page) { selected in
                page = selected
                showingIndex = false
            }
        }
    }

    private var metadata: PageMetadata? { library.page(page)?.metadata }

    private var chrome: some View {
        VStack(spacing: 0) {
            HStack {
                Text(metadata?.surahNames.joined(separator: " · ") ?? "")
                Spacer()
                Text("الجزء \(metadata?.juz ?? 0)")
            }
            .font(.headline)
            .padding(.horizontal)
            .padding(.vertical, 10)
            .background(.regularMaterial)

            Spacer()

            VStack(spacing: 8) {
                // RTL environment: page 1 at the right end, like the book.
                Slider(value: $sliderPage, in: 1...Double(mushafPageCount), step: 1) { editing in
                    if !editing { page = Int(sliderPage) }
                }
                .accessibilityIdentifier("page-slider")
                .accessibilityLabel("الصفحة")
                .accessibilityValue(Text(verbatim: String(Int(sliderPage))))
                .accessibilityAdjustableAction { direction in
                    switch direction {
                    case .increment: page = clampPage(page + 1)
                    case .decrement: page = clampPage(page - 1)
                    @unknown default: return
                    }
                    sliderPage = Double(page)
                }
                HStack {
                    Button { showingIndex = true } label: { Label("الفهرس", systemImage: "list.bullet") }
                        .accessibilityIdentifier("open-index")
                    Spacer()
                    Text("ص \(Int(sliderPage))").monospacedDigit().accessibilityIdentifier("page-number")
                }
            }
            .padding()
            .background(.regularMaterial)
        }
        .environment(\.layoutDirection, .rightToLeft)
        .onAppear { sliderPage = Double(page) }
        .onChange(of: page) { _, newPage in sliderPage = Double(newPage) }
    }
}
