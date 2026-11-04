import Foundation
import MushafCore
import Observation

/// The one place an App Intent hands the reader a destination. A running reader watches `pendingPage`; a cold launch
/// starts at the saved reading position, which `open(page:)` also moves.
@MainActor
@Observable
final class AppIntentRouter {
    static let shared = AppIntentRouter()

    /// The page the reader should show next; the reader takes it with `takePendingPage()`.
    private(set) var pendingPage: Int?

    @ObservationIgnored private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) { self.defaults = defaults }

    func open(page: Int) {
        let target = clampPage(page)
        ReadingPosition(defaults: defaults).page = target
        pendingPage = target
    }

    /// «Continue reading»: the app opens where the reader left off, which is what a launch already does.
    func continueReading() {}

    func takePendingPage() -> Int? {
        defer { pendingPage = nil }
        return pendingPage
    }
}
