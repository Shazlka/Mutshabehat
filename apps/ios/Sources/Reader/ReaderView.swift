import MushafCore
import SwiftUI

/// First cut: shows the stored page, no turning yet. Task 9 replaces this with the paging reader.
struct ReaderView: View {
    let library: MushafLibrary

    var body: some View {
        SinglePage(library: library, number: ReadingPosition().page)
            .ignoresSafeArea()
            .background(Color(uiColor: .mushafDesk))
    }
}

private struct SinglePage: UIViewControllerRepresentable {
    let library: MushafLibrary
    let number: Int

    func makeUIViewController(context: Context) -> PageController {
        // `number` is already clamped by ReadingPosition, so the page always exists.
        PageController(page: library.page(number)!, library: library, isSpreadHalf: false) {}
    }

    func updateUIViewController(_ controller: PageController, context: Context) {}
}
