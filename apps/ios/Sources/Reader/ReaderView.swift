import MushafCore
import SwiftUI

struct ReaderView: View {
    let library: MushafLibrary
    @State private var page = ReadingPosition().page
    @State private var chromeVisible = false
    @State private var showingIndex = false
    @State private var sliderPage = 1.0
    @State private var qiraat = QiraatPreferences()
    @State private var qiraatSelection: QiraatWordSelection?

    var body: some View {
        GeometryReader { geometry in
            let spread = Spread.isSpread(width: geometry.size.width, height: geometry.size.height)
            ZStack {
                Color(uiColor: .mushafDesk).ignoresSafeArea()
                MushafPager(library: library, page: $page, spread: spread,
                            qiraat: library.qiraat == nil ? .off : qiraat.display,
                            onTapCentre: { withAnimation(.easeInOut(duration: 0.2)) { chromeVisible.toggle() } },
                            onTapWord: openQiraat)
                .id(spread)  // single ↔ spread needs a different spine: rebuild the pager, keep the page
                .ignoresSafeArea()
                if chromeVisible { chrome.transition(.opacity) }
            }
        }
        .onChange(of: page) { _, newPage in ReadingPosition().page = newPage }
        .sheet(item: $qiraatSelection) { item in
            if let catalog = library.qiraat?.catalog {
                QiraatSheet(item: item, catalog: catalog, filter: qiraat.filter,
                            wordFont: try? library.fonts.font(page: item.word.page, size: 40)) { qiraatSelection = nil }
            }
        }
        .sheet(isPresented: $showingIndex) {
            IndexSheet(library: library, currentPage: page) { selected in
                page = selected
                showingIndex = false
            }
        }
    }

    private var metadata: PageMetadata? { library.page(page)?.metadata }

    private func openQiraat(_ tappedPage: MushafPage, _ word: MushafWord) {
        guard qiraat.enabled, let marks = library.qiraat?.marks(page: tappedPage.number),
              let selection = marks.selection(surah: word.ayahKey.surah, ayah: word.ayahKey.ayah,
                                              token: word.indexInAyah, filter: qiraat.filter) else { return }
        qiraatSelection = QiraatWordSelection(word: word, selection: selection)
    }

    private var chrome: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                Text(metadata?.surahNames.joined(separator: " · ") ?? "")
                Spacer()
                if let catalog = library.qiraat?.catalog {
                    if qiraat.enabled { QiraatFilterMenu(catalog: catalog, filter: $qiraat.filter) }
                    QiraatToggle(isOn: $qiraat.enabled)
                }
                Text(verbatim: "الجزء \(metadata?.juz ?? 0)")
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
